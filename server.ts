/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables. .env.local wins over .env (dotenv does not
// override already-set vars), matching the key location the README documents.
dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Set up body parsers with elevated limits to support base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ---------------------------------------------------------------------------
// Practice question store (managed from the /admin panel)
// ---------------------------------------------------------------------------
// Questions are persisted to a JSON file on disk so the /admin CRUD survives
// restarts and every client (and the Myyra tutor) sees the same set.
const DATA_DIR = path.join(process.cwd(), "data");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");

interface StoredQuestion {
  id: string;
  title: string;
  questionType: "mcq" | "msq";
  subject: string;
  topic: string;
  subtopic: string;
  difficulty?: "" | "easy" | "medium" | "hard";
  prompt: string;
  questionImage?: string;
  options: string[];
  correctOptions: number[];
  answer?: string;
  answerImage?: string;
}

// Default questions seeded on first run (includes the quadratic from the design).
const SEED_QUESTIONS: StoredQuestion[] = [
  {
    id: "quadratic-1",
    title: "Quadratic formula",
    questionType: "msq",
    subject: "Mathematics",
    topic: "Algebra",
    subtopic: "Quadratic equations",
    difficulty: "easy",
    prompt: "$x^2 - 5x + 6 = 0$",
    options: ["x = 2", "x = 3", "x = 1", "x = 6"],
    correctOptions: [0, 1],
    answer: "Factor as $(x-2)(x-3)=0$, giving $x=2$ or $x=3$.",
  },
  {
    id: "kinematics-velocity",
    title: "Final velocity",
    questionType: "mcq",
    subject: "Physics",
    topic: "Kinematics",
    subtopic: "Uniform acceleration",
    difficulty: "easy",
    prompt: "A car starts from rest and accelerates uniformly at $2\\ \\text{m/s}^2$ for $5\\ \\text{s}$. What is its final velocity?",
    options: ["5 m/s", "10 m/s", "12 m/s", "20 m/s"],
    correctOptions: [1],
    answer: "$v = u + at = 0 + 2\\times5 = 10\\ \\text{m/s}$.",
  },
  {
    id: "newtons-second-law",
    title: "Net force",
    questionType: "mcq",
    subject: "Physics",
    topic: "Forces",
    subtopic: "Newton's second law",
    difficulty: "easy",
    prompt: "A net force accelerates a $4\\ \\text{kg}$ block at $3\\ \\text{m/s}^2$. What is the magnitude of the net force?",
    options: ["1.33 N", "7 N", "12 N", "24 N"],
    correctOptions: [2],
    answer: "$F = ma = 4\\times3 = 12\\ \\text{N}$.",
  },
  {
    id: "kinetic-energy",
    title: "Kinetic energy",
    questionType: "mcq",
    subject: "Physics",
    topic: "Energy",
    subtopic: "Kinetic energy",
    difficulty: "easy",
    prompt: "What is the kinetic energy of a $2\\ \\text{kg}$ object moving at $3\\ \\text{m/s}$?",
    options: ["3 J", "6 J", "9 J", "18 J"],
    correctOptions: [2],
    answer: "$KE = \\tfrac12 m v^2 = \\tfrac12\\times2\\times9 = 9\\ \\text{J}$.",
  },
  {
    id: "free-fall-time",
    title: "Free fall time",
    questionType: "mcq",
    subject: "Physics",
    topic: "Kinematics",
    subtopic: "Free fall",
    difficulty: "medium",
    prompt: "An object is dropped from rest and falls $45\\ \\text{m}$. Taking $g = 10\\ \\text{m/s}^2$, how long does it take to reach the ground?",
    options: ["2 s", "3 s", "4.5 s", "9 s"],
    correctOptions: [1],
    answer: "$h = \\tfrac12 g t^2 \\Rightarrow t = \\sqrt{2h/g} = \\sqrt{9} = 3\\ \\text{s}$.",
  },
];

function ensureQuestionsFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(QUESTIONS_FILE)) {
      fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(SEED_QUESTIONS, null, 2), "utf8");
    }
  } catch (e: any) {
    console.error("Failed to initialize questions store:", e.message);
  }
}

function readQuestions(): StoredQuestion[] {
  try {
    ensureQuestionsFile();
    const raw = fs.readFileSync(QUESTIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e: any) {
    console.error("Failed to read questions:", e.message);
    return [];
  }
}

function writeQuestions(questions: StoredQuestion[]): void {
  ensureQuestionsFile();
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2), "utf8");
}

