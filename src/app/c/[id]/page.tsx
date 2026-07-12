import Link from "next/link";
import { db } from "@/lib/db";
import { fandomPalette } from "@/lib/fandom-palette";
import { ChallengeFlow } from "@/components/challenge/ChallengeFlow";

export const dynamic = "force-dynamic";

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parent = await db.result.findUnique({ where: { id }, include: { universe: true } });

  if (!parent) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-muted-foreground">No such challenge</h1>
        <Link href="/" className="text-sm text-arena-cyan underline underline-offset-4">
          Go play something
        </Link>
      </main>
    );
  }

  const palette = fandomPalette(parent.universe.slug);
  const gradient = `linear-gradient(105deg, ${palette.from} 10%, ${palette.to} 90%)`;

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full opacity-15 blur-[120px]"
        style={{ background: gradient }}
      />
      <ChallengeFlow
        parentId={parent.id}
        parentName={parent.name ?? "A Challenger"}
        parentScore={parent.score}
        total={parent.questionIds.length}
        universeId={parent.universeId}
        universeSlug={parent.universe.slug}
        universeName={parent.universe.name}
        excludeIds={parent.questionIds}
        palette={palette}
      />
    </main>
  );
}
