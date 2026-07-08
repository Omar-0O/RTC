import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import {
    createSession,
    deleteSession,
    getCircleAds,
    getCircleAttendance,
    getCircleEnrollments,
    getCircleSessions,
    saveAttendance,
} from '@/services/circles.service';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    BookOpen, Calendar, Clock, Users, Plus, Check, X, Trash2,
    MoreHorizontal, Loader2, Download, Globe, MapPin, MonitorPlay, User, CalendarDays, TrendingUp, Percent, UserPlus, Pencil, UserMinus, Search, Megaphone

} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportQuranCircleReportToXlsx } from '@/utils/quranCircleExport';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface ScheduleItem {
    day: number;
    time: string;
}

interface QuranCircle {
    id: string;
    teacher_id?: string;
    teacher_name?: string;
    teacher_volunteer_id?: string;
    schedule: ScheduleItem[];
    sessions_count?: number;
    enrolled_count?: number;
    target_group?: 'children' | 'adults';
    teaching_mode?: 'online' | 'offline' | 'mixed' | 'both';
    teacher_gender?: 'men' | 'women';
    is_active?: boolean;
    description?: string;
    beneficiary_gender?: 'male' | 'female';
}

interface Session {
    id: string;
    circle_id: string;
    session_date: string;
    notes: string | null;
    attendees_count?: number;
    status?: 'scheduled' | 'completed' | 'cancelled';
}

interface Beneficiary {
    id: string;
    name_ar: string;
    name_en: string | null;
    image_url: string | null;
    phone?: string | null;
    gender?: 'male' | 'female';
    beneficiary_type?: 'adult' | 'child';
}

interface Attendance {
    beneficiary_id: string;
    attendance_type: 'memorization' | 'revision';
}

interface Guest {
    name: string;
    phone: string;
}

type Tables = Database['public']['Tables'];
type QuranBeneficiaryRow = Tables['quran_beneficiaries']['Row'];
type QuranCircleBeneficiaryInsert = Tables['quran_circle_beneficiaries']['Insert'];
type QuranCircleRow = Tables['quran_circles']['Row'];
type QuranCircleSessionRow = Tables['quran_circle_sessions']['Row'];
type QuranEnrollmentRow = Tables['quran_enrollments']['Row'];
type QuranTeacherRow = Tables['quran_teachers']['Row'];

interface EnrollmentWithBeneficiary {
    beneficiary_id: string;
    quran_beneficiaries: QuranBeneficiaryRow;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const toSchedule = (value: Json | null): ScheduleItem[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isRecord(item)) return [];
        const day = item.day;
        const time = item.time;
        return typeof day === 'number' && typeof time === 'string' ? [{ day, time }] : [];
    });
};

