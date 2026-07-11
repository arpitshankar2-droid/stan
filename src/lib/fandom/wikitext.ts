/**
 * Minimal wikitext cleaner. We only ever need to pull {{Quote|...}} template
 * payloads out of a page and strip markup from the text — not render
 * wikitext generally, so this stays deliberately small rather than pulling
 * in a full wikitext parser.
 */

export interface ParsedQuoteTemplate {
  text: string;
  context?: string;
}

/** [[Target|Display]] -> Display, [[Target]] -> Target */
function stripLinks(s: string): string {
  return s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, display) => display ?? target);
}

/** ''italic'' / '''bold''' / <small>...</small> / <br/> / HTML comments */
function stripFormatting(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/'''''|'''|''/g, "")
    .replace(/<\/?small>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\{\{crossref\|([^}]*)\}\}/gi, "") // episode-reference footnotes, not part of the line
    .replace(/\s+/g, " ")
    .trim();
}

/** Some wikis wrap quote text in literal "..." on top of wiki markup — redundant once we render our own quote styling. */
function stripRedundantOuterQuotes(s: string): string {
  const trimmed = s.trim();
  const match = /^["“]([\s\S]+)["”]$/.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

export function cleanQuoteFragment(raw: string): string {
  return stripRedundantOuterQuotes(stripFormatting(stripLinks(raw)));
}

/**
 * Splits a template's argument string on top-level `|` only — respecting
 * nesting from {{...}} and [[...]] so links/templates inside an argument
 * don't get sliced apart.
 */
function splitTemplateArgs(inner: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      current += two;
      i++;
      continue;
    }
    if (two === "}}" || two === "]]") {
      depth--;
      current += two;
      i++;
      continue;
    }
    if (inner[i] === "|" && depth === 0) {
      args.push(current);
      current = "";
      continue;
    }
    current += inner[i];
  }
  args.push(current);
  return args;
}

/**
 * Extracts every {{Quote|text|context|episode}} template from a page's
 * wikitext. Deliberately ignores {{Dialogue|...}} and other templates —
 * multi-speaker exchanges don't map to a single attributable line.
 */
export function extractQuoteTemplates(wikitext: string): ParsedQuoteTemplate[] {
  const results: ParsedQuoteTemplate[] = [];
  const marker = /\{\{\s*Quote\s*\|/gi;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(wikitext))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < wikitext.length && depth > 0) {
      const two = wikitext.slice(i, i + 2);
      if (two === "{{") {
        depth++;
        i += 2;
        continue;
      }
      if (two === "}}") {
        depth--;
        i += 2;
        continue;
      }
      i++;
    }
    const inner = wikitext.slice(start, i - 2);
    const args = splitTemplateArgs(inner);
    const text = cleanQuoteFragment(args[0] ?? "");
    const context = args[1] ? cleanQuoteFragment(args[1]) : undefined;
    if (text.length >= 4) results.push({ text, context });
    marker.lastIndex = i;
  }

  return results;
}

/**
 * `* "Quote text" - context` or `* ''Quote text'' - context` — the other
 * common way Fandom wikis list quotes on a character page or dedicated
 * Quotes subpage (e.g. Dunderpedia's "The Office" wiki).
 */
export function extractBulletQuotes(wikitext: string): ParsedQuoteTemplate[] {
  const results: ParsedQuoteTemplate[] = [];
  for (const rawLine of wikitext.split("\n")) {
    const trimmed = rawLine.trim();
    // The leading "*" is required, not optional — without it, a bare
    // ''italicized'' line (which some wikis use for stage directions, not
    // quotes) would otherwise match the same pattern and be mistaken for a
    // bulleted quote. See BoJack Horseman Wiki's Quotes page, which
    // interleaves ''[scene description]'' narration between real bulleted
    // and dialogue-style quotes.
    if (!trimmed.startsWith("*")) continue;
    const body = trimmed.replace(/^\*+\s*/, "");
    const match = /^(?:"([^"]{4,})"|''([^']{4,})'')\s*(?:[-–—]\s*(.+))?$/.exec(body);
    if (!match) continue;
    const text = cleanQuoteFragment(match[1] ?? match[2] ?? "");
    const context = match[3] ? cleanQuoteFragment(match[3]) : undefined;
    if (text.length >= 4) results.push({ text, context });
  }
  return results;
}

/**
 * `: '''Speaker''': line` — a script-style exchange format some wikis use
 * on their Quotes page (e.g. BoJack Horseman Wiki). Only lines cleanly
 * bolded with exactly `'''...'''` are trusted; anything with mixed/broken
 * markup is skipped rather than risk emitting a garbled quote.
 */
