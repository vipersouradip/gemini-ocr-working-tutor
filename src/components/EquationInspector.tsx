/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Equation } from "../types";
import katex from "katex";
import Markdown from "react-markdown";
import {
  BookOpen,
  Code,
  Sparkles,
  Copy,
  Check,
  ChevronRight,
  HelpCircle,
  Play,
  RotateCcw,
  MessageSquare,
  Send,
  X,
} from "lucide-react";

interface EquationInspectorProps {
  equations: Equation[];
  selectedEquationId: string | null;
  onSelectEquation: (id: string | null) => void;
  hoveredEquationId: string | null;
  onHoverEquation: (id: string | null) => void;
  tutorModel: string;
}

// Sub-component to render LaTeX safely using KaTeX
function LaTeXRenderer({ latex }: { latex: string }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    try {
      const rendered = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
      setHtml(rendered);
    } catch (err) {
      console.error("KaTeX rendering error:", err);
      setHtml(`<span class="text-rose-500 font-mono">${latex}</span>`);
    }
  }, [latex]);

  return (
    <div
      className="math-renderer overflow-x-auto py-4 px-2 w-full text-center scrollbar-thin scrollbar-thumb-slate-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function EquationInspector({
  equations,
  selectedEquationId,
  onSelectEquation,
  hoveredEquationId,
  onHoverEquation,
  tutorModel,
}: EquationInspectorProps) {
  const [activeTab, setActiveTab] = useState<"details" | "latex" | "tutor">("details");
  const [copied, setCopied] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "model"; text: string }[]>([]);

  const selectedEquation = equations.find((e) => e.id === selectedEquationId) || null;

  // Clear states when equation selection changes
  useEffect(() => {
    setAiResponse(null);
    setChatHistory([]);
    setCustomQuestion("");
    setCopied(false);
  }, [selectedEquationId]);

  const handleCopy = () => {
    if (!selectedEquation) return;
    navigator.clipboard.writeText(selectedEquation.latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Preset question handler
  const askAIPreset = async (promptType: string) => {
    if (!selectedEquation) return;

    let question = "";
    switch (promptType) {
      case "derivation":
        question = `Can you provide a step-by-step derivation of the equation ${selectedEquation.latex}? Explain the physical or mathematical meaning of each step.`;
        break;
      case "variables":
        question = `Identify and explain every single variable, constant, and symbol inside the formula ${selectedEquation.latex}. What are their standard units?`;
        break;
      case "example":
        question = `Show an interesting real-world application of ${selectedEquation.latex} and solve a concrete numerical example using it.`;
        break;
      default:
        return;
    }

    await queryAI(question);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || !selectedEquation) return;
    const question = customQuestion;
    setCustomQuestion("");
    await queryAI(question);
  };

  const queryAI = async (question: string) => {
    if (!selectedEquation) return;

    setAiLoading(true);
    setAiResponse(null);

    // Update local chat history with user's question
    setChatHistory((prev) => [...prev, { role: "user", text: question }]);

    try {
      const response = await fetch("/api/explain-equation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equation: selectedEquation.latex,
          explanation: selectedEquation.explanation,
          question,
          tutorModel,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch response");
      }

      setAiResponse(data.answer);
      setChatHistory((prev) => [...prev, { role: "model", text: data.answer }]);
    } catch (err: any) {
      console.error(err);
      const errMsg = `Error: ${err.message || "Unable to get an answer at the moment. Please make sure the Gemini API is fully configured."}`;
      setAiResponse(errMsg);
      setChatHistory((prev) => [...prev, { role: "model", text: errMsg }]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Active Selection Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <span>Equation Inspector</span>
        </h3>
        {selectedEquation && (
          <button
            onClick={() => onSelectEquation(null)}
            className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition-colors"
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {!selectedEquation ? (
          /* Empty State - List of detected equations */
          <div className="flex-1 flex flex-col p-6">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Detected Equations List ({equations.length})
            </h4>
            {equations.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <HelpCircle className="w-12 h-12 stroke-1 text-slate-600 mb-3" />
                <p className="text-sm">No equations loaded yet.</p>
                <p className="text-xs mt-1">Upload an image of mathematical formulas to inspect them.</p>
              </div>
            ) : (
              <div className="flex-grow overflow-y-auto space-y-2.5 max-h-[500px] pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {equations.map((eq) => {
                  const isHovered = hoveredEquationId === eq.id;
                  const isCorrect = eq.validationStatus === "correct";
                  const isIncorrect = eq.validationStatus === "incorrect";

                  return (
                    <button
                      key={eq.id}
                      onClick={() => onSelectEquation(eq.id)}
                      onMouseEnter={() => onHoverEquation(eq.id)}
                      onMouseLeave={() => onHoverEquation(null)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group ${
                        isHovered
                          ? isCorrect
                            ? "bg-emerald-950/20 border-emerald-500/50 shadow-md"
                            : isIncorrect
                              ? "bg-rose-950/20 border-rose-500/50 shadow-md"
                              : "bg-indigo-950/30 border-indigo-500/50 shadow-md"
                          : isCorrect
                            ? "bg-emerald-950/5 border-emerald-950/40 hover:border-emerald-700/60"
                            : isIncorrect
                              ? "bg-rose-950/5 border-rose-950/40 hover:border-rose-700/60"
                              : "bg-slate-950/20 border-slate-800/80 hover:bg-slate-800/30 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            isCorrect
                              ? "bg-emerald-500/20 text-emerald-400"
                              : isIncorrect
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-indigo-500/20 text-indigo-400"
                          }`}>
                            {eq.id.toUpperCase().replace("_", " ")}
                          </span>

                          {/* Quick Correct / Incorrect visual checkmark or cross badge */}
                          {isCorrect && (
                            <span className="text-emerald-400 flex items-center gap-0.5 text-[10px] font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span>Correct</span>
                            </span>
                          )}
                          {isIncorrect && (
                            <span className="text-rose-400 flex items-center gap-0.5 text-[10px] font-medium bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20">
                              <X className="w-3 h-3 stroke-[2.5]" />
                              <span>Error</span>
                            </span>
                          )}

                          <span className="text-xs font-semibold text-slate-300 truncate max-w-[150px]">
                            {eq.explanation}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-900 overflow-x-auto whitespace-nowrap scrollbar-none">
                          {eq.latex}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Active Selected Equation Workspace */
          <div className="flex-grow flex flex-col">
            {/* KaTeX Display Card */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex flex-col items-center justify-center min-h-[140px] relative">
              <span className="absolute top-3 left-4 text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono bg-amber-400/10 px-2 py-0.5 rounded">
                {selectedEquation.id.toUpperCase().replace("_", " ")}
              </span>

              {/* Equation Rendered */}
              <LaTeXRenderer latex={selectedEquation.latex} />
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-800 bg-slate-950/30">
              <button
                onClick={() => setActiveTab("details")}
                className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === "details"
                    ? "border-amber-400 text-amber-400 bg-amber-400/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Details
              </button>
              <button
                onClick={() => setActiveTab("latex")}
                className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === "latex"
                    ? "border-amber-400 text-amber-400 bg-amber-400/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Code className="w-4 h-4" />
                LaTeX Code
              </button>
              <button
                onClick={() => setActiveTab("tutor")}
                className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === "tutor"
                    ? "border-amber-400 text-amber-400 bg-amber-400/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                AI Tutor
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6 flex-1 flex flex-col min-h-0 overflow-y-auto">
              {activeTab === "details" && (
                <div className="space-y-4">
                  {/* Step Verification Banner */}
                  {selectedEquation.validationStatus && (
                    <div className={`p-4 rounded-xl border flex flex-col gap-1.5 ${
                      selectedEquation.validationStatus === "correct"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 animate-in fade-in zoom-in-95 duration-200"
                        : selectedEquation.validationStatus === "incorrect"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-300 animate-in fade-in zoom-in-95 duration-200"
                          : "bg-slate-950/40 border-slate-800 text-slate-300"
                    }`}>
                      <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider">
                        {selectedEquation.validationStatus === "correct" && (
                          <>
                            <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                            <span>Step Verified Correct</span>
                          </>
                        )}
                        {selectedEquation.validationStatus === "incorrect" && (
                          <>
                            <X className="w-4 h-4 text-rose-400 stroke-[3]" />
                            <span>Calculation Error Detected</span>
                          </>
                        )}
                        {selectedEquation.validationStatus === "neutral" && (
                          <>
                            <HelpCircle className="w-4 h-4 text-slate-400" />
                            <span>General Formula / Definition</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed opacity-95 mt-0.5">
                        {selectedEquation.validationFeedback || "Equation scanned and parsed successfully."}
                      </p>
                    </div>
                  )}

                  <div>
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Equation Name / Classification
                    </h5>
                    <p className="text-slate-200 font-semibold text-base">{selectedEquation.explanation}</p>
                  </div>

                  <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Plain Text Expression
                    </h5>
                    <p className="text-xs text-slate-300 italic">"{selectedEquation.rawText}"</p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      OCR Spatial Analysis
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                      <div>
                        Top Margin: <span className="text-amber-400">{selectedEquation.boundingBox.ymin}‰</span>
                      </div>
                      <div>
                        Left Margin: <span className="text-amber-400">{selectedEquation.boundingBox.xmin}‰</span>
                      </div>
                      <div>
                        Bottom Margin: <span className="text-amber-400">{selectedEquation.boundingBox.ymax}‰</span>
                      </div>
                      <div>
                        Right Margin: <span className="text-amber-400">{selectedEquation.boundingBox.xmax}‰</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab("tutor")}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
                    >
                      <Sparkles className="w-4 h-4" />
                      Explore with AI Tutor
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "latex" && (
                <div className="space-y-4 flex flex-col h-full">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      LaTeX Source Code
                    </h5>
                    <div className="relative">
                      <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                        {selectedEquation.latex}
                      </pre>
                      <button
                        onClick={handleCopy}
                        className="absolute top-2.5 right-2.5 p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg transition-colors border border-slate-700"
                        title="Copy LaTeX"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                    <h5 className="text-xs font-semibold text-slate-400">Embedding Tip</h5>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      You can paste this LaTeX into any renderer (like KaTeX, MathJax, Notion, or Overleaf). To use in markdown, wrap it in double dollar signs:
                    </p>
                    <code className="block bg-slate-950 p-2 rounded text-[10px] font-mono text-slate-300">
                      $${selectedEquation.latex}$$
                    </code>
                  </div>
                </div>
              )}

              {activeTab === "tutor" && (
                <div className="space-y-4 flex flex-col flex-1 min-h-0">
                  {/* Assistant Intro */}
                  {chatHistory.length === 0 && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-200">AI Math Assistant</p>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            I can explain the derivation, break down the terms and units, or provide solvable exercises for this equation. Select a study guide below:
                          </p>
                        </div>
                      </div>

                      {/* Preset Questions */}
                      <div className="grid grid-cols-1 gap-2 pt-2">
                        <button
                          onClick={() => askAIPreset("derivation")}
                          disabled={aiLoading}
                          className="flex items-center gap-2 p-3 bg-slate-950/50 border border-slate-800 hover:border-slate-700 rounded-xl text-left hover:bg-slate-800/30 transition-all text-xs text-slate-300 font-medium group disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                          Show Step-by-Step Derivation
                        </button>
                        <button
                          onClick={() => askAIPreset("variables")}
                          disabled={aiLoading}
                          className="flex items-center gap-2 p-3 bg-slate-950/50 border border-slate-800 hover:border-slate-700 rounded-xl text-left hover:bg-slate-800/30 transition-all text-xs text-slate-300 font-medium group disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                          Identify Variables & Units
                        </button>
                        <button
                          onClick={() => askAIPreset("example")}
                          disabled={aiLoading}
                          className="flex items-center gap-2 p-3 bg-slate-950/50 border border-slate-800 hover:border-slate-700 rounded-xl text-left hover:bg-slate-800/30 transition-all text-xs text-slate-300 font-medium group disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                          Real-world Applications & Examples
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Chat History */}
                  {chatHistory.length > 0 && (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-2 max-h-[300px] scrollbar-thin scrollbar-thumb-slate-800">
                      {chatHistory.map((chat, idx) => (
                        <div key={idx} className={`flex gap-2.5 ${chat.role === "user" ? "justify-end" : "justify-start"}`}>
                          {chat.role === "model" && (
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 h-8 w-8 flex items-center justify-center">
                              <Sparkles className="w-4 h-4" />
                            </div>
                          )}
                          <div
                            className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                              chat.role === "user"
                                ? "bg-amber-400 text-slate-950 font-medium rounded-tr-none"
                                : "bg-slate-950/60 border border-slate-800 text-slate-300 rounded-tl-none markdown-body prose prose-invert prose-xs"
                            }`}
                          >
                            {chat.role === "model" ? (
                              <Markdown>{chat.text}</Markdown>
                            ) : (
                              chat.text
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Loading State */}
                      {aiLoading && (
                        <div className="flex gap-2.5 justify-start">
                          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 h-8 w-8 flex items-center justify-center animate-pulse">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.4s]"></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reset Chat button */}
                  {chatHistory.length > 0 && !aiLoading && (
                    <button
                      onClick={() => setChatHistory([])}
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 self-start font-medium"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Chat Session
                    </button>
                  )}

                  {/* Custom Question Form */}
                  <form onSubmit={handleCustomSubmit} className="flex gap-2 mt-auto">
                    <input
                      type="text"
                      placeholder="Ask any question about this equation..."
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      disabled={aiLoading}
                      className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2 text-xs text-slate-100 disabled:opacity-50 placeholder-slate-500 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={aiLoading || !customQuestion.trim()}
                      className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