const getErrorMessage = (error: unknown, fallback = 'Error occurred') =>
    error instanceof Error ? error.message : fallback;

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MyQuranCircles() {
    const { user } = useAuth();
    const { isRTL } = useLanguage();
    const { activeBranch } = useBranch();
    const locale = isRTL ? ar : enUS;
    const [searchParams, setSearchParams] = useSearchParams();

    // Main state
    const [circles, setCircles] = useState<QuranCircle[]>([]);
    const [loading, setLoading] = useState(true);
    const [marketerCircleIds, setMarketerCircleIds] = useState<Set<string>>(new Set());
    const [organizerCircleIds, setOrganizerCircleIds] = useState<Set<string>>(new Set());
    const [leaveCircleId, setLeaveCircleId] = useState<string | null>(null);
    const [leaveType, setLeaveType] = useState<'organizer' | 'marketer' | null>(null);
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

    // Circle Ads state
    interface CircleAd {
        id: string;
        circle_id: string;
        ad_number: number;
        ad_date: string;
        poster_done: boolean;
        content_done: boolean;
    }
    const [circleAds, setCircleAds] = useState<CircleAd[]>([]);
    const [adsLoading, setAdsLoading] = useState(false);

    // Details dialog
    const [selectedCircle, setSelectedCircle] = useState<QuranCircle | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('sessions');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, Attendance[]>>({});

    // Session creation
    const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionNotes, setSessionNotes] = useState('');

    // Attendance dialog
    const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');

    // Guest state
    const [guests, setGuests] = useState<Guest[]>([]);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    // Delete session state
    const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

    // Quick Add Student State

    const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
    const [newBeneficiary, setNewBeneficiary] = useState<{
        name_ar: string;
        name_en: string;
        phone: string;
        gender: 'male' | 'female';
        beneficiary_type: 'adult' | 'child';
    }>({
        name_ar: '',
        name_en: '',
        phone: '',
        gender: 'male',
        beneficiary_type: 'adult'
    });

    const [showAddForm, setShowAddForm] = useState(false);
    const [isEditStudentDialogOpen, setIsEditStudentDialogOpen] = useState(false);
    const [beneficiaryTabSearch, setBeneficiaryTabSearch] = useState('');
    const [historyStudent, setHistoryStudent] = useState<Beneficiary | null>(null);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<Beneficiary | null>(null);

    const fetchMyCircles = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            // Fetch circles I'm an organizer of
            const { data: organizerData, error: orgError } = await supabase
                .from('quran_circle_organizers')
                .select('circle_id')
                .eq('volunteer_id', user.id);

            if (orgError) throw orgError;

            // Fetch circles I'm a marketer of
            const { data: marketerData } = await supabase
                .from('quran_circle_marketers')
                .select('circle_id')
                .eq('volunteer_id', user.id);

            const orgCircleIds = (organizerData || []).map((organizer) => organizer.circle_id);
            const marketerIds = (marketerData || []).map((marketer) => marketer.circle_id);

            // Union of all circle IDs
            const allCircleIds = [...new Set([...orgCircleIds, ...marketerIds])];
            setMarketerCircleIds(new Set(marketerIds));
            setOrganizerCircleIds(new Set(orgCircleIds));

            if (allCircleIds.length === 0) {
                setCircles([]);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('quran_circles')
                .select(`
                    id,
                    teacher_id,
                    schedule,
                    target_group,
                    beneficiary_gender,
                    description
                `)
                .in('id', allCircleIds)
                .eq('is_active', true);

            if (error) throw error;

            // Fetch session counts separately to avoid ambiguous filter
            const { data: sessionData } = await supabase
                .from('quran_circle_sessions')
                .select('circle_id')
                .in('circle_id', allCircleIds);

            const sessionCounts: Record<string, number> = {};
            (sessionData || []).forEach(s => {
                sessionCounts[s.circle_id] = (sessionCounts[s.circle_id] || 0) + 1;
            });

            // Fetch teachers separately to avoid join issues
            const { data: teachersData } = await supabase
                .from('quran_teachers')
                .select('id, name, target_gender, teaching_mode');

            // Store full teacher object in map
            const teachersMap = new Map((teachersData || []).map((teacher) => [teacher.id, teacher]));

            // Fetch enrolled counts
            const { data: enrollments } = await supabase
                .from('quran_enrollments')
                .select('circle_id')
                .in('circle_id', allCircleIds)
                .eq('status', 'active');

            const enrollmentCounts: Record<string, number> = {};
            (enrollments || []).forEach(e => {
                enrollmentCounts[e.circle_id] = (enrollmentCounts[e.circle_id] || 0) + 1;
            });

            const formatted: QuranCircle[] = ((data || []) as QuranCircleRow[]).map((c) => {
                const teacher = teachersMap.get(c.teacher_id);
                return {
                    id: c.id,
                    teacher_id: c.teacher_id || undefined,
                    teacher_name: teacher?.name,
                    target_group: c.target_group === 'children' ? 'children' : 'adults',
                    teacher_gender: teacher?.target_gender === 'women' ? 'women' : 'men',
                    teaching_mode: teacher?.teaching_mode === 'online' || teacher?.teaching_mode === 'offline' || teacher?.teaching_mode === 'both'
                        ? teacher.teaching_mode
                        : undefined,
                    description: c.description || undefined,
                    beneficiary_gender: c.beneficiary_gender === 'female' ? 'female' : 'male',
                    is_active: true, // filtered by is_active=true anyway
                    schedule: toSchedule(c.schedule),
                    sessions_count: sessionCounts[c.id] || 0,
                    enrolled_count: enrollmentCounts[c.id] || 0
                };
            });

            setCircles(formatted);
        } catch (error) {
            console.error('Error fetching circles:', error);
            toast.error(isRTL ? 'فشل تحميل الحلقات' : 'Failed to fetch circles');
        } finally {
            setLoading(false);
        }
    }, [user?.id, isRTL]);

    const openCircleDetails = useCallback(async (circle: QuranCircle) => {
        setSelectedCircle(circle);
        const isMarketerOnly = marketerCircleIds.has(circle.id) && !organizerCircleIds.has(circle.id);
        setActiveTab(isMarketerOnly ? 'ads' : 'sessions');
        setIsDetailsOpen(true);

        const formattedSessions = await getCircleSessions(circle.id);
        setSessions(formattedSessions);

        setBeneficiaries(await getCircleEnrollments(circle.id));

        if (formattedSessions.length > 0) {
            const sessionIds = formattedSessions.map(s => s.id);
            setAttendanceData(await getCircleAttendance(sessionIds));
        } else {
            setAttendanceData({});
        }

        setAdsLoading(true);
        setCircleAds(await getCircleAds(circle.id));
        setAdsLoading(false);
    }, [marketerCircleIds, organizerCircleIds]);

    useEffect(() => {
        if (user) fetchMyCircles();
    }, [user, fetchMyCircles]);

    // Auto-open circle details if navigated from admin with circle ID
    useEffect(() => {
        const circleId = searchParams.get('circle');
        if (circleId && circles.length > 0) {
            const circle = circles.find(c => c.id === circleId);
            if (circle) {
                openCircleDetails(circle);
                // Remove the query param after opening
                setSearchParams({});
            }
        }
    }, [searchParams, circles, openCircleDetails, setSearchParams]);

    const handleCreateSession = async () => {
        if (!selectedCircle) return;

        if (new Date(sessionDate) > new Date()) {
            toast.error(isRTL ? 'لا يمكن إنشاء جلسة في المستقبل' : 'Cannot create future session');
            return;
        }

        try {
            await createSession({
                circleId: selectedCircle.id,
                sessionDate,
                notes: sessionNotes || null,
            });

            toast.success(isRTL ? 'تم إنشاء الجلسة' : 'Session created');
            setIsSessionDialogOpen(false);
            // Reset date to local today
            const localDate = new Date();
            const localDateString = new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            setSessionDate(localDateString);
            setSessionNotes('');

            // Refresh sessions
            await openCircleDetails(selectedCircle);

            // Auto-open attendance
            // setSelectedSession(data);
            // setAttendance([]);
            // setIsAttendanceDialogOpen(true);
        } catch (error: unknown) {
            console.error('Error creating session:', error);
            toast.error(getErrorMessage(error));
        }
    };

    const openAttendanceDialog = async (session: Session) => {
        setSelectedSession(session);
        setAttendance(attendanceData[session.id] || []);
        setGuests([]);
        setGuestName('');
        setGuestPhone('');
        setIsAttendanceDialogOpen(true);
    };

    const toggleBeneficiary = (id: string) => {
        setAttendance(prev => {
            const exists = prev.find(a => a.beneficiary_id === id);
            if (exists) {
                return prev.filter(a => a.beneficiary_id !== id);
            }
            return [...prev, { beneficiary_id: id, attendance_type: 'memorization' }];
        });
    };

    const updateAttendanceType = (id: string, type: 'memorization' | 'revision') => {
        setAttendance(prev =>
            prev.map(a => a.beneficiary_id === id ? { ...a, attendance_type: type } : a)
        );
    };

    const handleSaveAttendance = async () => {
        if (!selectedSession || !selectedCircle) return;

        try {
            await saveAttendance({
                sessionId: selectedSession.id,
                circleId: selectedCircle.id,
                attendance,
                guests,
                circleGender: selectedCircle.beneficiary_gender || selectedCircle.teacher_gender,
                circleTargetGroup: selectedCircle.target_group,
            });

            toast.success(isRTL ? 'تم حفظ الحضور' : 'Attendance saved');
            setIsAttendanceDialogOpen(false);
            await openCircleDetails(selectedCircle);
        } catch (error: unknown) {
            console.error('Error saving attendance:', error);
            toast.error(getErrorMessage(error));
        }
    };

    const toggleCircleAttendance = async (sessionId: string, beneficiaryId: string) => {
        const currentSessionAtt = attendanceData[sessionId] || [];
        const existing = currentSessionAtt.find(a => a.beneficiary_id === beneficiaryId);

        try {
            if (existing) {
                // Remove
                const { error } = await supabase
                    .from('quran_circle_beneficiaries')
                    .delete()
                    .eq('session_id', sessionId)
                    .eq('beneficiary_id', beneficiaryId);

                if (error) throw error;

                setAttendanceData(prev => ({
                    ...prev,
                    [sessionId]: prev[sessionId].filter(a => a.beneficiary_id !== beneficiaryId)
                }));
            } else {
                // Add
                const { error } = await supabase
                    .from('quran_circle_beneficiaries')
                    .insert({
                        session_id: sessionId,
                        circle_id: selectedCircle?.id, // Ensure circle_id is included for RLS
                        beneficiary_id: beneficiaryId,
                        attendance_type: 'memorization'
                    });

                if (error) throw error;

                setAttendanceData(prev => ({
                    ...prev,
                    [sessionId]: [...(prev[sessionId] || []), { beneficiary_id: beneficiaryId, attendance_type: 'memorization' }]
                }));
            }
        } catch (error) {
            console.error('Error toggling attendance:', error);
            toast.error(isRTL ? 'فشل تحديث الحضور' : 'Failed to update attendance');
        }
    };

    const updateSheetAttendanceType = async (sessionId: string, beneficiaryId: string, type: 'memorization' | 'revision') => {
        try {
            const { error } = await supabase
                .from('quran_circle_beneficiaries')
                .update({ attendance_type: type })
                .eq('session_id', sessionId)
                .eq('beneficiary_id', beneficiaryId);

            if (error) throw error;

            setAttendanceData(prev => ({
                ...prev,
                [sessionId]: prev[sessionId].map(a =>
                    a.beneficiary_id === beneficiaryId ? { ...a, attendance_type: type } : a
                )
            }));
        } catch (error) {
            console.error('Error updating attendance type:', error);
            toast.error(isRTL ? 'فشل تحديث النوع' : 'Failed to update type');
        }
    };

    const confirmUnenrollBeneficiary = (beneficiary: Beneficiary) => {
        setBeneficiaryToDelete(beneficiary);
        setIsDeleteConfirmOpen(true);
    };

    const handleUnenrollBeneficiary = async () => {
        if (!beneficiaryToDelete || !selectedCircle) return;
        try {
            const { error } = await supabase
                .from('quran_enrollments')
                .update({ status: 'inactive' })
                .eq('circle_id', selectedCircle.id)
                .eq('beneficiary_id', beneficiaryToDelete.id);

            if (error) throw error;
            toast.success(isRTL ? 'تم إلغاء التسجيل' : 'Unenrolled successfully');
            openCircleDetails(selectedCircle);
            fetchMyCircles();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsDeleteConfirmOpen(false);
            setBeneficiaryToDelete(null);
        }
    };

    const handleLeaveCircle = (circleId: string, type: 'organizer' | 'marketer') => {
        setLeaveCircleId(circleId);
        setLeaveType(type);
        setIsLeaveConfirmOpen(true);
    };

    const confirmLeaveCircle = async () => {
        if (!user || !leaveCircleId || !leaveType) return;
        const table = leaveType === 'organizer' ? 'quran_circle_organizers' : 'quran_circle_marketers';
        
        try {
            const { error } = await supabase
                .from(table)
                .delete()
                .match({ circle_id: leaveCircleId, volunteer_id: user.id });

            if (error) throw error;
            toast.success(isRTL ? 'تمت الإزالة بنجاح' : 'Removed successfully');
            setIsLeaveConfirmOpen(false);
            setLeaveCircleId(null);
            setLeaveType(null);
            fetchMyCircles();
        } catch (error: unknown) {
            console.error('Error leaving circle:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء الإزالة' : 'Error removing role');
        }
    };

    const markAllPresent = () => {
        setAttendance(beneficiaries.map(b => ({
            beneficiary_id: b.id,
            attendance_type: 'memorization'
        })));
    };

    const addGuest = () => {
        if (!guestName.trim()) {
            toast.error(isRTL ? 'أدخل اسم الضيف' : 'Enter guest name');
            return;
        }
        if (!guestPhone.trim()) {
            toast.error(isRTL ? 'أدخل رقم الضيف' : 'Enter guest phone');
            return;
        }
        setGuests([...guests, { name: guestName.trim(), phone: guestPhone.trim() }]);
        setGuestName('');
        setGuestPhone('');
        toast.success(isRTL ? 'تم إضافة الضيف' : 'Guest added');
    };

    const removeGuest = (index: number) => {
        setGuests(guests.filter((_, i) => i !== index));
    };

    // Delete session
    const handleDeleteSession = async () => {
        if (!deleteSessionId || !selectedCircle) return;
        try {
            await deleteSession(deleteSessionId);
            toast.success(isRTL ? 'تم حذف الجلسة' : 'Session deleted');
            setDeleteSessionId(null);
            await openCircleDetails(selectedCircle);
        } catch (error: unknown) {
            console.error('Error deleting session:', error);
            toast.error(getErrorMessage(error, 'Error deleting session'));
        }
    };

    const handleAddBeneficiary = async () => {
        if (!selectedCircle) return;
        if (!newBeneficiary.name_ar.trim()) {
            toast.error(isRTL ? 'يرجى إدخال اسم المستفيد' : 'Please enter beneficiary name');
            return;
        }

        try {
            if (editingBeneficiary) {
                // Update existing
                const { error } = await supabase
                    .from('quran_beneficiaries')
                    .update({
                        name_ar: newBeneficiary.name_ar,
                        name_en: newBeneficiary.name_en || null,
                        phone: newBeneficiary.phone || null,
                        gender: newBeneficiary.gender,
                        beneficiary_type: newBeneficiary.beneficiary_type
                    })
                    .eq('id', editingBeneficiary.id);

                if (error) throw error;
                toast.success(isRTL ? 'تم تحديث بيانات المستفيد' : 'Beneficiary updated successfully');
            } else {
                // Create new logic
                let beneficiaryId: string | undefined;

                // 1. Check if beneficiary exists by phone (if phone is provided)
                if (newBeneficiary.phone) {
                    const { data: existingBen } = await supabase
                        .from('quran_beneficiaries')
                        .select('id')
                        .eq('phone', newBeneficiary.phone)
                        .single();

                    if (existingBen) beneficiaryId = existingBen.id;
                }

                // 2. If not exists, create new
                if (!beneficiaryId) {
                    const { data: newBen, error: createError } = await supabase
                        .from('quran_beneficiaries')
                        .insert({
                            name_ar: newBeneficiary.name_ar,
                            name_en: newBeneficiary.name_en || null,
                            phone: newBeneficiary.phone || null,
                            gender: newBeneficiary.gender,
                            beneficiary_type: newBeneficiary.beneficiary_type,
                            branch_id: activeBranch?.id || null
                        })
                        .select('id')
                        .single();

                    if (createError) throw createError;
                    beneficiaryId = newBen.id;
                }

                // 3. Enroll in current circle
                if (beneficiaryId) {
                    // Check if already enrolled
                    const { data: existingEnrollment } = await supabase
                        .from('quran_enrollments')
                        .select('id')
                        .eq('circle_id', selectedCircle.id)
                        .eq('beneficiary_id', beneficiaryId)
                        .single();

                    if (existingEnrollment) {
                        toast.warning(isRTL ? 'المستفيد مسجل بالفعل في هذه الحلقة' : 'Beneficiary already enrolled');
                    } else {
                        const { error: enrollError } = await supabase
                            .from('quran_enrollments')
                            .insert({
                                circle_id: selectedCircle.id,
                                beneficiary_id: beneficiaryId,
                                status: 'active'
                            });

                        if (enrollError) throw enrollError;
                        toast.success(isRTL ? 'تم إضافة المستفيد بنجاح' : 'Beneficiary added successfully');
                    }
                }
            }

            // 4. Refresh data and reset

            // Wait, I am replacing the tab content, so I might not need isQuickAddDialogOpen anymore if I use the inline form from QuranCircles.tsx.
            // But for now let's just reset the state.
            setEditingBeneficiary(null);
            setNewBeneficiary({
                name_ar: '',
                name_en: '',
                phone: '',
                gender: 'male',
                beneficiary_type: 'adult'
            });
            setIsEditStudentDialogOpen(false);
            await openCircleDetails(selectedCircle);
            // fetchCircles(); // Refresh counts if needed

        } catch (error: unknown) {
            console.error('Error saving beneficiary:', error);
            toast.error(getErrorMessage(error, isRTL ? 'حدث خطأ أثناء الحفظ' : 'Error saving beneficiary'));
        }
    };

    // Smart date: get next scheduled day from circle schedule
    const getNextScheduleDate = (schedule: ScheduleItem[]) => {
        if (!schedule || schedule.length === 0) return new Date().toISOString().split('T')[0];
        const today = new Date();
        const todayDay = today.getDay();
        const scheduledDays = schedule.map(s => s.day).sort((a, b) => a - b);

        // Find the next scheduled day from today
        let nextDay = scheduledDays.find(d => d >= todayDay);
        if (nextDay === undefined) nextDay = scheduledDays[0]; // wrap to next week

        const diff = (nextDay - todayDay + 7) % 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + diff);
        return nextDate.toISOString().split('T')[0];
    };

    // Get attendance percentage for a session
    const getAttendanceRate = (session: Session) => {
        if (!beneficiaries.length) return null;
        const att = attendanceData[session.id] || [];
        return Math.round((att.length / beneficiaries.length) * 100);
    };

    const filteredTabBeneficiaries = beneficiaries.filter(b =>
        b.name_ar.toLowerCase().includes(beneficiaryTabSearch.toLowerCase()) ||
        (b.name_en && b.name_en.toLowerCase().includes(beneficiaryTabSearch.toLowerCase())) ||
        (b.phone && b.phone.includes(beneficiaryTabSearch))
    );

    const getStudentStats = (beneficiaryId: string) => {
        let attendedCount = 0;
        sessions.forEach(s => {
            const hasAttended = attendanceData[s.id]?.some(a => a.beneficiary_id === beneficiaryId);
            if (hasAttended) attendedCount++;
        });
        const totalSessions = sessions.length;
        const rate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;
        return {
            attended: attendedCount,
            missed: totalSessions - attendedCount,
            rate
        };
    };

    const getCircleName = (circle: QuranCircle) => {
        if (circle.teacher_name) {
            return isRTL ? `حلقة ${circle.teacher_name}` : `${circle.teacher_name}'s Circle`;
        }
        return isRTL ? 'حلقتي' : 'My Circle';
    };

    const getScheduleDisplay = (schedule: ScheduleItem[]) => {
        if (!schedule || schedule.length === 0) return isRTL ? 'غير محدد' : 'Not set';
        const days = isRTL ? DAYS_SHORT_AR : DAYS_SHORT_EN;
        return schedule.map(s => days[s.day]).join(', ');
    };

    const getScheduleTime = (schedule: ScheduleItem[]) => {
        if (!schedule || schedule.length === 0) return '';
        const time24 = schedule[0]?.time;
        if (!time24) return '';

        // Convert to AM/PM
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? (isRTL ? 'مساءً' : 'PM') : (isRTL ? 'صباحاً' : 'AM');
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const filteredBeneficiaries = beneficiaries.filter(b =>
        b.name_ar.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
        (b.name_en?.toLowerCase() || '').includes(beneficiarySearch.toLowerCase())
    );

    const filteredSessionBeneficiaries = beneficiaries;

    const exportCircleToExcel = async (circle: QuranCircle) => {
        try {
            toast.info(isRTL ? 'جاري إعداد الملف...' : 'Preparing file...');
            await exportQuranCircleReportToXlsx({
                circle,
                isRTL,
                getCircleName,
                getScheduleDisplay,
                getScheduleTime,
                getSessionDayLabel: sessionDate => format(new Date(sessionDate), 'EEEE', { locale }),
            });
            toast.success(isRTL ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BookOpen className="h-7 w-7" />
                    {isRTL ? 'حلقاتي' : 'My Quran Circles'}
                </h1>
                <p className="text-muted-foreground">
                    {isRTL ? 'الحلقات اللي بتنظمها أو بتسوقها' : 'Circles you organize or market'}
                </p>
            </div>

            {/* Circles Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {circles.map(circle => {
                    const isMarketer = marketerCircleIds.has(circle.id);
                    return (
                        <Card key={circle.id} className="group hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg">{getCircleName(circle)}</CardTitle>
                                            {isMarketer && (
                                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 gap-1 text-xs">
                                                    <Megaphone className="h-3 w-3" />
                                                    {isRTL ? 'مسوق' : 'Marketer'}
                                                </Badge>
                                            )}
                                        </div>
                                        <CardDescription>
                                            {circle.sessions_count} {isRTL ? 'جلسة' : 'sessions'}
                                        </CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openCircleDetails(circle)}>
                                                <BookOpen className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'التفاصيل والحضور' : 'Details & Attendance'}
                                            </DropdownMenuItem>
                                            {organizerCircleIds.has(circle.id) && (
                                                <DropdownMenuItem onClick={() => handleLeaveCircle(circle.id, 'organizer')} className="text-destructive focus:bg-destructive/10">
                                                    <Trash2 className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'إزالة نفسي كمنظم' : 'Leave as Organizer'}
                                                </DropdownMenuItem>
                                            )}
                                            {marketerCircleIds.has(circle.id) && (
                                                <DropdownMenuItem onClick={() => handleLeaveCircle(circle.id, 'marketer')} className="text-destructive focus:bg-destructive/10">
                                                    <Trash2 className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'إزالة نفسي كمسوق' : 'Leave as Marketer'}
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => exportCircleToExcel(circle)}>
                                                <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'تصدير Excel' : 'Export Excel'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {/* Badges Section */}
                                <div className="flex flex-col gap-2 mb-4">
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        {circle.target_group && (
                                            <Badge variant="outline" className={`flex items-center gap-1.5 px-2.5 py-1 ${circle.target_group === 'children' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                <Users className="h-3.5 w-3.5" />
                                                {circle.target_group === 'children' ? (isRTL ? 'أطفال' : 'Children') : (isRTL ? 'بالغين' : 'Adults')}
                                            </Badge>
                                        )}
                                        {circle.teacher_gender && (
                                            <Badge variant="outline" className={`flex items-center gap-1.5 px-2.5 py-1 ${circle.teacher_gender === 'men' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
                                                <User className="h-3.5 w-3.5" />
                                                {circle.teacher_gender === 'men' ? (isRTL ? 'رجال' : 'Men') : (isRTL ? 'نساء' : 'Women')}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {circle.teaching_mode && (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5 px-2.5 py-1">
                                                {circle.teaching_mode === 'online' ? <Globe className="h-3.5 w-3.5" /> : (circle.teaching_mode === 'offline' ? <MapPin className="h-3.5 w-3.5" /> : <MonitorPlay className="h-3.5 w-3.5" />)}
                                                {circle.teaching_mode === 'online' ? (isRTL ? 'أونلاين' : 'Online') :
                                                    circle.teaching_mode === 'offline' ? (isRTL ? 'حضوري' : 'Offline') :
                                                        (isRTL ? 'كلاهما' : 'Mixed')}
                                            </Badge>
                                        )}
                                        {!circle.is_active && (
                                            <Badge variant="secondary" className="text-xs px-2.5 py-1">
                                                {isRTL ? 'متوقفة' : 'Inactive'}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm border-t pt-3">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <CalendarDays className="w-4 h-4" />
                                        <span>{getScheduleDisplay(circle.schedule)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        <span>{getScheduleTime(circle.schedule) || (isRTL ? 'غير محدد' : 'Not set')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Users className="w-4 h-4" />
                                        <span>{circle.enrolled_count} {isRTL ? 'مسجل' : 'enrolled'}</span>
                                    </div>
                                    {circle.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-2 pt-2 border-t">
                                            {circle.description}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {circles.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border rounded-xl border-dashed text-muted-foreground bg-gradient-to-br from-muted/30 to-transparent">
                        <div className="p-4 rounded-full bg-primary/5 mb-4">
                            <BookOpen className="w-12 h-12 opacity-30 text-primary" />
                        </div>
                        <p className="font-medium text-lg">{isRTL ? 'لا توجد حلقات مسندة إليك' : 'No circles assigned to you'}</p>
                        <p className="text-sm mt-1">{isRTL ? 'تواصل مع مسؤول القرآن لإضافتك' : 'Contact the Quran admin to get assigned'}</p>
                    </div>
                )}
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="w-full h-full sm:w-[calc(100%-1.5rem)] sm:max-w-5xl sm:max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                        <div className="flex flex-col h-full bg-background overflow-hidden">
                            {/* Sticky Header */}
                            <div className="border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                                <DialogHeader className="p-4 sm:p-6 pb-2 text-center sm:text-center flex flex-col items-center justify-center relative">
                                    <DialogTitle className="text-xl sm:text-2xl font-bold text-center w-full mt-2 sm:mt-0">
                                        {selectedCircle && getCircleName(selectedCircle)}
                                    </DialogTitle>
                                    <DialogDescription className="text-center w-full text-xs sm:text-sm mt-1">
                                        {selectedCircle && getScheduleDisplay(selectedCircle.schedule)} • {getScheduleTime(selectedCircle?.schedule || [])}
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Tabs Selection */}
                                <div className="px-4 sm:px-6 pb-3">
                                    <div className="overflow-x-auto -mx-2 px-2 pb-0.5 scrollbar-none">
                                        {(() => {
                                            const isMarketerOnly = selectedCircle ? (marketerCircleIds.has(selectedCircle.id) && !organizerCircleIds.has(selectedCircle.id)) : false;
                                            return isMarketerOnly ? (
                                                <TabsList className="flex w-full h-auto p-1 bg-muted/50 rounded-xl gap-0.5 xs:gap-1">
                                                    <TabsTrigger
                                                        value="ads"
                                                        className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                    >
                                                        <span className="flex items-center gap-1.5 justify-center w-full">
                                                            <Megaphone className="w-3.5 h-3.5" />
                                                            <span>{isRTL ? 'الإعلانات' : 'Ads'}</span>
                                                        </span>
                                                    </TabsTrigger>
                                                </TabsList>
                                            ) : (
                                                <TabsList className="flex w-full h-auto p-1 bg-muted/50 rounded-xl gap-0.5 xs:gap-1">
                                                    <TabsTrigger
                                                        value="beneficiaries"
                                                        className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-4 md:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                    >
                                                        <span className="flex items-center gap-1.5 justify-center w-full">
                                                            <Users className="w-3.5 h-3.5" />
                                                            <span>{isRTL ? 'المستفيدين' : 'Beneficiaries'}</span>
                                                        </span>
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="sessions"
                                                        className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-4 md:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                    >
                                                        <span className="flex items-center gap-1.5 justify-center w-full">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            <span>{isRTL ? 'الجلسات' : 'Sessions'}</span>
                                                        </span>
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="sheet"
                                                        className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-4 md:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                    >
                                                        <span className="flex items-center gap-1.5 justify-center w-full">
                                                            <Table className="w-3.5 h-3.5" />
                                                            <span>{isRTL ? 'شيت الحضور' : 'Attendance Sheet'}</span>
                                                        </span>
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="ads"
                                                        className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-4 md:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                    >
                                                        <span className="flex items-center gap-1.5 justify-center w-full">
                                                            <Megaphone className="w-3.5 h-3.5" />
                                                            <span>{isRTL ? 'الإعلانات' : 'Ads'}</span>
                                                        </span>
                                                    </TabsTrigger>
                                                </TabsList>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Tabs Content Area */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/5 dark:bg-muted/10">
                                {/* Beneficiaries Tab */}
                                <TabsContent value="beneficiaries" className="space-y-4 py-0 outline-none">
                                    {/* Action Bar (Search & Add Button) */}
                                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                                        <div className="relative w-full sm:w-72">
                                            <Search className="absolute ltr:left-3 rtl:right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder={isRTL ? 'بحث عن مستفيد...' : 'Search beneficiary...'}
                                                value={beneficiaryTabSearch}
                                                onChange={e => setBeneficiaryTabSearch(e.target.value)}
                                                className="ltr:pl-9 rtl:pr-9 h-9"
                                            />
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Button 
                                                onClick={() => {
                                                    setEditingBeneficiary(null);
                                                    setNewBeneficiary({
                                                        name_ar: '', name_en: '', phone: '', gender: 'male', beneficiary_type: 'adult'
                                                    });
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
                                    </div>

                                    {/* Add Beneficiary Form (Collapsible) */}
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
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</label>
                                                            <Input
                                                                placeholder={isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}
                                                                value={newBeneficiary.name_ar}
                                                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name_ar: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'رقم الهاتف' : 'Phone'}</label>
                                                            <Input
                                                                placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                                                                value={newBeneficiary.phone}
                                                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, phone: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'النوع' : 'Gender'}</label>
                                                            <Select
                                                                value={newBeneficiary.gender}
                                                                onValueChange={(val: 'male' | 'female') => setNewBeneficiary({ ...newBeneficiary, gender: val })}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={isRTL ? 'النوع' : 'Gender'} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="male">{isRTL ? 'ذكر' : 'Male'}</SelectItem>
                                                                    <SelectItem value="female">{isRTL ? 'أنثى' : 'Female'}</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'نوع المستفيد' : 'Type'}</label>
                                                            <Select
                                                                value={newBeneficiary.beneficiary_type}
                                                                onValueChange={(val: 'adult' | 'child') => setNewBeneficiary({ ...newBeneficiary, beneficiary_type: val })}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={isRTL ? 'نوع المستفيد' : 'Type'} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="adult">{isRTL ? 'بالغ' : 'Adult'}</SelectItem>
                                                                    <SelectItem value="child">{isRTL ? 'طفل' : 'Child'}</SelectItem>
                                                                </SelectContent>
                                                            </Select>
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
                                                            onClick={async () => {
                                                                await handleAddBeneficiary();
                                                                setShowAddForm(false);
                                                            }} 
                                                            size="sm"
                                                            className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
                                                        >
                                                            <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                                            {isRTL ? 'إضافة الطالب' : 'Add Student'}
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
                                                {isRTL ? 'لا يوجد طلاب مسجلين' : 'No students found'}
                                            </div>
                                        ) : (
                                            filteredTabBeneficiaries.map((b) => {
                                                const stats = getStudentStats(b.id);
                                                return (
                                                    <Card key={b.id} className="border hover:border-primary/20 transition-all bg-card shadow-sm">
                                                        <CardContent className="p-4 flex flex-col gap-3">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar className="h-10 w-10 border border-muted">
                                                                        <AvatarImage src={b.image_url || undefined} />
                                                                        <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                            {b.name_ar?.slice(0, 2)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div>
                                                                        <div className="font-semibold text-xs text-foreground">{b.name_ar}</div>
                                                                        {b.name_en && <div className="text-[10px] text-muted-foreground">{b.name_en}</div>}
                                                                        <div className="text-[10px] text-muted-foreground mt-0.5">{b.phone || '-'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1.5">
                                                                    <div className="flex gap-1">
                                                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 ${b.gender === 'male' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400' : 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/20 dark:text-pink-400'}`}>
                                                                            {b.gender === 'male' ? (isRTL ? 'ذكر' : 'Male') : (isRTL ? 'أنثى' : 'Female')}
                                                                        </Badge>
                                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">
                                                                            {b.beneficiary_type === 'adult' ? (isRTL ? 'بالغ' : 'Adult') : (isRTL ? 'طفل' : 'Child')}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="text-[10px] font-semibold">
                                                                        <span className={stats.rate >= 80 ? 'text-green-600 dark:text-green-400' : stats.rate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                                                                            {isRTL ? 'حضور:' : 'Attendance:'} {stats.rate}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Visual attendance rate bar */}
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
                                                                            setNewBeneficiary({
                                                                                name_ar: b.name_ar, name_en: b.name_en || '', phone: b.phone || '', gender: b.gender || 'male', beneficiary_type: b.beneficiary_type || 'adult'
                                                                            });
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
                                                                        onClick={() => confirmUnenrollBeneficiary(b)}
                                                                    >
                                                                        <UserMinus className="w-3.5 h-3.5" />
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
                                                    <TableHead>{isRTL ? 'النوع' : 'Gender'}</TableHead>
                                                    <TableHead>{isRTL ? 'الفئة' : 'Type'}</TableHead>
                                                    <TableHead className="text-center">{isRTL ? 'إحصائيات الحضور' : 'Attendance Stats'}</TableHead>
                                                    <TableHead className="w-28 text-center">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredTabBeneficiaries.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                            {isRTL ? 'لا يوجد مستفيدين' : 'No beneficiaries found'}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredTabBeneficiaries.map((b) => {
                                                        const stats = getStudentStats(b.id);
                                                        return (
                                                            <TableRow key={b.id} className="hover:bg-muted/20 transition-colors">
                                                                <TableCell>
                                                                    <div className="flex items-center gap-3">
                                                                        <Avatar className="h-8 w-8 border border-muted">
                                                                            <AvatarImage src={b.image_url || undefined} />
                                                                            <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                                {b.name_ar?.slice(0, 2)}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <div>
                                                                            <div className="font-semibold text-xs text-foreground">{b.name_ar}</div>
                                                                            {b.name_en && <div className="text-[10px] text-muted-foreground">{b.name_en}</div>}
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-xs font-mono text-muted-foreground">{b.phone || '-'}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className={`text-xs px-2 py-0.5 ${b.gender === 'male' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400' : 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/20 dark:text-pink-400'}`}>
                                                                        {b.gender === 'male' ? (isRTL ? 'ذكر' : 'Male') : (isRTL ? 'أنثى' : 'Female')}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                                                        {b.beneficiary_type === 'adult' ? (isRTL ? 'بالغ' : 'Adult') : (isRTL ? 'طفل' : 'Child')}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col items-center justify-center gap-1.5 max-w-[150px] mx-auto">
                                                                        <div className="flex justify-between items-center w-full text-[10px]">
                                                                            <span className="font-bold text-muted-foreground">{isRTL ? `نسبة: ${stats.rate}%` : `Rate: ${stats.rate}%`}</span>
                                                                            <span className="text-[9px] text-muted-foreground">{isRTL ? `حضر ${stats.attended}/${sessions.length}` : `${stats.attended}/${sessions.length} attended`}</span>
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
                                                                                setNewBeneficiary({
                                                                                    name_ar: b.name_ar, name_en: b.name_en || '', phone: b.phone || '', gender: b.gender || 'male', beneficiary_type: b.beneficiary_type || 'adult'
                                                                                });
                                                                                setIsEditStudentDialogOpen(true);
                                                                            }}
                                                                        >
                                                                            <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                                        </Button>
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="ghost" 
                                                                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                                            onClick={() => confirmUnenrollBeneficiary(b)}
                                                                        >
                                                                            <UserMinus className="w-4 h-4" />
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
                                    <div className="text-xs text-muted-foreground px-1">
                                        {isRTL ? `إجمالي الطلاب: ${filteredTabBeneficiaries.length}` : `Total students: ${filteredTabBeneficiaries.length}`}
                                    </div>
                                </TabsContent>

                                {/* Sessions Tab */}
                                <TabsContent value="sessions" className="space-y-4 py-0 outline-none">
                                    {/* Action Header */}
                                    <div className="flex justify-between items-center bg-card p-3 rounded-xl border">
                                        <div>
                                            <h3 className="font-semibold text-xs sm:text-sm">{isRTL ? 'جلسات الحلقة' : 'Circle Sessions'}</h3>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                                                {sessions.length} {isRTL ? 'جلسة مسجلة' : 'registered sessions'}
                                            </p>
                                        </div>
                                        <Button onClick={() => {
                                            if (selectedCircle) {
                                                setSessionDate(getNextScheduleDate(selectedCircle.schedule));
                                            }
                                            setIsSessionDialogOpen(true);
                                        }} size="sm" className="h-8 text-xs font-semibold">
                                            <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                            {isRTL ? 'جلسة جديدة' : 'New Session'}
                                        </Button>
                                    </div>

                                    {beneficiaries.length === 0 && (
                                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            {isRTL
                                                ? 'يمكنك إضافة مستفيدين أولاً من تبويب المستفيدين لتسجيل حضورهم.'
                                                : 'You must add beneficiaries from the Beneficiaries tab first to record their attendance.'}
                                        </div>
                                    )}

                                    {/* Sessions Grid */}
                                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                                        {sessions.map((session, index) => {
                                            const rate = getAttendanceRate(session);
                                            const hasAttendance = session.attendees_count > 0;
                                            return (
                                                <Card 
                                                    key={session.id} 
                                                    className={`group overflow-hidden transition-all hover:shadow-md border bg-card ${hasAttendance 
                                                        ? 'border-green-100 dark:border-green-900/50 bg-green-50/10 dark:bg-green-950/5' 
                                                        : 'hover:border-primary/20'
                                                    }`}
                                                >
                                                    <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2.5 rounded-xl transition-colors ${hasAttendance ? 'bg-green-100/80 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-primary/10 text-primary'}`}>
                                                                    <Calendar className="h-4 w-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="secondary" className="h-5 px-1.5 text-[9px] font-mono font-bold">
                                                                            #{sessions.length - index}
                                                                        </Badge>
                                                                        <p className="font-semibold text-xs sm:text-sm">
                                                                            {format(new Date(session.session_date), 'EEEE, d MMMM', { locale })}
                                                                        </p>
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                                        {isRTL ? 'الحضور:' : 'Attendance:'} <span className={hasAttendance ? 'font-bold text-green-600 dark:text-green-400' : ''}>{session.attendees_count || 0}</span> / {beneficiaries.length}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeleteSessionId(session.id);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>

                                                        {/* Attendance Progress bar for the session */}
                                                        {beneficiaries.length > 0 && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                                    <span>{isRTL ? 'نسبة الحضور' : 'Attendance Rate'}</span>
                                                                    <span className="font-bold">{rate || 0}%</span>
                                                                </div>
                                                                <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all ${rate !== null && rate >= 80 ? 'bg-green-500' : rate !== null && rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                        style={{ width: `${rate || 0}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {session.notes && (
                                                            <div className="text-[10px] text-muted-foreground bg-muted/50 dark:bg-muted/20 p-2 rounded-lg border border-dashed flex items-start gap-1.5">
                                                                <span className="shrink-0">📝</span>
                                                                <span className="break-words line-clamp-2 w-full">{session.notes}</span>
                                                            </div>
                                                        )}

                                                        <div className="border-t pt-3 flex gap-2">
                                                            <Button 
                                                                onClick={() => openAttendanceDialog(session)}
                                                                size="sm" 
                                                                className={`w-full text-xs font-semibold gap-1.5 h-8 ${hasAttendance 
                                                                    ? 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-900/60 dark:hover:bg-green-900/80' 
                                                                    : 'bg-primary hover:bg-primary/95 text-primary-foreground'}`}
                                                            >
                                                                <Check className="h-4 w-4" />
                                                                {hasAttendance 
                                                                    ? (isRTL ? 'تعديل الحضور' : 'Edit Attendance') 
                                                                    : (isRTL ? 'تسجيل الحضور' : 'Record Attendance')}
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}

                                        {sessions.length === 0 && (
                                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                                                <div className="p-3 rounded-full bg-muted mb-3">
                                                    <Calendar className="h-8 w-8 opacity-30" />
                                                </div>
                                                <p className="font-medium">{isRTL ? 'لا توجد جلسات بعد' : 'No sessions yet'}</p>
                                                <p className="text-sm mt-1">{isRTL ? 'أنشئ أول جلسة للبدء' : 'Create the first session to get started'}</p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* Attendance Sheet Tab */}
                                <TabsContent value="sheet" className="py-0 outline-none">
                                    {/* Desktop View Table */}
                                    <div className="hidden sm:block border rounded-xl overflow-x-auto max-h-[600px] shadow-sm bg-card">
                                        <Table>
                                            <TableHeader className="bg-muted/40 sticky top-0 z-20">
                                                <TableRow>
                                                    <TableHead className="min-w-[180px] whitespace-nowrap sticky left-0 z-30 bg-background shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#1f2937]">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                    <TableHead className="min-w-[120px] whitespace-nowrap">{isRTL ? 'رقم الهاتف' : 'Phone'}</TableHead>
                                                    {sessions.map((s, idx) => (
                                                        <TableHead key={s.id} className="text-center min-w-[80px] whitespace-nowrap">
                                                            <div className="flex flex-col items-center">
                                                                <span className="font-mono text-xs text-primary font-bold">#{sessions.length - idx}</span>
                                                                <span className="text-[10px] font-normal text-muted-foreground">
                                                                    {format(new Date(s.session_date), 'd/M')}
                                                                </span>
                                                            </div>
                                                        </TableHead>
                                                    ))}
                                                    <TableHead className="text-center min-w-[70px] whitespace-nowrap bg-green-50/50 dark:bg-green-950/20">{isRTL ? 'حضر' : 'Attended'}</TableHead>
                                                    <TableHead className="text-center min-w-[70px] whitespace-nowrap bg-red-50/50 dark:bg-red-950/20">{isRTL ? 'غاب' : 'Missed'}</TableHead>
                                                    <TableHead className="text-center min-w-[80px] whitespace-nowrap bg-primary/5">{isRTL ? 'نسبة' : '%'}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {beneficiaries.map(beneficiary => {
                                                    const studentAttendance = sessions.map(s =>
                                                        attendanceData[s.id]?.find(a => a.beneficiary_id === beneficiary.id)
                                                    );
                                                    const attendedCount = studentAttendance.filter(Boolean).length;
                                                    const missedCount = sessions.length - attendedCount;
                                                    const attendanceRate = sessions.length > 0 ? Math.round((attendedCount / sessions.length) * 100) : 0;

                                                    return (
                                                        <TableRow key={beneficiary.id} className="hover:bg-muted/10 transition-colors">
                                                            <TableCell className="font-medium whitespace-nowrap sticky left-0 z-10 bg-background shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#1f2937]">
                                                                <div className="text-sm font-semibold">{beneficiary.name_ar}</div>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">{beneficiary.phone || '-'}</TableCell>
                                                            {sessions.map((session) => {
                                                                const attendanceRecord = attendanceData[session.id]?.find(a => a.beneficiary_id === beneficiary.id);
                                                                const isPresent = !!attendanceRecord;

                                                                return (
                                                                    <TableCell key={session.id} className="text-center p-2">
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <Checkbox
                                                                                checked={isPresent}
                                                                                onCheckedChange={() => toggleCircleAttendance(session.id, beneficiary.id)}
                                                                                className="mx-auto h-4 w-4 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                                                            />
                                                                            {isPresent && (
                                                                                <Select
                                                                                    value={attendanceRecord?.attendance_type}
                                                                                    onValueChange={(val: 'memorization' | 'revision') => updateSheetAttendanceType(session.id, beneficiary.id, val)}
                                                                                >
                                                                                    <SelectTrigger className={`h-6 text-[10px] w-[65px] px-1 bg-background border ${attendanceRecord?.attendance_type === 'memorization' ? 'text-green-600 border-green-200 bg-green-50/30' : 'text-amber-600 border-amber-200 bg-amber-50/30'}`}>
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="memorization" className="text-[10px]">{isRTL ? 'حفظ' : 'Mem'}</SelectItem>
                                                                                        <SelectItem value="revision" className="text-[10px]">{isRTL ? 'مراجعة' : 'Rev'}</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                );
                                                            })}
                                                            <TableCell className="text-center font-bold text-green-600 bg-green-50/30 dark:bg-green-950/10">{attendedCount}</TableCell>
                                                            <TableCell className="text-center font-bold text-red-600 bg-red-50/30 dark:bg-red-950/10">{missedCount}</TableCell>
                                                            <TableCell className="text-center font-bold bg-primary/5">
                                                                <span className={`text-xs px-2 py-0.5 rounded-full ${attendanceRate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : attendanceRate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                    {attendanceRate}%
                                                                </span>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                                {beneficiaries.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={sessions.length + 5} className="text-center py-8 text-muted-foreground">
                                                            {isRTL ? 'لا يوجد طلاب مسجلين' : 'No students enrolled'}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile View - Student Cards with detailed history dialog */}
                                    <div className="sm:hidden space-y-3">
                                        {beneficiaries.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                                                {isRTL ? 'لا يوجد طلاب مسجلين' : 'No students enrolled'}
                                            </div>
                                        ) : (
                                            beneficiaries.map(beneficiary => {
                                                const stats = getStudentStats(beneficiary.id);
                                                return (
                                                    <Card key={beneficiary.id} className="border hover:border-primary/20 transition-all bg-card shadow-sm">
                                                        <CardContent className="p-4 flex flex-col gap-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar className="h-9 w-9 border border-muted">
                                                                        <AvatarImage src={beneficiary.image_url || undefined} />
                                                                        <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                            {beneficiary.name_ar?.slice(0, 2)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div>
                                                                        <div className="font-semibold text-xs text-foreground">{beneficiary.name_ar}</div>
                                                                        <div className="text-[10px] text-muted-foreground font-mono">{beneficiary.phone || '-'}</div>
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

                                {/* Ads Tab */}
                                <TabsContent value="ads" className="space-y-4 py-0 outline-none">
                                    <div className="flex justify-between items-center bg-card p-3 rounded-xl border">
                                        <div>
                                            <h3 className="font-semibold text-xs sm:text-sm">{isRTL ? 'إعلانات الحلقة' : 'Circle Ads'}</h3>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">{circleAds.length} {isRTL ? 'إعلانات مسجلة' : 'ads registered'}</p>
                                        </div>
                                    </div>

                                    {adsLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : circleAds.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                                            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-25" />
                                            <p className="font-semibold text-xs sm:text-sm">{isRTL ? 'لا توجد إعلانات لهذه الحلقة بعد' : 'No ads for this circle yet'}</p>
                                            <p className="text-[10px] mt-1">{isRTL ? 'يضيف مسؤول التسويق الإعلانات من لوحة التحكم' : 'Ads are added by the marketing admin'}</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                            {circleAds.map(ad => {
                                                const tasksDone = (ad.poster_done ? 1 : 0) + (ad.content_done ? 1 : 0);
                                                const isFullyCompleted = tasksDone === 2;

                                                return (
                                                    <Card 
                                                        key={ad.id} 
                                                        className={`overflow-hidden transition-all border bg-card hover:shadow-md ${isFullyCompleted 
                                                            ? 'border-purple-100 bg-purple-50/10 dark:border-purple-950 dark:bg-purple-950/5' 
                                                            : 'hover:border-primary/20'}`}
                                                    >
                                                        <CardContent className="p-4 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2.5 rounded-xl ${isFullyCompleted ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' : 'bg-muted text-muted-foreground'}`}>
                                                                        <Megaphone className="h-4 w-4" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-xs sm:text-sm">#{ad.ad_number}</p>
                                                                        <p className="text-[10px] text-muted-foreground">{ad.ad_date}</p>
                                                                    </div>
                                                                </div>
                                                                <Badge 
                                                                    variant="outline" 
                                                                    className={isFullyCompleted 
                                                                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 text-[10px]' 
                                                                        : 'bg-muted text-muted-foreground text-[10px]'}
                                                                >
                                                                    {isFullyCompleted 
                                                                        ? (isRTL ? 'مكتمل' : 'Completed') 
                                                                        : (isRTL ? `${tasksDone}/2 مهام` : `${tasksDone}/2 tasks`)}
                                                                </Badge>
                                                            </div>

                                                            <div className="flex flex-col gap-2 pt-2 border-t border-dashed">
                                                                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                                                                    <div className="flex items-center gap-2">
                                                                        <Checkbox
                                                                            id={`my-poster-${ad.id}`}
                                                                            checked={ad.poster_done}
                                                                            onCheckedChange={async (checked) => {
                                                                                await supabase.from('quran_circle_ads').update({ poster_done: checked, updated_at: new Date().toISOString() }).eq('id', ad.id);
                                                                                setCircleAds(prev => prev.map(a => a.id === ad.id ? { ...a, poster_done: !!checked } : a));
                                                                                toast.success(isRTL ? 'تم التحديث' : 'Updated');
                                                                            }}
                                                                            className="h-4 w-4 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                                                        />
                                                                        <label htmlFor={`my-poster-${ad.id}`} className="text-[10px] font-semibold cursor-pointer select-none">
                                                                            {isRTL ? 'تصميم البوستر الدعائي' : 'Design Promo Poster'}
                                                                        </label>
                                                                    </div>
                                                                    {ad.poster_done && <Check className="h-4 w-4 text-green-500" />}
                                                                </div>

                                                                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                                                                    <div className="flex items-center gap-2">
                                                                        <Checkbox
                                                                            id={`my-content-${ad.id}`}
                                                                            checked={ad.content_done}
                                                                            onCheckedChange={async (checked) => {
                                                                                await supabase.from('quran_circle_ads').update({ content_done: checked, updated_at: new Date().toISOString() }).eq('id', ad.id);
                                                                                setCircleAds(prev => prev.map(a => a.id === ad.id ? { ...a, content_done: !!checked } : a));
                                                                                toast.success(isRTL ? 'تم التحديث' : 'Updated');
                                                                            }}
                                                                            className="h-4 w-4 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                                                        />
                                                                        <label htmlFor={`my-content-${ad.id}`} className="text-[10px] font-semibold cursor-pointer select-none">
                                                                            {isRTL ? 'كتابة المحتوى التسويقي' : 'Write Marketing Content'}
                                                                        </label>
                                                                    </div>
                                                                    {ad.content_done && <Check className="h-4 w-4 text-green-500" />}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}
                                </TabsContent>
                            </div>
                        </div>
                    </Tabs>
                </DialogContent>
            </Dialog>



            {/* New Session Dialog */}
            <Dialog open={isSessionDialogOpen} onOpenChange={(open) => {
                setIsSessionDialogOpen(open);
                if (open) {
                    // Use local date string YYYY-MM-DD
                    const localDate = new Date();
                    const localDateString = new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    setSessionDate(localDateString);
                    setSessionNotes('');
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'جلسة جديدة' : 'New Session'}</DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'إنشاء جلسة جديدة للحلقة' : 'Create a new session for this circle'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{isRTL ? 'التاريخ' : 'Date'}</label>
                            <Input
                                type="date"
                                max={new Date().toISOString().split('T')[0]}
                                value={sessionDate}
                                onChange={e => setSessionDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                            <Textarea
                                value={sessionNotes}
                                onChange={e => setSessionNotes(e.target.value)}
                                placeholder={isRTL ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsSessionDialogOpen(false)}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleCreateSession}>
                            {isRTL ? 'إنشاء وتسجيل الحضور' : 'Create & Record Attendance'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Attendance Dialog */}
            <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
                <DialogContent className="w-full h-full sm:w-[calc(100%-1.5rem)] sm:max-w-xl sm:h-auto sm:max-h-[85vh] p-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl">
                    <DialogHeader className="p-4 sm:p-6 border-b shrink-0 text-center sm:text-center flex flex-col items-center relative">
                        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold mt-2 sm:mt-0">
                            <Users className="h-5 w-5 text-primary" />
                            <span>{isRTL ? 'تسجيل الحضور' : 'Record Attendance'}</span>
                            {selectedSession && (
                                <Badge variant="secondary" className="ml-2 font-mono">
                                    {format(new Date(selectedSession.session_date), 'd MMM', { locale })}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {isRTL ? 'حدد الطلاب الحاضرين لهذه الجلسة ونوع الحفظ' : 'Select attendees for this session and their type'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Filter and search actions */}
                    <div className="p-4 border-b shrink-0 space-y-3 bg-muted/10">
                        {/* Quick Actions */}
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={markAllPresent} className="flex-1 text-xs">
                                <Check className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5 text-green-600" />
                                {isRTL ? 'حاضر للكل' : 'Mark All Present'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setAttendance([])} className="flex-1 text-xs">
                                <X className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5 text-red-600" />
                                {isRTL ? 'غائب للكل' : 'Clear All'}
                            </Button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute ltr:left-3 rtl:right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={isRTL ? 'بحث عن طالب...' : 'Search student...'}
                                value={beneficiarySearch}
                                onChange={e => setBeneficiarySearch(e.target.value)}
                                className="ltr:pl-9 rtl:pr-9 h-9 text-xs"
                            />
                        </div>
                    </div>

                    {/* Scrollable Students List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {filteredBeneficiaries.map(b => {
                            const isPresent = attendance.some(a => a.beneficiary_id === b.id);
                            const attendanceRecord = attendance.find(a => a.beneficiary_id === b.id);

                            return (
                                <div
                                    key={b.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isPresent 
                                        ? 'border-green-200 bg-green-50/20 dark:border-green-950 dark:bg-green-950/5' 
                                        : 'hover:bg-muted/40 border-transparent'
                                    }`}
                                    onClick={() => toggleBeneficiary(b.id)}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <Checkbox 
                                            checked={isPresent} 
                                            onCheckedChange={() => {}} // toggled by row click
                                            className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                        />
                                        <Avatar className="h-9 w-9 border border-muted shrink-0">
                                            <AvatarImage src={b.image_url || undefined} />
                                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-semibold">{b.name_ar?.slice(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-semibold text-xs text-foreground block truncate">{b.name_ar}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono block truncate">{b.phone || '-'}</span>
                                        </div>
                                    </div>

                                    {isPresent && (
                                        <div 
                                            className="flex items-center gap-0.5 bg-background rounded-lg border p-0.5 shadow-sm"
                                            onClick={(e) => e.stopPropagation()} // prevent row toggle
                                        >
                                            <button
                                                type="button"
                                                onClick={() => updateAttendanceType(b.id, 'memorization')}
                                                className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${attendanceRecord?.attendance_type === 'memorization'
                                                    ? 'bg-green-600 text-white shadow-sm'
                                                    : 'hover:bg-muted text-muted-foreground'
                                                    }`}
                                            >
                                                {isRTL ? 'حفظ' : 'Mem'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateAttendanceType(b.id, 'revision')}
                                                className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${attendanceRecord?.attendance_type === 'revision'
                                                    ? 'bg-amber-500 text-white shadow-sm'
                                                    : 'hover:bg-muted text-muted-foreground'
                                                    }`}
                                            >
                                                {isRTL ? 'مراجعة' : 'Rev'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredBeneficiaries.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                {isRTL ? 'لا يوجد نتائج للبحث' : 'No search results'}
                            </div>
                        )}
                    </div>

                    {/* Sticky Footer Summary & Save */}
                    <div className="p-4 border-t shrink-0 bg-background space-y-3">
                        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                            <span className="text-xs font-semibold text-muted-foreground">{isRTL ? 'إحصائيات الحضور:' : 'Present Summary:'}</span>
                            <div className="flex items-center gap-2">
                                <Badge className="text-sm px-2.5 bg-primary text-primary-foreground font-bold">{attendance.length}</Badge>
                                <span className="text-muted-foreground text-xs">/ {beneficiaries.length} {isRTL ? 'طالب' : 'students'}</span>
                            </div>
                        </div>

                        {beneficiaries.length > 0 && (
                            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-1.5 rounded-full transition-all"
                                    style={{ width: `${(attendance.length / beneficiaries.length) * 100}%` }}
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" size="sm" onClick={() => setIsAttendanceDialogOpen(false)} className="flex-1 sm:flex-none">
                                {isRTL ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button onClick={handleSaveAttendance} size="sm" className="bg-primary text-primary-foreground font-bold flex-1 sm:flex-none">
                                {isRTL ? 'حفظ الحضور' : 'Save Attendance'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Beneficiary Dialog */}
            <Dialog open={isEditStudentDialogOpen} onOpenChange={setIsEditStudentDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5 text-primary" />
                            {isRTL ? 'تعديل بيانات المستفيد' : 'Edit Beneficiary Details'}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'تحديث المعلومات الخاصة بالطالب المسجل' : 'Update the registered student information'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">{isRTL ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</label>
                            <Input
                                placeholder={isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}
                                value={newBeneficiary.name_ar}
                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name_ar: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">{isRTL ? 'رقم الهاتف' : 'Phone'}</label>
                            <Input
                                placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                                value={newBeneficiary.phone}
                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, phone: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">{isRTL ? 'النوع' : 'Gender'}</label>
                                <Select
                                    value={newBeneficiary.gender}
                                    onValueChange={(val: 'male' | 'female') => setNewBeneficiary({ ...newBeneficiary, gender: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">{isRTL ? 'ذكر' : 'Male'}</SelectItem>
                                        <SelectItem value="female">{isRTL ? 'أنثى' : 'Female'}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">{isRTL ? 'نوع المستفيد' : 'Type'}</label>
                                <Select
                                    value={newBeneficiary.beneficiary_type}
                                    onValueChange={(val: 'adult' | 'child') => setNewBeneficiary({ ...newBeneficiary, beneficiary_type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="adult">{isRTL ? 'بالغ' : 'Adult'}</SelectItem>
                                        <SelectItem value="child">{isRTL ? 'طفل' : 'Child'}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setIsEditStudentDialogOpen(false)}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button 
                            onClick={async () => {
                                await handleAddBeneficiary();
                                setIsEditStudentDialogOpen(false);
                            }}
                            className="bg-primary text-primary-foreground font-semibold"
                        >
                            {isRTL ? 'حفظ التعديلات' : 'Save Changes'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Student Attendance History Dialog (Mobile only but accessible) */}
            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="w-full h-full sm:w-[calc(100%-1.5rem)] sm:max-w-md sm:h-auto sm:max-h-[85vh] p-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl">
                    <DialogHeader className="p-4 border-b shrink-0 text-center sm:text-center flex flex-col items-center">
                        <DialogTitle className="text-base font-bold flex items-center gap-2 mt-2 sm:mt-0">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={historyStudent?.image_url || undefined} />
                                <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{historyStudent?.name_ar?.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span>{historyStudent && historyStudent.name_ar}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {isRTL ? 'تعديل سجل الحضور التفصيلي لجميع الجلسات' : 'Edit detailed attendance history for all sessions'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Scrollable Timeline */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {sessions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                {isRTL ? 'لا توجد جلسات في هذه الحلقة بعد' : 'No sessions in this circle yet'}
                            </div>
                        ) : (
                            sessions.map((s, idx) => {
                                if (!historyStudent) return null;
                                const attendanceRecord = attendanceData[s.id]?.find(a => a.beneficiary_id === historyStudent.id);
                                const isPresent = !!attendanceRecord;

                                return (
                                    <div 
                                        key={s.id} 
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isPresent 
                                            ? 'border-green-200 dark:border-green-950 bg-green-50/20 dark:bg-green-950/5' 
                                            : 'bg-muted/10'
                                        }`}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-mono text-[10px] text-muted-foreground font-semibold">#{sessions.length - idx}</span>
                                            <span className="font-medium text-xs">
                                                {format(new Date(s.session_date), 'EEEE, d MMMM', { locale })}
                                            </span>
                                            {s.notes && <span className="text-[10px] text-muted-foreground line-clamp-1 italic max-w-[180px]">"{s.notes}"</span>}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Status Switch or Checkbox */}
                                            <div className="flex items-center gap-1">
                                                <label className="text-xs cursor-pointer select-none" htmlFor={`hist-att-${s.id}`}>
                                                    {isPresent ? (
                                                        <span className="text-green-600 dark:text-green-400 font-semibold">{isRTL ? 'حاضر' : 'Present'}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">{isRTL ? 'غائب' : 'Absent'}</span>
                                                    )}
                                                </label>
                                                <Checkbox
                                                    id={`hist-att-${s.id}`}
                                                    checked={isPresent}
                                                    onCheckedChange={() => toggleCircleAttendance(s.id, historyStudent.id)}
                                                    className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                                />
                                            </div>

                                            {/* If present, choice between Memorization and Revision */}
                                            {isPresent && (
                                                <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg border">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSheetAttendanceType(s.id, historyStudent.id, 'memorization')}
                                                        className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${attendanceRecord?.attendance_type === 'memorization'
                                                            ? 'bg-green-600 text-white shadow-sm'
                                                            : 'hover:bg-muted text-muted-foreground'
                                                            }`}
                                                    >
                                                        {isRTL ? 'حفظ' : 'Mem'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSheetAttendanceType(s.id, historyStudent.id, 'revision')}
                                                        className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${attendanceRecord?.attendance_type === 'revision'
                                                            ? 'bg-amber-500 text-white shadow-sm'
                                                            : 'hover:bg-muted text-muted-foreground'
                                                            }`}
                                                    >
                                                        {isRTL ? 'مراجعة' : 'Rev'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-4 border-t shrink-0 flex justify-end">
                        <Button className="w-full sm:w-auto" onClick={() => setIsHistoryDialogOpen(false)}>
                            {isRTL ? 'إغلاق' : 'Close'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Session Confirmation */}
            <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'حذف الجلسة' : 'Delete Session'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? 'هل أنت متأكد من حذف هذه الجلسة؟ سيتم حذف جميع بيانات الحضور المرتبطة بها.'
                                : 'Are you sure? All attendance data for this session will be deleted.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isRTL ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Unenroll Beneficiary Confirmation */}
            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <UserMinus className="w-5 h-5" />
                            {isRTL ? 'تأكيد إزالة المستفيد' : 'Confirm Removal'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                            {isRTL
                                ? `هل أنت متأكد من إزالة المستفيد "${beneficiaryToDelete?.name_ar}" من الحلقة؟`
                                : `Are you sure you want to remove "${beneficiaryToDelete?.name_ar}" from the circle?`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="flex-1 sm:flex-none">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleUnenrollBeneficiary}
                            className="flex-1 sm:flex-none bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            <UserMinus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                            {isRTL ? 'إزالة' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Leave Circle Confirmation */}
            <AlertDialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
                <AlertDialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="w-5 h-5" />
                            {isRTL ? 'تأكيد المغادرة' : 'Confirm Departure'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                            {isRTL
                                ? `هل أنت متأكد من إزالة نفسك ك${leaveType === 'organizer' ? 'منظم' : 'مسوق'} من هذه الحلقة؟`
                                : `Are you sure you want to remove yourself as a ${leaveType === 'organizer' ? 'organizer' : 'marketer'} from this circle?`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="flex-1 sm:flex-none">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmLeaveCircle}
                            className="flex-1 sm:flex-none bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isRTL ? 'مغادرة' : 'Leave'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
