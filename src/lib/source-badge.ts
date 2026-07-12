// quoteSource honesty: badges are driven by the real per-question scraped
// ratio (see quiz/source-ratio.ts), not the coarse Universe.source enum —
// two MIXED universes can have very different real yield, and the badge
// needs to say so. A GENERATED-heavy universe must never read as verified
// canon, so the low end is styled as a caution, not a neutral third state.
export interface SourceBadge {
  label: string;
  className: string;
}

const VERIFIED: SourceBadge = {
  label: "Verified Quotes",
  className: "border-arena-cyan/40 bg-arena-cyan/10 text-arena-cyan",
};

const GENERATED: SourceBadge = {
  label: "AI-Generated",
  className: "border-arena-gold/50 bg-arena-gold/15 text-arena-gold",
};

const PARTIAL_CLASS = "border-arena-violet-hot/40 bg-arena-violet-hot/10 text-arena-violet-hot";

export function sourceBadge(scrapedRatio: number | null): SourceBadge {
  if (scrapedRatio === null || scrapedRatio <= 0) return GENERATED;
  if (scrapedRatio >= 0.95) return VERIFIED;
  return { label: `${Math.round(scrapedRatio * 100)}% Verified`, className: PARTIAL_CLASS };
}
