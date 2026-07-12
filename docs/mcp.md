# STAN MCP server

STAN exposes its core loop — search, build, quiz, grade, results — as an MCP server, so an
assistant like Claude can play STAN (or build a new fandom into it) directly, without a browser.
It's not a separate backend: every tool below calls the exact same `src/lib/` functions the web
app's own API routes call. There's no logic duplicated between "the app" and "the MCP server" —
it's one service layer with two front doors.

## Endpoint

```
https://<your-deployment>/api/mcp
```

(Local dev: `http://localhost:3000/api/mcp`.)

Streamable HTTP transport (the current MCP spec's recommended transport) — no separate SSE
endpoint to configure.

## Tools

| Tool | Purpose |
|---|---|
| `search_universes` | Fuzzy-search existing universes by name (or list the most recent ones with no query). |
| `build_universe` | Find-or-build a universe by fandom name. Returns fast if it already exists; a fresh build (scrape + Gemini) can take up to a minute. |
| `get_universe_status` | Check whether a universe (by slug) is building, ready, or failed. |
| `start_quiz` | Get a fresh 10-question quiz for a ready universe. Options never reveal which one is correct. Pass `exclude` (question ids) for a zero-overlap rematch, same mechanic the web app's challenge flow uses. |
| `grade_quiz` | Submit picks; grades server-side and creates a real, shareable STAN result (same `Result` row the web app creates — it gets a real `/r/[id]` page). Pass `challengeOf` to record it as a challenge. |
| `get_result` | Fetch a previously graded result — score, tier, roast, stats, and its parent if it was a challenge. |

The correct answer is never returned by `start_quiz` — only `grade_quiz`'s response reveals
whether each pick was right, same security posture as the web quiz (the client never has the
answer beforehand).

## Claude Desktop setup

Streamable HTTP-capable clients can connect directly:

```json
{
  "mcpServers": {
    "stan": {
      "url": "https://<your-deployment>/api/mcp"
    }
  }
}
```

Claude Desktop currently speaks stdio to local MCP servers, not remote HTTP directly — bridge it
with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote), added to
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stan": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<your-deployment>/api/mcp"]
    }
  }
}
```

For local development, point the URL at `http://localhost:3000/api/mcp` instead.

## Example: play a full quiz over MCP

1. `search_universes` (empty query) → pick a slug from the list, or `build_universe` a new one.
2. `start_quiz` with that slug → 10 questions, each with 2-4 options depending on format
   (`"duel"` for the 3 hardest, `"options"` for the rest).
3. For each question, decide a pick and record `{ questionId, picked, ms }`.
4. `grade_quiz` with all 10 answers → a real result id.
5. `get_result` with that id → score, tier, roast — or open `/r/<id>` in a browser, since it's
   the same page a human player lands on.

## Notes

- No accounts, no auth on the MCP endpoint — matches the rest of the app (see PLAN.md's
  out-of-scope list). Don't expose credentials or rate-limit-sensitive operations here beyond
  what `build_universe` already inherits from the app's daily build ceiling.
- `build_universe` shares the app's Gemini daily budget — a burst of MCP-triggered builds counts
  against the same cap the web app's "at capacity" message refers to.
