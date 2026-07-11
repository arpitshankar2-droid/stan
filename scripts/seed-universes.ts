import { buildUniverse } from "../src/lib/builder/pipeline";
import { db } from "../src/lib/db";

// Batch 1 — the only 3 seed-list fandoms verified (live, not just non-zero
// count) to have real, main-cast-representative scraped quotes. See
// PROGRESS.md's Task 4 follow-up for the investigation and the full list of
// candidates that didn't clear the bar.
const BATCH_1 = ["Breaking Bad", "BoJack Horseman", "The Office"];

async function main() {
  const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : BATCH_1;

  for (const name of targets) {
    process.stdout.write(`\nBuilding "${name}"... `);
    const t0 = Date.now();
    const outcome = await buildUniverse(name);
    const ms = Date.now() - t0;

    if (outcome.status === "ready") {
      const universe = await db.universe.findUniqueOrThrow({
        where: { id: outcome.universeId },
        include: { _count: { select: { questions: true } } },
      });
      console.log(
        `READY in ${ms}ms — slug=${universe.slug}, source=${universe.source}, ` +
          `questions=${universe._count.questions}`,
      );
    } else if (outcome.status === "failed") {
      console.log(`FAILED: ${outcome.reason}`);
    } else {
      console.log(outcome.status);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
