import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { LevelBadge, getLevelProgress } from '@/components/ui/level-badge';
import { Calendar, Mail } from 'lucide-react';

export default function Profile() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  
  const points = profile?.total_points || 0;
  const { progress, nextThreshold } = getLevelProgress(points);
  const userInitials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

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
                <h1 className="text-2xl font-bold">{profile?.full_name}</h1>
                <LevelBadge level={displayLevel(profile?.level || 'bronze')} />
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {profile?.email}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t('profile.memberSince')} {new Date(profile?.join_date || '').toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{points}</div>
              <div className="text-sm text-muted-foreground">{t('dashboard.totalPoints')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level Progress */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.pointsProgress')}</CardTitle>
          <CardDescription>
            {nextThreshold - points} more points to reach the next level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{points} points</span>
              <span>{nextThreshold} points</span>
            </div>
            <Progress value={progress} className="h-4" />
          </div>
          <div className="grid grid-cols-5 gap-2 mt-6">
            {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const).map((level) => (
              <div
                key={level}
                className={`text-center p-3 rounded-lg ${
                  profile?.level === level ? "bg-primary/10 border-2 border-primary" : "bg-muted/50"
                }`}
              >
                <LevelBadge level={displayLevel(level)} size="sm" showLabel={false} />
                <p className="text-xs font-medium mt-1 capitalize">{level}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activities">{t('profile.activityHistory')}</TabsTrigger>
          <TabsTrigger value="badges">{t('profile.badges')}</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.activityHistory')}</CardTitle>
              <CardDescription>
                All your submitted activities and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                No activities yet. Start logging your contributions!
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.badges')}</CardTitle>
              <CardDescription>
                Achievements you've earned through your contributions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Complete activities to earn badges!
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
