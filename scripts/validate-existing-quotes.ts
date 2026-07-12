import { db } from "../src/lib/db";
import { quoteRevealsAnswer, isGenericQuote } from "../src/lib/builder/quality";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const universes = await db.universe.findMany({ where: { status: "READY" } });

  let totalRemoved = 0;
  for (const universe of universes) {
    const questions = await db.question.findMany({ where: { universeId: universe.id } });

    const selfAnswering = questions.filter((q) => quoteRevealsAnswer(q.quote, q.answer));
    const generic = questions.filter((q) => isGenericQuote(q.quote));
    const idsToRemove = new Set([...selfAnswering, ...generic].map((q) => q.id));

    if (idsToRemove.size > 0 && !DRY_RUN) {
      await db.question.deleteMany({ where: { id: { in: [...idsToRemove] } } });
    }

    console.log(
      `${universe.name} (${universe.slug}): ${questions.length} total, ` +
        `${selfAnswering.length} self-answering, ${generic.length} generic, ` +
        `${idsToRemove.size} removed (overlap: ${selfAnswering.length + generic.length - idsToRemove.size}), ` +
        `${questions.length - idsToRemove.size} remain`,
    );
    if (selfAnswering.length > 0) {
      console.log(`  self-answering examples:`, selfAnswering.slice(0, 3).map((q) => `"${q.quote}" (${q.answer})`));
    }
    if (generic.length > 0) {
      console.log(`  generic examples:`, generic.slice(0, 3).map((q) => `"${q.quote}"`));
    }

    totalRemoved += idsToRemove.size;
  }

  console.log(`\n${DRY_RUN ? "[DRY RUN] Would remove" : "Removed"} ${totalRemoved} across all universes.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
