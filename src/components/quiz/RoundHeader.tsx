import type { FandomPalette } from "@/lib/fandom-palette";
import { ProgressDots } from "@/components/quiz/ProgressDots";
import { TimerRing } from "@/components/quiz/TimerRing";

interface Props {
  round: number;
  total: number;
  palette: FandomPalette;
  streak: number;
  questionKey: string;
  timerPaused: boolean;
  onExpire: () => void;
}

// No source badge here — it's already on the universe card the player chose
// from; repeating it on every question was clutter, not honesty (the wall
// and search results are still where quoteSource is surfaced).
export function RoundHeader({ round, total, palette, streak, questionKey, timerPaused, onExpire }: Props) {
  return (
    <div className="flex w-full max-w-lg flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
            ROUND {round} / {total}
            {streak >= 2 && <span className="ml-2 text-arena-cyan">{streak} in a row</span>}
          </p>
          <div
            className="mt-1 h-0.5 w-10 rounded-full"
            style={{ background: `linear-gradient(105deg, ${palette.from}, ${palette.to})` }}
          />
        </div>
        <TimerRing
          palette={palette}
          durationMs={15000}
          questionKey={questionKey}
          paused={timerPaused}
          onExpire={onExpire}
        />
      </div>
      <ProgressDots current={round} total={total} palette={palette} />
    </div>
  );
}
