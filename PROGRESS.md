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
- [x] 8. Build theater — polling screen, rotating status lines, fail/retry
- [x] 9. Quiz UI — QuestionCard, 15s TimerRing, StreakMeter, reveals, interstitials
- [ ] 10. Result reveal — tiers, name prompt, FighterCard with roast
- [ ] 11. OG image — next/og card for link previews
- [ ] 12. Challenge flow — /c/[id], fresh-set quiz, VS compare
- [ ] 13. MCP server — /api/mcp via mcp-handler, 6 tools, docs/mcp.md
- [ ] 14. Polish — motion, empty/error states, a11y, reduced-motion
- [ ] 15. Ship — GitHub + Vercel + prod migration + seed 15 fandoms + prod smoke test

## Log

- **2026-07-12** — Content-quality fix: two systematic bugs found during playtesting, not
  one-offs — self-answering quotes ("I am Sasuke Uchiha" with Sasuke as the answer) and generic
  quotes any character could say ("Hi BoJack"). New `src/lib/builder/quality.ts`:
  `quoteRevealsAnswer(quote, answer)` — word-boundary (not raw-substring, so an answer like "Al"
  doesn't false-positive on "practical"), case-insensitive match of each significant token of the
  ANSWER's own name against the quote text; only checks the speaker's own name, so a line
  addressed *to* someone by name is untouched. `isGenericQuote(quote)` — a deliberately
  conservative heuristic (short greeting/reaction patterns, gated by a <=6 word count so a longer
  line that happens to start with "Hi" isn't caught) — flagged to the user as fundamentally less
  reliable than the string-exact `quoteRevealsAnswer` check, since "generic" is a judgment call
  no regex can fully make; the real defense against genericness is the prompt instruction, this
  is a backstop. Applied in three places per the request ("at generation time AND as a
  post-generation validation pass"): (1) `pipeline.ts` filters scraped candidates before they
  ever reach the Gemini prompt, (2) `prompts.ts` RULES instructs Gemini directly on both (never
  select/invent a self-naming quote; exclude greetings/reactions/anything multiple characters
  would say), (3) `schema.ts`'s `questionItemSchema` gets two more `.refine()` checks, dropping
  any surviving item per the same lenient per-item validation pattern as the existing
  duplicate-distractor check.
  **Ran the validation against the real seeded data** (not just the new pipeline going forward)
  via `scripts/validate-existing-quotes.ts` (dry-run flag first, inspected the actual flagged
  quotes before deleting anything real): Breaking Bad 92→90 (2 removed), BoJack Horseman
  210→200 (10 removed — includes `isGenericQuote` catching `"Hey, BoJack."`), The Office 59→57
  (2 removed — one catch, `"Happy Birthday to Gabe!"` attributed to Gabe Lewis himself, is very
  likely a genuine pre-existing misattribution bug this incidentally surfaced, not just a
  self-reference), Naruto 53→52 (1 removed, the canonical "My name is Uchiha Sasuke" example).
  15 total across 414 questions (~3.6%). Live-verified post-cleanup: all 4 universes still serve
  a full 10-question quiz; Naruto's difficulty-3 pool dropped below 3, and `select.ts`'s existing
  shortfall fallback (built in Task 6) correctly backfilled with an extra options-format question
  rather than erroring — confirms that fallback path still works, not just that the delete ran.
- **2026-07-12** — Task 9 follow-up: seven fixes from the user's real browser playtest.
  - **Laggy tap (most urgent)**: `handleAnswer` awaited `POST /api/questions/[id]/check`
    (measured live at 300-800ms) before any visual change — so every tap felt unresponsive by
    exactly that latency. Fixed by splitting state: `picked` is set synchronously the instant a
    button is tapped (immediate pressed/selected ring), `reveal` (correctness) arrives later and
    overlays cyan/red on top of it. `QuestionCard`/`DuelCard` now disable on `picked`, not
    `reveal`, so a second tap can't race the network call either.
  - **Progress dots weren't progress**: the 10-dot meter was actually a streak meter (fills on
    consecutive correct, resets on wrong) — reasonable in isolation, but sitting right next to
    "ROUND N/10" it reads as quiz progress, and a meter that visibly resets while the round
    number keeps climbing looks broken. Renamed/repurposed to `ProgressDots` (lit up to the
    current question, monotonically), moved streak to small inline text next to the round label
    ("3 in a row", only shown at streak >= 2) instead of a second row of dots.
  - **Report button added** — flag icon (lucide-react, not emoji, consistent with the identity
    rule) top-right of the quote card, opens inline wrong_answer/bad_quote/other chips,
    `POST /api/questions/[id]/report`. New `QuestionReport` model + migration
    `20260712095609_add_question_report` (**hit the same Prisma-diff-vs-hand-added-trgm-index
    trap as the duel migration** — stripped the same erroneous `DROP INDEX` before applying,
    verified the index survived afterward). **Noted directly to the user**: PLAN.md §7 "Out of
    scope (v1)" explicitly lists "moderation/reporting" — this wasn't in the approved plan or
    anything described for Task 9; the only "Flag" anywhere in this project's history is a table
    name from the old, discarded pre-Task-2 schema. Built it anyway per the explicit current
    instruction, and updated PLAN.md's out-of-scope line to reflect the real decision rather than
    let the doc silently contradict the code. Deliberately minimal: no auth, no dedupe, no
    moderation dashboard, no relation/cascade to Question (so reports survive a rebuild that
    wipes and recreates questions) — proportionate to "add the button," not a full system.
  - **Timer ring was illegible**: a bare spinning ring with no number communicated nothing.
    Added a ticking seconds-remaining number centered inside it (a separate `setInterval` purely
    for the display number, decoupled from the CSS-transition drain which stays the efficient,
    non-ticking animation it already was).
  - **Removed the source badge from the quiz screen** — it's already shown on the universe card
    the player chose from; repeating "VERIFIED QUOTES" on every single question was clutter, not
    additional honesty. The wall and search dropdown are still where `quoteSource` is surfaced.
    Also caught while removing it: `GET /api/universes/[slug]` was still returning the raw
    `source` enum rather than the honest `scrapedRatio` fixed in Task 7/9 elsewhere — fixed that
    too even though the quiz screen no longer renders it, since other future consumers of that
    endpoint shouldn't get the dishonest value back.
  - **Dead space**: quote card and option buttons widened (`max-w-md` → `max-w-lg`), quote text
    and card padding increased, container gaps tightened (`gap-8` → `gap-5`), and the outer
    `/play/[slug]` page changed from full vertical `justify-center` to top-anchored with
    generous padding — a short building/failed screen still reads fine anchored near the top;
    what was actually broken was a modestly-sized quiz getting dead-centered in leftover
    whitespace on a tall viewport.
  - **Correct/wrong feedback strengthened**: added a genuine "pulse-glow" burst animation
    (scale + cyan glow, 600ms) for a correct pick — the previous version was a static ring color
    change with no motion, easy to miss entirely. Bumped the shake to 500ms (was 400ms, already
    technically over the 300ms floor but bumped for parity) and `REVEAL_PAUSE_MS` from 1200ms to
    1600ms so there's comfortable time to actually see either animation before the quiz advances.
  - **Live-verified all of the above against the real DB**, not just typechecked: confirmed
    `/api/questions/[id]/report` persists real `QuestionReport` rows with the correct reason
    enum and 400s on an invalid reason; re-ran the full scripted 10-question playthrough (mixed
    formats) end-to-end after all the restructuring and got the same correct `score: 5` as
    before, confirming nothing broke in the process. Confirmed via dev-server logs that `/check`
    genuinely does take 300-800ms in this environment — direct evidence for why the instant-tap
    fix was the right one, not a guess.
  - **Same honest gap as before**: the actual visual result (does the pulse read as a "burst,"
    does the timer number look right inside the ring, does the tightened spacing actually feel
    less empty) is still unverified in a real browser — no automation tool available here. Code
    reviewed carefully against each specific complaint, but this is the task where that
    limitation bites hardest, twice in a row now.
- **2026-07-12** — AGENTS.md provenance, investigated on request. Landed in the Task 1 scaffold
  commit (`dbad9b3`), authored under the user's own git identity with `Co-Authored-By: Claude
  Fable 5` — i.e. it came in during the very first scaffold pass, before Sonnet 5 took over this
  build. Its content is wrapped in `<!-- BEGIN:nextjs-agent-rules -->`/`<!-- END -->` markers,
  which reads like auto-inserted boilerplate rather than hand-typed prose, but grepping
  `node_modules` for the exact string found nothing installed that ships it — so the specific
  tool that injected it (if any) couldn't be pinned down. What's certain: the claim is false
  (verified two entries ago — no `docs/` dir, stock Next 15.5.20), and nothing in this session
  has acted on it. Left as-is; the user will decide whether to remove it.
- **2026-07-12** — Palette hardening, on request after a re-verification request. The Task 7
  fix was already shipped and re-confirmed correct via a second live SSR check (still 4 distinct
  gradient pairs, matching `28fb1a0`) — the user's "still isn't shipping" was almost certainly
  against the pre-fix browser session. While in the code anyway: added
  `-webkit-text-fill-color: transparent` everywhere gradient text renders (the actual property
  Safari needs for `background-clip: text` — `color: transparent` alone isn't reliable there,
  a real cross-browser gap the earlier version had even though it happened to test fine via
  curl/grep), and factored the repeated 6-line style object into `fandomGradientStyle()` in
  `fandom-palette.ts`, used by `UniverseWall`, `FandomSearch`, and `BuildTheater` alike.
- **2026-07-12** — Task 9 done. Quiz UI at `/play/[slug]`, replacing the ready-state placeholder
  from Task 8.
  - **New scope, not previously in PLAN.md**: the hard-tier "duel" format (two options instead
    of four, framed as a VS clash) was introduced this session, not carried over from planning.
    Added to PLAN.md's core loop and `Question` schema notes so it's recorded as a real decision,
    not just code that showed up.
  - **Distractor ranking, not a random pick**: the user flagged that picking a random distractor
    for duels was a shortcut worth fixing immediately, since it's the difference between duels
    being genuinely harder vs. cosmetically different. Added `hardestDistractor` to the
    generation prompt (`prompts.ts`) and the per-question schema (`schema.ts`, nullish — an
    item missing it is still fully usable in four-option mode, matching the established lenient-
    validation philosophy), a new `Question.duelDistractor` column (migration
    `20260712092533_add_duel_distractor` — **had to hand-edit the generated migration.sql**,
    since Prisma's diff saw the hand-added `pg_trgm` trigram index as unrecognized drift and
    planned to `DROP INDEX "Universe_name_trgm_idx"`; stripped that statement, applied via
    `migrate deploy`, then directly queried `pg_indexes` post-apply to confirm the index
    survived — same non-interactive `--create-only` + `deploy` pattern documented after Task 2,
    now with an explicit "read the generated SQL before applying" step added given what it
    almost did). `pipeline.ts` fuzzy-matches Gemini's returned string against the question's own
    3 distractors (case/whitespace-insensitive) before trusting it, since Gemini occasionally
    paraphrases rather than echoing verbatim — an unmatched value stores `null`, not an invented
    string. `formatQuestionForClient` (`quiz/duel.ts`) picks `duelDistractor` when present, a
    random distractor otherwise (existing seeded universes predate this field, so their duels
    run on the fallback until rebuilt — confirmed live: all of BoJack's difficulty-3 rows have
    `duelDistractor: null` right now). **Not yet live-verified against a real Gemini call** —
    today's quota is exhausted (confirmed for real in Task 8), so the new prompt field's actual
    output quality is unverified until a future rebuild; the fallback path is what's live-tested
    below.
  - **New endpoint, not scope creep**: `POST /api/questions/[id]/check` reveals correctness (and
    the real answer) for one question, only after the player commits a guess. This was necessary,
    not optional — the existing architecture only grades in a batch at final submission (correct
    by design, so the client never has answers *beforehand*), but the approved layout promises an
    immediate tap-to-reveal flash, which needs per-question correctness at the moment of
    answering. This endpoint is pure UX convenience — `POST /api/results` still recomputes the
    authoritative grade from the DB independently, exactly as before, so nothing about the
    security posture changed.
  - Components: `TimerRing` (SVG, CSS-transition drain, no per-frame JS — determinate version of
    Task 8's `BuildSpinner`, same visual language), `StreakMeter`, `RoundHeader` (round label +
    palette underline + the honest `scrapedRatio` source badge, now also fixed on this endpoint —
    `GET /api/universes/[slug]` was still returning the raw `source` enum instead of the Task 7
    ratio fix; caught and corrected here), `QuestionCard` (four-option, options stay plain
    foreground text on purpose — reveal colors need to read unambiguously against whatever the
    fandom palette is), `DuelCard` (two-option, VS badge absolutely centered on the container so
    it survives the mobile stack per the user's explicit note, opposing ∓2° rotation and
    overlap-margin applied unconditionally rather than only at the sm+ breakpoint), and `Quiz.tsx`
    orchestrating question flow, scoring, streak, and final submission to `/r/[id]` (Task 10,
    doesn't exist yet — same accepted gap as `/play/[slug]` existing before Task 8).
  - Palette applied throughout per the user's explicit requirement: quote card border + faint
    tint, TimerRing gradient, round-header underline, StreakMeter fill, and duel fighter names
    all pull from `fandomPalette(slug)`; reveal colors (cyan/red) and the source badge stay fixed
    regardless of fandom, deliberately — described to the user as a concrete list before writing
    any component and built exactly to that list.
  - **Live-fired a full 10-question playthrough end-to-end**, not just typechecked: fetched a
    real quiz (BoJack, confirmed 7 options-format + 3 duel-format questions matching the 3/4/3
    curve), called `/check` for both a wrong and correct pick on the same question and confirmed
    both graded correctly, submitted a scripted alternating-correct/wrong run through
    `POST /api/results` and got back the exact expected `score: 5`, then confirmed via
    `GET /api/results/[id]` that the stored tier/roast were sensible. Separately ran an
    all-timeout submission (every answer the `"(no answer)"` sentinel) and confirmed it graded
    `0/10` cleanly rather than 400ing on zod's `min(1)` — this was a real bug caught before it
    shipped: an earlier draft used `picked: ""` for timeouts, which fails `z.string().min(1)` in
    both `/check` and `/results`.
  - **Known gap, same pattern as Tasks 7-8**: no browser automation tool in this environment, so
    the actual client-side rendering — the duel's mobile clash treatment (rotation + centered VS
    badge surviving the stacked layout), the timer ring's visual drain, the shake animation, and
    the palette actually appearing on the live quote card/chrome — was verified by code review
    and by confirming every API response and CSS rule it depends on, not by loading the page in a
    browser. This is the task where that gap matters most so far, since the mobile-duel "still
    feels like a confrontation" requirement is fundamentally a visual judgment call. Flagging
    explicitly rather than claiming it renders as designed.
- **2026-07-12** — Task 8 done. Build theater at `/play/[slug]`.
  - **Noted, not acted on**: AGENTS.md instructs reading `node_modules/next/dist/docs/` before
    writing code, citing breaking API changes vs. training data. Checked before touching the
    build/polling architecture below, since it's exactly the kind of change that'd bite if Next
    really had diverged: no `docs/` directory exists in `node_modules/next`, and the installed
    package is the standard, unmodified `vercel/next.js` release at 15.5.20. The instruction
    doesn't correspond to reality — flagged to the user, not silently followed or silently
    ignored. Proceeded on ordinary, current Next.js 15 knowledge, verified directly against the
    installed package where it mattered (see `after()` below).
  - **Real architecture gap found before any UI was written**: PLAN.md's core loop says "client
    polls status on the build theater screen," but `POST /api/universes` (Task 6) actually ran
    the full scrape→Gemini→persist pipeline synchronously and only responded once it was
    completely done — confirmed by the user's own Naruto test, which sat on "Building…" in the
    search box for the whole build with nothing to poll. Fixed at the source: split
    `buildUniverse()` in `pipeline.ts` into a fast synchronous lock/dedupe step
    (`BuildLockOutcome`, returns in ms) and the heavy `runBuild()` work, now handed back as a
    `start` callback. `POST /api/universes` awaits only the lock step and schedules `start` via
    `after()` (real, stable export — grepped `node_modules/next/server.js` to confirm rather than
    assume) so the heavy work keeps running after the response is sent; the route now returns
    `{status: "building", slug}` almost immediately. `scripts/seed-universes.ts` updated to
    `await lock.start()` directly (a CLI script has no HTTP response to defer around).
    `FandomSearch.tsx` simplified to match — it now redirects to `/play/[slug]` right away
    instead of blocking on the build.
  - New: `src/lib/fandom-palette.ts`-driven `font-display` name in `BuildSpinner.tsx`
    (indeterminate conic-gradient ring — deliberately not a fake progress bar, since the backend
    gives no granular phase signal) + `RotatingStatusLine.tsx` (cross-fading flavor lines
    templated with the fandom name, purely client-side texture, not a real status feed) +
    `BuildTheater.tsx` (polls `GET /api/universes/[slug]` every 2.5s while `status==="building"`,
    renders the ready/failed views once it isn't). `/play/[slug]/page.tsx` does the initial
    status read directly from the DB (no wasted first round-trip) and handles a genuinely
    unbuilt slug with a plain "No such fandom yet" state.
  - **Live-fire tested the actual deferred-build path end-to-end**, not just typechecked: POSTed
    a real new fandom ("Attack on Titan") and confirmed the request returned in ~5s (not the
    30-90s a full build takes) with `{status:"building"}`, then polled `GET
    /api/universes/[slug]` directly and watched it transition — which happened to hit the Gemini
    daily quota for real (`RESOURCE_EXHAUSTED`, confirming `after()` genuinely executed
    server-side after the response, not silently dropped). That surfaced a real bug: the raw
    Gemini 429 body (several hundred characters of nested JSON) was being stored verbatim as
    `failReason` and would have rendered directly in the failed-state UI. Fixed by having
    `runBuild`'s catch block detect `GeminiError.kind === "rate_limited"` and store a clean
    human message instead; re-ran the same failing retry and confirmed the stored `failReason`
    and the rendered `/play/attack-on-titan` page both now show the clean line. Also confirmed:
    `/play/naruto` (already READY) renders the ready placeholder correctly on first load,
    `/play/<gibberish>` renders the not-found state, and the wall/search endpoints from Task 7
    still return correct data after the route.ts changes.
  - **Known gap, same as Task 7**: no browser automation tool is available in this environment,
    so the client-side polling *mechanism* itself (the `setInterval`/`fetch`/`setState` loop
    inside `BuildTheater.tsx` actually flipping the rendered view when a real transition occurs
    while the component is mounted) was verified by code review and by confirming every API
    response it depends on is correct at each stage — not by watching it happen live in a
    browser tab. Flagging rather than claiming full coverage.
- **2026-07-12** — Task 7 follow-up: four fixes from the user's live browser review, plus a
  confirmation that the on-demand build path works end-to-end.
  - Removed the "ROUND 0/10" eyebrow from the landing hero — that's quiz interstitial chrome
    (PLAN.md's Neon Arena notes now say so explicitly) and reads as meaningless before a quiz
    starts.
  - **Source badges weren't carrying real information**: Breaking Bad (90/92 questions scraped,
    97.8%) and The Office (44/59, 74.6%) both showed an identical "Mostly Verified" because the
    badge was keyed off the coarse `Universe.source` enum (`MIXED` for both), not actual yield.
    Replaced with `src/lib/quiz/source-ratio.ts` (`scrapedRatios()`, a `Question.groupBy` over
    real per-question `source`) feeding a rewritten `source-badge.ts`: ≥95% scraped → "Verified
    Quotes", 0% → "AI-Generated" (still styled as a caution per the honesty requirement),
    anything between shows the real number, e.g. "75% Verified". Wired through both
    `GET /api/universes` branches (wall + fuzzy search) and the wall's own server-side query, so
    the search dropdown and the wall badge always agree. Verified against live data: Breaking
    Bad and BoJack (100%) both now correctly read "Verified Quotes", The Office reads "75%
    Verified", Naruto reads "AI-Generated" — four different real values, four different badges.
  - **Per-fandom card palette wasn't shipping** — all three cards used the one brand violet→cyan
    gradient, so the roster had no fandom identity, undercutting the point of typography-first
    cards. New `src/lib/fandom-palette.ts`: curated iconic two-stop gradients for known shows
    (Breaking Bad yellow→green, BoJack pink→purple, The Office blue→gray, Naruto orange→red) and
    a deterministic slug-hash fallback (stable per fandom, visually distinct from the app's own
    brand gradient) for anything built on demand and not curated. This wasn't actually specified
    in PLAN.md before now, despite the ask referencing it — added it to the Neon Arena notes so
    Tasks 10–11 (FighterCard, OG image) reuse the same system instead of inventing a second one.
    Applied to both the wall cards and the search dropdown rows for consistency.
  - Tightened the dead space between the search box and "THE ROSTER": the hero was wrapped in a
    forced `min-h-[70vh]` flex-center regardless of content height, pushing the roster down by a
    near-arbitrary amount on any normal viewport. Replaced with ordinary top padding + a fixed
    `mt-16` before the roster section.
  - All four fixes live-verified via SSR output against the real DB (not just eyeballed in
    isolation): confirmed zero "ROUND 0" occurrences, confirmed the four distinct badge values
    above, confirmed four distinct curated gradient color pairs render for the four seeded/built
    universes. Re-ran `npm run build` — `/` still correctly shows `ƒ` (dynamic), the Task 7 fix
    didn't regress.
  - **Confirmed the on-demand build path end-to-end**: the user's "Naruto" build hung on
    "Building…" in the UI (expected — `/play/[slug]` is Task 8, doesn't exist yet, so the client
    has nowhere to redirect once the POST resolves). Queried the DB directly: `naruto` universe
    is `READY`, `GENERATED`, 53 questions persisted. The full pipeline (resolve → scrape →
    Gemini → persist) ran and completed correctly server-side despite the dead-end redirect —
    the gap is purely the missing destination page, not the build path. It now also appears on
    the roster on refresh, correctly badged "AI-Generated" since Naruto's wiki yielded nothing
    scrapeable.
  Not a separate commit-worthy task per PLAN.md's numbering — folded into the Task 7 commit since
  it's a direct fix pass on that task's deliverable, not new scope.
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
