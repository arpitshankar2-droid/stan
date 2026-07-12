import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ReportReason } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const REASON_MAP: Record<string, ReportReason> = {
  wrong_answer: "WRONG_ANSWER",
  bad_quote: "BAD_QUOTE",
  other: "OTHER",
};

const reportSchema = z.object({ reason: z.enum(["wrong_answer", "bad_quote", "other"]) });

// POST /api/questions/[id]/report — no auth, no dedupe/rate-limit (matches
// PLAN.md's "no accounts" constraint); intentionally minimal, not a full
// moderation system. Doesn't check the question exists — a report about a
// since-rebuilt question is still useful signal.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "Invalid report reason");

  await db.questionReport.create({
    data: { questionId: id, reason: REASON_MAP[parsed.data.reason] },
  });

  return NextResponse.json({ ok: true });
}
