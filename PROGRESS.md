# STAN — Progress

Rule: every completed task gets a checkbox flip here **and a git commit**. No batching.

## Status: in progress — plan approved 2026-07-11

- [x] 0. Repo bootstrap — git init, PLAN.md, PROGRESS.md, first commit
- [x] 1. Scaffold — Next 15 + TS + Tailwind + shadcn + Framer Motion, Neon Arena tokens
- [x] 2. Database — Prisma schema, Neon wiring (pooled + direct), pg_trgm migration
- [x] 3. Gemini client — structured-output helper, zod schemas, budget gate, prompts
- [ ] 4. Fandom scraper — wiki resolve, strategy-ladder quote scrape, wikitext cleaner
- [ ] 5. Build pipeline — scrape→LLM→persist, lock, fallback, seed script (3 dev universes)
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
