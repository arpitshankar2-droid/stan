// Typography-first cards mean the fandom name IS the visual identity — so it
// can't all be the same violet→cyan brand gradient, or every card looks the
// same. Curated for shows with an iconic, instantly-recognizable color (a
// hash would never land on these by chance); deterministic hash fallback for
// any fandom built on demand, so it's still stable and distinct card to card.
export interface FandomPalette {
  from: string;
  to: string;
}

const CURATED: Record<string, FandomPalette> = {
  "breaking-bad": { from: "#e8c400", to: "#1f7a3f" }, // hazmat yellow -> cook green
  "bojack-horseman": { from: "#ff5fa8", to: "#7c3aed" }, // BoJack pink -> Hollywoo purple
  "the-office": { from: "#3b82f6", to: "#64748b" }, // Dunder Mifflin blue -> paper gray
  naruto: { from: "#f97316", to: "#7c1d1d" }, // jumpsuit orange -> Uzumaki red
};

const FALLBACK_PALETTES: FandomPalette[] = [
  { from: "#f97316", to: "#7c2d12" },
  { from: "#ef4444", to: "#7f1d1d" },
  { from: "#10b981", to: "#064e3b" },
  { from: "#eab308", to: "#78350f" },
  { from: "#ec4899", to: "#831843" },
  { from: "#0ea5e9", to: "#0c4a6e" },
  { from: "#f43f5e", to: "#4c0519" },
  { from: "#84cc16", to: "#365314" },
];

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function fandomPalette(slug: string): FandomPalette {
  return CURATED[slug] ?? FALLBACK_PALETTES[hashSlug(slug) % FALLBACK_PALETTES.length];
}
