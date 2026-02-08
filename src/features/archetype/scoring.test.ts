import { describe, expect, it } from 'vitest';
import { computePercentages, computeScores, computeTopProfile } from './scoring';

describe('archetype scoring', () => {
  it('computes scores and top profile correctly', () => {
    const answers = [0, 1, 1, 2, 3, 3, 3, null, null, null];
    const scores = computeScores(answers);
    expect(scores.FACILITADOR).toBe(1);
    expect(scores.ANALISTA).toBe(2);
    expect(scores.REALIZADOR).toBe(1);
    expect(scores.VISIONÁRIO).toBe(3);

    const { topProfile, topProfiles } = computeTopProfile(scores);
    expect(topProfile).toBe('VISIONÁRIO');
    expect(topProfiles).toEqual(['VISIONÁRIO']);

    const percentages = computePercentages(scores, 10);
    expect(percentages.VISIONÁRIO).toBeCloseTo(30);
  });
});
