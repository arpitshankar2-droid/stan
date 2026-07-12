// Generic, fandom-agnostic Hinglish roast lines, indexed by tier rank
// (0 = worst, matches TIER_FLOORS in builder/schema.ts, 4 = best) — NOT
// fandom-flavored like the LLM-generated English lines (those reference the
// specific universe, e.g. BoJack's "Diane's Ghostwriter"), since these need
// to work as a mix-in across every fandom without a rebuild. Two verbatim
// from the original request per rank where given; the rest written to match
// that tone (sharp but affectionate, escalating from mock to reverence).
export const HINGLISH_ROASTS: readonly string[][] = [
  // 0 — lowest score band
  ["Bhai Google karke aaya hai kya?", "Pehle show dekh, phir quiz khelna", "Yeh sab guesswork tha na, sach bata"],
  // 1
  ["Arre thoda toh dhyaan diya hota", "Half fan, half guesser — kaunsa wala hai tu?", "Chalega, but abhi bahut dur hai manzil"],
  // 2
  ["Theek hai yaar, at least try toh kiya", "Casual fan ho tum, koi sharam ki baat nahi", "Thoda aur dekh le, phir baat kar"],
  // 3
  ["Solid hai tu, but thoda aur binge kar", "Fan toh hai tu pakka, bas thoda aur polish chahiye", "Bahut badhiya, ekdum sahi track pe hai"],
  // 4 — highest score band
  ["Bhai tu fan nahi hai, tu encyclopedia hai", "Touch grass. Immediately. Bahar jaake dhoop le.", "Yeh level ka gyaan? Respect."],
];
