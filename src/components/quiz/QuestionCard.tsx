import type { Reveal } from "@/components/quiz/types";

interface Props {
  options: string[];
  picked: string | null;
  reveal: Reveal | null;
  onPick: (picked: string) => void;
}

// Options stay in plain foreground text, not the fandom gradient — the
// palette lives on the quote card and chrome around this; the tappable
// options need the cyan/red reveal colors to read unambiguously against
// whatever the fandom's palette happens to be.
//
// `picked` is set synchronously on tap, before the /check network call
// resolves — this is what makes tapping feel instant instead of laggy.
// `reveal` (correctness) arrives later and overlays on top of it.
export function QuestionCard({ options, picked, reveal, onPick }: Props) {
  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      {options.map((name) => {
        const isPicked = picked === name;
        const isAnswer = reveal?.answer === name;
        const isCorrectPick = isPicked && reveal?.correct;
        const isWrongPick = isPicked && reveal && !reveal.correct;

        let tone = "ring-foreground/15 hover:ring-arena-violet-hot/50 hover:bg-muted";
        if (reveal) {
          if (isAnswer) tone = "bg-arena-cyan/10 ring-2 ring-arena-cyan";
          else if (isPicked) tone = "bg-arena-danger/10 ring-2 ring-arena-danger";
          else tone = "ring-foreground/10 opacity-50";
        } else if (isPicked) {
          tone = "bg-muted ring-2 ring-arena-violet-hot scale-[0.98]";
        }

        return (
          <button
            key={name}
            type="button"
            disabled={!!picked}
            onClick={() => onPick(name)}
            className={`rounded-xl bg-card px-5 py-4 text-left text-lg font-medium ring-1 transition-all ${tone} ${
              isWrongPick ? "animate-shake" : ""
            } ${isCorrectPick ? "animate-pulse-glow" : ""}`}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
