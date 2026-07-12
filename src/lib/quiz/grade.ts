import { db } from "@/lib/db";

export interface SubmittedAnswer {
  questionId: string;
  picked: string;
  ms: number;
}

export interface GradedAnswer extends SubmittedAnswer {
  correct: boolean;
}

export interface GradeResult {
  score: number;
  bestStreak: number;
  answers: GradedAnswer[];
}

/**
 * Grades server-side against the stored answer — the client never receives
 * the correct answer before submitting, so this is the only place a score
 * is actually computed. Only questions belonging to `universeId` are
 * considered correct-able, a basic integrity check against a tampered
 * questionId from another universe.
 */
export async function gradeAnswers(
  universeId: string,
  submitted: SubmittedAnswer[],
): Promise<GradeResult> {
  const questions = await db.question.findMany({
    where: { id: { in: submitted.map((s) => s.questionId) }, universeId },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));

  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  const answers: GradedAnswer[] = submitted.map((s) => {
    const question = byId.get(s.questionId);
    const correct = question?.answer === s.picked;
    if (correct) {
      score++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
    return { ...s, correct };
  });

  return { score, bestStreak, answers };
}
