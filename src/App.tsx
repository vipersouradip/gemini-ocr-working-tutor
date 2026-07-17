/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Equation, DrawAction, OcrModelType, TutorModelType } from "./types";
import ImageMarkupCanvas from "./components/ImageMarkupCanvas";
import EquationInspector from "./components/EquationInspector";
import ExcalimathCanvas from "./components/ExcalimathCanvas";
import { presets } from "./utils/presetGenerator";
import {
  Upload,
  Image as ImageIcon,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Clipboard,
  FileImage,
  AlertTriangle,
  Flame,
  PenTool,
} from "lucide-react";

// Curated OpenRouter tutor models. `id` is the OpenRouter model slug; any other
// model can be reached via the "Custom model…" option. Edit this list freely.
const OPENROUTER_TUTOR_MODELS: { id: string; label: string }[] = [
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8" },
  { id: "openai/gpt-4.1", label: "GPT-4.1" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "x-ai/grok-4.5", label: "Grok 4.5" },
];

export default function App() {
  const [activeMode, setActiveMode] = useState<"chalkboard" | "upload">("chalkboard");
  const [ocrModel, setOcrModel] = useState<OcrModelType>("mathpix");
  // `tutorSelection` is the raw dropdown value; "openrouter:custom" reveals a
  // free-text field. `tutorModel` is the resolved value sent to the server.
  const [tutorSelection, setTutorSelection] = useState<string>("openrouter:anthropic/claude-sonnet-5");
  const [customTutorModel, setCustomTutorModel] = useState<string>("");
  const tutorModel: TutorModelType =
    tutorSelection === "openrouter:custom"
      ? (customTutorModel.trim()
          ? (`openrouter:${customTutorModel.trim()}` as TutorModelType)
          : "gemini")
      : (tutorSelection as TutorModelType);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [equations, setEquations] = useState<Equation[]>([]);
  const [selectedEquationId, setSelectedEquationId] = useState<string | null>(null);
  const [hoveredEquationId, setHoveredEquationId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Durable drawing states for Excalimath Canvas
  const [canvasActions, setCanvasActions] = useState<DrawAction[]>([]);
  const [canvasRedoStack, setCanvasRedoStack] = useState<DrawAction[]>([]);

  // Setup clipboard copy-paste listener to let users copy an image and paste it directly!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setActiveMode("upload");
            handleFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPEG, WebP).");
      return;
    }

    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImageUrl(base64);
      triggerEquationAnalysis(base64, file.type);
    };
    reader.onerror = () => {
      setError("Failed to read the image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setActiveMode("upload");
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    const { dataUrl, mimeType: presetMime } = preset.generate();
    if (!dataUrl) return;

    setImageUrl(dataUrl);
    setMimeType(presetMime);
    triggerEquationAnalysis(dataUrl, presetMime);
  };

  const handleCanvasScan = (base64Image: string) => {
    setImageUrl(base64Image);
    setMimeType("image/png");
    triggerEquationAnalysis(base64Image, "image/png");
  };

  const triggerEquationAnalysis = async (base64Image: string, type: string) => {
    setLoading(true);
    setError(null);
    setEquations([]);
    setSelectedEquationId(null);

    // Simulated staggered loading logs to keep the UI deeply engaging
    const steps = [
      "Uploading high-resolution canvas data...",
      "Connecting to Gemini 3.5 OCR & Vision engine...",
      "Analyzing image structure & spatial layout...",
      "Detecting 2D bounding-box coordinates [0-1000]...",
      "Transcribing complex formulas to LaTeX representations...",
      "Compiling math metadata and category breakdown...",
    ];

    let stepIndex = 0;
    setLoadingStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setLoadingStep(steps[stepIndex]);
    }, 1500);

    try {
      const response = await fetch("/api/analyze-equations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          mimeType: type,
          ocrModel,
          tutorModel,
        }),
      });

      const data = await response.json();
      clearInterval(stepInterval);

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze the equations.");
      }

      const detected = data.equations || [];
      setEquations(detected);

      // Auto-select the first equation if found
      if (detected.length > 0) {
        setSelectedEquationId(detected[0].id);
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error(err);
      setError(
        err.message || "An unexpected error occurred. Please check that your Gemini API key is correctly configured."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setImageUrl(null);
    setMimeType("");
    setEquations([]);
    setSelectedEquationId(null);
    setHoveredEquationId(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-amber-400 selection:text-slate-950">
      {/* Header Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-amber-400 p-2 rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-slate-950 font-extrabold" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Excalimath Lens
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Interactive Equation Whiteboard & LaTeX Rendering Engine
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* OCR Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-inner">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase font-mono tracking-wider">OCR</span>
              <select
                value={ocrModel}
                onChange={(e) => setOcrModel(e.target.value as OcrModelType)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-semibold hover:text-indigo-400 transition-colors"
              >
                <option value="gemini" className="bg-slate-950 text-slate-100">Gemini 2.5 Flash</option>
                <option value="mathpix" className="bg-slate-950 text-slate-100">Mathpix API</option>
                <option value="mistral" className="bg-slate-950 text-slate-100">Mistral Pixtral (Vision)</option>
              </select>
            </div>

            {/* Tutor Selection Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-inner">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase font-mono tracking-wider">Tutor AI</span>
              <select
                value={tutorSelection}
                onChange={(e) => setTutorSelection(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-semibold hover:text-indigo-400 transition-colors"
              >
                <optgroup label="Direct" className="bg-slate-950 text-slate-100">
                  <option value="gemini" className="bg-slate-950 text-slate-100">Gemini 2.5 Flash</option>
                  <option value="deepseek" className="bg-slate-950 text-slate-100">DeepSeek Chat (V3)</option>
                  <option value="mistral" className="bg-slate-950 text-slate-100">Mistral Large</option>
                </optgroup>
                <optgroup label="OpenRouter" className="bg-slate-950 text-slate-100">
                  {OPENROUTER_TUTOR_MODELS.map((m) => (
                    <option key={m.id} value={`openrouter:${m.id}`} className="bg-slate-950 text-slate-100">
                      {m.label}
                    </option>
                  ))}
                  <option value="openrouter:custom" className="bg-slate-950 text-slate-100">Custom model…</option>
                </optgroup>
              </select>
            </div>

            {/* Custom OpenRouter model id input */}
            {tutorSelection === "openrouter:custom" && (
              <input
                type="text"
                value={customTutorModel}
                onChange={(e) => setCustomTutorModel(e.target.value)}
                placeholder="openrouter model id, e.g. anthropic/claude-sonnet-4.5"
                spellCheck={false}
                className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 focus:border-indigo-500 focus:outline-none text-xs text-slate-100 placeholder-slate-500 font-mono w-64 shadow-inner"
              />
            )}

            {imageUrl && (
              <button
                onClick={resetScanner}
                className="text-xs text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Workspace
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col justify-center">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Scanner Error</h4>
              <p className="text-xs mt-1 leading-relaxed">{error}</p>
              {error.includes("GEMINI_API_KEY") && (
                <div className="mt-3 text-[11px] bg-rose-950/40 p-2.5 rounded border border-rose-900/50 text-rose-200">
                  To configure your key, navigate to the **Settings &gt; Secrets** panel in the Google AI Studio UI and add **GEMINI_API_KEY**. Once added, the scanner will connect automatically.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workspace Mode Switcher (only shown when no image/canvas is active & analyzed) */}
        {equations.length === 0 && !loading && (
          <div className="flex justify-center mb-8">
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
              <button
                onClick={() => {
                  setActiveMode("chalkboard");
                  resetScanner();
                }}
                className={`px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeMode === "chalkboard"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <PenTool className="w-4 h-4" />
                Excalimath Chalkboard
              </button>
              <button
                onClick={() => {
                  setActiveMode("upload");
                  resetScanner();
                }}
                className={`px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeMode === "upload"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload Image File
              </button>
            </div>
          </div>
        )}

        {/* Workspace Active Viewports */}
        <div className={`w-full relative ${loading ? "pointer-events-none select-none" : ""}`}>
          {equations.length === 0 ? (
            /* Initial State: either Chalkboard or Upload depending on activeMode */
            activeMode === "chalkboard" ? (
              <div className="max-w-5xl w-full mx-auto space-y-6">
                <div className="text-center space-y-2 max-w-2xl mx-auto">
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    Interactive Drawing Chalkboard
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Write down lines of mathematical formulas, fractions, or proofs. When scanned, Gemini will box, transcribe, and tutor you on them.
                  </p>
                </div>

                {/* Excalimath Canvas board */}
                <div className="h-[600px]">
                  <ExcalimathCanvas
                    equations={equations}
                    selectedEquationId={selectedEquationId}
                    hoveredEquationId={hoveredEquationId}
                    onSelectEquation={setSelectedEquationId}
                    onHoverEquation={setHoveredEquationId}
                    onScan={handleCanvasScan}
                    isLoading={loading}
                    actions={canvasActions}
                    setActions={setCanvasActions}
                    redoStack={canvasRedoStack}
                    setRedoStack={setCanvasRedoStack}
                  />
                </div>
              </div>
            ) : (
              /* Upload mode */
              <div className="max-w-4xl w-full mx-auto space-y-8 py-4">
                <div className="text-center space-y-2 max-w-2xl mx-auto">
                  <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    Transcribe & Render Mathematical Equations
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Upload images of textbook equations, whiteboard lectures, or handwritten formulas. MathLens detects coordinates, overlays bounding boxes, transcribes to LaTeX, and explains them.
                  </p>
                </div>

                {/* Drag & Drop Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 relative group overflow-hidden bg-slate-900/20 ${
                    isDragging
                      ? "border-amber-400 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.15)] scale-[1.01]"
                      : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/30"
                  }`}
                >
                  {/* Decorative Math Symbols Background */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none font-serif text-3xl flex flex-wrap justify-around items-center p-4">
                    <span>∫ e^x dx</span>
                    <span>f(x) = y</span>
                    <span>∑ i^2</span>
                    <span>π ≈ 3.14</span>
                    <span>Δx Δp ≥ ℏ/2</span>
                    <span>∇ × E = -∂B/∂t</span>
                    <span>x² + y² = r²</span>
                  </div>

                  <div className="relative flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 rounded-full bg-slate-950 border border-slate-850 group-hover:scale-110 transition-transform duration-300">
                      <Upload className="w-8 h-8 text-indigo-400" />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-slate-200">
                        Drag and drop your math image, or <span className="text-indigo-400 hover:underline cursor-pointer">browse</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Supports PNG, JPEG, WebP (or paste straight using <kbd className="bg-slate-900 px-1 py-0.5 rounded text-[10px]">Ctrl+V</kbd>)
                      </p>
                    </div>

                    {/* Hidden File Input */}
                    <input
                      type="file"
                      id="math-file-input"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleFileInput}
                      accept="image/*"
                    />
                  </div>
                </div>

                {/* Presets Grid */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Try standard interactive presets
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => loadPreset(preset.id)}
                        className="p-4 bg-slate-900/40 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-xl text-left transition-all group hover:shadow-lg flex flex-col justify-between h-[120px]"
                      >
                        <div>
                          <h4 className="font-semibold text-sm text-slate-200 group-hover:text-indigo-400 transition-colors">
                            {preset.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {preset.description}
                          </p>
                        </div>
                        <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase flex items-center gap-1 mt-2">
                          Load preset →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Active Interactive Workspace split panel */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-in fade-in slide-in-from-bottom-3 duration-500">
              {/* Left Interactive Canvas - Displays either Chalkboard overlay or uploaded Image layer */}
              <div className="lg:col-span-7 h-full">
                {activeMode === "chalkboard" ? (
                  <div className="h-[600px]">
                    <ExcalimathCanvas
                      equations={equations}
                      selectedEquationId={selectedEquationId}
                      hoveredEquationId={hoveredEquationId}
                      onSelectEquation={setSelectedEquationId}
                      onHoverEquation={setHoveredEquationId}
                      onScan={handleCanvasScan}
                      isLoading={loading}
                      actions={canvasActions}
                      setActions={setCanvasActions}
                      redoStack={canvasRedoStack}
                      setRedoStack={setCanvasRedoStack}
                    />
                  </div>
                ) : (
                  <ImageMarkupCanvas
                    imageUrl={imageUrl!}
                    equations={equations}
                    selectedEquationId={selectedEquationId}
                    hoveredEquationId={hoveredEquationId}
                    onSelectEquation={setSelectedEquationId}
                    onHoverEquation={setHoveredEquationId}
                  />
                )}
              </div>

              {/* Right Inspector & AI Tutor */}
              <div className="lg:col-span-5 h-full">
                <EquationInspector
                  equations={equations}
                  selectedEquationId={selectedEquationId}
                  onSelectEquation={setSelectedEquationId}
                  hoveredEquationId={hoveredEquationId}
                  onHoverEquation={setHoveredEquationId}
                  tutorModel={tutorModel}
                />
              </div>
            </div>
          )}

          {/* Absolute Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center space-y-6 rounded-2xl animate-in fade-in duration-300">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl border-4 border-indigo-500/20 border-t-indigo-400 animate-spin flex items-center justify-center"></div>
                <Sparkles className="w-6 h-6 text-amber-400 animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-lg text-slate-100">Scanning Math Canvas</h3>
                <p className="text-xs text-slate-400 font-mono bg-slate-900/60 px-4 py-2.5 rounded-xl border border-slate-850 max-w-md mx-auto">
                  {loadingStep}
                </p>
              </div>

              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
                Spatial grid rendering in progress
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 MathLens. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300 transition-colors">Documentation</a>
            <a href="#" className="hover:text-slate-300 transition-colors">KaTeX Core</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Google Gemini AI</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

