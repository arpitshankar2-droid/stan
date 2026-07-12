import { db } from "@/lib/db";

// The Universe.source enum (SCRAPED/MIXED/GENERATED) is too coarse to be
// honest at the UI layer: two MIXED universes can have wildly different real
// yield (Breaking Bad 90/92 scraped vs The Office 44/59). Badges are driven
// by the actual per-question ratio instead.
export async function scrapedRatios(universeIds: string[]): Promise<Map<string, number>> {
  if (universeIds.length === 0) return new Map();

  const counts = await db.question.groupBy({
    by: ["universeId", "source"],
    where: { universeId: { in: universeIds } },
    _count: true,
  });

  const totals = new Map<string, { scraped: number; total: number }>();
  for (const row of counts) {
    const entry = totals.get(row.universeId) ?? { scraped: 0, total: 0 };
    entry.total += row._count;
    if (row.source === "SCRAPED") entry.scraped += row._count;
    totals.set(row.universeId, entry);
  }

  const ratios = new Map<string, number>();
  for (const id of universeIds) {
    const entry = totals.get(id);
    ratios.set(id, entry && entry.total > 0 ? entry.scraped / entry.total : 0);
  }
  return ratios;
}
