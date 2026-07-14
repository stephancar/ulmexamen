import type { AnswerRecord, Question, SimResult, SrsState } from './types';

const KEY = 'ulmexamen.v2';
const SCHEMA = 1;

export interface SaveData {
  schema: number;
  srs: Record<string, SrsState>;
  answers: AnswerRecord[];
  sims: SimResult[];
  customQuestions: Question[];
  flagged: string[];
}

function empty(): SaveData {
  return { schema: SCHEMA, srs: {}, answers: [], sims: [], customQuestions: [], flagged: [] };
}

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** In-memory fallback so the core stays testable without a DOM. */
let memory: SaveData | null = null;

export function load(): SaveData {
  if (!hasStorage()) return memory ?? (memory = empty());
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.schema !== SCHEMA) return migrate(parsed);
    return {
      schema: SCHEMA,
      srs: parsed.srs ?? {},
      answers: parsed.answers ?? [],
      sims: parsed.sims ?? [],
      customQuestions: parsed.customQuestions ?? [],
      flagged: parsed.flagged ?? [],
    };
  } catch {
    return empty();
  }
}

function migrate(old: Partial<SaveData>): SaveData {
  // Only schema 1 exists today; unknown data starts fresh but keeps custom
  // questions if they look valid.
  const fresh = empty();
  if (Array.isArray(old.customQuestions)) fresh.customQuestions = old.customQuestions;
  return fresh;
}

export function save(data: SaveData): void {
  // Cap the answer log so storage cannot grow without bound.
  if (data.answers.length > 5000) data.answers = data.answers.slice(-5000);
  if (!hasStorage()) {
    memory = data;
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full/blocked — non-fatal
  }
}

export function exportJson(): string {
  return JSON.stringify(load(), null, 2);
}

export function importJson(json: string): SaveData {
  const parsed = JSON.parse(json) as Partial<SaveData>;
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Ongeldig backup-bestand.');
  const data: SaveData = {
    schema: SCHEMA,
    srs: parsed.srs ?? {},
    answers: parsed.answers ?? [],
    sims: parsed.sims ?? [],
    customQuestions: parsed.customQuestions ?? [],
    flagged: parsed.flagged ?? [],
  };
  save(data);
  return data;
}

export function resetProgress(): SaveData {
  const data = load();
  const fresh = empty();
  fresh.customQuestions = data.customQuestions; // keep the user's own questions
  save(fresh);
  return fresh;
}

/** test hook */
export function _clearMemory(): void {
  memory = null;
}
