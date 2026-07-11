/**
 * Fandom's cross-wiki search (`www.fandom.com/api/v1/...`,
 * `community.fandom.com/api/v1/...`) is Cloudflare-gated — server-side
 * requests get a bot-challenge page, not JSON, on every route we tried
 * (verified against both the JSON search API and the HTML Special:Search
 * page). Individual wiki subdomains' own `api.php` are wide open, though,
 * and Fandom aliases some subdomains internally (guessing "startrek" lands
 * cleanly on the real "memory-alpha" wiki's siteinfo).
 *
 * So resolution is a slug-guess ladder against `<slug>.fandom.com/api.php`,
 * verified by a relevance check against the returned sitename — not a real
 * search. This is a deliberate deviation from PLAN.md's original "unified
 * search API" step; see PROGRESS.md Task 4 entry.
 */

const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT = "stan-quiz-app/0.1 (contact: arpitshankar2@gmail.com)";

export interface ResolvedWiki {
  host: string;
  sitename: string;
  mainpage: string;
}

// Fandom subdomains that don't follow the naive slugify pattern.
const CURATED_ALIASES: Record<string, string> = {
  "star trek": "memory-alpha",
  "harry potter": "harrypotter",
  "star wars": "starwars",
  "the office": "theoffice",
  "one piece": "onepiece",
  "breaking bad": "breakingbad",
  "bojack horseman": "bojackhorseman",
  naruto: "naruto",
  friends: "friends-tv",
  "rick and morty": "rickandmorty",
  "game of thrones": "gameofthrones",
  "brooklyn nine-nine": "brooklyn99",
  "marvel cinematic universe": "marvelcinematicuniverse",
  "attack on titan": "attackontitan",
  "spongebob squarepants": "spongebob",
  "taylor swift": "taylorswift",
};

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "&"]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function significantTokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Ordered, deduplicated slug guesses — most likely first. */
export function candidateSlugs(query: string): string[] {
  const norm = normalize(query);
  const tokens = norm.split(" ").filter(Boolean);
  const withoutStopwords = tokens.filter((t) => !STOPWORDS.has(t));

  const candidates = [
    CURATED_ALIASES[norm],
    tokens.join(""), // "the office" -> "theoffice"
    withoutStopwords.join(""), // "the office" -> "office"
    tokens.join("-"), // "rick and morty" -> "rick-and-morty"
    withoutStopwords.join("-"),
  ].filter((s): s is string => !!s && s.length > 1);

  return [...new Set(candidates)];
}

/** Does the resolved wiki's own name plausibly match what was asked for? */
function isRelevant(query: string, sitename: string): boolean {
  const queryTokens = new Set(significantTokens(query));
  const nameTokens = new Set(significantTokens(sitename));
  if (queryTokens.size === 0) return false;
  let overlap = 0;
  for (const t of queryTokens) if (nameTokens.has(t)) overlap++;
  return overlap / queryTokens.size >= 0.5;
}

async function fetchSiteinfo(host: string): Promise<{ sitename: string; mainpage: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://${host}.fandom.com/api.php?action=query&meta=siteinfo&format=json`,
      { headers: { "User-Agent": USER_AGENT }, signal: controller.signal },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const general = data?.query?.general;
    if (!general?.sitename || !general?.mainpage) return null;
    return { sitename: general.sitename, mainpage: general.mainpage };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries each candidate slug in order, first relevance-passing hit wins.
 * Returns null (not undefined) so callers can distinguish "no wiki found"
 * from "haven't checked yet" and fall through to the GENERATED prompt path.
 */
export async function resolveWiki(query: string): Promise<ResolvedWiki | null> {
  for (const slug of candidateSlugs(query)) {
    const info = await fetchSiteinfo(slug);
    if (info && isRelevant(query, info.sitename)) {
      return { host: slug, sitename: info.sitename, mainpage: info.mainpage };
    }
  }
  return null;
}
