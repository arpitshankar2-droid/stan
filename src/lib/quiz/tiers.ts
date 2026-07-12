import { tierIndexForScore } from "@/lib/builder/schema";
import { HINGLISH_ROASTS } from "@/lib/quiz/hinglish-roasts";
import { z } from "zod";

const tiersJsonSchema = z
  .array(z.object({ name: z.string(), lines: z.array(z.string()).min(1) }))
  .length(5);

export interface Tier {
  name: string;
  roast: string;
}

/**
 * Universe.tiers is untyped Json in the DB — validated here at the one place
 * it's read. The tier *name* stays whatever Gemini generated for this
 * fandom specifically; the roast line is picked from that fandom's English
 * lines plus the generic Hinglish pool mixed in, so both languages are in
 * play for every universe without needing a rebuild.
 */
export function pickTier(tiersJson: unknown, score: number): Tier {
  const tiers = tiersJsonSchema.parse(tiersJson);
  const index = tierIndexForScore(score);
  const tier = tiers[index];
  const pool = [...tier.lines, ...HINGLISH_ROASTS[index]];
  const roast = pool[Math.floor(Math.random() * pool.length)];
  return { name: tier.name, roast };
}
