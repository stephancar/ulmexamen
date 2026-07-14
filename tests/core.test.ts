import { beforeEach, describe, expect, it } from 'vitest';
import { applyAnswer, BOX_INTERVAL_DAYS, isDue, knowledgeScore, MAX_BOX, newSrsState } from '../src/core/srs';
import { buildExamSession, buildLearnSession, buildWeakSession, grade } from '../src/core/session';
import { mergeBanks, parseImport, validateQuestions } from '../src/core/bank';
import { readiness, subjectStats } from '../src/core/stats';
import * as store from '../src/core/store';
import { mulberry32 } from '../src/core/rng';
import { BANK } from '../src/data';
import type { Question, SimResult, SrsState } from '../src/core/types';
import { SUBJECTS } from '../src/core/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe('Leitner SRS', () => {
  it('promotes on correct answers up to the max box', () => {
    let s = newSrsState(NOW);
    for (let i = 1; i <= 6; i++) {
      s = applyAnswer(s, true, NOW);
      expect(s.box).toBe(Math.min(MAX_BOX, i));
    }
    expect(s.streak).toBe(6);
  });

  it('demotes to box 0 on a wrong answer', () => {
    let s = newSrsState(NOW);
    s = applyAnswer(s, true, NOW);
    s = applyAnswer(s, true, NOW);
    s = applyAnswer(s, false, NOW);
    expect(s.box).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.wrong).toBe(1);
  });

  it('sets due dates according to the box interval', () => {
    let s = newSrsState(NOW);
    s = applyAnswer(s, true, NOW); // box 1 -> +1 day
    expect(s.due).toBe(NOW + BOX_INTERVAL_DAYS[1] * DAY);
    expect(isDue(s, NOW)).toBe(false);
    expect(isDue(s, NOW + 1 * DAY)).toBe(true);
  });

  it('unseen cards are always due and rank weakest', () => {
    expect(isDue(undefined, NOW)).toBe(true);
    const known = applyAnswer(newSrsState(NOW), true, NOW);
    expect(knowledgeScore(undefined)).toBeLessThan(knowledgeScore(known));
  });
});

describe('session builders', () => {
  const rng = () => mulberry32(42);

  it('exam session matches the official format exactly for each subject', () => {
    for (const s of SUBJECTS) {
      const { questions, minutes, passPct } = buildExamSession(BANK, s.id, rng());
      expect(questions.length).toBe(s.exam.questions);
      expect(minutes).toBe(s.exam.minutes);
      expect(passPct).toBe(70);
      // no duplicates
      expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
      // all from the right subject
      expect(questions.every((q) => q.subject === s.id)).toBe(true);
      // option order is a permutation of 0..3
      for (const q of questions) {
        expect([...q.order].sort()).toEqual([0, 1, 2, 3]);
      }
    }
  });

  it('learn session serves due cards before unseen and respects topic filter', () => {
    const pool = BANK.filter((q) => q.subject === 'meteo');
    const srs: Record<string, SrsState> = {};
    // Mark two specific cards as due (wrong answers long ago).
    srs[pool[0].id] = applyAnswer(newSrsState(NOW - 10 * DAY), false, NOW - 10 * DAY);
    srs[pool[1].id] = applyAnswer(newSrsState(NOW - 10 * DAY), false, NOW - 10 * DAY);
    const session = buildLearnSession(pool, srs, 10, NOW, mulberry32(7));
    const ids = session.map((q) => q.id);
    expect(ids).toContain(pool[0].id);
    expect(ids).toContain(pool[1].id);

    const topic = pool[0].topic;
    const filtered = buildLearnSession(pool, {}, 50, NOW, mulberry32(7), topic);
    expect(filtered.every((q) => q.topic === topic)).toBe(true);
  });

  it('weak session prefers unseen and low-box cards', () => {
    const pool = BANK.filter((q) => q.subject === 'wetgeving');
    const srs: Record<string, SrsState> = {};
    // Make everything known & strong except three cards.
    for (const q of pool) {
      let s = newSrsState(NOW - 30 * DAY);
      for (let i = 0; i < 5; i++) s = applyAnswer(s, true, NOW - 30 * DAY);
      srs[q.id] = s;
    }
    delete srs[pool[3].id];
    srs[pool[5].id] = applyAnswer(newSrsState(NOW), false, NOW);
    srs[pool[7].id] = applyAnswer(newSrsState(NOW), false, NOW);

    const session = buildWeakSession(pool, srs, 3, NOW, mulberry32(1));
    const ids = session.map((q) => q.id);
    expect(ids).toContain(pool[3].id);
    expect(ids).toContain(pool[5].id);
    expect(ids).toContain(pool[7].id);
  });

  it('grading maps shuffled options back to the original correct index', () => {
    const { questions } = buildExamSession(BANK, 'mens', mulberry32(9));
    // Answer everything correctly via the order mapping.
    const selections = questions.map((q) => q.order.indexOf(q.correct));
    const result = grade(questions, selections);
    expect(result.correct).toBe(questions.length);
    expect(result.pct).toBe(100);

    // Unanswered questions count as wrong.
    const none = grade(questions, questions.map(() => null));
    expect(none.correct).toBe(0);
  });
});

