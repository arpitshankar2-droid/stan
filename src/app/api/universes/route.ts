import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { buildUniverse } from "@/lib/builder/pipeline";
import { listReadyUniverses, searchUniverses } from "@/lib/universes/query";
import { apiError } from "@/lib/http";

// The lock/dedupe step this route awaits directly is fast; the actual
// scrape→LLM→persist work runs via after() below and can take a while, so
// maxDuration still needs to cover it (Vercel keeps the invocation alive
// until deferred work finishes or this limit is hit).
export const maxDuration = 300;

// GET /api/universes?q=<query>  — fuzzy search for the home page's type-ahead
// GET /api/universes            — recent READY universes, for the universe wall
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const universes = q ? await searchUniverses(q) : await listReadyUniverses();
  return NextResponse.json({ universes });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(100) });

// POST /api/universes { name } — find-or-build. Only claims/reclaims the
// build lock synchronously; the actual build runs after the response via
// after(), so this returns almost immediately and the client polls
// GET /api/universes/[slug] (the build theater screen) for real status.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "name is required");

  try {
    const outcome = await buildUniverse(parsed.data.name);
    if (outcome.status === "already_ready") {
      return NextResponse.json({ status: "ready", slug: outcome.slug });
    }
    if (outcome.start) {
      after(outcome.start);
    }
    return NextResponse.json({ status: "building", slug: outcome.slug });
  } catch (err) {
    if (err instanceof Error && err.message === "daily build ceiling reached") {
      return apiError(429, "STAN is at capacity for today — try again tomorrow, or play an existing fandom.");
    }
    return apiError(500, "Something went wrong building that universe.");
  }
}
