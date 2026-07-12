import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitResult } from "@/lib/quiz/submit";
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

  try {
    const result = await submitResult({ universeId, name: name ?? null, challengeOf: challengeOf ?? null, answers });
    return NextResponse.json(result);
  } catch {
    return apiError(404, "Universe not found or not ready");
  }
}
