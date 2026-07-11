import { z } from "zod";
import { Type, type Schema } from "@google/genai";

export const TIER_COUNT = 5;
export const QUESTION_TARGET = 55;
export const QUESTION_MIN = 20;

/** What one Gemini call must return: the entire playable universe. */
export const universePayloadSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).max(12),
  characters: z.array(z.string().min(1)).min(4).max(80),
  questions: z
    .array(
      z.object({
        quote: z.string().min(4),
        answer: z.string().min(1),
        distractors: z.array(z.string().min(1)).length(3),
        difficulty: z.number().int().min(1).max(3),
        context: z.string().nullish(),
        fromProvided: z.boolean(),
      }),
    )
    .min(QUESTION_MIN)
    .max(70),
  tiers: z
    .array(
      z.object({
        name: z.string().min(1),
        lines: z.array(z.string().min(1)).min(2).max(4),
      }),
    )
    .length(TIER_COUNT),
});

export type UniversePayload = z.infer<typeof universePayloadSchema>;

/** Gemini structured-output mirror of universePayloadSchema. */
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
