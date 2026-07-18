/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import MathMarkdown from "./MathMarkdown";
import { DrawAction, Tool, PlacedMark, PlacedAnnotation } from "../types";
import {
  Pencil,
  Eraser,
  Minus,
  ArrowUpRight,
  Square,
  StickyNote,
  Trash2,
  Undo2,
  Redo2,
  Check,
  X,
  Lightbulb,
  ScanLine,
  ChevronDown,
  GripHorizontal,
} from "lucide-react";

export const CANVAS_WIDTH = 1200;
export const DEFAULT_BOARD_HEIGHT = 820;

type GridStyle = "dots" | "lines" | "none";

// Fixed identity colors for the structural boxes (independent of pen color).
const DIAGRAM_COLOR = "#2563eb";
const ROUGH_COLOR = "#f59e0b";

interface PracticeCanvasProps {
  actions: DrawAction[];
  setActions: React.Dispatch<React.SetStateAction<DrawAction[]>>;
  redoStack: DrawAction[];
  setRedoStack: React.Dispatch<React.SetStateAction<DrawAction[]>>;
  marks: PlacedMark[];
  annotations: PlacedAnnotation[];
  boardHeight: number;
  setBoardHeight: React.Dispatch<React.SetStateAction<number>>;
  isBusy: boolean;
  isDark: boolean;
  onCheck: () => void;
  onRevealMoreHint: (markId: string) => void;
  exportRef: React.MutableRefObject<(() => string) | null>;
}

