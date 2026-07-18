/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TutorModelType } from "../types";

// Model selection is configured in /admin and persisted to localStorage so the
// practice solver (and the scanner) read the same choice. Secret API keys stay
// server-side in .env.local — only the *choice* of model lives here.
export type Theme = "light" | "dark";

export interface AppSettings {
  // Raw tutor dropdown value: a provider ("gemini" | "deepseek" | "mistral"),
  // an "openrouter:<model>" id, or the sentinel "openrouter:custom".
  tutorSelection: string;
  customTutorModel: string; // used when tutorSelection === "openrouter:custom"
  ocrModel: "gemini" | "mistral" | "mathpix";
  theme: Theme;
}

const STORAGE_KEY = "myyra.settings.v1";

export const DEFAULT_SETTINGS: AppSettings = {
  tutorSelection: "openrouter:anthropic/claude-sonnet-5",
  customTutorModel: "",
  ocrModel: "mathpix",
  theme: "light",
};

// Toggle the `.dark` class on <html> so Tailwind `dark:` utilities apply.
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / unavailable storage */
  }
}

// Resolve the raw settings into the concrete tutorModel value the API expects.
export function resolveTutorModel(settings: AppSettings): TutorModelType {
  if (settings.tutorSelection === "openrouter:custom") {
    return settings.customTutorModel.trim()
      ? (`openrouter:${settings.customTutorModel.trim()}` as TutorModelType)
      : "gemini";
  }
  return settings.tutorSelection as TutorModelType;
}

// Curated OpenRouter models offered in the admin dropdown.
export const OPENROUTER_TUTOR_MODELS: { id: string; label: string }[] = [
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8" },
  { id: "openai/gpt-4.1", label: "GPT-4.1" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "x-ai/grok-4.5", label: "Grok 4.5" },
];
