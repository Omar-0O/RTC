import { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, Users, Activity, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

interface Profile {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  total_points: number;
  level: string;
  activities_count: number;
  committee_id: string | null;
}

interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

interface ActivitySubmission {
  id: string;
  volunteer_id: string;
  status: string;
  points_awarded: number;
  submitted_at: string;
  activity_type_id: string;
  location?: string;
  committee_id: string | null;
}

interface ActivityType {
  id: string;
  name: string;
  name_ar: string;
  points: number;
}

export default function Reports() {
  const { t, language } = useLanguage();
  const [dateRange, setDateRange] = useState('month');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, committeesRes, submissionsRes, activityTypesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('committees').select('*'),
        supabase.from('activity_submissions').select('*'),
        supabase.from('activity_types').select('*'),
      ]);

      const profilesData = profilesRes.data || [];
      const submissionsData = submissionsRes.data || [];

      if (profilesData) {
        const enrichedProfiles: Profile[] = profilesData.map(profile => ({
          ...profile,
          total_points: profile.total_points ?? 0,
          level: profile.level ?? 'under_follow_up',
          activities_count: submissionsData.filter(s => s.volunteer_id === profile.id).length
        }));
        setProfiles(enrichedProfiles);
      }

      if (committeesRes.data) setCommittees(committeesRes.data);
      if (submissionsRes.data) setSubmissions(submissionsRes.data);
      if (activityTypesRes.data) setActivityTypes(activityTypesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get date range based on selection
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'semi':
        return { start: subMonths(startOfMonth(now), 5), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  // Helper function to get level name in Arabic for exports
  const getLevelName = (level: string): string => {
    const levelMap: Record<string, string> = {
      'under_follow_up': 'تحت المتابعة',
      'project_responsible': 'مشروع مسئول',
      'responsible': 'مسئول',
      'bronze': 'تحت المتابعة',
      'silver': 'تحت المتابعة',
      'gold': 'مشروع مسئول',
      'platinum': 'مسئول',
      'diamond': 'مسئول',
    };
    return levelMap[level] || 'تحت المتابعة';
  };

  // Filter submissions by date range
  const filteredSubmissions = submissions.filter(s => {
    const { start, end } = getDateRange();
    const submittedDate = new Date(s.submitted_at);
    return submittedDate >= start && submittedDate <= end;
  });

  // Committee distribution data
  const committeeData = committees.map(committee => {
    const volunteers = profiles.filter(p => p.committee_id === committee.id);
    return {
      name: language === 'ar' ? committee.name_ar : committee.name,
      volunteers: volunteers.length,
      points: volunteers.reduce((sum, v) => sum + (v.total_points || 0), 0),
    };
  }).filter(c => c.volunteers > 0);

  // Level distribution data
  const levelData = [
    { name: t('level.under_follow_up'), value: profiles.filter(p => !p.level || p.level === 'under_follow_up' || p.level === 'bronze' || p.level === 'silver' || p.level === 'newbie' || p.level === 'active').length, color: '#64748b' }, // slate-500
    { name: t('level.project_responsible'), value: profiles.filter(p => p.level === 'project_responsible' || p.level === 'gold').length, color: '#3b82f6' }, // blue-500
    { name: t('level.responsible'), value: profiles.filter(p => p.level === 'responsible' || p.level === 'platinum' || p.level === 'diamond').length, color: '#9333ea' }, // purple-600
  ].filter(l => l.value > 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name, fill }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5 + (outerRadius - innerRadius);
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Standard logic is x > cx ? 'start' : 'end'
    // In RTL: 'start' aligns to Right, 'end' aligns to Left.
    // So for right side (x > cx), we want text extending Right -> 'end' (Left edge at point)
    // For left side (x < cx), we want text extending Left -> 'start' (Right edge at point)
    let textAnchor = x > cx ? 'start' : 'end';
    if (language === 'ar') {
      textAnchor = x > cx ? 'end' : 'start';
    }

    return (
      <text
        x={x}
        y={y}
        fill="hsl(var(--foreground))"
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={12}
      >
        {`${name}: ${value}`}
      </text>
    );
  };

  // Activity submissions over time (last 6 months) by Level
  const activityTrend = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const monthSubmissions = submissions.filter(s => {
      const submittedDate = new Date(s.submitted_at);
      return submittedDate >= monthStart && submittedDate <= monthEnd;
    });

    const counts = {
      under_follow_up: 0,
      project_responsible: 0,
      responsible: 0
    };

    monthSubmissions.forEach(s => {
      const volunteer = profiles.find(p => p.id === s.volunteer_id);
      if (volunteer) {
        const level = volunteer.level || 'under_follow_up';

        if (['responsible', 'platinum', 'diamond'].includes(level)) {
          counts.responsible++;
        } else if (['project_responsible', 'gold'].includes(level)) {
          counts.project_responsible++;
        } else {
          // Default to under_follow_up for others (bronze, silver, newbie, active, etc)
          counts.under_follow_up++;
        }
      }
    });

    return {
      month: format(date, 'MMM'),
      ...counts
    };
  });

  // Top activities by submissions
  const activityStats = activityTypes.map(activity => {
    const activitySubmissions = submissions.filter(s => s.activity_type_id === activity.id);
    return {
      name: language === 'ar' ? activity.name_ar : activity.name,
      count: activitySubmissions.length,
      points: activity.points,
    };
  }).filter(a => a.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

  // CSV Export functions
  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(language === 'ar' ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
  };

  const handleExport = (type: string) => {
    switch (type) {
      case 'volunteers':
        const volunteersData = profiles.map(p => ({
          [language === 'ar' ? 'الاسم' : 'Name']: p.full_name || '',
          [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
          [language === 'ar' ? 'رقم الهاتف' : 'Phone']: p.phone || '',
          [language === 'ar' ? 'المستوى' : 'Level']: getLevelName(p.level || 'under_follow_up'),
          [language === 'ar' ? 'النقاط' : 'Points']: p.total_points,
          [language === 'ar' ? 'عدد الأنشطة' : 'Activities Count']: p.activities_count,
          [language === 'ar' ? 'اللجنة' : 'Committee']: committees.find(c => c.id === p.committee_id)?.[language === 'ar' ? 'name_ar' : 'name'] || '',
        }));
        downloadCSV(volunteersData, 'volunteers');
        break;

      case 'activities':
        const reportData = filteredSubmissions.map(s => {
          const volunteer = profiles.find(p => p.id === s.volunteer_id);
          const activityType = activityTypes.find(a => a.id === s.activity_type_id);
          const committee = committees.find(c => c.id === (volunteer?.committee_id || s.committee_id));

          let locationStr = s.location || 'branch';
          if (locationStr === 'home' || locationStr === 'remote') locationStr = language === 'ar' ? 'من البيت' : 'Home';
          else if (locationStr === 'branch') locationStr = language === 'ar' ? 'الفرع' : 'Branch';

          return {
            [language === 'ar' ? 'النشاط' : 'Activity']: activityType?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'اللجنة' : 'Committee']: committee?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'اسم المتطوع' : 'Volunteer Name']: volunteer?.full_name || '',
            [language === 'ar' ? 'رقم الهاتف' : 'Phone']: volunteer?.phone || '',
            [language === 'ar' ? 'نوع المشاركة' : 'Participation Type']: locationStr,
            [language === 'ar' ? 'تاريخ المشاركة' : 'Date']: format(new Date(s.submitted_at), 'yyyy-MM-dd'),
          };
        });
        // Use 'participation_log' filename, filtered by current month
        downloadCSV(reportData, `participation_log_${dateRange}`);
        break;

      case 'points':
        const pointsData = profiles.map(p => ({
          [language === 'ar' ? 'الاسم' : 'Name']: p.full_name || '',
          [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
          [language === 'ar' ? 'إجمالي النقاط' : 'Total Points']: p.total_points,
          [language === 'ar' ? 'المستوى' : 'Level']: getLevelName(p.level || 'under_follow_up'),
        })).sort((a, b) => (b[language === 'ar' ? 'إجمالي النقاط' : 'Total Points'] as number) - (a[language === 'ar' ? 'إجمالي النقاط' : 'Total Points'] as number));
        downloadCSV(pointsData, 'points_summary');
        break;

      case 'monthly':
        const monthlyData = activityTrend.map(m => ({
          [language === 'ar' ? 'الشهر' : 'Month']: m.month,
          [t('level.under_follow_up')]: m.under_follow_up,
          [t('level.project_responsible')]: m.project_responsible,
          [t('level.responsible')]: m.responsible,
        }));
        downloadCSV(monthlyData, 'monthly_report');
        break;

      case 'full':
        // Export all data as a comprehensive report
        // Temporarily disabled as requested
        toast.info(language === 'ar' ? 'التقرير فارغ حالياً' : 'Report is currently empty');
        break;
    }
  };

  // Calculate summary stats
  const totalVolunteers = profiles.length;
  const totalApprovedActivities = submissions.filter(s => s.status === 'approved').length;
  const totalSubmissions = submissions.length;

  // Calculate volunteers by level
  const volunteersByLevel = {
    under_follow_up: profiles.filter(p => !p.level || p.level === 'under_follow_up' || p.level === 'bronze' || p.level === 'silver' || p.level === 'newbie' || p.level === 'active').length,
    project_responsible: profiles.filter(p => p.level === 'project_responsible' || p.level === 'gold').length,
    responsible: profiles.filter(p => p.level === 'responsible' || p.level === 'platinum' || p.level === 'diamond').length
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('reports.title')}</h1>
          <p className="text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t('reports.thisWeek')}</SelectItem>
              <SelectItem value="month">{t('reports.thisMonth')}</SelectItem>
              <SelectItem value="quarter">{t('reports.thisQuarter')}</SelectItem>
              <SelectItem value="semi">{language === 'ar' ? 'نصف سنة' : 'Half Year'}</SelectItem>
              <SelectItem value="year">{t('reports.thisYear')}</SelectItem>
            </SelectContent>
          </Select>

        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.totalVolunteers')}</p>
                <p className="text-2xl font-bold">{totalVolunteers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-success/10 p-3">
                <Activity className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.totalActivities')}</p>
                <p className="text-2xl font-bold">{totalApprovedActivities}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-warning/10 p-3">
                <Award className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي المشاركات' : 'Total Submissions'}</p>
                <p className="text-2xl font-bold">{totalSubmissions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volunteers by Level */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-slate-500/10 p-3">
                <Activity className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('level.under_follow_up')}</p>
                <p className="text-2xl font-bold">{volunteersByLevel.under_follow_up}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <Activity className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('level.project_responsible')}</p>
                <p className="text-2xl font-bold">{volunteersByLevel.project_responsible}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-purple-600/10 p-3">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('level.responsible')}</p>
                <p className="text-2xl font-bold">{volunteersByLevel.responsible}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Trend */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.activityTrend')}</CardTitle>
            <CardDescription>{t('reports.activityTrendDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="under_follow_up"
                    stroke="#64748b"
                    strokeWidth={2}
                    name={t('level.under_follow_up')}
                  />
                  <Line
                    type="monotone"
                    dataKey="project_responsible"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name={t('level.project_responsible')}
                  />
                  <Line
                    type="monotone"
                    dataKey="responsible"
                    stroke="#9333ea"
                    strokeWidth={2}
                    name={t('level.responsible')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.levelDistribution')}</CardTitle>
            <CardDescription>{t('reports.levelDistributionDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {levelData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={levelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={renderCustomLabel}
                    >
                      {levelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>



        {/* Top Activities */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.topActivities')}</CardTitle>
            <CardDescription>{t('reports.topActivitiesDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityStats.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  {language === 'ar' ? 'لا توجد أنشطة بعد' : 'No activities yet'}
                </div>
              ) : (
                activityStats.map((activity, index) => (
                  <div key={activity.name} className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{activity.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.count} {language === 'ar' ? 'مشاركة' : 'submissions'} • {activity.points} {t('common.points')}
                      </p>
                    </div>
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(activity.count / activityStats[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>{t('reports.exportData')}</CardTitle>
          <CardDescription>{t('reports.exportDataDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => handleExport('volunteers')}>
              <Download className="h-4 w-4 shrink-0 ltr:mr-2 rtl:ml-2" />
              <span className="truncate">{t('reports.volunteerList')}</span>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => handleExport('activities')}>
              <Download className="h-4 w-4 shrink-0 ltr:mr-2 rtl:ml-2" />
              <span className="truncate">{t('reports.activityLog')}</span>
            </Button>

            <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => handleExport('monthly')}>
              <Download className="h-4 w-4 shrink-0 ltr:mr-2 rtl:ml-2" />
              <span className="truncate">{t('reports.monthlyReport')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
