import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Download, BookOpen, Calendar, Clock, MapPin, Users, Trash2, FileSpreadsheet, Check, X, MoreHorizontal, Pencil, Search, Megaphone, AlertTriangle, User, UserPlus, UserCheck, Table as TableIcon, MessageSquare } from 'lucide-react';
import { Calendar as CalendarComponent, MonthPicker } from '@/components/ui/calendar';
import { format, addDays, getDay, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CourseAdsTable } from '@/components/dashboard/CourseAdsTable';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { exportCourseReportToXlsx, type CourseExportCourse } from '@/utils/courseExport';
import { updateCourseCertificateEligibility } from '@/services/courseCertificates.service';
import { createCourseTrainerParticipation } from '@/services/courseParticipation.service';
import { appendJsonSheet, ensureXlsxFilename, loadXlsx } from '@/utils/xlsx';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Switch } from '@/components/ui/switch';
import { CACHE_TTL, getLocalCache, setLocalCache } from '@/utils/localCache';

type CertificateStatus = 'pending' | 'printing' | 'ready' | 'delivered';

interface Course {
    id: string;
    name: string;
    trainer_name: string;
    trainer_phone: string | null;
    room: string;
    schedule_days: string[];
    schedule_time: string;
    schedule_end_time: string | null;
    has_interview: boolean;
    interview_date: string | null;
    total_lectures: number;
    start_date: string;
    end_date: string | null;
    created_by: string;
    committee_id: string | null;
    trainer_id: string | null;
    course_lectures?: { status: string }[];
    course_organizers?: { id: string }[];
    course_trainers?: { trainer_id: string; trainers?: { name_ar: string; name_en: string } }[];
    has_certificates: boolean;
    certificate_status: CertificateStatus;
}

const isCourseCache = (value: unknown): value is Course[] => Array.isArray(value);

interface CourseOrganizer {
    id?: string;
    course_id?: string;
    volunteer_id?: string;
    name: string;
    phone: string;
}

interface CourseLecture {
    id: string;
    course_id: string;
    lecture_number: number;
    date: string;
    status: 'scheduled' | 'completed' | 'cancelled';
}

interface Volunteer {
    id: string;
    full_name: string;
    full_name_ar: string | null;
    phone: string | null;
    avatar_url: string | null;
    committee_id?: string | null;
}

interface Attendance {
    id: string;
    lecture_id: string;
    student_name: string;
    student_phone: string;
    status: 'present' | 'absent' | 'excused';
}

interface CourseBeneficiary {
    id: string;
    course_id: string;
    name: string;
    phone: string;
    certificate_eligible?: boolean | null;
    attendance_percentage?: number | null;
    national_id?: string | null;
}

interface Trainer {
    id: string;
    name_en: string;
    name_ar: string;
    phone: string | null;
    image_url: string | null;
    committee_id?: string | null;
    user_id?: string | null;  // linked volunteer account
}

interface CourseTrainer {
    id?: string;
    course_id?: string;
    trainer_id: string;
    trainer?: Trainer;
}

interface CourseAd {
    id: string;
    course_id: string;
    ad_number: number;
    ad_date: string;
    poster_url: string | null;
    content: string | null;
    poster_done: boolean;
    content_done: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    updater?: { full_name: string, full_name_ar: string } | null;
    course?: { name: string, start_date: string, interview_date: string | null, has_interview: boolean } | null;
}

interface CourseMarketer {
    id?: string;
    course_id?: string;
    volunteer_id?: string;
    name: string;
    phone: string;
}

type Tables = Database['public']['Tables'];
type CourseOrganizerInsert = Tables['course_organizers']['Insert'];
type CourseMarketerInsert = Tables['course_marketers']['Insert'];
type CourseTrainerInsert = Tables['course_trainers']['Insert'];
type CourseAdInsert = Tables['course_ads']['Insert'];

interface ProfileSummary {
    full_name: string | null;
    full_name_ar: string | null;
    phone: string | null;
}

interface CourseMarketerWithProfile {
    id: string;
    course_id: string;
    volunteer_id: string | null;
    profiles: ProfileSummary | null;
}

const getErrorMessage = (error: unknown, fallback = 'Error occurred') =>
    error instanceof Error ? error.message : fallback;

