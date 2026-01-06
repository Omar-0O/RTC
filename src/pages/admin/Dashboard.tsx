import { useState, useEffect } from 'react';
import { Users, Activity, Award, Building2, TrendingUp } from 'lucide-react';
import { StatsCard } from '@/components/ui/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LevelBadge } from '@/components/ui/level-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

type DashboardStats = {
  totalVolunteers: number;
  totalParticipations: number;
  totalPointsAwarded: number;
  activeCommittees: number;
};

type RecentSubmission = {
  id: string;
  volunteer_name: string;
  activity_name: string;
  committee_name: string;
  points: number;
  status: string;
  submitted_at: string;
};

type TopVolunteer = {
  id: string;
  full_name: string;
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [
        profilesRes,
        participationsRes,
        committeesRes,
        submissionsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, full_name_ar, total_points, level, committee_id'),
        supabase.from('activity_submissions').select('points_awarded'),
        supabase.from('committees').select('id, name, name_ar'),
        supabase.from('activity_submissions')
          .select(`
            id,
            points_awarded,
            status,
            submitted_at,
            volunteer:profiles!activity_submissions_volunteer_id_fkey(full_name, full_name_ar),
            activity:activity_types!activity_submissions_activity_type_id_fkey(name, name_ar),
            committee:committees!activity_submissions_committee_id_fkey(name, name_ar)
          `)
          .order('submitted_at', { ascending: false })
          .limit(5),
      ]);

      // Calculate stats
      const profiles = profilesRes.data || [];
      const participations = participationsRes.data || [];
      const committees = committeesRes.data || [];

      const totalPoints = participations.reduce((sum, a) => sum + (a.points_awarded || 0), 0);

      setStats({
        totalVolunteers: profiles.length,
        totalParticipations: participations.length,
        totalPointsAwarded: totalPoints,
        activeCommittees: committees.length,
      });

      // Top volunteers (of the month)
      // RPC function defined in types.ts as existing in Database definition
      const { data: topVolunteersData } = await supabase.rpc('get_leaderboard', {
        period_type: 'month',
        target_date: new Date().toISOString(),
        committee_filter: null
      });

      if (topVolunteersData) {
        setTopVolunteers(topVolunteersData.slice(0, 5).map((v: any) => ({
          id: v.volunteer_id,
          full_name: isRTL ? (v.full_name_ar || v.full_name || '') : v.full_name || '',
          total_points: v.total_points,
          level: v.level || 'under_follow_up'
        })));
      }

      // Recent submissions
      const submissions = (submissionsRes.data || []).map((s: any) => ({
        id: s.id,
        volunteer_name: isRTL
          ? (s.volunteer?.full_name_ar || s.volunteer?.full_name || '')
          : (s.volunteer?.full_name || ''),
        activity_name: isRTL
          ? (s.activity?.name_ar || s.activity?.name || '')
          : (s.activity?.name || ''),
        committee_name: isRTL
          ? (s.committee?.name_ar || s.committee?.name || '')
          : (s.committee?.name || ''),
        points: s.points_awarded || 0,
        status: s.status,
        submitted_at: s.submitted_at,
      }));
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

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold tracking-tight">{t('admin.dashboard')}</h1>
        <p className="text-muted-foreground">{t('admin.overview')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('admin.totalVolunteers')}
          value={stats.totalVolunteers}
          icon={Users}
          description={t('common.volunteers')}
        />
        <StatsCard
          title={isRTL ? 'إجمالي المشاركات' : 'Total Participations'}
          value={stats.totalParticipations}
          icon={Activity}
          description={isRTL ? 'مشاركة مسجلة' : 'logged participations'}
        />
        <StatsCard
          title={t('admin.pointsAwarded')}
          value={stats.totalPointsAwarded.toLocaleString()}
          icon={Award}
          description={t('common.points')}
        />
        <StatsCard
          title={t('admin.activeCommittees')}
          value={stats.activeCommittees}
          icon={Building2}
          description={t('nav.committees')}
        />
      </div>

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
                      <p className="font-medium truncate">{submission.volunteer_name}</p>
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
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{volunteer.full_name || (isRTL ? 'متطوع' : 'Volunteer')}</p>
                      <p className="text-xs text-muted-foreground">{volunteer.total_points} {t('common.points')}</p>
                    </div>
                    <LevelBadge level={volunteer.level as any} size="sm" />
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
    </div>
  );
}
