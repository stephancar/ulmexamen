import type { Question, SubjectId } from './types';
import { SUBJECTS, subjectById } from './types';

export interface BankIssue {
  questionId: string;
  problem: string;
}

/** Validate a set of questions; returns a list of problems (empty = OK). */
export function validateQuestions(questions: Question[]): BankIssue[] {
  const issues: BankIssue[] = [];
  const seen = new Set<string>();

  for (const q of questions) {
    const id = q.id ?? '(zonder id)';
    if (!q.id || typeof q.id !== 'string') issues.push({ questionId: id, problem: 'ontbrekend id' });
    else if (seen.has(q.id)) issues.push({ questionId: id, problem: 'dubbel id' });
    seen.add(q.id);

    if (!subjectById(q.subject)) issues.push({ questionId: id, problem: `onbekend vak: ${q.subject}` });
    if (!q.topic) issues.push({ questionId: id, problem: 'ontbrekend onderwerp' });
    if (!q.q || q.q.trim().length < 10) issues.push({ questionId: id, problem: 'vraagtekst te kort' });

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      issues.push({ questionId: id, problem: 'niet exact 4 antwoordopties' });
    } else {
      const uniq = new Set(q.options.map((o) => o.trim().toLowerCase()));
      if (uniq.size !== 4) issues.push({ questionId: id, problem: 'dubbele antwoordopties' });
      if (q.options.some((o) => !o || !o.trim())) issues.push({ questionId: id, problem: 'lege antwoordoptie' });
    }

    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) {
      issues.push({ questionId: id, problem: `ongeldige correct-index: ${q.correct}` });
    }
    if (!q.explain || q.explain.trim().length < 10) {
      issues.push({ questionId: id, problem: 'uitleg ontbreekt of te kort' });
    }
  }
  return issues;
}

/** Merge shipped bank with custom questions; custom ids get prefixed if clashing. */
export function mergeBanks(shipped: Question[], custom: Question[]): Question[] {
  const ids = new Set(shipped.map((q) => q.id));
  const merged = shipped.slice();
  for (const q of custom) {
    let id = q.id;
    while (ids.has(id)) id = `eigen-${id}`;
    ids.add(id);
    merged.push({ ...q, id, custom: true });
  }
  return merged;
}

export function bySubject(questions: Question[], subject: SubjectId): Question[] {
  return questions.filter((q) => q.subject === subject);
}

export function topicsOf(questions: Question[]): string[] {
  return [...new Set(questions.map((q) => q.topic))].sort((a, b) => a.localeCompare(b, 'nl'));
}

/**
 * Parse user-imported questions from JSON. Accepts either an array of
 * questions or {questions: [...]}. Missing ids/topics get defaults, then the
 * result is validated. Throws with a readable message on malformed input.
 */
export function parseImport(json: string): Question[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Geen geldige JSON.');
  }
  const arr = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { questions?: unknown }).questions)
      ? ((data as { questions: unknown[] }).questions)
      : null;
  if (!arr) throw new Error('Verwacht een lijst van vragen of {"questions": [...]}.');

  const out: Question[] = arr.map((raw, i) => {
    const r = raw as Partial<Question>;
    return {
      id: r.id || `eigen-${Date.now()}-${i}`,
      subject: (r.subject as SubjectId) ?? 'wetgeving',
      topic: r.topic || 'eigen vragen',
      q: r.q ?? '',
      options: r.options ?? [],
      correct: r.correct ?? -1,
      explain: r.explain || 'Eigen vraag — geen uitleg toegevoegd.',
      ref: r.ref,
      difficulty: r.difficulty,
      custom: true,
    };
  });

  const issues = validateQuestions(out).filter((i) => !i.problem.startsWith('uitleg'));
  if (issues.length > 0) {
    const first = issues
      .slice(0, 5)
      .map((i) => `${i.questionId}: ${i.problem}`)
      .join('; ');
    throw new Error(`Import geweigerd (${issues.length} probleem/problemen): ${first}`);
  }
  return out;
}

/** Sanity: which subjects exist in SUBJECTS but have no questions? */
export function missingSubjects(questions: Question[]): SubjectId[] {
  return SUBJECTS.filter((s) => !questions.some((q) => q.subject === s.id)).map((s) => s.id);
}
