import type { FandomPalette } from "@/lib/fandom-palette";

// Was previously a streak meter that reset on a wrong answer — playtesting
// feedback: users read 10 dots next to "ROUND N/10" as quiz progress, not
// streak, and a meter that visually resets while the round counter keeps
// climbing reads as broken. This is genuine progress: dots up to and
// including `current` are lit, the rest are dim. Streak lives as small text
// in RoundHeader instead, not a second row of dots.
export function ProgressDots({ current, total, palette }: { current: number; total: number; palette: FandomPalette }) {
  const dots = Array.from({ length: total }, (_, i) => i < current);
  return (
    <div className="flex items-center gap-1" aria-label={`Question ${current} of ${total}`}>
      {dots.map((filled, i) => (
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
