import type { Metadata } from "next";
import Link from "next/link";
import { getResultViewData } from "@/lib/result-data";
import { fandomGradientStyle } from "@/lib/fandom-palette";
import { ShareActions } from "@/components/result/ShareActions";
import { DownloadCardButton } from "@/components/result/DownloadCardButton";
import { VsCompare } from "@/components/result/VsCompare";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getResultViewData(id);
  if (!data) return { title: "No such result — STAN" };

  const title = `${data.playerName ?? "A challenger"} scored ${data.score}/${data.total} on ${data.universeName}`;
  const description = "Think you're the bigger stan? Play STAN and find out.";
  return {
    title: `${title} — STAN`,
    description,
    openGraph: { title, description },
    twitter: { title, description, card: "summary_large_image" },
  };
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getResultViewData(id);

  if (!data) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-muted-foreground">No such result</h1>
        <Link href="/" className="text-sm text-arena-cyan underline underline-offset-4">
          Go play something
        </Link>
      </main>
    );
  }

  const { palette, badge, parent } = data;
  const gradient = `linear-gradient(105deg, ${palette.from} 10%, ${palette.to} 90%)`;

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full opacity-15 blur-[120px]"
        style={{ background: gradient }}
      />

      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <p className="font-display text-2xl leading-tight" style={fandomGradientStyle(palette)}>
          {data.universeName}
        </p>

        {parent ? (
          <VsCompare
            palette={palette}
            left={{ name: parent.name ?? "A Challenger", score: parent.score, total: data.total, tier: parent.tier }}
            right={{ name: data.playerName ?? "A Challenger", score: data.score, total: data.total, tier: data.tier }}
          />
        ) : (
          <>
            <p className="text-lg text-muted-foreground">{data.playerName ?? "A Challenger"}</p>

            <p className="font-display text-[clamp(3.5rem,16vw,7rem)] leading-none" style={fandomGradientStyle(palette)}>
              {data.score}/{data.total}
            </p>

            <p
              className="font-display clip-slash-both px-8 py-2 text-lg text-primary-foreground"
              style={{ background: gradient }}
            >
              {data.tier}
            </p>
          </>
        )}

        <p className="max-w-sm text-lg leading-snug italic">&ldquo;{data.roast}&rdquo;</p>

        <div className="mt-2 flex w-full justify-center gap-8">
          {[
            { label: "Accuracy", value: `${data.accuracy}%` },
            { label: "Best streak", value: String(data.bestStreak) },
            { label: "Avg speed", value: `${data.avgSpeedSec.toFixed(1)}s` },
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
          <ShareActions path={`/r/${data.id}`} title={`I scored ${data.score}/${data.total} on ${data.universeName}`} />
          <DownloadCardButton
            universeName={data.universeName}
            playerName={data.playerName}
            score={data.score}
            total={data.total}
            tierName={data.tier}
            roast={data.roast}
            accuracy={data.accuracy}
            bestStreak={data.bestStreak}
            avgSpeedSec={data.avgSpeedSec}
            scrapedRatio={data.scrapedRatio}
            palette={palette}
          />
          <ShareActions
            path={`/c/${data.id}`}
            title={`${data.playerName ?? "Someone"} challenged you on ${data.universeName}`}
            text={`${data.playerName ?? "Someone"} challenged you on ${data.universeName}. Think you're the bigger stan?`}
            label="Challenge someone"
            variant="outline-danger"
          />
        </div>

        <Link href="/" className="mt-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Play another fandom
        </Link>
      </div>
    </main>
  );
}
