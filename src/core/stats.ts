import type { AnswerRecord, Question, SimResult, SrsState, SubjectId } from './types';

export interface SubjectStats {
  subject: SubjectId;
  bankSize: number;
  seen: number;
  /** 0..100: % of the bank answered at least once */
  coveragePct: number;
  /** 0..100 accuracy over the last `window` answers (null if none) */
  rollingPct: number | null;
  /** last exam sims, newest first */
  sims: SimResult[];
  readiness: Readiness;
}

export type Readiness = 'klaar' | 'bijna' | 'oefenen' | 'start';

const ROLLING_WINDOW = 50;

export function subjectStats(
  subject: SubjectId,
  pool: Question[],
  srs: Record<string, SrsState>,
  answers: AnswerRecord[],
  sims: SimResult[],
): SubjectStats {
  const bank = pool.filter((q) => q.subject === subject);
  const seen = bank.filter((q) => srs[q.id] && srs[q.id].seen > 0).length;
  const coveragePct = bank.length === 0 ? 0 : (seen / bank.length) * 100;

  const recent = answers.filter((a) => a.subject === subject).slice(-ROLLING_WINDOW);
  const rollingPct = recent.length === 0 ? null : (recent.filter((a) => a.correct).length / recent.length) * 100;

  const subjectSims = sims.filter((s) => s.subject === subject).sort((a, b) => b.at - a.at);

  return {
    subject,
    bankSize: bank.length,
    seen,
    coveragePct,
    rollingPct,
    sims: subjectSims,
    readiness: readiness(coveragePct, rollingPct, subjectSims),
  };
}

/**
 * 'klaar'   — last 3 sims all passed with >= 80% AND coverage >= 80%
 * 'bijna'   — last sim passed, or rolling accuracy >= 75% with coverage >= 60%
 * 'oefenen' — some activity but not near the bar yet
 * 'start'   — (almost) nothing done
 */
export function readiness(
  coveragePct: number,
  rollingPct: number | null,
  sims: SimResult[],
): Readiness {
  const last3 = sims.slice(0, 3);
  if (last3.length === 3 && last3.every((s) => s.pct >= 80) && coveragePct >= 80) return 'klaar';
  if ((sims[0]?.passed && sims[0].pct >= 70) || ((rollingPct ?? 0) >= 75 && coveragePct >= 60)) return 'bijna';
  if (coveragePct > 5 || sims.length > 0) return 'oefenen';
  return 'start';
}

export const READINESS_LABEL: Record<Readiness, string> = {
  klaar: 'Klaar voor het examen',
  bijna: 'Bijna klaar — nog even aanscherpen',
  oefenen: 'Blijven oefenen',
  start: 'Nog niet gestart',
};
