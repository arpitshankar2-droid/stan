import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

function serializeResult(result: {
  id: string;
  name: string | null;
  score: number;
  questionIds: string[];
  tier: string;
  roast: string;
  bestStreak: number;
  challengeOf: string | null;
  createdAt: Date;
  universe: { slug: string; name: string; source: string | null };
}) {
  return {
    id: result.id,
    name: result.name,
    score: result.score,
    totalQuestions: result.questionIds.length,
    tier: result.tier,
    roast: result.roast,
    bestStreak: result.bestStreak,
    challengeOf: result.challengeOf,
    createdAt: result.createdAt,
    universe: result.universe,
  };
}

// GET /api/results/[id] — the /r/[id] result card's data, and (when the
// result was itself a challenge) the parent's summary for the /c/[id] VS
// compare view, so both pages can share this one endpoint.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.result.findUnique({
    where: { id },
    include: { universe: { select: { slug: true, name: true, source: true } } },
  });
  if (!result) return apiError(404, "No result with that id");

  let parent = null;
  if (result.challengeOf) {
    const parentResult = await db.result.findUnique({
      where: { id: result.challengeOf },
      include: { universe: { select: { slug: true, name: true, source: true } } },
    });
    if (parentResult) parent = serializeResult(parentResult);
  }

  return NextResponse.json({ ...serializeResult(result), parent });
}
