import type { Question, SessionQuestion, SrsState, SubjectId } from './types';
import { subjectById } from './types';
import { isDue, knowledgeScore } from './srs';
import { sample, shuffle } from './rng';

function toSessionQuestion(q: Question, rng: () => number): SessionQuestion {
  return { ...q, order: shuffle(q.options.map((_, i) => i), rng) };
}

/** Learn session: due cards first, then unseen, then the rest — n total. */
export function buildLearnSession(
  pool: Question[],
  srs: Record<string, SrsState>,
  n: number,
  now: number,
  rng: () => number = Math.random,
  topic?: string,
): SessionQuestion[] {
  let candidates = topic ? pool.filter((q) => q.topic === topic) : pool.slice();

  const due = candidates.filter((q) => srs[q.id] && isDue(srs[q.id], now));
  const unseen = candidates.filter((q) => !srs[q.id]);
  const rest = candidates.filter((q) => srs[q.id] && !isDue(srs[q.id], now));

  const picked: Question[] = [
    ...sample(due, n, rng),
    ...sample(unseen, Math.max(0, n - due.length), rng),
  ];
  if (picked.length < n) {
    picked.push(...sample(rest, n - picked.length, rng));
  }
  return shuffle(picked.slice(0, n), rng).map((q) => toSessionQuestion(q, rng));
}

/** Exam simulation: exactly the subject's official format, random draw. */
export function buildExamSession(
  pool: Question[],
  subject: SubjectId,
  rng: () => number = Math.random,
): { questions: SessionQuestion[]; minutes: number; passPct: number } {
  const info = subjectById(subject);
  if (!info) throw new Error(`Onbekend vak: ${subject}`);
  const subjectPool = pool.filter((q) => q.subject === subject);
  const questions = sample(subjectPool, info.exam.questions, rng).map((q) => toSessionQuestion(q, rng));
  return { questions, minutes: info.exam.minutes, passPct: info.exam.passPct };
}

/** Weak-point session: rank by knowledge score (unseen/wrong first). */
export function buildWeakSession(
  pool: Question[],
  srs: Record<string, SrsState>,
  n: number,
  now: number,
  rng: () => number = Math.random,
): SessionQuestion[] {
  const ranked = pool
    .slice()
    .sort((a, b) => {
      const ka = knowledgeScore(srs[a.id]);
      const kb = knowledgeScore(srs[b.id]);
      if (ka !== kb) return ka - kb;
      // among equals, due-ness wins, then random
      const da = isDue(srs[a.id], now) ? 0 : 1;
      const db = isDue(srs[b.id], now) ? 0 : 1;
      if (da !== db) return da - db;
      return rng() - 0.5;
    })
    .slice(0, Math.max(n * 2, n)); // take a weak slice, then randomize within it
  return shuffle(sample(ranked, n, rng), rng).map((q) => toSessionQuestion(q, rng));
}

/** Grade a set of answers (selected option index in session order, or null). */
export function grade(
  questions: SessionQuestion[],
  selections: (number | null)[],
): { correct: number; total: number; pct: number; perQuestion: boolean[] } {
  let correct = 0;
  const perQuestion = questions.map((q, i) => {
    const sel = selections[i];
    if (sel === null || sel === undefined) return false;
    const originalIndex = q.order[sel];
    const ok = originalIndex === q.correct;
    if (ok) correct++;
    return ok;
  });
  const total = questions.length || 1;
  return { correct, total, pct: (correct / total) * 100, perQuestion };
}
