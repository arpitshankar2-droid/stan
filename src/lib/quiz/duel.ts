import type { Question } from "@prisma/client";

// The hardest of the 3/4/3 difficulty curve renders as a two-option "duel"
// instead of the standard four-option layout — see PLAN.md's Neon Arena
// notes. Difficulty is the routing signal, not a separate flag.
export const DUEL_DIFFICULTY = 3;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface ClientQuestion {
  id: string;
  quote: string;
  context: string | null;
  format: "duel" | "options";
  options: string[];
}

/**
 * Shapes a question for the client — `answer` is never included, grading is
 * server-side only (POST /api/results). Duel questions get 2 options: the
 * answer plus Gemini's ranked `duelDistractor` when we have one, or a random
 * distractor for questions built before that field existed (a graceful
 * degrade, not the permanent behavior — a rebuild fills it in).
 */
export function formatQuestionForClient(q: Question): ClientQuestion {
  if (q.difficulty !== DUEL_DIFFICULTY) {
    return { id: q.id, quote: q.quote, context: q.context, format: "options", options: q.options };
  }

  const distractors = q.options.filter((o) => o !== q.answer);
  const opponent =
    q.duelDistractor && distractors.includes(q.duelDistractor)
      ? q.duelDistractor
      : distractors[Math.floor(Math.random() * distractors.length)];

  return {
    id: q.id,
    quote: q.quote,
    context: q.context,
    format: "duel",
    options: shuffle([q.answer, opponent]),
  };
}
