import { cn } from '@/lib/utils';
import { VolunteerLevel } from '@/types';

interface LevelBadgeProps {
  level: VolunteerLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const levelConfig: Record<VolunteerLevel, { color: string; icon: string; label: string }> = {
  Newbie: { color: 'bg-level-newbie', icon: '🌱', label: 'Newbie' },
  Active: { color: 'bg-level-active', icon: '⚡', label: 'Active' },
  Silver: { color: 'bg-level-silver', icon: '🥈', label: 'Silver' },
  Golden: { color: 'bg-level-golden', icon: '👑', label: 'Golden' },
};

const sizeClasses = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
};

export function LevelBadge({ level, size = 'md', showLabel = true, className }: LevelBadgeProps) {
  const config = levelConfig[level];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium text-white',
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

export function getLevelProgress(points: number): { level: VolunteerLevel; progress: number; nextThreshold: number } {
  if (points >= 200) {
    return { level: 'Golden', progress: 100, nextThreshold: 200 };
  } else if (points >= 100) {
    return { level: 'Silver', progress: ((points - 100) / 100) * 100, nextThreshold: 200 };
  } else if (points >= 50) {
    return { level: 'Active', progress: ((points - 50) / 50) * 100, nextThreshold: 100 };
  } else {
    return { level: 'Newbie', progress: (points / 50) * 100, nextThreshold: 50 };
  }
}
