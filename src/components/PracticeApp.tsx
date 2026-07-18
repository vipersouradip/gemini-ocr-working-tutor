/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import {
  DrawAction,
  PracticeQuestion,
  MyyraMessage,
  MyyraMark,
  MyyraAnnotation,
  MyyraLine,
  PlacedMark,
  PlacedAnnotation,
} from "../types";
import { loadSettings, saveSettings, resolveTutorModel, applyTheme, Theme } from "../utils/settings";
import PracticeCanvas, { CANVAS_WIDTH, DEFAULT_BOARD_HEIGHT } from "./PracticeCanvas";
import MyyraChat from "./MyyraChat";
import MathMarkdown from "./MathMarkdown";
import {
  ArrowLeft,
  ArrowRight,
  Menu,
  Settings,
  CheckCircle2,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Moon,
  Sun,
  GripVertical,
  GripHorizontal,
} from "lucide-react";

const ANNOTATION_HEIGHT = 46;
const REFLOW_MARGIN = 10;

export default function PracticeApp() {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [attempts, setAttempts] = useState(0);
  const [showQuestionList, setShowQuestionList] = useState(false);

  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  const [boardHeight, setBoardHeight] = useState<number>(DEFAULT_BOARD_HEIGHT);

  const [marks, setMarks] = useState<PlacedMark[]>([]);
  const [annotations, setAnnotations] = useState<PlacedAnnotation[]>([]);

  const [messages, setMessages] = useState<MyyraMessage[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  // Theme + resizable layout
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarWidth, setSidebarWidth] = useState(440);
  const [chatHeight, setChatHeight] = useState(360);

  const exportRef = useRef<(() => string) | null>(null);
  const isDark = theme === "dark";

  const question: PracticeQuestion | undefined = questions[questionIndex];

  useEffect(() => {
    const s = loadSettings();
    setTheme(s.theme);
    applyTheme(s.theme);
    (async () => {
      try {
        const res = await fetch("/api/questions");
        const data = await res.json();
        setQuestions(data.questions || []);
      } catch {
        setQuestions([]);
      } finally {
        setLoadingQuestions(false);
      }
    })();
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    saveSettings({ ...loadSettings(), theme: next });
  };

  const resetBoard = () => {
    setActions([]);
    setRedoStack([]);
    setBoardHeight(DEFAULT_BOARD_HEIGHT);
    setMarks([]);
    setAnnotations([]);
    setMessages([]);
    setSelectedOptions([]);
    setAttempts(0);
  };

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= questions.length) return;
    setQuestionIndex(idx);
    resetBoard();
    setShowQuestionList(false);
  };

  const toggleOption = (i: number) => {
    if (!question) return;
    if (question.questionType === "mcq") setSelectedOptions((prev) => (prev[0] === i ? [] : [i]));
    else setSelectedOptions((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)));
  };

  // ---- Reflow helpers ----
  const lineToBox = (line: MyyraLine) => ({
    left: (line.boundingBox.xmin / 1000) * CANVAS_WIDTH,
    right: (line.boundingBox.xmax / 1000) * CANVAS_WIDTH,
    top: (line.boundingBox.ymin / 1000) * boardHeight,
    bottom: (line.boundingBox.ymax / 1000) * boardHeight,
  });
  const maxContentY = (acts: DrawAction[], anns: PlacedAnnotation[], mks: PlacedMark[]) => {
    let m = 0;
    acts.forEach((a) => a.points.forEach((p) => (m = Math.max(m, p.y))));
    anns.forEach((a) => (m = Math.max(m, a.y + a.height)));
    mks.forEach((k) => (m = Math.max(m, k.bottom)));
    return m;
  };
  const strokeMinY = (a: DrawAction) => Math.min(...a.points.map((p) => p.y));
  const shiftStroke = (a: DrawAction, delta: number): DrawAction => ({ ...a, points: a.points.map((p) => ({ x: p.x, y: p.y + delta })) });

  const applyMyyraResult = (lines: MyyraLine[], respMarks: MyyraMark[], respAnnotations: MyyraAnnotation[]) => {
    const lineByIndex = new Map<number, MyyraLine>();
    lines.forEach((l) => lineByIndex.set(l.index, l));

    let workingMarks: PlacedMark[] = respMarks
      .filter((mk) => lineByIndex.has(mk.index))
      .map((mk) => {
        const box = lineToBox(lineByIndex.get(mk.index)!);
        return { id: `mark_${mk.index}_${Date.now()}`, status: mk.status, hints: Array.isArray(mk.hints) ? mk.hints : [], revealLevel: 1, ...box };
      });

    let workingActions = actions;
    let workingAnnotations = [...annotations];
    let workingHeight = boardHeight;

    respAnnotations.forEach((ann, i) => {
      const targetLine = ann.afterIndex >= 0 ? lineByIndex.get(ann.afterIndex) : undefined;
      const delta = ANNOTATION_HEIGHT;
      let position = ann.position;
      if ((position === "below" || position === "beside") && !targetLine) position = "end";

      if (position === "below" && targetLine) {
        const box = lineToBox(targetLine);
        const insertY = box.bottom + REFLOW_MARGIN;
        workingActions = workingActions.map((a) => (strokeMinY(a) >= insertY ? shiftStroke(a, delta) : a));
        workingMarks = workingMarks.map((m) => (m.top >= insertY ? { ...m, top: m.top + delta, bottom: m.bottom + delta } : m));
        workingAnnotations = workingAnnotations.map((a) => (a.y >= insertY ? { ...a, y: a.y + delta } : a));
        workingHeight += delta;
        workingAnnotations.push({ id: `ann_${Date.now()}_${i}`, text: ann.text, position: "below", x: box.left, y: insertY, height: delta });
      } else if (position === "beside" && targetLine) {
        const box = lineToBox(targetLine);
        workingAnnotations.push({ id: `ann_${Date.now()}_${i}`, text: ann.text, position: "beside", x: Math.min(box.right + 60, CANVAS_WIDTH - 240), y: box.top, height: delta });
      } else {
        const insertY = maxContentY(workingActions, workingAnnotations, workingMarks) + REFLOW_MARGIN * 3;
        workingAnnotations.push({ id: `ann_${Date.now()}_${i}`, text: ann.text, position: "end", x: 60, y: insertY, height: delta });
        workingHeight = Math.max(workingHeight, insertY + delta + REFLOW_MARGIN);
      }
    });

    setActions(workingActions);
    setMarks(workingMarks);
    setAnnotations(workingAnnotations);
    setBoardHeight(workingHeight);
  };

  const callMyyra = async (message: string) => {
    if (isBusy || !question) return;
    setIsBusy(true);
    setChatOpen(true);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    try {
      const image = exportRef.current ? exportRef.current() : "";
      const res = await fetch("/api/myyra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType: "image/png", question, message, history: messages, tutorModel: resolveTutorModel(loadSettings()) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Myyra could not respond.");
      if (data.reply) setMessages((prev) => [...prev, { role: "myyra", text: data.reply }]);
      applyMyyraResult(data.lines || [], data.marks || [], data.annotations || []);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "myyra", text: `⚠️ ${err.message || "Something went wrong. Check the tutor model in /admin and the API key in .env.local."}` }]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCheck = () => {
    setAttempts((a) => a + 1);
    const letters = selectedOptions.map((i) => String.fromCharCode(65 + i)).join(", ");
    callMyyra(`Please check my work so far, step by step.${letters ? ` I think the answer is ${letters}.` : ""}`);
  };
  const handleHint = () => callMyyra("Can you give me a small hint to move forward? Don't reveal the answer.");
  const revealMoreHint = (markId: string) => setMarks((prev) => prev.map((m) => (m.id === markId ? { ...m, revealLevel: Math.min(m.revealLevel + 1, m.hints.length) } : m)));
  const toggleCompleted = () => question && setCompleted((prev) => ({ ...prev, [question.id]: !prev[question.id] }));

  // ---- Resizable panels ----
  const sideResize = useRef<{ startX: number; startW: number } | null>(null);
  const startSideResize = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    sideResize.current = { startX: e.clientX, startW: sidebarWidth };
  };
  const onSideResize = (e: React.PointerEvent) => {
    if (!sideResize.current) return;
    const next = sideResize.current.startW + (e.clientX - sideResize.current.startX);
    setSidebarWidth(Math.min(720, Math.max(320, next)));
  };
  const endSideResize = () => (sideResize.current = null);

  const chatResize = useRef<{ startY: number; startH: number } | null>(null);
  const startChatResize = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    chatResize.current = { startY: e.clientY, startH: chatHeight };
    e.stopPropagation();
  };
  const onChatResize = (e: React.PointerEvent) => {
    if (!chatResize.current) return;
    // Dragging up (negative delta) grows the chat.
    const next = chatResize.current.startH - (e.clientY - chatResize.current.startY);
    setChatHeight(Math.min(680, Math.max(200, next)));
  };
  const endChatResize = () => (chatResize.current = null);

  if (loadingQuestions) {
    return <div className="min-h-screen bg-[#f4f6f2] dark:bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Loading questions…</div>;
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-[#f4f6f2] dark:bg-slate-950 flex flex-col items-center justify-center gap-3 text-center px-6">
        <GraduationCap className="w-10 h-10 text-slate-300" />
        <p className="text-slate-600 dark:text-slate-300 font-medium">No questions yet.</p>
        <a href="/admin" className="text-sm text-emerald-600 font-semibold hover:text-emerald-700">Add questions in the admin panel →</a>
      </div>
    );
  }

  const isCompleted = !!completed[question.id];

  return (
    <div className="h-screen w-screen flex bg-[#eef1ea] dark:bg-slate-950 overflow-hidden">
      {/* Left panel */}
      <aside style={{ width: sidebarWidth }} className="h-full shrink-0 bg-white dark:bg-slate-900 border-r border-[#dfe4d8] dark:border-slate-800 flex flex-col">
        {/* Top bar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => goTo(questionIndex - 1)} disabled={questionIndex === 0} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30" title="Previous">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 truncate">{question.subject || "Uncategorized"}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleTheme} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-amber-300 hover:bg-slate-50 dark:hover:bg-slate-800" title="Toggle dark mode">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => goTo(questionIndex + 1)} disabled={questionIndex === questions.length - 1} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30" title="Next">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <button onClick={() => setShowQuestionList((s) => !s)} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold hover:text-slate-800 dark:hover:text-white">
              <Menu className="w-4 h-4" />
              Question {questionIndex + 1} of {questions.length}
            </button>
            <span className="text-slate-400">attempt {attempts}</span>
            <a href="/admin" className="ml-auto text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title="Admin settings">
              <Settings className="w-4 h-4" />
            </a>
          </div>

          {showQuestionList && (
            <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => goTo(i)} className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 ${i === questionIndex ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold" : "text-slate-600 dark:text-slate-300"}`}>
                  {i + 1}. {q.title || q.topic || "Question"}
                  {completed[q.id] && <CheckCircle2 className="w-3.5 h-3.5 inline ml-1.5 text-emerald-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Question card */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800/50 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-bold text-slate-800 dark:text-slate-100">{question.title || "Question"}</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {[question.topic, question.subtopic].filter(Boolean).join(" › ")}
                  {question.difficulty ? ` · ${question.difficulty}` : ""}
                  {question.questionType === "msq" ? " · select all that apply" : ""}
                </p>
              </div>
              <button onClick={toggleCompleted} className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${isCompleted ? "bg-emerald-600 text-white border-emerald-600" : "text-emerald-600 border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"}`}>
                {isCompleted ? "Completed ✓" : "Mark as completed"}
              </button>
            </div>

            {question.questionImage && <img src={question.questionImage} alt="question" className="max-w-full rounded-lg border border-slate-200 dark:border-slate-700 mb-3" />}

            <MathMarkdown className="text-slate-700 dark:text-slate-200 text-[15px] leading-relaxed [&_p]:m-0 mb-4">{question.prompt}</MathMarkdown>

            {question.options.length > 0 && (
              <div className="space-y-2">
                {question.options.map((opt, i) => {
                  const active = selectedOptions.includes(i);
                  return (
                    <button key={i} onClick={() => toggleOption(i)} className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${active ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 text-slate-800 dark:text-slate-100" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"}`}>
                      <span className={`w-6 h-6 shrink-0 flex items-center justify-center text-xs font-bold ${question.questionType === "mcq" ? "rounded-full" : "rounded-md"} ${active ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"}`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <MathMarkdown className="text-sm [&_p]:m-0">{opt}</MathMarkdown>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 px-1">
            Solve it step by step on the board. Ask Myyra to check — she marks each line and gives progressive hints without spoiling the answer.
          </p>
        </div>

        {/* Myyra chat dock (resizable height) */}
        <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          {chatOpen && (
            <div
              onPointerDown={startChatResize}
              onPointerMove={onChatResize}
              onPointerUp={endChatResize}
              onPointerCancel={endChatResize}
              className="h-3 flex items-center justify-center cursor-ns-resize text-slate-300 hover:text-slate-500 touch-none"
              title="Drag to resize chat height"
            >
              <GripHorizontal className="w-4 h-4" />
            </div>
          )}
          <button onClick={() => setChatOpen((s) => !s)} className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-lime-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4 text-white" />
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Chat with Myyra</span>
            {messages.length > 0 && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">{messages.length}</span>}
            <span className="ml-auto text-slate-400">{chatOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</span>
          </button>
          {chatOpen && (
            <div style={{ height: chatHeight }} className="border-t border-slate-100 dark:border-slate-800">
              <MyyraChat messages={messages} isBusy={isBusy} onSend={callMyyra} onHint={handleHint} onCheck={handleCheck} />
            </div>
          )}
        </div>
      </aside>

      {/* Divider (resize sidebar / canvas) */}
      <div
        onPointerDown={startSideResize}
        onPointerMove={onSideResize}
        onPointerUp={endSideResize}
        onPointerCancel={endSideResize}
        className="w-1.5 h-full cursor-ew-resize bg-transparent hover:bg-emerald-400/40 flex items-center justify-center group touch-none"
        title="Drag to resize"
      >
        <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500" />
      </div>

      {/* Right: canvas */}
      <main className="flex-1 min-w-0 h-full p-3 relative">
        <PracticeCanvas
          actions={actions}
          setActions={setActions}
          redoStack={redoStack}
          setRedoStack={setRedoStack}
          marks={marks}
          annotations={annotations}
          boardHeight={boardHeight}
          setBoardHeight={setBoardHeight}
          isBusy={isBusy}
          isDark={isDark}
          onCheck={handleCheck}
          onRevealMoreHint={revealMoreHint}
          exportRef={exportRef}
        />
        <a href="/scanner" className="absolute bottom-5 right-5 w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title="Open the equation scanner">
          <HelpCircle className="w-5 h-5" />
        </a>
      </main>
    </div>
  );
}
