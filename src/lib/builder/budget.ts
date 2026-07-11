import { db } from "@/lib/db";

/**
 * Universe builds are the only thing that spends Gemini requests, so gating
 * builds per UTC day keeps us under the free-tier cap with room to spare.
 */
export async function buildsRemainingToday(): Promise<number> {
  const ceiling = Number(process.env.DAILY_BUILD_CEILING ?? 200);
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);
  const used = await db.universe.count({
    where: { createdAt: { gte: startOfUtcDay } },
  });
  return Math.max(0, ceiling - used);
}
