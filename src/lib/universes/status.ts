import { db } from "@/lib/db";
import { scrapedRatios } from "@/lib/quiz/source-ratio";

export type UniverseStatusResult =
  | { status: "not_found" }
  | { status: "building" }
  | { status: "failed"; reason: string | null }
  | { status: "ready"; universe: { id: string; slug: string; name: string; scrapedRatio: number } };

// Shared by GET /api/universes/[slug] and the MCP get_universe_status /
// start_quiz tools.
export async function getUniverseStatus(slug: string): Promise<UniverseStatusResult> {
  const universe = await db.universe.findUnique({ where: { slug } });
  if (!universe) return { status: "not_found" };
  if (universe.status === "BUILDING") return { status: "building" };
  if (universe.status === "FAILED") return { status: "failed", reason: universe.failReason };

  const ratios = await scrapedRatios([universe.id]);
  return {
    status: "ready",
    universe: {
      id: universe.id,
      slug: universe.slug,
      name: universe.name,
      scrapedRatio: ratios.get(universe.id) ?? 0,
    },
  };
}
