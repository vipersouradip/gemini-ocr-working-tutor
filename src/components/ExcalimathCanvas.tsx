/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { Equation, DrawAction, Tool } from "../types";
import {
  Edit2,
  Eraser,
  Minus,
  Square,
  Trash2,
  Undo2,
  Redo2,
  Sparkles,
  Layers,
  HelpCircle,
  Palette,
  Maximize2,
  Check,
  X,
} from "lucide-react";

interface ExcalimathCanvasProps {
  equations: Equation[];
  selectedEquationId: string | null;
  hoveredEquationId: string | null;
  onSelectEquation: (id: string | null) => void;
  onHoverEquation: (id: string | null) => void;
  onScan: (base64Image: string) => void;
  isLoading: boolean;
  actions: DrawAction[];
  setActions: React.Dispatch<React.SetStateAction<DrawAction[]>>;
  redoStack: DrawAction[];
  setRedoStack: React.Dispatch<React.SetStateAction<DrawAction[]>>;
}

export default function ExcalimathCanvas({
  equations,
  selectedEquationId,
  hoveredEquationId,
  onSelectEquation,
  onHoverEquation,
  onScan,
  isLoading,
  actions,
  setActions,
  redoStack,
  setRedoStack,
}: ExcalimathCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Canvas Settings State
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>("#f8fafc"); // Chalk White
  const [thickness, setThickness] = useState<number>(3);

  // Interactive drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);

  // Fixed Canvas Dimensions to keep analysis normalized
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 650;

  // Set up board colors (premium chalkboard style)
  const colors = [
    { value: "#f8fafc", name: "Chalk White" },
    { value: "#fca5a5", name: "Chalk Red" },
    { value: "#93c5fd", name: "Chalk Blue" },
    { value: "#fde047", name: "Chalk Yellow" },
    { value: "#86efac", name: "Chalk Green" },
    { value: "#c084fc", name: "Chalk Purple" },
  ];

  // Draw current board actions
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background to premium slate chalkboard
    ctx.fillStyle = "#0f172a"; // slate-900 / dark board
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid lines
    ctx.strokeStyle = "#1e293b"; // slate-800
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < CANVAS_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Draw all completed actions
    actions.forEach((act) => {
      drawActionOnContext(ctx, act);
    });

    // Draw active drawing live feedback
    if (isDrawing && currentPoints.length > 0) {
      const activeAction: DrawAction = {
        tool,
        color: tool === "eraser" ? "#0f172a" : color,
        thickness: tool === "eraser" ? thickness * 4 : thickness,
        points: currentPoints,
      };
      drawActionOnContext(ctx, activeAction);
    }
  };

  const drawActionOnContext = (ctx: CanvasRenderingContext2D, act: DrawAction) => {
    if (act.points.length === 0) return;

    ctx.strokeStyle = act.color;
    ctx.lineWidth = act.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (act.tool === "pen" || act.tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(act.points[0].x, act.points[0].y);
      for (let i = 1; i < act.points.length; i++) {
        ctx.lineTo(act.points[i].x, act.points[i].y);
      }
      ctx.stroke();
    } else if (act.tool === "line") {
      if (act.points.length < 2) return;
      const start = act.points[0];
      const end = act.points[act.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (act.tool === "rect") {
      if (act.points.length < 2) return;
      const start = act.points[0];
      const end = act.points[act.points.length - 1];
      ctx.beginPath();
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.stroke();
    }
  };

  // Trigger redraw on action list changes
  useEffect(() => {
    redrawCanvas();
  }, [actions, isDrawing, currentPoints]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    // Scale back to internal canvas coordinates
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;

    return { x, y };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Set pointer capture to guarantee drawing continuity if stylus/finger leaves the viewport
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn("Failed to set pointer capture:", err);
    }

    const coords = getCanvasCoords(e);
    if (!coords) return;

    setIsDrawing(true);
    setCurrentPoints([coords]);
    setRedoStack([]); // Clear redo chain on new action
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (tool === "pen" || tool === "eraser") {
      setCurrentPoints((prev) => [...prev, coords]);
    } else {
      // Shape tools (line, rect) only track start point and current point
      setCurrentPoints((prev) => [prev[0], coords]);
    }
  };

  const endDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if pointer capture release fails
    }

    if (currentPoints.length > 0) {
      const newAction: DrawAction = {
        tool,
        color: tool === "eraser" ? "#0f172a" : color,
        thickness: tool === "eraser" ? thickness * 4 : thickness,
        points: currentPoints,
      };
      setActions((prev) => [...prev, newAction]);
    }
    setCurrentPoints([]);
  };

  const handleUndo = () => {
    if (actions.length === 0) return;
    const lastAction = actions[actions.length - 1];
    setActions((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, lastAction]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextAction = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setActions((prev) => [...prev, nextAction]);
  };

  const clearCanvas = () => {
    setActions([]);
    setRedoStack([]);
    setCurrentPoints([]);
  };

  const triggerScan = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export current drawing to image/png base64
    const dataUrl = canvas.toDataURL("image/png");
    onScan(dataUrl);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Board Settings Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-slate-950/60 backdrop-blur-sm">
        {/* Tool Selectors */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-850">
          <button
            onClick={() => setTool("pen")}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
              tool === "pen"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Freehand Chalk Pen"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
              tool === "eraser"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Board Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool("line")}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
              tool === "line"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Straight Line Tool"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool("rect")}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
              tool === "rect"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Rectangle Frame Tool"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette (Pen colors only) */}
        {tool !== "eraser" && (
          <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-850">
            <Palette className="w-3.5 h-3.5 text-slate-500 mr-1" />
            {colors.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                style={{ backgroundColor: c.value }}
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer hover:scale-125 focus:outline-none ${
                  color === c.value
                    ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900 scale-110"
                    : "opacity-80 hover:opacity-100"
                }`}
                title={c.name}
              />
            ))}
          </div>
        )}

        {/* Board Operations (Undo, Redo, Clear) */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-850">
          <button
            onClick={handleUndo}
            disabled={actions.length === 0}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 transition-colors"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-800 mx-1"></div>
          <button
            onClick={clearCanvas}
            className="p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Clear chalkboard"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Scan Button */}
        <button
          onClick={triggerScan}
          disabled={isLoading || actions.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-xl px-4 py-2 text-xs font-semibold transition-all shadow-lg shadow-indigo-600/15 flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Analyze Board Expressions
        </button>
      </div>

      {/* Main Interactive Chalkboard */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-slate-950 flex items-center justify-center p-4 min-h-[400px] overflow-hidden"
      >
        <div className="relative aspect-[1200/650] w-full max-w-full rounded-xl overflow-hidden shadow-2xl border border-slate-850 bg-slate-900">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={endDrawing}
            onPointerCancel={endDrawing}
            onPointerLeave={endDrawing}
            style={{ touchAction: "none" }}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          />

          {/* Equation overlays (Bounding Boxes drawn directly on the canvas) */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="relative w-full h-full pointer-events-none">
              {equations.map((eq) => {
                const { ymin, xmin, ymax, xmax } = eq.boundingBox;
                const isSelected = selectedEquationId === eq.id;
                const isHovered = hoveredEquationId === eq.id;

                // Map coordinates directly to percentage style
                const top = ymin / 10;
                const left = xmin / 10;
                const width = (xmax - xmin) / 10;
                const height = (ymax - ymin) / 10;

                 return (
                  <button
                    key={eq.id}
                    id={`bbox-${eq.id}`}
                    onClick={() => onSelectEquation(isSelected ? null : eq.id)}
                    onMouseEnter={() => onHoverEquation(eq.id)}
                    onMouseLeave={() => onHoverEquation(null)}
                    style={{
                      top: `${top}%`,
                      left: `${left}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                    }}
                    className={`absolute rounded transition-all duration-200 cursor-pointer focus:outline-none flex flex-col justify-between items-start group p-1.5 pointer-events-auto ${
                      isSelected
                        ? "border-2 border-amber-400 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-30"
                        : isHovered
                          ? "border-2 border-indigo-400 bg-indigo-500/15 shadow-[0_0_12px_rgba(99,102,241,0.4)] z-20"
                          : eq.validationStatus === "correct"
                            ? "border border-emerald-500/60 bg-emerald-500/5 hover:border-emerald-400 hover:bg-emerald-500/10 z-10"
                            : eq.validationStatus === "incorrect"
                              ? "border border-rose-500/60 bg-rose-500/5 hover:border-rose-400 hover:bg-rose-500/10 z-10"
                              : "border border-slate-600/60 bg-slate-500/5 hover:border-slate-400 hover:bg-slate-500/10 z-10"
                    }`}
                    title={`Select Equation ${eq.id}`}
                  >
                    {/* Top Label Badge with validation indicators */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors pointer-events-none select-none ${
                          isSelected
                            ? "bg-amber-400 text-slate-950 font-bold"
                            : isHovered
                              ? "bg-indigo-400 text-slate-950 font-semibold"
                              : eq.validationStatus === "correct"
                                ? "bg-emerald-500 text-white font-semibold"
                                : eq.validationStatus === "incorrect"
                                  ? "bg-rose-500 text-white font-semibold"
                                  : "bg-slate-600 text-white"
                        }`}
                      >
                        {eq.id.toUpperCase().replace("_", " ")}
                      </span>
                      {eq.validationStatus === "correct" && (
                        <span className="text-emerald-400 bg-slate-950/95 border border-emerald-500/50 rounded-full p-0.5 shadow-lg flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                      {eq.validationStatus === "incorrect" && (
                        <span className="text-rose-400 bg-slate-950/95 border border-rose-500/50 rounded-full p-0.5 shadow-lg flex items-center justify-center">
                          <X className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    {/* Hover action indicator */}
                    <span className="self-end opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-950/85 text-white rounded p-0.5">
                      <Maximize2 className="w-2.5 h-2.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Chalkboard instruction footer */}
      <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <span>Write mathematical formulas with the tools above and scan.</span>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/80"></span> Found
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-400"></span> Active
          </span>
        </div>
      </div>
    </div>
  );
}
