import type { FandomPalette } from "@/lib/fandom-palette";
import { sourceBadge } from "@/lib/source-badge";
import { StreakMeter } from "@/components/quiz/StreakMeter";
import { TimerRing } from "@/components/quiz/TimerRing";

interface Props {
  round: number;
  total: number;
  palette: FandomPalette;
  scrapedRatio: number;
  streak: number;
  questionKey: string;
  timerPaused: boolean;
  onExpire: () => void;
}

export function RoundHeader({
  round,
  total,
  palette,
  scrapedRatio,
  streak,
  questionKey,
  timerPaused,
  onExpire,
}: Props) {
  const badge = sourceBadge(scrapedRatio);

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
            ROUND {round} / {total}
          </p>
          <div
            className="mt-1 h-0.5 w-10 rounded-full"
            style={{ background: `linear-gradient(105deg, ${palette.from}, ${palette.to})` }}
          />
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-medium tracking-wide uppercase ${badge.className}`}
        >
          {badge.label}
        </span>
        <TimerRing
          palette={palette}
          durationMs={15000}
          questionKey={questionKey}
          paused={timerPaused}
          onExpire={onExpire}
        />
      </div>
      <StreakMeter streak={streak} total={total} palette={palette} />
    </div>
  );
}
