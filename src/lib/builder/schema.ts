import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import { quoteRevealsAnswer, isGenericQuote } from "@/lib/builder/quality";

export const TIER_COUNT = 5;
export const QUESTION_TARGET = 55;
export const QUESTION_MIN = 20;
export const QUESTION_MAX = 70;

// Per-item schemas, validated individually so one bad element can't sink the
// whole batch (see parseUniversePayload below) — the dominant real-world
// failure mode for a ~55-item structured response from a lite model.
const questionItemSchema = z
  .object({
    quote: z.string().min(4),
    answer: z.string().min(1),
    distractors: z.array(z.string().min(1)).length(3),
    // Nullish, not required: if Gemini omits it on a given item, the question
    // is still perfectly usable in four-option mode — pipeline.ts falls back
    // to picking a random distractor for duel mode on that one question
    // rather than dropping an otherwise-good item over a missing ranking.
    hardestDistractor: z.string().min(1).nullish(),
    difficulty: z.number().int().min(1).max(3),
    context: z.string().nullish(),
    fromProvided: z.boolean(),
  })
  .refine(
    (q) => !q.distractors.some((d) => d.trim().toLowerCase() === q.answer.trim().toLowerCase()),
    { message: "distractor duplicates the answer" },
  )
  // Same two content-quality checks as the pre-prompt scraped-candidate
  // filter in pipeline.ts, run again here because Gemini can also select or
  // invent a bad quote independently (the "top up" step, or the fully
  // generated-fallback prompt) — this is the backstop, not the only check.
  .refine((q) => !quoteRevealsAnswer(q.quote, q.answer), {
    message: "quote reveals the answer's own name",
  })
  .refine((q) => !isGenericQuote(q.quote), { message: "quote is too generic to identify a speaker" });

const tierItemSchema = z.object({
  name: z.string().min(1),
  lines: z.array(z.string().min(1)).min(2).max(4),
});

const universeShapeSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).max(12),
  characters: z.array(z.string().min(1)).min(4).max(80),
  questions: z.array(z.unknown()),
  tiers: z.array(z.unknown()),
});

export type QuestionItem = z.infer<typeof questionItemSchema>;
export type TierItem = z.infer<typeof tierItemSchema>;

export interface UniversePayload {
  name: string;
  aliases: string[];
  characters: string[];
  questions: QuestionItem[];
  tiers: TierItem[];
}

/**
 * Lenient parse: individual malformed questions/tiers are dropped rather than
 * failing the whole payload. Only throws (triggering generateStructured's
 * retry) if too little usable material survives.
 */
export function parseUniversePayload(raw: unknown): UniversePayload {
  const shape = universeShapeSchema.parse(raw);

  const questions: QuestionItem[] = [];
  for (const q of shape.questions) {
    const result = questionItemSchema.safeParse(q);
    if (result.success) questions.push(result.data);
  }
  if (questions.length < QUESTION_MIN) {
    throw new Error(
      `only ${questions.length}/${shape.questions.length} questions passed validation (need >= ${QUESTION_MIN})`,
    );
  }

  const tiers: TierItem[] = [];
  for (const t of shape.tiers) {
    const result = tierItemSchema.safeParse(t);
    if (result.success) tiers.push(result.data);
  }
  if (tiers.length !== TIER_COUNT) {
    throw new Error(`expected exactly ${TIER_COUNT} valid tiers, got ${tiers.length}/${shape.tiers.length}`);
  }

  return { name: shape.name, aliases: shape.aliases, characters: shape.characters, questions, tiers };
}

/**
 * Gemini structured-output schema. Deliberately loose — no minItems/maxItems/
 * minimum/maximum/minLength anywhere. An earlier version mirrored the zod
 * constraints exactly (exact-3 distractors, difficulty 1-3, per-string
 * minLength, all nested inside a ~70-item questions array), which reads well
 * on paper but Gemini's API rejected outright at request time: "schema
 * produces a constraint that has too many states for serving" — length/range
 * bounds nested inside a large array blow up the grammar Gemini has to
 * compile for constrained decoding. That only surfaced by actually calling
 * the API; the tightened version had only ever been typechecked. Real
 * validation now lives entirely in parseUniversePayload's per-item zod
 * checks below, which was always the correct layer for it — the schema here
 * just needs to describe shape, not enforce it.
 */
export const universeResponseSchema: Schema = {
  type: Type.OBJECT,
  required: ["name", "aliases", "characters", "questions", "tiers"],
  properties: {
    name: { type: Type.STRING },
    aliases: { type: Type.ARRAY, items: { type: Type.STRING } },
    characters: { type: Type.ARRAY, items: { type: Type.STRING } },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["quote", "answer", "distractors", "difficulty", "fromProvided"],
        properties: {
          quote: { type: Type.STRING },
          answer: { type: Type.STRING },
          distractors: { type: Type.ARRAY, items: { type: Type.STRING } },
          hardestDistractor: { type: Type.STRING },
          difficulty: { type: Type.INTEGER },
          context: { type: Type.STRING },
          fromProvided: { type: Type.BOOLEAN },
        },
      },
    },
    tiers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["name", "lines"],
        properties: {
          name: { type: Type.STRING },
          lines: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  },
};

/** Score thresholds for the 5 tiers, worst → best, applied server-side. */
export const TIER_FLOORS = [0, 3, 5, 7, 9] as const;

export function tierIndexForScore(score: number): number {
  let index = 0;
  for (let i = 0; i < TIER_FLOORS.length; i++) {
    if (score >= TIER_FLOORS[i]) index = i;
  }
  return index;
}
