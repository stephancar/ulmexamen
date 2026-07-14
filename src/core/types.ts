/** Subject identifiers. The first four are the official DGLV computer exam. */
export type SubjectId =
  | 'wetgeving'
  | 'meteo'
  | 'mens'
  | 'communicatie'
  | 'aerodynamica'
  | 'techniek'
  | 'navigatie';

export interface SubjectInfo {
  id: SubjectId;
  name: string;
  short: string;
  /** official DGLV computer exam vs school theory */
  official: boolean;
  exam: {
    questions: number;
    minutes: number;
    passPct: number;
  };
}

export const SUBJECTS: SubjectInfo[] = [
  {
    id: 'wetgeving',
    name: 'Luchtvaartwetgeving',
    short: 'Wetgeving',
    official: true,
    exam: { questions: 20, minutes: 40, passPct: 70 },
  },
  {
    id: 'meteo',
    name: 'Meteorologie',
    short: 'Meteo',
    official: true,
    exam: { questions: 20, minutes: 40, passPct: 70 },
  },
  {
    id: 'mens',
    name: 'Menselijke prestaties',
    short: 'Mens. prestaties',
    official: true,
    exam: { questions: 10, minutes: 20, passPct: 70 },
  },
  {
    id: 'communicatie',
    name: 'Communicatie',
    short: 'Communicatie',
    official: true,
    exam: { questions: 10, minutes: 20, passPct: 70 },
  },
  {
    id: 'aerodynamica',
    name: 'Aërodynamica',
    short: 'Aëro',
    official: false,
    exam: { questions: 20, minutes: 40, passPct: 70 },
  },
  {
    id: 'techniek',
    name: 'Techniek',
    short: 'Techniek',
    official: false,
    exam: { questions: 20, minutes: 40, passPct: 70 },
  },
  {
    id: 'navigatie',
    name: 'Navigatie',
    short: 'Navigatie',
    official: false,
    exam: { questions: 20, minutes: 40, passPct: 70 },
  },
];

export function subjectById(id: string): SubjectInfo | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export interface Question {
  /** stable unique id, e.g. "wet-001" or "eigen-<timestamp>" for imports */
  id: string;
  subject: SubjectId;
  /** sub-topic tag, e.g. "luchtruim", "voorrangsregels" */
  topic: string;
  q: string;
  options: string[];
  /** index into options */
  correct: number;
  explain: string;
  /** official source reference, e.g. "SERA.3210" */
  ref?: string;
  /** 1 = basis, 2 = gemiddeld, 3 = pittig */
  difficulty?: 1 | 2 | 3;
  /** true for user-imported questions (never shipped in the repo) */
  custom?: boolean;
}

/** Leitner spaced-repetition state for one question. */
export interface SrsState {
  /** box 0..4 — higher = better known */
  box: number;
  /** epoch ms when the card is due again */
  due: number;
  seen: number;
  correct: number;
  wrong: number;
  /** consecutive correct answers */
  streak: number;
}

export interface AnswerRecord {
  questionId: string;
  subject: SubjectId;
  correct: boolean;
  /** epoch ms */
  at: number;
}

export interface SimResult {
  subject: SubjectId;
  /** epoch ms */
  at: number;
  total: number;
  correct: number;
  pct: number;
  passed: boolean;
  /** seconds actually used */
  secondsUsed: number;
}

export type SessionMode = 'leer' | 'examen' | 'zwak';

export interface SessionQuestion extends Question {
  /** options order for this session (indices into the original options) */
  order: number[];
}
