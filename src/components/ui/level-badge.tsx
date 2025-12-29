import { cn } from '@/lib/utils';

export type VolunteerLevel = 'Newbie' | 'Active' | 'Silver' | 'Golden' | 'Platinum' | 'Diamond';

interface LevelBadgeProps {
  level: VolunteerLevel | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const levelConfig: Record<string, { color: string; icon: string; label: string }> = {
  Newbie: { color: 'bg-level-newbie', icon: '🌱', label: 'Newbie' },
  Active: { color: 'bg-level-active', icon: '⚡', label: 'Active' },
  Silver: { color: 'bg-level-silver', icon: '🥈', label: 'Silver' },
  Golden: { color: 'bg-level-golden', icon: '👑', label: 'Golden' },
  Platinum: { color: 'bg-purple-500', icon: '💎', label: 'Platinum' },
  Diamond: { color: 'bg-cyan-500', icon: '💠', label: 'Diamond' },
};

const sizeClasses = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
};

export function LevelBadge({ level, size = 'md', showLabel = true, className }: LevelBadgeProps) {
  const config = levelConfig[level] || levelConfig['Newbie'];

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
  if (points >= 5000) {
    return { level: 'Diamond', progress: 100, nextThreshold: 5000 };
  } else if (points >= 2500) {
    return { level: 'Platinum', progress: ((points - 2500) / 2500) * 100, nextThreshold: 5000 };
  } else if (points >= 1000) {
    return { level: 'Golden', progress: ((points - 1000) / 1500) * 100, nextThreshold: 2500 };
  } else if (points >= 500) {
    return { level: 'Silver', progress: ((points - 500) / 500) * 100, nextThreshold: 1000 };
  } else if (points >= 100) {
    return { level: 'Active', progress: ((points - 100) / 400) * 100, nextThreshold: 500 };
  } else {
    return { level: 'Newbie', progress: (points / 100) * 100, nextThreshold: 100 };
  }
}
