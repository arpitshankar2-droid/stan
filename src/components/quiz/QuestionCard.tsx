import type { Reveal } from "@/components/quiz/types";

interface Props {
  options: string[];
  disabled: boolean;
  reveal: Reveal | null;
  onPick: (picked: string) => void;
}

// Options stay in plain foreground text, not the fandom gradient — the
// palette lives on the quote card and chrome around this; the tappable
// options need the cyan/red reveal colors to read unambiguously against
// whatever the fandom's palette happens to be.
export function QuestionCard({ options, disabled, reveal, onPick }: Props) {
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {options.map((name) => {
        const isPicked = reveal?.picked === name;
        const isAnswer = reveal?.answer === name;
        const tone = !reveal
          ? "ring-foreground/15 hover:ring-arena-violet-hot/50 hover:bg-muted"
          : isAnswer
            ? "bg-arena-cyan/10 ring-2 ring-arena-cyan"
            : isPicked
              ? "bg-arena-danger/10 ring-2 ring-arena-danger"
              : "ring-foreground/10 opacity-50";
        return (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => onPick(name)}
            className={`rounded-xl bg-card px-5 py-4 text-left text-lg font-medium ring-1 transition-all ${tone} ${
              isPicked && reveal && !reveal.correct ? "animate-shake" : ""
            }`}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
