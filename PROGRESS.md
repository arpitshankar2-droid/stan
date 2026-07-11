# STAN — Progress

Rule: every completed task gets a checkbox flip here **and a git commit**. No batching.

## Status: in progress — plan approved 2026-07-11

- [x] 0. Repo bootstrap — git init, PLAN.md, PROGRESS.md, first commit
- [x] 1. Scaffold — Next 15 + TS + Tailwind + shadcn + Framer Motion, Neon Arena tokens
- [x] 2. Database — Prisma schema, Neon wiring (pooled + direct), pg_trgm migration
- [x] 3. Gemini client — structured-output helper, zod schemas, budget gate, prompts
- [x] 4. Fandom scraper — wiki resolve, strategy-ladder quote scrape, wikitext cleaner
- [ ] 5. Build pipeline — scrape→LLM→persist, lock, fallback, seed script (batch-1: 4 dev universes)
- [ ] 6. API routes — universes search/create/status, results grade/get, quiz selection
- [ ] 7. Home page — hero, search + suggestions, universe wall
- [ ] 8. Build theater — polling screen, rotating status lines, fail/retry
- [ ] 9. Quiz UI — QuestionCard, 15s TimerRing, StreakMeter, reveals, interstitials
- [ ] 10. Result reveal — tiers, name prompt, FighterCard with roast
- [ ] 11. OG image — next/og card for link previews
- [ ] 12. Challenge flow — /c/[id], fresh-set quiz, VS compare
- [ ] 13. MCP server — /api/mcp via mcp-handler, 6 tools, docs/mcp.md
- [ ] 14. Polish — motion, empty/error states, a11y, reduced-motion
- [ ] 15. Ship — GitHub + Vercel + prod migration + seed 15 fandoms + prod smoke test

## Log

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
