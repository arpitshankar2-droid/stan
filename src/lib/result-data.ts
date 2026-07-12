import { cache } from "react";
import { db } from "@/lib/db";
import { scrapedRatios } from "@/lib/quiz/source-ratio";
import { fandomPalette, type FandomPalette } from "@/lib/fandom-palette";
import { sourceBadge, type SourceBadge } from "@/lib/source-badge";
import type { GradedAnswer } from "@/lib/quiz/grade";

function isGradedAnswerArray(value: unknown): value is GradedAnswer[] {
  return Array.isArray(value) && value.every((a) => typeof a === "object" && a !== null && "ms" in a);
}

export interface ResultViewParent {
  name: string | null;
  score: number;
  universeName: string;
}

export interface ResultViewData {
  id: string;
  universeName: string;
  universeSlug: string;
  playerName: string | null;
  score: number;
  total: number;
  tier: string;
  roast: string;
  accuracy: number;
  bestStreak: number;
  avgSpeedSec: number;
  scrapedRatio: number;
  badge: SourceBadge;
  palette: FandomPalette;
  parent: ResultViewParent | null;
}

// Shared by /r/[id]/page.tsx, its generateMetadata, and opengraph-image.tsx
// so the DB reads and stat computation (accuracy, avg speed from the stored
// per-question ms values, the honest scrapedRatio badge) can't drift between
// what the page shows and what the social-share image/title show. Wrapped in
// React's cache() so page.tsx's generateMetadata and the page component
// itself — both called for the same navigation — share one DB round trip
// instead of two; opengraph-image.tsx is a genuinely separate HTTP request
// so it still does its own fetch, which is correct, not a cache miss to fix.
export const getResultViewData = cache(async function getResultViewData(
  id: string,
): Promise<ResultViewData | null> {
  const result = await db.result.findUnique({ where: { id }, include: { universe: true } });
  if (!result) return null;

  const parentRow = result.challengeOf
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

  return {
    id: result.id,
    universeName: result.universe.name,
    universeSlug: result.universe.slug,
    playerName: result.name,
    score: result.score,
    total,
    tier: result.tier,
    roast: result.roast,
    accuracy,
    bestStreak: result.bestStreak,
    avgSpeedSec,
    scrapedRatio,
    badge: sourceBadge(scrapedRatio),
    palette: fandomPalette(result.universe.slug),
    parent: parentRow
      ? { name: parentRow.name, score: parentRow.score, universeName: parentRow.universe.name }
      : null,
  };
});
