"use client";

import { useState } from "react";

export function CopyCodeBlock({
  title,
  code,
}: {
  title: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="docs-code-block">
      <div className="docs-code-header">
        <span>{title}</span>
        <button
          type="button"
          className="preset-chip"
          onClick={() => void handleCopy()}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="json-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
