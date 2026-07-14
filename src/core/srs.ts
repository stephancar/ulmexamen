import type { SrsState } from './types';

/**
 * Leitner system with 5 boxes. Correct -> next box; wrong -> back to box 0.
 * Interval per box in days; box 0 is due immediately.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14] as const;
export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export function newSrsState(now: number): SrsState {
  return { box: 0, due: now, seen: 0, correct: 0, wrong: 0, streak: 0 };
}

export function applyAnswer(state: SrsState, correct: boolean, now: number): SrsState {
  const next: SrsState = { ...state };
  next.seen += 1;
  if (correct) {
    next.correct += 1;
    next.streak += 1;
    next.box = Math.min(MAX_BOX, next.box + 1);
  } else {
    next.wrong += 1;
    next.streak = 0;
    next.box = 0;
  }
  next.due = now + BOX_INTERVAL_DAYS[next.box] * DAY_MS;
  return next;
}

export function isDue(state: SrsState | undefined, now: number): boolean {
  if (!state) return true; // unseen cards are always available
  return state.due <= now;
}

/** Lower = weaker knowledge; used to rank cards for weak-point sessions. */
export function knowledgeScore(state: SrsState | undefined): number {
  if (!state || state.seen === 0) return -1; // unseen sorts before everything known
  return state.box + Math.min(0.9, state.correct / Math.max(1, state.seen));
}