describe('bank merge & import', () => {
  it('merges custom questions and de-duplicates ids', () => {
    const custom: Question[] = [
      {
        id: BANK[0].id, // deliberately clashing
        subject: 'meteo',
        topic: 'eigen',
        q: 'Eigen vraag over meteo met voldoende lengte?',
        options: ['A', 'B', 'C', 'D'],
        correct: 0,
        explain: 'Uitleg van minstens tien tekens.',
      },
    ];
    const merged = mergeBanks(BANK, custom);
    expect(merged.length).toBe(BANK.length + 1);
    expect(new Set(merged.map((q) => q.id)).size).toBe(merged.length);
    expect(merged[merged.length - 1].custom).toBe(true);
  });

  it('parseImport accepts valid JSON and rejects malformed questions', () => {
    const ok = parseImport(
      JSON.stringify([
        {
          subject: 'navigatie',
          q: 'Hoeveel meter is één zeemijl ongeveer?',
          options: ['1000', '1852', '1609', '2000'],
          correct: 1,
        },
      ]),
    );
    expect(ok.length).toBe(1);
    expect(ok[0].custom).toBe(true);
    expect(validateQuestions(ok).filter((i) => !i.problem.startsWith('uitleg'))).toEqual([]);

    expect(() => parseImport('not json')).toThrow(/JSON/);
    expect(() =>
      parseImport(JSON.stringify([{ subject: 'meteo', q: 'Te weinig opties?', options: ['A', 'B'], correct: 0 }])),
    ).toThrow(/probleem/);
  });
});

describe('stats & readiness', () => {
  it('computes coverage and rolling accuracy', () => {
    const pool = BANK.filter((q) => q.subject === 'communicatie');
    const srs: Record<string, SrsState> = {};
    srs[pool[0].id] = applyAnswer(newSrsState(NOW), true, NOW);
    srs[pool[1].id] = applyAnswer(newSrsState(NOW), false, NOW);
    const answers = [
      { questionId: pool[0].id, subject: 'communicatie' as const, correct: true, at: NOW },
      { questionId: pool[1].id, subject: 'communicatie' as const, correct: false, at: NOW },
    ];
    const st = subjectStats('communicatie', BANK, srs, answers, []);
    expect(st.seen).toBe(2);
    expect(st.rollingPct).toBe(50);
    expect(st.coveragePct).toBeCloseTo((2 / pool.length) * 100, 5);
  });

  it('readiness verdicts follow the thresholds', () => {
    const sim = (pct: number): SimResult => ({
      subject: 'meteo',
      at: NOW,
      total: 20,
      correct: Math.round((pct / 100) * 20),
      pct,
      passed: pct >= 70,
      secondsUsed: 100,
    });
    expect(readiness(0, null, [])).toBe('start');
    expect(readiness(30, 50, [sim(40)])).toBe('oefenen');
    expect(readiness(65, 80, [sim(75)])).toBe('bijna');
    expect(readiness(85, 90, [sim(85), sim(82), sim(88)])).toBe('klaar');
  });
});

describe('store', () => {
  beforeEach(() => store._clearMemory());

  it('round-trips data in the in-memory fallback', () => {
    const d = store.load();
    d.flagged.push('wet-001');
    d.sims.push({ subject: 'meteo', at: NOW, total: 20, correct: 15, pct: 75, passed: true, secondsUsed: 900 });
    store.save(d);
    const again = store.load();
    expect(again.flagged).toContain('wet-001');
    expect(again.sims.length).toBe(1);
  });

  it('caps the answer log at 5000 entries', () => {
    const d = store.load();
    for (let i = 0; i < 5200; i++) {
      d.answers.push({ questionId: `x${i}`, subject: 'meteo', correct: true, at: NOW + i });
    }
    store.save(d);
    expect(store.load().answers.length).toBe(5000);
    expect(store.load().answers[0].questionId).toBe('x200');
  });

  it('resetProgress keeps custom questions', () => {
    const d = store.load();
    d.customQuestions.push({
      id: 'eigen-1',
      subject: 'meteo',
      topic: 'eigen',
      q: 'Bewaarde eigen vraag na reset?',
      options: ['A', 'B', 'C', 'D'],
      correct: 2,
      explain: 'Blijft bestaan na reset.',
      custom: true,
    });
    d.flagged.push('wet-002');
    store.save(d);
    const fresh = store.resetProgress();
    expect(fresh.customQuestions.length).toBe(1);
    expect(fresh.flagged).toEqual([]);
  });
});
