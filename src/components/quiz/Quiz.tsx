"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { FandomPalette } from "@/lib/fandom-palette";
import type { ClientQuestion } from "@/lib/quiz/duel";
import { RoundHeader } from "@/components/quiz/RoundHeader";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { DuelCard } from "@/components/quiz/DuelCard";
import type { Reveal } from "@/components/quiz/types";

interface SubmittedAnswer {
  questionId: string;
  picked: string;
  ms: number;
}

// Non-empty so it clears both the /check and /results zod schemas
// (picked: z.string().min(1)) while never colliding with a real answer.
const NO_ANSWER = "(no answer)";
const REVEAL_PAUSE_MS = 1200;

interface Props {
  universeId: string;
  palette: FandomPalette;
  scrapedRatio: number;
  questions: ClientQuestion[];
}

export function Quiz({ universeId, palette, scrapedRatio, questions }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [answers, setAnswers] = useState<SubmittedAnswer[]>([]);
  const [questionStart, setQuestionStart] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  const question = questions[index];

  const finish = useCallback(
    async (finalAnswers: SubmittedAnswer[]) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ universeId, answers: finalAnswers }),
        });
        const data = await res.json();
        if (res.ok && data.id) {
          router.push(`/r/${data.id}`);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [universeId, router],
  );

  const handleAnswer = useCallback(
    async (picked: string) => {
      if (reveal) return; // already answered this question
      const ms = Date.now() - questionStart;

      let result: { correct: boolean; answer: string };
      try {
        const res = await fetch(`/api/questions/${question.id}/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ picked }),
        });
        result = await res.json();
      } catch {
        // Best-effort local fallback — the final grade in POST /api/results
        // is authoritative regardless of what this call returns.
        result = { correct: false, answer: picked };
      }

      setReveal({ picked, correct: result.correct, answer: result.answer });
      setStreak((s) => (result.correct ? s + 1 : 0));

      const nextAnswers = [...answers, { questionId: question.id, picked, ms }];
      setAnswers(nextAnswers);

      setTimeout(() => {
        if (index + 1 < questions.length) {
          setIndex((i) => i + 1);
          setReveal(null);
          setQuestionStart(Date.now());
        } else {
          finish(nextAnswers);
        }
      }, REVEAL_PAUSE_MS);
    },
    [reveal, question, questionStart, answers, index, questions.length, finish],
  );

  const handleTimeout = useCallback(() => {
    if (reveal) return;
    handleAnswer(NO_ANSWER);
  }, [reveal, handleAnswer]);

  if (!question) return null;

  return (
    <div className="flex w-full flex-col items-center gap-8 px-4">
      <RoundHeader
        round={index + 1}
        total={questions.length}
        palette={palette}
        scrapedRatio={scrapedRatio}
        streak={streak}
        questionKey={question.id}
        timerPaused={!!reveal || submitting}
        onExpire={handleTimeout}
      />

      <div
        className="w-full max-w-md rounded-2xl p-[1.5px]"
        style={{ background: `linear-gradient(105deg, ${palette.from}, ${palette.to})` }}
      >
        <div
          className="rounded-2xl px-6 py-8 text-center"
          style={{ background: `color-mix(in oklch, ${palette.from} 6%, var(--card))` }}
        >
          <p className="text-xl leading-snug italic">&ldquo;{question.quote}&rdquo;</p>
        </div>
      </div>

      {question.format === "duel" ? (
        <DuelCard
          options={question.options}
          palette={palette}
          disabled={!!reveal}
          reveal={reveal}
          onPick={handleAnswer}
        />
      ) : (
        <QuestionCard options={question.options} disabled={!!reveal} reveal={reveal} onPick={handleAnswer} />
      )}

      {reveal && question.context && <p className="text-xs text-muted-foreground">{question.context}</p>}
    </div>
  );
}
