/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MathMarkdownProps {
  children: string;
  className?: string;
}

// Normalize the LaTeX delimiters models commonly emit into the `$...$` /
// `$$...$$` forms remark-math understands. Function replacements are used so
// the "$" characters in the replacement are treated literally (a plain string
// replacement would interpret "$$" as an escape).
function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\\\[/g, () => "$$")
    .replace(/\\\]/g, () => "$$")
    .replace(/\\\(/g, () => "$")
    .replace(/\\\)/g, () => "$");
}

// Shared renderer: Markdown + KaTeX math (inline `$...$` and display `$$...$$`).
// Used by every panel that shows model-authored text so LaTeX renders
// consistently. `[&_p]:m-0` keeps short snippets (hints, canvas notes) tight.
export default function MathMarkdown({ children, className }: MathMarkdownProps) {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
      >
        {normalizeMathDelimiters(children || "")}
      </Markdown>
    </div>
  );
}
