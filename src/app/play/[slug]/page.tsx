import Link from "next/link";
import { db } from "@/lib/db";
import { BuildTheater } from "@/components/play/BuildTheater";

// Reads live per-slug build status — must never be statically cached.
export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const universe = await db.universe.findUnique({ where: { slug } });

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-arena-gradient opacity-15 blur-[120px]"
      />

      {!universe ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-display text-3xl text-muted-foreground">No such fandom yet</h1>
          <Link href="/" className="text-sm text-arena-cyan underline underline-offset-4">
            Go build one
          </Link>
        </div>
      ) : (
        <BuildTheater
          slug={universe.slug}
          initialStatus={
            universe.status === "READY"
              ? "ready"
              : universe.status === "FAILED"
                ? "failed"
                : "building"
          }
          initialName={universe.name}
          initialFailReason={universe.failReason}
        />
      )}
    </main>
  );
}
