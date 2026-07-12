import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const checkSchema = z.object({ picked: z.string().min(1) });

// POST /api/questions/[id]/check — reveals correctness (and the real answer)
// for ONE question, only once the player has committed a guess for it. This
// powers the immediate tap-to-reveal UX; it doesn't replace the authoritative
// grade in POST /api/results, which recomputes from the DB regardless of
// what the client reports here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "picked is required");

  const question = await db.question.findUnique({ where: { id } });
  if (!question) return apiError(404, "No question with that id");

  return NextResponse.json({
    correct: question.answer === parsed.data.picked,
    answer: question.answer,
  });
}
