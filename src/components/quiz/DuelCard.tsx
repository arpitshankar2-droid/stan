import { fandomGradientStyle, type FandomPalette } from "@/lib/fandom-palette";
import type { Reveal } from "@/components/quiz/types";

interface Props {
  options: string[];
  palette: FandomPalette;
  disabled: boolean;
  reveal: Reveal | null;
  onPick: (picked: string) => void;
}

// The clash has to survive the mobile stack: the VS badge is centered on the
// whole container (not tied to flex-direction), so it sits at the seam
// whether the two fighters are side-by-side or stacked, and each half keeps
// its opposing rotation and a small negative margin toward the other in both
// layouts — two neatly stacked buttons would just be a worse four-option.
export function DuelCard({ options, palette, disabled, reveal, onPick }: Props) {
  return (
    <div className="relative flex w-full max-w-md flex-col sm:flex-row">
      {options.map((name, i) => {
        const isPicked = reveal?.picked === name;
        const isAnswer = reveal?.answer === name;
        const tone = !reveal
          ? "ring-foreground/15 hover:ring-arena-violet-hot/50"
          : isAnswer
            ? "ring-2 ring-arena-cyan"
            : isPicked
              ? "ring-2 ring-arena-danger"
              : "opacity-50 ring-foreground/10";

        return (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => onPick(name)}
            className={`relative z-0 flex-1 rounded-2xl bg-card px-6 py-10 text-center ring-1 transition-all ${tone} ${
              i === 0 ? "-rotate-2 -mb-3 sm:mb-0 sm:-mr-3" : "rotate-2 -mt-3 sm:mt-0 sm:-ml-3"
            } ${isPicked && reveal && !reveal.correct ? "animate-shake" : ""}`}
          >
            <span className="font-display block text-2xl leading-tight sm:text-3xl" style={fandomGradientStyle(palette)}>
              {name}
            </span>
          </button>
        );
      })}

      <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <span className="font-display flex size-12 items-center justify-center rounded-full bg-background text-sm text-arena-danger shadow-[0_0_20px_rgba(251,35,80,0.5)] ring-2 ring-arena-danger/60">
          VS
        </span>
      </div>
    </div>
  );
}
