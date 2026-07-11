import { QUESTION_TARGET } from "./schema";

export interface ScrapedQuote {
  quote: string;
  speaker?: string;
  page?: string;
}

const RULES = `
You are building the complete question bank for STAN, a "who said this?" quiz game for fandoms.

QUESTIONS — produce ${QUESTION_TARGET} multiple-choice questions (never fewer than 40 unless the
material genuinely cannot support it):
- "quote" is a verbatim line from the fandom, trimmed, without surrounding quotation marks.
- "answer" is the character/person who actually said it. Use the name fans use ("Jesse Pinkman", not "Jesse Bruce Pinkman").
- "distractors" are exactly 3 OTHER characters from this same universe who could plausibly have
  said the line — same scene, similar voice, or fan-confusable — but definitively did not.
  Never include the answer among distractors. Never use characters from outside this fandom.
- "difficulty": 1 = iconic catchphrase any casual fan knows; 2 = memorable line a genuine fan
  places; 3 = deep cut — one-off lines, minor characters, early/late seasons. Aim for roughly
  18 easy / 22 medium / 15 hard.
- "context" is one short, spoiler-light locator shown AFTER the player answers
  ("season 2 finale", "from the bridge of the Going Merry", "opening track, 1989").
  It must never hint at or contain the answer.
- No duplicate or near-duplicate quotes. No quotes so generic that several answers would be
  fair ("Let's go!"). Every question must have exactly one defensible answer.

TIERS — exactly 5 fan tiers, ordered WORST fan to BEST fan:
- "name": short, punchy, steeped in this fandom's in-jokes (a place, an insult, a rank, a
  running gag from the universe itself). Not generic ("Novice", "Expert" = failure).
- "lines": 3 alternative result-card lines for that tier, second person, max 140 characters.
  Tone: sharp but affectionate group-chat banter — it should sting enough to screenshot and
  stay safe to send anywhere. Cut with the fandom's own references. Bottom tiers roast the
  player's fake-fan status; top tiers crown them with absurd swagger. No emoji, no hashtags.

ALSO:
- "name": the canonical display name of the fandom.
- "aliases": up to 12 lowercase alternate names people would type to find it
  (abbreviations, character names used as shorthand, common misspellings).
- "characters": the main speaking cast (every answer and distractor must appear in this list).

Output strictly as JSON matching the response schema.`;

/** Build prompt when we have scraped material: validate + select, top up if thin. */
export function buildFromScrapedPrompt(
  fandom: string,
  quotes: ScrapedQuote[],
  characters: string[],
): string {
  const material = quotes
    .map((q) => `- ${JSON.stringify(q.quote)}${q.speaker ? ` — ${q.speaker}` : ""}${q.page ? ` [${q.page}]` : ""}`)
    .join("\n");
  const cast = characters.length > 0 ? characters.join(", ") : "(derive from the material)";

  return `${RULES}

FANDOM: ${fandom}

SCRAPED CANDIDATE QUOTES (from the fandom's wiki — treat as primary source material):
${material}

KNOWN CHARACTERS: ${cast}

Instructions for this fandom:
1. Prefer the scraped quotes above. Validate each: fix mangled formatting, correct the speaker
   if the wiki's attribution is clearly wrong, and DISCARD any quote that is ambiguous,
   misattributed, not a spoken line (stage directions, descriptions), or too generic.
   Mark these questions "fromProvided": true.
2. If fewer than ${QUESTION_TARGET} scraped quotes survive validation, top up with famous real
   quotes from this fandom that you are highly confident are verbatim (or near-verbatim) and
   correctly attributed. Mark those "fromProvided": false. Iconic beats obscure when generating.`;
}

/** Fallback prompt when the wiki was too thin to scrape. */
export function buildGeneratedPrompt(fandom: string): string {
  return `${RULES}

FANDOM: ${fandom}

There is no scraped material for this fandom. Generate the full bank yourself:
- Only use quotes you are highly confident are real, verbatim (or near-verbatim), and correctly
  attributed. Famous, fan-beloved lines first; never invent a line that sounds plausible.
- Mark every question "fromProvided": false.
- If this fandom is too obscure to produce at least 40 confident real quotes, produce the number
  you can stand behind rather than inventing filler.`;
}
