# STAN — Build Plan

A web quiz game: pick any fandom, answer 10 "who said this" questions built from real quotes,
get tiered and roasted, and send a challenge link to a friend who thinks they're the bigger fan.

**Decisions locked with the user (2026-07-11):**
- Visual direction: **B — Neon Arena** (indigo-black, electric violet → acid cyan, huge italic condensed type, versus-screen energy, fighter-stat result card)
- Challenge links serve a **fresh 10-question set** from the same universe (no repeat spoilers); the compare view pits scores, not per-question answers
- Roast tone: **sharp but affectionate** — banter-grade, in-universe references do the cutting
- User already has: Neon project + connection string, Gemini API key. Missing: Vercel/GitHub wiring (Task 15)

**Hard constraints:** Next.js 15 + TypeScript + Tailwind + shadcn + Framer Motion on Vercel ·
Neon Postgres via Prisma (pooled, serverless) · Gemini `gemini-2.5-flash-lite` for all LLM work
(free tier, batch aggressively) · real quotes scraped from Fandom with LLM fallback ·
MCP server exposing core tools with zero production drag · no accounts · dark bold neon, no emoji identity.

---

## 1. Architecture

### Core loop
```
Home ── type fandom ──▸ fuzzy match against existing universes
   │                        │
   │                   hit: play instantly
   │                        │
   │                  miss: POST /api/universes  ─▸ build pipeline (scrape ─▸ 1 LLM call ─▸ persist)
   │                        │  client polls status on the "build theater" screen
   ▼                        ▼
 Quiz: 10 questions, 15s timer each, streak counter, difficulty curve (3 easy / 4 mid / 3 hard)
   ▼
 POST answers ─▸ server grades from DB ─▸ Result row (score, tier, roast line)
   ▼
 /r/[id] result card (fighter stat card + OG image) ─▸ "CHALLENGE" link /c/[id]
   ▼
 Friend gets a FRESH 10 from the same bank (parent's questionIds excluded) ─▸ VS compare view
```

### Zero-LLM play (success criterion #2)
Everything a play session needs is generated once, at universe build time, in **one** Gemini
structured-output call:
- ~55 multiple-choice questions (quote, answer, 3 same-universe distractors, difficulty 1–3, context line for the reveal) — bank sized so fresh-set challenge chains get ~5 non-overlapping quizzes without a top-up job
- 5 tier definitions (universe-flavored names + 3 roast/crown lines each)
Play, grading, tiers, roasts, sharing, rematches: all Postgres reads. A second LLM call happens
only when the wiki is too thin and quotes must be generated outright (universe marked `GENERATED`).

### Build pipeline (`src/lib/builder/`)
1. **Normalize + match**: slugify query; check `Universe.slug`, `aliases[]`, then `pg_trgm`
   similarity — "bojack" and "BoJack Horseman" must hit the same row, never rebuild.
2. **Lock**: insert `Universe` with `status=BUILDING` (unique slug). Concurrent requests find the
   row and poll instead of double-building. Stale `BUILDING` rows (>3 min) are retried.
3. **Resolve wiki**: Fandom unified-search API → candidate `<wiki>.fandom.com`; verify via
   `api.php?action=query&meta=siteinfo`.
4. **Scrape via MediaWiki API only** (no HTML parsing): strategy ladder —
   dedicated `*/Quotes` pages → quote sections on top character pages → category `Characters`
   members for the cast list. Hard per-request timeout (5s), page budget (~25 fetches), wikitext
   cleaned by a small parser (strip templates/links, keep `{{Quote|...}}` payloads).
