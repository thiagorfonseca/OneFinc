import { ARCHETYPE_PROFILES } from './archetypeQuestions';
import type { ArchetypePercentages, ArchetypeProfile, ArchetypeScores } from './types';

export const computeScores = (answers: Array<number | null>): ArchetypeScores => {
  const scores: ArchetypeScores = {
    FACILITADOR: 0,
    ANALISTA: 0,
    REALIZADOR: 0,
    VISIONÁRIO: 0,
  };
  answers.forEach((selectedIndex) => {
    if (selectedIndex === null || selectedIndex === undefined) return;
    const profile = ARCHETYPE_PROFILES[selectedIndex] as ArchetypeProfile | undefined;
    if (!profile) return;
    scores[profile] += 1;
  });
  return scores;
};

export const computeTopProfile = (scores: ArchetypeScores) => {
  const entries = Object.entries(scores) as Array<[ArchetypeProfile, number]>;
  const maxScore = Math.max(...entries.map(([, value]) => value));
  const topProfiles = entries.filter(([, value]) => value === maxScore).map(([profile]) => profile);
  if (topProfiles.length > 1) {
    return { topProfile: 'EMPATE' as const, topProfiles };
  }
  return { topProfile: topProfiles[0], topProfiles };
};

export const computePercentages = (scores: ArchetypeScores, total = 40): ArchetypePercentages => {
  const safeTotal = total > 0 ? total : 1;
  const percentages: ArchetypePercentages = {
    FACILITADOR: 0,
    ANALISTA: 0,
    REALIZADOR: 0,
    VISIONÁRIO: 0,
  };
  (Object.keys(percentages) as ArchetypeProfile[]).forEach((profile) => {
    percentages[profile] = (scores[profile] / safeTotal) * 100;
  });
  return percentages;
};
