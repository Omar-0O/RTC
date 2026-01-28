import { useState, useEffect, useMemo } from 'react';
import { Users, TrendingUp, FileSpreadsheet, Calendar, Award, Filter, Check, ChevronsUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatsCard } from '@/components/ui/stats-card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CourseAdsTable } from '@/components/dashboard/CourseAdsTable';

interface Profile {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  email: string;
  total_points: number;
  level: string;
  avatar_url: string | null;
  committee_id: string | null;
  phone?: string;
}

interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

interface Submission {
  id: string;
  volunteer_id: string;
  activity_type_id: string;
  submitted_at: string;
  points_awarded: number;
  status: string;
  location?: string;
  wore_vest?: boolean;
  description?: string;
  proof_url?: string;
  profiles: Profile;
  activity_types: {
    name: string;
    name_ar: string;
  };
}

export default function CommitteeLeaderDashboard() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';

  const [committee, setCommittee] = useState<Committee | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [memberFilter, setMemberFilter] = useState<'all' | 'members' | 'external'>('all');
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [volunteerSearchOpen, setVolunteerSearchOpen] = useState(false);

  // Volunteer levels
  const volunteerLevels = [
    { value: 'all', label: { ar: 'كل الدرجات', en: 'All Degrees' } },
    { value: 'under_follow_up', label: { ar: 'تحت المتابعة', en: 'Under Follow-up' } },
    { value: 'project_responsible', label: { ar: 'مسؤول مشروع', en: 'Project Responsible' } },
    { value: 'responsible', label: { ar: 'مسؤول', en: 'Responsible' } },
  ];

  // Get all volunteers (committee members + those with submissions)
  const allVolunteers = useMemo(() => {
    const uniqueVolunteers = new Map<string, Profile>();

    // Add all committee members first
    committeeMembers.forEach(member => {
      uniqueVolunteers.set(member.id, member);
    });

    // Also add volunteers from submissions (in case they're external)
    submissions.forEach(s => {
      if (!uniqueVolunteers.has(s.profiles.id)) {
        uniqueVolunteers.set(s.profiles.id, s.profiles);
      }
    });

    return Array.from(uniqueVolunteers.values());
  }, [committeeMembers, submissions]);

  // Committee IDs for special handling
  const CARAVANS_COMMITTEE_ID = 'e3517d42-3140-4323-bf79-5a6728fc45ef';
  const EVENTS_COMMITTEE_ID = 'c82bc5e2-49b1-4951-9f1e-249afeaafeb8';

  const committeeId = profile?.committee_id;

  const fetchData = async () => {
    if (!committeeId) return;
    setIsLoading(true);

    try {
      // Fetch committee info
      const { data: committeeData } = await supabase
        .from('committees')
        .select('*')
        .eq('id', committeeId)
        .maybeSingle();

      if (committeeData) setCommittee(committeeData);

      // Fetch committee members
      const { data: membersData } = await supabase
        .from('profiles')
        .select('id, full_name, full_name_ar, email, total_points, level, avatar_url, committee_id, phone')
        .eq('committee_id', committeeId)
        .order('full_name');

      if (membersData) setCommitteeMembers(membersData);

      // Fetch submissions for this committee
      const monthDate = new Date(selectedMonth + '-01');
      const startDate = startOfMonth(monthDate);
      const endDate = endOfMonth(monthDate);

      const { data: submissionsData, error } = await supabase
        .from('activity_submissions')
        .select(`
          id,
          volunteer_id,
          activity_type_id,
          submitted_at,
          points_awarded,
          status,
          location,
          wore_vest,
          description,
          proof_url,
          profiles:profiles!activity_submissions_volunteer_id_fkey!inner (
            id, full_name, full_name_ar, email, total_points, level, avatar_url, committee_id, phone
          ),
          activity_types (name, name_ar)
        `)
        .eq('committee_id', committeeId)
        .gte('submitted_at', startDate.toISOString())
        .lte('submitted_at', endDate.toISOString())
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      setSubmissions(submissionsData as unknown as Submission[] || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error(isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [committeeId, selectedMonth]);

  // Filter submissions based on all filters
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      // Member filter
      if (memberFilter !== 'all') {
        const isMember = sub.profiles.committee_id === committeeId;
        if (memberFilter === 'members' && !isMember) return false;
        if (memberFilter === 'external' && isMember) return false;
      }

      // Volunteer filter
      if (selectedVolunteer && sub.profiles.id !== selectedVolunteer) return false;

      // Level filter
      if (levelFilter !== 'all' && sub.profiles.level !== levelFilter) return false;

      return true;
    });
  }, [submissions, memberFilter, committeeId, selectedVolunteer, levelFilter]);

  // Stats
  const totalSubmissions = submissions.length;
  const memberSubmissions = submissions.filter(s => s.profiles.committee_id === committeeId).length;
  const externalSubmissions = totalSubmissions - memberSubmissions;
  const totalPoints = submissions.reduce((sum, s) => sum + (s.points_awarded || 0), 0);

  const committeeName = language === 'ar' ? committee?.name_ar : committee?.name;

  const getLevelLabel = (levelValue: string) => {
    const levelMap: Record<string, { ar: string; en: string }> = {
      bronze: { ar: 'تحت المتابعة', en: 'Under Follow-up' },
      silver: { ar: 'تحت المتابعة', en: 'Under Follow-up' },
      under_follow_up: { ar: 'تحت المتابعة', en: 'Under Follow-up' },
      gold: { ar: 'مسؤول مشروع', en: 'Project Responsible' },
      project_responsible: { ar: 'مسؤول مشروع', en: 'Project Responsible' },
      platinum: { ar: 'مسؤول', en: 'Responsible' },
      diamond: { ar: 'مسؤول', en: 'Responsible' },
      responsible: { ar: 'مسؤول', en: 'Responsible' },
    };
    return levelMap[levelValue]?.[isRTL ? 'ar' : 'en'] || levelValue;
  };

  const exportReport = () => {
    const reportData = filteredSubmissions.map(s => {
      const volunteer = s.profiles;
      const activityType = s.activity_types;

      let locationStr = s.location || 'branch';
      if (locationStr === 'home' || locationStr === 'remote') locationStr = isRTL ? 'من البيت' : 'Home';
      else if (locationStr === 'branch') locationStr = isRTL ? 'الفرع' : 'Branch';

      const vestStatus = s.location === 'branch'
        ? (s.wore_vest ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No'))
        : '';

      const memberStatus = volunteer.committee_id === committeeId
        ? (isRTL ? 'عضو' : 'Member')
        : (isRTL ? 'خارجي' : 'External');

      return {
        [isRTL ? 'نوع المهمة' : 'Task Type']: activityType?.[isRTL ? 'name_ar' : 'name'] || '',
        [isRTL ? 'اسم المتطوع' : 'Volunteer Name']: isRTL ? volunteer?.full_name_ar : volunteer?.full_name || '',
        [isRTL ? 'رقم الهاتف' : 'Phone']: `'${volunteer?.phone || ''}'`,
        [isRTL ? 'نوع العضوية' : 'Membership']: memberStatus,
        [isRTL ? 'نوع المشاركة' : 'Participation Type']: locationStr,
        [isRTL ? 'ارتدى الـ Vest' : 'Wore Vest']: vestStatus,
        [isRTL ? 'الأثر' : 'Impact']: s.points_awarded || 0,
        [isRTL ? 'تاريخ المشاركة' : 'Date']: format(new Date(s.submitted_at), 'yyyy-MM-dd'),
        [isRTL ? 'الملاحظات' : 'Notes']: s.description || '',
      };
    });

    if (reportData.length === 0) {
      toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    const headers = Object.keys(reportData[0]);
    const csvContent = [
      headers.join(','),
      ...reportData.map(row => headers.map(header => {
        const value = row[header as keyof typeof row];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `committee_submissions_${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(isRTL ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
            {isRTL ? 'إدارة المشاركات' : 'Submissions Management'} - {committeeName}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isRTL ? 'عرض وإدارة مشاركات اللجنة' : 'View and manage committee submissions'}
          </p>
        </div>
        <Button variant="outline" onClick={exportReport}>
          <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {isRTL ? 'تصدير السجل' : 'Export Log'}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={isRTL ? 'إجمالي المشاركات' : 'Total Submissions'}
          value={totalSubmissions}
          icon={Award}
          description={isRTL ? 'مشاركة هذا الشهر' : 'this month'}
        />
        <StatsCard
          title={isRTL ? 'مشاركات الأعضاء' : 'Member Submissions'}
          value={memberSubmissions}
          icon={Users}
          description={isRTL ? 'من أعضاء اللجنة' : 'from committee members'}
        />
        <StatsCard
          title={isRTL ? 'مشاركات خارجية' : 'External Submissions'}
          value={externalSubmissions}
          icon={TrendingUp}
          description={isRTL ? 'من متطوعين آخرين' : 'from other volunteers'}
        />
        <StatsCard
          title={isRTL ? 'إجمالي الأثر' : 'Total Impact'}
          value={totalPoints}
          icon={Award}
          description={isRTL ? 'نقطة' : 'points'}
        />
      </div>

      <CourseAdsTable />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {isRTL ? 'الفلاتر' : 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'الشهر' : 'Month'}</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'نوع العضوية' : 'Membership Type'}</Label>
            <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                <SelectItem value="members">{isRTL ? 'أعضاء اللجنة' : 'Committee Members'}</SelectItem>
                <SelectItem value="external">{isRTL ? 'متطوعين آخرين' : 'External Volunteers'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'الدرجة التطوعية' : 'Volunteer Level'}</Label>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {volunteerLevels.map(level => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label[isRTL ? 'ar' : 'en']}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'بحث بالمتطوع' : 'Search Volunteer'}</Label>
            <Popover open={volunteerSearchOpen} onOpenChange={setVolunteerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={volunteerSearchOpen}
                  className="w-full justify-between"
                >
                  {selectedVolunteer ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={allVolunteers.find(v => v.id === selectedVolunteer)?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {allVolunteers.find(v => v.id === selectedVolunteer)?.full_name?.substring(0, 2) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">
                        {isRTL
                          ? (allVolunteers.find(v => v.id === selectedVolunteer)?.full_name_ar || allVolunteers.find(v => v.id === selectedVolunteer)?.full_name)
                          : allVolunteers.find(v => v.id === selectedVolunteer)?.full_name}
                      </span>
                    </div>
                  ) : (isRTL ? 'الكل' : 'All')}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder={isRTL ? 'ابحث عن متطوع...' : 'Search volunteer...'} />
                  <CommandList>
                    <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results found'}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all_clear"
                        onSelect={() => {
                          setSelectedVolunteer('');
                          setVolunteerSearchOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", !selectedVolunteer ? "opacity-100" : "opacity-0")} />
                        {isRTL ? 'الكل' : 'All'}
                      </CommandItem>
                      {allVolunteers.map(volunteer => (
                        <CommandItem
                          key={volunteer.id}
                          value={(isRTL ? volunteer.full_name_ar : volunteer.full_name) || 'unknown'}
                          onSelect={() => {
                            setSelectedVolunteer(volunteer.id === selectedVolunteer ? '' : volunteer.id);
                            setVolunteerSearchOpen(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Check className={cn("h-4 w-4 shrink-0", selectedVolunteer === volunteer.id ? "opacity-100" : "opacity-0")} />
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={volunteer.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {volunteer.full_name?.substring(0, 2) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">
                            {isRTL ? (volunteer.full_name_ar || volunteer.full_name) : volunteer.full_name}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Submissions List */}
      <div className="space-y-4">
        {filteredSubmissions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Award className="h-12 w-12 mb-4 opacity-20" />
              <p>{isRTL ? 'لا توجد مشاركات' : 'No submissions found'}</p>
            </CardContent>
          </Card>
        ) : (
          filteredSubmissions.map((submission) => {
            const isMember = submission.profiles.committee_id === committeeId;
            return (
              <Card key={submission.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-4">
                    {/* Volunteer Avatar */}
                    <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-primary/10">
                      <AvatarImage src={submission.profiles.avatar_url || undefined} />
                      <AvatarFallback className="text-lg">
                        {(submission.profiles.full_name?.substring(0, 2) || "U")}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0 grid gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-base sm:text-lg truncate">
                            {isRTL ? submission.profiles.full_name_ar : submission.profiles.full_name}
                          </h3>
                          <Badge
                            variant={isMember ? "default" : "outline"}
                            className={cn(
                              "text-xs shrink-0",
                              isMember ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"
                            )}
                          >
                            {isMember ? (isRTL ? 'عضو' : 'Member') : (isRTL ? 'خارجي' : 'External')}
                          </Badge>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {getLevelLabel(submission.profiles.level)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(submission.submitted_at), 'PPP')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-foreground/80">
                        <span className="font-medium">
                          {isRTL ? submission.activity_types.name_ar : submission.activity_types.name}
                        </span>
                      </div>

                      {/* Status & Points */}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="default" className="h-6">
                          {submission.points_awarded} {isRTL ? 'أثر' : 'Impact'}
                        </Badge>
                        {submission.location && (
                          <Badge variant="outline" className="h-6">
                            {submission.location === 'branch'
                              ? (isRTL ? 'الفرع' : 'Branch')
                              : (isRTL ? 'من البيت' : 'Remote')}
                          </Badge>
                        )}
                        {submission.wore_vest && (
                          <Badge variant="outline" className="h-6 bg-blue-50 text-blue-700">
                            {isRTL ? 'Vest ✓' : 'Vest ✓'}
                          </Badge>
                        )}
                      </div>

                      {submission.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {submission.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
