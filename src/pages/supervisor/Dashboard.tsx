import { useState, useEffect, useCallback } from 'react';
import { Users, Activity, Award, Building2, TrendingUp, Loader2 } from 'lucide-react';
import { StatsCard } from '@/components/ui/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CourseAdsTable } from '@/components/dashboard/CourseAdsTable';
import type { Database } from '@/integrations/supabase/types';
import { CACHE_TTL, getLocalCache, setLocalCache } from '@/utils/localCache';

type ProfileSummary = Pick<
    Database['public']['Tables']['profiles']['Row'],
    'id' | 'full_name' | 'full_name_ar' | 'total_points' | 'level' | 'committee_id'
>;
type ParticipationSummary = Pick<Database['public']['Tables']['activity_submissions']['Row'], 'points_awarded'>;
type CommitteeSummary = Pick<Database['public']['Tables']['committees']['Row'], 'id' | 'name' | 'name_ar'>;
type LeaderboardRow = Database['public']['Functions']['get_leaderboard']['Returns'][number];

type SubmissionRelation = {
    full_name: string | null;
    full_name_ar: string | null;
} | null;

type ActivityRelation = {
    name: string;
    name_ar: string;
} | null;

type CommitteeRelation = {
    name: string;
    name_ar: string;
} | null;

type SubmissionRow = Pick<
    Database['public']['Tables']['activity_submissions']['Row'],
    'id' | 'points_awarded' | 'status' | 'submitted_at' | 'participant_type' | 'guest_name' | 'trainer_id'
> & {
    volunteer?: SubmissionRelation;
    activity?: ActivityRelation;
    committee?: CommitteeRelation;
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

export default function SupervisorDashboard() {
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
                (() => {
                    let q = supabase.from('profiles').select('id, full_name, full_name_ar, total_points, level, committee_id');
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
                    volunteerName = submission.volunteer?.full_name_ar || submission.volunteer?.full_name || submission.guest_name || (isRTL ? 'مدرب' : 'Trainer');
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
                const cacheKey = `rtc_supervisor_dashboard_data_${user.id}_${activeBranch?.id || 'all'}`;
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
        const cacheKey = `rtc_supervisor_dashboard_data_${user.id}_${activeBranch?.id || 'all'}`;
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{isRTL ? 'لوحة التحكم' : 'Dashboard'}</h1>
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
                <p className="text-sm sm:text-base text-muted-foreground">{isRTL ? 'نظرة عامة على جميع البيانات' : 'Overview of all data'}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
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

            <CourseAdsTable />

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
                                topVolunteers.map((volunteer, index) => {
                                    let rankStyles = "bg-muted text-muted-foreground";

                                    if (index === 0) rankStyles = "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200";
                                    if (index === 1) rankStyles = "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
                                    if (index === 2) rankStyles = "bg-orange-100 text-orange-700 ring-1 ring-orange-200";

                                    return (
                                        <div
                                            key={volunteer.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankStyles}`}>
                                                {index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm leading-snug break-words">
                                                    {volunteer.full_name || (isRTL ? 'متطوع' : 'Volunteer')}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {volunteer.total_points} {t('common.points')}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
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
        </div>
    );
}
