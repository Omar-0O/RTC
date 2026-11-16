import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { Database } from '@/integrations/supabase/types';
import { downloadCsv as saveCsv } from '@/utils/csv';
import type { SpreadsheetRow } from '@/utils/spreadsheetSecurity';
import {
  fetchAllReportActivitySubmissions,
  REPORT_ACTIVITY_TYPE_COLUMNS,
  REPORT_COMMITTEE_COLUMNS,
  REPORT_PROFILE_COLUMNS,
  REPORT_TRAINER_COLUMNS,
  REPORT_USER_ROLE_COLUMNS,
} from '@/services/reportData.service';

type CsvRow = SpreadsheetRow;
type Trainer = Pick<Database['public']['Tables']['trainers']['Row'], 'id' | 'user_id' | 'name_ar' | 'name_en' | 'phone'>;

type PieLabelProps = {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number | string;
  innerRadius?: number | string;
  outerRadius?: number | string;
  value?: number | string;
  name?: number | string;
};

type SupervisorAverageTrendDatum = {
  month: string;
  average: number;
  supervisorsCount: number;
  totalCappedParticipations: number;
  totalUncappedParticipations: number;
  monthKey: string;
};

type TooltipPayload<T> = {
  payload: T;
};

type SupervisorAverageTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload<SupervisorAverageTrendDatum>[];
};

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

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
  attended_mini_camp?: boolean;
  attended_camp?: boolean;
  roles?: string[];
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
  description?: string | null;
  proof_url?: string | null;
  hours_spent?: number | null;
  participants_count?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  participant_type?: 'volunteer' | 'guest' | 'trainer';
  guest_name?: string | null;
  guest_phone?: string | null;
  trainer_id?: string | null;
}

interface ActivityType {
  id: string;
  name: string;
  name_ar: string;
  points: number;
}

