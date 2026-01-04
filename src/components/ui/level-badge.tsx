import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export type VolunteerLevel = 'under_follow_up' | 'project_responsible' | 'responsible';

interface LevelBadgeProps {
  level: VolunteerLevel | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const levelConfig: Record<string, { color: string; icon: string }> = {
  under_follow_up: { color: 'bg-slate-500', icon: '👀' },
  project_responsible: { color: 'bg-blue-500', icon: '📋' },
  responsible: { color: 'bg-purple-600', icon: '👑' },
  // Fallback mappings for old data just in case
  bronze: { color: 'bg-slate-500', icon: '👀' },
  silver: { color: 'bg-slate-500', icon: '👀' },
  gold: { color: 'bg-blue-500', icon: '📋' },
  platinum: { color: 'bg-purple-600', icon: '👑' },
  diamond: { color: 'bg-purple-600', icon: '👑' },
  newbie: { color: 'bg-slate-500', icon: '👀' },
  active: { color: 'bg-slate-500', icon: '👀' },
};

const sizeClasses = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
};

export function LevelBadge({ level, size = 'md', showLabel = true, className }: LevelBadgeProps) {
  const { t } = useLanguage();
  // Handle both capitalized and lowercase inputs gracefully
  const normalizedLevel = level?.toLowerCase() || 'under_follow_up';

  // Try direct match first or fallback
  const config = levelConfig[normalizedLevel] || levelConfig['under_follow_up'];

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
      {showLabel && <span>{t(`level.${normalizedLevel}`)}</span>}
    </div>
  );
}

export function getLevelProgress(points: number): { level: VolunteerLevel; progress: number; nextThreshold: number } {
  // Levels are now manually assigned by HR, so points don't automatically determine level.
  // Returning dummy data regarding level.
  return { level: 'under_follow_up', progress: 0, nextThreshold: 0 };
}
