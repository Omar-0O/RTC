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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState('all');
  const [exportPeriod, setExportPeriod] = useState('year');

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

      if (profilesRes.data) setProfiles(profilesRes.data);
      if (committeesRes.data) setCommittees(committeesRes.data);
      if (submissionsRes.data) setSubmissions(submissionsRes.data);
      if (activityTypesRes.data) setActivityTypes(activityTypesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get level name in Arabic for exports
  const getLevelName = (level: string): string => {
    const levelMap: Record<string, string> = {
      'under_follow_up': 'تحت المتابعة',
      'project_responsible': 'مشروع مسئول',
      'responsible': 'مسئول',
      // Fallback for old data
      'bronze': 'تحت المتابعة',
      'silver': 'تحت المتابعة',
      'gold': 'مشروع مسئول',
      'platinum': 'مسئول',
      'diamond': 'مسئول',
    };
    return levelMap[level] || 'تحت المتابعة';
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
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
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

  // Monthly activity statistics for export
  const monthlyActivityStats = (() => {
    const now = new Date();
    const currentMonth = now.getMonth();

    return Array.from({ length: currentMonth + 1 }, (_, i) => {
      const date = new Date(now.getFullYear(), i, 1);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const monthSubmissions = submissions.filter(s => {
        const submittedDate = new Date(s.submitted_at);
        return submittedDate >= monthStart && submittedDate <= monthEnd;
      });

      const stats: any = {
        month: format(date, 'MMM'),
        total: monthSubmissions.length,
      };

      // Count per activity type
      activityTypes.forEach(activity => {
        stats[activity.id] = monthSubmissions.filter(s => s.activity_type_id === activity.id).length;
      });

      return stats;
    });
  })();

  // Activity distribution data
  const allActivityStats = activityTypes.map(activity => {
    const activitySubmissions = submissions.filter(s => s.activity_type_id === activity.id);
    const uniqueVolunteers = new Set(activitySubmissions.map(s => s.volunteer_id)).size;
    return {
      name: language === 'ar' ? activity.name_ar : activity.name,
      submissions: activitySubmissions.length,
      volunteers: uniqueVolunteers,
      points: activity.points,
    };
  }).filter(a => a.submissions > 0).sort((a, b) => b.submissions - a.submissions);

  // Top activities by submissions (for the list)
  const activityStats = allActivityStats.slice(0, 5);

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

  // Get date range for selected period
  const getPeriodDateRange = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'semi':
        return { start: subMonths(startOfMonth(now), 5), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfYear(now), end: endOfYear(now) };
    }
  };

  // Handle detailed export
  const handleDetailedExport = () => {
    const { start, end } = getPeriodDateRange(exportPeriod);
    const periodLabel = {
      month: language === 'ar' ? 'شهري' : 'monthly',
      quarter: language === 'ar' ? 'ربع_سنوي' : 'quarterly',
      semi: language === 'ar' ? 'نصف_سنوي' : 'semi_annual',
      year: language === 'ar' ? 'سنوي' : 'annual',
    }[exportPeriod];

    const periodSubmissions = submissions.filter(s => {
      const date = new Date(s.submitted_at);
      return date >= start && date <= end;
    });

    switch (exportType) {
      case 'volunteers':
        const volunteersData = profiles.map(p => {
          const userSubmissions = periodSubmissions.filter(s => s.volunteer_id === p.id);
          return {
            [language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)']: p.full_name_ar || '',
            [language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)']: p.full_name || '',
            [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
            [language === 'ar' ? 'رقم الهاتف' : 'Phone']: p.phone || '',
            [language === 'ar' ? 'الدرجة التطوعية' : 'Volunteer Level']: getLevelName(p.level),
            [language === 'ar' ? 'إجمالي النقاط' : 'Total Points']: p.total_points,
            [language === 'ar' ? 'النقاط في الفترة' : 'Period Points']: userSubmissions.reduce((sum, s) => sum + (s.points_awarded || 0), 0),
            [language === 'ar' ? 'عدد المشاركات' : 'Submissions Count']: userSubmissions.length,
            [language === 'ar' ? 'اللجنة' : 'Committee']: committees.find(c => c.id === p.committee_id)?.[language === 'ar' ? 'name_ar' : 'name'] || '',
          };
        });
        downloadCSV(volunteersData, `volunteers_${periodLabel}`);
        break;

      case 'committees':
        const committeesData = committees.map(committee => {
          const committeeVolunteers = profiles.filter(p => p.committee_id === committee.id);
          const committeeSubmissions = periodSubmissions.filter(s => {
            const volunteer = profiles.find(p => p.id === s.volunteer_id);
            return volunteer?.committee_id === committee.id;
          });
          return {
            [language === 'ar' ? 'اللجنة (عربي)' : 'Committee (Arabic)']: committee.name_ar,
            [language === 'ar' ? 'اللجنة (إنجليزي)' : 'Committee (English)']: committee.name,
            [language === 'ar' ? 'عدد المتطوعين' : 'Volunteers Count']: committeeVolunteers.length,
            [language === 'ar' ? 'إجمالي الأثر' : 'Total Points']: committeeVolunteers.reduce((sum, v) => sum + v.total_points, 0),
            [language === 'ar' ? 'الأثر في الفترة' : 'Period Points']: committeeSubmissions.reduce((sum, s) => sum + (s.points_awarded || 0), 0),
            [language === 'ar' ? 'عدد المشاركات' : 'Submissions Count']: committeeSubmissions.length,
          };
        });
        downloadCSV(committeesData, `committees_${periodLabel}`);
        break;

      case 'activities':
        const activitiesData = activityTypes.map(activity => {
          const activitySubmissions = periodSubmissions.filter(s => s.activity_type_id === activity.id);
          return {
            [language === 'ar' ? 'النشاط (عربي)' : 'Activity (Arabic)']: activity.name_ar,
            [language === 'ar' ? 'النشاط (إنجليزي)' : 'Activity (English)']: activity.name,
            [language === 'ar' ? 'قيمة الأثر' : 'Points Value']: activity.points,
            [language === 'ar' ? 'عدد المشاركات' : 'Submissions Count']: activitySubmissions.length,
            [language === 'ar' ? 'إجمالي الأثر المحقق' : 'Total Points Earned']: activitySubmissions.reduce((sum, s) => sum + (s.points_awarded || 0), 0),
          };
        }).filter(a => (a[language === 'ar' ? 'عدد المشاركات' : 'Submissions Count'] as number) > 0);
        downloadCSV(activitiesData, `activities_${periodLabel}`);
        break;

      case 'activity_log':
        const activityLogData = periodSubmissions.map(s => {
          const volunteer = profiles.find(p => p.id === s.volunteer_id);
          const activityType = activityTypes.find(a => a.id === s.activity_type_id);
          const committee = committees.find(c => c.id === (volunteer?.committee_id || s.committee_id));

          let locationStr = s.location || 'branch';
          if (locationStr === 'home' || locationStr === 'remote') locationStr = language === 'ar' ? 'من البيت' : 'Home';
          else if (locationStr === 'branch') locationStr = language === 'ar' ? 'الفرع' : 'Branch';

          // User requested Order: Activity, Committee, Volunteer, Phone, Participation Type, Date
          return {
            [language === 'ar' ? 'النشاط' : 'Activity']: activityType?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'اللجنة' : 'Committee']: committee?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'اسم المتطوع' : 'Volunteer Name']: volunteer?.[language === 'ar' ? 'full_name_ar' : 'full_name'] || volunteer?.full_name || '',
            [language === 'ar' ? 'رقم الهاتف' : 'Phone']: volunteer?.phone || '',
            [language === 'ar' ? 'نوع المشاركة' : 'Participation Type']: locationStr,
            [language === 'ar' ? 'تاريخ المشاركة' : 'Date']: format(new Date(s.submitted_at), 'yyyy-MM-dd'),
          };
        });
        downloadCSV(activityLogData, `activity_log_${periodLabel}`);
        break;

      case 'all':
        const allData = profiles.map(p => {
          const userSubmissions = periodSubmissions.filter(s => s.volunteer_id === p.id);
          return {
            [language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)']: p.full_name_ar || '',
            [language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)']: p.full_name || '',
            [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
            [language === 'ar' ? 'رقم الهاتف' : 'Phone']: p.phone || '',
            [language === 'ar' ? 'اللجنة' : 'Committee']: committees.find(c => c.id === p.committee_id)?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'الدرجة التطوعية' : 'Volunteer Level']: getLevelName(p.level),
            [language === 'ar' ? 'إجمالي النقاط' : 'Total Points']: p.total_points,
            [language === 'ar' ? 'النقاط في الفترة' : 'Period Points']: userSubmissions.reduce((sum, s) => sum + (s.points_awarded || 0), 0),
            [language === 'ar' ? 'عدد الأنشطة الكلي' : 'Total Activities']: p.activities_count,
            [language === 'ar' ? 'المشاركات في الفترة' : 'Period Submissions']: userSubmissions.length,
          };
        });
        downloadCSV(allData, `complete_report_${periodLabel}`);
        break;
    }

    setIsExportDialogOpen(false);
    toast.success(language === 'ar' ? 'تم تصدير التقرير بنجاح' : 'Report exported successfully');
  };

  const handleExport = (type: string) => {
    switch (type) {
      case 'volunteers':
        const volunteersData = profiles.map(p => ({
          [language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)']: p.full_name_ar || '',
          [language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)']: p.full_name || '',
          [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
          [language === 'ar' ? 'رقم الهاتف' : 'Phone']: p.phone || '',
          [language === 'ar' ? 'الدرجة التطوعية' : 'Volunteer Level']: getLevelName(p.level),
          [language === 'ar' ? 'النقاط' : 'Points']: p.total_points,
          [language === 'ar' ? 'عدد الأنشطة' : 'Activities Count']: p.activities_count,
          [language === 'ar' ? 'اللجنة' : 'Committee']: committees.find(c => c.id === p.committee_id)?.[language === 'ar' ? 'name_ar' : 'name'] || '',
        }));
        downloadCSV(volunteersData, 'volunteers');
        break;

      case 'activities':
        const activitiesData = submissions.map(s => {
          const volunteer = profiles.find(p => p.id === s.volunteer_id);
          const activityType = activityTypes.find(a => a.id === s.activity_type_id);
          return {
            [language === 'ar' ? 'المتطوع' : 'Volunteer']: volunteer?.full_name || '',
            [language === 'ar' ? 'نوع النشاط' : 'Activity Type']: activityType?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'الحالة' : 'Status']: s.status,
            [language === 'ar' ? 'النقاط' : 'Points']: s.points_awarded || 0,
            [language === 'ar' ? 'تاريخ التقديم' : 'Submitted At']: format(new Date(s.submitted_at), 'yyyy-MM-dd'),
          };
        });
        downloadCSV(activitiesData, 'activities');
        break;

      case 'points':
        const pointsData = profiles.map(p => ({
          [language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)']: p.full_name_ar || '',
          [language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)']: p.full_name || '',
          [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
          [language === 'ar' ? 'رقم الهاتف' : 'Phone']: p.phone || '',
          [language === 'ar' ? 'إجمالي النقاط' : 'Total Points']: p.total_points,
          [language === 'ar' ? 'الدرجة التطوعية' : 'Volunteer Level']: getLevelName(p.level),
        })).sort((a, b) => (b[language === 'ar' ? 'إجمالي النقاط' : 'Total Points'] as number) - (a[language === 'ar' ? 'إجمالي النقاط' : 'Total Points'] as number));
        downloadCSV(pointsData, 'points_summary');
        break;



      case 'monthly':
        const monthlyData = monthlyActivityStats.map(stat => {
          const row: any = {
            [language === 'ar' ? 'الشهر' : 'Month']: stat.month,
            [language === 'ar' ? 'إجمالي المشاركات' : 'Total Submissions']: stat.total,
          };

          activityTypes.forEach(activity => {
            const activityName = language === 'ar' ? activity.name_ar : activity.name;
            row[activityName] = stat[activity.id] || 0;
          });

          return row;
        });
        downloadCSV(monthlyData, 'monthly_activity_report');
        break;

      case 'full':
        // Export all data as a comprehensive report
        const fullReportData = profiles.map(p => {
          const volunteerSubmissions = submissions.filter(s => s.volunteer_id === p.id);
          return {
            [language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)']: p.full_name_ar || '',
            [language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)']: p.full_name || '',
            [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
            [language === 'ar' ? 'رقم الهاتف' : 'Phone']: p.phone || '',
            [language === 'ar' ? 'اللجنة' : 'Committee']: committees.find(c => c.id === p.committee_id)?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'الدرجة التطوعية' : 'Volunteer Level']: getLevelName(p.level),
            [language === 'ar' ? 'إجمالي النقاط' : 'Total Points']: p.total_points,
            [language === 'ar' ? 'عدد الأنشطة' : 'Activities Count']: p.activities_count,
          };
        });
        downloadCSV(fullReportData, 'full_report');
        break;
    }
  };

  // Calculate summary stats
  const totalVolunteers = profiles.length;
  const totalApprovedActivities = submissions.filter(s => s.status === 'approved').length;
  const totalSubmissions = submissions.length;

  // Calculate submissions by level
  const submissionsByLevel = {
    under_follow_up: 0,
    project_responsible: 0,
    responsible: 0
  };

  submissions.forEach(s => {
    const volunteer = profiles.find(p => p.id === s.volunteer_id);
    if (volunteer) {
      const level = volunteer.level || 'under_follow_up';
      if (['responsible', 'platinum', 'diamond'].includes(level)) {
        submissionsByLevel.responsible++;
      } else if (['project_responsible', 'gold'].includes(level)) {
        submissionsByLevel.project_responsible++;
      } else {
        submissionsByLevel.under_follow_up++;
      }
    }
  });

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
              <SelectItem value="year">{t('reports.thisYear')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport('full')}>
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t('reports.exportReport')}
          </Button>
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

      {/* Submissions by Level */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-slate-500/10 p-3">
                <Activity className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('level.under_follow_up')}</p>
                <p className="text-2xl font-bold">{submissionsByLevel.under_follow_up}</p>
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
                <p className="text-2xl font-bold">{submissionsByLevel.project_responsible}</p>
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
                <p className="text-2xl font-bold">{submissionsByLevel.responsible}</p>
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
                <BarChart data={allActivityStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    className="text-xs"
                    width={120}
                    orientation={language === 'ar' ? 'right' : 'left'}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="volunteers"
                    fill="hsl(var(--primary))"
                    radius={language === 'ar' ? [4, 0, 0, 4] : [0, 4, 4, 0]}
                    name={language === 'ar' ? 'عدد المتطوعين' : 'Volunteers Count'}
                  />
                </BarChart>
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
                        {activity.submissions} {language === 'ar' ? 'مشاركة' : 'submissions'} • {activity.points} {t('common.points')}
                      </p>
                    </div>
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        style={{ width: `${(activity.submissions / activityStats[0].submissions) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Export Dialog */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'تصدير التقارير' : 'Export Reports'}</CardTitle>
          <CardDescription>{language === 'ar' ? 'تصدير تقارير مفصلة حسب النوع والفترة الزمنية' : 'Export detailed reports by type and time period'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {language === 'ar' ? 'تصدير تقرير مفصل' : 'Export Detailed Report'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{language === 'ar' ? 'تصدير تقرير مفصل' : 'Export Detailed Report'}</DialogTitle>
                <DialogDescription>
                  {language === 'ar' ? 'اختر نوع التقرير والفترة الزمنية للتصدير' : 'Select report type and time period to export'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-3">
                  <Label className="text-base font-semibold">{language === 'ar' ? 'نوع التقرير' : 'Report Type'}</Label>
                  <RadioGroup value={exportType} onValueChange={setExportType}>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="font-normal cursor-pointer">{language === 'ar' ? 'تقرير شامل (كل البيانات)' : 'Complete Report (All Data)'}</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="volunteers" id="volunteers" />
                      <Label htmlFor="volunteers" className="font-normal cursor-pointer">{language === 'ar' ? 'المتطوعين' : 'Volunteers'}</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="committees" id="committees" />
                      <Label htmlFor="committees" className="font-normal cursor-pointer">{language === 'ar' ? 'اللجان' : 'Committees'}</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="activities" id="activities" />
                      <Label htmlFor="activities" className="font-normal cursor-pointer">{language === 'ar' ? 'إحصائيات الأنشطة' : 'Activities Stats'}</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="activity_log" id="activity_log" />
                      <Label htmlFor="activity_log" className="font-normal cursor-pointer">{language === 'ar' ? 'سجل المشاركات' : 'Activity Log'}</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid gap-3">
                  <Label className="text-base font-semibold">{language === 'ar' ? 'الفترة الزمنية' : 'Time Period'}</Label>
                  <RadioGroup value={exportPeriod} onValueChange={setExportPeriod}>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="month" id="month" />
                      <Label htmlFor="month" className="font-normal cursor-pointer">{language === 'ar' ? 'الشهر الحالي' : 'Current Month'}</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="quarter" id="quarter" />
                      <Label htmlFor="quarter" className="font-normal cursor-pointer">{language === 'ar' ? 'الربع الحالي' : 'Current Quarter'}</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="semi" id="semi" />
                      <Label htmlFor="semi" className="font-normal cursor-pointer">{language === 'ar' ? 'آخر 6 أشهر' : 'Last 6 Months'}</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="year" id="year" />
                      <Label htmlFor="year" className="font-normal cursor-pointer">{language === 'ar' ? 'السنة الحالية' : 'Current Year'}</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleDetailedExport}>
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {language === 'ar' ? 'تصدير' : 'Export'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
