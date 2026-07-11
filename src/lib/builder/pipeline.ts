import crypto from "node:crypto";
import { db } from "@/lib/db";
import { resolveWiki } from "@/lib/fandom/resolve";
import { scrapeQuotes } from "@/lib/fandom/scrape";
import { generateStructured } from "@/lib/gemini";
import { universeResponseSchema, parseUniversePayload } from "@/lib/builder/schema";
import { buildFromScrapedPrompt, buildGeneratedPrompt } from "@/lib/builder/prompts";
import { buildsRemainingToday } from "@/lib/builder/budget";
import type { QuoteSource, Universe } from "@prisma/client";
import type { ScrapedQuote } from "@/lib/builder/prompts";

// Below this many usable scraped quotes, the wiki is "thin" — go straight to
// the generation prompt rather than asking the LLM to top up a handful of
// real lines (see PLAN.md step 5).
const SCRAPE_THIN_THRESHOLD = 15;
const STALE_BUILDING_MS = 3 * 60 * 1000;
// A wiki that dedicates unusual depth to one character (a prolific
// dedicated Quotes page, or — as found seeding Breaking Bad — a shared wiki
// where a spinoff's cast simply has more cataloged dialogue) can otherwise
// flood the LLM's candidate material and crowd out the show's actual leads
// by sheer volume. Capping per-speaker input forces the selection to happen
// in the LLM's judgment, not by whoever's page happened to be longest.
const MAX_QUOTES_PER_SPEAKER = 8;

function capPerSpeaker(quotes: ScrapedQuote[], max: number): ScrapedQuote[] {
  const counts = new Map<string, number>();
  return quotes.filter((q) => {
    const key = q.speaker ?? "";
    const count = counts.get(key) ?? 0;
    if (count >= max) return false;
    counts.set(key, count + 1);
    return true;
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function quoteHash(quote: string): string {
  const normalized = quote.toLowerCase().replace(/\s+/g, " ").trim();
  return crypto.createHash("sha1").update(normalized).digest("hex");
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface BuildOutcome {
  status: "ready" | "already_ready" | "building" | "failed";
  universeId: string;
  slug: string;
  reason?: string;
}

/** slug -> aliases -> pg_trgm name similarity, in that order of confidence. */
async function findExistingUniverse(name: string, slug: string): Promise<Universe | null> {
  const bySlug = await db.universe.findUnique({ where: { slug } });
  if (bySlug) return bySlug;

  const byAlias = await db.universe.findFirst({ where: { aliases: { has: slug } } });
  if (byAlias) return byAlias;

  const trgm = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Universe"
    WHERE similarity(name, ${name}) > 0.4
    ORDER BY similarity(name, ${name}) DESC
    LIMIT 1
  `;
  if (trgm.length > 0) return db.universe.findUnique({ where: { id: trgm[0].id } });

  return null;
}

/**
 * Entry point: normalize + match an existing universe, or lock a new row
 * and build it. Concurrent requests for the same fandom find the BUILDING
 * row (unique slug) and poll rather than double-spending a Gemini call.
 */
export async function buildUniverse(query: string): Promise<BuildOutcome> {
  const slug = slugify(query);
  if (!slug) throw new Error("query produced an empty slug");

  const existing = await findExistingUniverse(query, slug);
  if (existing) {
    if (existing.status === "READY") {
      return { status: "already_ready", universeId: existing.id, slug: existing.slug };
    }
    if (existing.status === "BUILDING") {
      const age = Date.now() - existing.updatedAt.getTime();
      if (age < STALE_BUILDING_MS) {
        return { status: "building", universeId: existing.id, slug: existing.slug };
      }
      // stale — treat as abandoned, retry on the same row below
    }
    return runBuild(existing.id, existing.slug, query);
  }

  const remaining = await buildsRemainingToday();
  if (remaining <= 0) throw new Error("daily build ceiling reached");

  let created: Universe;
  try {
    created = await db.universe.create({ data: { slug, name: query, status: "BUILDING" } });
  } catch {
    // Unique constraint race: another request just created this slug.
    const race = await db.universe.findUnique({ where: { slug } });
    if (race) return { status: "building", universeId: race.id, slug: race.slug };
    throw new Error(`failed to create or find universe for slug "${slug}"`);
  }

  return runBuild(created.id, created.slug, query);
}

async function runBuild(universeId: string, slug: string, displayName: string): Promise<BuildOutcome> {
  try {
    await db.universe.update({ where: { id: universeId }, data: { status: "BUILDING", failReason: null } });

    const wiki = await resolveWiki(displayName);
    const scrape = wiki ? await scrapeQuotes(wiki.host) : null;
    const usableQuotes = capPerSpeaker(
      (scrape?.quotes ?? []).filter((q) => q.quote.length >= 4),
      MAX_QUOTES_PER_SPEAKER,
    );

    const prompt =
      usableQuotes.length >= SCRAPE_THIN_THRESHOLD
        ? buildFromScrapedPrompt(displayName, usableQuotes, scrape!.characters)
        : buildGeneratedPrompt(displayName);

    const payload = await generateStructured({
      prompt,
      responseSchema: universeResponseSchema,
      parse: parseUniversePayload,
    });

    const rows = payload.questions.map((q) => ({
      universeId,
      quote: q.quote,
      answer: q.answer,
      options: shuffle([q.answer, ...q.distractors]),
      difficulty: q.difficulty,
      source: (q.fromProvided ? "SCRAPED" : "GENERATED") as QuoteSource,
      context: q.context ?? null,
      quoteHash: quoteHash(q.quote),
    }));

    const seen = new Set<string>();
    const deduped = rows.filter((r) => (seen.has(r.quoteHash) ? false : (seen.add(r.quoteHash), true)));

    const scrapedCount = deduped.filter((r) => r.source === "SCRAPED").length;
    const overallSource: QuoteSource =
      scrapedCount === 0 ? "GENERATED" : scrapedCount === deduped.length ? "SCRAPED" : "MIXED";

    await db.$transaction([
      db.question.deleteMany({ where: { universeId } }), // clean slate on a stale/failed retry
      db.question.createMany({ data: deduped }),
      db.universe.update({
        where: { id: universeId },
        data: {
          name: payload.name,
          aliases: payload.aliases,
          characters: payload.characters,
          tiers: payload.tiers,
          source: overallSource,
          status: "READY",
          failReason: null,
        },
      }),
    ]);

    return { status: "ready", universeId, slug };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await db.universe.update({ where: { id: universeId }, data: { status: "FAILED", failReason: reason } });
    return { status: "failed", universeId, slug, reason };
  }
}
