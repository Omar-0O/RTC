export type VolunteerLevel = 'under_follow_up' | 'project_responsible' | 'responsible';

export function getLevelProgress(points: number): { level: VolunteerLevel; progress: number; nextThreshold: number } {
  const thresholds = [
    { level: 'bronze', max: 100 },
    { level: 'silver', max: 300 },
    { level: 'gold', max: 600 },
    { level: 'platinum', max: 1000 },
    { level: 'diamond', max: Infinity },
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