export default function PracticeCanvas({
  actions,
  setActions,
  redoStack,
  setRedoStack,
  marks,
  annotations,
  boardHeight,
  setBoardHeight,
  isBusy,
  isDark,
  onCheck,
  onRevealMoreHint,
  exportRef,
}: PracticeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(isDark ? "#e2e8f0" : "#1f2937");
  const [thickness] = useState<number>(3);
  const [grid, setGrid] = useState<GridStyle>("dots");

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [hoveredMarkId, setHoveredMarkId] = useState<string | null>(null);
  const [showColors, setShowColors] = useState(false);

  // Theme-aware board colors.
  const BOARD_BG = isDark ? "#0f172a" : "#f7f8f4";
  const DOT_COLOR = isDark ? "#334155" : "#cbd5c7";
  const LINE_COLOR = isDark ? "#1e293b" : "#e3e7dd";
  const INK = isDark ? "#e2e8f0" : "#1f2937";

  const colors = [
    { value: INK, name: "Ink" },
    { value: "#dc2626", name: "Red" },
    { value: "#2563eb", name: "Blue" },
    { value: "#16a34a", name: "Green" },
    { value: "#d97706", name: "Amber" },
  ];

  // When the theme flips, move the pen off the now-invisible default ink.
  useEffect(() => {
    setColor((c) => (c === "#e2e8f0" || c === "#1f2937" ? INK : c));
  }, [isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  const colorForTool = (t: Tool, penColor: string) => {
    if (t === "eraser") return BOARD_BG;
    if (t === "diagrambox") return DIAGRAM_COLOR;
    if (t === "rough") return ROUGH_COLOR;
    return penColor;
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, s: { x: number; y: number }, e: { x: number; y: number }) => {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    const angle = Math.atan2(e.y - s.y, e.x - s.x);
    const head = 16;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x - head * Math.cos(angle - Math.PI / 6), e.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x - head * Math.cos(angle + Math.PI / 6), e.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const drawLabeledBox = (ctx: CanvasRenderingContext2D, act: DrawAction, label: string) => {
    if (act.points.length < 2) return;
    const s = act.points[0];
    const e = act.points[act.points.length - 1];
    const x = Math.min(s.x, e.x);
    const y = Math.min(s.y, e.y);
    const w = Math.abs(e.x - s.x);
    const h = Math.abs(e.y - s.y);
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = act.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    // Label tab
    ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = act.color;
    ctx.fillRect(x, y - 20, tw, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + 6, y - 6);
    ctx.restore();
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
      for (let i = 1; i < act.points.length; i++) ctx.lineTo(act.points[i].x, act.points[i].y);
      ctx.stroke();
    } else if (act.tool === "line") {
      if (act.points.length < 2) return;
      const s = act.points[0];
      const e = act.points[act.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    } else if (act.tool === "arrow") {
      if (act.points.length < 2) return;
      drawArrow(ctx, act.points[0], act.points[act.points.length - 1]);
    } else if (act.tool === "diagrambox") {
      drawLabeledBox(ctx, act, "Diagram");
    } else if (act.tool === "rough") {
      drawLabeledBox(ctx, act, "Rough");
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, CANVAS_WIDTH, boardHeight);

    const gap = 28;
    if (grid === "dots") {
      ctx.fillStyle = DOT_COLOR;
      for (let x = gap; x < CANVAS_WIDTH; x += gap)
        for (let y = gap; y < boardHeight; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
    } else if (grid === "lines") {
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 1;
      for (let x = gap; x < CANVAS_WIDTH; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, boardHeight);
        ctx.stroke();
      }
      for (let y = gap; y < boardHeight; y += gap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    }

    actions.forEach((act) => drawActionOnContext(ctx, act));

    if (isDrawing && currentPoints.length > 0) {
      drawActionOnContext(ctx, {
        tool,
        color: colorForTool(tool, color),
        thickness: tool === "eraser" ? thickness * 5 : thickness,
        points: currentPoints,
      });
    }
  };

  useEffect(() => {
    redrawCanvas();
  }, [actions, isDrawing, currentPoints, boardHeight, grid, isDark]);

  // Strokes-only export (black ink on white) for clean OCR. Excludes the
  // structural boxes (Diagram / Rough) since those are not the student's math.
  useEffect(() => {
    exportRef.current = () => {
      const off = document.createElement("canvas");
      off.width = CANVAS_WIDTH;
      off.height = boardHeight;
      const ctx = off.getContext("2d");
      if (!ctx) return "";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, boardHeight);
      actions.forEach((act) => {
        if (act.tool === "diagrambox" || act.tool === "rough") return; // not OCR'd
        drawActionOnContext(ctx, { ...act, color: act.tool === "eraser" ? "#ffffff" : "#0f172a" });
      });
      return off.toDataURL("image/png");
    };
  }, [actions, boardHeight, exportRef]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * boardHeight,
    };
  };

  const isShapeTool = (t: Tool) => t === "line" || t === "arrow" || t === "diagrambox" || t === "rough";

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const coords = getCanvasCoords(e);
    if (!coords) return;
    setIsDrawing(true);
    setCurrentPoints([coords]);
    setRedoStack([]);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    if (tool === "pen" || tool === "eraser") setCurrentPoints((prev) => [...prev, coords]);
    else setCurrentPoints((prev) => [prev[0], coords]);
  };

  const endDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const enoughPoints = isShapeTool(tool) ? currentPoints.length >= 2 : currentPoints.length > 0;
    if (enoughPoints) {
      setActions((prev) => [
        ...prev,
        {
          tool,
          color: colorForTool(tool, color),
          thickness: tool === "eraser" ? thickness * 5 : thickness,
          points: currentPoints,
        },
      ]);
    }
    setCurrentPoints([]);
  };

  const handleUndo = () => {
    if (actions.length === 0) return;
    const last = actions[actions.length - 1];
    setActions((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setActions((prev) => [...prev, next]);
  };

  const clearCanvas = () => {
    setActions([]);
    setRedoStack([]);
    setCurrentPoints([]);
  };

  // Drag the bottom handle to resize the board height.
  const resizeState = useRef<{ startY: number; startH: number } | null>(null);
  const startResize = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeState.current = { startY: e.clientY, startH: boardHeight };
  };
  const onResize = (e: React.PointerEvent) => {
    if (!resizeState.current) return;
    const canvas = canvasRef.current;
    const displayedWidth = canvas ? canvas.getBoundingClientRect().width : CANVAS_WIDTH;
    const scale = CANVAS_WIDTH / (displayedWidth || CANVAS_WIDTH);
    const deltaCanvas = (e.clientY - resizeState.current.startY) * scale;
    setBoardHeight(Math.max(400, Math.round(resizeState.current.startH + deltaCanvas)));
  };
  const endResize = () => {
    resizeState.current = null;
  };

  const pctX = (v: number) => `${(v / CANVAS_WIDTH) * 100}%`;
  const pctY = (v: number) => `${(v / boardHeight) * 100}%`;

  const toolBtn = (active: boolean) =>
    `p-2 rounded-lg transition-colors cursor-pointer ${
      active
        ? "bg-emerald-600 text-white"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="relative w-full h-full">
      {/* Floating toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg px-2 py-1.5">
        <button onClick={() => setTool("pen")} className={toolBtn(tool === "pen")} title="Pen">
          <Pencil className="w-4 h-4" />
        </button>

        {/* Color picker */}
        <div className="relative">
          <button onClick={() => setShowColors((s) => !s)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1" title="Color">
            <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600" style={{ backgroundColor: color }} />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {showColors && (
            <div className="absolute top-11 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 flex gap-1.5 z-40">
              {colors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => {
                    setColor(c.value);
                    setTool("pen");
                    setShowColors(false);
                  }}
                  style={{ backgroundColor: c.value }}
                  className={`w-5 h-5 rounded-full hover:scale-110 transition-transform ${color === c.value ? "ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
                  title={c.name}
                />
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setTool("eraser")} className={toolBtn(tool === "eraser")} title="Eraser">
          <Eraser className="w-4 h-4" />
        </button>
        <button onClick={() => setTool("line")} className={toolBtn(tool === "line")} title="Line">
          <Minus className="w-4 h-4" />
        </button>
        <button onClick={() => setTool("arrow")} className={toolBtn(tool === "arrow")} title="Arrow">
          <ArrowUpRight className="w-4 h-4" />
        </button>
        <button onClick={() => setTool("diagrambox")} className={toolBtn(tool === "diagrambox")} title="Diagram box">
          <Square className="w-4 h-4" />
        </button>
        <button onClick={() => setTool("rough")} className={toolBtn(tool === "rough")} title="Rough box">
          <StickyNote className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button onClick={handleUndo} disabled={actions.length === 0} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Undo">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Redo">
          <Redo2 className="w-4 h-4" />
        </button>
        <button onClick={clearCanvas} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Clear board">
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        <div className="relative">
          <select
            value={grid}
            onChange={(e) => setGrid(e.target.value as GridStyle)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
            title="Grid style"
          >
            <option value="dots">Dots</option>
            <option value="lines">Grid</option>
            <option value="none">Plain</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          onClick={onCheck}
          disabled={isBusy || actions.length === 0}
          className="ml-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
          title="Ask Myyra to check your steps"
        >
          <ScanLine className="w-4 h-4" /> Check
        </button>
      </div>

      {/* Scrollable board */}
      <div className="w-full h-full overflow-auto rounded-2xl border border-[#dfe4d8] dark:border-slate-700 bg-[#f7f8f4] dark:bg-slate-950">
        <div className="relative w-full" style={{ aspectRatio: `${CANVAS_WIDTH} / ${boardHeight}` }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={boardHeight}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={endDrawing}
            onPointerCancel={endDrawing}
            onPointerLeave={endDrawing}
            style={{ touchAction: "none" }}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          />

          {/* Myyra annotation notes (overlay, excluded from OCR) */}
          <div className="absolute inset-0 pointer-events-none">
            {annotations.map((ann) => (
              <div key={ann.id} style={{ left: pctX(ann.x), top: pctY(ann.y), maxWidth: ann.position === "beside" ? "45%" : "80%" }} className="absolute flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono shrink-0">Myyra ✎</span>
                <MathMarkdown className="text-amber-800 dark:text-amber-200 text-[13px] font-semibold bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 rounded px-1.5 py-0.5 leading-tight [&_p]:m-0">
                  {ann.text}
                </MathMarkdown>
              </div>
            ))}
          </div>

          {/* Per-step marks */}
          <div className="absolute inset-0 pointer-events-none">
            {marks.map((mark) => {
              const isWrong = mark.status === "incorrect";
              const isRight = mark.status === "correct";
              if (mark.status === "neutral") return null;
              const hint = mark.hints[Math.min(mark.revealLevel, mark.hints.length) - 1];
              const hasMore = mark.revealLevel < mark.hints.length;
              const centerY = (mark.top + mark.bottom) / 2;
              return (
                <div
                  key={mark.id}
                  className="absolute pointer-events-auto"
                  style={{ left: pctX(mark.right + 8), top: pctY(centerY), transform: "translateY(-50%)" }}
                  onMouseEnter={() => setHoveredMarkId(mark.id)}
                  onMouseLeave={() => setHoveredMarkId(null)}
                >
                  <span className={`flex items-center justify-center rounded-full w-6 h-6 shadow border cursor-help ${isWrong ? "bg-rose-500 border-rose-600 text-white" : "bg-emerald-500 border-emerald-600 text-white"}`}>
                    {isWrong ? <X className="w-4 h-4 stroke-[3]" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  </span>

                  {hoveredMarkId === mark.id && isWrong && hint && (
                    <div className="absolute z-40 left-8 top-1/2 -translate-y-1/2 w-64 bg-slate-900 border border-rose-400/50 rounded-xl p-3 shadow-2xl">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Hint {mark.revealLevel} / {mark.hints.length}
                      </div>
                      <MathMarkdown className="text-xs text-slate-100 leading-relaxed [&_p]:m-0">{hint}</MathMarkdown>
                      {hasMore && (
                        <button onClick={() => onRevealMoreHint(mark.id)} className="mt-2 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 cursor-pointer">
                          Still stuck? Reveal a bigger hint →
                        </button>
                      )}
                    </div>
                  )}
                  {hoveredMarkId === mark.id && isRight && (
                    <div className="absolute z-40 left-8 top-1/2 -translate-y-1/2 bg-slate-900 border border-emerald-400/50 rounded-lg px-2.5 py-1.5 shadow-xl">
                      <p className="text-[11px] text-emerald-300 font-medium whitespace-nowrap">Looks correct ✓</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Board height resize handle */}
        <div
          onPointerDown={startResize}
          onPointerMove={onResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          className="h-5 flex items-center justify-center cursor-ns-resize text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 select-none touch-none"
          title="Drag to resize board height"
        >
          <GripHorizontal className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
