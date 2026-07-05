import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { VolunteerLevel } from '@/components/ui/level-progress';

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

  // Fallback mappings for old data
  bronze: { color: 'bg-slate-500', icon: '👀' },
  silver: { color: 'bg-slate-500', icon: '👀' },
  gold: { color: 'bg-blue-500', icon: '📋' },
  platinum: { color: 'bg-purple-600', icon: '👑' },
  diamond: { color: 'bg-purple-600', icon: '👑' },
  newbie: { color: 'bg-slate-500', icon: '👀' },
  active: { color: 'bg-slate-500', icon: '👀' },
};

const sizeClasses = {
  sm: 'h-6 px-2.5 text-xs gap-1',
  md: 'h-8 px-3 text-sm gap-1.5',
  lg: 'h-10 px-4 text-base gap-2',
};

const iconSizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export const LevelBadge = memo(function LevelBadge({ level, size = 'md', showLabel = true, className }: LevelBadgeProps) {
  const { t } = useLanguage();
  // Handle both capitalized and lowercase inputs gracefully
  const normalizedLevel = level?.toLowerCase() || 'under_follow_up';

  // Try direct match first or fallback
  const config = levelConfig[normalizedLevel] || levelConfig['under_follow_up'];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium text-white whitespace-nowrap',
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span className={iconSizes[size]}>{config.icon}</span>
      {showLabel && <span className="truncate">{t(`level.${normalizedLevel}`)}</span>}
    </div>
  );
});
