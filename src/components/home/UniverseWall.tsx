import Link from "next/link";
import { sourceBadge } from "@/lib/source-badge";
import { fandomPalette } from "@/lib/fandom-palette";

export interface WallUniverse {
  slug: string;
  name: string;
  scrapedRatio: number;
}

export function UniverseWall({ universes }: { universes: WallUniverse[] }) {
  if (universes.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        No fandoms yet — be the first to build one above.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {universes.map((universe) => (
        <UniverseCard key={universe.slug} universe={universe} />
      ))}
    </div>
  );
}

function UniverseCard({ universe }: { universe: WallUniverse }) {
  const badge = sourceBadge(universe.scrapedRatio);
  const palette = fandomPalette(universe.slug);

  return (
    <Link
      href={`/play/${universe.slug}`}
      className="group flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:-rotate-1 hover:ring-arena-violet-hot/50"
    >
      <span
        className="font-display text-2xl leading-tight"
        style={{
          backgroundImage: `linear-gradient(105deg, ${palette.from} 10%, ${palette.to} 90%)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        {universe.name}
      </span>
      <span
        className={`w-fit rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ${badge.className}`}
      >
        {badge.label}
      </span>
    </Link>
  );
}