5. **LLM call**: scraped candidates + cast list → Gemini structured output (strict JSON schema):
   select/validate real quotes, build distractors, tag difficulty, write tier set. If scrape
   yielded <15 usable quotes → generation prompt ("only iconic lines you are highly confident
   are real").
6. **Persist**: questions (deduped by `quoteHash`, unique constraint), tiers JSON, `status=READY`.
   On any failure: `status=FAILED` + reason, user gets an honest retry screen.

Route runs with `maxDuration: 300` (fluid compute). Client never awaits the build request
directly — it fires and polls `GET /api/universes/[slug]`.

### Failure modes → mitigations (from kickoff analysis)
| # | Failure | Mitigation baked in above |
|---|---------|---------------------------|
| 1 | Neon connection exhaustion | Pooled connection string + `@prisma/adapter-neon`; direct URL only for migrations; global client |
| 2 | Gemini daily cap / duplicate builds | 1 call per universe, cached forever, `BUILDING` row as lock, daily build counter → graceful "at capacity" state |
| 3 | Scraper fragility / timeouts | MediaWiki API only, strategy ladder, per-fetch timeouts + page budget, LLM validates whatever arrives, honest GENERATED fallback |
| 4 | Build latency kills first play | 15 pre-seeded fandoms, aggressive fuzzy match, build-theater screen with rotating universe-flavored status lines |
| 5 | Bad question quality | Scraped quotes preferred as ground truth, same-universe plausible distractors required by prompt, difficulty curve, quoteHash dedupe, self-validation in the build call |

### Challenge semantics (fresh set)
`/c/[resultId]` → "Arpit scored 7/10 on BoJack Horseman. Think you're the bigger stan?"
→ select 10 questions excluding the parent result's `questionIds` (fall back to allowing overlap
if the bank is small) → new Result with `challengeOf=parentId` → compare view: two fighter cards,
VS treatment, winner banner. Chains work (challenge a challenge).

### Result card + sharing (success criterion #3)
- `/r/[id]` page **is** the card: fighter-stat layout — universe name, player name (optional,
  asked at reveal), big score, tier belt, roast line, stat bars (accuracy, best streak, avg speed).
- `opengraph-image.tsx` via `next/og` renders the same card at 1200×630 → WhatsApp/Twitter
  link previews look like the screenshot people would have taken.
- Web Share API button + copy-link fallback. No login anywhere.

### MCP (success criterion #4)
`/api/mcp/[transport]/route.ts` via Vercel's `mcp-handler`, calling the **same service layer**
(`src/lib/`) as the app routes — no duplicated logic, and it's just another code-split route so
production app traffic is untouched. Claude Desktop connects via `mcp-remote`.
Tools: `search_universes`, `build_universe`, `get_universe_status`, `start_quiz`,
`grade_quiz`, `get_result`. Docs + Desktop config snippet in `docs/mcp.md`.

### Gemini budget math
Free-tier daily cap is not reliably published (Google's docs defer to the AI Studio dashboard;
third-party sources disagree). Treat it as **~20 requests/day** — the number actually observed
on this project's key — until proven otherwise.

Cost per universe: **1 request typically** (the thin-wiki decision picks a prompt *before*
calling Gemini, based on scrape yield — it does not add a call). **2 requests worst case**,
from `generateStructured()`'s single retry on malformed/truncated JSON — a real risk here, not
theoretical, since one response must hold ~55 questions + 5 tiers from a lite model.

Seeding 15 universes: **15 requests best case, up to 30 worst case** — at or over the ~20/day
cap in a single run, with zero room left for that day's pipeline dev/testing or any real
user-triggered build. `DAILY_BUILD_CEILING` (currently `15` in `.env.local`) gates Universe rows
created, not raw Gemini requests, so it does not prevent the worst-case overage.
**Seeding will need to span multiple days** (see PROGRESS.md for the running plan) unless the
per-universe request count is reduced further.

---

## 2. Folder structure

