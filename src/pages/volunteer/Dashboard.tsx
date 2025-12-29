import { useAuth } from '@/contexts/AuthContext';
import { VolunteerProfile } from '@/types';
import { mockSubmissions, committees } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/ui/stats-card';
import { LevelBadge, getLevelProgress } from '@/components/ui/level-badge';
import { Link } from 'react-router-dom';
import { Activity, Trophy, Star, Clock, ArrowRight, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VolunteerDashboard() {
  const { user } = useAuth();
  const volunteer = user as VolunteerProfile;
  
  const { progress, nextThreshold } = getLevelProgress(volunteer?.totalPoints || 0);
  const committee = committees.find(c => c.id === volunteer?.committeeId);
  
  // Get recent activities for this volunteer
  const recentActivities = mockSubmissions
    .filter(s => s.volunteerId === volunteer?.id)
    .slice(0, 5);

  const statusIcon = {
    pending: <Clock3 className="h-4 w-4 text-warning" />,
    approved: <CheckCircle2 className="h-4 w-4 text-success" />,
    rejected: <XCircle className="h-4 w-4 text-destructive" />,
  };

  const statusColor = {
    pending: 'text-warning',
    approved: 'text-success',
    rejected: 'text-destructive',
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {volunteer?.name?.split(' ')[0]}! 👋</h1>
          <p className="text-muted-foreground">
            {committee?.name} • Rank #{volunteer?.rank}
          </p>
        </div>
        <Button asChild>
          <Link to="/activity">
            <Activity className="mr-2 h-4 w-4" />
            Log New Activity
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Points"
          value={volunteer?.totalPoints || 0}
          icon={Star}
          description="Keep earning to level up!"
        />
        <StatsCard
          title="Current Rank"
          value={`#${volunteer?.rank || '-'}`}
          icon={Trophy}
          description="Global leaderboard position"
        />
        <StatsCard
          title="Activities"
          value={volunteer?.activitiesCompleted || 0}
          icon={Activity}
          description="Completed activities"
        />
        <StatsCard
          title="Badges"
          value={volunteer?.badges?.length || 0}
          icon={Star}
          description="Achievements earned"
        />
      </div>

      {/* Level Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Level Progress</CardTitle>
              <CardDescription>Your journey to the next level</CardDescription>
            </div>
            <LevelBadge level={volunteer?.level || 'Newbie'} size="lg" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{volunteer?.totalPoints || 0} points</span>
              <span>{nextThreshold} points</span>
            </div>
            <Progress value={progress} className="h-3" />
            <p className="text-sm text-muted-foreground">
              {nextThreshold - (volunteer?.totalPoints || 0)} more points to reach the next level
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest submissions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/profile">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No activities yet. Start logging your contributions!
              </p>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon[activity.status]}
                      <div>
                        <p className="font-medium text-sm">{activity.activityTypeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">+{activity.points} pts</p>
                      <p className={cn("text-xs capitalize", statusColor[activity.status])}>
                        {activity.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Badges */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Badges</CardTitle>
              <CardDescription>Achievements you've earned</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/profile">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {volunteer?.badges?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Complete activities to earn badges!
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {volunteer?.badges?.slice(0, 6).map((badge) => (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50"
                  >
                    <span className="text-3xl mb-2">{badge.icon}</span>
                    <p className="text-xs font-medium">{badge.name}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
