/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import MathMarkdown from "./MathMarkdown";
import { MyyraMessage } from "../types";
import { Send, Lightbulb, ScanLine, GraduationCap } from "lucide-react";

interface MyyraChatProps {
  messages: MyyraMessage[];
  isBusy: boolean;
  onSend: (text: string) => void;
  onHint: () => void;
  onCheck: () => void;
}

export default function MyyraChat({ messages, isBusy, onSend, onHint, onCheck }: MyyraChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isBusy]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl rounded-tl-none p-3 text-xs leading-relaxed">
              Hi, I'm <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Myyra</span> 👋 Work through the problem on the board.
              Hit <span className="font-semibold text-emerald-600 dark:text-emerald-400">Check</span> and I'll mark each line and drop hints where you're stuck — or just ask me for a hint.
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "myyra" && (
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0 h-7 w-7 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            )}
            <div
              className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-emerald-600 text-white font-medium rounded-tr-none"
                  : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none prose prose-sm prose-slate dark:prose-invert"
              }`}
            >
              {m.role === "myyra" ? <MathMarkdown>{m.text}</MathMarkdown> : m.text}
            </div>
          </div>
        ))}

        {isBusy && (
          <div className="flex gap-2 justify-start">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0 h-7 w-7 flex items-center justify-center animate-pulse">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-3.5 pt-2 flex gap-2">
        <button
          onClick={onCheck}
          disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold transition-colors"
        >
          <ScanLine className="w-3.5 h-3.5" /> Check my work
        </button>
        <button
          onClick={onHint}
          disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 text-amber-700 rounded-lg text-[11px] font-semibold transition-colors"
        >
          <Lightbulb className="w-3.5 h-3.5" /> Give me a hint
        </button>
      </div>

      {/* Input */}
      <form onSubmit={submit} className="p-3.5 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isBusy}
          placeholder="Ask Myyra anything…"
          className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none rounded-lg px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 disabled:opacity-50 placeholder-slate-400 transition-colors"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-all flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
