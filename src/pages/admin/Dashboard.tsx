import { useState, useEffect, useCallback } from 'react';
import { Users, Activity, Award, Building2, TrendingUp, Bell } from 'lucide-react';
import { StatsCard } from '@/components/ui/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CourseAdsTable } from '@/components/dashboard/CourseAdsTable';
import CourseSchedule from '@/components/courses/CourseSchedule';
import type { Database } from '@/integrations/supabase/types';
import { CACHE_TTL, getLocalCache, setLocalCache } from '@/utils/localCache';

type ProfileSummary = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'full_name_ar' | 'avatar_url' | 'total_points' | 'level' | 'committee_id'
>;
type ParticipationSummary = Pick<Database['public']['Tables']['activity_submissions']['Row'], 'points_awarded'>;
type CommitteeSummary = Pick<Database['public']['Tables']['committees']['Row'], 'id' | 'name' | 'name_ar'>;
type LeaderboardRow = Database['public']['Functions']['get_leaderboard']['Returns'][number];

type PersonRelation = {
  full_name?: string | null;
  full_name_ar?: string | null;
  name_en?: string | null;
  name_ar?: string | null;
} | null;

type NamedRelation = {
  name: string;
  name_ar: string;
} | null;

type SubmissionRow = Pick<
  Database['public']['Tables']['activity_submissions']['Row'],
  'id' | 'points_awarded' | 'status' | 'submitted_at' | 'participant_type' | 'guest_name' | 'trainer_id'
> & {
  volunteer?: PersonRelation;
  trainer?: PersonRelation;
  activity?: NamedRelation;
  committee?: NamedRelation;
};

type DashboardCache = {
  stats?: DashboardStats;
  recentSubmissions?: RecentSubmission[];
  topVolunteers?: TopVolunteer[];
  committeeStats?: CommitteeStat[];
};

const isDashboardCache = (value: unknown): value is DashboardCache =>
  typeof value === 'object' && value !== null;

type DashboardStats = {
  totalVolunteers: number;
  totalParticipations: number;
  totalPointsAwarded: number;
  activeCommittees: number;
};

type RecentSubmission = {
  id: string;
  volunteer_name: string;
  participant_label: string;
  activity_name: string;
  committee_name: string;
  points: number;
  status: string;
  submitted_at: string;
};

type TopVolunteer = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  total_points: number;
  level: string;
};

type CommitteeStat = {
  id: string;
  name: string;
  name_ar: string;
  volunteer_count: number;
  total_points: number;
};

