import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import { ProofImagePreview } from '@/components/ProofImagePreview';
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
import { Search, FileSpreadsheet, Calendar, Award, Check, ChevronsUpDown, Trash2, AlertTriangle, Building2, Activity, Copy, MessageCircle, User } from 'lucide-react';
import { waPhoneLink } from '@/utils/phoneUtils';
import { sanitizeSpreadsheetRows } from '@/utils/spreadsheetSecurity';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MonthPicker } from '@/components/ui/calendar';
import { cn } from "@/lib/utils";
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
import { VolunteerProfilePreview } from '@/components/volunteer/VolunteerProfilePreview';

interface Profile {
    id: string;
    full_name: string | null;
    full_name_ar: string | null;
    level: string;
    avatar_url: string | null;
    phone: string | null;
}

type TrainerSummary = {
    ar: string;
    en: string;
    phone: string | null;
    image_url: string | null;
};

type TrainerRow = {
    id: string | null;
    name_ar: string | null;
    name_en: string | null;
    phone: string | null;
    image_url: string | null;
};

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
    trainer_id?: string | null;
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

type SourceRelation = {
    name: string | null;
    date: string | null;
    branch_id?: string | null;
};

type GuestParticipantRow<TSource extends string> = {
    id: string;
    name: string | null;
    phone: string | null;
} & Record<TSource, SourceRelation | SourceRelation[] | null>;

const getSourceRelation = <TSource extends string>(
    row: GuestParticipantRow<TSource>,
    sourceKey: TSource,
) => {
    const source = row[sourceKey];
    return Array.isArray(source) ? source[0] : source;
};

