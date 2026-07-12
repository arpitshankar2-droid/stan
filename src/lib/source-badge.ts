// quoteSource honesty: badges are driven by the real per-question scraped
// ratio (see quiz/source-ratio.ts), not the coarse Universe.source enum —
// two MIXED universes can have very different real yield, and the badge
// needs to say so. A GENERATED-heavy universe must never read as verified
// canon, so the low end is styled as a caution, not a neutral third state.
export interface SourceBadge {
  label: string;
  className: string;
  // Raw hex, alongside className — contexts that can't apply Tailwind
  // classes (next/og's Satori renderer, the html-to-image export card) need
  // an actual color value, not a class string to parse.
  hex: string;
}

const VERIFIED: SourceBadge = {
  label: "Verified Quotes",
  className: "border-arena-cyan/40 bg-arena-cyan/10 text-arena-cyan",
  hex: "#22d3ee",
};

const GENERATED: SourceBadge = {
  label: "AI-Generated",
  className: "border-arena-gold/50 bg-arena-gold/15 text-arena-gold",
  hex: "#fbbf24",
};

const PARTIAL_CLASS = "border-arena-violet-hot/40 bg-arena-violet-hot/10 text-arena-violet-hot";
const PARTIAL_HEX = "#a855f7";

export function sourceBadge(scrapedRatio: number | null): SourceBadge {
  if (scrapedRatio === null || scrapedRatio <= 0) return GENERATED;
  if (scrapedRatio >= 0.95) return VERIFIED;
  return { label: `${Math.round(scrapedRatio * 100)}% Verified`, className: PARTIAL_CLASS, hex: PARTIAL_HEX };
}