export default function AdminDashboard() {
  const { t, isRTL } = useLanguage();
  const { activeBranch, canViewAllBranches } = useBranch();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalVolunteers: 0,
    totalParticipations: 0,
    totalPointsAwarded: 0,
    activeCommittees: 0,
  });
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [topVolunteers, setTopVolunteers] = useState<TopVolunteer[]>([]);
  const [committeeStats, setCommitteeStats] = useState<CommitteeStat[]>([]);

  const fetchDashboardData = useCallback(async (hasCache = false) => {
    if (!hasCache) {
      setLoading(true);
    }
    try {
      // Fetch all data in parallel
      const [
        profilesRes,
        participationsRes,
        committeesRes,
        submissionsRes,
      ] = await Promise.all([
        // RLS auto-filters for non-admin; admin can scope via activeBranch
        (() => {
          let q = supabase.from('profiles').select('id, full_name, full_name_ar, avatar_url, total_points, level, committee_id');
          if (canViewAllBranches && activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
          return q;
        })(),
        (() => {
          let q = supabase.from('activity_submissions').select('points_awarded');
          if (canViewAllBranches && activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
          return q;
        })(),
        (() => {
          let q = supabase.from('committees').select('id, name, name_ar');
          if (canViewAllBranches && activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
          return q;
        })(),
        (() => {
          let q = supabase.from('activity_submissions')
            .select(`
              id,
              points_awarded,
              status,
              submitted_at,
              participant_type,
              guest_name,
              trainer_id,
              volunteer:profiles!activity_submissions_volunteer_id_fkey(full_name, full_name_ar),
              trainer:trainers(name_en, name_ar),
              activity:activity_types!activity_submissions_activity_type_id_fkey(name, name_ar),
              committee:committees!activity_submissions_committee_id_fkey(name, name_ar)
            `)
            .neq('participant_type', 'guest')
            .order('submitted_at', { ascending: false })
            .limit(5);
          if (canViewAllBranches && activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
          return q;
        })(),
      ]);

      // Calculate stats
      const profiles = (profilesRes.data ?? []) as ProfileSummary[];
      const participations = (participationsRes.data ?? []) as ParticipationSummary[];
      const committees = (committeesRes.data ?? []) as CommitteeSummary[];

      const totalPoints = participations.reduce((sum, a) => sum + (a.points_awarded || 0), 0);

      const updatedStats = {
        totalVolunteers: profiles.length,
        totalParticipations: participations.length,
        totalPointsAwarded: totalPoints,
        activeCommittees: committees.length,
      };
      setStats(updatedStats);

      // Top volunteers (of the month)
      // RPC function defined in types.ts as existing in Database definition
      let processedTopVolunteers: TopVolunteer[] = [];
      const { data: topVolunteersData } = await supabase.rpc('get_leaderboard', {
        period_type: 'month',
        target_date: new Date().toISOString(),
        committee_filter: null
      });

      if (topVolunteersData) {
        const validProfileIds = new Set(profiles.map(p => p.id));
        const filteredTopVolunteers = (topVolunteersData as LeaderboardRow[])
          .filter((volunteer) => validProfileIds.has(volunteer.volunteer_id));

        processedTopVolunteers = filteredTopVolunteers.slice(0, 5).map((volunteer) => ({
          id: volunteer.volunteer_id,
          full_name: isRTL ? (volunteer.full_name_ar || volunteer.full_name || '') : volunteer.full_name || '',
          avatar_url: volunteer.avatar_url,
          total_points: volunteer.total_points,
          level: volunteer.level || 'under_follow_up'
        }));
        setTopVolunteers(processedTopVolunteers);
      }

      // Recent submissions
      const submissions = ((submissionsRes.data ?? []) as SubmissionRow[]).map((submission) => {
        // Determine participant name and type label
        let volunteerName = '';
        let participantLabel = '';

        if (submission.participant_type === 'trainer' || submission.trainer_id) {
          // Use fetched trainer name, falling back to other fields
          volunteerName = isRTL
            ? (submission.trainer?.name_ar || submission.trainer?.name_en || submission.guest_name || 'مدرب')
            : (submission.trainer?.name_en || submission.trainer?.name_ar || submission.guest_name || 'Trainer');
          participantLabel = isRTL ? 'مدرب' : 'Trainer';
        } else if (submission.participant_type === 'guest' || (!submission.volunteer && submission.guest_name)) {
          volunteerName = submission.guest_name || (isRTL ? 'ضيف' : 'Guest');
          participantLabel = isRTL ? 'ضيف' : 'Guest';
        } else {
          volunteerName = isRTL
            ? (submission.volunteer?.full_name_ar || submission.volunteer?.full_name || '')
            : (submission.volunteer?.full_name || '');
        }

        return {
          id: submission.id,
          volunteer_name: volunteerName,
          participant_label: participantLabel,
          activity_name: isRTL
            ? (submission.activity?.name_ar || submission.activity?.name || '')
            : (submission.activity?.name || ''),
          committee_name: isRTL
            ? (submission.committee?.name_ar || submission.committee?.name || '')
            : (submission.committee?.name || ''),
          points: submission.points_awarded || 0,
          status: submission.status,
          submitted_at: submission.submitted_at,
        };
      });
      setRecentSubmissions(submissions);

      // Committee stats
      const committeeStatsData = committees.map(c => {
        const committeeVolunteers = profiles.filter(p => p.committee_id === c.id);
        const totalPoints = committeeVolunteers.reduce((sum, v) => sum + (v.total_points || 0), 0);
        return {
          id: c.id,
          name: c.name,
          name_ar: c.name_ar,
          volunteer_count: committeeVolunteers.length,
          total_points: totalPoints,
        };
      }).sort((a, b) => b.total_points - a.total_points).slice(0, 5);
      setCommitteeStats(committeeStatsData);

      // Save to cache
      if (user?.id) {
        const cacheKey = `rtc_admin_dashboard_data_${user.id}_${activeBranch?.id || 'all'}`;
        setLocalCache(cacheKey, {
          stats: updatedStats,
          recentSubmissions: submissions,
          topVolunteers: processedTopVolunteers,
          committeeStats: committeeStatsData,
        }, CACHE_TTL.short);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id, canViewAllBranches, isRTL, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const cacheKey = `rtc_admin_dashboard_data_${user.id}_${activeBranch?.id || 'all'}`;
    const cached = getLocalCache<DashboardCache>(cacheKey, isDashboardCache);
    if (cached) {
      setStats(cached.stats || {
        totalVolunteers: 0,
        totalParticipations: 0,
        totalPointsAwarded: 0,
        activeCommittees: 0,
      });
      setRecentSubmissions(cached.recentSubmissions || []);
      setTopVolunteers(cached.topVolunteers || []);
      setCommitteeStats(cached.committeeStats || []);
      setLoading(false);
    }
    fetchDashboardData(!!cached);
  }, [user?.id, activeBranch?.id, fetchDashboardData]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notification');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('Notifications Enabled', {
        body: 'You will now receive updates!',
        icon: '/favicon-192.png'
      });
    }
  };

  const sendTestNotification = () => {
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification('Test Notification', {
          body: 'This is a test notification from the Admin Dashboard',
          icon: '/favicon-192.png',
          data: '/admin'
        });
      });
    } else {
      alert('Please enable notifications first');
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return t('common.approved');
      case 'rejected': return t('common.rejected');
      default: return t('common.pending');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('admin.dashboard')}</h1>
        <div className="mt-2 mb-3 inline-flex items-center gap-1.5 sm:gap-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-2xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-transform duration-300 border border-primary-foreground/10 max-w-full">
          <span className="text-lg sm:text-xl md:text-2xl shrink-0">🌱</span>
          <p 
            className="text-[15px] sm:text-base md:text-lg lg:text-xl font-medium leading-normal font-amiri tracking-wide select-none"
            dir="rtl"
          >
            {t('dashboard.verse')}
          </p>
          <div className="flex gap-0.5 sm:gap-1 text-lg sm:text-xl md:text-2xl shrink-0">
            <span>⭐</span>
            <span>🤍</span>
          </div>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">{t('admin.overview')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('admin.totalVolunteers')}
          value={stats.totalVolunteers}
          icon={Users}
          description={t('common.volunteers')}
          variant="admin"
        />
        <StatsCard
          title={isRTL ? 'إجمالي المشاركات' : 'Total Participations'}
          value={stats.totalParticipations}
          icon={Activity}
          description={isRTL ? 'مشاركة مسجلة' : 'logged participations'}
          variant="admin"
        />
        <StatsCard
          title={t('admin.pointsAwarded')}
          value={stats.totalPointsAwarded.toLocaleString()}
          icon={Award}
          description={t('common.points')}
          variant="admin"
        />
        <StatsCard
          title={t('admin.activeCommittees')}
          value={stats.activeCommittees}
          icon={Building2}
          description={t('nav.committees')}
          variant="admin"
        />
      </div>

      <CourseAdsTable />

      {/* Monthly Course Schedule Calendar */}
      <CourseSchedule />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Participations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {isRTL ? 'آخر المشاركات' : 'Recent Participations'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSubmissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {isRTL ? 'لا توجد مشاركات حتى الآن' : 'No participations yet'}
                </p>
              ) : (
                recentSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {submission.volunteer_name}
                        {submission.participant_label && (
                          <span className="text-xs text-muted-foreground mr-1 ml-1">({submission.participant_label})</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {submission.activity_name} • {submission.committee_name}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-primary whitespace-nowrap self-start sm:self-center">+{submission.points} {t('common.points')}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Volunteers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {isRTL ? 'سباق الخير' : 'Top Volunteers of the Month'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topVolunteers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {isRTL ? 'لا يوجد متطوعون هذا الشهر' : 'No volunteers this month'}
                </p>
              ) : (
                topVolunteers.map((volunteer, index) => (
                  <div
                    key={volunteer.id}
                    className="flex items-center gap-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {index + 1}
                    </span>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={volunteer.avatar_url || undefined} />
                      <AvatarFallback className="text-sm">
                        {volunteer.full_name?.substring(0, 2)?.toUpperCase() || 'V'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{volunteer.full_name || (isRTL ? 'متطوع' : 'Volunteer')}</p>
                      <p className="text-xs text-muted-foreground">{volunteer.total_points} {t('common.points')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Committee Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('admin.committeePerformance')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {committeeStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {isRTL ? 'لا توجد لجان حتى الآن' : 'No committees yet'}
            </p>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              {committeeStats.map((committee) => (
                <div
                  key={committee.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <h4 className="font-medium text-sm">{isRTL ? committee.name_ar : committee.name}</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('common.volunteers')}</span>
                    <span className="font-medium">{committee.volunteer_count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('committees.totalPoints')}</span>
                    <span className="font-medium">{committee.total_points}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Notifications Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure and test PWA push notifications. You need to enable permissions on this device first.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button onClick={requestNotificationPermission} variant="outline">
              Enable Notifications
            </Button>
            <Button onClick={sendTestNotification}>
              Send Test Notification
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
