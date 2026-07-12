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
    // buildUniverse only locks the row and hands back the heavy work as
    // `start` — the API route defers that via `after()`, but this script has
    // no HTTP response to defer around, so it just awaits it directly.
    const lock = await buildUniverse(name);

    if (lock.status === "already_ready") {
      console.log(`already READY — slug=${lock.slug}`);
      continue;
    }
    if (!lock.start) {
      console.log(`already building elsewhere — slug=${lock.slug}`);
      continue;
    }

    await lock.start();
    const ms = Date.now() - t0;
    const universe = await db.universe.findUniqueOrThrow({
      where: { id: lock.universeId },
      include: { _count: { select: { questions: true } } },
    });

    if (universe.status === "READY") {
      console.log(
        `READY in ${ms}ms — slug=${universe.slug}, source=${universe.source}, ` +
          `questions=${universe._count.questions}`,
      );
    } else {
      console.log(`FAILED: ${universe.failReason}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
