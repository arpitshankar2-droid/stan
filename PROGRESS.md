# STAN — Progress

Rule: every completed task gets a checkbox flip here **and a git commit**. No batching.

## Status: in progress — plan approved 2026-07-11

- [x] 0. Repo bootstrap — git init, PLAN.md, PROGRESS.md, first commit
- [x] 1. Scaffold — Next 15 + TS + Tailwind + shadcn + Framer Motion, Neon Arena tokens
- [x] 2. Database — Prisma schema, Neon wiring (pooled + direct), pg_trgm migration
- [x] 3. Gemini client — structured-output helper, zod schemas, budget gate, prompts
- [x] 4. Fandom scraper — wiki resolve, strategy-ladder quote scrape, wikitext cleaner
- [x] 5. Build pipeline — scrape→LLM→persist, lock, fallback, seed script (batch-1: 3 dev universes)
- [x] 6. API routes — universes search/create/status, results grade/get, quiz selection
- [x] 7. Home page — hero, search + suggestions, universe wall
- [ ] 8. Build theater — polling screen, rotating status lines, fail/retry
- [ ] 9. Quiz UI — QuestionCard, 15s TimerRing, StreakMeter, reveals, interstitials
- [ ] 10. Result reveal — tiers, name prompt, FighterCard with roast
- [ ] 11. OG image — next/og card for link previews
- [ ] 12. Challenge flow — /c/[id], fresh-set quiz, VS compare
- [ ] 13. MCP server — /api/mcp via mcp-handler, 6 tools, docs/mcp.md
- [ ] 14. Polish — motion, empty/error states, a11y, reduced-motion
- [ ] 15. Ship — GitHub + Vercel + prod migration + seed 15 fandoms + prod smoke test

## Log

- **2026-07-12** — Task 7 done. `src/lib/source-badge.ts` (shared `SCRAPED`→"Verified
  Quotes"/cyan, `MIXED`→"Mostly Verified"/violet, `GENERATED`→"AI-Generated"/gold label+style
  map, reused as-is on the quiz screen in Task 9 per the quoteSource honesty requirement — a
  GENERATED universe is styled as a caution, not a neutral third badge). `UniverseWall.tsx`
  (server component, typography-first cards — no icons/emoji, the fandom name *is* the visual
  identity, rendered large in the gradient display face — with the source badge always visible
  under the name, never hidden behind a tooltip). `FandomSearch.tsx` (client component:
  debounced (250ms) hits to `GET /api/universes?q=`, dropdown filtered to `READY` matches only
  so a stale `BUILDING`/`FAILED` row is never offered as if playable, a "Build "<query>"" row
  when no exact match exists, `POST /api/universes` → redirect to `/play/[slug]` on success,
  inline error text — not a dead-end redirect — on 429/failed). `page.tsx` rewritten as an async
  Server Component querying `db.universe.findMany` directly for the wall (no self-fetch over
  HTTP). `tsc --noEmit` clean (repo's `eslint.config.mjs` is separately broken — points at
  `eslint-config-next/core-web-vitals` instead of the `.js`-suffixed export path shipped by the
  installed version; pre-existing, unrelated to this task, not fixed here).
  Live-tested against the dev server and the real seeded DB (not just typechecked):
  - SSR output for `/` confirmed correct for all 3 seeded universes — Breaking Bad and The
    Office both render "Mostly Verified" (their true `MIXED` source), BoJack Horseman renders
    "Verified Quotes" (`SCRAPED`) — badges aren't just present, they match the real DB value.
  - **`npm run build` caught a real bug dev mode hid**: Next prerendered `/` as static
    (`○`) content. Since the wall reads live DB state, every visitor would have gotten the
    same frozen snapshot from build time until the next deploy — a newly-built fandom would
    never appear without a redeploy. Fixed with `export const dynamic = "force-dynamic"`;
    rebuilt and confirmed `/` now shows `ƒ` (server-rendered per request).
  - `/play/breaking-bad` correctly 404s (that route is Task 8/9, not built yet) with no crash.
  - **Known gap, called out rather than papered over**: no browser automation tool (Playwright/
    Puppeteer) is available in this environment, so the interactive search flow — typing,
    the debounced dropdown appearing, keyboard/click selection, the build-CTA POST round trip —
    was verified by code review and by confirming its dependencies (the `/api/universes` GET/
    POST routes) independently in Task 6, not by actually driving it in a browser. Flagging
    this explicitly per the "say so, don't claim success" rule rather than asserting the click
    path works.
