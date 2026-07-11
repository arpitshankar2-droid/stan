import { extractQuotesAnyFormat, extractHeadingSection, QUOTE_SECTION_NAMES } from "./wikitext";
import type { ScrapedQuote } from "../builder/prompts";

const FETCH_TIMEOUT_MS = 5000;
const PAGE_BUDGET = 25;
const USER_AGENT = "stan-quiz-app/0.1 (contact: arpitshankar2@gmail.com)";
// Category:Characters comes back alphabetically, so a small cap here would
// systematically exclude anyone late in the alphabet (Walter White, Skyler
// White...) before we ever get to check who has a /Quotes page. Collect a
// wide pool cheaply (existence-checking is what's actually expensive) and
// only cap the final character list we hand to the LLM prompt.
const CATEGORY_MEMBER_CEILING = 400;
const PROMPT_CHARACTER_CAP = 80;
const TITLE_BATCH_SIZE = 50; // MediaWiki's per-request cap for titles=
const MAIN_PAGE_FALLBACK_CAP = 60; // characters without a dedicated Quotes page we'll still check

const CHARACTER_CATEGORY_CANDIDATES = ["Category:Characters", "Category:Main Characters"];
const SUBCATEGORY_FANOUT = 6; // when Characters has no direct members, only subcats

export interface ScrapeResult {
  host: string;
  characters: string[];
  quotes: ScrapedQuote[];
  requestsUsed: number;
}

class Budget {
  private used = 0;
  constructor(private readonly max: number) {}
  spend(): void {
    this.used++;
    if (this.used > this.max) throw new Error(`scrape page budget (${this.max}) exceeded`);
  }
  get remaining(): number {
    return this.max - this.used;
  }
  get spent(): number {
    return this.used;
  }
}

