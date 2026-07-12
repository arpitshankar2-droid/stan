import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { listReadyUniverses, searchUniverses } from "@/lib/universes/query";
import { getUniverseStatus } from "@/lib/universes/status";
import { buildUniverse } from "@/lib/builder/pipeline";
import { selectQuizQuestions } from "@/lib/quiz/select";
import { formatQuestionForClient } from "@/lib/quiz/duel";
import { submitResult } from "@/lib/quiz/submit";
import { getResultViewData } from "@/lib/result-data";

// Same service layer as the app's own API routes (src/lib/) — every tool
// below calls the exact functions the real app calls, nothing reimplemented.
// A fresh build can take up to a minute (scrape + Gemini), same reasoning as
// POST /api/universes's maxDuration.
export const maxDuration = 300;

function json(data: unknown, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], isError };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_universes",
      {
        title: "Search fandom universes",
        description:
          "Fuzzy-search STAN's existing quiz universes by name. Omit query to list the most recently built ones.",
        inputSchema: { query: z.string().optional() },
      },
      async ({ query }) => json(query ? await searchUniverses(query) : await listReadyUniverses()),
    );

    server.registerTool(
      "build_universe",
      {
        title: "Build a fandom universe",
        description:
          "Find-or-build a STAN quiz universe for a fandom by name. Returns immediately if it already exists; " +
          "a fresh build scrapes the fandom's wiki and calls Gemini, which can take up to a minute.",
        inputSchema: { name: z.string().min(1) },
      },
      async ({ name }) => {
        try {
          const lock = await buildUniverse(name);
          if (lock.status === "already_ready") {
            return json({ status: "ready", slug: lock.slug });
          }
          if (lock.start) await lock.start();
          return json(await getUniverseStatus(lock.slug));
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, true);
        }
      },
    );

    server.registerTool(
      "get_universe_status",
      {
        title: "Get universe build status",
        description: "Check whether a STAN universe (by slug) is building, ready, or failed.",
        inputSchema: { slug: z.string().min(1) },
      },
      async ({ slug }) => json(await getUniverseStatus(slug)),
    );

    server.registerTool(
      "start_quiz",
      {
        title: "Start a quiz",
        description:
          "Get a fresh 10-question quiz for a READY universe (by slug). Each question's options never " +
          "reveal which one is correct — grade with grade_quiz once you have picks. Pass `exclude` (question " +
          "ids) to get a set with zero overlap against a previous quiz, e.g. for a rematch.",
        inputSchema: { slug: z.string().min(1), exclude: z.array(z.string()).optional() },
      },
      async ({ slug, exclude }) => {
        const status = await getUniverseStatus(slug);
        if (status.status !== "ready") return json(status, status.status === "not_found");

        const questions = await selectQuizQuestions(status.universe.id, exclude ?? []);
        return json({ universeId: status.universe.id, questions: questions.map(formatQuestionForClient) });
      },
    );

    server.registerTool(
      "grade_quiz",
      {
        title: "Grade a quiz",
        description:
          "Submit picks for a quiz started with start_quiz. Grades server-side against the real answers and " +
          "creates a shareable STAN result (score, tier, roast). Pass `challengeOf` with a prior result id to " +
          "record this as a challenge to that result.",
        inputSchema: {
          universeId: z.string().min(1),
          name: z.string().max(40).optional(),
          challengeOf: z.string().optional(),
          answers: z
            .array(z.object({ questionId: z.string().min(1), picked: z.string().min(1), ms: z.number().nonnegative() }))
            .min(1),
        },
      },
      async ({ universeId, name, challengeOf, answers }) => {
        try {
          const result = await submitResult({
            universeId,
            name: name ?? null,
            challengeOf: challengeOf ?? null,
            answers,
          });
          return json(result);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, true);
        }
      },
    );

    server.registerTool(
      "get_result",
      {
        title: "Get a STAN result",
        description:
          "Fetch a previously graded STAN result by id — score, tier, roast, accuracy/streak/speed stats, " +
          "and the parent result if it was a challenge.",
        inputSchema: { id: z.string().min(1) },
      },
      async ({ id }) => {
        const data = await getResultViewData(id);
        return data ? json(data) : json({ error: "no such result" }, true);
      },
    );
  },
  {
    serverInfo: { name: "stan", version: "0.1.0" },
  },
  {
    basePath: "/api",
    maxDuration: 300,
    verboseLogs: false,
  },
);

export { handler as GET, handler as POST };