// Normalize a client payload into a StoredQuestion (defensive defaults).
function normalizeQuestion(body: any, id: string): StoredQuestion {
  const options: string[] = Array.isArray(body.options)
    ? body.options.map((o: any) => String(o ?? ""))
    : [];

  // Accept correct answers as `correctOptions` (indices) or a friendlier
  // `correct` alias that may hold indices OR option letters ("A", "C", ...).
  const rawCorrect = Array.isArray(body.correctOptions)
    ? body.correctOptions
    : body.correct !== undefined
      ? (Array.isArray(body.correct) ? body.correct : [body.correct])
      : [];
  let correctOptions: number[] = rawCorrect
    .map((v: any) => {
      if (typeof v === "string" && /^[A-Za-z]$/.test(v.trim())) {
        return v.trim().toUpperCase().charCodeAt(0) - 65; // "A" -> 0
      }
      return Number(v);
    })
    .filter((n: number) => Number.isInteger(n) && n >= 0 && n < options.length);
  // De-duplicate.
  correctOptions = Array.from(new Set(correctOptions));
  const questionType = body.questionType === "msq" ? "msq" : "mcq";
  // MCQ keeps at most one correct option.
  if (questionType === "mcq" && correctOptions.length > 1) correctOptions = [correctOptions[0]];
  return {
    id,
    title: String(body.title ?? "").trim() || "Untitled question",
    questionType,
    subject: String(body.subject ?? "").trim(),
    topic: String(body.topic ?? "").trim(),
    subtopic: String(body.subtopic ?? "").trim(),
    difficulty: ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "",
    prompt: String(body.prompt ?? ""),
    questionImage: body.questionImage || undefined,
    options,
    correctOptions,
    answer: body.answer ? String(body.answer) : undefined,
    answerImage: body.answerImage || undefined,
  };
}

