import { describe, expect, it } from 'vitest';
import { BANK } from '../src/data';
import { validateQuestions, missingSubjects, topicsOf, bySubject } from '../src/core/bank';
import { SUBJECTS } from '../src/core/types';
import { buildLearnSession } from '../src/core/session';
import { mulberry32 } from '../src/core/rng';

/** Data QA: the bank itself is tested like code. */
describe('question bank quality', () => {
  it('has zero validation issues (ids, options, correct index, explanations)', () => {
    const issues = validateQuestions(BANK);
    expect(issues, JSON.stringify(issues.slice(0, 10), null, 2)).toEqual([]);
  });

  it('covers every subject', () => {
    expect(missingSubjects(BANK)).toEqual([]);
  });

  it('meets the minimum size per subject (exam format must be drawable with variety)', () => {
    const minimums: Record<string, number> = {
      wetgeving: 50,
      meteo: 50,
      mens: 30,
      communicatie: 30,
      aerodynamica: 35,
      techniek: 35,
      navigatie: 35,
    };
    for (const s of SUBJECTS) {
      const n = bySubject(BANK, s.id).length;
      expect(n, `${s.id} heeft ${n} vragen`).toBeGreaterThanOrEqual(minimums[s.id]);
      // and at least 1.5x the exam draw so simulations vary
      expect(n).toBeGreaterThanOrEqual(Math.ceil(s.exam.questions * 1.5));
    }
  });

  it('every subject has at least 3 topics for filtering', () => {
    for (const s of SUBJECTS) {
      const topics = topicsOf(bySubject(BANK, s.id));
      expect(topics.length, `${s.id}: ${topics.join(', ')}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('presented answer positions are unbiased (options are shuffled per session)', () => {
    // Source data may have positional bias; what matters is what the user
    // sees. Build sessions over the whole bank and count where the correct
    // option lands after shuffling.
    const counts = [0, 0, 0, 0];
    const session = buildLearnSession(BANK, {}, BANK.length, Date.now(), mulberry32(2026));
    for (const q of session) {
      counts[q.order.indexOf(q.correct)]++;
    }
    // Each of the four positions should get roughly a quarter (15–35%).
    for (const c of counts) {
      expect(c).toBeGreaterThan(BANK.length * 0.15);
      expect(c).toBeLessThan(BANK.length * 0.35);
    }
  });
});
