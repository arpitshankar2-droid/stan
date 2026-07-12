import Link from "next/link";
import { db } from "@/lib/db";
import { scrapedRatios } from "@/lib/quiz/source-ratio";
import { fandomPalette, fandomGradientStyle } from "@/lib/fandom-palette";
import { sourceBadge } from "@/lib/source-badge";
import { ShareActions } from "@/components/result/ShareActions";
import { DownloadCardButton } from "@/components/result/DownloadCardButton";
import type { GradedAnswer } from "@/lib/quiz/grade";

export const dynamic = "force-dynamic";

function isGradedAnswerArray(value: unknown): value is GradedAnswer[] {
  return Array.isArray(value) && value.every((a) => typeof a === "object" && a !== null && "ms" in a);
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.result.findUnique({ where: { id }, include: { universe: true } });

  if (!result) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-muted-foreground">No such result</h1>
        <Link href="/" className="text-sm text-arena-cyan underline underline-offset-4">
          Go play something
        </Link>
      </main>
    );
  }

  const parent = result.challengeOf
    ? await db.result.findUnique({
        where: { id: result.challengeOf },
        select: { name: true, score: true, universe: { select: { name: true } } },
      })
    : null;

  const total = result.questionIds.length;
  const accuracy = total > 0 ? Math.round((result.score / total) * 100) : 0;
  const answers = isGradedAnswerArray(result.answers) ? result.answers : [];
  const avgSpeedSec = answers.length > 0 ? answers.reduce((sum, a) => sum + a.ms, 0) / answers.length / 1000 : 0;

  const ratios = await scrapedRatios([result.universeId]);
  const scrapedRatio = ratios.get(result.universeId) ?? 0;
  const badge = sourceBadge(scrapedRatio);
  const palette = fandomPalette(result.universe.slug);
  const gradient = `linear-gradient(105deg, ${palette.from} 10%, ${palette.to} 90%)`;

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full opacity-15 blur-[120px]"
        style={{ background: gradient }}
      />

      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        {parent && (
          <p className="text-xs text-muted-foreground">
            Challenging {parent.name ?? "a challenger"}&apos;s {parent.score}/{total} on {parent.universe.name}
          </p>
        )}

        <p className="font-display text-2xl leading-tight" style={fandomGradientStyle(palette)}>
          {result.universe.name}
        </p>

        <p className="text-lg text-muted-foreground">{result.name ?? "A Challenger"}</p>

        <p className="font-display text-[clamp(3.5rem,16vw,7rem)] leading-none" style={fandomGradientStyle(palette)}>
          {result.score}/{total}
        </p>

        <p
          className="font-display clip-slash-both px-8 py-2 text-lg text-primary-foreground"
          style={{ background: gradient }}
        >
          {result.tier}
        </p>

        <p className="max-w-sm text-lg leading-snug italic">&ldquo;{result.roast}&rdquo;</p>

        <div className="mt-2 flex w-full justify-center gap-8">
          {[
            { label: "Accuracy", value: `${accuracy}%` },
            { label: "Best streak", value: String(result.bestStreak) },
            { label: "Avg speed", value: `${avgSpeedSec.toFixed(1)}s` },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">{stat.label}</span>
            </div>
          ))}
        </div>

        <span
          className={`w-fit rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ${badge.className}`}
        >
          {badge.label}
        </span>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <ShareActions path={`/r/${result.id}`} title={`I scored ${result.score}/${total} on ${result.universe.name}`} />
          <DownloadCardButton
            universeName={result.universe.name}
            playerName={result.name}
            score={result.score}
            total={total}
            tierName={result.tier}
            roast={result.roast}
            accuracy={accuracy}
            bestStreak={result.bestStreak}
            avgSpeedSec={avgSpeedSec}
            scrapedRatio={scrapedRatio}
            palette={palette}
          />
          <Link
            href={`/c/${result.id}`}
            className="rounded-full border border-arena-danger/40 px-6 py-2.5 text-sm text-arena-danger transition-colors hover:bg-arena-danger/10"
          >
            Challenge someone
          </Link>
        </div>

        <Link href="/" className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Play another fandom
        </Link>
      </div>
    </main>
  );
}