export default function Reports() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('month');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const profilesMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const activityTypesMap = useMemo(() => new Map(activityTypes.map(a => [a.id, a])), [activityTypes]);
  const committeesMap = useMemo(() => new Map(committees.map(c => [c.id, c])), [committees]);
  const trainersById = useMemo(() => new Map(trainers.map(trainer => [trainer.id, trainer])), [trainers]);
  const trainersByUserId = useMemo(
    () => new Map(trainers.filter(trainer => trainer.user_id).map(trainer => [trainer.user_id as string, trainer])),
    [trainers],
  );

  const { indexedSubmissions, submissionsByMonth } = useMemo(() => {
    const byMonth = new Map<string, ActivitySubmission[]>();
    const indexed = submissions.map(s => {
      const date = new Date(s.submitted_at);
      const timestamp = date.getTime();
      const monthKey = Number.isNaN(timestamp) ? '' : format(date, 'yyyy-MM');
      if (monthKey) {
        const bucket = byMonth.get(monthKey);
        if (bucket) {
          bucket.push(s);
        } else {
          byMonth.set(monthKey, [s]);
        }
      }
      return { submission: s, timestamp };
    });
    return { indexedSubmissions: indexed, submissionsByMonth: byMonth };
  }, [submissions]);

  const supervisorIds = useMemo(() => {
    const ids = new Set<string>();
    profiles.forEach(p => {
      if (['responsible', 'platinum', 'diamond'].includes(p.level || 'under_follow_up')) {
        ids.add(p.id);
      }
    });
    return ids;
  }, [profiles]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, committeesRes, submissionsRes, activityTypesRes, userRolesRes, trainersRes] = await Promise.all([
        supabase.from('profiles').select(REPORT_PROFILE_COLUMNS),
        supabase.from('committees').select(REPORT_COMMITTEE_COLUMNS),
        fetchAllReportActivitySubmissions(),
        supabase.from('activity_types').select(REPORT_ACTIVITY_TYPE_COLUMNS),
        supabase.from('user_roles').select(REPORT_USER_ROLE_COLUMNS),
        supabase.from('trainers').select(REPORT_TRAINER_COLUMNS),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (committeesRes.error) throw committeesRes.error;
      if (submissionsRes.error) throw submissionsRes.error;
      if (activityTypesRes.error) throw activityTypesRes.error;
      if (userRolesRes.error) throw userRolesRes.error;

      const profilesData = profilesRes.data || [];
      const submissionsData = submissionsRes.data || [];
      const userRolesData = userRolesRes.data || [];

      if (profilesData) {
        const submissionCounts = new Map<string, number>();
        for (const submission of submissionsData) {
          if (submission.volunteer_id) {
            submissionCounts.set(
              submission.volunteer_id,
              (submissionCounts.get(submission.volunteer_id) || 0) + 1,
            );
          }
        }

        const rolesByUserId = new Map<string, string[]>();
        for (const userRole of userRolesData) {
          if (userRole.user_id) {
            const roles = rolesByUserId.get(userRole.user_id) || [];
            roles.push(userRole.role);
            rolesByUserId.set(userRole.user_id, roles);
          }
        }

        const enrichedProfiles: Profile[] = profilesData.map(profile => {
          return {
            ...profile,
            total_points: profile.total_points ?? 0,
            level: profile.level ?? 'under_follow_up',
            activities_count: submissionCounts.get(profile.id) || 0,
            roles: rolesByUserId.get(profile.id) || [],
          };
        });
        setProfiles(enrichedProfiles);
      }

      if (committeesRes.data) setCommittees(committeesRes.data);
      if (submissionsRes.data) {
        setSubmissions(submissionsRes.data as ActivitySubmission[]);
      }
      if (activityTypesRes.data) setActivityTypes(activityTypesRes.data);
      if (trainersRes.data) setTrainers(trainersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get date range based on selection
  const getDateRange = useCallback(() => {
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
  }, [dateRange]);

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

  // Helper function to get role name in Arabic
  const getRoleName = (role: string): string => {
    const roleMap: Record<string, string> = {
      'admin': 'مدير',
      'supervisor': 'مشرف',
      'committee_leader': 'قائد لجنة',
      'volunteer': 'متطوع',
      'hr': 'HR',
      'head_hr': 'هيد HR',
      'head_caravans': 'رئيس القوافل',
      'head_events': 'رئيس الفعاليات',
      'head_production': 'رئيس الإنتاج',
      'head_fourth_year': 'رئيس السنة الرابعة',
    };
    return roleMap[role] || 'متطوع';
  };

  // Filter submissions by date range
  const filteredSubmissions = useMemo(() => {
    const { start, end } = getDateRange();
    const startMs = start.getTime();
    const endMs = end.getTime();
    return indexedSubmissions
      .filter(item => item.timestamp >= startMs && item.timestamp <= endMs)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(item => item.submission);
  }, [indexedSubmissions, getDateRange]);

  // Committee distribution data
  const committeeData = useMemo(() => {
    const profilesByCommittee = new Map<string, Profile[]>();
    profiles.forEach(p => {
      if (p.committee_id) {
        const list = profilesByCommittee.get(p.committee_id) || [];
        list.push(p);
        profilesByCommittee.set(p.committee_id, list);
      }
    });

    return committees.map(committee => {
      const volunteers = profilesByCommittee.get(committee.id) || [];
      return {
        name: language === 'ar' ? committee.name_ar : committee.name,
        volunteers: volunteers.length,
        points: volunteers.reduce((sum, v) => sum + (v.total_points || 0), 0),
      };
    }).filter(c => c.volunteers > 0);
  }, [committees, profiles, language]);

  // Level distribution data
  const levelData = useMemo(() => {
    let underFollowUp = 0;
    let projectResponsible = 0;
    let responsible = 0;

    profiles.forEach(p => {
      const level = p.level || 'under_follow_up';
      if (['responsible', 'platinum', 'diamond'].includes(level)) {
        responsible++;
      } else if (['project_responsible', 'gold'].includes(level)) {
        projectResponsible++;
      } else {
        underFollowUp++;
      }
    });

    return [
      { name: t('level.under_follow_up'), value: underFollowUp, color: '#64748b' },
      { name: t('level.project_responsible'), value: projectResponsible, color: '#3b82f6' },
      { name: t('level.responsible'), value: responsible, color: '#9333ea' },
    ].filter(l => l.value > 0);
  }, [profiles, t]);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: PieLabelProps) => {
    if (
      typeof cx !== 'number' ||
      typeof cy !== 'number' ||
      typeof midAngle !== 'number' ||
      typeof innerRadius !== 'number' ||
      typeof outerRadius !== 'number'
    ) {
      return null;
    }

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {value ?? ''}
      </text>
    );
  };

  // Activity submissions over time (last 6 months) by Level
  const activityTrend = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const monthKey = format(date, 'yyyy-MM');
    const monthSubmissions = submissionsByMonth.get(monthKey) || [];

    const counts = {
      under_follow_up: 0,
      project_responsible: 0,
      responsible: 0
    };

    monthSubmissions.forEach(s => {
      const volunteer = profilesMap.get(s.volunteer_id);
      if (volunteer) {
        const level = volunteer.level || 'under_follow_up';

        if (['responsible', 'platinum', 'diamond'].includes(level)) {
          counts.responsible++;
        } else if (['project_responsible', 'gold'].includes(level)) {
          counts.project_responsible++;
        } else {
          counts.under_follow_up++;
        }
      }
    });

    return {
      month: format(date, 'MMM'),
      ...counts
    };
  }), [submissionsByMonth, profilesMap]);

  // Top activities by submissions
  const activityStats = useMemo(() => {
    const counts = new Map<string, number>();
    submissions.forEach(s => {
      counts.set(s.activity_type_id, (counts.get(s.activity_type_id) || 0) + 1);
    });

    return activityTypes.map(activity => {
      const count = counts.get(activity.id) || 0;
      return {
        name: language === 'ar' ? activity.name_ar : activity.name,
        count,
        points: activity.points,
      };
    }).filter(a => a.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [activityTypes, submissions, language]);

  // Supervisor average participations in selected date range (capped at 8 per supervisor)
  const supervisorAverageSelectedRange = useMemo(() => {
    if (supervisorIds.size === 0) return 0;

    const countsBySupervisor = new Map<string, number>();
    filteredSubmissions.forEach(s => {
      if (supervisorIds.has(s.volunteer_id)) {
        countsBySupervisor.set(s.volunteer_id, (countsBySupervisor.get(s.volunteer_id) || 0) + 1);
      }
    });

    let totalCapped = 0;
    countsBySupervisor.forEach(count => {
      totalCapped += Math.min(count, 8);
    });

    return parseFloat((totalCapped / supervisorIds.size).toFixed(2));
  }, [supervisorIds, filteredSubmissions]);

  // Monthly average supervisor participations over last 6 months (capped at 8 per supervisor)
  const supervisorAverageTrend = useMemo<SupervisorAverageTrendDatum[]>(() => Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const monthKey = format(date, 'yyyy-MM');
    const monthSubmissions = submissionsByMonth.get(monthKey) || [];
    const supervisorsCount = supervisorIds.size;

    let totalCapped = 0;
    let totalUncapped = 0;
    if (supervisorsCount > 0) {
      const countsBySupervisor = new Map<string, number>();
      monthSubmissions.forEach(s => {
        if (supervisorIds.has(s.volunteer_id)) {
          countsBySupervisor.set(s.volunteer_id, (countsBySupervisor.get(s.volunteer_id) || 0) + 1);
        }
      });
      countsBySupervisor.forEach(count => {
        totalCapped += Math.min(count, 8);
        totalUncapped += count;
      });
    }

    const average = supervisorsCount > 0 ? parseFloat((totalCapped / supervisorsCount).toFixed(2)) : 0;

    return {
      month: language === 'ar' ? ARABIC_MONTHS[date.getMonth()] : format(date, 'MMM'),
      average,
      supervisorsCount,
      totalCappedParticipations: totalCapped,
      totalUncappedParticipations: totalUncapped,
      monthKey,
    };
  }), [submissionsByMonth, supervisorIds, language]);

  // CSV Export functions
  const downloadCSV = (data: CsvRow[], filename: string) => {
    if (data.length === 0) {
      toast.error(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    saveCsv(data, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);

    toast.success(language === 'ar' ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
  };

  const handleExport = (type: string) => {
    switch (type) {
      case 'volunteers': {
        const volunteersData = profiles.map(p => {
          const level = p.level || 'under_follow_up';
          const isResponsible = ['responsible', 'platinum', 'diamond'].includes(level);

          // Determine camp attendance status
          let campAttendance = '';
          if (!isResponsible) {
            if (p.attended_mini_camp || p.attended_camp) {
              campAttendance = language === 'ar' ? 'نعم' : 'Yes';
            } else {
              campAttendance = language === 'ar' ? 'لا' : 'No';
            }
          }

          // Get primary role (first non-volunteer role, or volunteer if that's all they have)
          const primaryRole = p.roles?.find(r => r !== 'volunteer') || p.roles?.[0] || 'volunteer';
          const roleDisplay = language === 'ar' ? getRoleName(primaryRole) : primaryRole;

          return {
            [language === 'ar' ? 'الاسم' : 'Name']: p.full_name || '',
            [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
            [language === 'ar' ? 'رقم الهاتف' : 'Phone']: p.phone || '',
            [language === 'ar' ? 'الدرجة التطوعية' : 'Volunteer Degree']: getLevelName(level),
            [language === 'ar' ? 'الدور' : 'Role']: roleDisplay,
            [language === 'ar' ? 'حضر الكامب' : 'Attended Camp']: campAttendance,
            [language === 'ar' ? 'الأثر' : 'Impact']: p.total_points,
            [language === 'ar' ? 'عدد المشاركات' : 'Participations Count']: p.activities_count,
            [language === 'ar' ? 'اللجنة' : 'Committee']: (p.committee_id ? committeesMap.get(p.committee_id)?.[language === 'ar' ? 'name_ar' : 'name'] : '') || '',
          };
        });
        downloadCSV(volunteersData, 'volunteers');
        break;
      }

      case 'activities': {
        const reportData = filteredSubmissions.map(s => {
          const volunteer = profilesMap.get(s.volunteer_id);
          const activityType = activityTypesMap.get(s.activity_type_id);
          const committeeId = volunteer?.committee_id || s.committee_id;
          const committee = committeeId ? committeesMap.get(committeeId) : undefined;

          let locationStr = s.location || 'branch';
          if (locationStr === 'home' || locationStr === 'remote') locationStr = language === 'ar' ? 'من البيت' : 'Home';
          else if (locationStr === 'branch') locationStr = language === 'ar' ? 'الفرع' : 'Branch';

          let participantName = volunteer?.full_name || (language === 'ar' ? 'غير معروف' : 'Unknown');
          let participantType = language === 'ar' ? 'متطوع' : 'Volunteer';

          let participantPhone = volunteer?.phone || '';

          if (s.participant_type === 'trainer' || (!volunteer && s.trainer_id)) {
            participantType = language === 'ar' ? 'مدرب' : 'Trainer';
            const trainer = (s.trainer_id ? trainersById.get(s.trainer_id) : null) || (s.volunteer_id ? trainersByUserId.get(s.volunteer_id) : null);
            if (trainer) {
              participantName = language === 'ar' ? trainer.name_ar : trainer.name_en;
              participantPhone = trainer.phone || participantPhone;
            } else if (s.guest_name) {
              participantName = s.guest_name;
              participantPhone = s.guest_phone || '';
            }
          } else if (s.participant_type === 'guest' || s.guest_name) {
            participantType = language === 'ar' ? 'ضيف' : 'Guest';
            participantName = s.guest_name || '';
            participantPhone = s.guest_phone || '';
          }

          return {
            [language === 'ar' ? 'نوع المهمة' : 'Task Type']: activityType?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'اللجنة' : 'Committee']: committee?.[language === 'ar' ? 'name_ar' : 'name'] || '',
            [language === 'ar' ? 'اسم المشارك' : 'Participant Name']: participantName,
            [language === 'ar' ? 'نوع المشارك' : 'Participant Type']: participantType,
            [language === 'ar' ? 'رقم الهاتف' : 'Phone']: participantPhone ? `'${participantPhone}'` : '',
            [language === 'ar' ? 'نوع المشاركة' : 'Participation Type']: locationStr,
            [language === 'ar' ? 'تاريخ المشاركة' : 'Date']: format(new Date(s.submitted_at), 'yyyy-MM-dd'),
            [language === 'ar' ? 'الملاحظات' : 'Notes']: s.description || '',
            [language === 'ar' ? 'رابط الإثبات' : 'Proof Link']: s.proof_url || '',
          };
        });
        // Use 'participation_log' filename, filtered by current month
        downloadCSV(reportData, `participation_log_${dateRange}`);
        break;
      }

      case 'points': {
        const pointsData = profiles.map(p => ({
          [language === 'ar' ? 'الاسم' : 'Name']: p.full_name || '',
          [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: p.email,
          [language === 'ar' ? 'إجمالي الأثر' : 'Total Impact']: p.total_points,
          [language === 'ar' ? 'الدرجة التطوعية' : 'Volunteer Degree']: getLevelName(p.level || 'under_follow_up'),
        })).sort((a, b) => (b[language === 'ar' ? 'إجمالي الأثر' : 'Total Impact'] as number) - (a[language === 'ar' ? 'إجمالي الأثر' : 'Total Impact'] as number));
        downloadCSV(pointsData, 'points_summary');
        break;
      }

      case 'full':
        // Export all data as a comprehensive report
        // Temporarily disabled as requested
        toast.info(language === 'ar' ? 'التقرير فارغ حالياً' : 'Report is currently empty');
        break;
    }
  };

  // Calculate summary stats
  const totalVolunteers = profiles.length;
  const totalApprovedActivities = useMemo(() => submissions.filter(s => s.status === 'approved').length, [submissions]);
  const totalSubmissions = submissions.length;

  // Calculate volunteers by level
  const volunteersByLevel = useMemo(() => {
    let under_follow_up = 0;
    let project_responsible = 0;
    let responsible = 0;

    profiles.forEach(p => {
      const level = p.level || 'under_follow_up';
      if (['responsible', 'platinum', 'diamond'].includes(level)) {
        responsible++;
      } else if (['project_responsible', 'gold'].includes(level)) {
        project_responsible++;
      } else {
        under_follow_up++;
      }
    });
    return { under_follow_up, project_responsible, responsible };
  }, [profiles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">{t('reports.title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground break-words">{t('reports.subtitle')}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Calendar className="h-4 w-4 shrink-0 ltr:mr-2 rtl:ml-2" />
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <Card className="h-full min-w-0 overflow-hidden">
          <CardContent className="p-4 sm:p-6 flex items-center h-full">
            <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
              <div className="rounded-full bg-primary/10 p-2.5 sm:p-3 shrink-0">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug break-words">{t('admin.totalVolunteers')}</p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 truncate">{totalVolunteers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full min-w-0 overflow-hidden">
          <CardContent className="p-4 sm:p-6 flex items-center h-full">
            <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
              <div className="rounded-full bg-success/10 p-2.5 sm:p-3 shrink-0">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug break-words">{t('admin.totalActivities')}</p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 truncate">{totalApprovedActivities}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full min-w-0 overflow-hidden">
          <CardContent className="p-4 sm:p-6 flex items-center h-full">
            <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
              <div className="rounded-full bg-warning/10 p-2.5 sm:p-3 shrink-0">
                <Award className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug break-words">{language === 'ar' ? 'إجمالي المشاركات' : 'Total Submissions'}</p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 truncate">{totalSubmissions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full min-w-0 overflow-hidden">
          <CardContent className="p-4 sm:p-6 flex items-center h-full">
            <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
              <div className="rounded-full bg-purple-100 dark:bg-purple-900/20 p-2.5 sm:p-3 shrink-0">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug break-words">
                  {language === 'ar' ? 'متوسط مشاركات المسؤولين' : 'Supervisors Avg. Participations'}
                </p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 truncate">{supervisorAverageSelectedRange}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volunteers by Level */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card className="h-full min-w-0 overflow-hidden">
          <CardContent className="p-4 sm:p-6 flex items-center h-full">
            <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
              <div className="rounded-full bg-slate-500/10 p-2.5 sm:p-3 shrink-0">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug break-words">{t('level.under_follow_up')}</p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 truncate">{volunteersByLevel.under_follow_up}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full min-w-0 overflow-hidden">
          <CardContent className="p-4 sm:p-6 flex items-center h-full">
            <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
              <div className="rounded-full bg-blue-500/10 p-2.5 sm:p-3 shrink-0">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug break-words">{t('level.project_responsible')}</p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 truncate">{volunteersByLevel.project_responsible}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-full min-w-0 overflow-hidden">
          <CardContent className="p-4 sm:p-6 flex items-center h-full">
            <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
              <div className="rounded-full bg-purple-600/10 p-2.5 sm:p-3 shrink-0">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug break-words">{t('level.responsible')}</p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5 truncate">{volunteersByLevel.responsible}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Activity Trend */}
        <Card className="h-full min-w-0 overflow-hidden flex flex-col">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl leading-snug break-words">{t('reports.activityTrend')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm leading-relaxed break-words">{t('reports.activityTrendDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 sm:pt-0 flex-1 flex flex-col justify-between">
            <div className="h-[250px] sm:h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityTrend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" width={36} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
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
        <Card className="h-full min-w-0 overflow-hidden flex flex-col">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl leading-snug break-words">{t('reports.levelDistribution')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm leading-relaxed break-words">{t('reports.levelDistributionDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 sm:pt-0 flex-1 flex flex-col justify-between gap-4">
            {levelData.length === 0 ? (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground">
                {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
              </div>
            ) : (
              <>
                <div className="h-[220px] sm:h-[250px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={levelData}
                        cx="50%"
                        cy="50%"
                        innerRadius="42%"
                        outerRadius="72%"
                        paddingAngle={5}
                        dataKey="value"
                        label={renderCustomLabel}
                        labelLine={false}
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
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {levelData.map((item) => {
                    const pct = totalVolunteers > 0 ? Math.round((item.value / totalVolunteers) * 100) : 0;
                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between sm:flex-col sm:items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs font-medium text-muted-foreground truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5 shrink-0">
                          <span className="text-sm font-bold">{item.value}</span>
                          <span className="text-[11px] text-muted-foreground">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Top Activities */}
        <Card className="h-full min-w-0 overflow-hidden flex flex-col">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl leading-snug break-words">{t('reports.topActivities')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm leading-relaxed break-words">{t('reports.topActivitiesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 sm:pt-0 flex-1">
            <div className="space-y-3 sm:space-y-4">
              {activityStats.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  {language === 'ar' ? 'لا توجد أنشطة بعد' : 'No activities yet'}
                </div>
              ) : (
                activityStats.map((activity, index) => (
                  <div key={activity.name} className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs sm:text-sm font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium truncate">{activity.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {activity.count} {language === 'ar' ? 'مشاركة' : 'submissions'} • {activity.points} {t('common.points')}
                      </p>
                    </div>
                    <div className="h-2 w-16 sm:w-24 shrink-0 rounded-full bg-muted overflow-hidden">
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

        {/* Supervisor Average Participations Trend Chart */}
        <Card className="h-full min-w-0 overflow-hidden flex flex-col">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl leading-snug break-words">
              {language === 'ar' ? 'معدل متوسط مشاركات المسؤولين' : 'Supervisors Average Participations Trend'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm leading-relaxed break-words">
              {language === 'ar'
                ? 'متوسط مشاركات درجة مسئول شهرياً (بحد أقصى 8 مشاركات للمسؤول الواحد)'
                : 'Monthly average participations for supervisor level (capped at 8 per supervisor)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2 sm:pt-0 flex-1 flex flex-col justify-between">
            <div className="h-[250px] sm:h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supervisorAverageTrend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" width={36} />
                  <Tooltip
                    content={({ active, payload }: SupervisorAverageTooltipProps) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-card p-3 shadow-md space-y-1 text-xs sm:text-sm max-w-[260px]">
                            <p className="font-semibold">{data.month}</p>
                            <p className="text-purple-600 dark:text-purple-400 font-medium">
                              {language === 'ar' ? 'متوسط المشاركات: ' : 'Average: '}
                              {data.average}
                            </p>
                            <p className="text-muted-foreground">
                              {language === 'ar' ? 'عدد المسئولين: ' : 'Supervisors: '}
                              {data.supervisorsCount}
                            </p>
                            <p className="text-muted-foreground">
                              {language === 'ar' ? 'إجمالي المشاركات (المحددة بـ 8): ' : 'Total Capped Participations: '}
                              {data.totalCappedParticipations}
                            </p>
                            <p className="text-muted-foreground">
                              {language === 'ar' ? 'إجمالي المشاركات الفعلي: ' : 'Total Actual Participations: '}
                              {data.totalUncappedParticipations}
                            </p>
                            <div className="pt-1 border-t mt-1 text-[11px] text-primary font-medium animate-pulse">
                              {language === 'ar'
                                ? 'اضغط على العمود للانتقال والتصفية'
                                : 'Click column to view & filter'}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar
                    dataKey="average"
                    fill="#9333ea"
                    radius={[4, 4, 0, 0]}
                    name={language === 'ar' ? 'متوسط المشاركات' : 'Average Participations'}
                    onClick={(data) => {
                      if (data && data.monthKey) {
                        navigate(`/hr/submissions?level=responsible&month=${data.monthKey}`);
                      }
                    }}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl leading-snug break-words">{t('reports.exportData')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 sm:pt-0">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            <Button
              variant="outline"
              className="w-full justify-start h-auto min-h-[44px] py-3 px-3 sm:px-4 whitespace-normal text-start"
              onClick={() => handleExport('volunteers')}
            >
              <Download className="h-4 w-4 shrink-0 ltr:mr-2 rtl:ml-2" />
              <span className="min-w-0 flex-1 break-words">{t('reports.volunteerList')}</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto min-h-[44px] py-3 px-3 sm:px-4 whitespace-normal text-start"
              onClick={() => handleExport('activities')}
            >
              <Download className="h-4 w-4 shrink-0 ltr:mr-2 rtl:ml-2" />
              <span className="min-w-0 flex-1 break-words">{t('reports.activityLog')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
