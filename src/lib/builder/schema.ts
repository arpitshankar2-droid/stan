import { z } from "zod";
import { Type, type Schema } from "@google/genai";

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
    difficulty: z.number().int().min(1).max(3),
    context: z.string().nullish(),
    fromProvided: z.boolean(),
  })
  .refine(
    (q) => !q.distractors.some((d) => d.trim().toLowerCase() === q.answer.trim().toLowerCase()),
    { message: "distractor duplicates the answer" },
  );

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
 * Gemini structured-output schema — deliberately mirrors the zod constraints
 * above (exact lengths, ranges) so constrained decoding rejects bad shapes
 * at generation time instead of us catching them after the fact.
 */
export const universeResponseSchema: Schema = {
  type: Type.OBJECT,
  required: ["name", "aliases", "characters", "questions", "tiers"],
  properties: {
    name: { type: Type.STRING, minLength: "1" },
    aliases: { type: Type.ARRAY, maxItems: "12", items: { type: Type.STRING, minLength: "1" } },
    characters: {
      type: Type.ARRAY,
      minItems: "4",
      maxItems: "80",
      items: { type: Type.STRING, minLength: "1" },
    },
    questions: {
      type: Type.ARRAY,
      minItems: String(QUESTION_MIN),
      maxItems: String(QUESTION_MAX),
      items: {
        type: Type.OBJECT,
        required: ["quote", "answer", "distractors", "difficulty", "fromProvided"],
        properties: {
          quote: { type: Type.STRING, minLength: "4" },
          answer: { type: Type.STRING, minLength: "1" },
          distractors: {
            type: Type.ARRAY,
            minItems: "3",
            maxItems: "3",
            items: { type: Type.STRING, minLength: "1" },
          },
          difficulty: { type: Type.INTEGER, minimum: 1, maximum: 3 },
          context: { type: Type.STRING },
          fromProvided: { type: Type.BOOLEAN },
        },
      },
    },
    tiers: {
      type: Type.ARRAY,
      minItems: String(TIER_COUNT),
      maxItems: String(TIER_COUNT),
      items: {
        type: Type.OBJECT,
        required: ["name", "lines"],
        properties: {
          name: { type: Type.STRING, minLength: "1" },
          lines: {
            type: Type.ARRAY,
            minItems: "2",
            maxItems: "4",
            items: { type: Type.STRING, minLength: "1" },
          },
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
