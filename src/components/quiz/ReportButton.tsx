"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

const REASONS = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "bad_quote", label: "Bad quote" },
  { value: "other", label: "Other" },
] as const;

// Minimal by design: no auth, no dedupe, no moderation dashboard — just an
// affordance to flag a question and a place for that signal to land
// (QuestionReport). Remount per question via the `key` the parent passes,
// so open/submitted state doesn't leak across questions.
export function ReportButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(reason: string) {
    setSubmitted(true);
    setOpen(false);
    try {
      await fetch(`/api/questions/${questionId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } catch {
      // best-effort — nothing meaningful for the player to retry here
    }
  }

  if (submitted) {
    return <span className="text-[0.65rem] text-muted-foreground">Reported</span>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Report this question"
        aria-expanded={open}
        className="rounded-full p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
      >
        <Flag className="size-3.5" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 flex flex-col gap-0.5 rounded-lg bg-popover p-1.5 whitespace-nowrap ring-1 ring-foreground/10 shadow-lg">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => submit(r.value)}
              className="rounded-full px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
