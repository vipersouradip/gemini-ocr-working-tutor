/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { PracticeQuestion, QuestionType, Difficulty } from "../types";
import {
  loadSettings,
  saveSettings,
  AppSettings,
  OPENROUTER_TUTOR_MODELS,
} from "../utils/settings";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  ArrowLeft,
  ImagePlus,
  Check,
  Settings2,
  ListChecks,
  Upload,
  Download,
  FileJson,
  Images,
} from "lucide-react";

// A blank question used when adding a new one.
const emptyQuestion = (): PracticeQuestion => ({
  id: "",
  title: "",
  questionType: "mcq",
  subject: "",
  topic: "",
  subtopic: "",
  difficulty: "",
  prompt: "",
  questionImage: undefined,
  options: ["", "", "", ""],
  correctOptions: [],
  answer: "",
  answerImage: undefined,
});

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminPanel() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [savedFlash, setSavedFlash] = useState(false);

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PracticeQuestion | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const qImageInput = useRef<HTMLInputElement | null>(null);
  const aImageInput = useRef<HTMLInputElement | null>(null);

  // Bulk import state
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/questions");
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch {
      setError("Failed to load questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const persistSettings = (next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const startNew = () => {
    setEditing(emptyQuestion());
    setIsNew(true);
    setError(null);
  };

  const startEdit = (q: PracticeQuestion) => {
    setEditing(JSON.parse(JSON.stringify(q)));
    setIsNew(false);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setIsNew(false);
  };

  const patch = (p: Partial<PracticeQuestion>) => setEditing((e) => (e ? { ...e, ...p } : e));

  const setOption = (idx: number, value: string) =>
    setEditing((e) => (e ? { ...e, options: e.options.map((o, i) => (i === idx ? value : o)) } : e));

  const addOption = () => setEditing((e) => (e ? { ...e, options: [...e.options, ""] } : e));

  const removeOption = (idx: number) =>
    setEditing((e) => {
      if (!e) return e;
      const options = e.options.filter((_, i) => i !== idx);
      const correctOptions = e.correctOptions
        .filter((c) => c !== idx)
        .map((c) => (c > idx ? c - 1 : c));
      return { ...e, options, correctOptions };
    });

  const toggleCorrect = (idx: number) =>
    setEditing((e) => {
      if (!e) return e;
      if (e.questionType === "mcq") {
        return { ...e, correctOptions: e.correctOptions[0] === idx ? [] : [idx] };
      }
      const has = e.correctOptions.includes(idx);
      return {
        ...e,
        correctOptions: has ? e.correctOptions.filter((c) => c !== idx) : [...e.correctOptions, idx].sort((a, b) => a - b),
      };
    });

  const changeType = (questionType: QuestionType) =>
    setEditing((e) => {
      if (!e) return e;
      // Switching to MCQ collapses to a single correct option.
      const correctOptions = questionType === "mcq" ? e.correctOptions.slice(0, 1) : e.correctOptions;
      return { ...e, questionType, correctOptions };
    });

  const uploadImage = async (which: "questionImage" | "answerImage", file?: File) => {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    patch({ [which]: dataUrl } as Partial<PracticeQuestion>);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.prompt.trim() && !editing.questionImage) {
      setError("A question needs prompt text or an image.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = isNew ? "/api/questions" : `/api/questions/${editing.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      await fetchQuestions();
      cancelEdit();
    } catch (e: any) {
      setError(e.message || "Failed to save question.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    setBusy(true);
    try {
      await fetch(`/api/questions/${id}`, { method: "DELETE" });
      await fetchQuestions();
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        title: "Quadratic roots",
        questionType: "msq",
        subject: "Mathematics",
        topic: "Algebra",
        subtopic: "Quadratic equations",
        difficulty: "easy",
        prompt: "Solve $x^2 - 5x + 6 = 0$",
        questionImage: "quadratic-diagram.png",
        options: ["x = 2", "x = 3", "x = 1", "x = 6"],
        correct: ["A", "B"],
        answer: "Factor as (x-2)(x-3)=0 so x=2 or x=3.",
        answerImage: "quadratic-answer.png",
      },
      {
        title: "Final velocity",
        questionType: "mcq",
        subject: "Physics",
        topic: "Kinematics",
        subtopic: "Uniform acceleration",
        difficulty: "easy",
        prompt: "A car accelerates from rest at $2\\ m/s^2$ for $5\\ s$. Final velocity?",
        options: ["5 m/s", "10 m/s", "12 m/s", "20 m/s"],
        correctOptions: [1],
        answer: "v = u + at = 10 m/s",
      },
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions-template.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!jsonFile) {
      setImportMsg("Choose a JSON file first.");
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await jsonFile.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportMsg("That file isn't valid JSON.");
        setImporting(false);
        return;
      }
      const arr: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.questions) ? parsed.questions : [];
      if (arr.length === 0) {
        setImportMsg("JSON must be an array of questions (or { questions: [...] }).");
        setImporting(false);
        return;
      }

      // Build filename -> data URL map from the uploaded images.
      const imgMap: Record<string, string> = {};
      for (const f of imageFiles) imgMap[f.name] = await readFileAsDataUrl(f);

      const resolveImg = (v: any): string | undefined => {
        if (!v || typeof v !== "string") return undefined;
        if (v.startsWith("data:")) return v; // already inline
        return imgMap[v]; // match by filename (undefined if not uploaded)
      };

      const missing: string[] = [];
      const resolved = arr.map((q) => {
        const qImgRef = q.questionImage || q.questionImageName;
        const aImgRef = q.answerImage || q.answerImageName;
        const qImg = resolveImg(qImgRef);
        const aImg = resolveImg(aImgRef);
        if (qImgRef && !qImg && !String(qImgRef).startsWith("data:")) missing.push(String(qImgRef));
        if (aImgRef && !aImg && !String(aImgRef).startsWith("data:")) missing.push(String(aImgRef));
        return { ...q, questionImage: qImg, answerImage: aImg };
      });

      const res = await fetch("/api/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: resolved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      await fetchQuestions();
      setJsonFile(null);
      setImageFiles([]);
      setImportMsg(
        `Imported ${data.created} question(s).` +
          (missing.length ? ` ⚠️ Missing images (upload them and re-import that row): ${[...new Set(missing)].join(", ")}` : "")
      );
    } catch (e: any) {
      setImportMsg(e.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const inputCls =
    "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
  const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

  return (
    <div className="min-h-screen bg-[#f4f6f2] text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to solver
            </a>
            <span className="w-px h-5 bg-slate-200" />
            <h1 className="text-lg font-bold text-slate-800">Admin</h1>
          </div>
          <a href="/scanner" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
            Scanner →
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Model settings */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-800">AI / API settings</h2>
            {savedFlash && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Choose which models power OCR and the Myyra tutor. Secret API keys stay server-side in{" "}
            <code className="bg-slate-100 px-1 rounded">.env.local</code>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>OCR engine (scanner)</label>
              <select
                value={settings.ocrModel}
                onChange={(e) => persistSettings({ ...settings, ocrModel: e.target.value as AppSettings["ocrModel"] })}
                className={inputCls}
              >
                <option value="mathpix">Mathpix API</option>
                <option value="gemini">Gemini 2.5 Flash</option>
                <option value="mistral">Mistral Pixtral</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Tutor model (Myyra)</label>
              <select
                value={settings.tutorSelection}
                onChange={(e) => persistSettings({ ...settings, tutorSelection: e.target.value })}
                className={inputCls}
              >
                <optgroup label="Direct">
                  <option value="gemini">Gemini 2.5 Flash</option>
                  <option value="deepseek">DeepSeek Chat (V3)</option>
                  <option value="mistral">Mistral Large</option>
                </optgroup>
                <optgroup label="OpenRouter">
                  {OPENROUTER_TUTOR_MODELS.map((m) => (
                    <option key={m.id} value={`openrouter:${m.id}`}>
                      {m.label}
                    </option>
                  ))}
                  <option value="openrouter:custom">Custom model…</option>
                </optgroup>
              </select>
            </div>
            {settings.tutorSelection === "openrouter:custom" && (
              <div>
                <label className={labelCls}>Custom OpenRouter model id</label>
                <input
                  className={`${inputCls} font-mono`}
                  value={settings.customTutorModel}
                  onChange={(e) => persistSettings({ ...settings, customTutorModel: e.target.value })}
                  placeholder="e.g. anthropic/claude-sonnet-4.5"
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        </section>

        {/* Bulk import */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-800">Bulk import questions</h2>
          </div>
          <div className="text-xs text-slate-500 space-y-1.5 mb-4">
            <p>
              Upload a <b>JSON file</b> containing an array of questions. Each question uses the same fields as the form
              (<code className="bg-slate-100 px-1 rounded">title, questionType, subject, topic, subtopic, difficulty, prompt, options, answer</code>).
              Mark correct answers with either <code className="bg-slate-100 px-1 rounded">correctOptions</code> (0-based indices, e.g. <code className="bg-slate-100 px-1 rounded">[0,1]</code>)
              or a friendlier <code className="bg-slate-100 px-1 rounded">correct</code> array of letters (e.g. <code className="bg-slate-100 px-1 rounded">["A","B"]</code>).
            </p>
            <p>
              For images, put the <b>file name</b> in <code className="bg-slate-100 px-1 rounded">questionImage</code> / <code className="bg-slate-100 px-1 rounded">answerImage</code>
              (e.g. <code className="bg-slate-100 px-1 rounded">"diagram1.png"</code>), then select all those image files below — they're matched by name automatically.
              (Or paste a full <code className="bg-slate-100 px-1 rounded">data:</code> URL to inline an image, no separate upload needed.)
            </p>
          </div>

          <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm text-emerald-600 font-semibold hover:text-emerald-700 mb-4">
            <Download className="w-4 h-4" /> Download example template
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 border border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:border-emerald-400">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FileJson className="w-4 h-4 text-emerald-600" /> Questions JSON</span>
              <span className="text-xs text-slate-500 truncate">{jsonFile ? jsonFile.name : "Choose a .json file"}</span>
              <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => setJsonFile(e.target.files?.[0] || null)} />
            </label>
            <label className="flex flex-col gap-1.5 border border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:border-emerald-400">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Images className="w-4 h-4 text-emerald-600" /> Image files (optional)</span>
              <span className="text-xs text-slate-500 truncate">{imageFiles.length ? `${imageFiles.length} image(s) selected` : "Select all referenced images"}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setImageFiles(Array.from(e.target.files || []))} />
            </label>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button onClick={runImport} disabled={importing || !jsonFile} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              <Upload className="w-4 h-4" /> {importing ? "Importing…" : "Import"}
            </button>
            {importMsg && <span className="text-xs text-slate-600">{importMsg}</span>}
          </div>
        </section>

        {/* Questions */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-800">Questions ({questions.length})</h2>
            </div>
            {!editing && (
              <button
                onClick={startNew}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add question
              </button>
            )}
          </div>

          {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

          {/* Editor */}
          {editing && (
            <div className="border border-slate-200 rounded-xl p-5 mb-6 bg-slate-50/60 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Title (card label)</label>
                  <input className={inputCls} value={editing.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Quadratic formula" />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <div className="flex gap-2">
                    {(["mcq", "msq"] as QuestionType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => changeType(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          editing.questionType === t
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        {t.toUpperCase()}
                        <span className="block text-[10px] font-normal opacity-80">
                          {t === "mcq" ? "one correct" : "one or more"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className={labelCls}>Subject</label>
                  <input className={inputCls} value={editing.subject} onChange={(e) => patch({ subject: e.target.value })} placeholder="Physics" />
                </div>
                <div>
                  <label className={labelCls}>Topic</label>
                  <input className={inputCls} value={editing.topic} onChange={(e) => patch({ topic: e.target.value })} placeholder="Kinematics" />
                </div>
                <div>
                  <label className={labelCls}>Subtopic</label>
                  <input className={inputCls} value={editing.subtopic} onChange={(e) => patch({ subtopic: e.target.value })} placeholder="Free fall" />
                </div>
                <div>
                  <label className={labelCls}>Difficulty (optional)</label>
                  <select
                    className={inputCls}
                    value={editing.difficulty || ""}
                    onChange={(e) => patch({ difficulty: e.target.value as Difficulty })}
                  >
                    <option value="">—</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Question text (supports $LaTeX$)</label>
                <textarea
                  className={`${inputCls} min-h-[70px] font-mono`}
                  value={editing.prompt}
                  onChange={(e) => patch({ prompt: e.target.value })}
                  placeholder="e.g. Solve $x^2 - 5x + 6 = 0$"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => qImageInput.current?.click()}
                  className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg px-3 py-2 hover:border-slate-400"
                >
                  <ImagePlus className="w-4 h-4" /> {editing.questionImage ? "Change" : "Add"} question image
                </button>
                <input ref={qImageInput} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage("questionImage", e.target.files?.[0])} />
                {editing.questionImage && (
                  <div className="flex items-center gap-2">
                    <img src={editing.questionImage} alt="question" className="h-10 rounded border border-slate-200" />
                    <button onClick={() => patch({ questionImage: undefined })} className="text-rose-500 hover:text-rose-600" title="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Options */}
              <div>
                <label className={labelCls}>Options — tick the correct {editing.questionType === "mcq" ? "answer" : "answer(s)"}</label>
                <div className="space-y-2">
                  {editing.options.map((opt, i) => {
                    const correct = editing.correctOptions.includes(i);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          onClick={() => toggleCorrect(i)}
                          title="Mark correct"
                          className={`w-8 h-8 shrink-0 flex items-center justify-center border transition-colors ${
                            editing.questionType === "mcq" ? "rounded-full" : "rounded-md"
                          } ${correct ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-300 text-transparent hover:border-emerald-400"}`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-slate-400 w-4">{String.fromCharCode(65 + i)}</span>
                        <input className={inputCls} value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                        <button onClick={() => removeOption(i)} className="text-slate-400 hover:text-rose-500 p-1" title="Remove option">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button onClick={addOption} className="mt-2 text-sm text-emerald-600 font-semibold flex items-center gap-1 hover:text-emerald-700">
                  <Plus className="w-3.5 h-3.5" /> Add option
                </button>
              </div>

              {/* Answer */}
              <div>
                <label className={labelCls}>Answer / worked solution (kept secret from students; guides the tutor)</label>
                <textarea
                  className={`${inputCls} min-h-[60px]`}
                  value={editing.answer || ""}
                  onChange={(e) => patch({ answer: e.target.value })}
                  placeholder="e.g. Factor as $(x-2)(x-3)=0$ so $x=2$ or $x=3$."
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => aImageInput.current?.click()}
                  className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg px-3 py-2 hover:border-slate-400"
                >
                  <ImagePlus className="w-4 h-4" /> {editing.answerImage ? "Change" : "Add"} answer image
                </button>
                <input ref={aImageInput} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage("answerImage", e.target.files?.[0])} />
                {editing.answerImage && (
                  <div className="flex items-center gap-2">
                    <img src={editing.answerImage} alt="answer" className="h-10 rounded border border-slate-200" />
                    <button onClick={() => patch({ answerImage: undefined })} className="text-rose-500 hover:text-rose-600" title="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={save}
                  disabled={busy}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  <Save className="w-4 h-4" /> {isNew ? "Create" : "Save changes"}
                </button>
                <button onClick={cancelEdit} className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-slate-400">No questions yet. Add your first one.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {questions.map((q) => (
                <div key={q.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{q.title || "Untitled"}</span>
                      <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{q.questionType}</span>
                      {q.difficulty && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{q.difficulty}</span>}
                      <span className="text-[11px] text-slate-400">
                        {[q.subject, q.topic, q.subtopic].filter(Boolean).join(" › ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">{q.prompt || "(image question)"}</p>
                  </div>
                  <button onClick={() => startEdit(q)} className="p-2 text-slate-400 hover:text-emerald-600" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(q.id)} className="p-2 text-slate-400 hover:text-rose-500" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
