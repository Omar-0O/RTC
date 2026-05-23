import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  variant?: 'default' | 'admin';
}

export const StatsCard = memo(function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  variant = 'default'
}: StatsCardProps) {
  if (variant === 'admin') {
    return (
      <Card className={cn('relative overflow-hidden flex flex-col h-full', className)}>
        <CardHeader className="flex flex-row items-center justify-between !pb-4 !p-3 sm:!p-6 sm:!pb-4 gap-2">
          <CardTitle className="text-sm sm:text-base font-medium text-muted-foreground leading-snug whitespace-normal break-words">
            {title}
          </CardTitle>
          {Icon && (
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
          )}
        </CardHeader>
        <CardContent className="!p-3 !pt-0 sm:!p-6 sm:!pt-0 flex-1 flex flex-col items-center justify-center text-center gap-1 pb-4 sm:pb-6">
          <div className="text-3xl sm:text-4xl font-bold truncate">{value}</div>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>
          )}
          {trend && (
            <p className={cn(
              "text-xs mt-1 font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('relative overflow-hidden flex flex-col h-full', className)}>
      <CardHeader className="!pb-2 !p-3 sm:!p-6 sm:!pb-2">
        <CardTitle className="text-sm sm:text-base font-medium text-muted-foreground leading-snug">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-3 !pt-0 sm:!p-6 sm:!pt-0 flex flex-1 items-end justify-between gap-2">
        <div className="text-2xl sm:text-3xl font-bold truncate">{value}</div>
        {Icon && (
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mb-0.5">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className={cn(
            "text-xs mt-1 font-medium",
            trend.isPositive ? "text-success" : "text-destructive"
          )}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  );
});
