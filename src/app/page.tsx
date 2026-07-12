import { db } from "@/lib/db";
import { FandomSearch } from "@/components/home/FandomSearch";
import { UniverseWall } from "@/components/home/UniverseWall";

// The wall reads live DB state — newly-built fandoms must show up without a
// redeploy, so this can't be statically prerendered.
export const dynamic = "force-dynamic";

export default async function Home() {
  const universes = await db.universe.findMany({
    where: { status: "READY" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { slug: true, name: true, source: true },
  });

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-6 pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-arena-gradient opacity-15 blur-[120px]"
      />

      <div className="flex min-h-[70vh] w-full flex-col items-center justify-center">
        <p className="font-mono text-xs tracking-[0.35em] text-muted-foreground">
          ROUND 0 / 10
        </p>

        <h1 className="font-display mt-4 text-[clamp(4rem,18vw,11rem)] leading-none text-arena-gradient text-glow-violet">
          Stan
        </h1>

        <p className="mt-6 max-w-md text-center text-lg text-muted-foreground">
          Pick a fandom. Ten quotes. Find out if you&apos;re a real one.
        </p>

        <div className="mt-10">
          <FandomSearch />
        </div>
      </div>

      <section className="relative w-full max-w-5xl">
        <p className="font-mono text-xs tracking-[0.35em] text-muted-foreground">
          THE ROSTER
        </p>
        <div className="mt-6">
          <UniverseWall universes={universes} />
        </div>
      </section>
    </main>
  );
}
