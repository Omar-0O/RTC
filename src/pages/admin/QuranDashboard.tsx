import { useState, useEffect } from 'react';
import { Users, Activity, Award, BookOpen, Clock, Calendar, TrendingUp, Percent, BarChart3 } from 'lucide-react';
import { StatsCard } from '@/components/ui/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

type Stats = {
    activeCircles: number;
    totalBeneficiaries: number;
    totalTeachers: number;
    totalSessions: number;
    avgAttendance: number;
    mostActiveCircle: string;
};

type QuranCircle = {
    id: string;
    teacher_name?: string;
    schedule: { day: number; time: string }[];
    is_active: boolean;
    students_count: number;
    sessions_count: number;
};

const CommitteeDashboard = () => {
    const { t, isRTL } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({
        activeCircles: 0,
        totalBeneficiaries: 0,
        totalTeachers: 0,
        totalSessions: 0,
        avgAttendance: 0,
        mostActiveCircle: '',
    });
    const [activeCircles, setActiveCircles] = useState<QuranCircle[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Stats
            const [
                circlesRes,
                beneficiariesRes,
                quranTeachersRes,
                sessionsRes,
            ] = await Promise.all([
                supabase.from('quran_circles').select('*'),
                supabase.from('quran_beneficiaries').select('id', { count: 'exact' }),
                supabase.from('quran_teachers').select('id', { count: 'exact' }),
                supabase.from('quran_circle_sessions').select('id, circle_id'),
            ]);

            const activeCirclesData = (circlesRes.data || []).filter(c => c.is_active);
            const totalTeachersCount = quranTeachersRes.count || 0;
            const allSessions = sessionsRes.data || [];

            // Calculate average attendance
            let avgAttendance = 0;
            if (allSessions.length > 0) {
                const sessionIds = allSessions.map(s => s.id);
                // Fetch total attendance records across all sessions
                const { count: totalAttendanceRecords } = await supabase
                    .from('quran_circle_beneficiaries')
                    .select('id', { count: 'exact', head: true })
                    .in('session_id', sessionIds);

                // Get total enrolled across all active circles
                const { count: totalEnrolled } = await supabase
                    .from('quran_enrollments')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'active');

                if (totalEnrolled && totalEnrolled > 0 && allSessions.length > 0) {
                    const avgPerSession = (totalAttendanceRecords || 0) / allSessions.length;
                    avgAttendance = Math.round((avgPerSession / totalEnrolled) * 100);
                    if (avgAttendance > 100) avgAttendance = 100;
                }
            }

            // Find most active circle (most sessions)
            const circleSessionCounts: Record<string, number> = {};
            allSessions.forEach(s => {
                circleSessionCounts[s.circle_id] = (circleSessionCounts[s.circle_id] || 0) + 1;
            });
            let mostActiveCircleId = '';
            let maxSessionCount = 0;
            Object.entries(circleSessionCounts).forEach(([cid, count]) => {
                if (count > maxSessionCount) {
                    maxSessionCount = count;
                    mostActiveCircleId = cid;
                }
            });

            setStats({
                activeCircles: activeCirclesData.length,
                totalBeneficiaries: beneficiariesRes.count || 0,
                totalTeachers: totalTeachersCount,
                totalSessions: allSessions.length,
                avgAttendance,
                mostActiveCircle: '', // Will be set from circles below
            });

            // 2. Active Circles Data
            const circlesWithCounts = await Promise.all(
                activeCirclesData.slice(0, 6).map(async (circle) => {
                    const { count } = await supabase
                        .from('quran_enrollments')
                        .select('id', { count: 'exact', head: true })
                        .eq('circle_id', circle.id);

                    // Fetch teacher name
                    let teacherName = 'Unknown';
                    if (circle.teacher_id) {
                        const { data: teacher } = await supabase.from('quran_teachers').select('name').eq('id', circle.teacher_id).single();
                        if (teacher) teacherName = teacher.name;
                    }

                    const sessCount = circleSessionCounts[circle.id] || 0;

                    return {
                        id: circle.id,
                        teacher_name: teacherName,
                        schedule: (circle.schedule as unknown as { day: number; time: string }[]) || [],
                        is_active: circle.is_active,
                        students_count: count || 0,
                        sessions_count: sessCount,
                    };
                })
            );

            // Update most active circle name
            const mostActive = circlesWithCounts.find(c => c.id === mostActiveCircleId);
            if (mostActive) {
                setStats(prev => ({
                    ...prev,
                    mostActiveCircle: isRTL ? `حلقة ${mostActive.teacher_name}` : `${mostActive.teacher_name}'s Circle`
                }));
            }

            setActiveCircles(circlesWithCounts);

        } catch (error) {
            console.error('Error fetching Quran dashboard data:', error);
        } finally {
            setLoading(false);
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
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{isRTL ? 'لوحة تحكم لجنة القرآن' : 'Quran Committee Dashboard'}</h1>
                <p className="text-sm sm:text-base text-muted-foreground">{isRTL ? 'نظرة عامة على نشاط لجنة القرآن' : 'Overview of Quran Committee activity'}</p>
            </div>

            {/* Stats */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
                <StatsCard
                    title={isRTL ? 'الحلقات النشطة' : 'Active Circles'}
                    value={stats.activeCircles}
                    icon={BookOpen}
                    description={isRTL ? 'حلقة حالية' : 'current circles'}
                />
                <StatsCard
                    title={isRTL ? 'إجمالي الدارسين' : 'Total Students'}
                    value={stats.totalBeneficiaries}
                    icon={Users}
                    description={isRTL ? 'طالب مسجل' : 'registered students'}
                />
                <StatsCard
                    title={isRTL ? 'المحفظين' : 'Teachers'}
                    value={stats.totalTeachers}
                    icon={Award}
                    description={isRTL ? 'محفظ نشط' : 'active teachers'}
                />
                <StatsCard
                    title={isRTL ? 'إجمالي الجلسات' : 'Total Sessions'}
                    value={stats.totalSessions}
                    icon={Calendar}
                    description={isRTL ? 'جلسة منعقدة' : 'sessions held'}
                />
                <StatsCard
                    title={isRTL ? 'متوسط الحضور' : 'Avg Attendance'}
                    value={`${stats.avgAttendance}%`}
                    icon={TrendingUp}
                    description={isRTL ? 'نسبة الحضور المتوسطة' : 'average attendance rate'}
                />
                {stats.mostActiveCircle && (
                    <StatsCard
                        title={isRTL ? 'أنشط حلقة' : 'Most Active'}
                        value={stats.mostActiveCircle}
                        icon={BarChart3}
                        description={isRTL ? 'أكثر حلقة عقدت جلسات' : 'most sessions held'}
                    />
                )}
            </div>

            {/* Active Circles Overview */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        {isRTL ? 'الحلقات النشطة' : 'Active Circles'}
                    </CardTitle>
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/admin/quran-circles">
                            {isRTL ? 'عرض الكل' : 'View All'}
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {activeCircles.map(circle => (
                            <div key={circle.id} className="p-4 rounded-lg border bg-card hover:shadow-md transition-all relative overflow-hidden group">
                                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-semibold text-lg">
                                        {isRTL ? 'حلقة' : 'Circle'} {circle.teacher_name}
                                    </h3>
                                    <span className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
                                        {circle.students_count} {isRTL ? 'طالب' : 'Students'}
                                    </span>
                                </div>
                                <div className="space-y-1.5 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>
                                            {circle.schedule.map(s => {
                                                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                                return `${days[s.day]} ${s.time}`;
                                            }).join(', ')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{circle.sessions_count} {isRTL ? 'جلسة منعقدة' : 'sessions held'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5" />
                                        <span className="text-green-600 font-medium">{isRTL ? 'نشطة' : 'Active'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {activeCircles.length === 0 && (
                            <div className="col-span-full flex flex-col items-center py-12 text-muted-foreground">
                                <div className="p-4 rounded-full bg-muted/50 mb-3">
                                    <BookOpen className="h-10 w-10 opacity-30" />
                                </div>
                                <p className="font-medium">{isRTL ? 'لا توجد حلقات نشطة حالياً' : 'No active circles at the moment'}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const VolunteerDashboard = () => {
    const { isRTL } = useLanguage();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        myCircles: 0,
        myStudents: 0
    });

    useEffect(() => {
        if (user) fetchVolunteerData();
    }, [user]);

    const fetchVolunteerData = async () => {
        try {
            // Get circle IDs for this volunteer
            const { data: organizerData } = await supabase
                .from('quran_circle_organizers')
                .select('circle_id')
                .eq('volunteer_id', user?.id);

            const circleIds = organizerData?.map(o => o.circle_id) || [];

            if (circleIds.length === 0) {
                setStats({ myCircles: 0, myStudents: 0 });
                setLoading(false);
                return;
            }

            // Get active circles count
            const { count: circlesCount } = await supabase
                .from('quran_circles')
                .select('*', { count: 'exact', head: true })
                .in('id', circleIds)
                .eq('is_active', true);

            // Get enrolled students count in these circles
            const { count: studentsCount } = await supabase
                .from('quran_enrollments')
                .select('*', { count: 'exact', head: true })
                .in('circle_id', circleIds)
                .eq('status', 'active');

            setStats({
                myCircles: circlesCount || 0,
                myStudents: studentsCount || 0
            });
        } catch (error) {
            console.error('Error fetching volunteer data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{isRTL ? 'لوحة تحكم المتطوع' : 'Volunteer Dashboard'}</h1>
                <p className="text-sm sm:text-base text-muted-foreground">{isRTL ? 'مرحباً بعودتك! إليك ملخص نشاطك في تحفيظ القرآن.' : 'Welcome back! Here is a summary of your Quran teaching activity.'}</p>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                <StatsCard
                    title={isRTL ? 'حلقاتي' : 'My Circles'}
                    value={stats.myCircles}
                    icon={BookOpen}
                    description={isRTL ? 'حلقة مسندة إليك' : 'circles assigned to you'}
                />
                <StatsCard
                    title={isRTL ? 'طلابي' : 'My Students'}
                    value={stats.myStudents}
                    icon={Users}
                    description={isRTL ? 'طالب في حلقاتك' : 'students in your circles'}
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                    <Link to="/my-quran-circles">
                        <BookOpen className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" />
                        {isRTL ? 'إدارة حلقاتي' : 'Manage My Circles'}
                    </Link>
                </Button>
            </div>
        </div>
    );
};

export default function QuranDashboard() {
    const { hasRole, primaryRole } = useAuth();

    // Check if user is Head of Quran or Admin
    const isHeadOfQuran = hasRole('head_quran') || hasRole('admin');

    if (isHeadOfQuran) {
        return <CommitteeDashboard />;
    }

    return <VolunteerDashboard />;
}
