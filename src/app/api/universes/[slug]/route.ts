import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { selectQuizQuestions } from "@/lib/quiz/select";
import { apiError } from "@/lib/http";

// GET /api/universes/[slug]?exclude=id1,id2  — build status, and the quiz
// payload once READY. `exclude` is a parent result's questionIds, used by
// the challenge flow to pick a fresh, non-overlapping set. The correct
// `answer` is never included in the response — grading happens server-side
// in POST /api/results.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const universe = await db.universe.findUnique({ where: { slug } });
  if (!universe) return apiError(404, "No universe with that slug");

  if (universe.status === "BUILDING") {
    return NextResponse.json({ status: "building" });
  }
  if (universe.status === "FAILED") {
    return NextResponse.json({ status: "failed", reason: universe.failReason });
  }

  const exclude = (req.nextUrl.searchParams.get("exclude") ?? "").split(",").filter(Boolean);
  const questions = await selectQuizQuestions(universe.id, exclude);

  return NextResponse.json({
    status: "ready",
    universe: {
      id: universe.id,
      slug: universe.slug,
      name: universe.name,
      source: universe.source,
    },
    quiz: {
      questions: questions.map((q) => ({
        id: q.id,
        quote: q.quote,
        options: q.options,
        context: q.context,
      })),
    },
  });
}
