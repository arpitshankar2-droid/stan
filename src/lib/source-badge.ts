import type { QuoteSource } from "@prisma/client";

// quoteSource honesty: a GENERATED universe must never read as verified
// canon, so its badge is styled as a caution, not a neutral third option.
export interface SourceBadge {
  label: string;
  className: string;
}

const BADGES: Record<QuoteSource, SourceBadge> = {
  SCRAPED: {
    label: "Verified Quotes",
    className: "border-arena-cyan/40 bg-arena-cyan/10 text-arena-cyan",
  },
  MIXED: {
    label: "Mostly Verified",
    className: "border-arena-violet-hot/40 bg-arena-violet-hot/10 text-arena-violet-hot",
  },
  GENERATED: {
    label: "AI-Generated",
    className: "border-arena-gold/50 bg-arena-gold/15 text-arena-gold",
  },
};

export function sourceBadge(source: QuoteSource | null): SourceBadge {
  if (!source) return BADGES.GENERATED;
  return BADGES[source];
}
