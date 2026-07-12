import { db } from "@/lib/db";
import type { Question } from "@prisma/client";

// 10 questions per quiz: 3 easy / 4 mid / 3 hard (PLAN.md's difficulty curve).
const CURVE: Record<number, number> = { 1: 3, 2: 4, 3: 3 };
const QUIZ_SIZE = 10;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks a 10-question quiz respecting the difficulty curve, excluding a
 * given set of question ids where possible (challenge mode — a fresh set
 * for whoever's being challenged). Falls back gracefully rather than
 * failing outright: exclusions are allowed to overlap if a difficulty
 * bucket runs short, and difficulty buckets borrow from each other if the
 * universe's bank doesn't have enough of one tier (see PLAN.md's challenge
 * semantics — "fall back to allowing overlap if the bank is small").
 */
export async function selectQuizQuestions(
  universeId: string,
  excludeIds: string[] = [],
): Promise<Question[]> {
  const all = await db.question.findMany({ where: { universeId } });
  if (all.length <= QUIZ_SIZE) return shuffle(all);

  const excluded = new Set(excludeIds);
  const byDifficulty = new Map<number, Question[]>();
  for (const q of all) {
    const list = byDifficulty.get(q.difficulty) ?? [];
    list.push(q);
    byDifficulty.set(q.difficulty, list);
  }

  const picked: Question[] = [];
  const pickedIds = new Set<string>();
  let shortfall = 0;

  for (const [difficulty, wanted] of Object.entries(CURVE)) {
    const pool = shuffle(byDifficulty.get(Number(difficulty)) ?? []);
    const fresh = pool.filter((q) => !excluded.has(q.id));
    const reused = pool.filter((q) => excluded.has(q.id));

    const take = [...fresh, ...reused].slice(0, wanted);
    for (const q of take) {
      picked.push(q);
      pickedIds.add(q.id);
    }
    shortfall += wanted - take.length;
  }

  // A difficulty bucket came up short (universe doesn't have enough of that
  // tier) — backfill from whatever's left, any difficulty, still preferring
  // non-excluded questions first.
  if (shortfall > 0) {
    const remaining = shuffle(all.filter((q) => !pickedIds.has(q.id)));
    const fresh = remaining.filter((q) => !excluded.has(q.id));
    const reused = remaining.filter((q) => excluded.has(q.id));
    for (const q of [...fresh, ...reused]) {
      if (picked.length >= QUIZ_SIZE) break;
      picked.push(q);
    }
  }

  return shuffle(picked).slice(0, QUIZ_SIZE);
}
