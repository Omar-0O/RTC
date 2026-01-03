import { cn } from '@/lib/utils';

export type VolunteerLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

interface LevelBadgeProps {
  level: VolunteerLevel | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const levelConfig: Record<string, { color: string; icon: string; label: string }> = {
  bronze: { color: 'bg-level-newbie', icon: '🕊️', label: 'Mubadir' },
  silver: { color: 'bg-level-active', icon: '🎓', label: 'Musahim' },
  gold: { color: 'bg-level-silver', icon: '📚', label: 'Moather' },
  platinum: { color: 'bg-level-golden', icon: '🏅', label: 'Qaed Molhem' },
  diamond: { color: 'bg-level-golden', icon: '🏅', label: 'Qaed Molhem' },
  // Fallbacks for older cap values if any
  Newbie: { color: 'bg-level-newbie', icon: '🕊️', label: 'Mubadir' },
  Active: { color: 'bg-level-active', icon: '🎓', label: 'Musahim' },
  Silver: { color: 'bg-level-silver', icon: '📚', label: 'Moather' },
  Golden: { color: 'bg-level-golden', icon: '🏅', label: 'Qaed Molhem' },
};

const sizeClasses = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
};

export function LevelBadge({ level, size = 'md', showLabel = true, className }: LevelBadgeProps) {
  // Handle both capitalized and lowercase inputs gracefully
  const normalizedLevel = level.toLowerCase();
  // Try direct match first (for 'Newbie' etc defined above) or normalized match
  const config = levelConfig[level] || levelConfig[normalizedLevel] || levelConfig['bronze'];

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
  if (points > 351) {
    return { level: 'Platinum', progress: 100, nextThreshold: 351 };
  } else if (points > 151) {
    // 151 to 350
    return { level: 'Gold', progress: ((points - 151) / 200) * 100, nextThreshold: 351 };
  } else if (points > 51) {
    // 51 to 150
    return { level: 'Silver', progress: ((points - 51) / 100) * 100, nextThreshold: 151 };
  } else {
    // 0 to 50
    return { level: 'Bronze', progress: (points / 51) * 100, nextThreshold: 51 };
  }
}
