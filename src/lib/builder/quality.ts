function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A quote that contains the answer's own name gives the answer away in the
 * text itself ("I am Sasuke Uchiha" with Sasuke as the correct answer isn't
 * a quiz question). Checks each significant (>=3 char) token of the answer
 * against the quote via word-boundary, case-insensitive matching — not a
 * raw substring, so an answer like "Al" doesn't false-positive on
 * "practical". Only checks the ANSWER's own name, not other characters
 * mentioned in the line, so a line addressed *to* someone by name is fine —
 * this only catches a speaker naming themselves.
 */
export function quoteRevealsAnswer(quote: string, answer: string): boolean {
  const tokens = answer
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  return tokens.some((t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, "i").test(quote));
}

// Deliberately conservative — this is a heuristic, not a reliable judge of
// "genericness" the way quoteRevealsAnswer is a reliable string check.
// Only targets short lines matching known filler/greeting/reaction
// patterns, gated by a low word count so it can't accidentally nuke a
// longer, genuinely distinctive line that happens to start with "Hi".
const GENERIC_PATTERNS = [
  /^(hi|hey|hello|yo|sup)\b/i,
  /^(yes|no|okay|ok|sure|maybe|whatever|fine|really|wow|oh|huh|what)[.!?]*$/i,
];
const GENERIC_MAX_WORDS = 6;

export function isGenericQuote(quote: string): boolean {
  const trimmed = quote.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > GENERIC_MAX_WORDS) return false;
  return GENERIC_PATTERNS.some((re) => re.test(trimmed));
}
