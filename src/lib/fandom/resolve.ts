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

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "&"]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Fandom subdomains that don't follow the naive slugify pattern, or whose
// wikis have a stylized brand name sharing no literal overlap with the
// query ("Wookieepedia" for Star Wars, "Wiki of Westeros" for Game of
// Thrones) — isRelevant() would reject those on text grounds alone, so a
// curated entry is trusted directly and skips that check entirely (see
// resolveWiki). Keys are run through normalize() at lookup time, so write
// them in plain words — punctuation (e.g. a hyphen in "nine-nine") would
// never match, since normalize() turns it into a space before lookup.
const CURATED_ALIASES_RAW: Record<string, string> = {
  "star trek": "memory-alpha",
  "the office": "theoffice",
  "one piece": "onepiece",
  "breaking bad": "breakingbad",
  "bojack horseman": "bojackhorseman",
  "rick and morty": "rickandmorty",
  "game of thrones": "gameofthrones",
  "brooklyn nine nine": "brooklyn99",
  "marvel cinematic universe": "marvelcinematicuniverse",
  "attack on titan": "attackontitan",
  "spongebob squarepants": "spongebob",
  "star wars": "starwars",
  seinfeld: "seinfeld",
  "harry potter": "harrypotter",
};
const CURATED_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(CURATED_ALIASES_RAW).map(([k, v]) => [normalize(k), v]),
);

function curatedAlias(query: string): string | undefined {
  return CURATED_ALIASES[normalize(query)];
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

/**
 * Does the resolved wiki's own name plausibly match what was asked for?
 * Token-set overlap alone misses "Naruto" vs "Narutopedia" — same word,
 * fused with a suffix — so each query token also gets a substring check
 * against the full normalized sitename.
 */
function isRelevant(query: string, sitename: string): boolean {
  const queryTokens = new Set(significantTokens(query));
  const nameTokens = new Set(significantTokens(sitename));
  const normalizedName = normalize(sitename);
  if (queryTokens.size === 0) return false;
  let overlap = 0;
  for (const t of queryTokens) {
    if (nameTokens.has(t) || (t.length >= 4 && normalizedName.includes(t))) overlap++;
  }
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
 * A curated alias is trusted directly, bypassing the relevance check — it
 * exists specifically for wikis with stylized brand names ("Wookieepedia")
 * that would otherwise fail text-based relevance no matter how correct the
 * mapping is. Guessed candidates still need to pass isRelevant(), since
 * those are unverified and a false positive would silently scrape the
 * wrong fandom.
 */
export async function resolveWiki(query: string): Promise<ResolvedWiki | null> {
  const alias = curatedAlias(query);
  if (alias) {
    const info = await fetchSiteinfo(alias);
    if (info) return { host: alias, sitename: info.sitename, mainpage: info.mainpage };
  }

  for (const slug of candidateSlugs(query)) {
    if (slug === alias) continue;
    const info = await fetchSiteinfo(slug);
    if (info && isRelevant(query, info.sitename)) {
      return { host: slug, sitename: info.sitename, mainpage: info.mainpage };
    }
  }
  return null;
}
