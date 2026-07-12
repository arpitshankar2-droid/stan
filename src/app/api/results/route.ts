import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { gradeAnswers } from "@/lib/quiz/grade";
import { pickTier } from "@/lib/quiz/tiers";
import { apiError } from "@/lib/http";

const submitSchema = z.object({
  universeId: z.string().min(1),
  name: z.string().trim().max(40).nullish(),
  challengeOf: z.string().nullish(),
  answers: z
    .array(z.object({ questionId: z.string().min(1), picked: z.string().min(1), ms: z.number().nonnegative() }))
    .min(1),
});

// POST /api/results — grades server-side (the client never has the correct
// answer beforehand) and creates the Result row the /r/[id] page reads.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "Invalid submission");
  const { universeId, name, challengeOf, answers } = parsed.data;

  const universe = await db.universe.findUnique({ where: { id: universeId } });
  if (!universe || universe.status !== "READY") return apiError(404, "Universe not found or not ready");

  const graded = await gradeAnswers(universeId, answers);
  const tier = pickTier(universe.tiers, graded.score);

  const result = await db.result.create({
    data: {
      universeId,
      name: name || null,
      score: graded.score,
      questionIds: answers.map((a) => a.questionId),
      answers: graded.answers as unknown as Prisma.InputJsonValue,
      tier: tier.name,
      roast: tier.roast,
      bestStreak: graded.bestStreak,
      challengeOf: challengeOf || null,
    },
  });

  return NextResponse.json({ id: result.id });
}