const escapeCsvCell = (value: string | number | boolean | null | undefined) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function SubmissionManagement() {
    const { user, primaryRole } = useAuth();
    const { t, language } = useLanguage();
    const { activeBranch } = useBranch();
    const isRTL = language === 'ar';
    const isHeadHR = primaryRole === 'head_hr';

    const [searchParams] = useSearchParams();
    const queryMonth = searchParams.get('month');
    const queryLevel = searchParams.get('level');

    const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [guestParticipations, setGuestParticipations] = useState<GuestParticipation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState(queryMonth || format(new Date(), 'yyyy-MM'));
    const [selectedLevel, setSelectedLevel] = useState(queryLevel || 'all');
    const [selectedType, setSelectedType] = useState('all');

    useEffect(() => {
        if (queryMonth) setSelectedMonth(queryMonth);
        if (queryLevel) setSelectedLevel(queryLevel);
    }, [queryMonth, queryLevel]);
    const [showLowParticipationDialog, setShowLowParticipationDialog] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);
    const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);

    // Trainers Map
    const [trainersMap, setTrainersMap] = useState<Record<string, TrainerSummary>>({});

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBranch?.id]);

    useEffect(() => {
        fetchSubmissions();
        if (isHeadHR) {
            fetchGuestParticipations();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedLevel, selectedType, selectedVolunteer, isHeadHR, activeBranch?.id]);

    const fetchVolunteers = async () => {
        try {
            // Fetch admin IDs
            const { data: adminRoles } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'admin');

            const adminIds = adminRoles?.map(r => r.user_id) || [];

            const profilesQuery = supabase
                .from('profiles')
                .select('id, full_name, full_name_ar, level, avatar_url, phone');

            const { data, error } = await (
                activeBranch?.id
                    ? profilesQuery.eq('branch_id', activeBranch.id)
                    : profilesQuery
            ).order('full_name', { ascending: true });

            if (error) throw error;

            // Filter out admins
            const filteredVolunteers = (data ?? []).filter((v) =>
                !adminIds.includes(v.id)
            );
            setVolunteers(filteredVolunteers);
        } catch (error) {
            console.error('Error fetching volunteers:', error);
        }
    };

    const fetchTrainers = async () => {
        try {
            const trainersQuery = supabase
                .from('trainers')
                .select('id, user_id, name_ar, name_en, phone, image_url');

            const { data, error } = await (
                activeBranch?.id
                    ? trainersQuery.eq('branch_id', activeBranch.id)
                    : trainersQuery
            );

            if (error) throw error;

            const map: Record<string, TrainerSummary> = {};
            (data as TrainerRow[] | null)?.forEach((t) => {
                if (t.id) {
                    map[t.id] = {
                        ar: t.name_ar || '',
                        en: t.name_en || '',
                        phone: t.phone,
                        image_url: t.image_url,
                    };
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

            const query = supabase
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
                    trainer_id,
                    profiles:profiles!activity_submissions_volunteer_id_fkey (id, full_name, full_name_ar, level, avatar_url, phone),
                    activity_types (name, name_ar),
                    committees (name, name_ar)
                `)
                .gte('submitted_at', startDate.toISOString())
                .lte('submitted_at', endDate.toISOString());

            // Fetch all submissions for the month
            const { data, error } = await (
                activeBranch?.id
                    ? query.eq('branch_id', activeBranch.id)
                    : query
            ).order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch admin IDs to filter them out
            const { data: adminRoles } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'admin');

            const adminIds = adminRoles?.map(r => r.user_id) || [];

            const submissionsData = (data ?? []) as Submission[];

            // Base valid submissions (exclude admins)
            const baseSubmissions = submissionsData.filter(s => {
                if (s.volunteer_id) {
                    const isAdmin = adminIds.includes(s.volunteer_id);
                    if (isAdmin) return false;
                }
                return true;
            });
            
            setAllSubmissions(baseSubmissions);

            // Filter for the list view
            const filteredSubmissions = baseSubmissions.filter(s => {
                // Apply Volunteer Filter
                if (selectedVolunteer && s.volunteer_id !== selectedVolunteer) {
                    return false;
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
            const eventQuery = supabase
                .from('event_participants')
                .select(`
                    id,
                    name,
                    phone,
                    is_volunteer,
                    events!inner (name, date, branch_id)
                `)
                .eq('is_volunteer', false)
                .gte('events.date', startDate.toISOString().split('T')[0])
                .lte('events.date', endDate.toISOString().split('T')[0]);

            const { data: eventParticipants } = await (
                activeBranch?.id
                    ? eventQuery.eq('events.branch_id', activeBranch.id)
                    : eventQuery
            );

            if (eventParticipants) {
                (eventParticipants as GuestParticipantRow<'events'>[]).forEach((p) => {
                    const event = getSourceRelation(p, 'events');
                    if (event) {
                        guestData.push({
                            id: p.id,
                            name: p.name || '',
                            phone: p.phone,
                            source: 'event',
                            source_name: event.name || '',
                            date: event.date || '',
                            type: 'guest'
                        });
                    }
                });
            }

            // Fetch caravan participants (guests)
            const caravanQuery = supabase
                .from('caravan_participants')
                .select(`
                    id,
                    name,
                    phone,
                    is_volunteer,
                    caravans!inner (name, date, branch_id)
                `)
                .eq('is_volunteer', false)
                .gte('caravans.date', startDate.toISOString().split('T')[0])
                .lte('caravans.date', endDate.toISOString().split('T')[0]);

            const { data: caravanParticipants } = await (
                activeBranch?.id
                    ? caravanQuery.eq('caravans.branch_id', activeBranch.id)
                    : caravanQuery
            );

            if (caravanParticipants) {
                (caravanParticipants as GuestParticipantRow<'caravans'>[]).forEach((p) => {
                    const caravan = getSourceRelation(p, 'caravans');
                    if (caravan) {
                        guestData.push({
                            id: p.id,
                            name: p.name || '',
                            phone: p.phone,
                            source: 'caravan',
                            source_name: caravan.name || '',
                            date: caravan.date || '',
                            type: 'guest'
                        });
                    }
                });
            }

            if (!activeBranch?.id) {
                const { data: callParticipants } = await supabase
                    .from('ethics_calls_participants')
                    .select(`
                        id,
                        name,
                        phone,
                        is_volunteer,
                        ethics_calls!inner (name, date)
                    `)
                    .eq('is_volunteer', false)
                    .gte('ethics_calls.date', startDate.toISOString().split('T')[0])
                    .lte('ethics_calls.date', endDate.toISOString().split('T')[0]);

                if (callParticipants) {
                    (callParticipants as GuestParticipantRow<'ethics_calls'>[]).forEach((p) => {
                        const ethicsCall = getSourceRelation(p, 'ethics_calls');
                        if (ethicsCall) {
                            guestData.push({
                                id: p.id,
                                name: p.name || '',
                                phone: p.phone,
                                source: 'call',
                                source_name: ethicsCall.name || '',
                                date: ethicsCall.date || '',
                                type: 'guest'
                            });
                        }
                    });
                }
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

        const safeReportData = sanitizeSpreadsheetRows(reportData);
        const headers = Object.keys(safeReportData[0]);
        const csvContent = [
            headers.join(','),
            ...safeReportData.map(row => headers.map(header => escapeCsvCell(row[header])).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = `participation_log_${selectedMonth}.csv`;
        link.click();
        URL.revokeObjectURL(objectUrl);

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
        allSubmissions.forEach(submission => {
            const volunteerId = submission.volunteer_id;

            if (volunteerId && summaryMap.has(volunteerId)) {
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
    }, [allSubmissions, volunteers]);

    // Volunteers with low participation (< 4 submissions)
    const lowParticipationVolunteers = useMemo(() => {
        return volunteerSummaries.filter(summary => {
            // Respect active filters
            if (selectedLevel !== 'all') {
                const volunteerLevel = summary.volunteer.level;
                if (selectedLevel === 'under_follow_up') {
                    if (!['under_follow_up', 'bronze', 'silver', 'newbie', 'active'].includes(volunteerLevel)) return false;
                } else if (selectedLevel === 'project_responsible') {
                    if (!['project_responsible', 'gold'].includes(volunteerLevel)) return false;
                } else if (selectedLevel === 'responsible') {
                    if (!['responsible', 'platinum', 'diamond'].includes(volunteerLevel)) return false;
                } else {
                    if (volunteerLevel !== selectedLevel) return false;
                }
            }
            
            if (selectedVolunteer && summary.volunteer.id !== selectedVolunteer) {
                return false;
            }

            return summary.submission_count < 4;
        });
    }, [volunteerSummaries, selectedLevel, selectedVolunteer]);

    const selectedVolunteerProfile = useMemo(
        () => volunteers.find((volunteer) => volunteer.id === selectedVolunteer) ?? null,
        [selectedVolunteer, volunteers],
    );

    const selectedVolunteerName = selectedVolunteerProfile
        ? (isRTL
            ? selectedVolunteerProfile.full_name_ar || selectedVolunteerProfile.full_name
            : selectedVolunteerProfile.full_name)
        : '';

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
                    <div className="space-y-2 flex flex-col justify-end">
                        <Label>{isRTL ? 'الشهر' : 'Month'}</Label>
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
                                                    <AvatarImage src={selectedVolunteerProfile?.avatar_url || undefined} />
                                                    <AvatarFallback className="text-[10px]">
                                                        {(selectedVolunteerProfile?.full_name?.substring(0, 2) || "U")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span>{selectedVolunteerName}</span>
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

                    <div className="flex flex-col gap-2 justify-end">
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
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'المتطوع' : 'Volunteer'}</TableHead>
                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'الدرجة' : 'Level'}</TableHead>
                                                    <TableHead className="text-center whitespace-nowrap">{isRTL ? 'عدد المشاركات' : 'Submissions'}</TableHead>
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
                                                            <TableCell className="whitespace-nowrap">
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
                                                            <TableCell className="whitespace-nowrap">
                                                                <Badge variant="outline" className="text-xs">
                                                                    {getLevelLabel(summary.volunteer.level)}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center whitespace-nowrap">
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
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            {/* Submissions List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {submissions.length === 0 ? (
                    <Card className="col-span-full">
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
                        const profileId = submission.profiles?.id;

                        let displayName = isGuest
                            ? submission.guest_name
                            : (isRTL ? submission.profiles?.full_name_ar : submission.profiles?.full_name);

                        let trainerAvatarUrl = null;

                        // If it's a trainer, try to get the trainer name
                        if (isTrainer) {
                            if (submission.trainer_id && trainersMap[submission.trainer_id]) {
                                displayName = isRTL
                                    ? trainersMap[submission.trainer_id].ar
                                    : trainersMap[submission.trainer_id].en;
                                trainerAvatarUrl = trainersMap[submission.trainer_id].image_url;
                            } else if (!displayName && submission.profiles) {
                                // If map lookup failed but we have a profile, use profile name
                                displayName = isRTL ? submission.profiles.full_name_ar : submission.profiles.full_name;
                            } else if (!displayName) {
                                // Final fallback if we know it's a trainer but have no name
                                displayName = isRTL ? 'مدرب' : 'Trainer';
                            }
                        }

                        let displayPhone = isGuest ? submission.guest_phone : submission.profiles?.phone;
                        if (isTrainer && submission.trainer_id && trainersMap[submission.trainer_id]?.phone) {
                            displayPhone = trainersMap[submission.trainer_id].phone;
                        }

                        return (
                            <Card key={submission.id} className="overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 flex flex-col h-full bg-card shadow-sm border border-border/80 relative">
                                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                                    {/* Left Accent indicator line based on status (uses start-0 for RTL safety) */}
                                    <div className={cn(
                                        "absolute top-0 bottom-0 start-0 w-1.5",
                                        submission.status === 'approved' ? 'bg-emerald-500' :
                                        submission.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'
                                    )} />

                                    <div className="ps-3 space-y-4 flex-1 flex flex-col justify-between">
                                        <div className="space-y-4">
                                            {/* Header Area */}
                                            <div className="flex justify-between items-start gap-2 border-b border-border/40 pb-3">
                                                <div 
                                                    className={cn(
                                                        "flex items-center gap-3 min-w-0 select-none",
                                                        profileId && "cursor-pointer hover:opacity-80 transition-opacity"
                                                    )}
                                                    onClick={() => {
                                                        if (profileId) {
                                                            setViewProfileUserId(profileId);
                                                        }
                                                    }}
                                                >
                                                    <Avatar className="h-10 w-10 sm:h-11 sm:w-11 border-2 border-primary/10 shrink-0">
                                                        {isTrainer && trainerAvatarUrl ? (
                                                            <AvatarImage src={trainerAvatarUrl} />
                                                        ) : isTrainer && submission.profiles?.avatar_url ? (
                                                            <AvatarImage src={submission.profiles.avatar_url} />
                                                        ) : !isGuest && submission.profiles?.avatar_url ? (
                                                            <AvatarImage src={submission.profiles.avatar_url} />
                                                        ) : null}
                                                        <AvatarFallback className="text-sm">
                                                            {isGuest && !isTrainer ? '👤' : (displayName?.substring(0, 2) || "U")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <h3 className="font-semibold text-base sm:text-lg text-foreground leading-tight truncate max-w-[150px] sm:max-w-[180px]">
                                                                {displayName || (isRTL ? 'ضيف' : 'Guest')}
                                                            </h3>
                                                            {isTrainer ? (
                                                                <Badge variant="outline" className="text-[10px] shrink-0 text-indigo-600 border-indigo-200 bg-indigo-50 px-1.5 py-0">
                                                                    {isRTL ? 'مدرب' : 'Trainer'}
                                                                </Badge>
                                                            ) : isGuest ? (
                                                                <Badge variant="outline" className="text-[10px] shrink-0 text-emerald-600 border-emerald-200 bg-emerald-50 px-1.5 py-0">
                                                                    {isRTL ? 'ضيف' : 'Guest'}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className={cn(
                                                                    "text-[10px] shrink-0 px-1.5 py-0",
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
                                                        <p className="text-xs sm:text-sm text-muted-foreground leading-none">
                                                            {format(new Date(submission.submitted_at), 'PPP', { locale: isRTL ? ar : undefined })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    {profileId && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                                            onClick={() => setViewProfileUserId(profileId)}
                                                            title={isRTL ? 'عرض الملف الشخصي' : 'View Profile'}
                                                        >
                                                            <User className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                        onClick={() => handleDelete(submission.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Details Area */}
                                            <div className="space-y-2.5">
                                                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                                                    <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-foreground font-semibold">
                                                        <Activity className="h-4 w-4 text-primary shrink-0" />
                                                        <span>{isRTL ? submission.activity_types?.name_ar : submission.activity_types?.name}</span>
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded text-muted-foreground">
                                                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                                                        <span>{isRTL ? submission.committees?.name_ar : submission.committees?.name}</span>
                                                    </span>
                                                    {displayPhone && (
                                                        <div className="inline-flex items-center gap-1 bg-muted/40 px-1.5 py-0.5 rounded shrink-0 select-none" dir="ltr">
                                                            <span className="text-muted-foreground text-xs font-mono">
                                                                {displayPhone}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                                                title={isRTL ? 'نسخ الرقم' : 'Copy Number'}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigator.clipboard.writeText(displayPhone);
                                                                    toast.success(isRTL ? 'تم نسخ رقم الهاتف' : 'Phone number copied');
                                                                }}
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                            </button>
                                                            {(() => {
                                                                const waUrl = waPhoneLink(displayPhone);
                                                                return waUrl ? (
                                                                    <a
                                                                        href={waUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-0.5 rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                                                                        title={isRTL ? 'إرسال رسالة واتساب' : 'Send WhatsApp Message'}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <MessageCircle className="h-3 w-3" />
                                                                    </a>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Description */}
                                                {submission.description && (
                                                    <div className="text-sm sm:text-base text-foreground/80 bg-muted/30 p-3 rounded-lg border border-border/50 break-words whitespace-pre-wrap leading-relaxed">
                                                        {submission.description}
                                                    </div>
                                                )}

                                                {/* Proof Image */}
                                                {submission.proof_url && (
                                                    <div className="mt-2">
                                                        <ProofImagePreview
                                                            proofUrl={submission.proof_url}
                                                            alt={isRTL ? 'إثبات المشاركة' : 'Submission Proof'}
                                                            className="relative group max-w-[150px] rounded-lg overflow-hidden border shadow-sm cursor-pointer"
                                                            imgClassName="h-20 w-auto object-cover transition-transform duration-300 group-hover:scale-105"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status & Points Area */}
                                        <div className="flex items-center justify-between pt-3 border-t border-border/30 mt-auto">
                                            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-sm font-bold shadow-sm border border-primary/5" dir="ltr">
                                                +{submission.points_awarded} {isRTL ? 'أثر' : 'Impact'}
                                            </span>
                                            
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs sm:text-sm font-semibold shadow-sm border",
                                                submission.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                submission.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                'bg-amber-50 text-amber-700 border-amber-200'
                                            )}>
                                                {submission.status === 'approved' ? (isRTL ? 'مقبول' : 'Approved') :
                                                 submission.status === 'rejected' ? (isRTL ? 'مرفوض' : 'Rejected') :
                                                 (isRTL ? 'قيد المراجعة' : 'Pending')}
                                            </span>
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

            {/* Profile View Dialog */}
            <Dialog open={!!viewProfileUserId} onOpenChange={(open) => !open && setViewProfileUserId(null)}>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl sm:rounded-3xl gap-0 border-none bg-background">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{isRTL ? 'الملف الشخصي للمتطوع' : 'Volunteer Profile'}</DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'عرض تفاصيل الملف الشخصي' : 'View profile details'}
                        </DialogDescription>
                    </DialogHeader>
                    {viewProfileUserId && <VolunteerProfilePreview userId={viewProfileUserId} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}
