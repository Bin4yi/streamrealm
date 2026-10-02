import { describe, expect, it } from '@jest/globals';

import {
  agreement,
  AGREEMENT_THRESHOLD,
  classifyAction,
  healthScore,
  isFarming,
  POINTS,
  previewPoints,
  resolveByMajority,
  streakBonus,
  tileState,
  type Answers,
} from '../gameRules';

const DAY = 86_400_000;
const now = new Date('2026-10-02T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY);

const clean: Answers = { color: 'clear', smell: 'none', foam: 'none', trash: 'none', flow: 'flowing', overall: 'good' };
const dirty: Answers = { color: 'brown', smell: 'bad', foam: 'a_lot', trash: 'a_lot', flow: 'still', overall: 'poor' };

describe('tile state from time', () => {
  it('is fog when never checked', () => expect(tileState(null, false, now)).toBe('fog'));
  it('is fresh up to 7 days', () => {
    expect(tileState(ago(0.1), false, now)).toBe('owned_fresh');
    expect(tileState(ago(7), false, now)).toBe('owned_fresh');
  });
  it('fades between 7 and 14 days', () => {
    expect(tileState(ago(7.01), false, now)).toBe('owned_fading');
    expect(tileState(ago(14), false, now)).toBe('owned_fading');
  });
  it('becomes neutral after 14 days', () => expect(tileState(ago(14.01), false, now)).toBe('neutral'));
  it('stays disputed whatever the age', () => expect(tileState(ago(30), true, now)).toBe('disputed'));
});

describe('actions and points', () => {
  it('classifies each case', () => {
    expect(classifyAction('fog', null, 'otters')).toBe('explore');
    expect(classifyAction('neutral', 'frogs', 'otters')).toBe('claim_neutral');
    expect(classifyAction('owned_fresh', 'otters', 'otters')).toBe('refresh');
    expect(classifyAction('owned_fading', 'frogs', 'otters')).toBe('attack');
    expect(classifyAction('disputed', 'frogs', 'otters')).toBe('confirm_dispute');
  });
  it('uses the brief numbers', () => {
    expect(POINTS).toEqual({ explore: 50, claim_neutral: 25, refresh: 20, attack: 30, confirm_dispute: 15, treasure: 40 });
  });
  it('doubles points in a Storm Quest', () => {
    expect(previewPoints('explore', false)).toBe(50);
    expect(previewPoints('explore', true)).toBe(100);
  });
  it('caps the streak bonus at 50', () => {
    expect(streakBonus(1)).toBe(10);
    expect(streakBonus(3)).toBe(30);
    expect(streakBonus(9)).toBe(50);
  });
});

describe('agreement score', () => {
  it('is 1 for identical answers and 0 for opposite ones', () => {
    expect(agreement(clean, clean)).toBe(1);
    expect(agreement(clean, dirty)).toBe(0);
  });
  it('gives half credit to neighbours on ordered scales', () => {
    const b = { ...clean, foam: 'a_little' as const };
    expect(agreement(clean, b)).toBe(0.92);
  });
  it('4 of 6 equal answers is enough to win an attack', () => {
    const b: Answers = { ...clean, color: 'brown', smell: 'bad' };
    expect(agreement(clean, b)).toBe(0.67);
    expect(agreement(clean, b)).toBeGreaterThanOrEqual(AGREEMENT_THRESHOLD);
    const c: Answers = { ...b, flow: 'dry' };
    expect(agreement(clean, c)).toBeLessThan(AGREEMENT_THRESHOLD);
  });
});

describe('dispute resolution', () => {
  it('the side closer to the third check wins', () => {
    expect(resolveByMajority(clean, dirty, { ...dirty, overall: 'moderate' })).toBe('attacker');
    expect(resolveByMajority(clean, dirty, { ...clean, foam: 'a_little' })).toBe('defender');
  });
  it('a tie goes to the defender', () => {
    const third: Answers = { color: 'clear', smell: 'none', foam: 'none', trash: 'a_lot', flow: 'still', overall: 'poor' };
    expect(resolveByMajority(clean, dirty, third)).toBe('defender');
  });
});

describe('anti-farming', () => {
  it('blocks points for a re-check within 6 hours', () => {
    expect(isFarming(new Date(now.getTime() - 5 * 3_600_000), now)).toBe(true);
    expect(isFarming(new Date(now.getTime() - 7 * 3_600_000), now)).toBe(false);
    expect(isFarming(null, now)).toBe(false);
  });
});

describe('health score', () => {
  it('is 100 for a clean stream and 0 for a very dirty one', () => {
    expect(healthScore(clean)).toBe(100);
    expect(healthScore(dirty)).toBe(0);
  });
  it('subtracts the documented penalties', () => {
    expect(healthScore({ ...clean, color: 'slightly_cloudy', foam: 'a_little', trash: 'a_few' })).toBe(70);
  });
});
