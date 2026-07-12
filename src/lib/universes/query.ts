import { db } from "@/lib/db";
import { scrapedRatios } from "@/lib/quiz/source-ratio";

export interface UniverseSummary {
  slug: string;
  name: string;
  status?: string;
  scrapedRatio: number;
}

// Shared by GET /api/universes and the MCP search_universes tool.
export async function listReadyUniverses(limit = 20): Promise<UniverseSummary[]> {
  const universes = await db.universe.findMany({
    where: { status: "READY" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, slug: true, name: true },
  });
  const ratios = await scrapedRatios(universes.map((u) => u.id));
  return universes.map((u) => ({ slug: u.slug, name: u.name, scrapedRatio: ratios.get(u.id) ?? 0 }));
}

// pg_trgm similarity search — same matching strategy as the build
// pipeline's own dedupe, so "what you'd find by typing" matches "what
// building would have deduped against".
export async function searchUniverses(query: string, limit = 10): Promise<UniverseSummary[]> {
  const universes = await db.$queryRaw<{ id: string; slug: string; name: string; status: string }[]>`
    SELECT id, slug, name, status FROM "Universe"
    WHERE similarity(name, ${query}) > 0.2 OR name ILIKE ${"%" + query + "%"}
    ORDER BY similarity(name, ${query}) DESC
    LIMIT ${limit}
  `;
  const ratios = await scrapedRatios(universes.map((u) => u.id));
  return universes.map((u) => ({
    slug: u.slug,
    name: u.name,
    status: u.status,
    scrapedRatio: ratios.get(u.id) ?? 0,
  }));
}
