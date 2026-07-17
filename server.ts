/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up body parsers with elevated limits to support base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
      data_options: {
        include_latex: true,
        include_line_data: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mathpix API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
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
    if (tutorModel === "deepseek" && process.env.DEEPSEEK_API_KEY) {
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

    // If Gemini was selected, or other models fell back
    if (!answer) {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: question,
        config: {
          systemInstruction,
        },
      });
      answer = response.text || "No response received from Gemini.";
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

    // 1. PERFORM OCR
    if (ocrModel === "mathpix" && process.env.MATHPIX_APP_ID && process.env.MATHPIX_APP_KEY) {
      try {
        const mathpixData = await callMathpixApi(base64Data, mimeType);
        actualOcrModelUsed = "mathpix";

        const lineItems = mathpixData.line_data || mathpixData.data || [];
        const imageWidth = mathpixData.width || 1000;
        const imageHeight = mathpixData.height || 1000;

        let eqIndex = 1;
        for (const item of lineItems) {
          const textVal = item.text || item.value || "";
          if (!textVal.trim()) continue;

          // Extract coordinates safely
          const top_left_x = item.top_left_x ?? (item.position?.top_left_x ?? item.box?.xmin ?? 0);
          const top_left_y = item.top_left_y ?? (item.position?.top_left_y ?? item.box?.ymin ?? 0);
          const width = item.width ?? (item.position?.width ?? item.box?.width ?? 100);
          const height = item.height ?? (item.position?.height ?? item.box?.height ?? 50);

          // Normalize coordinates to 0-1000 range
          const xmin = Math.min(1000, Math.max(0, Math.round((top_left_x / imageWidth) * 1000)));
          const ymin = Math.min(1000, Math.max(0, Math.round((top_left_y / imageHeight) * 1000)));
          const xmax = Math.min(1000, Math.max(0, Math.round(((top_left_x + width) / imageWidth) * 1000)));
          const ymax = Math.min(1000, Math.max(0, Math.round(((top_left_y + height) / imageHeight) * 1000)));

          // Clean up the LaTeX output
          const latexVal = cleanLatex(textVal);

          equations.push({
            id: `eq_${eqIndex++}`,
            latex: latexVal,
            rawText: textVal,
            explanation: `Mathematical expression parsed via Mathpix.`,
            boundingBox: {
              ymin,
              xmin,
              ymax,
              xmax
            }
          });
        }
      } catch (mpOcrError: any) {
        console.warn("Mathpix OCR failed, falling back to Gemini:", mpOcrError.message);
        // Fall back to Gemini by letting equations stay empty
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
        console.warn("Mistral OCR failed, falling back to Gemini:", mOcrError.message);
        // will fall back to Gemini below
      }
    }

    if (!ocrResultText && equations.length === 0) {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
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

    // Parse the structured OCR output if not using Mathpix (or if Mathpix fell back)
    if (equations.length === 0) {
      if (!ocrResultText) {
        throw new Error("No response received from the OCR vision model");
      }
      const parsedData = JSON.parse(ocrResultText.trim());
      equations = parsedData.equations || [];
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
    let actualTutorModelUsed = "gemini";

    if (tutorModel === "deepseek" && process.env.DEEPSEEK_API_KEY) {
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

    if (!validationResultText) {
      const ai = getAiClient();
      const resValidation = await ai.models.generateContent({
        model: "gemini-3.5-flash",
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
      const parsedValidations = JSON.parse(validationResultText.trim());
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
