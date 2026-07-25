export type VolunteerLevel = 'under_follow_up' | 'project_responsible' | 'responsible';

export function getLevelProgress(points: number): { level: VolunteerLevel; progress: number; nextThreshold: number } {
  const thresholds: { level: VolunteerLevel; max: number }[] = [
    { level: 'under_follow_up', max: 300 },
    { level: 'project_responsible', max: 600 },
    { level: 'responsible', max: Infinity },
  ];

  let currentLevel = thresholds[0];
  let previousMax = 0;

  for (const threshold of thresholds) {
    if (points < threshold.max) {
      currentLevel = threshold;
      break;
    }
    previousMax = threshold.max;
    if (threshold.max === Infinity) {
      currentLevel = threshold;
    }
  }

  const nextThreshold = currentLevel.max === Infinity ? points : currentLevel.max;
  const range = nextThreshold - previousMax;
  const progressPoints = points - previousMax;
  const progress = range > 0 ? Math.min(100, Math.max(0, (progressPoints / range) * 100)) : 100;

  return {
    level: currentLevel.level as VolunteerLevel,
    progress,
    nextThreshold,
  };
}
