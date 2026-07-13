import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Search,
    FileSpreadsheet,
    Calendar,
    Users,
    CheckCircle,
    TrendingUp,
    AlertTriangle,
    MessageCircle,
    Info,
    ArrowRightLeft,
    Clock,
    X,
    Eye,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MonthPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Navigate } from 'react-router-dom';
import { appendJsonSheet, ensureXlsxFilename, loadXlsx } from '@/utils/xlsx';

interface Profile {
    id: string;
    full_name: string;
    full_name_ar: string;
    level: string | null;
    avatar_url: string | null;
    phone: string | null;
    committee_id: string | null;
    committees: {
        id: string;
        name: string;
        name_ar: string;
    } | null;
}

interface Submission {
    id: string;
    volunteer_id: string | null;
    activity_type_id: string;
    submitted_at: string;
    status: string;
    points_awarded: number;
    description: string | null;
    location: string | null;
    proof_url: string | null;
    activity_types: {
        name: string;
        name_ar: string;
    } | null;
    committees: {
        name: string;
        name_ar: string;
    } | null;
}

interface VolunteerStats {
    volunteer: Profile;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    target: number;
    remaining: number;
    submissions: Submission[];
}

export default function HRDashboard() {
    const { roles, isLoading: authLoading } = useAuth();
    const { language, isRTL } = useLanguage();
    const { activeBranch } = useBranch();

    // Check permissions (hr, head_hr, admin, supervisor, branch_admin are allowed)
    const isAuthorized = useMemo(() => {
        if (authLoading) return true;
        return roles.some((role) => ['hr', 'head_hr', 'admin', 'branch_admin', 'supervisor'].includes(role));
    }, [roles, authLoading]);

    const [volunteers, setVolunteers] = useState<Profile[]>([]);
    const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters state
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Detail modal/sheet state
    const [selectedVolunteerStats, setSelectedVolunteerStats] = useState<VolunteerStats | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [year, month] = selectedMonth.split('-');
            const monthDate = new Date(Number(year), Number(month) - 1, 1);
            const startDate = startOfMonth(monthDate);
            const endDate = endOfMonth(monthDate);

            const adminRolesQuery = supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'admin');

            let profilesQuery = supabase
                .from('profiles')
                .select(`
                    id,
                    full_name,
                    full_name_ar,
                    level,
                    avatar_url,
                    phone,
                    committee_id,
                    committees:committees(id, name, name_ar)
                `);

            let submissionsQuery = supabase
                .from('activity_submissions')
                .select(`
                    id,
                    volunteer_id,
                    activity_type_id,
                    submitted_at,
                    status,
                    points_awarded,
                    description,
                    location,
                    proof_url,
                    activity_types:activity_types(name, name_ar),
                    committees:committees(name, name_ar)
                `)
                .gte('submitted_at', startDate.toISOString())
                .lte('submitted_at', endDate.toISOString());

            if (activeBranch?.id) {
                profilesQuery = profilesQuery.eq('branch_id', activeBranch.id);
                submissionsQuery = submissionsQuery.eq('branch_id', activeBranch.id);
            }

            const [adminRolesResult, profilesResult, submissionsResult] = await Promise.all([
                adminRolesQuery,
                profilesQuery,
                submissionsQuery,
            ]);
            if (adminRolesResult.error) throw adminRolesResult.error;
            if (profilesResult.error) throw profilesResult.error;
            if (submissionsResult.error) throw submissionsResult.error;

            const adminIds = new Set((adminRolesResult.data || []).map((role) => role.user_id));
            const nonAdminVolunteers = (profilesResult.data || []).filter(
                (profile) => !adminIds.has(profile.id),
            ) as unknown as Profile[];
            setVolunteers(nonAdminVolunteers);

            setAllSubmissions((submissionsResult.data || []) as unknown as Submission[]);
        } catch (error) {
            console.error('Error fetching HR Dashboard data:', error);
            toast.error(isRTL ? 'فشل في تحميل بيانات داشبورد HR' : 'Failed to load HR Dashboard data');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranch?.id, isRTL, selectedMonth]);

    useEffect(() => {
        if (isAuthorized) void fetchData();
    }, [fetchData, isAuthorized]);

    // Level configuration target helper
    const getVolunteerTarget = (level: string | null | undefined): number => {
        if (!level) return 4;
        const cleanLevel = level.toLowerCase();
        if (['under_follow_up', 'bronze', 'silver', 'newbie', 'active'].includes(cleanLevel)) {
            return 4;
        }
        if (['project_responsible', 'gold', 'responsible', 'platinum', 'diamond'].includes(cleanLevel)) {
            return 8;
        }
        return 4; // Default target
    };

    const getLevelText = (level: string | null | undefined): { ar: string; en: string } => {
        if (!level) return { ar: 'تحت المتابعة', en: 'Under Follow-up' };
        const cleanLevel = level.toLowerCase();
        if (['under_follow_up', 'bronze', 'silver', 'newbie', 'active'].includes(cleanLevel)) {
            return { ar: 'تحت المتابعة', en: 'Under Follow-up' };
        }
        if (['project_responsible', 'gold'].includes(cleanLevel)) {
            return { ar: 'مشروع مسؤول', en: 'Project Responsible' };
        }
        if (['responsible', 'platinum', 'diamond'].includes(cleanLevel)) {
            return { ar: 'مسؤول', en: 'Responsible' };
        }
        return { ar: 'تحت المتابعة', en: 'Under Follow-up' };
    };

    const submissionsByVolunteer = useMemo(() => {
        const indexedSubmissions = new Map<string, Submission[]>();
        for (const submission of allSubmissions) {
            if (!submission.volunteer_id) continue;
            const volunteerSubmissions = indexedSubmissions.get(submission.volunteer_id) || [];
            volunteerSubmissions.push(submission);
            indexedSubmissions.set(submission.volunteer_id, volunteerSubmissions);
        }
        return indexedSubmissions;
    }, [allSubmissions]);

    // Calculate aggregated volunteer stats in O(volunteers + submissions).
    const volunteerStatsList: VolunteerStats[] = useMemo(() => {
        return volunteers.map(volunteer => {
            const submissions = submissionsByVolunteer.get(volunteer.id) || [];
            const approvedCount = submissions.filter(s => s.status === 'approved').length;
            const pendingCount = submissions.filter(s => s.status === 'pending').length;
            const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

            const target = getVolunteerTarget(volunteer.level);
            const remaining = Math.max(0, target - approvedCount);

            return {
                volunteer,
                approvedCount,
                pendingCount,
                rejectedCount,
                target,
                remaining,
                submissions
            };
        }).sort((a, b) => {
            // Sort: completed first, or by approved count descending
            if (a.remaining === 0 && b.remaining > 0) return -1;
            if (b.remaining === 0 && a.remaining > 0) return 1;
            return b.approvedCount - a.approvedCount;
        });
    }, [submissionsByVolunteer, volunteers]);

    // Apply client filters
    const filteredVolunteerStats = useMemo(() => {
        return volunteerStatsList.filter(item => {
            // 1. Search Query
            const vName = (item.volunteer.full_name || '').toLowerCase();
            const vNameAr = (item.volunteer.full_name_ar || '').toLowerCase();
            const search = searchQuery.toLowerCase();
            const matchesSearch = vName.includes(search) || vNameAr.includes(search);

            // 2. Level filter
            let matchesLevel = true;
            if (levelFilter !== 'all') {
                const mappedLevel = getLevelText(item.volunteer.level).en.toLowerCase().replace(' ', '_').replace('-', '_');
                matchesLevel = mappedLevel.includes(levelFilter.toLowerCase());
            }

            // 3. Status filter
            let matchesStatus = true;
            if (statusFilter === 'completed') {
                matchesStatus = item.remaining === 0;
            } else if (statusFilter === 'in_progress') {
                matchesStatus = item.remaining > 0 && item.approvedCount > 0;
            } else if (statusFilter === 'no_participation') {
                matchesStatus = item.approvedCount === 0 && item.pendingCount === 0;
            }

            return matchesSearch && matchesLevel && matchesStatus;
        });
    }, [volunteerStatsList, searchQuery, levelFilter, statusFilter]);

    // KPI Aggregations
    const kpis = useMemo(() => {
        const total = volunteerStatsList.length;
        const completed = volunteerStatsList.filter(item => item.remaining === 0).length;
        const inProgress = volunteerStatsList.filter(item => item.remaining > 0 && item.approvedCount > 0).length;
        const noParticipation = volunteerStatsList.filter(item => item.approvedCount === 0 && item.pendingCount === 0).length;

        // Completion percentage
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
            total,
            completed,
            inProgress,
            noParticipation,
            completionRate
        };
    }, [volunteerStatsList]);

    // Role verification check redirect
    if (!authLoading && !isAuthorized) {
        return <Navigate to="/dashboard" replace />;
    }

    // Export Dashboard to Excel
    const handleExportExcel = async () => {
        if (filteredVolunteerStats.length === 0) {
            toast.error(isRTL ? 'لا توجد بيانات لتصديرها' : 'No data to export');
            return;
        }

        const data = filteredVolunteerStats.map((item, index) => {
            const v = item.volunteer;
            const levelObj = getLevelText(v.level);
            const statusLabel = item.remaining === 0
                ? (isRTL ? 'مكتمل' : 'Completed')
                : item.approvedCount > 0
                    ? (isRTL ? 'متبقي مشاركات' : 'In Progress')
                    : (isRTL ? 'لم يشارك' : 'No Participations');

            return {
                '#': index + 1,
                [isRTL ? 'الاسم بالكامل' : 'Full Name']: isRTL ? (v.full_name_ar || v.full_name) : v.full_name,
                [isRTL ? 'الدرجة التطوعية' : 'Volunteer Grade']: isRTL ? levelObj.ar : levelObj.en,
                [isRTL ? 'اللجنة' : 'Committee']: v.committees ? (isRTL ? v.committees.name_ar : v.committees.name) : '-',
                [isRTL ? 'المشاركات المقبولة' : 'Approved Participations']: item.approvedCount,
                [isRTL ? 'المشاركات المعلقة' : 'Pending Participations']: item.pendingCount,
                [isRTL ? 'تارجت المشاركات' : 'Target Participations']: item.target,
                [isRTL ? 'ناقص كام مشاركة' : 'Deficit (Remaining)']: item.remaining,
                [isRTL ? 'الحالة' : 'Status']: statusLabel,
                [isRTL ? 'رقم الهاتف' : 'Phone Number']: v.phone || '-'
            };
        });

        try {
            const XLSX = await loadXlsx();
            const workbook = XLSX.utils.book_new();
            appendJsonSheet(XLSX.utils, workbook, data, isRTL ? 'تقرير الـ HR' : 'HR Report');
            XLSX.writeFile(workbook, ensureXlsxFilename(`HR_Dashboard_Report_${selectedMonth}.xlsx`));
            toast.success(isRTL ? 'تم تصدير ملف الاكسل بنجاح' : 'Excel file exported successfully');
        } catch (error) {
            console.error('Error exporting HR dashboard:', error);
            toast.error(isRTL ? 'فشل تصدير ملف الإكسل' : 'Failed to export the Excel file');
        }
    };

    // Open WhatsApp message dialog
    const handleSendReminder = (item: VolunteerStats) => {
        const v = item.volunteer;
        if (!v.phone) {
            toast.error(isRTL ? 'لا يوجد رقم هاتف مسجل لهذا المتطوع' : 'No phone number registered for this volunteer');
            return;
        }

        const name = isRTL ? (v.full_name_ar || v.full_name) : v.full_name;
        const levelText = isRTL ? getLevelText(v.level).ar : getLevelText(v.level).en;

        const message = isRTL
            ? `السلام عليكم يا ${name} 👋، حابين نشكرك على مشاركاتك المتميزة خلال شهر ${format(new Date(selectedMonth + '-02'), 'MMMM', { locale: ar })}. حابين نذكرك كدرجة (${levelText}) أن تارجتك هو ${item.target} مشاركات مقبولة. متبقي لك فقط ${item.remaining} مشاركات لتكمل تارجت الشهر. بالتوفيق دائماً! ✨`
            : `Hello ${name} 👋, we would like to thank you for your awesome participation during ${format(new Date(selectedMonth + '-02'), 'MMMM')}. We wanted to remind you as a (${levelText}) that your monthly target is ${item.target} approved participations. You currently need ${item.remaining} more participations to reach your target. Keep up the good work! ✨`;

        // Clean phone number (remove non-digits, replace leading 0 with country code if needed)
        let cleanedPhone = v.phone.replace(/\D/g, '');
        if (cleanedPhone.startsWith('01') && cleanedPhone.length === 11) {
            cleanedPhone = '2' + cleanedPhone;
        }

        const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    const handleViewDetails = (item: VolunteerStats) => {
        setSelectedVolunteerStats(item);
        setIsSheetOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isRTL ? 'داشبورد الـ HR والمتابعة' : 'HR & Follow-up Dashboard'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isRTL
                            ? 'متابعة تارجت مشاركات المتطوعين الشهرية وتحديد نسب العجز والتأخير'
                            : 'Track monthly volunteer participation targets, deficits, and completion rates'}
                    </p>
                </div>
                <Button onClick={handleExportExcel} variant="outline" className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {isRTL ? 'تصدير التقرير للاكسل' : 'Export Report to Excel'}
                </Button>
            </div>

            {/* KPI Summary Cards */}
            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(n => (
                        <Card key={n} className="animate-pulse">
                            <CardHeader className="h-12 bg-muted/30 rounded-t-lg" />
                            <CardContent className="h-20 bg-muted/10 rounded-b-lg" />
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Total Volunteers */}
                    <Card className="hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">
                                {isRTL ? 'إجمالي المتطوعين بالفرع' : 'Total Branch Volunteers'}
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpis.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {isRTL ? 'مسجلين ونشطين بالفرع الحالي' : 'Registered in the active branch'}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Target Completed */}
                    <Card className="hover:shadow-md transition-shadow border-emerald-500/20 dark:border-emerald-500/10">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">
                                {isRTL ? 'مكتملو التارجت' : 'Target Completed'}
                            </CardTitle>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {kpis.completed}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Progress value={kpis.completionRate} className="h-1.5 flex-1 bg-muted" />
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    {kpis.completionRate}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* In Progress */}
                    <Card className="hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">
                                {isRTL ? 'مستمرون بالمشاركة' : 'In Progress'}
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {kpis.inProgress}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {isRTL ? 'شاركوا ولكن لم يصلوا للتارجت بعد' : 'Logged participations but short of target'}
                            </p>
                        </CardContent>
                    </Card>

                    {/* No Participation */}
                    <Card className="hover:shadow-md transition-shadow border-rose-500/20 dark:border-rose-500/10">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">
                                {isRTL ? 'لم يشاركوا بعد' : 'No Participation'}
                            </CardTitle>
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                                {kpis.noParticipation}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {isRTL ? 'لم يتم تسجيل أي مشاركة مقبولة' : '0 approved submissions this month'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters Section */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{isRTL ? 'الفلاتر والبحث' : 'Search and Filters'}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Month Picker */}
                    <div className="space-y-2 flex flex-col justify-end">
                        <Label>{isRTL ? 'الشهر المستهدف' : 'Target Month'}</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start text-start font-normal h-10 bg-background border border-input"
                                >
                                    <Calendar className="ltr:mr-2 rtl:ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span>
                                        {format(new Date(selectedMonth + '-02'), "LLLL yyyy", { locale: isRTL ? ar : undefined })}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <MonthPicker
                                    className="w-72"
                                    selected={new Date(selectedMonth + '-02')}
                                    onSelect={(date) => {
                                        setSelectedMonth(format(date, 'yyyy-MM'));
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Search Field */}
                    <div className="space-y-2">
                        <Label htmlFor="search">{isRTL ? 'البحث بالاسم' : 'Search by Name'}</Label>
                        <div className="relative">
                            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground rtl:left-3 rtl:right-auto" />
                            <Input
                                id="search"
                                placeholder={isRTL ? 'أدخل اسم المتطوع...' : 'Enter volunteer name...'}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pr-10 rtl:pl-10 rtl:pr-4"
                            />
                        </div>
                    </div>

                    {/* Level Filter */}
                    <div className="space-y-2">
                        <Label>{isRTL ? 'الدرجة التطوعية' : 'Volunteer Grade'}</Label>
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{isRTL ? 'كل الدرجات' : 'All Grades'}</SelectItem>
                                <SelectItem value="under_follow_up">{isRTL ? 'تحت المتابعة (تارجت 4)' : 'Under Follow-up (Target 4)'}</SelectItem>
                                <SelectItem value="project_responsible">{isRTL ? 'مشروع مسؤول (تارجت 8)' : 'Project Responsible (Target 8)'}</SelectItem>
                                <SelectItem value="responsible">{isRTL ? 'مسؤول (تارجت 8)' : 'Responsible (Target 8)'}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                        <Label>{isRTL ? 'حالة إنجاز التارجت' : 'Target Status'}</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                                <SelectItem value="completed">{isRTL ? 'مكتمل التارجت' : 'Target Completed'}</SelectItem>
                                <SelectItem value="in_progress">{isRTL ? 'متبقي مشاركات (بدأ بالعمل)' : 'In Progress (Started)'}</SelectItem>
                                <SelectItem value="no_participation">{isRTL ? 'لم يشارك بعد' : 'No Participation'}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Volunteers Table Section */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <span className="text-muted-foreground text-sm">
                                {isRTL ? 'جاري تحميل سجلات المتطوعين...' : 'Loading volunteer records...'}
                            </span>
                        </div>
                    ) : filteredVolunteerStats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Users className="h-10 w-10 text-muted-foreground mb-3" />
                            <h3 className="font-semibold text-lg">{isRTL ? 'لا توجد نتائج' : 'No results found'}</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mt-1">
                                {isRTL
                                    ? 'لم نجد أي متطوع يطابق خيارات التصفية أو البحث الحالية.'
                                    : 'We couldn\'t find any volunteers matching your search/filters.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12 text-center">#</TableHead>
                                        <TableHead>{isRTL ? 'المتطوع' : 'Volunteer'}</TableHead>
                                        <TableHead>{isRTL ? 'اللجنة' : 'Committee'}</TableHead>
                                        <TableHead>{isRTL ? 'الدرجة' : 'Grade'}</TableHead>
                                        <TableHead className="text-center">{isRTL ? 'مقبول / التارجت' : 'Approved / Target'}</TableHead>
                                        <TableHead className="text-center">{isRTL ? 'العجز (ناقص كام)' : 'Deficit (Remaining)'}</TableHead>
                                        <TableHead className="w-48">{isRTL ? 'نسبة الإنجاز' : 'Progress'}</TableHead>
                                        <TableHead className="w-32 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredVolunteerStats.map((item, idx) => {
                                        const v = item.volunteer;
                                        const name = isRTL ? (v.full_name_ar || v.full_name) : v.full_name;
                                        const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'V';
                                        const levelObj = getLevelText(v.level);

                                        // Colors based on level
                                        const levelBadgeStyle = v.level === 'responsible'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            : v.level === 'project_responsible'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

                                        // Progress percentage
                                        const progressPercent = Math.min(100, Math.round((item.approvedCount / item.target) * 100));

                                        return (
                                            <TableRow key={v.id} className="hover:bg-muted/30">
                                                <TableCell className="text-center font-medium text-muted-foreground">{idx + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 shrink-0 border border-muted">
                                                            <AvatarImage src={v.avatar_url || undefined} alt={v.full_name} />
                                                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                                                {initials}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-sm leading-tight">{name}</span>
                                                            {v.phone && (
                                                                <span className="text-xs text-muted-foreground">{v.phone}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm font-medium text-muted-foreground">
                                                        {v.committees ? (isRTL ? v.committees.name_ar : v.committees.name) : '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`font-normal hover:bg-inherit shadow-none ${levelBadgeStyle}`} variant="secondary">
                                                        {isRTL ? levelObj.ar : levelObj.en}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-medium text-sm">
                                                    <span className={item.remaining === 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground"}>
                                                        {item.approvedCount}
                                                    </span>
                                                    <span className="text-muted-foreground/60 mx-1">/</span>
                                                    <span className="text-foreground">{item.target}</span>
                                                    {item.pendingCount > 0 && (
                                                        <span className="block text-[10px] text-amber-500 font-normal mt-0.5">
                                                            {isRTL ? `(+${item.pendingCount} معلق)` : `(+${item.pendingCount} pending)`}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {item.remaining === 0 ? (
                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-50 shadow-none">
                                                            {isRTL ? 'مكتمل ✅' : 'Completed ✅'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800 hover:bg-rose-50 shadow-none">
                                                            {isRTL ? `ناقص ${item.remaining}` : `Deficit: ${item.remaining}`}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Progress
                                                            value={progressPercent}
                                                            className="h-2 flex-1"
                                                            indicatorClassName={item.remaining === 0 ? "bg-emerald-500" : "bg-primary"}
                                                        />
                                                        <span className="text-xs font-semibold text-muted-foreground shrink-0 w-8 text-right">
                                                            {progressPercent}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-2">
                                                        {/* View detailed submissions */}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleViewDetails(item)}
                                                            title={isRTL ? 'تفاصيل المشاركات' : 'Participation details'}
                                                            className="h-8 w-8"
                                                        >
                                                            <Eye className="h-4 w-4 text-blue-500" />
                                                        </Button>

                                                        {/* WhatsApp Reminder (only if remaining > 0) */}
                                                        {item.remaining > 0 && v.phone && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleSendReminder(item)}
                                                                title={isRTL ? 'إرسال تذكير واتساب' : 'Send WhatsApp reminder'}
                                                                className="h-8 w-8"
                                                            >
                                                                <MessageCircle className="h-4 w-4 text-emerald-500" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Volunteer Monthly Submissions Drawer / Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="sm:max-w-2xl overflow-y-auto" side={isRTL ? "right" : "left"}>
                    {selectedVolunteerStats && (
                        <div className="space-y-6">
                            <SheetHeader className="pb-4 border-b">
                                <div className="flex items-center gap-3 mt-4">
                                    <Avatar className="h-12 w-12 border">
                                        <AvatarImage
                                            src={selectedVolunteerStats.volunteer.avatar_url || undefined}
                                            alt={selectedVolunteerStats.volunteer.full_name}
                                        />
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                            {selectedVolunteerStats.volunteer.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <SheetTitle className="text-xl">
                                            {isRTL
                                                ? (selectedVolunteerStats.volunteer.full_name_ar || selectedVolunteerStats.volunteer.full_name)
                                                : selectedVolunteerStats.volunteer.full_name}
                                        </SheetTitle>
                                        <SheetDescription className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline">
                                                {isRTL ? getLevelText(selectedVolunteerStats.volunteer.level).ar : getLevelText(selectedVolunteerStats.volunteer.level).en}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {selectedVolunteerStats.volunteer.phone || ''}
                                            </span>
                                        </SheetDescription>
                                    </div>
                                </div>
                            </SheetHeader>

                            {/* Summary info */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-muted/40 p-3 rounded-lg">
                                    <span className="text-xs text-muted-foreground block">{isRTL ? 'تارجت الشهر' : 'Month Target'}</span>
                                    <span className="text-lg font-bold">{selectedVolunteerStats.target}</span>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg">
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 block">{isRTL ? 'المقبولة' : 'Approved'}</span>
                                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                        {selectedVolunteerStats.approvedCount}
                                    </span>
                                </div>
                                <div className={selectedVolunteerStats.remaining === 0 ? "bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg" : "bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg"}>
                                    <span className={`text-xs block ${selectedVolunteerStats.remaining === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                        {isRTL ? 'متبقي (العجز)' : 'Deficit'}
                                    </span>
                                    <span className={`text-lg font-bold ${selectedVolunteerStats.remaining === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                        {selectedVolunteerStats.remaining === 0 ? '✓' : selectedVolunteerStats.remaining}
                                    </span>
                                </div>
                            </div>

                            {/* Submissions List */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-md border-b pb-2 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    {isRTL ? 'مشاركات الشهر' : 'Month Submissions'} ({selectedVolunteerStats.submissions.length})
                                </h3>

                                {selectedVolunteerStats.submissions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        {isRTL ? 'لم يسجل هذا العضو أي مشاركة في هذا الشهر.' : 'No submissions recorded for this member this month.'}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedVolunteerStats.submissions.map((sub) => {
                                            const subDate = new Date(sub.submitted_at);
                                            return (
                                                <Card key={sub.id} className="border shadow-none">
                                                    <CardContent className="p-3 space-y-2">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-semibold text-sm">
                                                                    {sub.activity_types ? (isRTL ? sub.activity_types.name_ar : sub.activity_types.name) : (isRTL ? 'مشاركة' : 'Submission')}
                                                                </h4>
                                                                <span className="text-[11px] text-muted-foreground block mt-0.5">
                                                                    {format(subDate, 'yyyy-MM-dd HH:mm')}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                {sub.status === 'approved' ? (
                                                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 hover:bg-emerald-50 shadow-none">
                                                                        {isRTL ? 'مقبول' : 'Approved'}
                                                                    </Badge>
                                                                ) : sub.status === 'rejected' ? (
                                                                    <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 hover:bg-rose-50 shadow-none">
                                                                        {isRTL ? 'مرفوض' : 'Rejected'}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 hover:bg-amber-50 shadow-none">
                                                                        {isRTL ? 'معلق' : 'Pending'}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {sub.description && (
                                                            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                                                {sub.description}
                                                            </p>
                                                        )}

                                                        <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                                                            <span>
                                                                {isRTL ? 'مكان المشاركة:' : 'Location:'}{' '}
                                                                <span className="font-medium text-foreground">
                                                                    {sub.location === 'branch'
                                                                        ? (isRTL ? 'الفرع' : 'Branch')
                                                                        : (isRTL ? 'من البيت' : 'Home/Remote')}
                                                                </span>
                                                            </span>
                                                            {sub.proof_url && (
                                                                <a
                                                                    href={sub.proof_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-500 hover:underline flex items-center gap-0.5 font-medium"
                                                                >
                                                                    {isRTL ? 'رابط الإثبات ↗' : 'Proof Link ↗'}
                                                                </a>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
