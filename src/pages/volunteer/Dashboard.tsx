import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/ui/stats-card';
import { LevelBadge, getLevelProgress } from '@/components/ui/level-badge';
import { Link } from 'react-router-dom';
import { Activity, Trophy, Star, ArrowRight } from 'lucide-react';

export default function VolunteerDashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  
  const points = profile?.total_points || 0;
  const { progress, nextThreshold } = getLevelProgress(points);
  const level = profile?.level || 'bronze';
  const activitiesCount = profile?.activities_count || 0;

  // Map database level to display level
  const displayLevel = (dbLevel: string) => {
    const levelMap: Record<string, string> = {
      bronze: 'Newbie',
      silver: 'Silver',
      gold: 'Golden',
      platinum: 'Platinum',
      diamond: 'Diamond',
    };
    return levelMap[dbLevel] || 'Newbie';
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {t('dashboard.welcome')}, {profile?.full_name?.split(' ')[0] || 'Volunteer'}! 👋
          </h1>
          <p className="text-muted-foreground">
            {t('dashboard.totalPoints')}: {points}
          </p>
        </div>
        <Button asChild>
          <Link to="/activity">
            <Activity className="mr-2 h-4 w-4" />
            {t('dashboard.logNewActivity')}
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('dashboard.totalPoints')}
          value={points}
          icon={Star}
          description="Keep earning to level up!"
        />
        <StatsCard
          title={t('dashboard.currentLevel')}
          value={displayLevel(level)}
          icon={Trophy}
          description="Your current tier"
        />
        <StatsCard
          title={t('dashboard.activitiesCompleted')}
          value={activitiesCount}
          icon={Activity}
          description="Completed activities"
        />
        <StatsCard
          title={t('profile.badges')}
          value={0}
          icon={Star}
          description="Achievements earned"
        />
      </div>

      {/* Level Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('profile.pointsProgress')}</CardTitle>
              <CardDescription>Your journey to the next level</CardDescription>
            </div>
            <LevelBadge level={displayLevel(level)} size="lg" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{points} points</span>
              <span>{nextThreshold} points</span>
            </div>
            <Progress value={progress} className="h-3" />
            <p className="text-sm text-muted-foreground">
              {nextThreshold - points} more points to reach the next level
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
              <CardDescription>Get started with these actions</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/activity">
                {t('dashboard.logNewActivity')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/leaderboard">
                {t('dashboard.viewLeaderboard')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/profile">
                {t('nav.profile')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity Placeholder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
              <CardDescription>Your latest submissions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/profile">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              No activities yet. Start logging your contributions!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
