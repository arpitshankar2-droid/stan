import { NextRequest, NextResponse } from "next/server";
import { getUniverseStatus } from "@/lib/universes/status";
import { selectQuizQuestions } from "@/lib/quiz/select";
import { formatQuestionForClient } from "@/lib/quiz/duel";
import { apiError } from "@/lib/http";

// GET /api/universes/[slug]?exclude=id1,id2  — build status, and the quiz
// payload once READY. `exclude` is a parent result's questionIds, used by
// the challenge flow to pick a fresh, non-overlapping set. The correct
// `answer` is never included in the response — grading happens server-side
// in POST /api/results.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const status = await getUniverseStatus(slug);

  if (status.status === "not_found") return apiError(404, "No universe with that slug");
  if (status.status === "building") return NextResponse.json({ status: "building" });
  if (status.status === "failed") return NextResponse.json({ status: "failed", reason: status.reason });

  const exclude = (req.nextUrl.searchParams.get("exclude") ?? "").split(",").filter(Boolean);
  const questions = await selectQuizQuestions(status.universe.id, exclude);

  return NextResponse.json({
    status: "ready",
    universe: status.universe,
    quiz: { questions: questions.map(formatQuestionForClient) },
  });
}
