/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Tool = "pen" | "eraser" | "line" | "rect";

export interface DrawAction {
  tool: Tool;
  color: string;
  thickness: number;
  points: { x: number; y: number }[];
}

export interface BoundingBox {
  ymin: number; // 0 to 1000
  xmin: number; // 0 to 1000
  ymax: number; // 0 to 1000
  xmax: number; // 0 to 1000
}

export type OcrModelType = "gemini" | "mistral" | "mathpix";
// Built-in tutor providers, plus any OpenRouter model addressed as
// `openrouter:<model-id>` (e.g. "openrouter:anthropic/claude-3.5-sonnet").
export type TutorModelType = "gemini" | "deepseek" | "mistral" | `openrouter:${string}`;

export interface Equation {
  id: string;
  latex: string;
  rawText: string;
  explanation: string;
  boundingBox: BoundingBox;
  validationStatus?: "correct" | "incorrect" | "neutral";
  validationFeedback?: string;
}

export interface AnalysisResponse {
  equations: Equation[];
}