```
Quiz/
├─ PLAN.md · PROGRESS.md · README.md
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ scripts/
│  └─ seed-universes.ts          # local: builds the 15 launch fandoms
├─ docs/
│  └─ mcp.md                     # Claude Desktop setup
├─ public/                       # fonts (self-hosted), noise texture
└─ src/
   ├─ app/
   │  ├─ layout.tsx · page.tsx          # home: hero, search, popular-universe wall
   │  ├─ globals.css                    # Neon Arena tokens
   │  ├─ play/[slug]/page.tsx           # build-theater OR quiz, by universe status
   │  ├─ r/[id]/page.tsx                # result card
   │  ├─ r/[id]/opengraph-image.tsx     # OG card (next/og)
   │  ├─ c/[id]/page.tsx                # challenge landing → fresh quiz → VS compare
   │  └─ api/
   │     ├─ universes/route.ts          # GET search · POST create+build
   │     ├─ universes/[slug]/route.ts   # GET status / quiz payload
   │     ├─ results/route.ts            # POST grade+create
   │     ├─ results/[id]/route.ts       # GET (card + compare data)
   │     └─ mcp/[transport]/route.ts    # MCP server
   ├─ lib/
   │  ├─ db.ts                          # global Prisma + Neon adapter
   │  ├─ gemini.ts                      # client, structured-output helper, budget gate
   │  ├─ fandom/                        # resolve.ts · scrape.ts · wikitext.ts
   │  ├─ builder/                       # pipeline.ts · prompts.ts · schema.ts (zod)
   │  ├─ quiz/                          # select.ts (curve + exclusions) · grade.ts · tiers.ts
   │  └─ slug.ts · types.ts
   ├─ components/
   │  ├─ ui/                            # shadcn primitives (restyled)
   │  ├─ home/                          # FandomSearch, UniverseWall
   │  ├─ build/                         # BuildTheater
   │  ├─ quiz/                          # QuestionCard, TimerRing, StreakMeter, RoundInterstitial
   │  └─ result/                        # FighterCard, TierBelt, VsCompare, ShareBar
   └─ hooks/                            # useQuizEngine, useCountdown
```

## 3. Prisma schema

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Neon pooled (-pooler) — runtime
  directUrl = env("DIRECT_URL")     // Neon direct — migrations only
}

enum UniverseStatus { BUILDING  READY  FAILED }
enum QuoteSource    { SCRAPED   GENERATED  MIXED }

model Universe {
  id         String         @id @default(cuid())
  slug       String         @unique
  name       String
  aliases    String[]       @default([])
  status     UniverseStatus @default(BUILDING)
  source     QuoteSource?
  characters Json?          // [{ name }]
  tiers      Json?          // [{ minScore, name, lines: string[] }] × 5
  failReason String?
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  questions  Question[]
  results    Result[]
}

model Question {
  id         String      @id @default(cuid())
  universeId String
  universe   Universe    @relation(fields: [universeId], references: [id], onDelete: Cascade)
  quote      String
  answer     String      // character name
  options    String[]    // 4, includes answer, pre-shuffled
  difficulty Int         // 1 easy · 2 mid · 3 hard
  source     QuoteSource
  context    String?     // shown on reveal ("S3E4, the underwater episode")
  quoteHash  String      // sha1(normalized quote) — dedupe
  @@unique([universeId, quoteHash])
  @@index([universeId, difficulty])
}

model Result {
  id          String   @id @default(cuid())
  universeId  String
  universe    Universe @relation(fields: [universeId], references: [id], onDelete: Cascade)
  name        String?  // optional display name, asked at reveal
  score       Int
  questionIds String[]
  answers     Json     // [{ questionId, picked, correct, ms }]
  tier        String
  roast       String   // the exact line shown — card must be stable forever
  bestStreak  Int      @default(0)
  challengeOf String?  // parent Result.id when played via /c/
  createdAt   DateTime @default(now())
  @@index([universeId])
  @@index([challengeOf])
}
```
Plus a migration enabling `pg_trgm` and a GIN trigram index on `Universe.name` for fuzzy match.

## 4. Neon Arena — implementation notes

- **Palette**: `#07060e` base, `#12101f` surfaces, electric violet `#7c3aed→#a855f7`,
  acid cyan `#22d3ee`, danger `#fb2350`; gradients used hard and sparingly (borders,
  timer ring, tier belt) — never full-bleed wash.
