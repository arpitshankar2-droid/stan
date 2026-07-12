import { forwardRef } from "react";
import type { FandomPalette } from "@/lib/fandom-palette";
import { sourceBadge } from "@/lib/source-badge";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export interface FighterCardProps {
  universeName: string;
  playerName: string | null;
  score: number;
  total: number;
  tierName: string;
  roast: string;
  accuracy: number;
  bestStreak: number;
  avgSpeedSec: number;
  scrapedRatio: number;
  palette: FandomPalette;
}

// A standalone poster, not a scaled clone of the on-page layout — fixed
// pixel dimensions on purpose, rendered off-screen and captured via
// html-to-image for the "download card" button. Never shown directly; the
// visible /r/[id] page is a separate, ordinary responsive layout.
export const FighterCard = forwardRef<HTMLDivElement, FighterCardProps>(function FighterCard(
  {
    universeName,
    playerName,
    score,
    total,
    tierName,
    roast,
    accuracy,
    bestStreak,
    avgSpeedSec,
    scrapedRatio,
    palette,
  },
  ref,
) {
  const badge = sourceBadge(scrapedRatio);
  const gradient = `linear-gradient(105deg, ${palette.from} 10%, ${palette.to} 90%)`;
  const textGradient = {
    backgroundImage: gradient,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
  } as const;

  return (
    <div
      ref={ref}
      className="relative flex shrink-0 flex-col items-center overflow-hidden bg-background px-[64px] py-[72px] text-foreground"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
    >
      <div
        aria-hidden
        className="absolute -top-[200px] left-1/2 h-[700px] w-[900px] -translate-x-1/2 rounded-full opacity-20 blur-[140px]"
        style={{ background: gradient }}
      />

      <p className="relative font-mono text-[28px] font-bold tracking-[0.3em] text-muted-foreground">STAN</p>

      <p className="font-display relative mt-6 text-[40px] leading-none" style={textGradient}>
        {universeName}
      </p>

      <p className="relative mt-10 text-[32px] text-[#cfc7f2]">{playerName ?? "A Challenger"}</p>

      <p className="font-display relative mt-2 text-[220px] leading-none" style={textGradient}>
        {score}/{total}
      </p>

      <p
        className="font-display relative mt-8 px-[56px] py-[16px] text-[34px] leading-none text-[#0b0714] clip-slash-both"
        style={{ background: gradient }}
      >
        {tierName}
      </p>

      <p className="relative mt-10 max-w-[820px] text-center text-[30px] leading-snug italic">&ldquo;{roast}&rdquo;</p>

      <div className="relative mt-auto flex gap-[64px]">
        {[
          { label: "ACCURACY", value: `${accuracy}%` },
          { label: "BEST STREAK", value: String(bestStreak) },
          { label: "AVG SPEED", value: `${avgSpeedSec.toFixed(1)}s` },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center">
            <span className="text-[44px] font-bold">{stat.value}</span>
            <span className="mt-1.5 text-[18px] tracking-[0.2em] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      <span
        className={`relative mt-10 rounded-full border px-[20px] py-[8px] text-[16px] font-medium tracking-wide uppercase ${badge.className}`}
      >
        {badge.label}
      </span>
    </div>
  );
});
