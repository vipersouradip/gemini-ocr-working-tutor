/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Tool = "pen" | "eraser" | "line" | "rect" | "arrow" | "diagrambox" | "rough";

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

// ---------------------------------------------------------------------------
// Myyra practice tutor
// ---------------------------------------------------------------------------

export type QuestionType = "mcq" | "msq";
export type Difficulty = "" | "easy" | "medium" | "hard";

// A predefined practice question managed from the /admin panel.
export interface PracticeQuestion {
  id: string;
  title: string; // short label shown on the card, e.g. "Quadratic formula"
  questionType: QuestionType; // mcq = one correct, msq = one or more correct
  subject: string;
  topic: string;
  subtopic: string;
  difficulty?: Difficulty;
  prompt: string; // question text; may contain $...$ / $$...$$ LaTeX
  questionImage?: string; // optional image for the question (data URL)
  options: string[]; // answer choices (text; may contain LaTeX)
  correctOptions: number[]; // indices of the correct option(s)
  answer?: string; // reference answer / worked solution for the tutor
  answerImage?: string; // optional image of the answer (data URL)
}

// One message in the Myyra chat transcript.
export interface MyyraMessage {
  role: "user" | "myyra";
  text: string;
}

// A per-step mark Myyra returns, keyed by the OCR step index.
export interface MyyraMark {
  index: number;
  status: "correct" | "incorrect" | "neutral";
  hints: string[]; // ordered gentle -> most revealing
}

// A short note Myyra wants written on the whiteboard.
export interface MyyraAnnotation {
  position: "below" | "beside" | "end";
  afterIndex: number; // step index it attaches to, or -1 for the end
  text: string;
}

// One OCR'd step returned to the client so it can place marks/annotations.
export interface MyyraLine {
  index: number;
  latex: string;
  boundingBox: BoundingBox;
}

export interface MyyraResponse {
  reply: string;
  marks: MyyraMark[];
  annotations: MyyraAnnotation[];
  lines: MyyraLine[];
}

// A mark resolved to on-canvas pixel geometry, ready to render as an overlay.
// All geometry is in board coordinate space (0..CANVAS_WIDTH x 0..boardHeight).
export interface PlacedMark {
  id: string;
  status: "correct" | "incorrect" | "neutral";
  hints: string[];
  revealLevel: number; // how many hint levels the student has unlocked
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// An annotation resolved to on-canvas pixel geometry.
export interface PlacedAnnotation {
  id: string;
  text: string;
  position: "below" | "beside" | "end";
  x: number; // left edge in board pixels
  y: number; // top edge in board pixels
  height: number; // vertical space it occupies (used for reflow)
}
