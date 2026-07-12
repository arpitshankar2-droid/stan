import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { gradeAnswers, type SubmittedAnswer } from "@/lib/quiz/grade";
import { pickTier } from "@/lib/quiz/tiers";

export interface SubmitResultInput {
  universeId: string;
  name: string | null;
  challengeOf: string | null;
  answers: SubmittedAnswer[];
}

// Shared by POST /api/results and the MCP grade_quiz tool (PLAN.md: "calling
// the same service layer... no duplicated logic") — grades server-side (the
// caller never has the correct answer beforehand) and creates the Result row
// both /r/[id] and get_result read.
export async function submitResult({
  universeId,
  name,
  challengeOf,
  answers,
}: SubmitResultInput): Promise<{ id: string }> {
  const universe = await db.universe.findUnique({ where: { id: universeId } });
  if (!universe || universe.status !== "READY") {
    throw new Error("Universe not found or not ready");
  }

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

  return { id: result.id };
}