export function extractSpeakerDialogue(wikitext: string, speakerName: string): ParsedQuoteTemplate[] {
  const results: ParsedQuoteTemplate[] = [];
  const target = speakerName.trim().toLowerCase();
  // Two conventions show up on the same page in the wild: colon outside the
  // bold ('''Name''': text) and colon inside it ('''Name: '''text).
  const patterns = [/^'''([^':]+)'''\s*:\s*(.+)$/, /^'''([^':]+):\s*'''\s*(.+)$/];
  for (const rawLine of wikitext.split("\n")) {
    const line = rawLine.trim().replace(/^:+\s*/, "");
    const match = patterns.map((p) => p.exec(line)).find((m): m is RegExpExecArray => m !== null);
    if (!match) continue;
    const label = match[1].trim().toLowerCase();
    // A character's own Quotes page often calls them by their short name in
    // dialogue labels ("BoJack") while the character list uses the full
    // name ("BoJack Horseman") — substring match in either direction
    // instead of requiring exact equality.
    if (!label.includes(target) && !target.includes(label)) continue;
    const text = cleanQuoteFragment(match[2]);
    if (text.length >= 4) results.push({ text });
  }
  return results;
}

/**
 * Line-based extraction of a `==Heading==` section's body (any level),
 * stopping at the next heading of equal-or-shallower level. Used to pull a
 * "Quotes" section out of a character's main page when there's no dedicated
 * subpage.
 */
export function extractHeadingSection(wikitext: string, headingNames: string[]): string | null {
  const wanted = new Set(headingNames.map((h) => h.toLowerCase()));
  const collected: string[] = [];
  let collecting = false;
  let sectionLevel = 0;

  for (const line of wikitext.split("\n")) {
    const heading = /^(=+)\s*(.+?)\s*\1\s*$/.exec(line.trim());
    if (heading) {
      const level = heading[1].length;
      if (collecting && level <= sectionLevel) collecting = false;
      if (!collecting && wanted.has(heading[2].trim().toLowerCase())) {
        collecting = true;
        sectionLevel = level;
      }
      continue;
    }
    if (collecting) collected.push(line);
  }

  return collected.length > 0 ? collected.join("\n") : null;
}

// Some wikis' "Quotes" pages mix in scene-recap prose alongside real
// dialogue, using the exact same formatting (e.g. BoJack Horseman Wiki's
// `: '''Character''': <what happens next>` sections describing an episode
// beat, not a spoken line). "<Proper Noun(s)> <physical-action verb>..." at
// the very start of a line is the recap-prose signature — real dialogue
// essentially never opens that way.
const NARRATION_VERB_STEMS = new Set([
  "walk", "sit", "stand", "shut", "groan", "coo", "sign", "pick", "look", "set", "grab",
  "pull", "open", "close", "turn", "answer", "enter", "leave", "approach", "chase", "go",
  "get", "take", "circle", "sees", "smile", "nod", "point", "hug", "kiss", "cry",
]);

function looksLikeNarration(text: string): boolean {
  const trimmed = text.trim();
  if (/\b(is seen|are seen|can be seen)\b/i.test(trimmed)) return true;
  const match = /^([A-Z][a-z']*(?:\s+(?:and\s+)?[A-Z][a-z']*)*)\s+(\w+)/.exec(trimmed);
  if (!match) return false;
  const stem = match[2].toLowerCase().replace(/(ed|s)$/, "");
  return NARRATION_VERB_STEMS.has(stem);
}

const QUOTE_SECTION_NAMES = ["Quotes", "Memorable Quotes", "Notable Quotes", "Quotations"];

/**
 * Runs every extraction strategy against a blob of wikitext (a dedicated
 * Quotes page, or a Quotes section sliced from a main page) and returns the
 * first strategy that finds anything — formats don't mix within one wiki's
 * convention, so there's no value in merging partial hits across strategies.
 */
export function extractQuotesAnyFormat(wikitext: string, speakerName: string): ParsedQuoteTemplate[] {
  const filterNarration = (items: ParsedQuoteTemplate[]) => items.filter((q) => !looksLikeNarration(q.text));

  const templates = filterNarration(extractQuoteTemplates(wikitext));
  if (templates.length > 0) return templates;

  const bullets = filterNarration(extractBulletQuotes(wikitext));
  if (bullets.length > 0) return bullets;

  return filterNarration(extractSpeakerDialogue(wikitext, speakerName));
}

export { QUOTE_SECTION_NAMES };
