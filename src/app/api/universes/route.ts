import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildUniverse } from "@/lib/builder/pipeline";
import { apiError } from "@/lib/http";

export const maxDuration = 300; // a fresh build can take several minutes end-to-end

// GET /api/universes?q=<query>  — fuzzy search for the home page's type-ahead
// GET /api/universes            — recent READY universes, for the universe wall
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    const universes = await db.universe.findMany({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { slug: true, name: true, source: true, createdAt: true },
    });
    return NextResponse.json({ universes });
  }

  // pg_trgm similarity search — same matching strategy as the build pipeline's
  // own dedupe, so "what you'd find by typing" matches "what building would
  // have deduped against".
  const universes = await db.$queryRaw<
    { slug: string; name: string; source: string | null; status: string }[]
  >`
    SELECT slug, name, source, status FROM "Universe"
    WHERE similarity(name, ${q}) > 0.2 OR name ILIKE ${"%" + q + "%"}
    ORDER BY similarity(name, ${q}) DESC
    LIMIT 10
  `;
  return NextResponse.json({ universes });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(100) });

// POST /api/universes { name } — find-or-build. Client polls
// GET /api/universes/[slug] afterward regardless of which status comes back.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "name is required");

  try {
    const outcome = await buildUniverse(parsed.data.name);
    if (outcome.status === "failed") {
      return NextResponse.json({ status: "failed", slug: outcome.slug, reason: outcome.reason });
    }
    return NextResponse.json({
      status: outcome.status === "already_ready" ? "ready" : outcome.status,
      slug: outcome.slug,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "daily build ceiling reached") {
      return apiError(429, "STAN is at capacity for today — try again tomorrow, or play an existing fandom.");
    }
    return apiError(500, "Something went wrong building that universe.");
  }
}
