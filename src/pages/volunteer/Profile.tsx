import { useAuth } from '@/contexts/AuthContext';
import { VolunteerProfile as VolunteerProfileType } from '@/types';
import { mockSubmissions, committees, badges as allBadges } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { LevelBadge, getLevelProgress } from '@/components/ui/level-badge';
import { CheckCircle2, XCircle, Clock3, Calendar, Mail, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Profile() {
  const { user } = useAuth();
  const volunteer = user as VolunteerProfileType;
  
  const { progress, nextThreshold } = getLevelProgress(volunteer?.totalPoints || 0);
  const committee = committees.find(c => c.id === volunteer?.committeeId);
  const userInitials = volunteer?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  
  // Get all activities for this volunteer
  const activities = mockSubmissions.filter(s => s.volunteerId === volunteer?.id);

  const statusIcon = {
    pending: <Clock3 className="h-4 w-4 text-warning" />,
    approved: <CheckCircle2 className="h-4 w-4 text-success" />,
    rejected: <XCircle className="h-4 w-4 text-destructive" />,
  };

  const statusColor = {
    pending: 'bg-warning/10 text-warning',
    approved: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                <h1 className="text-2xl font-bold">{volunteer?.name}</h1>
                <LevelBadge level={volunteer?.level || 'Newbie'} />
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {volunteer?.email}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {committee?.name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {new Date(volunteer?.joinedAt || '').toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{volunteer?.totalPoints}</div>
              <div className="text-sm text-muted-foreground">Total Points</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Level Progress</CardTitle>
          <CardDescription>
            {nextThreshold - (volunteer?.totalPoints || 0)} more points to reach the next level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{volunteer?.totalPoints || 0} points</span>
              <span>{nextThreshold} points</span>
            </div>
            <Progress value={progress} className="h-4" />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-6">
            {(['Newbie', 'Active', 'Silver', 'Golden'] as const).map((level) => (
              <div
                key={level}
                className={cn(
                  "text-center p-3 rounded-lg",
                  volunteer?.level === level ? "bg-primary/10 border-2 border-primary" : "bg-muted/50"
                )}
              >
                <LevelBadge level={level} size="sm" showLabel={false} />
                <p className="text-xs font-medium mt-1">{level}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activities">Activity History</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>
                All your submitted activities and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No activities yet. Start logging your contributions!
                </p>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        {statusIcon[activity.status]}
                        <div>
                          <p className="font-medium">{activity.activityTypeName}</p>
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {new Date(activity.submittedAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {activity.mode}
                            </span>
                          </div>
                          {activity.reviewNote && (
                            <p className="text-xs text-destructive mt-1">
                              Note: {activity.reviewNote}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">+{activity.points} pts</p>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full capitalize",
                          statusColor[activity.status]
                        )}>
                          {activity.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges">
          <Card>
            <CardHeader>
              <CardTitle>Your Badges</CardTitle>
              <CardDescription>
                Achievements you've earned through your contributions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {allBadges.map((badge) => {
                  const isEarned = volunteer?.badges?.some(b => b.id === badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={cn(
                        "flex flex-col items-center text-center p-4 rounded-lg border-2 transition-all",
                        isEarned
                          ? "bg-primary/5 border-primary"
                          : "bg-muted/30 border-transparent opacity-50"
                      )}
                    >
                      <span className="text-4xl mb-2">{badge.icon}</span>
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                      {isEarned && (
                        <span className="text-xs text-success mt-2">✓ Earned</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
