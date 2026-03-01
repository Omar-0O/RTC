import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { Search, FileSpreadsheet, Calendar, Award, Check, ChevronsUpDown, Trash2, AlertTriangle } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { cn } from "@/lib/utils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"

interface Profile {
    id: string;
    full_name: string;
    full_name_ar: string;
    level: string;
    avatar_url: string | null;
    phone?: string;
}

interface Submission {
    id: string;
    volunteer_id: string | null;
    activity_type_id: string;
    submitted_at: string;
    created_at: string;
    points_awarded: number;
    status: string;
    location?: string;
    wore_vest?: boolean;
    description?: string;
    proof_url?: string;
    participant_type?: 'volunteer' | 'guest' | 'trainer';
    guest_name?: string | null;
    guest_phone?: string | null;
    profiles: Profile | null;
    activity_types: {
        name: string;
        name_ar: string;
    };
    committees: {
        name: string;
        name_ar: string;
    };
}

interface VolunteerSummary {
    volunteer: Profile;
    submission_count: number;
    total_points: number;
    last_active: string | null;
    submissions: Submission[];
}

// Guest participation interface for head_hr
interface GuestParticipation {
    id: string;
    name: string;
    phone: string | null;
    source: 'event' | 'caravan' | 'call';
    source_name: string;
    date: string;
    type: 'guest' | 'trainer';
}