- **2026-07-12** — Task 6 done. `src/lib/http.ts` (`apiError` helper), `src/lib/quiz/select.ts`
  (`selectQuizQuestions`: 3/4/3 easy/mid/hard curve, excluded-id set only used as a last-resort
  fallback so challenge quizzes get a genuinely fresh set when the bank supports it), `grade.ts`
  (server-side grading — client never sees `answer` pre-submission — plus streak tracking),
  `tiers.ts` (`pickTier`, zod-validates the universe's stored `tiers` JSON and picks a random
  line from the matched tier). Routes: `GET/POST /api/universes` (wall + pg_trgm fuzzy search +
  find-or-build), `GET /api/universes/[slug]` (status + quiz payload), `POST /api/results`
  (grade + persist), `GET /api/results/[id]` (result + resolved challenge parent).
  `tsc --noEmit` was clean, but per this project's now-established pattern that typechecking
  doesn't catch real bugs, ran the dev server against the live seeded DB (Breaking Bad,
  BoJack Horseman, The Office) before calling it done — and it didn't start clean:
  - **Every DB-touching route 500'd**: `[TypeError: bufferUtil.mask is not a function]`. Root
    cause: `ws` (used by `@neondatabase/serverless` for its WebSocket transport) probes for its
    optional native accelerators (`bufferutil`/`utf-8-validate`) at require-time; those packages
    aren't installed, but Next's webpack bundler was resolving them to empty stub modules
    instead of leaving them unresolved, so `ws` believed the accelerator was present and called
    a method the stub doesn't have. Fixed by adding `config.externals.push("bufferutil",
    "utf-8-validate")` to `next.config.ts`'s webpack config, which lets Node's real module
    resolution (correctly) fail to find them so `ws` falls back to its pure-JS path.
  - With that fixed, live-verified every surface: wall listing, pg_trgm fuzzy search (including
    typo tolerance, e.g. "bojak" → BoJack Horseman), no-match returns `[]`; quiz payload for all
    3 seeded universes returns exactly 10 questions with the `answer` field genuinely absent
    from the wire payload and the difficulty distribution confirmed `{1:3, 2:4, 3:3}` against
    the live DB; `exclude` param against BoJack's 210-question bank produced a second 10-question
    set with zero id overlap against the first; grading verified against a hand-constructed
    8-correct/2-wrong submission (server returned `score: 8, bestStreak: 8` exactly), and a
    chained challenge submission correctly resolved its `parent` with the first result's full
    data; 400 on a malformed submission, 404 on an unknown slug/result id; `BUILDING`/`FAILED`/
    `READY` status branches all verified by toggling a universe's status directly in the DB and
    reverting; POST dedupe path for an already-READY universe returns in <1s (no rebuild).
- **2026-07-11** — Task 5 done: `src/lib/builder/pipeline.ts` (normalize/match → lock via
  BUILDING row → resolve → scrape → LLM → persist, stale-BUILDING retry, FAILED+reason on any
  error) and `scripts/seed-universes.ts`. Seeding batch 1 for real surfaced problems no amount
  of typechecking would have caught:
  - **Gemini API rejected the tightened response schema outright** (400 "constraint... too many
    states for serving") — the earlier "restructure for reliability" pass (minItems/maxItems/
    minimum/maximum nested inside a ~70-item array) had only ever been typechecked, never
    actually called. Reverted `universeResponseSchema` to a loose shape; real validation lives
    entirely in `parseUniversePayload`'s per-item zod checks, which was always the right layer
    for it.
  - **Cast representation was badly skewed on first successful run**: Walter White answered
    2/129 Breaking Bad questions, Jesse Pinkman zero; BoJack Horseman's own title character
    answered 6/62 while an obscure character led at 20. Root cause: nothing told the LLM to
    weight toward a show's actual leads over whoever had the most raw scraped volume, and
    Breaking Bad's wiki mixes in the entire Better Call Saul cast. Fixed with a per-speaker cap
    on material fed into the prompt (`MAX_QUOTES_PER_SPEAKER=8` in pipeline.ts) plus explicit
    CAST BALANCE and SPINOFF/CROSSOVER prompt rules. After: Walter White leads Breaking Bad
    (10/96), BoJack Horseman leads his own show (10/60), Jesse Pinkman/Skyler/Hank all present
    (previously absent).
  - **Checking full answer distribution (not just sample count) caught what 2-3 cherry-picked
    samples wouldn't have**: this is the same discipline that caught Parks and Rec in the Task 4
    follow-up, now proven necessary again on the LLM's own output, not just the scrape.
  - **A second, more serious bug surfaced from pulling samples across specific main-cast
    members rather than random ones**: BoJack Horseman, Princess Carolyn, and Todd Chavez's
    SCRAPED "quotes" were third-person scene-recap narration ("Princess Carolyn and Lenny look
    at photos..."), not dialogue — the LLM's own "discard non-spoken lines" instruction wasn't
    catching it reliably. Root cause in `extractBulletQuotes` (wikitext.ts): it matched any bare
    `''italicized''` line, not just genuinely bulleted ones, so it was scooping up BoJack's
    Wiki's interleaved `''[stage direction]''` narration — and because it found *something*,
    the pipeline never even tried the correct extractor (`extractSpeakerDialogue`) for that
    page. Fixed by requiring an actual `*` bullet marker. Also fixed: `extractSpeakerDialogue`
    only handled one of two colon-position conventions found on the same page, and matched
    speaker names by exact equality, so a page calling BoJack just "BoJack" against his full
    character-list name "BoJack Horseman" silently lost all of his own dialogue — switched to
    substring matching in either direction. Net effect after both fixes: BoJack Horseman
    65 clean quotes (from 0), Princess Carolyn 56 (from 6 narration lines), Todd Chavez 25
    (from 2 narration lines).
  - **User specifically asked about difficulty spread and distractor plausibility** (not just
    quote authenticity) before trusting the bank. Found genuine working examples (a Cuddlywhiskers
    monologue thematically confusable with BoJack's own arc; a Diane Nguyen line with Princess
    Carolyn as a distractor — matches the user's own hypothetical exactly) alongside two small,
    real bugs: character alias collisions (3/92 Breaking Bad questions list "Jimmy McGill" and
    "Saul Goodman" — the same person — as separate options) and one generic-role placeholder
    distractor ("Howard's therapist") instead of a real named character. ~1% of ~360 total
    questions. Added prompt guidance (one canonical name per person, real named characters only)
    for all future builds; per user decision, did not spend another rebuild fixing the existing
    ~1% today given real Gemini budget usage (~13 real requests today against the conservative
    ~20/day estimate).
  - Final seeded state: Breaking Bad 92 questions (MIXED), BoJack Horseman 210 (SCRAPED — the
    narration fix unlocked far more real material than the ~55 target), The Office 59 (MIXED).
    `tsc --noEmit` clean. All debug/investigation scripts removed before commit.
- **2026-07-11** — Pre-Task-5 quality investigation, prompted by the user flagging that The
  Office (3) and One Piece (0) yields would mean fabricated quotes shipping as if real — "the
  exact failure mode this whole design was meant to avoid." Investigated both rather than
  seeding on faith:
  - **The Office: real, fixable scraper bug.** Confirmed the main cast (Michael Scott index
    190, Pam 212, Dwight 88...) is in `Category:Characters` and genuinely has no dedicated
    `/Quotes` subpages, so every character depended on the main-page-fallback rung — which was
    capped at 60 in arbitrary category order, excluding the whole main cast. Raised the cap.
    Result: 3 → 50 quotes, now properly led by Michael Scott, Kelly Kapoor, Stanley, Oscar.
  - **One Piece: genuinely unscrapable, confirmed not a bug.** Wiki-wide search for `intitle:
    /Quotes` in namespace 0 returns zero results across the entire wiki. Neither Luffy's nor
    Zoro's main page has a "Quotes" section in any form. This wiki does not curate structured
    quotes for its cast — no scraper strategy fixes a convention that doesn't exist.
  - **Fixed 3 general resolver bugs** surfaced while hunting for a replacement (all in
    `src/lib/fandom/resolve.ts`, benefit every future build, not just this batch): (1)
    `isRelevant()` only did exact token-set matching, so "naruto" never matched sitename
    "Narutopedia" — added a substring check; (2) a curated alias key (`"brooklyn nine-nine"`)
    had a hyphen that `normalize()` strips to a space before lookup, so the alias silently
    never fired; (3) curated aliases were still being run through the relevance check, which by
    design rejects stylized wiki brand names ("Wookieepedia" for Star Wars, "Wiki of Westeros"
    for Game of Thrones) — curated aliases now bypass relevance entirely, since a curated
    mapping is trusted by definition.
  - **Replacement search: 14 candidates tested, none cleared the bar.** Most important finding:
    Parks and Recreation scraped 51 quotes — looked like a clean win on count alone — but every
    single quote came from one-off "public forum" gag characters; Leslie Knope's page has no
    Quotes section and zero main-cast lines appeared anywhere in the sample. Checking speaker
    distribution (not just count) caught this before it shipped as a false positive; PLAN.md's
    seed-list note now calls this out explicitly as the failure mode to keep checking for. Also
    tested and rejected as too thin: Naruto(2), Friends(1), Rick and Morty(10), Attack on
    Titan(0), Brooklyn 99(0), Harry Potter(0, different category-naming convention entirely),
    SpongeBob(0), MCU(0), Star Wars(0), Game of Thrones(0), Seinfeld(11, side-character-weighted),
    The Simpsons(0), Taylor Swift(0).
  - **User decision:** ship batch 1 with the 3 verified-strong fandoms now (Breaking Bad,
    BoJack Horseman, The Office) rather than block on finding a 4th or accepting a thin one.
    One Piece dropped from the seed list entirely.
  - **New requirement added to PLAN.md:** `Universe.source` must be visibly surfaced in the UI
    (badge on the universe wall + build/quiz screens) — a majority-GENERATED universe should
    read as "AI-fabricated, not verified canon" to the player, not be indistinguishable from a
    scraped one. Applies to Tasks 7 and 9.
  - `tsc --noEmit` clean. All debug/investigation scripts removed before commit.
- **2026-07-11** — Task 4 done, with a real design pivot from PLAN.md. Probed Fandom's actual
  APIs before writing code (per the file-tree audit the user requested mid-task, confirmed
  nothing else had been dropped and the MCP scope is still one server/6 tools per Task 13).
  Found the cross-wiki search PLAN.md assumed ("Fandom unified-search API") is Cloudflare-gated
  — every route tried (JSON `/api/v1/...`, HTML `Special:Search`) returns a bot-challenge page
  from a server-side request, both on `www.fandom.com` and `community.fandom.com`. Individual
  wiki subdomains' own `api.php` are wide open and 404 cleanly on a bad guess, and Fandom
  aliases some subdomains internally (guessing "startrek" transparently resolves to the real
  "memory-alpha" wiki). Replaced the resolve step with a slug-guess ladder + sitename
  relevance check (`src/lib/fandom/resolve.ts`).
  Built the scraper (`src/lib/fandom/scrape.ts`, `wikitext.ts`) and validated it live against
  all 4 batch-1 fandoms, fixing real bugs surfaced by actually running it rather than assuming
  it worked: (1) `Category:Characters` returns members alphabetically, so an early truncation
  cap was silently excluding Walter White, Skyler White etc. before they could ever be checked
  for a `/Quotes` page — fixed by widening the collection pool and only capping the final
  LLM-facing character list; (2) One Piece's `Category:Characters` holds zero direct character
  pages, only subcategories ("Characters by Type", "Characters by Status"...) — added one level
  of subcategory fan-out; (3) three different real wikis use three different quote formats on
  what's nominally the same kind of page — Breaking Bad uses `{{Quote|...}}` templates, The
  Office lists bullets (`* "quote" - context`) in a `==Quotes==` section on the character's main
  page (no dedicated subpage at all), BoJack Horseman uses script-style dialogue
  (`: '''Speaker''': line`) on its dedicated Quotes page. Implemented all three extractors,
  tried in order. Final live results: Breaking Bad 110 quotes, BoJack Horseman 71, The Office 3
  (thin — most main characters didn't make the 60-character fallback-check cap), One Piece 0
  (thin — subcategory fan-out only reached 15 characters, none with usable quote sections). The
  two thin cases are expected to lean on the LLM top-up/GENERATED path in Task 5, which is what
  that fallback exists for — not a Task 4 failure, but worth showing in the Task 5 sample-output
  check the user asked for. PLAN.md's build-pipeline section 3-4 rewritten to match reality.
  `tsc --noEmit` clean.
- **2026-07-11** — Gemini budget check before Task 4. User caught PLAN.md's stale "~1,000
  req/day" claim. Verified via WebFetch against Google's own rate-limits and pricing pages
  directly (not the contradictory third-party blogs from the first search) — neither publishes
  a static free-tier RPD number for any model anymore; both defer to the authenticated AI Studio
  dashboard. Proceeding on the conservative ~20/day figure already observed on this project's
  key, per user decision. Restructured `builder/schema.ts` for reliability without adding calls:
  tightened the Gemini `responseSchema` with `minItems/maxItems/minimum/maximum/minLength` to
  mirror the zod constraints (was looser than zod, letting the model emit e.g. wrong-length
  distractors that zod would then reject wholesale), and replaced the all-or-nothing zod parse
  with `parseUniversePayload()` — validates each question individually, drops bad ones, only
  fails below `QUESTION_MIN` (20). Net effect: still 1 Gemini call per universe (rejected
  splitting questions/tiers into 2 calls — that raises the guaranteed floor from 1 to 2
  calls/universe, working against "minimize calls" even though each call would be more
  reliable). Seed plan split into batches — see PLAN.md's updated seed-list section: batch 1
  (Breaking Bad, BoJack Horseman, One Piece, The Office — 4 requests) ships with Task 5 today;
  the other 11 trickle in ~4/day starting at Task 15. `tsc --noEmit` clean.
- **2026-07-11** — Task 2 done. Real Neon credentials arrived misplaced in the git-tracked
  `.env.example` — moved them to `.env.local` (gitignored) and restored `.env.example` to
  placeholders before anything could be committed/pushed. Inspected the Neon DB and found it
  wasn't empty: a previous build's schema (7 tables — `Universe/Question/Quiz/Attempt/Flag/
  RateLimit` with different columns, 11 Universe rows but only 3 `ready` with 30 questions each:
  Breaking Bad, One Piece, BoJack Horseman). Confirmed with the user, then dropped all 7 old
  tables and applied PLAN.md's schema via `prisma migrate dev` (hand-added the `pg_trgm`
  extension + GIN trigram index on `Universe.name` to the generated migration). Note for later
  schema changes: `migrate dev`'s post-apply drift check hangs waiting on stdin in this
  environment because the trgm index isn't declared in `schema.prisma` — future migrations
  should use `migrate dev --create-only` then `migrate deploy` to stay non-interactive.
  Verified: 4 tables (`Question/Result/Universe/_prisma_migrations`), all expected indexes,
  `pg_trgm` installed, `prisma migrate status` reports up to date, Prisma client regenerated.
- **2026-07-11** — Reconciled checkboxes above with git history (Task 3 had landed but wasn't
  ticked). Confirmed Task 2's migration is still blocked: no `.env` with real Neon credentials
  exists yet, so `prisma migrate dev` and the pg_trgm smoke query haven't run.
- **2026-07-11** — Task 3 done. Gemini client (`gemini.ts`): schema-constrained
  `generateStructured()`, single retry with temperature nudge, 429s mapped to a typed
  `rate_limited` error. `builder/schema.ts`: zod + Gemini-schema mirror for the full universe
  payload (55 questions, 5 tiers). `builder/prompts.ts`: scraped-quotes and generated-fallback
  prompts encoding difficulty rubric, distractor plausibility, sharp-but-affectionate tone.
  `builder/budget.ts`: daily build ceiling via `Universe` row count. `tsc --noEmit` clean.
- **2026-07-11** — Task 1 done. Plan approved; bank bumped to ~55 questions/universe.
  Scaffolded with create-next-app (came down as Next 16 — pinned to next@15.5.20 per hard
  constraint). Tailwind v4, shadcn (radix/nova preset, 7 primitives), framer-motion 12.
  Neon Arena tokens in globals.css (violet/cyan palette, Archivo variable font with wdth axis
  for the condensed-italic display face, grain overlay, slash/gradient/glow utilities).
  Placeholder home page on-theme. `npm run build` clean.
- **2026-07-11** — Kickoff. Failure-mode analysis done, design direction picked (B — Neon Arena),
  challenge semantics decided (fresh set per challenger), roast tone set (sharp but affectionate).
  PLAN.md written. Awaiting approval to start Task 1.
