import { fandomGradientStyle, type FandomPalette } from "@/lib/fandom-palette";

export interface VsFighter {
  name: string;
  score: number;
  total: number;
  tier: string;
}

interface Props {
  left: VsFighter;
  right: VsFighter;
  palette: FandomPalette;
}

// Fight-card poster, not a data table: reuses the DuelCard mobile-clash
// technique from Task 9 verbatim — opposing rotation, a VS badge centered
// on the container (survives the mobile stack), overlap margins swapped per
// breakpoint. A winner gets a ribbon on their own card, so a tie needs no
// special-cased badge — two equal numbers already say it.
export function VsCompare({ left, right, palette }: Props) {
  const winner = left.score === right.score ? null : left.score > right.score ? "left" : "right";

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-3">
      <div className="relative flex w-full flex-col sm:flex-row">
        {[left, right].map((fighter, i) => {
          const isWinner = (i === 0 && winner === "left") || (i === 1 && winner === "right");
          return (
            <div
              key={i}
              className={`relative flex-1 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10 ${
                i === 0 ? "-rotate-2 -mb-3 sm:mb-0 sm:-mr-3" : "rotate-2 -mt-3 sm:mt-0 sm:-ml-3"
              }`}
            >
              {isWinner && (
                <span className="font-display absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-2 rounded-full bg-arena-gold px-4 py-1 text-xs whitespace-nowrap text-[#3a2a00] shadow-[0_0_16px_rgba(251,191,36,0.5)]">
                  WINNER
                </span>
              )}
              <p className="text-sm text-muted-foreground">{fighter.name}</p>
              <p className="font-display mt-1 text-4xl leading-none" style={fandomGradientStyle(palette)}>
                {fighter.score}/{fighter.total}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{fighter.tier}</p>
            </div>
          );
        })}

        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <span className="font-display flex size-12 items-center justify-center rounded-full bg-background text-sm text-arena-danger shadow-[0_0_20px_rgba(251,35,80,0.5)] ring-2 ring-arena-danger/60">
            VS
          </span>
        </div>
      </div>

      {winner === null && <p className="text-xs text-muted-foreground">Tied — anyone&apos;s game.</p>}
    </div>
  );
}
