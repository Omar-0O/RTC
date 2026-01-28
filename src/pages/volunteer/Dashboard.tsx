import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/ui/stats-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Activity, Star, ArrowRight, Loader2, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import CourseSchedule from '@/components/courses/CourseSchedule';
import { CourseAdsTable } from '@/components/dashboard/CourseAdsTable';

type RecentSubmission = {
  id: string;
  activity_name: string;
  points: number;
  status: string;
  submitted_at: string;
};

export default function VolunteerDashboard() {
  const { user, profile, refreshProfile, primaryRole } = useAuth();
  const { t, isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);

  const points = profile?.total_points || 0;
  const activitiesCount = profile?.activities_count || 0;
  const [monthlyActivities, setMonthlyActivities] = useState(0);

  useEffect(() => {
    if (user?.id) {
      refreshProfile();
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

      // Fetch monthly activities count (current month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: monthlyCount } = await supabase
        .from('activity_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('volunteer_id', user.id)
        .gte('submitted_at', startOfMonth);
      setMonthlyActivities(monthlyCount || 0);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 sm:h-14 sm:w-14 shrink-0">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-base sm:text-lg">
              {(profile?.full_name || 'V').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {t('dashboard.welcome')}, {(isRTL ? (profile?.full_name_ar || profile?.full_name) : profile?.full_name)?.split(' ')[0] || (isRTL ? 'متطوع' : 'Volunteer')}! 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.totalPoints')}: {points}
            </p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto sm:self-start">
          <Link to="/activity">
            <Activity className={isRTL ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
            {t('dashboard.logNewActivity')}
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title={t('dashboard.totalPoints')}
          value={points}
          icon={Star}
        />
        <StatsCard
          title={isRTL ? 'إجمالي مشاركاتك خلال الشهر' : 'Activities This Month'}
          value={monthlyActivities}
          icon={Activity}
        />
        <StatsCard
          title={t('profile.badges')}
          value={badgeCount}
          icon={Award}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Course Schedule */}
      <CourseSchedule />

      {/* Course Ads Table */}
      <CourseAdsTable />

      {/* Recent Participations */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg">{isRTL ? 'مشاركاتك الأخيرة!' : 'Your Recent Participations!'}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{isRTL ? 'آخر مشاركاتك' : 'Your latest participations'}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="self-start sm:self-auto">
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
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{submission.activity_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(submission.submitted_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-sm font-medium text-primary whitespace-nowrap">+{submission.points} {isRTL ? 'نقطة' : 'pts'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
