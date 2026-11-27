"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked — user can long-press to copy */
        }
      }}
      className="chip bg-surface-2 border border-line text-ink py-1.5"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
