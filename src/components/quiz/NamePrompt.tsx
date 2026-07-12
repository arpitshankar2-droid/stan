"use client";

import { useState, type FormEvent } from "react";
import { fandomGradientStyle, type FandomPalette } from "@/lib/fandom-palette";

interface Props {
  palette: FandomPalette;
  score: number;
  total: number;
  submitting: boolean;
  error: string | null;
  onSubmit: (name: string | null) => void;
}

// PLAN.md: player name is "optional, asked at reveal" — this is that gap,
// between the last question resolving and the /r/[id] page existing.
export function NamePrompt({ palette, score, total, submitting, error, onSubmit }: Props) {
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(name.trim() || null);
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 text-center">
      <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">QUIZ COMPLETE</p>
      <h1
        className="font-display text-[clamp(3rem,10vw,6rem)] leading-none"
        style={fandomGradientStyle(palette)}
      >
        {score}/{total}
      </h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Name yourself…"
          disabled={submitting}
          aria-label="Your name (optional)"
          className="h-12 w-full rounded-full border-2 border-arena-violet/40 bg-card px-5 text-center text-lg outline-none transition-colors focus-visible:border-arena-violet-hot"
        />
        <button
          type="submit"
          disabled={submitting}
          className="font-display w-full rounded-full bg-arena-gradient px-6 py-3 text-sm text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Loading…" : error ? "Try again" : "See my results"}
        </button>
        <button
          type="button"
          onClick={() => onSubmit(null)}
          disabled={submitting}
          className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
        >
          Skip
        </button>
      </form>
      {error && <p className="text-xs text-arena-danger">{error}</p>}
    </div>
  );
}