export default function SubmissionManagement() {
    const { user, primaryRole } = useAuth();
    const { t, language } = useLanguage();
    const isRTL = language === 'ar';
    const isHeadHR = primaryRole === 'head_hr';

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [guestParticipations, setGuestParticipations] = useState<GuestParticipation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [showLowParticipationDialog, setShowLowParticipationDialog] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);

    // Trainers Map
    const [trainersMap, setTrainersMap] = useState<Record<string, { ar: string, en: string, phone: string }>>({});

    // Volunteer Search
    const [volunteers, setVolunteers] = useState<Profile[]>([]);
    const [open, setOpen] = useState(false);
    const [selectedVolunteer, setSelectedVolunteer] = useState<string>("");
    const volunteerLevels = [
        { value: 'all', label: { ar: 'كل الدرجات', en: 'All Degrees' } },
        { value: 'under_follow_up', label: { ar: 'تحت المتابعة', en: 'Under Follow-up' } },
        { value: 'project_responsible', label: { ar: 'مسؤول مشروع', en: 'Project Responsible' } },
        { value: 'responsible', label: { ar: 'مسؤول', en: 'Responsible' } },
    ];

    useEffect(() => {
        fetchVolunteers();
        fetchTrainers();
    }, []);

    useEffect(() => {
        fetchSubmissions();
        if (isHeadHR) {
            fetchGuestParticipations();
        }
    }, [selectedMonth, selectedLevel, selectedType, selectedVolunteer, isHeadHR]);

    const fetchVolunteers = async () => {
        try {
            // Fetch admin IDs
            const { data: adminRoles } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'admin');

            const adminIds = adminRoles?.map(r => r.user_id) || [];

            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, full_name_ar, level, avatar_url, phone')
                .order('full_name', { ascending: true });

            if (error) throw error;

            // Filter out admins
            const filteredVolunteers = data.filter(v =>
                !adminIds.includes(v.id)
            );
            setVolunteers(filteredVolunteers as unknown as Profile[]);
        } catch (error) {
            console.error('Error fetching volunteers:', error);
        }
    };

    const fetchTrainers = async () => {
        try {
            const { data, error } = await supabase
                .from('trainers')
                .select('user_id, name_ar, name_en, phone');

            if (error) throw error;
            console.log('Fetched trainers map data:', data);

            const map: Record<string, { ar: string, en: string, phone: string }> = {};
            data.forEach((t: any) => {
                if (t.user_id) {
                    map[t.user_id] = { ar: t.name_ar, en: t.name_en, phone: t.phone };
                }
            });
            setTrainersMap(map);
        } catch (error) {
            console.error('Error fetching trainers:', error);
        }
    };

    const fetchSubmissions = async () => {
        setIsLoading(true);
        try {
            const [year, month] = selectedMonth.split('-');
            const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const startDate = startOfMonth(monthDate);
            const endDate = endOfMonth(monthDate);

            let query = supabase
                .from('activity_submissions')
                .select(`
                    id,
                    volunteer_id,
                    activity_type_id,
                    submitted_at,
                    created_at,
                    points_awarded,
                    status,
                    location,
                    wore_vest,
                    description,
                    proof_url,
                    participant_type,
                    guest_name,
                    guest_phone,
                    profiles:profiles!activity_submissions_volunteer_id_fkey (id, full_name, full_name_ar, level, avatar_url, phone),
                    activity_types (name, name_ar),
                    committees (name, name_ar)
                `)
                .gte('submitted_at', startDate.toISOString())
                .lte('submitted_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            // Apply Level Filter - Note: filtering on joined table fields in Supabase 
            // doesn't work with .eq(), so we filter client-side below

            // Apply Volunteer Filter
            if (selectedVolunteer) {
                query = query.eq('volunteer_id', selectedVolunteer);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Fetch admin IDs to filter them out
            const { data: adminRoles } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'admin');

            const adminIds = adminRoles?.map(r => r.user_id) || [];

            console.log('Fetched submissions:', data);

            const submissionsData = data as unknown as Submission[];

            console.log('Fetched submissions (raw - before filter):', data?.length);

            const filteredSubmissions = submissionsData.filter(s => {
                // Skip admin check for guests (volunteer_id is null)
                if (s.volunteer_id) {
                    const isAdmin = adminIds.includes(s.volunteer_id);
                    if (isAdmin) return false;
                }

                // Apply level filter client-side (skip for guests)
                if (selectedLevel !== 'all') {
                    // Guests don't have a level, so exclude them from level filtering
                    if (!s.profiles) return false;

                    const volunteerLevel = s.profiles?.level;
                    // Handle level aliases (bronze/silver -> under_follow_up, gold -> project_responsible, platinum/diamond -> responsible)
                    if (selectedLevel === 'under_follow_up') {
                        return ['under_follow_up', 'bronze', 'silver', 'newbie', 'active'].includes(volunteerLevel);
                    } else if (selectedLevel === 'project_responsible') {
                        return ['project_responsible', 'gold'].includes(volunteerLevel);
                    } else if (selectedLevel === 'responsible') {
                        return ['responsible', 'platinum', 'diamond'].includes(volunteerLevel);
                    }
                    return volunteerLevel === selectedLevel;
                }

                // Apply Participant Type Filter
                if (selectedType !== 'all') {
                    const type = s.participant_type || (s.volunteer_id ? 'volunteer' : 'guest');
                    if (selectedType !== type) return false;
                }

                return true;
            });

            console.log('Filtered submissions (final):', filteredSubmissions.length);

            setSubmissions(filteredSubmissions);

        } catch (error) {
            console.error('Error fetching submissions:', error);
            toast.error(isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch guest and trainer participations from events, caravans, and calls (for head_hr only)
    const fetchGuestParticipations = async () => {
        if (!isHeadHR) return;

        try {
            const [year, month] = selectedMonth.split('-');
            const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const startDate = startOfMonth(monthDate);
            const endDate = endOfMonth(monthDate);

            const guestData: GuestParticipation[] = [];

            // Fetch event participants (guests)
            const { data: eventParticipants } = await supabase
                .from('event_participants')
                .select(`
                    id,
                    name,
                    phone,
                    is_volunteer,
                    events (name, date)
                `)
                .eq('is_volunteer', false)
                .gte('events.date', startDate.toISOString().split('T')[0])
                .lte('events.date', endDate.toISOString().split('T')[0]);

            if (eventParticipants) {
                eventParticipants.forEach((p: any) => {
                    if (p.events) {
                        guestData.push({
                            id: p.id,
                            name: p.name || '',
                            phone: p.phone,
                            source: 'event',
                            source_name: p.events.name || '',
                            date: p.events.date || '',
                            type: 'guest'
                        });
                    }
                });
            }

            // Fetch caravan participants (guests)
            const { data: caravanParticipants } = await supabase
                .from('caravan_participants')
                .select(`
                    id,
                    name,
                    phone,
                    is_volunteer,
                    caravans (name, date)
                `)
                .eq('is_volunteer', false)
                .gte('caravans.date', startDate.toISOString().split('T')[0])
                .lte('caravans.date', endDate.toISOString().split('T')[0]);

            if (caravanParticipants) {
                caravanParticipants.forEach((p: any) => {
                    if (p.caravans) {
                        guestData.push({
                            id: p.id,
                            name: p.name || '',
                            phone: p.phone,
                            source: 'caravan',
                            source_name: p.caravans.name || '',
                            date: p.caravans.date || '',
                            type: 'guest'
                        });
                    }
                });
            }

            // Fetch call participants (guests)
            const { data: callParticipants } = await supabase
                .from('call_participants' as any)
                .select(`
                    id,
                    name,
                    phone,
                    is_volunteer,
                    calls (name, date)
                `)
                .eq('is_volunteer', false)
                .gte('calls.date', startDate.toISOString().split('T')[0])
                .lte('calls.date', endDate.toISOString().split('T')[0]);

            if (callParticipants) {
                callParticipants.forEach((p: any) => {
                    if (p.calls) {
                        guestData.push({
                            id: p.id,
                            name: p.name || '',
                            phone: p.phone,
                            source: 'call',
                            source_name: p.calls.name || '',
                            date: p.calls.date || '',
                            type: 'guest'
                        });
                    }
                });
            }

            setGuestParticipations(guestData);
        } catch (error) {
            console.error('Error fetching guest participations:', error);
        }
    };

    const exportReport = () => {
        // Volunteer participation data
        const volunteerData = submissions.map(s => {
            const volunteer = s.profiles;
            const activityType = s.activity_types;
            const committee = s.committees;

            // Determine participant type
            const isGuest = !s.profiles || s.participant_type === 'guest';
            const isTrainer = s.participant_type === 'trainer' || s.committees?.name === 'Trainer';

            let typeLabel = isRTL ? 'متطوع' : 'Volunteer';
            if (isTrainer) typeLabel = isRTL ? 'مدرب' : 'Trainer';
            else if (isGuest) typeLabel = isRTL ? 'ضيف' : 'Guest';

            // Resolve Name
            let name = volunteer?.full_name || '';
            if (isGuest) {
                name = s.guest_name || (isRTL ? 'ضيف' : 'Guest');
            } else if (isTrainer) {
                if (s.volunteer_id && trainersMap[s.volunteer_id]) {
                    name = isRTL ? trainersMap[s.volunteer_id].ar : trainersMap[s.volunteer_id].en;
                } else if (volunteer?.full_name) {
                    name = isRTL ? volunteer.full_name_ar || volunteer.full_name : volunteer.full_name;
                } else {
                    name = isRTL ? 'مدرب' : 'Trainer';
                }
            } else {
                name = (isRTL && volunteer?.full_name_ar) ? volunteer.full_name_ar : (volunteer?.full_name || '');
            }

            // Resolve Phone
            let phone = isGuest ? s.guest_phone : volunteer?.phone;
            if (isTrainer && s.volunteer_id && trainersMap[s.volunteer_id]?.phone) {
                phone = trainersMap[s.volunteer_id].phone;
            }

            let locationStr = s.location || 'branch';
            if (locationStr === 'home' || locationStr === 'remote') locationStr = isRTL ? 'من البيت' : 'Home';
            else if (locationStr === 'branch') locationStr = isRTL ? 'الفرع' : 'Branch';

            // Vest status for branch activities
            const vestStatus = s.location === 'branch'
                ? (s.wore_vest ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No'))
                : '';

            return {
                [isRTL ? 'النوع' : 'Type']: typeLabel,
                [isRTL ? 'نوع المهمة' : 'Task Type']: activityType?.[isRTL ? 'name_ar' : 'name'] || '',
                [isRTL ? 'اللجنة/المصدر' : 'Committee/Source']: committee?.[isRTL ? 'name_ar' : 'name'] || '',
                [isRTL ? 'الاسم' : 'Name']: name,
                [isRTL ? 'رقم الهاتف' : 'Phone']: `'${phone || ''}'`,
                [isRTL ? 'نوع المشاركة' : 'Participation Type']: locationStr,
                [isRTL ? 'ارتدى الـ Vest' : 'Wore Vest']: vestStatus,
                [isRTL ? 'الأثر' : 'Impact']: s.points_awarded || 0,
                [isRTL ? 'تاريخ المشاركة' : 'Date']: format(new Date(s.submitted_at), 'yyyy-MM-dd'),
                [isRTL ? 'الملاحظات' : 'Notes']: s.description || '',
                [isRTL ? 'رابط الإثبات' : 'Proof Link']: s.proof_url || '',
            };
        });

        // Guest participation data (only for head_hr)
        const guestData = isHeadHR ? guestParticipations.map(g => {
            const sourceLabel = g.source === 'event'
                ? (isRTL ? 'نزولة' : 'Event')
                : g.source === 'caravan'
                    ? (isRTL ? 'قافلة' : 'Caravan')
                    : (isRTL ? 'زيارة' : 'Call');

            return {
                [isRTL ? 'النوع' : 'Type']: isRTL ? 'ضيف' : 'Guest',
                [isRTL ? 'نوع المهمة' : 'Task Type']: sourceLabel,
                [isRTL ? 'اللجنة/المصدر' : 'Committee/Source']: g.source_name,
                [isRTL ? 'الاسم' : 'Name']: g.name,
                [isRTL ? 'رقم الهاتف' : 'Phone']: `'${g.phone || ''}'`,
                [isRTL ? 'نوع المشاركة' : 'Participation Type']: sourceLabel,
                [isRTL ? 'ارتدى الـ Vest' : 'Wore Vest']: '',
                [isRTL ? 'الأثر' : 'Impact']: 0,
                [isRTL ? 'تاريخ المشاركة' : 'Date']: g.date,
                [isRTL ? 'الملاحظات' : 'Notes']: '',
                [isRTL ? 'رابط الإثبات' : 'Proof Link']: '',
            };
        }) : [];

        const reportData = [...volunteerData, ...guestData];

        if (reportData.length === 0) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }

        const headers = Object.keys(reportData[0]);
        const csvContent = [
            headers.join(','),
            ...reportData.map(row => headers.map(header => {
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
        link.download = `participation_log_${selectedMonth}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        toast.success(isRTL ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
    };

    const getLevelLabel = (levelValue: string) => {
        if (levelValue === 'bronze') return isRTL ? 'تحت المتابعة' : 'Under Follow-up';
        const level = volunteerLevels.find(l => l.value === levelValue);
        return level ? level.label[isRTL ? 'ar' : 'en'] : levelValue;
    }

    const handleDelete = async (id: string) => {
        setSubmissionToDelete(id);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!submissionToDelete) return;

        try {
            const { data, error } = await supabase
                .from('activity_submissions')
                .delete()
                .eq('id', submissionToDelete)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                throw new Error('NOT_FOUND_OR_FORBIDDEN');
            }

            toast.success(isRTL ? 'تم حذف المشاركة بنجاح' : 'Submission deleted successfully');

            // Re-fetch submissions to get fresh data including any database-level updates
            await fetchSubmissions();
        } catch (error) {
            if (error instanceof Error && error.message === 'NOT_FOUND_OR_FORBIDDEN') {
                toast.error(isRTL
                    ? 'تعذر حذف المشاركة. قد لا تملك الصلاحية أو تم حذفها بالفعل.'
                    : 'Could not delete. You might lack permissions or it was already deleted.'
                );
            } else {
                console.error('Error deleting submission:', error);
                toast.error(isRTL ? 'فشل في حذف المشاركة' : 'Failed to delete submission');
            }
        } finally {
            setDeleteDialogOpen(false);
            setSubmissionToDelete(null);
        }
    };

    // Aggregate Data
    const volunteerSummaries: VolunteerSummary[] = useMemo(() => {
        const summaryMap = new Map<string, VolunteerSummary>();

        // Initialize with all volunteers
        volunteers.forEach(volunteer => {
            summaryMap.set(volunteer.id, {
                volunteer,
                submission_count: 0,
                total_points: 0,
                last_active: null,
                submissions: []
            });
        });

        // Add submission data
        submissions.forEach(submission => {
            const volunteerId = submission.volunteer_id;

            // If volunteer not found (e.g. might be filtered out?), skip or add?
            // Since we fetch submissions based on filters, and volunteers based on filters, 
            // there shouldn't be a mismatch unless race condition or complex filter overlap.
            // But 'volunteers' state might not have the user if 'fetchVolunteers' filtered them out?
            // fetchVolunteers filters out admins.
            // fetchSubmissions also filters out admins.
            // So they should be consistent.

            if (summaryMap.has(volunteerId)) {
                const summary = summaryMap.get(volunteerId)!;
                summary.submission_count += 1;
                summary.total_points += (submission.points_awarded || 0);
                summary.submissions.push(submission);

                if (!summary.last_active || new Date(submission.submitted_at) > new Date(summary.last_active)) {
                    summary.last_active = submission.submitted_at;
                }
            }
        });

        return Array.from(summaryMap.values())
            .sort((a, b) => b.submission_count - a.submission_count);
    }, [submissions, volunteers]);

    // Volunteers with low participation (< 4 submissions)
    const lowParticipationVolunteers = useMemo(() => {
        return volunteerSummaries.filter(summary => summary.submission_count < 4);
    }, [volunteerSummaries]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">{isRTL ? 'سجل المشاركات' : 'Submissions Log'}</h1>
                    <p className="text-muted-foreground">{isRTL ? 'عرض جميع المشاركات التطوعية' : 'View all volunteer submissions'}</p>
                </div>
                <Button variant="outline" onClick={exportReport}>
                    <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {isRTL ? 'تصدير السجل' : 'Export Log'}
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>{isRTL ? 'الفلاتر' : 'Filters'}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <Label>{isRTL ? 'الشهر' : 'Month'}</Label>
                        <Input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{isRTL ? 'الدرجة التطوعية' : 'Volunteer Degree'}</Label>
                        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {volunteerLevels.map(level => (
                                    <SelectItem key={level.value} value={level.value}>
                                        {level.label[language as 'en' | 'ar']}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>{isRTL ? 'نوع المشاركة' : 'Participant Type'}</Label>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                                <SelectItem value="volunteer">{isRTL ? 'متطوع' : 'Volunteer'}</SelectItem>
                                <SelectItem value="trainer">{isRTL ? 'مدرب' : 'Trainer'}</SelectItem>
                                <SelectItem value="guest">{isRTL ? 'ضيف' : 'Guest'}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>{isRTL ? 'بحث بالاسم' : 'Search by Name'}</Label>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between"
                                >
                                    {selectedVolunteer
                                        ? (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={volunteers.find((v) => v.id === selectedVolunteer)?.avatar_url || undefined} />
                                                    <AvatarFallback className="text-[10px]">
                                                        {(volunteers.find((v) => v.id === selectedVolunteer)?.full_name?.substring(0, 2) || "U")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span>
                                                    {isRTL
                                                        ? (volunteers.find((v) => v.id === selectedVolunteer)?.full_name_ar || volunteers.find((v) => v.id === selectedVolunteer)?.full_name || "")
                                                        : (volunteers.find((v) => v.id === selectedVolunteer)?.full_name || "")}
                                                </span>
                                            </div>
                                        )
                                        : (isRTL ? "اختر متطوع..." : "Select volunteer...")}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder={isRTL ? "ابحث عن متطوع..." : "Search volunteer..."} />
                                    <CommandList>
                                        <CommandEmpty>{isRTL ? "لا يوجد متطوع." : "No volunteer found."}</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="all_volunteers_clear_selection"
                                                onSelect={() => {
                                                    setSelectedVolunteer("");
                                                    setOpen(false);
                                                }}
                                                className="cursor-pointer font-medium text-primary"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedVolunteer === "" ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {isRTL ? "الكل" : "All"}
                                            </CommandItem>
                                            {volunteers.map((volunteer) => (
                                                <CommandItem
                                                    key={volunteer.id}
                                                    value={(isRTL ? volunteer.full_name_ar : volunteer.full_name) || "unknown"}
                                                    onSelect={() => {
                                                        setSelectedVolunteer(volunteer.id === selectedVolunteer ? "" : volunteer.id);
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedVolunteer === volunteer.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <Avatar className="h-6 w-6 mr-2 ml-2">
                                                        <AvatarImage src={volunteer.avatar_url || undefined} />
                                                        <AvatarFallback className="text-[10px]">
                                                            {(volunteer.full_name?.substring(0, 2) || "U")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {isRTL ? (volunteer.full_name_ar || volunteer.full_name) : volunteer.full_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <Label>{isRTL ? 'المشاركات المنخفضة' : 'Low Participation'}</Label>
                        <Dialog open={showLowParticipationDialog} onOpenChange={setShowLowParticipationDialog}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full h-10 justify-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                    {isRTL ? `عرض (${lowParticipationVolunteers.length}) متطوع` : `View (${lowParticipationVolunteers.length}) Volunteers`}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>{isRTL ? 'المتطوعين ذوي المشاركات المنخفضة' : 'Low Participation Volunteers'}</DialogTitle>
                                    <DialogDescription>
                                        {isRTL ? 'المتطوعين الذين لديهم أقل من 4 مشاركات هذا الشهر' : 'Volunteers with less than 4 submissions this month'}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-auto flex-1">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{isRTL ? 'المتطوع' : 'Volunteer'}</TableHead>
                                                <TableHead>{isRTL ? 'الدرجة' : 'Level'}</TableHead>
                                                <TableHead className="text-center">{isRTL ? 'عدد المشاركات' : 'Submissions'}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {lowParticipationVolunteers.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                                        {isRTL ? 'لا يوجد متطوعين بمشاركات منخفضة 🎉' : 'No volunteers with low participation 🎉'}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                lowParticipationVolunteers.map((summary) => (
                                                    <TableRow key={summary.volunteer.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarImage src={summary.volunteer.avatar_url || undefined} />
                                                                    <AvatarFallback className="text-xs">
                                                                        {summary.volunteer.full_name?.substring(0, 2) || 'U'}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className="font-medium">
                                                                    {isRTL ? summary.volunteer.full_name_ar : summary.volunteer.full_name}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-xs">
                                                                {getLevelLabel(summary.volunteer.level)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant={summary.submission_count === 0 ? 'destructive' : 'secondary'}>
                                                                {summary.submission_count}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            {/* Submissions List */}
            <div className="space-y-4">
                {submissions.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Award className="h-12 w-12 mb-4 opacity-20" />
                            <p>{isRTL ? 'لا توجد مشاركات' : 'No submissions found'}</p>
                        </CardContent>
                    </Card>
                ) : (
                    submissions.map((submission) => {
                        // Determine if this is a guest submission
                        const isGuest = !submission.profiles || submission.participant_type === 'guest';
                        // Determine if this is a trainer submission (by type or committee)
                        const isTrainer = submission.participant_type === 'trainer' || submission.committees?.name === 'Trainer';

                        let displayName = isGuest
                            ? submission.guest_name
                            : (isRTL ? submission.profiles?.full_name_ar : submission.profiles?.full_name);

                        // If it's a trainer, try to get the trainer name
                        if (isTrainer) {
                            if (submission.volunteer_id && trainersMap[submission.volunteer_id]) {
                                displayName = isRTL
                                    ? trainersMap[submission.volunteer_id].ar
                                    : trainersMap[submission.volunteer_id].en;
                            } else if (!displayName && submission.profiles) {
                                // If map lookup failed but we have a profile, use profile name
                                displayName = isRTL ? submission.profiles.full_name_ar : submission.profiles.full_name;
                            } else if (!displayName) {
                                // Final fallback if we know it's a trainer but have no name
                                displayName = isRTL ? 'مدرب' : 'Trainer';
                            }
                        }

                        let displayPhone = isGuest ? submission.guest_phone : submission.profiles?.phone;
                        if (isTrainer && submission.volunteer_id && trainersMap[submission.volunteer_id]?.phone) {
                            displayPhone = trainersMap[submission.volunteer_id].phone;
                        }

                        return (
                            <Card key={submission.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-primary/10">
                                            {!isGuest && submission.profiles?.avatar_url ? (
                                                <AvatarImage src={submission.profiles.avatar_url} />
                                            ) : null}
                                            <AvatarFallback className="text-lg">
                                                {isGuest ? '👤' : (submission.profiles?.full_name?.substring(0, 2) || "U")}
                                            </AvatarFallback>
                                        </Avatar>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 grid gap-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <h3 className="font-semibold text-base sm:text-lg truncate">
                                                        {displayName || (isRTL ? 'ضيف' : 'Guest')}
                                                    </h3>
                                                    {isTrainer ? (
                                                        <Badge variant="outline" className="text-xs sm:text-xs shrink-0 text-indigo-600 border-indigo-200 bg-indigo-50">
                                                            {isRTL ? 'مدرب' : 'Trainer'}
                                                        </Badge>
                                                    ) : isGuest ? (
                                                        <Badge variant="outline" className="text-xs sm:text-xs shrink-0 text-emerald-600 border-emerald-200 bg-emerald-50">
                                                            {isRTL ? 'ضيف' : 'Guest'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className={cn(
                                                            "text-xs sm:text-xs shrink-0",
                                                            (submission.profiles?.level === 'under_follow_up' || submission.profiles?.level === 'bronze') && 'text-orange-500 border-orange-200 bg-orange-50',
                                                            submission.profiles?.level === 'responsible' && 'text-blue-500 border-blue-200 bg-blue-50',
                                                            submission.profiles?.level === 'project_responsible' && 'text-purple-500 border-purple-200 bg-purple-50',
                                                            submission.profiles?.level === 'silver' && 'text-slate-500 border-slate-200 bg-slate-50',
                                                            submission.profiles?.level === 'gold' && 'text-yellow-600 border-yellow-200 bg-yellow-50',
                                                            submission.profiles?.level === 'platinum' && 'text-cyan-600 border-cyan-200 bg-cyan-50'
                                                        )}>
                                                            {getLevelLabel(submission.profiles?.level || '')}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(submission.submitted_at), 'PPP')}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(submission.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-foreground/80">
                                                <span className="font-medium">
                                                    {isRTL ? submission.activity_types?.name_ar : submission.activity_types?.name}
                                                </span>
                                                <span className="text-muted-foreground">•</span>
                                                <span className="text-muted-foreground">
                                                    {isRTL ? submission.committees?.name_ar : submission.committees?.name}
                                                </span>
                                                {displayPhone && (
                                                    <>
                                                        <span className="text-muted-foreground">•</span>
                                                        <span className="text-muted-foreground text-xs">{displayPhone}</span>
                                                    </>
                                                )}
                                            </div>

                                            {/* Description (Course/Lecture Info) */}
                                            {submission.description && (
                                                <div className="text-sm text-muted-foreground mt-1 break-words">
                                                    {submission.description}
                                                </div>
                                            )}

                                            {/* Proof Image */}
                                            {submission.proof_url && (
                                                <div className="mt-2">
                                                    <a href={submission.proof_url} target="_blank" rel="noopener noreferrer" className="block w-fit">
                                                        <img
                                                            src={submission.proof_url}
                                                            alt={isRTL ? 'إثبات المشاركة' : 'Submission Proof'}
                                                            className="h-24 w-auto object-cover rounded-md border hover:opacity-90 transition-opacity"
                                                        />
                                                    </a>
                                                </div>
                                            )}

                                            {/* Status & Points */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant={submission.status === 'approved' ? 'default' : 'secondary'} className="h-6">
                                                    {submission.points_awarded} {isRTL ? 'أثر' : 'Impact'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Deletion'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? 'هل أنت متأكد من حذف هذه المشاركة؟ لا يمكن التراجع عن هذا الإجراء.'
                                : 'Are you sure you want to delete this submission? This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isRTL ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
