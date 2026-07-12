"use client";

import { useState } from "react";
import { fandomGradientStyle, type FandomPalette } from "@/lib/fandom-palette";
import { Quiz } from "@/components/quiz/Quiz";
import type { ClientQuestion } from "@/lib/quiz/duel";

interface Props {
  parentId: string;
  parentName: string;
  parentScore: number;
  total: number;
  universeId: string;
  universeSlug: string;
  universeName: string;
  excludeIds: string[];
  palette: FandomPalette;
}

// No build-theater needed here — the universe already exists and is READY
// (it was played once to create the parent result), so this is just
// landing -> fetch a fresh excluded set -> reuse Task 9's Quiz as-is.
export function ChallengeFlow({
  parentId,
  parentName,
  parentScore,
  total,
  universeId,
  universeSlug,
  universeName,
  excludeIds,
  palette,
}: Props) {
  const [phase, setPhase] = useState<"landing" | "loading" | "quiz">("landing");
  const [questions, setQuestions] = useState<ClientQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(`/api/universes/${universeSlug}?exclude=${excludeIds.join(",")}`);
      const data = await res.json();
      if (data.status !== "ready" || !data.quiz?.questions) {
        throw new Error("not ready");
      }
      setQuestions(data.quiz.questions);
      setPhase("quiz");
    } catch {
      setError("Couldn't start the challenge — try again.");
      setPhase("landing");
    }
  }

  if (phase === "quiz" && questions) {
    return <Quiz universeId={universeId} palette={palette} questions={questions} challengeOf={parentId} />;
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 text-center">
      <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">CHALLENGE</p>
      <p className="font-display text-2xl leading-tight" style={fandomGradientStyle(palette)}>
        {universeName}
      </p>
      <p className="max-w-sm text-lg leading-snug">
        <span className="font-display" style={fandomGradientStyle(palette)}>
          {parentName}
        </span>{" "}
        scored <span className="font-bold text-foreground">{parentScore}/{total}</span>.
      </p>
      <p className="font-display text-xl">Think you&apos;re the bigger stan?</p>
      <button
        type="button"
        onClick={accept}
        disabled={phase === "loading"}
        className="font-display rounded-full bg-arena-gradient px-8 py-3 text-sm text-primary-foreground disabled:opacity-50"
      >
        {phase === "loading" ? "Starting…" : "Accept the challenge"}
      </button>
      {error && <p className="text-xs text-arena-danger">{error}</p>}
    </div>
  );
}