- **Type**: self-hosted variable fonts — condensed display with real italics
  (Archivo/Archivo Expanded or similar) for scores/headings, tight grotesk for UI. Uppercase +
  negative tracking + skew on display elements: broadcast lower-third energy.
- **Signature moves**: diagonal slash dividers; ROUND N/10 interstitials (Framer Motion
  slide-smash); draining conic-gradient timer ring; streak meter that charges up; screen-shake +
  red flash on wrong, cyan pulse on right; VS screen for challenges; subtle noise texture so
  black isn't flat. Everything angled ~-2°. No emoji anywhere in the identity.
- **shadcn** primitives fully retokenized — if it looks like a Tailwind starter, it ships again.

## 5. Task list (dependency-ordered · ~25h)

Rule of engagement: after every completed task — update PROGRESS.md, `git commit`. No exceptions.

| # | Task | Deliverable | Est |
|---|------|-------------|-----|
| 0 | Repo bootstrap | git init, PLAN.md, PROGRESS.md, first commit | 0.2h |
| 1 | Scaffold | Next 15 + TS + Tailwind + shadcn + Framer Motion; Neon Arena tokens, fonts, noise bg; builds clean | 1.5h |
| 2 | Database | Prisma schema above; Neon pooled+direct env wiring, adapter, `db.ts`; migration incl. pg_trgm; smoke query | 1h |
| 3 | Gemini client | `gemini.ts` with structured-output helper, zod schemas for the universe payload, budget gate; prompt drafts | 1.5h |
| 4 | Fandom scraper | resolve wiki → strategy-ladder quote scrape → cleaned candidates; timeouts + page budget; test against BoJack, Naruto, a thin wiki | 2.5h |
| 5 | Build pipeline | scrape→LLM→persist with lock, fallback, fail states; `seed-universes.ts`; 3 universes seeded in dev DB | 2h |
| 6 | API routes | universes search/create/status, results grade/create/get; fuzzy match; quiz selection (curve + exclusions) | 1.5h |
| 7 | Home page | hero, search with instant-match suggestions, universe wall; the 60-second promise starts here | 2h |
| 8 | Build theater | polling screen, rotating status lines, fail/retry state | 1h |
| 9 | Quiz UI | QuestionCard, TimerRing (15s), StreakMeter, reveal states, ROUND interstitials, mobile-first | 3h |
| 10 | Result reveal | tier computation, name prompt, FighterCard with stat bars + tier belt + roast | 2h |
| 11 | OG image | `next/og` card mirroring FighterCard; verified in WhatsApp preview dimensions | 1h |
| 12 | Challenge flow | `/c/[id]` landing, fresh-set quiz, VS compare view, chain support | 1.5h |
| 13 | MCP server | `mcp-handler` route over the service layer, 6 tools, `docs/mcp.md` with Claude Desktop config | 1.5h |
| 14 | Polish pass | motion timing, empty/error states, loading skeletons, a11y pass (reduced-motion honored), lighthouse sanity | 2h |
| 15 | Ship | GitHub repo, Vercel project, env vars, prod migration, seed 15 launch fandoms, smoke test the full loop on prod | 1h |

**Seed list (15):** BoJack Horseman, The Office, Naruto, Breaking Bad, Friends, One Piece,
Harry Potter, Star Wars, Taylor Swift, Attack on Titan, Rick and Morty, Game of Thrones,
Brooklyn Nine-Nine, Marvel Cinematic Universe, SpongeBob SquarePants.

## 6. Environment

```
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"   # runtime (pooled)
DIRECT_URL="postgresql://.../neondb?sslmode=require"               # migrations
GEMINI_API_KEY="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"                        # prod: Vercel URL
DAILY_BUILD_CEILING="200"
```

## 7. Out of scope (v1)
Accounts/auth, leaderboards beyond 1-v-1 compare, audio, non-quote question types
(episode trivia etc.), moderation/reporting, i18n, native share images beyond OG.
