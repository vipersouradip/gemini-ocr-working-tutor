/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Equation } from "../types";
import { Maximize2, Layers, Check, X } from "lucide-react";

interface ImageMarkupCanvasProps {
  imageUrl: string;
  equations: Equation[];
  selectedEquationId: string | null;
  hoveredEquationId: string | null;
  onSelectEquation: (id: string | null) => void;
  onHoverEquation: (id: string | null) => void;
}

export default function ImageMarkupCanvas({
  imageUrl,
  equations,
  selectedEquationId,
  hoveredEquationId,
  onSelectEquation,
  onHoverEquation,
}: ImageMarkupCanvasProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Canvas Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-slate-100 text-sm">Interactive Image Layer</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          {equations.length} Equations Detected
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-6 min-h-[350px] overflow-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        <div className="relative inline-block max-w-full">
          {/* Base Image */}
          <img
            src={imageUrl}
            alt="Uploaded math expressions"
            className="max-h-[600px] max-w-full h-auto object-contain rounded-lg transition-opacity duration-300 shadow-xl border border-slate-800 bg-white"
            onLoad={() => setImageLoaded(true)}
            style={{ opacity: imageLoaded ? 1 : 0.4 }}
          />

          {/* Render Bounding Boxes if image is loaded */}
          {imageLoaded && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="relative w-full h-full pointer-events-auto">
                {equations.map((eq) => {
                  const { ymin, xmin, ymax, xmax } = eq.boundingBox;
                  const isSelected = selectedEquationId === eq.id;
                  const isHovered = hoveredEquationId === eq.id;

                  // Transform coordinates (0-1000) to percentages (0-100%)
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
                      className={`absolute rounded transition-all duration-200 cursor-pointer focus:outline-none flex flex-col justify-between items-start group p-1 ${
                        isSelected
                          ? "border-2 border-amber-400 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.4)] z-30"
                          : isHovered
                            ? "border-2 border-indigo-400 bg-indigo-500/10 shadow-[0_0_10px_rgba(99,102,241,0.3)] z-20"
                            : eq.validationStatus === "correct"
                              ? "border border-emerald-500/60 bg-emerald-500/5 hover:border-emerald-400 hover:bg-emerald-500/10 z-10"
                              : eq.validationStatus === "incorrect"
                                ? "border border-rose-500/60 bg-rose-500/5 hover:border-rose-400 hover:bg-rose-500/10 z-10"
                                : "border border-slate-600/60 bg-slate-500/5 hover:border-slate-450 hover:bg-slate-500/10 z-10"
                      }`}
                      title={`Select ${eq.id}`}
                    >
                      {/* Top Label Badge with validation indicators */}
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[9px] font-mono px-1 rounded transition-colors pointer-events-none select-none ${
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
                          <span className="text-emerald-400 bg-slate-950/90 border border-emerald-500/50 rounded-full p-0.5 shadow-md flex items-center justify-center">
                            <Check className="w-2 h-2 stroke-[3]" />
                          </span>
                        )}
                        {eq.validationStatus === "incorrect" && (
                          <span className="text-rose-400 bg-slate-950/90 border border-rose-500/50 rounded-full p-0.5 shadow-md flex items-center justify-center">
                            <X className="w-2 h-2 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      {/* Hover action indicator */}
                      <span className="self-end opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-950/80 text-white rounded p-0.5">
                        <Maximize2 className="w-2.5 h-2.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guide Footer */}
      <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400 flex items-center justify-between">
        <p>Hover boxes to preview, click to open equations & AI explainers.</p>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500/80"></span> Detected
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-400"></span> Selected
          </span>
        </div>
      </div>
    </div>
  );
}