async function mwGet(host: string, params: Record<string, string>, budget: Budget): Promise<any> {
  budget.spend();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const qs = new URLSearchParams({ format: "json", ...params });
    const res = await fetch(`https://${host}.fandom.com/api.php?${qs}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function categoryMembers(
  host: string,
  cmtitle: string,
  budget: Budget,
  opts: { namespace?: string; limit: number },
): Promise<{ title: string; ns: number }[]> {
  const members: { title: string; ns: number }[] = [];
  let cmcontinue: string | undefined;

  do {
    if (budget.remaining <= 0) break;
    const data = await mwGet(
      host,
      {
        action: "query",
        list: "categorymembers",
        cmtitle,
        cmlimit: "500",
        ...(opts.namespace ? { cmnamespace: opts.namespace } : {}),
        ...(cmcontinue ? { cmcontinue } : {}),
      },
      budget,
    );
    for (const m of data?.query?.categorymembers ?? []) {
      if (m.title) members.push({ title: m.title, ns: m.ns });
    }
    cmcontinue = data?.continue?.cmcontinue;
  } while (cmcontinue && members.length < opts.limit && budget.remaining > 0);

  return members.slice(0, opts.limit);
}

/**
 * Some wikis (One Piece) file every character into subcategories
 * ("Characters by Type", "Characters by Status"...) and leave the parent
 * Category:Characters with zero direct page members. When that happens,
 * pull page members from a handful of its subcategories instead.
 */
async function listCharacters(host: string, budget: Budget): Promise<string[]> {
  for (const category of CHARACTER_CATEGORY_CANDIDATES) {
    const direct = await categoryMembers(host, category, budget, {
      namespace: "0",
      limit: CATEGORY_MEMBER_CEILING,
    });
    if (direct.length > 0) return [...new Set(direct.map((m) => m.title))];

    if (budget.remaining <= 0) continue;
    const subcats = await categoryMembers(host, category, budget, {
      namespace: "14",
      limit: SUBCATEGORY_FANOUT,
    });
    const names = new Set<string>();
    for (const { title: subcat } of subcats) {
      if (budget.remaining <= 0) break;
      if (names.size >= CATEGORY_MEMBER_CEILING) break;
      const members = await categoryMembers(host, subcat, budget, {
        namespace: "0",
        limit: CATEGORY_MEMBER_CEILING - names.size,
      });
      for (const m of members) names.add(m.title);
    }
    if (names.size > 0) return [...names];
  }
  return [];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Batch-checks which "<Name>/Quotes" subpages actually exist. */
async function findExistingPages(
  host: string,
  titles: string[],
  budget: Budget,
): Promise<Set<string>> {
  const existing = new Set<string>();
  for (const group of chunk(titles, TITLE_BATCH_SIZE)) {
    if (budget.remaining <= 0) break;
    const data = await mwGet(host, { action: "query", titles: group.join("|") }, budget);
    for (const page of Object.values(data?.query?.pages ?? {}) as any[]) {
      if (page.missing === undefined && page.title) existing.add(page.title);
    }
  }
  return existing;
}

/** Batch-fetches wikitext content for a set of page titles. */
async function fetchWikitext(
  host: string,
  titles: string[],
  budget: Budget,
): Promise<Map<string, string>> {
  const content = new Map<string, string>();
  for (const group of chunk(titles, TITLE_BATCH_SIZE)) {
    if (budget.remaining <= 0) break;
    const data = await mwGet(
      host,
      { action: "query", titles: group.join("|"), prop: "revisions", rvprop: "content", rvslots: "main" },
      budget,
    );
    for (const page of Object.values(data?.query?.pages ?? {}) as any[]) {
      const text = page?.revisions?.[0]?.slots?.main?.["*"];
      if (typeof text === "string" && page.title) content.set(page.title, text);
    }
  }
  return content;
}

/**
 * Scrapes real quotes for an already-resolved wiki host. Stays within
 * PAGE_BUDGET requests total; returns whatever it collected even if the
 * budget runs out partway (partial material still beats none — the build
 * pipeline decides whether it's enough to skip the GENERATED fallback).
 *
 * Two rungs, per character: (1) a dedicated "<Name>/Quotes" subpage, or
 * (2) a "Quotes" section on the character's own main page. Whichever
 * wikitext we find, extractQuotesAnyFormat tries the three known Fandom
 * quote conventions (template / bullet-list / speaker-dialogue) in order.
 */
export async function scrapeQuotes(host: string): Promise<ScrapeResult> {
  const budget = new Budget(PAGE_BUDGET);

  const characters = await listCharacters(host, budget);
  if (characters.length === 0) {
    return { host, characters: [], quotes: [], requestsUsed: budget.spent };
  }

  const quotePageTitles = characters.map((c) => `${c}/Quotes`);
  const existingQuotePages = await findExistingPages(host, quotePageTitles, budget);
  const withDedicatedPage = characters.filter((c) => existingQuotePages.has(`${c}/Quotes`));
  const withoutDedicatedPage = characters
    .filter((c) => !existingQuotePages.has(`${c}/Quotes`))
    .slice(0, MAIN_PAGE_FALLBACK_CAP);

  const dedicatedContent = await fetchWikitext(
    host,
    withDedicatedPage.map((c) => `${c}/Quotes`),
    budget,
  );
  const mainPageContent =
    budget.remaining > 0 ? await fetchWikitext(host, withoutDedicatedPage, budget) : new Map();

  const quotes: ScrapedQuote[] = [];

  for (const character of withDedicatedPage) {
    const wikitext = dedicatedContent.get(`${character}/Quotes`);
    if (!wikitext) continue;
    for (const { text, context } of extractQuotesAnyFormat(wikitext, character)) {
      quotes.push({ quote: text, speaker: character, page: context });
    }
  }

  for (const character of withoutDedicatedPage) {
    const wikitext = mainPageContent.get(character);
    if (!wikitext) continue;
    const section = extractHeadingSection(wikitext, QUOTE_SECTION_NAMES);
    if (!section) continue;
    for (const { text, context } of extractQuotesAnyFormat(section, character)) {
      quotes.push({ quote: text, speaker: character, page: context });
    }
  }

  // Characters with usable quotes are the ones worth telling the LLM about
  // first — fill remaining prompt slots from the wider pool for context.
  const quoted = [...new Set(quotes.map((q) => q.speaker).filter((s): s is string => !!s))];
  const rest = characters.filter((c) => !quoted.includes(c));
  const promptCharacters = [...quoted, ...rest].slice(0, PROMPT_CHARACTER_CAP);

  return { host, characters: promptCharacters, quotes, requestsUsed: budget.spent };
}
