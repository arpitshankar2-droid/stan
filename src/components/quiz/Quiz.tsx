"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { FandomPalette } from "@/lib/fandom-palette";
import type { ClientQuestion } from "@/lib/quiz/duel";
import { RoundHeader } from "@/components/quiz/RoundHeader";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { DuelCard } from "@/components/quiz/DuelCard";
import { ReportButton } from "@/components/quiz/ReportButton";
import { NamePrompt } from "@/components/quiz/NamePrompt";
import type { Reveal } from "@/components/quiz/types";

interface SubmittedAnswer {
  questionId: string;
  picked: string;
  ms: number;
}

// Non-empty so it clears both the /check and /results zod schemas
// (picked: z.string().min(1)) while never colliding with a real answer.
const NO_ANSWER = "(no answer)";
// Long enough that the pulse/shake (600ms/500ms) plus the color change are
// both clearly visible before advancing, not just technically rendered.
const REVEAL_PAUSE_MS = 1600;

interface Props {
  universeId: string;
  palette: FandomPalette;
  questions: ClientQuestion[];
}

export function Quiz({ universeId, palette, questions }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [answers, setAnswers] = useState<SubmittedAnswer[]>([]);
  const [questionStart, setQuestionStart] = useState(() => Date.now());
  const [phase, setPhase] = useState<"quiz" | "naming">("quiz");
  const [submitting, setSubmitting] = useState(false);

  const question = questions[index];

  const finish = useCallback(
    async (finalAnswers: SubmittedAnswer[], name: string | null) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ universeId, answers: finalAnswers, name }),
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
    (pickedOption: string) => {
      if (picked) return; // already answered this question
      setPicked(pickedOption); // instant — must not wait on the network
      const ms = Date.now() - questionStart;

      (async () => {
        let result: { correct: boolean; answer: string };
        try {
          const res = await fetch(`/api/questions/${question.id}/check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ picked: pickedOption }),
          });
          result = await res.json();
        } catch {
          // Best-effort local fallback — the final grade in POST /api/results
          // is authoritative regardless of what this call returns.
          result = { correct: false, answer: pickedOption };
        }

        setReveal({ picked: pickedOption, correct: result.correct, answer: result.answer });
        setStreak((s) => (result.correct ? s + 1 : 0));
        if (result.correct) setScore((s) => s + 1);

        const nextAnswers = [...answers, { questionId: question.id, picked: pickedOption, ms }];
        setAnswers(nextAnswers);

        setTimeout(() => {
          if (index + 1 < questions.length) {
            setIndex((i) => i + 1);
            setPicked(null);
            setReveal(null);
            setQuestionStart(Date.now());
          } else {
            setPhase("naming");
          }
        }, REVEAL_PAUSE_MS);
      })();
    },
    [picked, question, questionStart, answers, index, questions.length],
  );

  const handleTimeout = useCallback(() => {
    if (picked) return;
    handleAnswer(NO_ANSWER);
  }, [picked, handleAnswer]);

  if (phase === "naming") {
    return (
      <NamePrompt
        palette={palette}
        score={score}
        total={questions.length}
        submitting={submitting}
        onSubmit={(name) => finish(answers, name)}
      />
    );
  }

  if (!question) return null;

  return (
    <div className="flex w-full flex-col items-center gap-5 px-4">
      <RoundHeader
        round={index + 1}
        total={questions.length}
        palette={palette}
        streak={streak}
        questionKey={question.id}
        timerPaused={!!picked || submitting}
        onExpire={handleTimeout}
      />

      <div
        className="relative w-full max-w-lg rounded-2xl p-[1.5px]"
        style={{ background: `linear-gradient(105deg, ${palette.from}, ${palette.to})` }}
      >
        <div
          className="rounded-2xl px-6 py-10 text-center"
          style={{ background: `color-mix(in oklch, ${palette.from} 6%, var(--card))` }}
        >
          <p className="text-2xl leading-snug italic">&ldquo;{question.quote}&rdquo;</p>
        </div>
        <div className="absolute top-2 right-2">
          <ReportButton key={question.id} questionId={question.id} />
        </div>
      </div>

      {question.format === "duel" ? (
        <DuelCard options={question.options} palette={palette} picked={picked} reveal={reveal} onPick={handleAnswer} />
      ) : (
        <QuestionCard options={question.options} picked={picked} reveal={reveal} onPick={handleAnswer} />
      )}

      {reveal && question.context && <p className="text-xs text-muted-foreground">{question.context}</p>}
    </div>
  );
}