// Initialize Gemini Client Lazily/Safely
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to make API requests to Mistral AI
async function callMistralApi(messages: any[], isJson: boolean = false): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("Mistral API key is missing. Please add MISTRAL_API_KEY inside your Secrets panel in Google AI Studio.");
  }

  // Use the appropriate model: pixtral-12b-2409 for vision/multimodal, mistral-large-latest for advanced reasoning
  const model = isJson ? "pixtral-12b-2409" : "mistral-large-latest";

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      ...(isJson ? { response_format: { type: "json_object" } } : {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error (${response.status}): ${errorText}`);
  }

  const result = await response.json() as any;
  return result.choices[0].message.content || "";
}

// Helper to make API requests to DeepSeek
async function callDeepSeekApi(messages: any[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek API key is missing. Please add DEEPSEEK_API_KEY inside your Secrets panel in Google AI Studio.");
  }

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat", // standard DeepSeek-V3 / DeepSeek-R1 compatible endpoint
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  const result = await response.json() as any;
  return result.choices[0].message.content || "";
}

// Helper to make API requests to OpenRouter (OpenAI-compatible), which proxies
// many models. `model` is a full OpenRouter model id, e.g. "openai/gpt-4o".
async function callOpenRouterApi(messages: any[], model: string, isJson: boolean = false): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API key is missing. Please add OPENROUTER_API_KEY inside your Secrets panel / .env.local.");
  }
  if (!model) {
    throw new Error("No OpenRouter model was specified.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      // Optional attribution headers OpenRouter recommends.
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Excalimath Lens"
    },
    body: JSON.stringify({
      model,
      messages,
      ...(isJson ? { response_format: { type: "json_object" } } : {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const result = await response.json() as any;
  return result.choices?.[0]?.message?.content || "";
}

// Parse a JSON payload that a model may have wrapped in prose or ```json fences.
function parseJsonLoose(text: string): any {
  if (!text) throw new Error("Empty response");
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip Markdown code fences, then fall back to the first {...} block.
    const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    try {
      return JSON.parse(unfenced);
    } catch {
      const match = unfenced.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("Response did not contain valid JSON");
    }
  }
}

// Split a LaTeX string that stacks several equations (Mathpix often wraps a
// multi-line derivation in one `\begin{array}...\end{array}` / aligned block)
// into one entry per visual row. Returns the individual row LaTeX strings.
function splitLatexRows(latex: string): string[] {
  if (!latex) return [];
  const s = latex.trim();

  // Detect a stacked-equation environment and pull out its body.
  const envMatch = s.match(
    /\\begin\{(array|aligned|align\*?|alignat\*?|gather\*?|gathered|split|eqnarray\*?)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{\1\}/
  );
  const body = envMatch ? envMatch[2] : s;

  const rows = body
    .split(/\\\\/) // LaTeX row separator "\\"
    .map((r) =>
      r
        .replace(/&/g, " ") // drop alignment markers so each row stands alone
        .replace(/\\hline/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((r) => r.length > 0);

  return rows.length > 0 ? rows : [s];
}

// Helper to clean math formatting from raw LaTeX strings
function cleanLatex(latex: string): string {
  if (!latex) return "";
  return latex
    .replace(/^\$\$?/, "")
    .replace(/\$\$?$/, "")
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
    .replace(/^\\\(/, "")
    .replace(/\\\)$/, "")
    .trim();
}

// Helper to request OCR and math parsing from Mathpix API
async function callMathpixApi(base64Data: string, mimeType: string): Promise<any> {
  const appId = process.env.MATHPIX_APP_ID;
  const appKey = process.env.MATHPIX_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Mathpix App ID or App Key is missing. Please add MATHPIX_APP_ID and MATHPIX_APP_KEY inside your Secrets panel in Google AI Studio.");
  }

  const response = await fetch("https://api.mathpix.com/v3/text", {
    method: "POST",
    headers: {
      "app_id": appId,
      "app_key": appKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      src: `data:${mimeType};base64,${base64Data}`,
      formats: ["text", "data"],
      // include_line_data is a TOP-LEVEL parameter, not part of data_options.
      // When nested it is ignored and the response comes back with no line_data.
      include_line_data: true,
      data_options: {
        include_latex: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mathpix API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Run Mathpix OCR and return one entry per visual line, each with a normalized
// (0-1000) bounding box. Stacked derivations (a single `\begin{array}` block)
// are split into individual rows so each step gets its own box. Shared by the
// equation scanner and the Myyra practice tutor.
async function mathpixToLines(
  base64Data: string,
  mimeType: string
): Promise<Array<{ latex: string; rawText: string; boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number } }>> {
  const mathpixData: any = await callMathpixApi(base64Data, mimeType);

  const lineItems = mathpixData.line_data || [];
  const imageWidth = mathpixData.image_width || mathpixData.width || 1000;
  const imageHeight = mathpixData.image_height || mathpixData.height || 1000;

  const norm = (v: number, total: number) =>
    Math.min(1000, Math.max(0, Math.round((v / total) * 1000)));

  const out: Array<{ latex: string; rawText: string; boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number } }> = [];

  for (const item of lineItems) {
    // Skip lines Mathpix flagged as excluded (page numbers, noise) or errored.
    if (item.included === false) continue;
    if (item.error_id) continue;

    const textVal = (item.text || item.value || "").trim();
    if (!textVal) continue;

    // Mathpix tags each line with a type; skip non-equation regions.
    const lineType = item.type || "";
    if (["diagram", "chart", "table"].includes(lineType)) continue;

    // Derive a pixel-space bounding box for the whole line_data block. The
    // v3/text response gives each line a `cnt` contour of [x, y] pixel pairs;
    // fall back to older/alternate coord shapes.
    let bx = 0, by = 0, bw = 100, bh = 50;
    if (Array.isArray(item.cnt) && item.cnt.length > 0) {
      const xs = item.cnt.map((p: number[]) => p[0]);
      const ys = item.cnt.map((p: number[]) => p[1]);
      bx = Math.min(...xs);
      by = Math.min(...ys);
      bw = Math.max(...xs) - bx;
      bh = Math.max(...ys) - by;
    } else {
      const region = item.region || item.position || item.box || {};
      bx = region.top_left_x ?? region.xmin ?? item.top_left_x ?? 0;
      by = region.top_left_y ?? region.ymin ?? item.top_left_y ?? 0;
      bw = region.width ?? item.width ?? 100;
      bh = region.height ?? item.height ?? 50;
    }

    // line_data `text` is Mathpix Markdown (e.g. "\( x^2 = y \)"); strip the
    // delimiters, then split a stacked derivation into one row each and slice
    // the block's height into equal bands so each row overlays its own line.
    const cleaned = cleanLatex(textVal);
    const rows = splitLatexRows(cleaned);
    const rowCount = rows.length;

    rows.forEach((rowLatex, r) => {
      const rowTop = by + (bh * r) / rowCount;
      const rowBottom = by + (bh * (r + 1)) / rowCount;
      out.push({
        latex: rowLatex,
        rawText: rowLatex,
        boundingBox: {
          ymin: norm(rowTop, imageHeight),
          xmin: norm(bx, imageWidth),
          ymax: norm(rowBottom, imageHeight),
          xmax: norm(bx + bw, imageWidth),
        },
      });
    });
  }

  return out;
}

// Route a tutoring request to the selected provider and return the raw text
// response. Honors the "Gemini is optional" rule: Gemini is only used when a
// GEMINI_API_KEY is configured (as the selection or a last-resort fallback).
async function runTutor(
  systemInstruction: string,
  userContent: string,
  tutorModel: string,
  wantJson: boolean
): Promise<string> {
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent },
  ];

  if (typeof tutorModel === "string" && tutorModel.startsWith("openrouter:")) {
    try {
      const model = tutorModel.slice("openrouter:".length);
      return await callOpenRouterApi(messages, model, wantJson);
    } catch (e: any) {
      console.warn("OpenRouter tutor failed, trying fallback:", e.message);
    }
  } else if (tutorModel === "deepseek" && process.env.DEEPSEEK_API_KEY) {
    try {
      return await callDeepSeekApi(messages);
    } catch (e: any) {
      console.warn("DeepSeek tutor failed, trying fallback:", e.message);
    }
  } else if (tutorModel === "mistral" && process.env.MISTRAL_API_KEY) {
    try {
      // Mistral chat has no dedicated system role slot here; fold it into user.
      return await callMistralApi(
        [{ role: "user", content: `${systemInstruction}\n\n${userContent}` }],
        wantJson
      );
    } catch (e: any) {
      console.warn("Mistral tutor failed, trying fallback:", e.message);
    }
  }

  // Gemini — selection or fallback, but only when a key is configured.
  if (process.env.GEMINI_API_KEY) {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userContent,
      config: {
        systemInstruction,
        ...(wantJson ? { responseMimeType: "application/json" } : {}),
      },
    });
    return response.text || "";
  }

  throw new Error(
    "The AI tutor is unavailable. Pick an OpenRouter model in the header (and set OPENROUTER_API_KEY), or configure a Gemini key."
  );
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- Practice question CRUD (used by /admin and the practice solver) ---
app.get("/api/questions", (req, res) => {
  res.json({ questions: readQuestions() });
});

app.post("/api/questions", (req, res) => {
  try {
    const questions = readQuestions();
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const question = normalizeQuestion(req.body, id);
    questions.push(question);
    writeQuestions(questions);
    res.status(201).json({ question });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to create question." });
  }
});

// Bulk import: accepts { questions: [...] } and creates them all at once.
app.post("/api/questions/bulk", (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (incoming.length === 0) {
      res.status(400).json({ error: "Provide a non-empty 'questions' array." });
      return;
    }
    const questions = readQuestions();
    const created: StoredQuestion[] = [];
    incoming.forEach((q: any, i: number) => {
      const id = `q_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const normalized = normalizeQuestion(q, id);
      questions.push(normalized);
      created.push(normalized);
    });
    writeQuestions(questions);
    res.status(201).json({ created: created.length, questions: created });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to import questions." });
  }
});

app.put("/api/questions/:id", (req, res) => {
  try {
    const questions = readQuestions();
    const idx = questions.findIndex((q) => q.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: "Question not found." });
      return;
    }
    questions[idx] = normalizeQuestion(req.body, req.params.id);
    writeQuestions(questions);
    res.json({ question: questions[idx] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to update question." });
  }
});

app.delete("/api/questions/:id", (req, res) => {
  try {
    const questions = readQuestions();
    const next = questions.filter((q) => q.id !== req.params.id);
    writeQuestions(next);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to delete question." });
  }
});

// Endpoint to explain or tutor the user about a selected equation
app.post("/api/explain-equation", async (req, res) => {
  try {
    const { equation, explanation, question, tutorModel = "gemini" } = req.body;

    if (!equation) {
      res.status(400).json({ error: "Missing equation parameter" });
      return;
    }

    if (!question) {
      res.status(400).json({ error: "Missing question parameter" });
      return;
    }

    const systemInstruction = `You are a world-class math professor and physics/science tutor.
A student is asking a question about a specific mathematical equation.
The equation is: ${equation}
The brief description/name of this equation is: ${explanation || "Mathematical expression"}

Answer the student's question clearly, thoroughly, and professionally.
- Use clean Markdown to structure your answer.
- Always use LaTeX formatting for mathematical variables and intermediate math steps to make it extremely clean and readable. Use standard double dollar signs ($$) for display math and single dollar signs ($) for inline math in your markdown text.
- Be encouraging and informative. Break down complicated derivations or concepts into easy-to-understand steps.`;

    let answer = "";

    // Route based on tutor model preference
    if (typeof tutorModel === "string" && tutorModel.startsWith("openrouter:")) {
      try {
        const orModel = tutorModel.slice("openrouter:".length);
        const messages = [
          { role: "system", content: systemInstruction },
          { role: "user", content: question }
        ];
        answer = await callOpenRouterApi(messages, orModel, false);
      } catch (orError: any) {
        console.warn("OpenRouter explanation failed, falling back to Gemini:", orError.message);
        // Fallback to Gemini if OpenRouter fails or key is invalid
      }
    } else if (tutorModel === "deepseek" && process.env.DEEPSEEK_API_KEY) {
      try {
        const messages = [
          { role: "system", content: systemInstruction },
          { role: "user", content: question }
        ];
        answer = await callDeepSeekApi(messages);
      } catch (dsError: any) {
        console.warn("DeepSeek explanation failed, falling back to Gemini:", dsError.message);
        // Fallback to Gemini if DeepSeek fails or key is invalid
      }
    } else if (tutorModel === "mistral" && process.env.MISTRAL_API_KEY) {
      try {
        const messages = [
          { role: "system", content: systemInstruction },
          { role: "user", content: question }
        ];
        answer = await callMistralApi(messages, false);
      } catch (mError: any) {
        console.warn("Mistral explanation failed, falling back to Gemini:", mError.message);
        // Fallback to Gemini if Mistral fails or key is invalid
      }
    }

    // Gemini — used when selected, or as a fallback when another provider
    // failed, but ONLY when a Gemini key is configured.
    if (!answer && process.env.GEMINI_API_KEY) {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: question,
        config: {
          systemInstruction,
        },
      });
      answer = response.text || "No response received from Gemini.";
    }

    if (!answer) {
      throw new Error("The AI tutor is unavailable. Pick an OpenRouter model in the header (and set OPENROUTER_API_KEY), or configure a Gemini key.");
    }

    res.json({ answer });
  } catch (error: any) {
    console.error("Error explaining equation:", error);
    res.status(500).json({
      error: error.message || "An error occurred while answering your question.",
    });
  }
});

// Endpoint to analyze mathematical equations in an uploaded image & grade them step-by-step
app.post("/api/analyze-equations", async (req, res) => {
  try {
    const { image, mimeType, ocrModel = "gemini", tutorModel = "gemini" } = req.body;

    if (!image) {
      res.status(400).json({ error: "Missing image parameter" });
      return;
    }

    if (!mimeType) {
      res.status(400).json({ error: "Missing mimeType parameter" });
      return;
    }

    // Clean base64 data if it contains the data:image/... prefix
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const ocrInstruction = `You are an expert mathematical transcription and optical character recognition (OCR) engine.
Your task is to identify and locate every individual mathematical equation in the uploaded image.
For each equation found:
1. Detect its bounding box exactly around the mathematical expression. Use normalized coordinates on a scale of 0 to 1000:
   - ymin (top edge, 0 is top of the image, 1000 is bottom)
   - xmin (left edge, 0 is left of the image, 1000 is right)
   - ymax (bottom edge, 0 to 1000)
   - xmax (right edge, 0 to 1000)
2. Transcribe the equation into mathematically precise LaTeX notation. Make sure it is valid LaTeX. Do not include raw $ signs in the latex string itself, just the raw LaTeX commands (e.g. "\\\\int_{a}^{b} f(x) dx").
3. Transcribe the equation into clear plain text (e.g. "integral from a to b of f(x) dx").
4. Provide a brief explanation of what the equation is, what its terms represent, or what math/physics context it belongs to.

Ensure that individual equations are split if they are on separate lines or clearly distinct blocks. If an equation has multiple parts or is a system of equations, locate each component accurately. Coordinates must be very precise so they align perfectly over the equations when drawn on the image.

You must respond with valid JSON matching this schema:
{
  "equations": [
    {
      "id": "eq_1",
      "latex": "The LaTeX formatting of the mathematical equation",
      "rawText": "The plain text representation of the equation",
      "explanation": "A brief, clear description of what this equation represents, its components, or its context",
      "boundingBox": {
        "ymin": number,
        "xmin": number,
        "ymax": number,
        "xmax": number
      }
    }
  ]
}`;

    let ocrResultText = "";
    let actualOcrModelUsed = "gemini";
    let equations = [];
    // Remember why the chosen OCR engine produced nothing, so we can surface a
    // precise error instead of a misleading "Gemini key required" one.
    let ocrError: Error | null = null;

    // 1. PERFORM OCR
    if (ocrModel === "mathpix" && !(process.env.MATHPIX_APP_ID && process.env.MATHPIX_APP_KEY)) {
      ocrError = new Error("Mathpix OCR is selected but MATHPIX_APP_ID / MATHPIX_APP_KEY are not set in .env.local.");
    } else if (ocrModel === "mistral" && !process.env.MISTRAL_API_KEY) {
      ocrError = new Error("Mistral OCR is selected but MISTRAL_API_KEY is not set in .env.local.");
    } else if (ocrModel === "mathpix" && process.env.MATHPIX_APP_ID && process.env.MATHPIX_APP_KEY) {
      try {
        const lines = await mathpixToLines(base64Data, mimeType);
        actualOcrModelUsed = "mathpix";
        equations = lines.map((line, i) => ({
          id: `eq_${i + 1}`,
          latex: line.latex,
          rawText: line.rawText,
          explanation: `Mathematical expression parsed via Mathpix.`,
          boundingBox: line.boundingBox,
        }));
      } catch (mpOcrError: any) {
        console.warn("Mathpix OCR failed:", mpOcrError.message);
        ocrError = mpOcrError;
        // Only Gemini (if configured) can serve as a fallback below.
      }
    } else if (ocrModel === "mistral" && process.env.MISTRAL_API_KEY) {
      try {
        const base64DataUrl = `data:${mimeType};base64,${base64Data}`;
        const messages = [
          {
            role: "user",
            content: [
              { type: "text", text: ocrInstruction },
              { type: "image_url", image_url: { url: base64DataUrl } }
            ]
          }
        ];
        ocrResultText = await callMistralApi(messages, true);
        actualOcrModelUsed = "mistral";
      } catch (mOcrError: any) {
        console.warn("Mistral OCR failed:", mOcrError.message);
        ocrError = mOcrError;
        // will fall back to Gemini below only if a Gemini key is configured
      }
    }

    // Gemini OCR — used as the primary engine when ocrModel === "gemini", and as
    // a fallback for the others, but ONLY when a Gemini API key is configured.
    if (!ocrResultText && equations.length === 0 && process.env.GEMINI_API_KEY) {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          "Detect all individual mathematical equations and return their precise coordinates and LaTeX transcriptions as requested.",
        ],
        config: {
          systemInstruction: ocrInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              equations: {
                type: Type.ARRAY,
                description: "A list of all detected equations and their metadata",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "A unique sequential ID like eq_1, eq_2, etc." },
                    latex: { type: Type.STRING, description: "The LaTeX formatting of the mathematical equation (no $ signs)" },
                    rawText: { type: Type.STRING, description: "The plain text representation of the equation" },
                    explanation: { type: Type.STRING, description: "A brief, clear description of what this equation represents, its components, or its context" },
                    boundingBox: {
                      type: Type.OBJECT,
                      description: "The bounding box of the equation in normalized coordinates (0 to 1000)",
                      properties: {
                        ymin: { type: Type.NUMBER, description: "Top boundary from 0 (top) to 1000 (bottom)" },
                        xmin: { type: Type.NUMBER, description: "Left boundary from 0 (left) to 1000 (right)" },
                        ymax: { type: Type.NUMBER, description: "Bottom boundary from 0 to 1000" },
                        xmax: { type: Type.NUMBER, description: "Right boundary from 0 to 1000" },
                      },
                      required: ["ymin", "xmin", "ymax", "xmax"],
                    },
                  },
                  required: ["id", "latex", "rawText", "explanation", "boundingBox"],
                },
              },
            },
            required: ["equations"],
          },
        },
      });
      ocrResultText = response.text || "";
      actualOcrModelUsed = "gemini";
    }

    // Parse the structured OCR output from a text-based engine (Gemini/Mistral).
    if (equations.length === 0 && ocrResultText) {
      try {
        const parsedData = parseJsonLoose(ocrResultText);
        equations = parsedData.equations || [];
      } catch (parseErr: any) {
        ocrError = new Error("The OCR model returned a response that could not be parsed as equations.");
      }
    }

    // If no engine produced equations, decide between a real error and an
    // empty-but-valid result (e.g. Mathpix ran fine but found no math).
    if (equations.length === 0) {
      if (ocrError) {
        throw ocrError;
      }
      if (ocrModel === "gemini" && !process.env.GEMINI_API_KEY) {
        throw new Error("Gemini OCR is selected but GEMINI_API_KEY is not set. Switch the OCR engine to \"Mathpix API\" in the header, or add a Gemini key.");
      }
      // OCR succeeded but detected nothing — return an empty result cleanly.
      res.json({ equations: [], ocrModelUsed: actualOcrModelUsed, tutorModelUsed: "none" });
      return;
    }

    // 2. TUTOR STEP-BY-STEP MATHEMATICAL VALIDATION
    // Sort equations chronologically (top-to-bottom) to analyze logical steps
    const sortedEquations = [...equations].sort((a, b) => {
      const yDiff = a.boundingBox.ymin - b.boundingBox.ymin;
      if (Math.abs(yDiff) < 60) { // roughly same line
        return a.boundingBox.xmin - b.boundingBox.xmin;
      }
      return yDiff;
    });

    const stepsData = sortedEquations.map(eq => ({
      id: eq.id,
      latex: eq.latex,
      explanation: eq.explanation
    }));

    const validationPrompt = `You are an expert mathematics tutor, proofreader, and rigorous grading engine.
A student has written a mathematical solution or derivation step-by-step on a whiteboard.
We have detected these steps using OCR. Here is the chronological list of steps (ordered from first/top to last/bottom):
${JSON.stringify(stepsData, null, 2)}

Your task is to:
1. Analyze this sequence of equations as a step-by-step mathematical solution or derivation.
2. For each step (by id), determine if the step is:
   - "correct": The step is mathematically valid, follows logically from the previous step, is a correct simplification, or is a correct standalone mathematical statement.
   - "incorrect": The step contains a calculation, sign, arithmetic, algebraic, or logical error relative to the previous step.
   - "neutral": The step is an isolated expression, a basic variable declaration, or cannot be evaluated as correct/incorrect in this context.
3. For each step, provide a short, supportive, 1-2 sentence grading feedback explaining why it's correct (e.g. "Correctly subtracted 5 from both sides") or pinpointing the exact mistake (e.g. "Mistake: dividing 10 by 2 should yield x = 5, not x = 3").

You MUST respond with valid JSON matching this schema:
{
  "validations": [
    {
      "id": "string (the matching equation ID)",
      "status": "correct" | "incorrect" | "neutral",
      "feedback": "string (your supportive 1-2 sentence grading analysis)"
    }
  ]
}`;

    let validationResultText = "";
    let actualTutorModelUsed = "none";

    if (typeof tutorModel === "string" && tutorModel.startsWith("openrouter:")) {
      try {
        const orModel = tutorModel.slice("openrouter:".length);
        const messages = [
          { role: "system", content: "You are a precise mathematical validation engine. You only respond with JSON matching the requested schema." },
          { role: "user", content: validationPrompt }
        ];
        validationResultText = await callOpenRouterApi(messages, orModel, true);
        actualTutorModelUsed = tutorModel;
      } catch (orValError: any) {
        console.warn("OpenRouter validation failed, falling back to Gemini:", orValError.message);
        // fallback to Gemini below
      }
    } else if (tutorModel === "deepseek" && process.env.DEEPSEEK_API_KEY) {
      try {
        const messages = [
          { role: "system", content: "You are a precise mathematical validation engine. You only respond with JSON matching the requested schema." },
          { role: "user", content: validationPrompt }
        ];
        validationResultText = await callDeepSeekApi(messages);
        actualTutorModelUsed = "deepseek";
      } catch (dsValError: any) {
        console.warn("DeepSeek validation failed, falling back to Gemini:", dsValError.message);
        // fallback to Gemini below
      }
    } else if (tutorModel === "mistral" && process.env.MISTRAL_API_KEY) {
      try {
        const messages = [
          { role: "user", content: validationPrompt }
        ];
        validationResultText = await callMistralApi(messages, true);
        actualTutorModelUsed = "mistral";
      } catch (mValError: any) {
        console.warn("Mistral validation failed, falling back to Gemini:", mValError.message);
        // fallback to Gemini below
      }
    }

    // Gemini validation fallback — only when a Gemini key is configured.
    // Otherwise validation is simply skipped and every step is marked neutral.
    if (!validationResultText && process.env.GEMINI_API_KEY) {
      const ai = getAiClient();
      const resValidation = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: validationPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              validations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    status: { type: Type.STRING, enum: ["correct", "incorrect", "neutral"] },
                    feedback: { type: Type.STRING }
                  },
                  required: ["id", "status", "feedback"]
                }
              }
            },
            required: ["validations"]
          }
        }
      });
      validationResultText = resValidation.text || "";
      actualTutorModelUsed = "gemini";
    }

    let validationsMap: Record<string, { status: "correct" | "incorrect" | "neutral", feedback: string }> = {};
    try {
      const parsedValidations = parseJsonLoose(validationResultText);
      if (parsedValidations && Array.isArray(parsedValidations.validations)) {
        for (const v of parsedValidations.validations) {
          validationsMap[v.id] = {
            status: v.status || "neutral",
            feedback: v.feedback || ""
          };
        }
      }
    } catch (parseErr: any) {
      console.error("Error parsing validation response:", parseErr);
    }

    // Merge validation feedback back into the equation list
    const finalEquations = equations.map((eq: any) => {
      const val = validationsMap[eq.id];
      return {
        ...eq,
        validationStatus: val ? val.status : "neutral",
        validationFeedback: val ? val.feedback : "Equation detected successfully."
      };
    });

    res.json({
      equations: finalEquations,
      ocrModelUsed: actualOcrModelUsed,
      tutorModelUsed: actualTutorModelUsed
    });
  } catch (error: any) {
    console.error("Error analyzing equations:", error);
    res.status(500).json({
      error: error.message || "An error occurred while scanning the image for equations.",
    });
  }
});

// Endpoint powering the "Myyra" practice tutor. Given the current MCQ, the
// student's handwritten steps (OCR'd), and their chat message, Myyra returns a
// structured reply: a chat message, per-step marks (correct/incorrect/neutral)
// with progressive hints, and optional short notes to write on the whiteboard.
app.post("/api/myyra", async (req, res) => {
  try {
    const { image, mimeType = "image/png", question, message, history = [], tutorModel = "gemini" } = req.body;

    if (!question || !question.prompt || !Array.isArray(question.options)) {
      res.status(400).json({ error: "Missing or invalid question payload." });
      return;
    }
    if (!message || !String(message).trim()) {
      res.status(400).json({ error: "Missing student message." });
      return;
    }

    // 1. OCR the student's handwritten steps (if an image was supplied and
    //    Mathpix is configured). Failures here are non-fatal: Myyra can still
    //    answer conceptually without seeing the board.
    let lines: Array<{ index: number; latex: string; boundingBox: any }> = [];
    if (image && process.env.MATHPIX_APP_ID && process.env.MATHPIX_APP_KEY) {
      try {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const ocr = await mathpixToLines(base64Data, mimeType);
        lines = ocr.map((l, i) => ({ index: i, latex: l.latex, boundingBox: l.boundingBox }));
      } catch (ocrErr: any) {
        console.warn("Myyra OCR failed (continuing without steps):", ocrErr.message);
      }
    }

    // 2. Build Myyra's persona + strict JSON contract.
    const systemInstruction = `You are "Myyra", a warm, patient, encouraging tutor. A student is solving a practice problem step by step by hand on a whiteboard; we OCR their steps for you. You are given the full question metadata (subject, topic, subtopic, difficulty, the answer choices, the correct option(s), and a reference answer). USE all of this to tailor your guidance, but treat the correct option(s) and reference answer as SECRET.

Core principles:
- Be Socratic and supportive, and pitch your help to the question's subject/topic and difficulty.
- NEVER state which option is correct, and NEVER hand over the full worked solution or the reference answer, unless the student has clearly and repeatedly (3+ times) demanded the final answer.
- Prefer nudges. Your FIRST hint for any mistake must be gentle — for example, remind the student of a formula or concept they seem to have forgotten — NOT the answer. Provide escalating hint levels (2-3), each more specific, the last most revealing.
- Only mark a step "incorrect" when you are confident it contains an actual error. Mark clearly valid steps "correct". Mark restatements of the problem or definitions "neutral".
- For MSQ (multiple correct answers) questions, remember more than one option can be correct.
- Encourage the student to reach the answer themselves.

You MUST respond with ONLY valid JSON (no prose outside it, no code fences) in exactly this shape:
{
  "reply": "your chat message to the student; may use $...$ LaTeX and light markdown",
  "marks": [ { "index": <step index integer>, "status": "correct" | "incorrect" | "neutral", "hints": ["gentle nudge", "more specific", "most revealing"] } ],
  "annotations": [ { "position": "below" | "beside" | "end", "afterIndex": <step index this note attaches to, or -1 for the end>, "text": "SHORT single-line note to write on the board, e.g. a formula" } ]
}

Rules:
- "marks": include an entry for each step you can assess by its index. "hints" is only needed for "incorrect" steps (order them gentle -> revealing); use [] for correct/neutral steps.
- "annotations": OPTIONAL and usually empty. Only add one when writing on the board genuinely helps (e.g. a forgotten formula placed under the relevant step). Keep "text" short enough to fit on one line. Use "below" to place it under a step (other content reflows down to make room), "beside" to place it to the right of a step, "end" to append at the bottom.
- If the student only asked for a hint, it is fine to return "marks": [] and put the hint in "reply" and/or one small annotation.`;

    const options: string[] = Array.isArray(question.options) ? question.options : [];
    const optionsBlock = options.length
      ? options.map((o: string, i: number) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")
      : "(no options provided)";

    // Correct option(s): prefer the new correctOptions array, fall back to a
    // legacy single correctIndex if that's all the client sent.
    let correctOptions: number[] = Array.isArray(question.correctOptions)
      ? question.correctOptions
      : typeof question.correctIndex === "number"
        ? [question.correctIndex]
        : [];
    const correctLetters = correctOptions
      .map((i) => String.fromCharCode(65 + i))
      .join(", ");

    const metaBlock = [
      question.subject ? `Subject: ${question.subject}` : "",
      question.topic ? `Topic: ${question.topic}` : "",
      question.subtopic ? `Subtopic: ${question.subtopic}` : "",
      question.difficulty ? `Difficulty: ${question.difficulty}` : "",
      `Type: ${question.questionType === "msq" ? "MSQ (one or more correct)" : "MCQ (one correct)"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const stepsBlock = lines.length
      ? lines.map((l) => `[${l.index}] ${l.latex}`).join("\n")
      : "(The student has not written any steps yet.)";

    const historyBlock = Array.isArray(history) && history.length
      ? history.map((h: any) => `${h.role === "myyra" ? "Myyra" : "Student"}: ${h.text}`).join("\n")
      : "(no prior conversation)";

    const imageNote = [
      question.questionImage ? "(This question includes an image the student can see.)" : "",
      question.answerImage ? "(The reference answer includes an image, kept secret from the student.)" : "",
    ]
      .filter(Boolean)
      .join("\n");

    const userContent = `QUESTION METADATA:\n${metaBlock}\n\nQUESTION:\n${question.prompt}${imageNote ? `\n${imageNote}` : ""}\n\nOPTIONS:\n${optionsBlock}\n\nCORRECT OPTION(S) (SECRET — never reveal directly): ${correctLetters || "(unspecified)"}\n\nREFERENCE ANSWER (SECRET — use to judge steps, do not reveal): ${question.answer || "(none provided)"}\n\nSTUDENT'S HANDWRITTEN STEPS (OCR, indexed top-to-bottom):\n${stepsBlock}\n\nCONVERSATION SO FAR:\n${historyBlock}\n\nSTUDENT'S LATEST MESSAGE:\n${message}`;

    // 3. Ask the selected tutor model for the structured response.
    const raw = await runTutor(systemInstruction, userContent, tutorModel, true);

    let parsed: any = {};
    try {
      parsed = parseJsonLoose(raw);
    } catch (parseErr: any) {
      // If the model didn't return clean JSON, degrade gracefully to a chat-only reply.
      console.warn("Myyra response was not valid JSON:", parseErr.message);
      parsed = { reply: raw || "Sorry, I had trouble forming a response. Could you rephrase?", marks: [], annotations: [] };
    }

    const marks = Array.isArray(parsed.marks) ? parsed.marks : [];
    const annotations = Array.isArray(parsed.annotations) ? parsed.annotations : [];

    res.json({
      reply: parsed.reply || "",
      marks,
      annotations,
      lines,
    });
  } catch (error: any) {
    console.error("Error in Myyra tutor:", error);
    res.status(500).json({
      error: error.message || "An error occurred while talking to Myyra.",
    });
  }
});

// Serve Frontend using Vite Middleware in Development, Static Assets in Production
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error("Failed to start server:", err);
});
