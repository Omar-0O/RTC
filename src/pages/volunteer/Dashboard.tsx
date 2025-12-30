import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/ui/stats-card';
import { LevelBadge, getLevelProgress } from '@/components/ui/level-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Activity, Trophy, Star, ArrowRight, Loader2, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type RecentSubmission = {
  id: string;
  activity_name: string;
  points: number;
  status: string;
  submitted_at: string;
};

export default function VolunteerDashboard() {
  const { user, profile } = useAuth();
  const { t, isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  
  const points = profile?.total_points || 0;
  const { progress, nextThreshold } = getLevelProgress(points);
  const level = profile?.level || 'bronze';
  const activitiesCount = profile?.activities_count || 0;

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [submissionsRes, badgesRes] = await Promise.all([
        supabase
          .from('activity_submissions')
          .select(`
            id,
            points_awarded,
            status,
            submitted_at,
            activity:activity_types(name, name_ar)
          `)
          .eq('volunteer_id', user.id)
          .order('submitted_at', { ascending: false })
          .limit(5),
        supabase
          .from('user_badges')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
      ]);

      if (submissionsRes.data) {
        setRecentSubmissions(submissionsRes.data.map((s: any) => ({
          id: s.id,
          activity_name: isRTL ? (s.activity?.name_ar || s.activity?.name) : s.activity?.name,
          points: s.points_awarded || 0,
          status: s.status,
          submitted_at: s.submitted_at,
        })));
      }

      setBadgeCount(badgesRes.count || 0);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayLevel = (dbLevel: string) => {
    const levelMap: Record<string, string> = {
      bronze: isRTL ? 'برونزي' : 'Bronze',
      silver: isRTL ? 'فضي' : 'Silver',
      gold: isRTL ? 'ذهبي' : 'Gold',
      platinum: isRTL ? 'بلاتيني' : 'Platinum',
      diamond: isRTL ? 'ماسي' : 'Diamond',
    };
    return levelMap[dbLevel] || (isRTL ? 'برونزي' : 'Bronze');
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return isRTL ? 'مقبول' : 'Approved';
      case 'rejected': return isRTL ? 'مرفوض' : 'Rejected';
      default: return isRTL ? 'قيد المراجعة' : 'Pending';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-warning/10 text-warning';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {(profile?.full_name || 'V').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {t('dashboard.welcome')}, {profile?.full_name?.split(' ')[0] || (isRTL ? 'متطوع' : 'Volunteer')}! 👋
            </h1>
            <p className="text-muted-foreground">
              {t('dashboard.totalPoints')}: {points}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/activity">
            <Activity className={isRTL ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
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
          description={isRTL ? 'استمر في الكسب للترقية!' : 'Keep earning to level up!'}
        />
        <StatsCard
          title={t('dashboard.currentLevel')}
          value={displayLevel(level)}
          icon={Trophy}
          description={isRTL ? 'مستواك الحالي' : 'Your current tier'}
        />
        <StatsCard
          title={t('dashboard.activitiesCompleted')}
          value={activitiesCount}
          icon={Activity}
          description={isRTL ? 'الأنشطة المكتملة' : 'Completed activities'}
        />
        <StatsCard
          title={t('profile.badges')}
          value={badgeCount}
          icon={Award}
          description={isRTL ? 'الإنجازات المكتسبة' : 'Achievements earned'}
        />
      </div>

      {/* Level Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('profile.pointsProgress')}</CardTitle>
              <CardDescription>{isRTL ? 'رحلتك نحو المستوى التالي' : 'Your journey to the next level'}</CardDescription>
            </div>
            <LevelBadge level={level} size="lg" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{points} {isRTL ? 'نقطة' : 'points'}</span>
              <span>{nextThreshold} {isRTL ? 'نقطة' : 'points'}</span>
            </div>
            <Progress value={progress} className="h-3" />
            <p className="text-sm text-muted-foreground">
              {isRTL 
                ? `${nextThreshold - points} نقطة للوصول للمستوى التالي`
                : `${nextThreshold - points} more points to reach the next level`
              }
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
              <CardDescription>{isRTL ? 'ابدأ بهذه الإجراءات' : 'Get started with these actions'}</CardDescription>
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

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
              <CardDescription>{isRTL ? 'آخر طلباتك' : 'Your latest submissions'}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/profile">
                {isRTL ? 'عرض الكل' : 'View all'} <ArrowRight className={isRTL ? "mr-1 h-4 w-4" : "ml-1 h-4 w-4"} />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recentSubmissions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isRTL ? 'لا توجد أنشطة بعد. ابدأ بتسجيل مساهماتك!' : 'No activities yet. Start logging your contributions!'}
              </p>
            ) : (
              <div className="space-y-3">
                {recentSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{submission.activity_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(submission.submitted_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">+{submission.points}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(submission.status)}`}>
                        {getStatusText(submission.status)}
                      </span>
                    </div>
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
