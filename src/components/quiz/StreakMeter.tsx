import type { FandomPalette } from "@/lib/fandom-palette";

export function StreakMeter({ streak, total, palette }: { streak: number; total: number; palette: FandomPalette }) {
  const pips = Array.from({ length: total }, (_, i) => i < streak);
  return (
    <div className="flex items-center gap-1" aria-label={`Current streak: ${streak}`}>
      {pips.map((filled, i) => (
        <span
          key={i}
          className="h-1.5 w-3 rounded-full transition-colors duration-300"
          style={{
            background: filled ? `linear-gradient(105deg, ${palette.from}, ${palette.to})` : "var(--muted)",
          }}
        />
      ))}
    </div>
  );
}