const getErrorCode = (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

const DAYS = [
    { value: 'saturday', label: { en: 'Saturday', ar: 'السبت' } },
    { value: 'sunday', label: { en: 'Sunday', ar: 'الأحد' } },
    { value: 'monday', label: { en: 'Monday', ar: 'الاثنين' } },
    { value: 'tuesday', label: { en: 'Tuesday', ar: 'الثلاثاء' } },
    { value: 'wednesday', label: { en: 'Wednesday', ar: 'الأربعاء' } },
    { value: 'thursday', label: { en: 'Thursday', ar: 'الخميس' } },
    { value: 'friday', label: { en: 'Friday', ar: 'الجمعة' } },
];

export default function CourseManagement() {
    const { user, hasRole, roles, profile, isLoading } = useAuth(); // Add isLoading
    const { t, language, isRTL } = useLanguage();
    const { activeBranch } = useBranch();

    const [courses, setCourses] = useState<Course[]>([]);
    const [rooms, setRooms] = useState<{ value: string, label: { en: string, ar: string } }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [lectures, setLectures] = useState<CourseLecture[]>([]);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [attendanceData, setAttendanceData] = useState<Record<string, Attendance[]>>({});
    const [showPastCourses, setShowPastCourses] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');
    const [filterDate, setFilterDate] = useState<string>('');
    const [sortBy, setSortBy] = useState<string>('date-desc');
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
    const [organizerPopoverOpen, setOrganizerPopoverOpen] = useState(false);
    const [beneficiaries, setBeneficiaries] = useState<CourseBeneficiary[]>([]);
    const [newBeneficiary, setNewBeneficiary] = useState({ name: '', phone: '', national_id: '' });
    const [editingBeneficiary, setEditingBeneficiary] = useState<CourseBeneficiary | null>(null);
    const [beneficiaryTabSearch, setBeneficiaryTabSearch] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<CourseBeneficiary | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
    const [detailsOrganizers, setDetailsOrganizers] = useState<CourseOrganizer[]>([]);
    const [detailsMarketers, setDetailsMarketers] = useState<CourseMarketer[]>([]);
    const [detailsOrganizerPopoverOpen, setDetailsOrganizerPopoverOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [trainers, setTrainers] = useState<Trainer[]>([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
    const [committees, setCommittees] = useState<{ id: string, name: string, name_ar: string, committee_type?: string | null }[]>([]);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
    const [courseAds, setCourseAds] = useState<CourseAd[]>([]);
    const [isMarketingDialogOpen, setIsMarketingDialogOpen] = useState(false);
    const [selectedMarketingCourse, setSelectedMarketingCourse] = useState<Course | null>(null);
    // Multi-trainer support
    const [courseTrainers, setCourseTrainers] = useState<CourseTrainer[]>([]);
    const [trainerPopoverOpen, setTrainerPopoverOpen] = useState(false);
    const [isEditStudentDialogOpen, setIsEditStudentDialogOpen] = useState(false);
    const [historyStudent, setHistoryStudent] = useState<CourseBeneficiary | null>(null);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    const formatTime = (timeStr: string | null | undefined) => {
        if (!timeStr) return '';
        try {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes);
            return format(date, 'h:mm a', { locale: isRTL ? ar : undefined });
        } catch {
            return timeStr || '';
        }
    };

    // roles and profile already destructured above
    const isRestricted = roles.includes('committee_leader') &&
        !roles.some(r => ['admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'head_hr', 'head_marketing'].includes(r));

    // First: Filter by active/past status
    const statusFilteredCourses = courses.filter(course => {
        if (showPastCourses) return true;

        const remainingLectures = Math.max(0, course.total_lectures - (course.course_lectures?.filter(l => l.status === 'completed').length || 0));
        const isFinished = remainingLectures === 0;

        if (isFinished) return false;

        if (course.end_date && new Date(course.end_date) < new Date(new Date().toDateString())) {
            return false;
        }

        return true;
    });

    // Second: Apply search text and month calendar filters
    const filteredCoursesList = statusFilteredCourses.filter(course => {
        // 1. Text Search Filter
        if (filterSearch) {
            const query = filterSearch.toLowerCase().trim();
            const nameMatch = course.name.toLowerCase().includes(query);
            
            // Check multi-trainers
            const trainerMatch = course.course_trainers && course.course_trainers.length > 0
                ? course.course_trainers.some(ct => 
                    ct.trainers?.name_ar?.toLowerCase().includes(query) || 
                    ct.trainers?.name_en?.toLowerCase().includes(query)
                  )
                : course.trainer_name?.toLowerCase().includes(query);
                
            if (!nameMatch && !trainerMatch) return false;
        }

        // 2. Month Filter (using filterDate)
        if (filterDate) {
            const selDate = new Date(filterDate);
            const selYear = selDate.getFullYear();
            const selMonth = selDate.getMonth();
            
            const firstDay = new Date(selYear, selMonth, 1);
            const lastDay = new Date(selYear, selMonth + 1, 0);
            
            const start = course.start_date ? new Date(course.start_date) : null;
            const end = course.end_date ? new Date(course.end_date) : null;
            
            if (!start) return false;
            
            // Strip times for comparison
            start.setHours(0, 0, 0, 0);
            if (end) end.setHours(0, 0, 0, 0);
            firstDay.setHours(0, 0, 0, 0);
            lastDay.setHours(0, 0, 0, 0);
            
            const isOverlap = start <= lastDay && (!end || end >= firstDay);
            if (!isOverlap) return false;
        }

        return true;
    });

    // Third: Sort the filtered courses list
    const activeCourses = [...filteredCoursesList].sort((a, b) => {
        if (sortBy === 'name-asc') {
            return a.name.localeCompare(b.name, isRTL ? 'ar' : 'en');
        }
        if (sortBy === 'name-desc') {
            return b.name.localeCompare(a.name, isRTL ? 'ar' : 'en');
        }
        if (sortBy === 'date-asc') {
            return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        }
        if (sortBy === 'date-desc') {
            return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        }
        if (sortBy === 'lectures-desc') {
            const remA = Math.max(0, a.total_lectures - (a.course_lectures?.filter(l => l.status === 'completed').length || 0));
            const remB = Math.max(0, b.total_lectures - (b.course_lectures?.filter(l => l.status === 'completed').length || 0));
            return remB - remA;
        }
        if (sortBy === 'lectures-asc') {
            const remA = Math.max(0, a.total_lectures - (a.course_lectures?.filter(l => l.status === 'completed').length || 0));
            const remB = Math.max(0, b.total_lectures - (b.course_lectures?.filter(l => l.status === 'completed').length || 0));
            return remA - remB;
        }
        return 0;
    });

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        trainer_name: '',
        trainer_phone: '',
        room: '',
        schedule_days: [] as string[],
        schedule_time: '10:00',
        schedule_end_time: '12:00',
        has_interview: false,
        interview_date: '',
        total_lectures: 8,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: '',
        has_certificates: false,
        committee_id: null as string | null,
    });

    const [organizers, setOrganizers] = useState<CourseOrganizer[]>([]);
    const [marketers, setMarketers] = useState<CourseMarketer[]>([]);
    const [plannedAds, setPlannedAds] = useState<string[]>([]);
    const [marketerPopoverOpen, setMarketerPopoverOpen] = useState(false);

    const [allAds, setAllAds] = useState<CourseAd[]>([]);
    const [hasAdsPermission, setHasAdsPermission] = useState(false);
    const activeCourseIds = useMemo(() => activeCourses.map(course => course.id), [activeCourses]);
    const activeCourseIdsKey = activeCourseIds.join(',');

    useEffect(() => {
        const fetchAllAds = async () => {
            // Check permissions
            const userCommittee = committees.find(c => c.id === profile?.committee_id);
            const isMarketingMember = userCommittee?.name === 'Marketing' || userCommittee?.name === 'marketing' || userCommittee?.name_ar === 'التسويق' || roles.includes('head_marketing');
            const canView = roles.some(r => ['admin', 'supervisor', 'head_hr', 'hr'].includes(r)) || isMarketingMember;

            setHasAdsPermission(canView);

            const courseIds = activeCourseIdsKey ? activeCourseIdsKey.split(',') : [];
            if (courseIds.length === 0) return;

            const { data, error } = await supabase
                .from('course_ads')
                .select('*, updater:updated_by(full_name, full_name_ar), course:courses(name, start_date, interview_date, has_interview)')
                .in('course_id', courseIds)
                .order('ad_date', { ascending: true });

            if (error) {
                console.error('Error fetching all ads:', error);
                return;
            }

            if (data) {
                setAllAds(data as unknown as CourseAd[]);
            }
        };

        fetchAllAds();
    }, [activeCourseIdsKey, roles, profile, committees]);

    useEffect(() => {
        if (isRestricted && profile?.committee_id) {
            setFormData(prev => ({ ...prev, committee_id: profile.committee_id }));
        }
    }, [isRestricted, profile?.committee_id]);

    const fetchRooms = useCallback(async () => {
        try {
            let query = supabase
                .from('rooms')
                .select('id, name, name_ar')
                .order('created_at');

            if (activeBranch?.id) {
                query = query.eq('branch_id', activeBranch.id);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching rooms:', error);
                return;
            }

            if (data && data.length > 0) {
                const mapped = data.map((room) => ({
                    value: room.id,
                    label: { en: room.name, ar: room.name_ar }
                }));
                setRooms(mapped);
                // Auto-set the default room to the first valid room UUID if not already set to a valid one
                setFormData(prev => {
                    const isValidRoom = mapped.some(r => r.value === prev.room);
                    return isValidRoom ? prev : { ...prev, room: mapped[0].value };
                });
            } else {
                setRooms([]);
            }
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    }, [activeBranch?.id]);

    const fetchCommittees = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('committees')
                .select('id, name, name_ar, committee_type')
                .order('name_ar');
            if (error) throw error;
            setCommittees(data || []);
        } catch (error) {
            console.error('Error fetching committees:', error);
        }
    }, []);



    // Auto-calculate end date
    useEffect(() => {
        if (!formData.start_date || !formData.total_lectures || formData.schedule_days.length === 0) {
            return;
        }

        const calculateEndDate = () => {
            const start = parseISO(formData.start_date);
            let current = start;
            let count = 0;
            const targetLectures = formData.total_lectures;

            // Map day names to 0-6 (Sunday=0)
            const dayMap: { [key: string]: number } = {
                'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
                'thursday': 4, 'friday': 5, 'saturday': 6
            };

            const selectedDaysIndices = formData.schedule_days.map(d => dayMap[d]);

            // Safety break to prevent infinite loops
            let safetyCounter = 0;
            while (count < targetLectures && safetyCounter < 365) { // Max 1 year duration
                const dayIndex = getDay(current);
                if (selectedDaysIndices.includes(dayIndex)) {
                    count++;
                }

                if (count < targetLectures) {
                    current = addDays(current, 1);
                }
                safetyCounter++;
            }

            setFormData(prev => ({ ...prev, end_date: format(current, 'yyyy-MM-dd') }));
        };

        calculateEndDate();
    }, [formData.start_date, formData.total_lectures, formData.schedule_days]);

    const fetchVolunteers = useCallback(async () => {
        try {
            let query = supabase
                .from('profiles')
                .select('id, full_name, full_name_ar, phone, avatar_url, committee_id')
                .neq('full_name', 'RTC Admin')
                .order('full_name');

            if (activeBranch?.id) {
                query = query.eq('branch_id', activeBranch.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setVolunteers(data || []);
        } catch (error) {
            console.error('Error fetching volunteers:', error);
        }
    }, [activeBranch?.id]);

    const fetchTrainers = useCallback(async () => {
        try {
            let query = supabase
                .from('trainers')
                .select('id, name_en, name_ar, phone, image_url, committee_id, user_id')
                .order('name_ar');

            if (isRestricted && profile?.committee_id) {
                query = query.eq('committee_id', profile.committee_id);
            }

            if (activeBranch?.id) {
                query = query.eq('branch_id', activeBranch.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTrainers((data as Trainer[]) || []);
        } catch (error) {
            console.error('Error fetching trainers:', error);
        }
    }, [activeBranch?.id, isRestricted, profile?.committee_id]);

    const fetchCourses = useCallback(async (hasCache = false) => {
        if (!hasCache) {
            setLoading(true);
        }
        try {
            let query = supabase
                .from('courses')
                .select('*, course_lectures(status), course_organizers(id), course_trainers(trainer_id, trainers(name_ar, name_en))')
                .order('start_date', { ascending: false });

            if (isRestricted && profile?.committee_id) {
                query = query.eq('committee_id', profile.committee_id);
            }

            if (activeBranch?.id) {
                query = query.eq('branch_id', activeBranch.id);
            }

            const { data, error } = await query;

            if (error) throw error;
            const coursesData = (data as Course[]) || [];
            setCourses(coursesData);

            const cacheKey = `rtc_courses_${user?.id}_${profile?.committee_id || 'all'}`;
            setLocalCache(cacheKey, coursesData, CACHE_TTL.short);
        } catch (error) {
            console.error('Error fetching courses:', error);
            toast.error(isRTL ? 'فشل في تحميل الكورسات' : 'Failed to fetch courses');
        } finally {
            setLoading(false);
        }
    }, [activeBranch?.id, isRestricted, profile?.committee_id, user?.id, isRTL]);

    useEffect(() => {
        if (isLoading) return; // Wait for auth

        const cacheKey = `rtc_courses_${user?.id}_${profile?.committee_id || 'all'}`;
        const cached = getLocalCache<Course[]>(cacheKey, isCourseCache);
        let hasCache = false;
        if (cached) {
            setCourses(cached);
            setLoading(false);
            hasCache = true;
        }

        fetchCourses(hasCache);
        fetchVolunteers();
        fetchTrainers();
        fetchCommittees();
        fetchRooms();
    }, [isLoading, user?.id, profile?.committee_id, fetchCourses, fetchVolunteers, fetchTrainers, fetchCommittees, fetchRooms]);

    const fetchCourseAds = async (courseId: string) => {
        try {
            const { data, error } = await supabase
                .from('course_ads')
                .select('*, updater:updated_by(full_name, full_name_ar)')
                .eq('course_id', courseId)
                .order('ad_number', { ascending: true });

            if (error) throw error;
            setCourseAds((data || []) as unknown as CourseAd[]);
        } catch (error) {
            console.error('Error fetching course ads:', error);
            toast.error(isRTL ? 'فشل في تحميل الإعلانات' : 'Failed to fetch course ads');
        }
    };

    const openMarketingDialog = async (course: Course) => {
        setSelectedMarketingCourse(course);
        fetchCourseAds(course.id);

        // Fetch existing marketers for this course
        const { data: mktData } = await supabase
            .from('course_marketers')
            .select('id, volunteer_id, name, phone')
            .eq('course_id', course.id);
        setDetailsMarketers((mktData as CourseMarketer[]) || []);

        setIsMarketingDialogOpen(true);
    };

    const handleAddMarketerToDetails = async (volunteer: Volunteer) => {
        if (!selectedMarketingCourse) return;
        if (detailsMarketers.some(m => m.volunteer_id === volunteer.id)) return;

        try {
            const { data, error } = await supabase
                .from('course_marketers')
                .insert({
                    course_id: selectedMarketingCourse.id,
                    volunteer_id: volunteer.id,
                    name: isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name,
                    phone: volunteer.phone || null,
                })
                .select()
                .single();

            if (error) throw error;
            setDetailsMarketers([...detailsMarketers, {
                ...data,
                name: isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name,
                phone: volunteer.phone || ''
            } as CourseMarketer]);
            toast.success(isRTL ? 'تم إضافة المسوق' : 'Marketer added');
        } catch (error) {
            console.error('Error adding marketer:', error);
            toast.error(isRTL ? 'فشل إضافة المسوق' : 'Failed to add marketer');
        }
    };

    const handleRemoveMarketerFromDetails = async (marketerId: string) => {
        try {
            const { error } = await supabase
                .from('course_marketers')
                .delete()
                .eq('id', marketerId);

            if (error) throw error;
            setDetailsMarketers(detailsMarketers.filter(m => m.id !== marketerId));
            toast.success(isRTL ? 'تم حذف المسوق' : 'Marketer removed');
        } catch (error) {
            console.error('Error removing marketer:', error);
            toast.error(isRTL ? 'فشل حذف المسوق' : 'Failed to remove marketer');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            trainer_name: '',
            trainer_phone: '',
            room: rooms.length > 0 ? rooms[0].value : '',
            schedule_days: [],
            schedule_time: '10:00',
            schedule_end_time: '12:00',
            has_interview: false,
            interview_date: '',
            total_lectures: 8,
            start_date: format(new Date(), 'yyyy-MM-dd'),
            end_date: '',
            has_certificates: false,
            committee_id: isRestricted && profile?.committee_id ? profile.committee_id : null
        });
        setOrganizers([]);
        setMarketers([]);
        setPlannedAds([]);
        setSelectedTrainerId('');
        setCourseTrainers([]);
    };

    const handleAddOrganizer = (volunteer: Volunteer) => {
        // Check if already added
        if (organizers.some(o => o.volunteer_id === volunteer.id)) {
            return;
        }
        setOrganizers([...organizers, {
            volunteer_id: volunteer.id,
            name: isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name,
            phone: volunteer.phone || ''
        }]);
        setOrganizerPopoverOpen(false);
    };

    const removeOrganizer = (index: number) => {
        setOrganizers(organizers.filter((_, i) => i !== index));
    };

    const handleAddMarketer = (volunteer: Volunteer) => {
        // Check if already added
        if (marketers.some(m => m.volunteer_id === volunteer.id)) {
            return;
        }
        setMarketers([...marketers, {
            volunteer_id: volunteer.id,
            name: isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name,
            phone: volunteer.phone || ''
        }]);
        setMarketerPopoverOpen(false);
    };

    const removeMarketer = (index: number) => {
        setMarketers(marketers.filter((_, i) => i !== index));
    };

    const handleAddCourseTrainer = (trainer: Trainer) => {
        if (courseTrainers.some(ct => ct.trainer_id === trainer.id)) return;
        setCourseTrainers([...courseTrainers, { trainer_id: trainer.id, trainer }]);
        setTrainerPopoverOpen(false);
    };

    const removeCourseTrainer = (trainerId: string) => {
        setCourseTrainers(courseTrainers.filter(ct => ct.trainer_id !== trainerId));
    };

    const toggleDay = (day: string) => {
        if (formData.schedule_days.includes(day)) {
            setFormData({ ...formData, schedule_days: formData.schedule_days.filter(d => d !== day) });
        } else {
            setFormData({ ...formData, schedule_days: [...formData.schedule_days, day] });
        }
    };

    // Check for room/time conflicts with existing courses
    const checkRoomConflict = async (
        room: string,
        scheduleDays: string[],
        scheduleTime: string,
        scheduleEndTime: string,
        startDate: string,
        endDate: string | null,
        excludeCourseId?: string
    ): Promise<boolean> => {
        try {
            // First try the RPC
            const { data, error } = await supabase.rpc('check_room_conflict', {
                p_room: room,
                p_schedule_days: scheduleDays,
                p_schedule_time: scheduleTime,
                p_schedule_end_time: scheduleEndTime || null,
                p_start_date: startDate,
                p_end_date: endDate || null,
                p_exclude_course_id: excludeCourseId || null,
            });

            if (!error && data && data.length > 0) {
                const conflict = data[0];
                const committeeName = isRTL
                    ? (conflict.conflicting_committee_name_ar || conflict.conflicting_committee_name || '')
                    : (conflict.conflicting_committee_name || conflict.conflicting_committee_name_ar || '');

                const message = isRTL
                    ? `اللاب محجوز بالفعل لكورس "${conflict.conflicting_course_name}"${committeeName ? ` - لجنة ${committeeName}` : ''}`
                    : `Lab is already booked for "${conflict.conflicting_course_name}"${committeeName ? ` — ${committeeName} Committee` : ''}`;

                toast.error(message, { duration: 5000 });
                return true; // conflict found
            }
            
            if (!error) return false; // RPC worked and found no conflict
            
            console.warn('RPC failed or missing, falling back to JS check:', error);
            
            // JS Fallback: Fetch potential conflicting courses in the same room
            let query = supabase
                .from('courses')
                .select('id, name, room, start_date, end_date, schedule_days, schedule_time, schedule_end_time, committee_id')
                .eq('room', room);
                
            if (excludeCourseId) {
                query = query.neq('id', excludeCourseId);
            }
            
            const { data: coursesInRoom, error: fetchError } = await query;
            
            if (fetchError || !coursesInRoom) return false;
            
            const addOneHour = (timeStr: string) => {
                if (!timeStr) return '23:59';
                const parts = timeStr.split(':');
                if (parts.length < 2) return timeStr;
                const h = parseInt(parts[0], 10) + 1;
                return `${h.toString().padStart(2, '0')}:${parts[1]}`;
            };
            
            const conflict = coursesInRoom.find(c => {
               const cStart = c.start_date;
               const cEnd = c.end_date || '9999-12-31';
               const pStart = startDate;
               const pEnd = endDate || '9999-12-31';
               
               if (cStart > pEnd || cEnd < pStart) return false;
               
               const hasCommonDay = c.schedule_days && c.schedule_days.some((d: string) => scheduleDays.includes(d));
               if (!hasCommonDay) return false;
               
               const cTime = c.schedule_time;
               const cEndTime = c.schedule_end_time || addOneHour(cTime);
               const pTime = scheduleTime;
               const pEndTime = scheduleEndTime || addOneHour(pTime);
               
               if (cTime >= pEndTime || cEndTime <= pTime) return false;
               
               return true;
            });
            
            if (conflict) {
               const committee = committees.find(cm => cm.id === conflict.committee_id);
               const committeeName = committee ? (isRTL ? committee.name_ar : committee.name) : '';
               
               const message = isRTL
                   ? `اللاب محجوز بالفعل لكورس "${conflict.name}"${committeeName ? ` - لجنة ${committeeName}` : ''}`
                   : `Lab is already booked for "${conflict.name}"${committeeName ? ` — ${committeeName} Committee` : ''}`;

               toast.error(message, { duration: 5000 });
               return true;
            }
            
            return false;
        } catch (e) {
            console.error('Exception checking room conflict:', e);
            return false;
        }
    };

    const handleCreateCourse = async () => {
        if (!formData.name || formData.schedule_days.length === 0 || !formData.committee_id) {
            toast.error(isRTL ? 'يرجى ملء البيانات المطلوبة واختيار اللجنة' : 'Please fill required fields and select a committee');
            return;
        }

        try {
            // Smart Date Calculation
            const start = parseISO(formData.start_date);
            let current = start;
            const lectureDates: Date[] = [];
            const targetLectures = formData.total_lectures;

            // Map day names to 0-6 (Sunday=0)
            const dayMap: { [key: string]: number } = {
                'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
                'thursday': 4, 'friday': 5, 'saturday': 6
            };

            const selectedDaysIndices = formData.schedule_days.map(d => dayMap[d]);

            // Safety break
            let safetyCounter = 0;
            // First, find the valid start date (first lecture)
            while (lectureDates.length < targetLectures && safetyCounter < 365) {
                const dayIndex = getDay(current);
                if (selectedDaysIndices.includes(dayIndex)) {
                    lectureDates.push(current);
                }
                if (lectureDates.length < targetLectures) {
                    current = addDays(current, 1);
                }
                safetyCounter++;
            }

            const actualStartDate = lectureDates.length > 0 ? format(lectureDates[0], 'yyyy-MM-dd') : formData.start_date;
            const actualEndDate = lectureDates.length > 0 ? format(lectureDates[lectureDates.length - 1], 'yyyy-MM-dd') : null;

            // Check for room conflict before creating
            const hasConflict = await checkRoomConflict(
                formData.room,
                formData.schedule_days,
                formData.schedule_time,
                formData.schedule_end_time,
                actualStartDate,
                actualEndDate
            );
            if (hasConflict) return;

            // Get trainer info if selected
            const selectedTrainer = trainers.find(t => t.id === selectedTrainerId);

            // Prepare data
            const courseData = {
                ...formData,
                trainer_id: selectedTrainerId || null,
                trainer_name: selectedTrainer ? (isRTL ? selectedTrainer.name_ar : selectedTrainer.name_en) : formData.trainer_name,
                trainer_phone: selectedTrainer?.phone || formData.trainer_phone,
                start_date: actualStartDate,
                end_date: actualEndDate,
                interview_date: formData.interview_date || null,
                has_certificates: formData.has_certificates,
                certificate_status: 'pending',
                created_by: user?.id,
                committee_id: formData.committee_id === 'null' ? null : formData.committee_id,
                branch_id: activeBranch?.id || null
            };

            // Create course
            const { data: course, error: courseError } = await supabase
                .from('courses')
                .insert(courseData)
                .select()
                .single();

            if (courseError) throw courseError;

            // Add organizers
            if (organizers.length > 0) {
                const organizerRows: CourseOrganizerInsert[] = organizers.map(o => ({
                    course_id: course.id,
                    volunteer_id: o.volunteer_id || null,
                    name: o.name,
                    phone: o.phone
                }));
                const { error: orgError } = await supabase
                    .from('course_organizers')
                    .insert(organizerRows);

                if (orgError) throw orgError;
            }

            const marketerRows: CourseMarketerInsert[] = marketers.map(m => ({
                course_id: course.id,
                volunteer_id: m.volunteer_id || null,
                name: m.name,
                phone: m.phone,
            }));
            const courseTrainerRows: CourseTrainerInsert[] = courseTrainers.map(ct => ({
                course_id: course.id,
                trainer_id: ct.trainer_id,
            }));
            const adEntries: CourseAdInsert[] = plannedAds.map((date, index) => ({
                course_id: course.id,
                ad_number: index + 1,
                ad_date: date,
                created_by: user?.id || null,
            }));
            const lectureEntries = lectureDates.map((date, index) => ({
                course_id: course.id,
                lecture_number: index + 1,
                date: format(date, 'yyyy-MM-dd'),
                status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled',
            }));

            const [marketerResult, trainerResult, adsResult, lectureResult] = await Promise.all([
                marketerRows.length > 0
                    ? supabase.from('course_marketers').insert(marketerRows)
                    : Promise.resolve({ error: null }),
                courseTrainerRows.length > 0
                    ? supabase.from('course_trainers').insert(courseTrainerRows)
                    : Promise.resolve({ error: null }),
                adEntries.length > 0
                    ? supabase.from('course_ads').insert(adEntries)
                    : Promise.resolve({ error: null }),
                supabase.from('course_lectures').insert(lectureEntries),
            ]);

            if (marketerResult.error) console.error('Error adding marketers:', marketerResult.error);
            if (trainerResult.error) console.error('Error adding course trainers:', trainerResult.error);
            if (adsResult.error) console.error('Error adding planned ads:', adsResult.error);
            if (lectureResult.error) throw lectureResult.error;

            toast.success(isRTL ? 'تم إنشاء الكورس بنجاح' : 'Course created successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchCourses();
        } catch (error) {
            console.error('Error creating course:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء إنشاء الكورس' : 'Error creating course');
        }
    };

    const openEditDialog = (course: Course) => {
        setEditingCourseId(course.id);
        setFormData({
            name: course.name,
            trainer_name: course.trainer_name || '',
            trainer_phone: course.trainer_phone || '',
            room: course.room || 'lab_1',
            schedule_days: course.schedule_days || [],
            schedule_time: course.schedule_time || '10:00',
            schedule_end_time: course.schedule_end_time || '12:00',
            has_interview: !!course.interview_date,
            interview_date: course.interview_date || '',
            total_lectures: course.total_lectures || 8,
            start_date: course.start_date || format(new Date(), 'yyyy-MM-dd'),
            end_date: course.end_date || '',
            has_certificates: course.has_certificates || false,
            committee_id: course.committee_id || null,
        });
        setSelectedTrainerId(course.trainer_id || '');

        // Fetch organizers for this course
        const fetchCourseOrganizers = async () => {
            const { data } = await supabase
                .from('course_organizers')
                .select('*')
                .eq('course_id', course.id);

            if (data) {
                setOrganizers(data);
            }
        };
        fetchCourseOrganizers();

        // Fetch marketers for this course
        const fetchCourseMarketers = async () => {
            const { data: marketersData } = await supabase
                .from('course_marketers')
                .select(`
                    id,
                    course_id,
                    volunteer_id,
                    profiles (
                        full_name,
                        full_name_ar,
                        phone
                    )
                `)
                .eq('course_id', course.id);

            if (marketersData) {
                const formattedMarketers = (marketersData as unknown as CourseMarketerWithProfile[]).map((m) => ({
                    id: m.id,
                    course_id: m.course_id,
                    volunteer_id: m.volunteer_id || undefined,
                    name: isRTL && m.profiles?.full_name_ar ? m.profiles.full_name_ar : m.profiles?.full_name || '',
                    phone: m.profiles?.phone || ''
                }));
                setMarketers(formattedMarketers);
            }
        };
        fetchCourseMarketers();

        // Fetch course trainers (multi-trainer)
        const fetchCourseTrainersForEdit = async () => {
            const { data: ctData } = await supabase
                .from('course_trainers')
                .select('id, course_id, trainer_id')
                .eq('course_id', course.id);

            if (ctData && ctData.length > 0) {
                const enriched = ctData.map((ct) => ({
                    id: ct.id,
                    course_id: ct.course_id,
                    trainer_id: ct.trainer_id,
                    trainer: trainers.find(t => t.id === ct.trainer_id)
                }));
                setCourseTrainers(enriched);
            } else {
                // Fallback: if course has a single trainer_id, seed it
                if (course.trainer_id) {
                    const t = trainers.find(t => t.id === course.trainer_id);
                    setCourseTrainers(t ? [{ trainer_id: course.trainer_id, trainer: t }] : []);
                } else {
                    setCourseTrainers([]);
                }
            }
        };
        fetchCourseTrainersForEdit();

        setIsEditOpen(true);
    };

    const handleUpdateCourse = async () => {
        if (!editingCourseId) return;

        if (!formData.name || formData.schedule_days.length === 0 || !formData.committee_id) {
            toast.error(isRTL ? 'يرجى ملء البيانات المطلوبة واختيار اللجنة' : 'Please fill required fields and select a committee');
            return;
        }

        try {
            // Smart Date Calculation (Same as create)
            const start = parseISO(formData.start_date);
            let current = start;
            const lectureDates: Date[] = [];
            const targetLectures = formData.total_lectures;

            const dayMap: { [key: string]: number } = {
                'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
                'thursday': 4, 'friday': 5, 'saturday': 6
            };

            const selectedDaysIndices = formData.schedule_days.map(d => dayMap[d]);

            let safetyCounter = 0;
            while (lectureDates.length < targetLectures && safetyCounter < 365) {
                const dayIndex = getDay(current);
                if (selectedDaysIndices.includes(dayIndex)) {
                    lectureDates.push(current);
                }
                if (lectureDates.length < targetLectures) {
                    current = addDays(current, 1);
                }
                safetyCounter++;
            }

            const actualStartDate = lectureDates.length > 0 ? format(lectureDates[0], 'yyyy-MM-dd') : formData.start_date;
            const actualEndDate = lectureDates.length > 0 ? format(lectureDates[lectureDates.length - 1], 'yyyy-MM-dd') : null;

            // Check for room conflict before updating (exclude self)
            const hasConflictOnUpdate = await checkRoomConflict(
                formData.room,
                formData.schedule_days,
                formData.schedule_time,
                formData.schedule_end_time,
                formData.start_date,
                actualEndDate,
                editingCourseId
            );
            if (hasConflictOnUpdate) return;

            const selectedTrainer = trainers.find(t => t.id === selectedTrainerId);

            const courseData = {
                ...formData,
                trainer_id: selectedTrainerId || null,
                trainer_name: selectedTrainer ? (isRTL ? selectedTrainer.name_ar : selectedTrainer.name_en) : formData.trainer_name,
                trainer_phone: selectedTrainer?.phone || formData.trainer_phone,
                start_date: formData.start_date, // Use user selected date
                end_date: actualEndDate,
                interview_date: formData.interview_date || null,
                committee_id: formData.committee_id
            };

            const { error } = await supabase
                .from('courses')
                .update(courseData)
                .eq('id', editingCourseId);

            if (error) throw error;

            const organizerRows: CourseOrganizerInsert[] = organizers.map(organizer => ({
                course_id: editingCourseId,
                volunteer_id: organizer.volunteer_id || null,
                name: organizer.name,
                phone: organizer.phone,
            }));
            const marketerRows: CourseMarketerInsert[] = marketers.map(marketer => ({
                course_id: editingCourseId,
                volunteer_id: marketer.volunteer_id || null,
                name: marketer.name,
                phone: marketer.phone,
            }));
            const courseTrainerRows: CourseTrainerInsert[] = courseTrainers.map(courseTrainer => ({
                course_id: editingCourseId,
                trainer_id: courseTrainer.trainer_id,
            }));

            const [organizerDelete, marketerDelete, trainerDelete, existingLecturesResult] = await Promise.all([
                supabase.from('course_organizers').delete().eq('course_id', editingCourseId),
                supabase.from('course_marketers').delete().eq('course_id', editingCourseId),
                supabase.from('course_trainers').delete().eq('course_id', editingCourseId),
                supabase
                    .from('course_lectures')
                    .select('id, lecture_number, date, status')
                    .eq('course_id', editingCourseId)
                    .order('lecture_number', { ascending: true }),
            ]);

            if (organizerDelete.error) throw organizerDelete.error;
            if (marketerDelete.error) throw marketerDelete.error;
            if (trainerDelete.error) throw trainerDelete.error;
            if (existingLecturesResult.error) throw existingLecturesResult.error;

            const existing = existingLecturesResult.data ?? [];

            const lectureDateUpdates = existing
                .slice(0, lectureDates.length)
                .flatMap((lecture, index) => {
                    const date = format(lectureDates[index], 'yyyy-MM-dd');
                    return lecture.date === date
                        ? []
                        : [{
                            id: lecture.id,
                            course_id: editingCourseId,
                            lecture_number: lecture.lecture_number,
                            date,
                            status: lecture.status,
                        }];
                });

            const newLectures = lectureDates.slice(existing.length).map((date, index) => ({
                course_id: editingCourseId,
                lecture_number: existing.length + index + 1,
                date: format(date, 'yyyy-MM-dd'),
                status: 'scheduled',
            }));
            const lectureIdsToDelete = existing
                .slice(lectureDates.length)
                .map(lecture => lecture.id);

            const [organizerInsert, marketerInsert, trainerInsert, lectureUpdate, lectureInsert, lectureDelete] = await Promise.all([
                organizerRows.length > 0
                    ? supabase.from('course_organizers').insert(organizerRows)
                    : Promise.resolve({ error: null }),
                marketerRows.length > 0
                    ? supabase.from('course_marketers').insert(marketerRows)
                    : Promise.resolve({ error: null }),
                courseTrainerRows.length > 0
                    ? supabase.from('course_trainers').insert(courseTrainerRows)
                    : Promise.resolve({ error: null }),
                lectureDateUpdates.length > 0
                    ? supabase.from('course_lectures').upsert(lectureDateUpdates, { onConflict: 'id' })
                    : Promise.resolve({ error: null }),
                newLectures.length > 0
                    ? supabase.from('course_lectures').insert(newLectures)
                    : Promise.resolve({ error: null }),
                lectureIdsToDelete.length > 0
                    ? supabase.from('course_lectures').delete().in('id', lectureIdsToDelete)
                    : Promise.resolve({ error: null }),
            ]);

            if (organizerInsert.error) throw organizerInsert.error;
            if (marketerInsert.error) throw marketerInsert.error;
            if (trainerInsert.error) throw trainerInsert.error;
            if (lectureUpdate.error) throw lectureUpdate.error;
            if (lectureInsert.error) throw lectureInsert.error;
            if (lectureDelete.error) throw lectureDelete.error;

            toast.success(isRTL ? 'تم تحديث الكورس بنجاح' : 'Course updated successfully');
            setIsEditOpen(false);
            setEditingCourseId(null);
            resetForm();
            fetchCourses();
        } catch (error) {
            console.error('Error updating course:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء تحديث الكورس' : 'Error updating course');
        }
    };

    // Ad Management Functions
    const handleAddAd = async () => {
        if (!selectedCourse) return;

        try {
            const nextAdNumber = (courseAds.length > 0 ? Math.max(...courseAds.map(a => a.ad_number)) : 0) + 1;
            const maxDateStr = selectedCourse.has_interview && selectedCourse.interview_date
                ? selectedCourse.interview_date
                : selectedCourse.start_date;

            let defaultDate = new Date();
            if (maxDateStr && defaultDate > new Date(maxDateStr)) {
                defaultDate = new Date(maxDateStr);
            }

            const newAdData: CourseAdInsert = {
                course_id: selectedCourse.id,
                ad_number: nextAdNumber,
                ad_date: format(defaultDate, 'yyyy-MM-dd'),
                created_by: user?.id || null,
                poster_done: false,
                content_done: false
            };

            const { data, error } = await supabase
                .from('course_ads')
                .insert(newAdData)
                .select()
                .single();

            if (error) throw error;

            setCourseAds([...courseAds, data as CourseAd]);
            toast.success(isRTL ? 'تم إضافة إعلان جديد' : 'New ad added successfully');
        } catch (error) {
            console.error('Error adding ad:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء إضافة الإعلان' : 'Error adding ad');
        }
    };

    const recordMarketingActivity = async (type: 'poster' | 'content', courseName: string, adNumber: number, adDate?: string) => {
        try {
            // Get all committees and find marketing one in JS (avoid .eq with potentially wrong name)
            const { data: allCommittees } = await supabase.from('committees').select('id, name');
            const committee = allCommittees?.find(c =>
                c.name.toLowerCase().includes('market') ||
                c.name.includes('تسويق') ||
                c.name.includes('إعلام')
            );

            if (!committee) {
                console.warn('لم يتم إيجاد لجنة التسويق - أسماء اللجان المتاحة:', allCommittees?.map(c => c.name));
                return;
            }

            // Get all activity types and find the right one
            const { data: allTypes } = await supabase.from('activity_types').select('id, points, name');
            const activityNameExact = type === 'poster' ? 'Course Ad Poster' : 'Course Ad Content';
            const activityType = allTypes?.find(a => a.name === activityNameExact)
                || allTypes?.find(a =>
                    (type === 'poster' && (a.name.toLowerCase().includes('poster') || a.name.includes('بوستر'))) ||
                    (type === 'content' && (a.name.toLowerCase().includes('content') || a.name.includes('محتوى') || a.name.includes('محتوي'))) ||
                    a.name.toLowerCase().includes('ad') ||
                    a.name.toLowerCase().includes('market')
                );

            if (!activityType) {
                console.warn(`نوع النشاط '${activityNameExact}' غير موجود - أسماء الأنواع المتاحة:`, allTypes?.map(a => a.name));
                return;
            }

            // Create Submission
            const submissionDate = adDate ? new Date(adDate + 'T12:00:00').toISOString() : new Date().toISOString();
            const { error } = await supabase.from('activity_submissions').insert({
                volunteer_id: user?.id,
                committee_id: committee.id,
                activity_type_id: activityType.id,
                description: `${isRTL ? 'إعلان رقم' : 'Ad #'} ${adNumber} - ${courseName} (${type === 'poster' ? (isRTL ? 'بوستر' : 'Poster') : (isRTL ? 'محتوى' : 'Content')})`,
                points_awarded: activityType.points,
                status: 'approved',
                location: 'remote',
                proof_url: null,
                submitted_at: submissionDate
            });

            if (error) throw error;

            toast.success(isRTL ? 'تم تسجيل نقاط النشاط بنجاح' : 'Activity points recorded successfully');

        } catch (error) {
            console.error('Error recording marketing activity:', error);
        }
    };

    const handleUpdateAd = async (adId: string, updates: Partial<CourseAd>) => {
        try {
            const { error } = await supabase
                .from('course_ads')
                .update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() })
                .eq('id', adId);

            if (error) throw error;

            // Updated Ad object
            const updatedAd = { ...courseAds.find(a => a.id === adId)!, ...updates };
            // Also look in allAds if not found in courseAds (e.g. editing from summary table)
            const globalAd = allAds.find(a => a.id === adId);

            // Sync states
            setCourseAds(courseAds.map(ad => ad.id === adId ? { ...ad, ...updates } : ad));
            setAllAds(prev => prev.map(ad => ad.id === adId ? { ...ad, ...updates } : ad));

            // If we are marking as done, record activity
            const courseName = selectedMarketingCourse?.name || globalAd?.course?.name;
            const adNumber = updatedAd?.ad_number || globalAd?.ad_number;
            const adDate = updatedAd?.ad_date || globalAd?.ad_date;

            if (courseName && adNumber && user) {
                if (updates.poster_done === true) {
                    recordMarketingActivity('poster', courseName, adNumber, adDate);
                }
                if (updates.content_done === true) {
                    recordMarketingActivity('content', courseName, adNumber, adDate);
                }
            }

            toast.success(isRTL ? 'تم تحديث الإعلان' : 'Ad updated successfully');
        } catch (error) {
            console.error('Error updating ad:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء تحديث الإعلان' : 'Error updating ad');
        }
    };

    const handleDeleteAd = async (adId: string) => {
        try {
            const { error } = await supabase
                .from('course_ads')
                .delete()
                .eq('id', adId);

            if (error) throw error;

            if (error) throw error;

            setCourseAds(courseAds.filter(ad => ad.id !== adId));
            setAllAds(prev => prev.filter(ad => ad.id !== adId));
            toast.success(isRTL ? 'تم حذف الإعلان' : 'Ad deleted successfully');
        } catch (error) {
            console.error('Error deleting ad:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء حذف الإعلان' : 'Error deleting ad');
        }
    };

    const handleUpdateAdDate = async (adId: string, newDate: string) => {
        // Find ad to get course details if selectedMarketingCourse is null
        const targetAd = courseAds.find(a => a.id === adId) || allAds.find(a => a.id === adId);
        const courseData = selectedMarketingCourse || targetAd?.course;

        // Validate date
        if (courseData) {
            const maxDate = courseData.has_interview && courseData.interview_date
                ? courseData.interview_date
                : courseData.start_date;

            if (maxDate && new Date(newDate) > new Date(maxDate)) {
                toast.error(isRTL ? 'تاريخ النشر لا يمكن أن يكون بعد الموعد المحدد' : 'Publish date cannot be after the deadline');
                return;
            }
        }

        try {
            const { error } = await supabase
                .from('course_ads')
                .update({ ad_date: newDate })
                .eq('id', adId);

            if (error) throw error;

            const updatedAd = { ...courseAds.find(a => a.id === adId)!, ad_date: newDate };
            setCourseAds(courseAds.map(ad => ad.id === adId ? updatedAd : ad));
            setAllAds(prev => prev.map(ad => ad.id === adId ? { ...ad, ad_date: newDate } : ad));
            toast.success(isRTL ? 'تم تحديث التاريخ' : 'Date updated');
        } catch (error) {
            console.error('Error updating ad date:', error);
            toast.error(isRTL ? 'خطأ في التحديث' : 'Update error');
        }
    };

    const handleAddAdFromDialog = async () => {
        if (!selectedMarketingCourse) return;

        try {
            const nextAdNumber = (courseAds.length > 0 ? Math.max(...courseAds.map(a => a.ad_number)) : 0) + 1;
            const maxDateStr = selectedMarketingCourse.has_interview && selectedMarketingCourse.interview_date
                ? selectedMarketingCourse.interview_date
                : selectedMarketingCourse.start_date;

            let defaultDate = new Date();
            if (maxDateStr && defaultDate > new Date(maxDateStr)) {
                defaultDate = new Date(maxDateStr);
            }

            const newAdData: CourseAdInsert = {
                course_id: selectedMarketingCourse.id,
                ad_number: nextAdNumber,
                ad_date: format(defaultDate, 'yyyy-MM-dd'),
                created_by: user?.id || null,
                poster_done: false,
                content_done: false
            };

            const { data, error } = await supabase
                .from('course_ads')
                .insert(newAdData)
                .select('*, updater:updated_by(full_name, full_name_ar), course:courses(name, start_date, interview_date, has_interview)')
                .single();

            if (error) throw error;

            setCourseAds([...courseAds, data as unknown as CourseAd]);
            setAllAds(prev => [...prev, data as unknown as CourseAd]);
            toast.success(isRTL ? 'تم إضافة إعلان جديد' : 'New ad added successfully');
        } catch (error) {
            console.error('Error adding ad:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء إضافة الإعلان' : 'Error adding ad');
        }
    };

    const openCourseDetails = async (course: Course) => {
        setSelectedCourse(course);
        setLectures([]);
        setAttendanceData({});
        setBeneficiaries([]);
        setDetailsMarketers([]);
        setNewBeneficiary({ name: '', phone: '', national_id: '' });
        setEditingBeneficiary(null);
        try {
            const [lecturesResult, adsResult, beneficiariesResult, organizersResult, marketersResult] = await Promise.all([
                supabase
                    .from('course_lectures')
                    .select('*')
                    .eq('course_id', course.id)
                    .order('lecture_number'),
                supabase
                    .from('course_ads')
                    .select(`
                        *,
                        updater:updated_by(full_name, full_name_ar)
                    `)
                    .eq('course_id', course.id)
                    .order('ad_number'),
                supabase
                    .from('course_beneficiaries')
                    .select('*')
                    .eq('course_id', course.id)
                    .order('name'),
                supabase
                    .from('course_organizers')
                    .select('*')
                    .eq('course_id', course.id),
                supabase
                    .from('course_marketers')
                    .select(`
                        id,
                        course_id,
                        volunteer_id,
                        profiles:volunteer_id (
                            full_name,
                            full_name_ar,
                            phone
                        )
                    `)
                    .eq('course_id', course.id),
            ]);

            const { data: lecturesData } = lecturesResult;
            const { data: adsData } = adsResult;
            const { data: beneficiariesData } = beneficiariesResult;
            const { data: organizersData } = organizersResult;
            const { data: marketersData } = marketersResult;

            if (adsData) {
                setCourseAds(adsData as unknown as CourseAd[]);
            }

            if (beneficiariesData) {
                setBeneficiaries(beneficiariesData);
            }

            if (lecturesData) {
                setLectures(lecturesData as CourseLecture[]);
                // Fetch attendance for all these lectures
                const lectureIds = lecturesData.map(l => l.id);
                const { data: attendance } = await supabase
                    .from('course_attendance')
                    .select('*')
                    .in('lecture_id', lectureIds);

                if (attendance) {
                    const grouped = attendance.reduce((acc, curr) => {
                        if (!acc[curr.lecture_id]) acc[curr.lecture_id] = [];
                        acc[curr.lecture_id].push({
                            ...curr,
                            status: curr.status as Attendance['status']
                        });
                        return acc;
                    }, {} as Record<string, Attendance[]>);
                    setAttendanceData(grouped);
                }
            }

            if (organizersData) {
                setDetailsOrganizers(organizersData);
            }

            if (marketersData) {
                const formattedMarketers = (marketersData as unknown as CourseMarketerWithProfile[]).map((m) => ({
                    id: m.id,
                    course_id: m.course_id,
                    volunteer_id: m.volunteer_id || undefined,
                    name: isRTL && m.profiles?.full_name_ar ? m.profiles.full_name_ar : m.profiles?.full_name || '',
                    phone: m.profiles?.phone || ''
                }));
                setDetailsMarketers(formattedMarketers);
            }

            setIsDetailsOpen(true);
        } catch (error) {
            console.error('Error fetching details:', error);
        }
    };

    const updateLectureStatus = async (lectureId: string, status: 'scheduled' | 'completed' | 'cancelled') => {
        try {
            const { error } = await supabase
                .from('course_lectures')
                .update({ status })
                .eq('id', lectureId);

            if (error) throw error;

            // If marked as completed, create trainer participation
            // Only register if lecture was NOT already completed (prevent duplicate)
            if (status === 'completed' && selectedCourse) {
                const currentLecture = lectures.find(l => l.id === lectureId);
                if (currentLecture?.status !== 'completed') {
                    await createTrainerParticipation(selectedCourse, lectureId);
                }
            }

            setLectures(lectures.map(l => l.id === lectureId ? { ...l, status } : l));
            toast.success(isRTL ? 'تم تحديث حالة المحاضرة' : 'Lecture status updated');
        } catch (error) {
            console.error('Error updating lecture:', error);
            toast.error(isRTL ? 'فشل تحديث المحاضرة' : 'Failed to update lecture');
        }
    };

    // Create trainer participation when lecture is completed
    // Always logs in trainer_lecture_records (name + phone, no account needed)
    // Additionally logs in activity_submissions if the trainer has a system profile
    const createTrainerParticipation = async (course: Course, lectureId: string) => {
        try {
            const lecture = lectures.find(l => l.id === lectureId);
            await createCourseTrainerParticipation({
                course,
                lectureId,
                lectureNumber: lecture?.lecture_number || '',
                lectureDate: lecture?.date,
            });
        } catch (error) {
            console.error('Error in createTrainerParticipation:', error);
        }
    };

    const getCertificateStatusLabel = (exportCourse: CourseExportCourse) => {
        if (!exportCourse.has_certificates) {
            return isRTL ? 'لا يوجد شهادات' : 'No Certificates';
        }

        if (!isRTL) return exportCourse.certificate_status || 'Pending';

        if (exportCourse.certificate_status === 'printing') return 'جاري الطباعة';
        if (exportCourse.certificate_status === 'ready') return 'جاهزة للتسليم';
        if (exportCourse.certificate_status === 'delivered') return 'تم التسليم';
        return 'انتظار';
    };

    const exportCourseToExcel = async (course: Course) => {
        try {
            await exportCourseReportToXlsx({
                course,
                isRTL,
                getRoomLabel: room => rooms.find(r => r.value === room)?.label[language as 'en' | 'ar'] || room,
                getDayLabel: day => DAYS.find(d => d.value === day)?.label[language as 'en' | 'ar'],
                getCertificateStatusLabel,
            });
        } catch (error) {
            console.error('Export error:', error);
            toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
        }
    };

    const exportAllCourses = async () => {
        try {
            const XLSX = await loadXlsx();

            const allData = courses.map(c => ({
                [isRTL ? 'اسم الكورس' : 'Course Name']: c.name,
                [isRTL ? 'المدرب' : 'Trainer']: c.trainer_name,
                [isRTL ? 'رقم المدرب' : 'Trainer Phone']: c.trainer_phone || '-',
                [isRTL ? 'القاعة' : 'Room']: rooms.find(r => r.value === c.room)?.label[language as 'en' | 'ar'] || c.room,
                [isRTL ? 'الأيام' : 'Days']: c.schedule_days.map(d => DAYS.find(day => day.value === d)?.label[language as 'en' | 'ar']).join(', '),
                [isRTL ? 'وقت البداية' : 'Start Time']: c.schedule_time,
                [isRTL ? 'وقت الانتهاء' : 'End Time']: c.schedule_end_time || '-',
                [isRTL ? 'عدد المحاضرات' : 'Lectures']: c.total_lectures,
                [isRTL ? 'تاريخ البداية' : 'Start Date']: c.start_date,
                [isRTL ? 'تاريخ النهاية' : 'End Date']: c.end_date || '-',
                [isRTL ? 'انترفيو' : 'Interview']: c.has_interview ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No'),
                [isRTL ? 'تاريخ الانترفيو' : 'Interview Date']: c.interview_date || '-',
            }));

            const wb = XLSX.utils.book_new();
            appendJsonSheet(XLSX.utils, wb, allData, isRTL ? 'كل الكورسات' : 'All Courses');
            XLSX.writeFile(wb, ensureXlsxFilename(`All_Courses_${format(new Date(), 'yyyy-MM-dd')}.xlsx`));
        } catch (error) {
            console.error('Export error:', error);
            toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
        }
    };

    const getRoomLabel = (room: string) => {
        const r = rooms.find(rm => rm.value === room);
        return r ? r.label[language as 'en' | 'ar'] : room;
    };

    const getDaysLabel = (days: string[]) => {
        return days.map(d => DAYS.find(day => day.value === d)?.label[language as 'en' | 'ar']).join(', ');
    };

    const isLectureOpen = (dateStr: string) => {
        // Use parseISO to avoid UTC midnight timezone shift (+03:00 would make it previous day)
        const lectureDate = parseISO(dateStr);
        const now = new Date();
        lectureDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        return now >= lectureDate;
    };

    const getStudentStats = (studentPhone: string) => {
        const completedLectures = lectures.filter(l => l.status === 'completed');
        let attendedCount = 0;
        completedLectures.forEach(l => {
            const isPresent = attendanceData[l.id]?.some(a => a.student_phone === studentPhone && a.status === 'present');
            if (isPresent) attendedCount++;
        });
        const totalCompleted = completedLectures.length;
        const rate = totalCompleted > 0 ? Math.round((attendedCount / totalCompleted) * 100) : 0;
        return {
            attended: attendedCount,
            missed: totalCompleted - attendedCount,
            rate
        };
    };

    const registerAttendance = async (lectureId: string, name: string, phone: string) => {
        try {
            const { error } = await supabase.from('course_attendance').insert({
                lecture_id: lectureId,
                student_name: name,
                student_phone: phone,
                status: 'present',
                created_by: user?.id
            });

            if (error) throw error;

            // Update local state
            const newRecord: Attendance = {
                id: crypto.randomUUID(),
                lecture_id: lectureId,
                student_name: name,
                student_phone: phone,
                status: 'present'
            };

            setAttendanceData(prev => ({
                ...prev,
                [lectureId]: [...(prev[lectureId] || []), newRecord]
            }));

            toast.success(isRTL ? 'تم تسجيل الحضور' : 'Attendance registered');
            return true;
        } catch (error) {
            console.error('Error registering attendance:', error);
            toast.error(isRTL ? 'فشل تسجيل الحضور' : 'Failed to register attendance');
            return false;
        }
    };

    const getCompletedLectures = (courseId: string) => {
        // This would need async fetch, for now return placeholder
        return 0;
    };

    // Beneficiary Management Functions
    const addBeneficiary = async () => {
        if (!selectedCourse || !newBeneficiary.name || !newBeneficiary.phone) {
            toast.error(isRTL ? 'يرجى إدخال الاسم والرقم' : 'Please enter name and phone');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('course_beneficiaries')
                .insert({
                    course_id: selectedCourse.id,
                    name: newBeneficiary.name,
                    phone: newBeneficiary.phone,
                    national_id: newBeneficiary.national_id || null,
                    created_by: user?.id
                })
                .select()
                .single();

            if (error) throw error;

            setBeneficiaries([...beneficiaries, data]);
            setNewBeneficiary({ name: '', phone: '', national_id: '' });
            toast.success(isRTL ? 'تم إضافة المستفيد' : 'Beneficiary added');
        } catch (error: unknown) {
            console.error('Error adding beneficiary:', error);
            if (getErrorCode(error) === '23505') {
                toast.error(isRTL ? 'هذا الرقم مسجل بالفعل' : 'This phone is already registered');
            } else {
                toast.error(isRTL ? 'فشل إضافة المستفيد' : 'Failed to add beneficiary');
            }
        }
    };

    const updateBeneficiary = async () => {
        if (!editingBeneficiary) return;

        try {
            const { error } = await supabase
                .from('course_beneficiaries')
                .update({
                    name: editingBeneficiary.name,
                    phone: editingBeneficiary.phone,
                    national_id: editingBeneficiary.national_id || null
                })
                .eq('id', editingBeneficiary.id);

            if (error) throw error;

            setBeneficiaries(beneficiaries.map(b =>
                b.id === editingBeneficiary.id ? editingBeneficiary : b
            ));
            setEditingBeneficiary(null);
            toast.success(isRTL ? 'تم تحديث البيانات' : 'Beneficiary updated');
        } catch (error) {
            console.error('Error updating beneficiary:', error);
            toast.error(isRTL ? 'فشل التحديث' : 'Failed to update');
        }
    };

    const confirmDeleteBeneficiary = (beneficiary: CourseBeneficiary) => {
        setBeneficiaryToDelete(beneficiary);
        setIsDeleteConfirmOpen(true);
    };

    const deleteBeneficiary = async () => {
        if (!beneficiaryToDelete) return;
        try {
            const { error } = await supabase
                .from('course_beneficiaries')
                .delete()
                .eq('id', beneficiaryToDelete.id);

            if (error) throw error;

            setBeneficiaries(beneficiaries.filter(b => b.id !== beneficiaryToDelete.id));
            toast.success(isRTL ? 'تم حذف المستفيد' : 'Beneficiary deleted');
        } catch (error) {
            console.error('Error deleting beneficiary:', error);
            toast.error(isRTL ? 'فشل الحذف' : 'Failed to delete');
        } finally {
            setIsDeleteConfirmOpen(false);
            setBeneficiaryToDelete(null);
        }
    };

    const toggleBeneficiaryAttendance = async (lectureId: string, beneficiary: CourseBeneficiary) => {
        const existingAttendance = attendanceData[lectureId]?.find(a => a.student_phone === beneficiary.phone);

        try {
            if (existingAttendance) {
                // Remove attendance
                const { error } = await supabase
                    .from('course_attendance')
                    .delete()
                    .eq('id', existingAttendance.id);

                if (error) throw error;

                setAttendanceData(prev => ({
                    ...prev,
                    [lectureId]: (prev[lectureId] || []).filter(a => a.id !== existingAttendance.id)
                }));
            } else {
                // Add attendance
                const { data, error } = await supabase
                    .from('course_attendance')
                    .insert({
                        lecture_id: lectureId,
                        student_name: beneficiary.name,
                        student_phone: beneficiary.phone,
                        status: 'present',
                        created_by: user?.id
                    })
                    .select()
                    .single();

                if (error) throw error;

                setAttendanceData(prev => ({
                    ...prev,
                    [lectureId]: [...(prev[lectureId] || []), data as Attendance]
                }));
            }
        } catch (error) {
            console.error('Error toggling attendance:', error);
            toast.error(isRTL ? 'فشل تحديث الحضور' : 'Failed to update attendance');
        }
    };

    const handleDeleteCourse = async () => {
        if (!courseToDelete) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('courses')
                .delete()
                .eq('id', courseToDelete.id);

            if (error) throw error;

            toast.success(isRTL ? 'تم حذف الكورس بنجاح' : 'Course deleted successfully');
            setIsDeleteDialogOpen(false);
            setCourseToDelete(null);
            fetchCourses();
        } catch (error: unknown) {
            console.error('Error deleting course:', error);
            toast.error(getErrorMessage(error, isRTL ? 'فشل حذف الكورس' : 'Failed to delete course'));
        } finally {
            setIsDeleting(false);
        }
    };

    const updateCertificateStatus = async (courseId: string, status: CertificateStatus) => {
        try {
            const { error } = await supabase
                .from('courses')
                .update({ certificate_status: status })
                .eq('id', courseId);

            if (error) throw error;

            // If status is 'delivered', calculate eligibility for all beneficiaries
            if (status === 'delivered') {
                await calculateCertificateEligibility(courseId);
            }

            setCourses(courses.map(c => c.id === courseId ? { ...c, certificate_status: status } : c));
            if (selectedCourse?.id === courseId) {
                setSelectedCourse({ ...selectedCourse, certificate_status: status });
            }
            toast.success(isRTL ? 'تم تحديث حالة الشهادات' : 'Certificates status updated');
        } catch (error) {
            console.error('Error updating certificate status:', error);
            toast.error(isRTL ? 'فشل تحديث الحالة' : 'Failed to update status');
        }
    };

    // Calculate certificate eligibility based on 75% attendance
    const calculateCertificateEligibility = async (courseId: string) => {
        try {
            const { eligibleCount, beneficiaryCount } = await updateCourseCertificateEligibility(courseId);
            if (beneficiaryCount === 0) return;

            toast.info(
                isRTL
                    ? `${eligibleCount} من ${beneficiaryCount} مستفيد مستحق للشهادة (حضور ≥ 75%)`
                    : `${eligibleCount} of ${beneficiaryCount} beneficiaries eligible for certificate (attendance ≥ 75%)`
            );
        } catch (error) {
            console.error('Error calculating eligibility:', error);
        }
    };

    const handleAddOrganizerToDetails = async (volunteer: Volunteer) => {
        if (!selectedCourse) return;

        // Check if already added
        if (detailsOrganizers.some(o => o.volunteer_id === volunteer.id)) {
            toast.error(isRTL ? 'هذا المنظم مضاف بالفعل' : 'This organizer is already added');
            return;
        }

        try {
            const newOrganizer: CourseOrganizerInsert = {
                course_id: selectedCourse.id,
                volunteer_id: volunteer.id,
                name: isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name,
                phone: volunteer.phone || ''
            };

            const { data, error } = await supabase
                .from('course_organizers')
                .insert(newOrganizer)
                .select()
                .single();

            if (error) throw error;

            setDetailsOrganizers([...detailsOrganizers, data]);
            toast.success(isRTL ? 'تم إضافة المنظم' : 'Organizer added');
        } catch (error) {
            console.error('Error adding organizer:', error);
            toast.error(isRTL ? 'فشل إضافة المنظم' : 'Failed to add organizer');
        }
    };

    const handleRemoveOrganizerFromDetails = async (organizerId: string) => {
        if (!organizerId) return;

        try {
            const { error } = await supabase
                .from('course_organizers')
                .delete()
                .eq('id', organizerId);

            if (error) throw error;

            setDetailsOrganizers(detailsOrganizers.filter(o => o.id !== organizerId));
            toast.success(isRTL ? 'تم حذف المنظم' : 'Organizer removed');
        } catch (error) {
            console.error('Error removing organizer:', error);
            toast.error(isRTL ? 'فشل حذف المنظم' : 'Failed to remove organizer');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        {isRTL ? 'إدارة الكورسات' : 'Course Management'}
                        {isRestricted && profile?.committee_id && committees.find(c => c.id === profile.committee_id) && (
                            <span className="text-primary text-2xl">
                                - {isRTL
                                    ? committees.find(c => c.id === profile.committee_id)?.name_ar
                                    : committees.find(c => c.id === profile.committee_id)?.name}
                            </span>
                        )}
                    </h1>
                    <p className="text-muted-foreground">{isRTL ? 'إدارة الكورسات والمحاضرات' : 'Manage courses and lectures'}</p>
                </div>
                <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2 cursor-pointer text-sm px-1">
                        <Checkbox
                            id="show-past-courses"
                            checked={showPastCourses}
                            onCheckedChange={(checked) => setShowPastCourses(!!checked)}
                        />
                        <Label
                            htmlFor="show-past-courses"
                            className="text-muted-foreground cursor-pointer text-sm font-normal"
                        >
                            {isRTL ? 'عرض الكورسات المنتهية' : 'Show ended courses'}
                        </Label>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={exportAllCourses} className="flex-1 sm:flex-none">
                            <FileSpreadsheet className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                            {isRTL ? 'تصدير الكل' : 'Export All'}
                        </Button>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="flex-1 sm:flex-none">
                                    <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                    {isRTL ? 'إضافة كورس' : 'Add Course'}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">{isRTL ? 'إضافة كورس جديد' : 'Add New Course'}</DialogTitle>
                                    <DialogDescription>{isRTL ? 'أضف تفاصيل الكورس' : 'Add course details'}</DialogDescription>
                                </DialogHeader>

                                <div className="py-4">
                                    <div className="grid gap-6">
                                        {/* Common Fields: Name & Room */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <Label className="text-base">{isRTL ? 'اسم الكورس *' : 'Course Name *'}</Label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    className="h-12"
                                                    placeholder={isRTL ? 'مثال: كورس الإسعافات الأولية' : 'e.g., First Aid Course'}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-base">{isRTL ? 'القاعة *' : 'Room *'}</Label>
                                                <Select value={formData.room} onValueChange={val => setFormData({ ...formData, room: val })}>
                                                    <SelectTrigger className="h-12">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {rooms.map(room => (
                                                            <SelectItem key={room.value} value={room.value} className="py-3">
                                                                {room.label[language as 'en' | 'ar']}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Common Fields: Committee */}
                                        <div className="space-y-3">
                                            <Label className="text-base">{isRTL ? 'اللجنة' : 'Committee'}</Label>
                                            <Select
                                                value={formData.committee_id || ''}
                                                onValueChange={val => setFormData({ ...formData, committee_id: val })}
                                                disabled={isRestricted}
                                            >
                                                <SelectTrigger className="h-12">
                                                    <SelectValue placeholder={isRTL ? 'اختر اللجنة' : 'Select Committee'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {committees
                                                        .filter(c => c.committee_type === 'production')
                                                        .map(committee => (
                                                            <SelectItem key={committee.id} value={committee.id} className="py-3">
                                                                {isRTL ? committee.name_ar : committee.name}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Common Fields: Trainers (Multi) */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-base">{isRTL ? 'المدربون' : 'Trainers'}</Label>
                                            </div>

                                            <div className="space-y-3">
                                                    <div className="flex flex-wrap gap-2 min-h-[48px] p-2 border rounded-md bg-background items-center transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                                                        {courseTrainers.length > 0 ? (
                                                            courseTrainers.map(ct => {
                                                                const tr = ct.trainer || trainers.find(t => t.id === ct.trainer_id);
                                                                return (
                                                                    <div key={ct.trainer_id} className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-full text-sm">
                                                                        <Avatar className="h-5 w-5">
                                                                            <AvatarImage src={tr?.image_url || undefined} />
                                                                            <AvatarFallback className="text-[10px]">{tr ? (isRTL ? tr.name_ar : tr.name_en).charAt(0) : '?'}</AvatarFallback>
                                                                        </Avatar>
                                                                        <span>{tr ? (isRTL ? tr.name_ar : tr.name_en) : ct.trainer_id}</span>
                                                                        <button type="button" onClick={() => removeCourseTrainer(ct.trainer_id)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground px-2">
                                                                {isRTL ? 'لم يتم تحديد مدربين...' : 'No trainers selected...'}
                                                            </span>
                                                        )}

                                                        <Popover open={trainerPopoverOpen} onOpenChange={setTrainerPopoverOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground ml-auto" disabled={!formData.committee_id}>
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                    {isRTL ? 'إضافة مدرب' : 'Add'}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-72 p-0" align="end">
                                                                <Command>
                                                                    <CommandInput placeholder={isRTL ? 'ابحث عن مدرب...' : 'Search trainer...'} />
                                                                    <CommandList>
                                                                        <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results'}</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {trainers
                                                                                .filter(t => !courseTrainers.some(ct => ct.trainer_id === t.id))
                                                                                .filter(t => !formData.committee_id || t.committee_id === formData.committee_id)
                                                                                .map(trainer => (
                                                                                    <CommandItem
                                                                                        key={trainer.id}
                                                                                        onSelect={() => handleAddCourseTrainer(trainer)}
                                                                                        className="flex items-center gap-2 cursor-pointer"
                                                                                    >
                                                                                        <Avatar className="h-7 w-7">
                                                                                            <AvatarImage src={trainer.image_url || undefined} />
                                                                                            <AvatarFallback className="text-xs">{(isRTL ? trainer.name_ar : trainer.name_en).charAt(0)}</AvatarFallback>
                                                                                        </Avatar>
                                                                                        <div className="flex flex-col min-w-0">
                                                                                            <span className="text-sm font-medium truncate">{isRTL ? trainer.name_ar : trainer.name_en}</span>
                                                                                            {trainer.phone && <span className="text-xs text-muted-foreground" dir="ltr">{trainer.phone}</span>}
                                                                                        </div>
                                                                                    </CommandItem>
                                                                                ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>
                                        </div>

                                        {/* Common Fields: Schedule */}
                                        <div className="space-y-3">
                                            <Label className="text-base">{isRTL ? 'أيام الكورس *' : 'Course Days *'}</Label>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:flex md:flex-wrap gap-2">
                                                {DAYS.map(day => {
                                                    const isSelected = formData.schedule_days.includes(day.value);
                                                    return (
                                                        <div
                                                            key={day.value}
                                                            onClick={() => toggleDay(day.value)}
                                                            className={`
                                                        flex items-center justify-center gap-1 px-2 py-2.5 border rounded-lg cursor-pointer transition-all text-center
                                                        ${isSelected
                                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                                    : 'hover:bg-accent hover:border-accent-foreground/50 bg-background'
                                                                }
                                                    `}
                                                        >
                                                            <span className="font-medium text-sm">{day.label[language as 'en' | 'ar']}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div className="space-y-3">
                                                <Label className="text-base">{isRTL ? 'وقت البداية' : 'Start Time'}</Label>
                                                <Input
                                                    type="time"
                                                    value={formData.schedule_time}
                                                    onChange={e => setFormData({ ...formData, schedule_time: e.target.value })}
                                                    className="h-12"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-base">{isRTL ? 'وقت الانتهاء' : 'End Time'}</Label>
                                                <Input
                                                    type="time"
                                                    value={formData.schedule_end_time}
                                                    onChange={e => setFormData({ ...formData, schedule_end_time: e.target.value })}
                                                    className="h-12"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-base">{isRTL ? 'عدد المحاضرات' : 'Total Lectures'}</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={formData.total_lectures}
                                                    onChange={e => setFormData({ ...formData, total_lectures: parseInt(e.target.value) || 1 })}
                                                    className="h-12"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-base">{isRTL ? 'تاريخ البداية' : 'Start Date'}</Label>
                                                <Input
                                                    type="date"
                                                    value={formData.start_date}
                                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                                    className="h-12"
                                                />
                                            </div>
                                        </div>

                                        {/* Additional Details */}
                                        <div className="space-y-4 pt-4 border-t">
                                                {/* Interview */}
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg bg-card">
                                                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                                                        <Checkbox
                                                            checked={formData.has_interview}
                                                            onCheckedChange={(checked) => setFormData({ ...formData, has_interview: !!checked })}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="text-base font-medium">{isRTL ? 'يوجد انترفيو لهذا الكورس' : 'This course has an interview'}</span>
                                                    </label>
                                                    {formData.has_interview && (
                                                        <div className="w-full sm:w-auto sm:min-w-[180px]">
                                                            <Input
                                                                type="date"
                                                                value={formData.interview_date}
                                                                onChange={e => setFormData({ ...formData, interview_date: e.target.value })}
                                                                className="h-10 w-full"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Certificates */}
                                                <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                                                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                                                        <Checkbox
                                                            checked={formData.has_certificates}
                                                            onCheckedChange={(checked) => setFormData({ ...formData, has_certificates: !!checked })}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="text-base font-medium">{isRTL ? 'يوجد شهادات لهذا الكورس؟' : 'Does this course have certificates?'}</span>
                                                    </label>
                                                </div>

                                                {/* Organizers */}
                                                <div className="space-y-3 pt-2 border-t">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-base font-semibold flex items-center gap-2">
                                                            <Users className="w-4 h-4" />
                                                            {isRTL ? 'المنظمون' : 'Organizers'}
                                                        </Label>
                                                        <Popover open={organizerPopoverOpen} onOpenChange={setOrganizerPopoverOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-8">
                                                                    <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                                                    {isRTL ? 'إضافة منظم' : 'Add Organizer'}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-80 p-0" align="end">
                                                                <Command>
                                                                    <CommandInput placeholder={isRTL ? 'ابحث عن متطوع...' : 'Search volunteer...'} />
                                                                    <CommandList>
                                                                        <CommandEmpty>{isRTL ? 'لا توجد نتائج' : 'No results'}</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {volunteers.map(v => (
                                                                                <CommandItem
                                                                                    key={v.id}
                                                                                    value={isRTL && v.full_name_ar ? v.full_name_ar : v.full_name}
                                                                                    onSelect={() => handleAddOrganizer(v)}
                                                                                    className="flex items-center gap-2 py-2"
                                                                                >
                                                                                    <Avatar className="h-7 w-7">
                                                                                        <AvatarImage src={v.avatar_url || undefined} />
                                                                                        <AvatarFallback className="text-xs">{v.full_name.charAt(0)}</AvatarFallback>
                                                                                    </Avatar>
                                                                                    <span>{isRTL && v.full_name_ar ? v.full_name_ar : v.full_name}</span>
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    {organizers.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {organizers.map((org, i) => (
                                                                <div key={i} className="flex items-center gap-2 bg-muted border rounded-full px-3 py-1 text-sm">
                                                                    <span>{org.name}</span>
                                                                    <button onClick={() => removeOrganizer(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">{isRTL ? 'لم يتم إضافة منظمين' : 'No organizers added'}</p>
                                                    )}
                                                </div>

                                                {/* Marketers */}
                                                <div className="space-y-3 pt-2 border-t">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-base font-semibold flex items-center gap-2">
                                                            <Megaphone className="w-4 h-4" />
                                                            {isRTL ? 'المسوقون' : 'Marketers'}
                                                        </Label>
                                                        <Popover open={marketerPopoverOpen} onOpenChange={setMarketerPopoverOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-8">
                                                                    <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                                                    {isRTL ? 'إضافة مسوق' : 'Add Marketer'}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-80 p-0" align="end">
                                                                <Command>
                                                                    <CommandInput placeholder={isRTL ? 'ابحث عن متطوع...' : 'Search volunteer...'} />
                                                                    <CommandList>
                                                                        <CommandEmpty>{isRTL ? 'لا توجد نتائج' : 'No results'}</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {volunteers.map(v => (
                                                                                <CommandItem
                                                                                    key={v.id}
                                                                                    value={isRTL && v.full_name_ar ? v.full_name_ar : v.full_name}
                                                                                    onSelect={() => handleAddMarketer(v)}
                                                                                    className="flex items-center gap-2 py-2"
                                                                                >
                                                                                    <Avatar className="h-7 w-7">
                                                                                        <AvatarImage src={v.avatar_url || undefined} />
                                                                                        <AvatarFallback className="text-xs">{v.full_name.charAt(0)}</AvatarFallback>
                                                                                    </Avatar>
                                                                                    <span>{isRTL && v.full_name_ar ? v.full_name_ar : v.full_name}</span>
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    {marketers.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {marketers.map((mkt, i) => (
                                                                <div key={i} className="flex items-center gap-2 bg-muted border rounded-full px-3 py-1 text-sm">
                                                                    <span>{mkt.name}</span>
                                                                    <button onClick={() => removeMarketer(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">{isRTL ? 'لم يتم إضافة مسوقين' : 'No marketers added'}</p>
                                                    )}
                                                </div>

                                                {/* Ads Planning Section */}
                                                <div className="space-y-3 pt-2 border-t">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-base font-semibold flex items-center gap-2">
                                                            <Calendar className="w-4 h-4" />
                                                            {isRTL ? 'خطة الدعايا' : 'Ads Planning'}
                                                        </Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-8">
                                                                    <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                                    {isRTL ? 'إضافة موعد إعلان' : 'Add Ad Date'}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="end">
                                                                <CalendarComponent
                                                                    mode="single"
                                                                    selected={undefined}
                                                                    onSelect={(date) => {
                                                                        if (date) {
                                                                            const dateStr = format(date, 'yyyy-MM-dd');
                                                                            if (formData.start_date && dateStr > formData.start_date) {
                                                                                toast.error(isRTL ? 'لا يمكن اختيار موعد بعد تاريخ البداية' : 'Cannot select date after start date');
                                                                                return;
                                                                            }
                                                                            if (!plannedAds.includes(dateStr)) {
                                                                                setPlannedAds(prev => [...prev, dateStr].sort());
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={(date) => formData.start_date ? format(date, 'yyyy-MM-dd') > formData.start_date : false}
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>

                                                    {plannedAds.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                            {plannedAds.map((date, index) => (
                                                                <div key={`${date}-${index}`} className="flex items-center justify-between p-2 bg-muted rounded-md border text-sm">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline" className="h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs">
                                                                            {index + 1}
                                                                        </Badge>
                                                                        <span className="font-medium">{date}</span>
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                                                        onClick={() => setPlannedAds(prev => prev.filter((_, i) => i !== index))}
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center p-4 border border-dashed rounded-lg text-muted-foreground text-sm">
                                                            {isRTL ? 'لم يتم تحديد مواعيد إعلانات' : 'No ad dates scheduled'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                    </div>
                                </div>

                                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                                    <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }} className="h-12 px-6 w-full sm:w-auto">{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                                    <Button onClick={handleCreateCourse} className="h-12 px-6 w-full sm:w-auto">{isRTL ? 'إنشاء الكورس' : 'Create Course'}</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* Search, Filter, and Sort Bar */}
            <div className="flex flex-col md:flex-row items-center gap-3 bg-card p-3 sm:p-4 rounded-xl border shadow-sm mb-6">
                {/* Text Search Input */}
                <div className="relative w-full md:flex-1">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={isRTL ? 'بحث عن كورس أو اسم المدرب...' : 'Search course or trainer name...'}
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        className="ltr:pl-9 ltr:pr-9 rtl:pr-9 rtl:pl-9 h-10 bg-background"
                    />
                    {filterSearch && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute ltr:right-1.5 rtl:left-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-transparent"
                            onClick={() => setFilterSearch('')}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Date Popover (Month Picker) */}
                <div className="relative w-full md:w-auto">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full md:w-[220px] justify-start text-start font-normal h-10 bg-background border border-input",
                                    filterDate ? (isRTL ? "pl-9" : "pr-9") : "",
                                    !filterDate && "text-muted-foreground"
                                )}
                            >
                                <Calendar className="ltr:mr-2 rtl:ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                {filterDate ? (
                                    format(new Date(filterDate), "LLLL yyyy", { locale: isRTL ? ar : undefined })
                                ) : (
                                    <span>{isRTL ? 'تصفية بالشهر' : 'Filter by month'}</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <MonthPicker
                                selected={filterDate ? new Date(filterDate) : undefined}
                                onSelect={(date) => {
                                    setFilterDate(format(date, 'yyyy-MM-dd'));
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                    {filterDate && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute ltr:right-1.5 rtl:left-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-transparent"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFilterDate('');
                            }}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Sorting Select */}
                <div className="w-full md:w-[220px]">
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-10 bg-background border border-input">
                            <SelectValue placeholder={isRTL ? 'ترتيب حسب' : 'Sort by'} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date-desc">{isRTL ? 'الأحدث تاريخاً' : 'Newest'}</SelectItem>
                            <SelectItem value="date-asc">{isRTL ? 'الأقدم تاريخاً' : 'Oldest'}</SelectItem>
                            <SelectItem value="name-asc">{isRTL ? 'الاسم (أ-ي)' : 'Name (A-Z)'}</SelectItem>
                            <SelectItem value="name-desc">{isRTL ? 'الاسم (ي-أ)' : 'Name (Z-A)'}</SelectItem>
                            <SelectItem value="lectures-desc">{isRTL ? 'الأكثر محاضرات متبقية' : 'Most lectures remaining'}</SelectItem>
                            <SelectItem value="lectures-asc">{isRTL ? 'الأقل محاضرات متبقية' : 'Least lectures remaining'}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Course Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeCourses.map(course => {
                    const remainingLectures = Math.max(0, course.total_lectures - (course.course_lectures?.filter(l => l.status === 'completed').length || 0));
                    const isFinished = remainingLectures === 0;
                    return (
                        <Card
                            key={course.id}
                            className={`transition-all ${isFinished ? 'opacity-80 hover:opacity-100 bg-muted/10' : ''}`}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <CardTitle className="text-lg">{course.name}</CardTitle>
                                            {isFinished && (
                                                <Badge variant="secondary" className="bg-muted-foreground/15 text-muted-foreground border-none text-[10px] h-5">
                                                    {isRTL ? 'منتهي' : 'Ended'}
                                                </Badge>
                                            )}
                                            {/* No Organizers Warning */}
                                            {(!course.course_organizers || course.course_organizers.length === 0) && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="cursor-help">
                                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{isRTL ? 'لا يوجد منظمين لهذا الكورس' : 'No organizers assigned'}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            {course.has_certificates && (() => {
                                                // Check if all lectures are completed
                                                const lectureStatuses = course.course_lectures || [];
                                                const allCompleted = lectureStatuses.length > 0 &&
                                                    lectureStatuses.every((lecture) => lecture.status === 'completed' || lecture.status === 'cancelled');

                                                // Only show if all lectures are done
                                                if (!allCompleted) return null;

                                                return (
                                                    <Badge variant={
                                                        course.certificate_status === 'delivered' ? 'default' :
                                                            course.certificate_status === 'ready' ? 'secondary' :
                                                                'outline'
                                                    } className="text-[10px] h-5">
                                                        {isRTL ?
                                                            (course.certificate_status === 'printing' ? 'جاري الطباعة' :
                                                                course.certificate_status === 'ready' ? 'جاهزة للتسليم' :
                                                                    course.certificate_status === 'delivered' ? 'تم التسليم' : 'انتظار')
                                                            : (course.certificate_status || 'Pending')
                                                        }
                                                    </Badge>
                                                );
                                            })()}
                                        </div>
                                        <CardDescription>
                                            {course.course_trainers && course.course_trainers.length > 0
                                                ? course.course_trainers.map(ct => isRTL ? ct.trainers?.name_ar : ct.trainers?.name_en).filter(Boolean).join(' · ')
                                                : course.trainer_name
                                            }
                                        </CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {!roles.includes('head_marketing') && (
                                                <DropdownMenuItem onClick={() => openCourseDetails(course)}>
                                                    <BookOpen className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'التفاصيل والحضور' : 'Details & Attendance'}
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => exportCourseToExcel(course)}>
                                                <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'تصدير Excel' : 'Export Excel'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openEditDialog(course)}>
                                                <Pencil className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'تعديل' : 'Edit'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openMarketingDialog(course)}>
                                                <Megaphone className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'إدارة التسويق' : 'Marketing Mgmt'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setCourseToDelete(course);
                                                    setIsDeleteDialogOpen(true);
                                                }}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'حذف' : 'Delete'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="w-4 h-4" />
                                        <span>{getRoomLabel(course.room)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Calendar className="w-4 h-4" />
                                        <span>{getDaysLabel(course.schedule_days)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        <span>{formatTime(course.schedule_time)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <BookOpen className="w-4 h-4" />
                                        <span>{course.total_lectures} {isRTL ? 'محاضرة' : 'lectures'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        <span>
                                            {isRTL ? 'متبقي: ' : 'Remaining: '}
                                            {Math.max(0, course.total_lectures - (course.course_lectures?.filter(l => l.status === 'completed').length || 0))}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {activeCourses.length === 0 && courses.length > 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-muted-foreground">
                        <Search className="w-12 h-12 mb-2 opacity-20" />
                        <p className="font-medium">{isRTL ? 'لا توجد كورسات تطابق الفلتر' : 'No courses match your filter'}</p>
                        <p className="text-sm mt-1 opacity-70">
                            {isRTL ? 'جرب تغيير الشهر أو كلمة البحث' : 'Try changing the month or search term'}
                        </p>
                    </div>
                )}
                {courses.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-muted-foreground">
                        <BookOpen className="w-12 h-12 mb-2 opacity-20" />
                        <p>{isRTL ? 'لا توجد كورسات' : 'No courses yet'}</p>
                    </div>
                )}
            </div>

            {/* Ads Overview & Management */}
            <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Calendar Overview */}
                <CourseAdsTable ads={allAds} title={isRTL ? 'تقويم الإعلانات' : 'Ads Calendar'} />

                {/* Management Grid */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b pb-4">
                        <Clock className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold">{isRTL ? 'إدارة الإعلانات' : 'Ads Management'}</h2>
                    </div>

                    {allAds.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {allAds.map((ad) => (
                                <Card key={ad.id} className="relative overflow-hidden group hover:shadow-md transition-shadow">
                                    <div className={`absolute top-0 w-full h-1 ${ad.poster_done && ad.content_done ? 'bg-green-500' : 'bg-primary/20'}`} />
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-xs text-muted-foreground block mb-1">
                                                    {ad.course?.name}
                                                </span>
                                                <CardTitle className="text-lg">
                                                    {isRTL ? 'إعلان رقم' : 'Ad #'} {ad.ad_number}
                                                </CardTitle>
                                            </div>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{isRTL ? 'حذف الإعلان' : 'Delete Ad'}</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {isRTL
                                                                ? `هل أنت متأكد من حذف الإعلان رقم ${ad.ad_number}؟`
                                                                : `Are you sure you want to delete ad #${ad.ad_number}?`}
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDeleteAd(ad.id)}
                                                            className="bg-destructive hover:bg-destructive/90"
                                                        >
                                                            {isRTL ? 'حذف' : 'Delete'}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">{isRTL ? 'تاريخ النشر' : 'Publish Date'}</Label>
                                            <Input
                                                type="date"
                                                value={ad.ad_date}
                                                onChange={(e) => handleUpdateAdDate(ad.id, e.target.value)}
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <Button
                                                variant={ad.poster_done ? "default" : "outline"}
                                                size="sm"
                                                className={`w-full ${ad.poster_done ? "bg-green-600 hover:bg-green-700" : ""}`}
                                                onClick={() => handleUpdateAd(ad.id, { poster_done: !ad.poster_done })}
                                            >
                                                {ad.poster_done ? <Check className="h-3 w-3 mr-1" /> : null}
                                                {isRTL ? 'البوستر' : 'Poster'}
                                            </Button>
                                            <Button
                                                variant={ad.content_done ? "default" : "outline"}
                                                size="sm"
                                                className={`w-full ${ad.content_done ? "bg-green-600 hover:bg-green-700" : ""}`}
                                                onClick={() => handleUpdateAd(ad.id, { content_done: !ad.content_done })}
                                            >
                                                {ad.content_done ? <Check className="h-3 w-3 mr-1" /> : null}
                                                {isRTL ? 'المحتوى' : 'Content'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-0 text-xs text-muted-foreground flex justify-between">
                                        {ad.updater && (
                                            <span className="flex items-center gap-1 opacity-70">
                                                <User className="h-3 w-3" />
                                                {isRTL ? ad.updater.full_name_ar : ad.updater.full_name}
                                            </span>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-muted-foreground">
                            <Calendar className="w-12 h-12 mb-2 opacity-20" />
                            <p>{isRTL ? 'لا توجد إعلانات مخططة للكورسات الحالية' : 'No ads scheduled for active courses'}</p>
                        </div>
                    )}
                </div>
            </div>


            {/* Edit Course Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="w-[95vw] sm:max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{isRTL ? 'تعديل الكورس' : 'Edit Course'}</DialogTitle>
                        <DialogDescription>{isRTL ? 'تعديل بيانات الكورس' : 'Edit course details'}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        {/* Course Name & Room */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label className="text-base">{isRTL ? 'اسم الكورس *' : 'Course Name *'}</Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-base">{isRTL ? 'القاعة *' : 'Room *'}</Label>
                                <Select value={formData.room} onValueChange={val => setFormData({ ...formData, room: val })}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rooms.map(room => (
                                            <SelectItem key={room.value} value={room.value} className="py-3">
                                                {room.label[language as 'en' | 'ar']}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Committee Selection */}
                        <div className="space-y-3">
                            <Label className="text-base">{isRTL ? 'اللجنة' : 'Committee'}</Label>
                            <Select
                                value={formData.committee_id || ''}
                                onValueChange={val => setFormData({ ...formData, committee_id: val })}
                                disabled={isRestricted}
                            >
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder={isRTL ? 'اختر اللجنة' : 'Select Committee'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {committees
                                        .filter(c => c.committee_type === 'production')
                                        .map(committee => (
                                            <SelectItem key={committee.id} value={committee.id} className="py-3">
                                                {isRTL ? committee.name_ar : committee.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Trainer Info — Multi */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">{isRTL ? 'المدربون' : 'Trainers'}</Label>
                            </div>


                            <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2 min-h-[48px] p-2 border rounded-md bg-background items-center transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                                        {courseTrainers.length > 0 ? (
                                            courseTrainers.map(ct => {
                                                const tr = ct.trainer || trainers.find(t => t.id === ct.trainer_id);
                                                return (
                                                    <div key={ct.trainer_id} className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-full text-sm">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage src={tr?.image_url || undefined} />
                                                            <AvatarFallback className="text-[10px]">{tr ? (isRTL ? tr.name_ar : tr.name_en).charAt(0) : '?'}</AvatarFallback>
                                                        </Avatar>
                                                        <span>{tr ? (isRTL ? tr.name_ar : tr.name_en) : ct.trainer_id}</span>
                                                        <button type="button" onClick={() => removeCourseTrainer(ct.trainer_id)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <span className="text-sm text-muted-foreground px-2">
                                                {isRTL ? 'لم يتم تحديد مدربين...' : 'No trainers selected...'}
                                            </span>
                                        )}

                                        <Popover open={trainerPopoverOpen} onOpenChange={setTrainerPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground ml-auto" disabled={!formData.committee_id}>
                                                    <Plus className="w-3.5 h-3.5" />
                                                    {isRTL ? 'إضافة مدرب' : 'Add'}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-72 p-0" align="end">
                                                <Command>
                                                    <CommandInput placeholder={isRTL ? 'ابحث عن مدرب...' : 'Search trainer...'} />
                                                    <CommandList>
                                                        <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results'}</CommandEmpty>
                                                        <CommandGroup>
                                                            {trainers
                                                                .filter(t => !courseTrainers.some(ct => ct.trainer_id === t.id))
                                                                .filter(t => !formData.committee_id || t.committee_id === formData.committee_id)
                                                                .map(trainer => (
                                                                    <CommandItem
                                                                        key={trainer.id}
                                                                        onSelect={() => handleAddCourseTrainer(trainer)}
                                                                        className="flex items-center gap-2 cursor-pointer"
                                                                    >
                                                                        <Avatar className="h-7 w-7">
                                                                            <AvatarImage src={trainer.image_url || undefined} />
                                                                            <AvatarFallback className="text-xs">{(isRTL ? trainer.name_ar : trainer.name_en).charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-sm font-medium truncate">{isRTL ? trainer.name_ar : trainer.name_en}</span>
                                                                            {trainer.phone && <span className="text-xs text-muted-foreground" dir="ltr">{trainer.phone}</span>}
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                        </div>

                        {/* Schedule */}
                        <div className="space-y-3">
                            <Label className="text-base">{isRTL ? 'أيام الكورس *' : 'Course Days *'}</Label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:flex md:flex-wrap gap-2">
                                {DAYS.map(day => {
                                    const isSelected = formData.schedule_days.includes(day.value);
                                    return (
                                        <div
                                            key={day.value}
                                            onClick={() => toggleDay(day.value)}
                                            className={`
                                            flex items-center justify-center gap-1 px-2 py-2.5 border rounded-lg cursor-pointer transition-all text-center
                                            ${isSelected
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'hover:bg-accent hover:border-accent-foreground/50 bg-background'
                                                }
                                        `}
                                        >
                                            <span className="font-medium text-sm">{day.label[language as 'en' | 'ar']}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-3">
                                <Label className="text-base">{isRTL ? 'وقت البداية' : 'Start Time'}</Label>
                                <Input
                                    type="time"
                                    value={formData.schedule_time}
                                    onChange={e => setFormData({ ...formData, schedule_time: e.target.value })}
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-base">{isRTL ? 'وقت الانتهاء' : 'End Time'}</Label>
                                <Input
                                    type="time"
                                    value={formData.schedule_end_time}
                                    onChange={e => setFormData({ ...formData, schedule_end_time: e.target.value })}
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-base">{isRTL ? 'عدد المحاضرات' : 'Total Lectures'}</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={formData.total_lectures}
                                    onChange={e => setFormData({ ...formData, total_lectures: parseInt(e.target.value) || 1 })}
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-base">{isRTL ? 'تاريخ البداية' : 'Start Date'}</Label>
                                <Input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    className="h-12"
                                />
                            </div>
                        </div>

                        {/* Interview */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg bg-card">
                            <label className="flex items-center gap-3 cursor-pointer flex-1">
                                <Checkbox
                                    checked={formData.has_interview}
                                    onCheckedChange={(checked) => setFormData({ ...formData, has_interview: !!checked })}
                                    className="h-5 w-5"
                                />
                                <span className="text-base font-medium">{isRTL ? 'يوجد انترفيو لهذا الكورس' : 'This course has an interview'}</span>
                            </label>
                            {formData.has_interview && (
                                <div className="w-full sm:w-auto sm:min-w-[180px]">
                                    <Input
                                        type="date"
                                        value={formData.interview_date}
                                        onChange={e => setFormData({ ...formData, interview_date: e.target.value })}
                                        className="h-10 w-full"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Certificates */}
                        <div className="flex items-center gap-4 p-4 border rounded-lg bg-card mb-6">
                            <label className="flex items-center gap-3 cursor-pointer flex-1">
                                <Checkbox
                                    checked={formData.has_certificates}
                                    onCheckedChange={(checked) => setFormData({ ...formData, has_certificates: !!checked })}
                                    className="h-5 w-5"
                                />
                                <span className="text-base font-medium">{isRTL ? 'يوجد شهادات لهذا الكورس؟' : 'Does this course have certificates?'}</span>
                            </label>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-6">
                        <Button variant="outline" onClick={() => setIsEditOpen(false)} className="h-12 px-6 w-full sm:w-auto mt-2 sm:mt-0">{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button onClick={handleUpdateCourse} className="h-12 px-6 w-full sm:w-auto">{isRTL ? 'حفظ التعديلات' : 'Save Changes'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                {(() => {
                    const filteredTabBeneficiaries = beneficiaries.filter(b => 
                        b.name.toLowerCase().includes(beneficiaryTabSearch.toLowerCase()) ||
                        b.phone.includes(beneficiaryTabSearch) ||
                        (b.national_id && b.national_id.includes(beneficiaryTabSearch))
                    );
                    return (
                        <DialogContent className="w-full h-full sm:w-[calc(100%-1.5rem)] sm:max-w-5xl sm:max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl">
                            <Tabs defaultValue="beneficiaries" className="w-full h-full flex flex-col">
                                <div className="flex flex-col h-full bg-background overflow-hidden">
                                    {/* Sticky Header */}
                                    <div className="border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                                        <DialogHeader className="p-4 sm:p-6 pb-2 text-center sm:text-center flex flex-col items-center justify-center relative">
                                            <DialogTitle className="text-xl sm:text-2xl font-bold flex flex-wrap items-center justify-center gap-2 text-center w-full mt-2 sm:mt-0 px-8">
                                                <span className="truncate max-w-[calc(100%-4rem)]">{selectedCourse?.name}</span>
                                                {selectedCourse?.has_certificates && (
                                                    <Badge variant="outline" className="text-xs shrink-0 font-bold bg-primary/5 text-primary border-primary/20">
                                                        {isRTL ? 'شهادات: ' : 'Certificates: '}
                                                        {isRTL ?
                                                            (selectedCourse.certificate_status === 'pending' ? 'انتظار' :
                                                                selectedCourse.certificate_status === 'printing' ? 'طباعة' :
                                                                    selectedCourse.certificate_status === 'ready' ? 'جاهزة' : 'تم التسليم')
                                                            : selectedCourse.certificate_status
                                                        }
                                                    </Badge>
                                                )}
                                            </DialogTitle>
                                            <DialogDescription className="flex flex-col gap-1 items-center justify-center text-center w-full text-xs sm:text-sm mt-1 font-medium">
                                                <span>
                                                    {selectedCourse?.course_trainers && selectedCourse.course_trainers.length > 0
                                                        ? selectedCourse.course_trainers.map(ct => isRTL ? ct.trainers?.name_ar : ct.trainers?.name_en).filter(Boolean).join(' · ')
                                                        : selectedCourse?.trainer_name
                                                    } - {selectedCourse?.room && getRoomLabel(selectedCourse.room)}
                                                </span>
                                                {detailsOrganizers.length > 0 && (
                                                    <span className="text-xs text-muted-foreground font-semibold">
                                                        {isRTL ? 'المنظمين: ' : 'Organizers: '}
                                                        {detailsOrganizers.map(o => o.name).join(', ')}
                                                    </span>
                                                )}
                                            </DialogDescription>
                                        </DialogHeader>

                                        {/* Tabs Header Selection */}
                                        <div className="px-4 sm:px-6 pb-3">
                                            <div className="overflow-x-auto -mx-2 px-2 pb-0.5 scrollbar-none">
                                                <TabsList className="flex w-full h-auto p-1 bg-muted/50 rounded-xl gap-0.5 xs:gap-1">
                                                    <TabsTrigger
                                                        value="beneficiaries"
                                                        className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                    >
                                                        <span className="flex items-center gap-1.5 justify-center w-full">
                                                            <Users className="w-3.5 h-3.5" />
                                                            <span>{isRTL ? 'المستفيدين' : 'Beneficiaries'}</span>
                                                        </span>
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="lectures"
                                                        className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                    >
                                                        <span className="flex items-center gap-1.5 justify-center w-full">
                                                            <BookOpen className="w-3.5 h-3.5" />
                                                            <span>{isRTL ? 'المحاضرات' : 'Lectures'}</span>
                                                        </span>
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="sheet"
                                                        className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                    >
                                                        <span className="flex items-center gap-1.5 justify-center w-full">
                                                            <TableIcon className="w-3.5 h-3.5" />
                                                            <span>{isRTL ? 'شيت الحضور' : 'Attendance'}</span>
                                                        </span>
                                                    </TabsTrigger>
                                                    {(hasRole('admin') || hasRole('committee_leader') || hasRole('supervisor') || hasRole('head_marketing')) && (
                                                        <TabsTrigger
                                                            value="organizers"
                                                            className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                        >
                                                            <span className="flex items-center gap-1.5 justify-center w-full">
                                                                <UserCheck className="w-3.5 h-3.5" />
                                                                <span>{isRTL ? 'المنظمين' : 'Organizers'}</span>
                                                            </span>
                                                        </TabsTrigger>
                                                    )}
                                                </TabsList>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Scrollable Tabs Content Area */}
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/5 dark:bg-muted/10">
                                        {/* Certificates Section */}
                                        {selectedCourse?.has_certificates && (hasRole('admin') || hasRole('committee_leader') || hasRole('head_marketing') || detailsOrganizers.some(o => o.volunteer_id === user?.id)) && (
                                            <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10 mb-4 shadow-sm">
                                                <CardContent className="p-4">
                                                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-primary">
                                                        <FileSpreadsheet className="w-4 h-4" />
                                                        {isRTL ? 'إدارة الشهادات' : 'Certificates Management'}
                                                    </h3>
                                                    <div className="flex flex-col gap-2">
                                                        <Label className="text-xs text-muted-foreground mb-1 block">
                                                            {isRTL ? 'حالة الشهادات' : 'Certificates Status'}
                                                        </Label>
                                                        <Select
                                                            value={selectedCourse.certificate_status}
                                                            onValueChange={(val) => updateCertificateStatus(selectedCourse.id, val)}
                                                            disabled={!selectedCourse.end_date || new Date(selectedCourse.end_date) > new Date()}
                                                        >
                                                            <SelectTrigger className="h-10 bg-background">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="pending">{isRTL ? 'الكورس لسة مخلصش' : 'Pending (Ongoing)'}</SelectItem>
                                                                <SelectItem value="printing">{isRTL ? 'جاري الطباعة' : 'Printing'}</SelectItem>
                                                                <SelectItem value="ready">{isRTL ? 'جاهزة للتسليم' : 'Ready'}</SelectItem>
                                                                <SelectItem value="delivered">{isRTL ? 'تم التسليم' : 'Delivered'}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {(!selectedCourse.end_date || new Date(selectedCourse.end_date) > new Date()) && (
                                                            <p className="text-[10px] text-destructive mt-1 flex items-center gap-1 font-medium">
                                                                <span>•</span>
                                                                <span>{isRTL ? 'لا يمكن تغيير الحالة قبل انتهاء الكورس' : 'Cannot change status before course ends'}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {/* Beneficiaries Tab */}
                                        <TabsContent value="beneficiaries" className="space-y-4 py-0 outline-none">
                                            {/* Action Bar */}
                                            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                                                <div className="relative w-full sm:w-72">
                                                    <Search className="absolute ltr:left-3 rtl:right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder={isRTL ? 'بحث عن مستفيد...' : 'Search beneficiary...'}
                                                        value={beneficiaryTabSearch}
                                                        onChange={e => setBeneficiaryTabSearch(e.target.value)}
                                                        className="ltr:pl-9 rtl:pr-9 h-9 bg-background"
                                                    />
                                                </div>
                                                <Button
                                                    onClick={() => {
                                                        setEditingBeneficiary(null);
                                                        setNewBeneficiary({ name: '', phone: '', national_id: '' });
                                                        setShowAddForm(!showAddForm);
                                                    }}
                                                    variant={showAddForm ? 'outline' : 'default'}
                                                    className="w-full sm:w-auto h-9"
                                                >
                                                    {showAddForm ? (
                                                        <>
                                                            <X className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                            {isRTL ? 'إلغاء' : 'Cancel'}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                            {isRTL ? 'إضافة مستفيد' : 'Add Beneficiary'}
                                                        </>
                                                    )}
                                                </Button>
                                            </div>

                                            {/* Add Beneficiary Form */}
                                            {showAddForm && (
                                                <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10 transition-all duration-300">
                                                    <CardHeader className="pb-3">
                                                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                                                            <UserPlus className="h-4 w-4" />
                                                            {isRTL ? 'إضافة مستفيد جديد' : 'Add New Beneficiary'}
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="flex flex-col gap-4">
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <div className="space-y-1">
                                                                    <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'الاسم *' : 'Name *'}</label>
                                                                    <Input
                                                                        placeholder={isRTL ? 'الاسم' : 'Name'}
                                                                        value={newBeneficiary.name}
                                                                        onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name: e.target.value })}
                                                                        className="bg-background"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'رقم الهاتف *' : 'Phone *'}</label>
                                                                    <Input
                                                                        placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                                                                        value={newBeneficiary.phone}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (/^[0-9+]*$/.test(val)) {
                                                                                setNewBeneficiary({ ...newBeneficiary, phone: val });
                                                                            }
                                                                        }}
                                                                        className="bg-background"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'الرقم القومي' : 'National ID'}</label>
                                                                    <Input
                                                                        placeholder={isRTL ? 'الرقم القومي' : 'National ID'}
                                                                        value={newBeneficiary.national_id}
                                                                        onChange={(e) => setNewBeneficiary({ ...newBeneficiary, national_id: e.target.value })}
                                                                        className="bg-background"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    onClick={() => setShowAddForm(false)}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                >
                                                                    {isRTL ? 'إلغاء' : 'Cancel'}
                                                                </Button>
                                                                <Button
                                                                    onClick={addBeneficiary}
                                                                    size="sm"
                                                                    className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
                                                                >
                                                                    <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                                                    {isRTL ? 'إضافة' : 'Add'}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Mobile Cards View */}
                                            <div className="grid gap-3 sm:hidden">
                                                {filteredTabBeneficiaries.length === 0 ? (
                                                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                                                        {isRTL ? 'لا يوجد مستفيدين' : 'No beneficiaries found'}
                                                    </div>
                                                ) : (
                                                    filteredTabBeneficiaries.map((b) => {
                                                        const stats = getStudentStats(b.phone);
                                                        return (
                                                            <Card key={b.id} className="border hover:border-primary/20 transition-all bg-card shadow-sm">
                                                                <CardContent className="p-4 flex flex-col gap-3">
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            <Avatar className="h-10 w-10 border border-muted">
                                                                                <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                                    {b.name?.slice(0, 2)}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                            <div>
                                                                                <div className="font-semibold text-xs text-foreground">{b.name}</div>
                                                                                <div className="text-[10px] text-muted-foreground mt-0.5">{b.phone}</div>
                                                                                {b.national_id && <div className="text-[10px] text-muted-foreground">{b.national_id}</div>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col items-end gap-1.5">
                                                                            <div className="text-[10px] font-semibold">
                                                                                <span className={stats.rate >= 80 ? 'text-green-600 dark:text-green-400' : stats.rate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                                                                                    {isRTL ? 'حضور:' : 'Attendance:'} {stats.rate}%
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Progress bar */}
                                                                    <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all ${stats.rate >= 80 ? 'bg-green-500' : stats.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                            style={{ width: `${stats.rate}%` }}
                                                                        />
                                                                    </div>

                                                                    <div className="flex items-center justify-between border-t pt-2 mt-1">
                                                                        <div className="text-[10px] text-muted-foreground">
                                                                            {isRTL ? `حضور: ${stats.attended} • غياب: ${stats.missed}` : `Present: ${stats.attended} • Absent: ${stats.missed}`}
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-8 px-2.5 text-xs font-semibold"
                                                                                onClick={() => {
                                                                                    setEditingBeneficiary(b);
                                                                                    setIsEditStudentDialogOpen(true);
                                                                                }}
                                                                            >
                                                                                <Pencil className="w-3.5 h-3.5 ltr:mr-1 rtl:ml-1" />
                                                                                {isRTL ? 'تعديل' : 'Edit'}
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="h-8 px-2 text-destructive hover:bg-destructive/10"
                                                                                onClick={() => confirmDeleteBeneficiary(b)}
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        );
                                                    })
                                                )}
                                            </div>

                                            {/* Desktop View Table */}
                                            <div className="hidden sm:block border rounded-xl overflow-hidden shadow-sm bg-card">
                                                <Table>
                                                    <TableHeader className="bg-muted/40">
                                                        <TableRow>
                                                            <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                            <TableHead>{isRTL ? 'رقم الهاتف' : 'Phone'}</TableHead>
                                                            <TableHead>{isRTL ? 'الرقم القومي' : 'National ID'}</TableHead>
                                                            <TableHead className="text-center">{isRTL ? 'إحصائيات الحضور' : 'Attendance Stats'}</TableHead>
                                                            <TableHead className="w-28 text-center">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {filteredTabBeneficiaries.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                                    {isRTL ? 'لا يوجد مستفيدين' : 'No beneficiaries found'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            filteredTabBeneficiaries.map((b) => {
                                                                const stats = getStudentStats(b.phone);
                                                                return (
                                                                    <TableRow key={b.id} className="hover:bg-muted/20 transition-colors">
                                                                        <TableCell>
                                                                            <div className="flex items-center gap-3">
                                                                                <Avatar className="h-8 w-8 border border-muted">
                                                                                    <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                                        {b.name?.slice(0, 2)}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                                <div className="font-semibold text-xs text-foreground">{b.name}</div>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs font-mono text-muted-foreground">{b.phone}</TableCell>
                                                                        <TableCell className="text-xs text-muted-foreground">{b.national_id || '-'}</TableCell>
                                                                        <TableCell>
                                                                            <div className="flex flex-col items-center justify-center gap-1.5 max-w-[150px] mx-auto">
                                                                                <div className="flex justify-between items-center w-full text-[10px]">
                                                                                    <span className="font-bold text-muted-foreground">{isRTL ? `نسبة: ${stats.rate}%` : `Rate: ${stats.rate}%`}</span>
                                                                                    <span className="text-[9px] text-muted-foreground">
                                                                                        {isRTL 
                                                                                            ? `حضر ${stats.attended}/${lectures.filter(l => l.status === 'completed').length}` 
                                                                                            : `${stats.attended}/${lectures.filter(l => l.status === 'completed').length} attended`}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="w-full bg-muted/80 h-1 rounded-full overflow-hidden">
                                                                                    <div
                                                                                        className={`h-full rounded-full transition-all ${stats.rate >= 80 ? 'bg-green-500' : stats.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                                        style={{ width: `${stats.rate}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="flex gap-1 justify-center">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    className="h-8 w-8 p-0"
                                                                                    onClick={() => {
                                                                                        setEditingBeneficiary(b);
                                                                                        setIsEditStudentDialogOpen(true);
                                                                                    }}
                                                                                >
                                                                                    <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                                                    onClick={() => confirmDeleteBeneficiary(b)}
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {isRTL ? `إجمالي المستفيدين: ${beneficiaries.length}` : `Total beneficiaries: ${beneficiaries.length}`}
                                            </div>
                                        </TabsContent>

                        {/* Lectures Tab */}
                        <TabsContent value="lectures" className="space-y-4 py-4">
                            {lectures.map(lecture => (
                                <Card key={lecture.id}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-base">
                                                {isRTL ? 'محاضرة' : 'Lecture'} {lecture.lecture_number}
                                            </CardTitle>
                                            <Badge variant={
                                                lecture.status === 'cancelled' ? 'destructive' :
                                                    lecture.status === 'completed' ? 'default' : 'secondary'
                                            }>
                                                {lecture.status === 'completed' ? (isRTL ? 'تمت' : 'Completed') :
                                                    lecture.status === 'cancelled' ? (isRTL ? 'ملغية' : 'Cancelled') :
                                                        (isRTL ? 'مجدولة' : 'Scheduled')}
                                            </Badge>
                                        </div>
                                        <CardDescription>
                                            {lecture.date}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                                            <div className="text-sm text-muted-foreground">
                                                {attendanceData[lecture.id]?.length || 0} / {beneficiaries.length} {isRTL ? 'حضور' : 'attendees'}
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                <Button
                                                    size="sm"
                                                    variant={lecture.status === 'completed' ? 'outline' : 'secondary'}
                                                    onClick={() => updateLectureStatus(lecture.id, 'completed')}
                                                    className="flex-1 sm:flex-none"
                                                >
                                                    <Check className="w-4 h-4 ltr:mr-1 rtl:ml-1 sm:ltr:mr-2 sm:rtl:ml-2" />
                                                    <span className="text-xs sm:text-sm">{isRTL ? 'إتمام' : 'Complete'}</span>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={lecture.status === 'cancelled' ? 'outline' : 'destructive'}
                                                    onClick={() => updateLectureStatus(lecture.id, 'cancelled')}
                                                    className="flex-1 sm:flex-none"
                                                >
                                                    <X className="w-4 h-4 ltr:mr-1 rtl:ml-1 sm:ltr:mr-2 sm:rtl:ml-2" />
                                                    <span className="text-xs sm:text-sm">{isRTL ? 'إلغاء' : 'Cancel'}</span>
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Quick Attendance Checkboxes */}
                                        {isLectureOpen(lecture.date) && lecture.status !== 'cancelled' && beneficiaries.length > 0 && (
                                            <div className="border rounded-lg p-3 bg-muted/20">
                                                <p className="text-sm font-medium mb-2">{isRTL ? 'تسجيل الحضور:' : 'Mark Attendance:'}</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {beneficiaries.map(b => {
                                                        const isPresent = attendanceData[lecture.id]?.some(a => a.student_phone === b.phone);
                                                        return (
                                                            <label
                                                                key={b.id}
                                                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isPresent ? 'bg-green-100 dark:bg-green-900/30' : 'hover:bg-accent'}`}
                                                            >
                                                                <Checkbox
                                                                    checked={isPresent}
                                                                    onCheckedChange={() => toggleBeneficiaryAttendance(lecture.id, b)}
                                                                />
                                                                <span className="text-sm truncate">{b.name}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {beneficiaries.length === 0 && isLectureOpen(lecture.date) && lecture.status !== 'cancelled' && (
                                            <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">
                                                {isRTL ? 'أضف مستفيدين أولاً من تبويب "المستفيدين"' : 'Add beneficiaries first from the "Beneficiaries" tab'}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}</TabsContent>

                        <TabsContent value="sheet" className="py-4 outline-none">
                            {/* Desktop View Table */}
                            <div className="hidden sm:block border rounded-xl overflow-hidden shadow-sm bg-card">
                                <div className="overflow-x-auto">
                                    <div className="overflow-x-auto w-full">
                                        <Table>
                                            <TableHeader className="bg-muted/40">
                                                <TableRow>
                                                    <TableHead className="min-w-[200px] whitespace-nowrap sticky left-0 z-10 bg-background shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#1f2937]">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'الرقم' : 'Phone'}</TableHead>
                                                    {lectures.map(l => (
                                                        <TableHead key={l.id} className="text-center w-12 whitespace-nowrap">
                                                            L{l.lecture_number}
                                                        </TableHead>
                                                    ))}
                                                    <TableHead className="text-center whitespace-nowrap">{isRTL ? 'حضر' : 'Attended'}</TableHead>
                                                    <TableHead className="text-center whitespace-nowrap">{isRTL ? 'غاب' : 'Missed'}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {beneficiaries.map(beneficiary => {
                                                    const studentAttendance = lectures.map(l =>
                                                        attendanceData[l.id]?.find(a => a.student_phone === beneficiary.phone)
                                                    );
                                                    const attendedCount = studentAttendance.filter(a => a && a.status === 'present').length;
                                                    const completedLectures = lectures.filter(l => l.status === 'completed');
                                                    const missedCount = completedLectures.filter(l =>
                                                        !attendanceData[l.id]?.find(a => a.student_phone === beneficiary.phone)
                                                    ).length;

                                                    return (
                                                        <TableRow key={beneficiary.id}>
                                                            <TableCell className="font-medium whitespace-nowrap sticky left-0 z-10 bg-background shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#1f2937]">{beneficiary.name}</TableCell>
                                                            <TableCell className="whitespace-nowrap font-mono" dir="ltr">
                                                                <div className="flex items-center gap-1">
                                                                    <span>{beneficiary.phone}</span>
                                                                    {beneficiary.phone && (
                                                                        <a
                                                                            href={`https://wa.me/${beneficiary.phone.replace(/\D/g, '')}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-green-500 hover:text-green-600 transition-colors p-1"
                                                                            title={isRTL ? 'مراسلة عبر واتساب' : 'Chat on WhatsApp'}
                                                                        >
                                                                            <MessageSquare className="w-4 h-4" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            {lectures.map((lecture, idx) => {
                                                                const isPresent = attendanceData[lecture.id]?.some(a => a.student_phone === beneficiary.phone && a.status === 'present');
                                                                const isCancelled = lecture.status === 'cancelled';
                                                                const isCompleted = lecture.status === 'completed';
                                                                const isOpen = isLectureOpen(lecture.date);
                                                                const canMarkAttendance = isCompleted || isOpen;
                                                                return (
                                                                    <TableCell key={idx} className="text-center">
                                                                        {isCancelled ? (
                                                                            <span className="text-muted-foreground text-xs">-</span>
                                                                        ) : canMarkAttendance ? (
                                                                            <Checkbox
                                                                                checked={isPresent}
                                                                                onCheckedChange={() => toggleBeneficiaryAttendance(lecture.id, beneficiary)}
                                                                                className="mx-auto"
                                                                            />
                                                                        ) : (
                                                                            <span className="text-muted-foreground text-xs">-</span>
                                                                        )}
                                                                    </TableCell>
                                                                );
                                                            })}
                                                            <TableCell className="text-center font-bold text-green-600 whitespace-nowrap">{attendedCount}</TableCell>
                                                            <TableCell className="text-center font-bold text-red-600 whitespace-nowrap">{missedCount}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                                {beneficiaries.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={lectures.length + 4} className="text-center py-8 text-muted-foreground whitespace-nowrap">
                                                            {isRTL ? 'لا يوجد مستفيدين - أضف مستفيدين من تبويب المستفيدين أولاً' : 'No beneficiaries - Add beneficiaries from the Beneficiaries tab first'}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile View - Student Cards with detailed history dialog */}
                            <div className="sm:hidden space-y-3">
                                {beneficiaries.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed text-xs">
                                        {isRTL ? 'لا يوجد مستفيدين - أضف مستفيدين من تبويب المستفيدين أولاً' : 'No beneficiaries - Add beneficiaries from the Beneficiaries tab first'}
                                    </div>
                                ) : (
                                    beneficiaries.map(beneficiary => {
                                        const stats = getStudentStats(beneficiary.phone);
                                        return (
                                            <Card key={beneficiary.id} className="border hover:border-primary/20 transition-all bg-card shadow-sm">
                                                <CardContent className="p-4 flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border border-muted">
                                                                <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                    {beneficiary.name?.slice(0, 2)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-semibold text-xs text-foreground">{beneficiary.name}</div>
                                                                <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1" dir="ltr">
                                                                    <span>{beneficiary.phone || '-'}</span>
                                                                    {beneficiary.phone && (
                                                                        <a
                                                                            href={`https://wa.me/${beneficiary.phone.replace(/\D/g, '')}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-green-500 hover:text-green-600 transition-colors p-0.5"
                                                                            title={isRTL ? 'مراسلة عبر واتساب' : 'Chat on WhatsApp'}
                                                                        >
                                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className={`text-xs px-2 py-0.5 rounded-full ${stats.rate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : stats.rate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                            {stats.rate}%
                                                        </Badge>
                                                    </div>

                                                    <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-dashed pt-3 mt-1">
                                                        <div>
                                                            {isRTL ? `حضور: ${stats.attended} | غياب: ${stats.missed}` : `Present: ${stats.attended} | Absent: ${stats.missed}`}
                                                        </div>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-8 text-xs font-semibold"
                                                            onClick={() => {
                                                                setHistoryStudent(beneficiary);
                                                                setIsHistoryDialogOpen(true);
                                                            }}
                                                        >
                                                            {isRTL ? 'تعديل سجل الحضور' : 'Edit History'}
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        </TabsContent>
                        {(hasRole('admin') || hasRole('committee_leader') || hasRole('supervisor') || hasRole('head_marketing')) && (
                            <TabsContent value="organizers" className="space-y-4 py-4">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">{isRTL ? 'إدارة المنظمين' : 'Manage Organizers'}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <Popover open={detailsOrganizerPopoverOpen} onOpenChange={setDetailsOrganizerPopoverOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start text-sm">
                                                        <Search className="w-4 h-4 ltr:mr-2 rtl:ml-2 shrink-0" />
                                                        <span className="truncate">{isRTL ? 'إضافة منظم...' : 'Add organizer...'}</span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder={isRTL ? 'بحث عن متطوع أو رقم الهاتف...' : 'Search volunteer or phone...'} />
                                                        <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                                                            <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results found'}</CommandEmpty>
                                                            <CommandGroup>
                                                                {volunteers.map(volunteer => {
                                                                    const isSelected = detailsOrganizers.some(o => o.volunteer_id === volunteer.id);
                                                                    return (
                                                                        <CommandItem
                                                                            key={volunteer.id}
                                                                            value={`${volunteer.full_name} ${volunteer.full_name_ar || ''} ${volunteer.phone || ''}`}
                                                                            onSelect={() => {
                                                                                if (!isSelected) {
                                                                                    handleAddOrganizerToDetails(volunteer);
                                                                                }
                                                                                setDetailsOrganizerPopoverOpen(false);
                                                                            }}
                                                                        >
                                                                            <div className="flex items-center gap-2 w-full">
                                                                                <Avatar className="h-8 w-8">
                                                                                    <AvatarImage src={volunteer.avatar_url || undefined} />
                                                                                    <AvatarFallback>{(volunteer.full_name?.[0] || '?').toUpperCase()}</AvatarFallback>
                                                                                </Avatar>
                                                                                <div className="flex flex-col flex-1">
                                                                                    <span className={isSelected ? 'text-muted-foreground' : ''}>
                                                                                        {isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name}
                                                                                    </span>
                                                                                    <span className="text-xs text-muted-foreground">{volunteer.phone}</span>
                                                                                </div>
                                                                                {isSelected && (
                                                                                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                                                                                )}
                                                                            </div>
                                                                        </CommandItem>
                                                                    );
                                                                })}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>

                                            <div className="border rounded-lg overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                                                <div className="overflow-x-auto w-full">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="whitespace-nowrap text-start">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                                <TableHead className="whitespace-nowrap text-start">{isRTL ? 'الرقم' : 'Phone'}</TableHead>
                                                                <TableHead className="w-12 whitespace-nowrap"></TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {detailsOrganizers.map(org => (
                                                                <TableRow key={org.id}>
                                                                    <TableCell className="whitespace-nowrap text-start">{org.name}</TableCell>
                                                                    <TableCell className="whitespace-nowrap text-start font-mono text-sm" dir="ltr">{org.phone}</TableCell>
                                                                    <TableCell className="whitespace-nowrap text-center">
                                                                        <Button size="sm" variant="ghost" onClick={() => handleRemoveOrganizerFromDetails(org.id!)}>
                                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                            {detailsOrganizers.length === 0 && (
                                                                <TableRow>
                                                                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground whitespace-nowrap">
                                                                        {isRTL ? 'لا يوجد منظمين' : 'No organizers'}
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}
                                    </div>
                                </div>
                            </Tabs>
                        </DialogContent>
                    );
                })()}
            </Dialog>

            {/* Delete Confirmation Dialog */}
            < AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Deletion'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? `هل أنت متأكد من حذف الكورس "${courseToDelete?.name}"؟ سيتم حذف جميع المحاضرات والحضور المسجل.`
                                : `Are you sure you want to delete the course "${courseToDelete?.name}"? All lectures and attendance records will be deleted.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCourse}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? (isRTL ? 'جاري الحذف...' : 'Deleting...') : (isRTL ? 'حذف' : 'Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >
            <Dialog open={isMarketingDialogOpen} onOpenChange={setIsMarketingDialogOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {isRTL ? 'إدارة التسويق - ' : 'Marketing Management - '}
                            {selectedMarketingCourse?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'متابعة خطة النشر والإعلانات للكورس' : 'Manage course publication plan and ads'}
                            {selectedMarketingCourse && (
                                <span className="block mt-1 text-xs">
                                    {isRTL ? 'تاريخ النشر يجب أن يكون قبل: ' : 'Publish date must be before: '}
                                    <strong>
                                        {selectedMarketingCourse.has_interview && selectedMarketingCourse.interview_date
                                            ? format(new Date(selectedMarketingCourse.interview_date), 'yyyy-MM-dd')
                                            : selectedMarketingCourse.start_date}
                                    </strong>
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-6">
                        {/* Marketing Team Section */}
                        <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Megaphone className="w-4 h-4 text-primary" />
                                <h3 className="text-base font-semibold">{isRTL ? 'فريق التسويق' : 'Marketing Team'}</h3>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-sm h-10">
                                        <Search className="w-4 h-4 ltr:mr-2 rtl:ml-2 shrink-0" />
                                        <span className="truncate">{isRTL ? 'إضافة مسوق...' : 'Add marketer...'}</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
                                        <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                                            <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results found'}</CommandEmpty>
                                            <CommandGroup>
                                                {volunteers.slice(0, 50).map(volunteer => (
                                                    <CommandItem
                                                        key={volunteer.id}
                                                        value={`${volunteer.full_name} ${volunteer.full_name_ar || ''}`}
                                                        onSelect={() => handleAddMarketerToDetails(volunteer)}
                                                    >
                                                        <div className="flex items-center gap-2 w-full">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={volunteer.avatar_url || undefined} />
                                                                <AvatarFallback>{(volunteer.full_name?.[0] || '?').toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col">
                                                                <span>{isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name}</span>
                                                                <span className="text-xs text-muted-foreground">{volunteer.phone}</span>
                                                            </div>
                                                        </div>
                                                        {detailsMarketers.some(m => m.volunteer_id === volunteer.id) && (
                                                            <Check className="w-4 h-4 ml-auto" />
                                                        )}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            <div className="border rounded-md overflow-hidden">
                                <div className="overflow-x-auto w-full">
<Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="whitespace-nowrap">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                            <TableHead className="whitespace-nowrap">{isRTL ? 'الرقم' : 'Phone'}</TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detailsMarketers.map(m => (
                                            <TableRow key={m.id}>
                                                <TableCell className="whitespace-nowrap">{m.name}</TableCell>
                                                <TableCell className="whitespace-nowrap">{m.phone || '-'}</TableCell>
                                                <TableCell>
                                                    <Button size="sm" variant="ghost" onClick={() => handleRemoveMarketerFromDetails(m.id!)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {detailsMarketers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                                    {isRTL ? 'لا يوجد فريق تسويق' : 'No marketing team assigned'}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
</div>
                            </div>
                        </div>

                        {/* Ads Section */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">{isRTL ? 'الإعلانات المخططة' : 'Planned Ads'}</h3>
                                <Button onClick={handleAddAdFromDialog} size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    {isRTL ? 'إضافة إعلان' : 'Add Ad'}
                                </Button>
                            </div>

                            {courseAds.length === 0 ? (
                                <div className="text-center py-8 border rounded-lg border-dashed text-muted-foreground">
                                    {isRTL ? 'لا توجد إعلانات مخططة' : 'No planned ads'}
                                </div>
                            ) : (
                                <div className="border rounded-md overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <div className="overflow-x-auto w-full">
<Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[60px] text-center whitespace-nowrap">#</TableHead>
                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'تاريخ النشر' : 'Date'}</TableHead>
                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'البوستر' : 'Poster'}</TableHead>
                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'المحتوى' : 'Content'}</TableHead>
                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'آخر تحديث' : 'Updated By'}</TableHead>
                                                    <TableHead className="w-[80px] whitespace-nowrap"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {courseAds.map((ad) => {
                                                    // Calculate max date for this ad (interview date or first lecture)
                                                    const maxDate = selectedMarketingCourse?.has_interview && selectedMarketingCourse?.interview_date
                                                        ? selectedMarketingCourse.interview_date
                                                        : selectedMarketingCourse?.start_date || '';

                                                    return (
                                                        <TableRow key={ad.id}>
                                                            <TableCell className="text-center font-bold whitespace-nowrap">{ad.ad_number}</TableCell>
                                                            <TableCell className="whitespace-nowrap">
                                                                <Input
                                                                    type="date"
                                                                    value={ad.ad_date}
                                                                    max={maxDate}
                                                                    onChange={(e) => handleUpdateAdDate(ad.id, e.target.value)}
                                                                    className="w-[150px]"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap">
                                                                <Button
                                                                    variant={ad.poster_done ? "default" : "outline"}
                                                                    size="sm"
                                                                    className={ad.poster_done ? "bg-green-600 hover:bg-green-700" : ""}
                                                                    onClick={() => handleUpdateAd(ad.id, { poster_done: !ad.poster_done })}
                                                                >
                                                                    {ad.poster_done ? (
                                                                        <><Check className="h-4 w-4 mr-1" /> {isRTL ? 'جاهز' : 'Done'}</>
                                                                    ) : (
                                                                        <>{isRTL ? 'غير جاهز' : 'Pending'}</>
                                                                    )}
                                                                </Button>
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap">
                                                                <Button
                                                                    variant={ad.content_done ? "default" : "outline"}
                                                                    size="sm"
                                                                    className={ad.content_done ? "bg-green-600 hover:bg-green-700" : ""}
                                                                    onClick={() => handleUpdateAd(ad.id, { content_done: !ad.content_done })}
                                                                >
                                                                    {ad.content_done ? (
                                                                        <><Check className="h-4 w-4 mr-1" /> {isRTL ? 'جاهز' : 'Done'}</>
                                                                    ) : (
                                                                        <>{isRTL ? 'غير جاهز' : 'Pending'}</>
                                                                    )}
                                                                </Button>
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap">
                                                                {ad.updater && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {isRTL ? ad.updater.full_name_ar : ad.updater.full_name}
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap">
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" size="sm">
                                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>{isRTL ? 'حذف الإعلان' : 'Delete Ad'}</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                {isRTL
                                                                                    ? `هل أنت متأكد من حذف الإعلان رقم ${ad.ad_number}؟`
                                                                                    : `Are you sure you want to delete ad #${ad.ad_number}?`}
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                                                                            <AlertDialogAction
                                                                                onClick={() => handleDeleteAd(ad.id)}
                                                                                className="bg-destructive hover:bg-destructive/90"
                                                                            >
                                                                                {isRTL ? 'حذف' : 'Delete'}
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>

            </Dialog>

            {/* Edit Student Dialog for Courses */}
            <Dialog open={isEditStudentDialogOpen} onOpenChange={setIsEditStudentDialogOpen}>
                <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                            {isRTL ? 'تعديل بيانات المستفيد' : 'Edit Beneficiary Details'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            {isRTL ? 'تعديل الاسم ورقم الهاتف والرقم القومي للمستفيد' : 'Edit name, phone, and national ID for the beneficiary'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">{isRTL ? 'الاسم' : 'Name'}</Label>
                            <Input
                                value={editingBeneficiary?.name || ''}
                                onChange={(e) => setEditingBeneficiary(prev => prev ? { ...prev, name: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">{isRTL ? 'رقم الهاتف' : 'Phone'}</Label>
                            <Input
                                value={editingBeneficiary?.phone || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (/^[0-9+]*$/.test(val)) {
                                        setEditingBeneficiary(prev => prev ? { ...prev, phone: val } : null);
                                    }
                                }}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">{isRTL ? 'الرقم القومي' : 'National ID'}</Label>
                            <Input
                                value={editingBeneficiary?.national_id || ''}
                                onChange={(e) => setEditingBeneficiary(prev => prev ? { ...prev, national_id: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row gap-2 justify-end mt-4">
                        <Button variant="outline" onClick={() => setIsEditStudentDialogOpen(false)} className="h-10 px-4">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!editingBeneficiary) return;
                                try {
                                    const { error } = await supabase
                                        .from('course_beneficiaries')
                                        .update({
                                            name: editingBeneficiary.name,
                                            phone: editingBeneficiary.phone,
                                            national_id: editingBeneficiary.national_id || null
                                        })
                                        .eq('id', editingBeneficiary.id);
                                    if (error) throw error;
                                    toast.success(isRTL ? 'تم التعديل بنجاح' : 'Updated successfully');
                                    setBeneficiaries(prev => prev.map(b => b.id === editingBeneficiary.id ? editingBeneficiary : b));
                                    setIsEditStudentDialogOpen(false);
                                } catch (error: unknown) {
                                    toast.error(getErrorMessage(error));
                                }
                            }}
                            className="h-10 px-4"
                        >
                            {isRTL ? 'حفظ التعديلات' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Student Attendance History Dialog */}
            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="w-full h-full sm:w-[calc(100%-1.5rem)] sm:max-w-md sm:max-h-[85vh] p-0 flex flex-col rounded-none sm:rounded-2xl overflow-hidden">
                    <DialogHeader className="p-4 sm:p-6 pb-2 border-b shrink-0">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Avatar className="h-8 w-8 border border-muted shrink-0">
                                <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                    {historyStudent?.name?.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[200px]">{historyStudent?.name}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground font-medium">
                            {isRTL ? 'سجل حضور المحاضرات وتعديله' : 'Lecture attendance history and management'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Scrollable checklist of lectures */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5 dark:bg-muted/10">
                        {lectures.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed text-xs">
                                {isRTL ? 'لا توجد محاضرات في هذا الكورس بعد' : 'No lectures in this course yet'}
                            </div>
                        ) : (
                            lectures.map((l) => {
                                const isPresent = attendanceData[l.id]?.some(a => a.student_phone === historyStudent?.phone && a.status === 'present');
                                const isCancelled = l.status === 'cancelled';
                                const isCompleted = l.status === 'completed';
                                const isOpen = isLectureOpen(l.date);
                                const disabled = isCancelled || !(isCompleted || isOpen);

                                return (
                                    <div
                                        key={l.id}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                            isPresent
                                                ? 'border-green-200 bg-green-50/20 dark:border-green-950 dark:bg-green-950/5'
                                                : isCancelled
                                                ? 'border-destructive/20 bg-destructive/5 opacity-70'
                                                : 'bg-background hover:bg-muted/30'
                                        }`}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                                {isRTL ? `محاضرة ${l.lecture_number}` : `Lecture ${l.lecture_number}`}
                                            </span>
                                            <span className="font-medium text-xs">
                                                {l.date}
                                            </span>
                                            {isCancelled && (
                                                <span className="text-[9px] text-destructive font-semibold">
                                                    {isRTL ? 'ملغية' : 'Cancelled'}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <label className="text-xs cursor-pointer select-none font-medium" htmlFor={`hist-att-${l.id}`}>
                                                {isPresent ? (
                                                    <span className="text-green-600 dark:text-green-400 font-bold">{isRTL ? 'حاضر' : 'Present'}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">{isRTL ? 'غائب' : 'Absent'}</span>
                                                )}
                                            </label>

                                            <Checkbox
                                                id={`hist-att-${l.id}`}
                                                checked={isPresent}
                                                disabled={disabled}
                                                onCheckedChange={() => toggleBeneficiaryAttendance(l.id, historyStudent!)}
                                                className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-4 border-t shrink-0 flex justify-end bg-background">
                        <Button className="w-full sm:w-auto" onClick={() => setIsHistoryDialogOpen(false)}>
                            {isRTL ? 'إغلاق' : 'Close'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Beneficiary Confirmation */}
            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="w-5 h-5" />
                            {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                            {isRTL
                                ? `هل أنت متأكد من حذف المستفيد "${beneficiaryToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                                : `Are you sure you want to delete "${beneficiaryToDelete?.name}"? This action cannot be undone.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="flex-1 sm:flex-none">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={deleteBeneficiary}
                            className="flex-1 sm:flex-none bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            <Trash2 className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                            {isRTL ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}

function AttendanceRegisterDialog({ lectureId, onRegister, isRTL, attendees }: { lectureId: string, onRegister: (id: string, name: string, phone: string) => Promise<boolean>, isRTL: boolean, attendees: Attendance[] }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name || !phone) {
            toast.error(isRTL ? 'يرجى إدخال الاسم والرقم' : 'Enter name and phone');
            return;
        }
        setLoading(true);
        const success = await onRegister(lectureId, name, phone);
        setLoading(false);
        if (success) {
            setOpen(false);
            setName('');
            setPhone('');
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button size="sm">
                    <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                    {isRTL ? 'تسجيل حضور' : 'Register'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-80" align="end">
                <div className="space-y-4">
                    <h4 className="font-medium leading-none">{isRTL ? 'تسجيل حضور جديد' : 'Register New Attendance'}</h4>
                    <div className="space-y-2">
                        <Label>{isRTL ? 'الاسم' : 'Name'}</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder={isRTL ? 'اسم الطالب' : 'Student Name'} />
                    </div>
                    <div className="space-y-2">
                        <Label>{isRTL ? 'الرقم' : 'Phone'}</Label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
                    </div>

                    {attendees.length > 0 && (
                        <div className="max-h-32 overflow-y-auto border p-2 rounded text-xs bg-muted/20">
                            <p className="text-muted-foreground font-semibold mb-1">{isRTL ? 'المسجلين (' + attendees.length + ')' : 'Registered (' + attendees.length + ')'}</p>
                            {attendees.map(a => (
                                <div key={a.id} className="flex justify-between py-1 border-b last:border-0 border-dashed">
                                    <span>{a.student_name}</span>
                                    <span className="text-muted-foreground">{a.student_phone}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <Button onClick={handleSubmit} disabled={loading} className="w-full">
                        {loading ? '...' : (isRTL ? 'تسجيل' : 'Register')}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
