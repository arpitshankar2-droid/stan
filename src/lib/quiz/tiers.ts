import { tierIndexForScore } from "@/lib/builder/schema";
import { z } from "zod";

const tiersJsonSchema = z
  .array(z.object({ name: z.string(), lines: z.array(z.string()).min(1) }))
  .length(5);

export interface Tier {
  name: string;
  roast: string;
}

/** Universe.tiers is untyped Json in the DB — validated here at the one place it's read. */
export function pickTier(tiersJson: unknown, score: number): Tier {
  const tiers = tiersJsonSchema.parse(tiersJson);
  const tier = tiers[tierIndexForScore(score)];
  const roast = tier.lines[Math.floor(Math.random() * tier.lines.length)];
  return { name: tier.name, roast };
}
