import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
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
    MoreHorizontal, Loader2, Download, Globe, MapPin, MonitorPlay, User, CalendarDays, TrendingUp, Percent, UserPlus, Pencil, UserMinus, Search

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
import * as XLSX from 'xlsx';
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
    teaching_mode?: 'online' | 'offline' | 'mixed';
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

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MyQuranCircles() {
    const { user } = useAuth();
    const { isRTL } = useLanguage();
    const locale = isRTL ? ar : enUS;
    const [searchParams, setSearchParams] = useSearchParams();

    // Main state
    const [circles, setCircles] = useState<QuranCircle[]>([]);
    const [loading, setLoading] = useState(true);

    // Details dialog
    const [selectedCircle, setSelectedCircle] = useState<QuranCircle | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
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

    useEffect(() => {
        if (user) fetchMyCircles();
    }, [user]);

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
    }, [searchParams, circles]);

    const fetchMyCircles = async () => {
        setLoading(true);
        try {
            const { data: organizerData, error: orgError } = await supabase
                .from('quran_circle_organizers')
                .select('circle_id')
                .eq('volunteer_id', user?.id);

            if (orgError) throw orgError;

            const circleIds = organizerData?.map(o => o.circle_id) || [];

            if (circleIds.length === 0) {
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
                .in('id', circleIds)
                .eq('is_active', true);

            if (error) throw error;

            // Fetch session counts separately to avoid ambiguous filter
            const { data: sessionData } = await supabase
                .from('quran_circle_sessions')
                .select('circle_id')
                .in('circle_id', circleIds);

            const sessionCounts: Record<string, number> = {};
            (sessionData || []).forEach(s => {
                sessionCounts[s.circle_id] = (sessionCounts[s.circle_id] || 0) + 1;
            });

            // Fetch teachers separately to avoid join issues
            const { data: teachersData } = await supabase
                .from('quran_teachers')
                .select('id, name, target_gender, teaching_mode');

            // Store full teacher object in map
            const teachersMap = new Map(teachersData?.map(t => [t.id, t]) || []);

            // Fetch enrolled counts
            const { data: enrollments } = await supabase
                .from('quran_enrollments')
                .select('circle_id')
                .in('circle_id', circleIds)
                .eq('status', 'active');

            const enrollmentCounts: Record<string, number> = {};
            (enrollments || []).forEach(e => {
                enrollmentCounts[e.circle_id] = (enrollmentCounts[e.circle_id] || 0) + 1;
            });

            const formatted: QuranCircle[] = (data?.map((c: any) => {
                const teacher = teachersMap.get(c.teacher_id);
                return {
                    id: c.id,
                    teacher_id: c.teacher_id,
                    teacher_name: teacher?.name,
                    target_group: c.target_group,
                    teacher_gender: teacher?.target_gender,
                    teaching_mode: teacher?.teaching_mode as 'online' | 'offline' | 'mixed' | undefined,
                    description: c.description,
                    beneficiary_gender: c.beneficiary_gender,
                    is_active: true, // filtered by is_active=true anyway
                    schedule: c.schedule || [],
                    sessions_count: sessionCounts[c.id] || 0,
                    enrolled_count: enrollmentCounts[c.id] || 0
                };
            }) || []) as QuranCircle[];

            setCircles(formatted);
        } catch (error) {
            console.error('Error fetching circles:', error);
            toast.error(isRTL ? 'فشل تحميل الحلقات' : 'Failed to fetch circles');
        } finally {
            setLoading(false);
        }
    };

    const openCircleDetails = async (circle: QuranCircle) => {
        setSelectedCircle(circle);
        setIsDetailsOpen(true);

        // Fetch sessions
        const { data: sessionsData } = await supabase
            .from('quran_circle_sessions')
            .select('*, quran_circle_beneficiaries(count)')
            .eq('circle_id', circle.id)
            .order('session_date', { ascending: false })
            .limit(50);

        const formattedSessions = sessionsData?.map((s: any) => ({
            ...s,
            attendees_count: s.quran_circle_beneficiaries?.[0]?.count || 0
        })) || [];
        setSessions(formattedSessions);

        // Fetch enrolled beneficiaries
        const { data: enrolledData, error } = await supabase
            .from('quran_enrollments')
            .select(`
                beneficiary_id,
                quran_beneficiaries!inner(id, name_ar, name_en, image_url, phone, gender, beneficiary_type)
            `)
            .eq('circle_id', circle.id)
            .eq('status', 'active');

        if (!error && enrolledData) {
            const bens = enrolledData.map((e: any) => ({
                id: e.quran_beneficiaries.id,
                name_ar: e.quran_beneficiaries.name_ar,
                name_en: e.quran_beneficiaries.name_en,
                image_url: e.quran_beneficiaries.image_url,
                phone: e.quran_beneficiaries.phone,
                gender: e.quran_beneficiaries.gender,
                beneficiary_type: e.quran_beneficiaries.beneficiary_type
            }));
            setBeneficiaries(bens);
        }

        // Fetch attendance for all sessions
        if (formattedSessions.length > 0) {
            const sessionIds = formattedSessions.map(s => s.id);
            const { data: attData } = await supabase
                .from('quran_circle_beneficiaries')
                .select('session_id, beneficiary_id, attendance_type')
                .in('session_id', sessionIds);

            const attMap: Record<string, Attendance[]> = {};
            (attData || []).forEach((a: any) => {
                if (!attMap[a.session_id]) attMap[a.session_id] = [];
                attMap[a.session_id].push({
                    beneficiary_id: a.beneficiary_id,
                    attendance_type: a.attendance_type || 'memorization'
                });
            });
            setAttendanceData(attMap);
        }
    };

    const handleCreateSession = async () => {
        if (!selectedCircle) return;

        if (new Date(sessionDate) > new Date()) {
            toast.error(isRTL ? 'لا يمكن إنشاء جلسة في المستقبل' : 'Cannot create future session');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('quran_circle_sessions')
                .insert({
                    circle_id: selectedCircle.id,
                    session_date: sessionDate,
                    notes: sessionNotes || null
                })
                .select()
                .single();

            if (error) throw error;

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
        } catch (error: any) {
            console.error('Error creating session:', error);
            toast.error(error.message || 'Error occurred');
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
            // Delete existing
            await supabase
                .from('quran_circle_beneficiaries')
                .delete()
                .eq('session_id', selectedSession.id);

            // Handle guests - create or find them as beneficiaries
            const guestPhones = [...new Set(guests.map(g => g.phone).filter(Boolean))];
            const guestMap = new Map<string, string>(); // phone -> id

            if (guestPhones.length > 0) {
                // 1. Find existing beneficiaries
                const { data: existingBens } = await supabase
                    .from('quran_beneficiaries')
                    .select('id, phone')
                    .in('phone', guestPhones);

                existingBens?.forEach(b => guestMap.set(b.phone, b.id));

                // 2. Identify new beneficiaries
                const newGuests = guests.filter(g => g.phone && !guestMap.has(g.phone));

                // Deduplicate new guests by phone to avoid double insert attempt
                const uniqueNewGuests = new Map<string, Guest>();
                newGuests.forEach(g => uniqueNewGuests.set(g.phone, g));

                if (uniqueNewGuests.size > 0) {
                    const toInsert = Array.from(uniqueNewGuests.values()).map(g => ({
                        name_ar: g.name,
                        phone: g.phone,
                        gender: 'male',
                        beneficiary_type: 'adult'
                    }));

                    const { data: createdBens, error: createError } = await supabase
                        .from('quran_beneficiaries')
                        .insert(toInsert)
                        .select('id, phone');

                    if (createError) throw createError;

                    createdBens?.forEach(b => guestMap.set(b.phone, b.id));
                }
            }

            // Prepare all attendance records
            const allRecords = [];

            // Add enrolled attendance
            if (attendance.length > 0) {
                attendance.forEach(a => {
                    allRecords.push({
                        session_id: selectedSession.id,
                        circle_id: selectedCircle.id,
                        beneficiary_id: a.beneficiary_id,
                        attendance_type: a.attendance_type
                    });
                });
            }

            // Add guest attendance
            for (const guest of guests) {
                const beneficiaryId = guestMap.get(guest.phone);

                if (beneficiaryId) {
                    allRecords.push({
                        session_id: selectedSession.id,
                        circle_id: selectedCircle.id,
                        beneficiary_id: beneficiaryId,
                        attendance_type: 'memorization'
                    });
                }
            }

            // Single Bulk Insert
            if (allRecords.length > 0) {
                const { error } = await supabase
                    .from('quran_circle_beneficiaries')
                    .insert(allRecords);

                if (error) throw error;
            }

            toast.success(isRTL ? 'تم حفظ الحضور' : 'Attendance saved');
            setIsAttendanceDialogOpen(false);
            await openCircleDetails(selectedCircle);
        } catch (error: any) {
            console.error('Error saving attendance:', error);
            toast.error(error.message || 'Error occurred');
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
            // Delete attendance records first
            await supabase
                .from('quran_circle_beneficiaries')
                .delete()
                .eq('session_id', deleteSessionId);

            const { error } = await supabase
                .from('quran_circle_sessions')
                .delete()
                .eq('id', deleteSessionId);

            if (error) throw error;
            toast.success(isRTL ? 'تم حذف الجلسة' : 'Session deleted');
            setDeleteSessionId(null);
            await openCircleDetails(selectedCircle);
        } catch (error: any) {
            console.error('Error deleting session:', error);
            toast.error(error.message || 'Error deleting session');
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
                            beneficiary_type: newBeneficiary.beneficiary_type
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
            await openCircleDetails(selectedCircle);
            // fetchCircles(); // Refresh counts if needed

        } catch (error: any) {
            console.error('Error saving beneficiary:', error);
            toast.error(error.message || (isRTL ? 'حدث خطأ أثناء الحفظ' : 'Error saving beneficiary'));
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

            // Fetch sessions
            const { data: sessionsData } = await supabase
                .from('quran_circle_sessions')
                .select('*')
                .eq('circle_id', circle.id)
                .order('session_date', { ascending: true });

            // Fetch enrolled beneficiaries
            const { data: enrolledData } = await supabase
                .from('quran_enrollments')
                .select(`
                    beneficiary_id,
                    quran_beneficiaries(id, name_ar, name_en)
                `)
                .eq('circle_id', circle.id)
                .eq('status', 'active');

            const bens = (enrolledData || []).map((e: any) => ({
                id: e.quran_beneficiaries.id,
                name_ar: e.quran_beneficiaries.name_ar,
                name_en: e.quran_beneficiaries.name_en
            }));

            // Fetch all attendance
            const sessionIds = (sessionsData || []).map(s => s.id);
            const { data: attData } = sessionIds.length > 0 ? await supabase
                .from('quran_circle_beneficiaries')
                .select('session_id, beneficiary_id, attendance_type')
                .in('session_id', sessionIds) : { data: [] };

            const attendanceBySession: Record<string, Record<string, string>> = {};
            (attData || []).forEach((a: any) => {
                if (!attendanceBySession[a.session_id]) {
                    attendanceBySession[a.session_id] = {};
                }
                attendanceBySession[a.session_id][a.beneficiary_id] = a.attendance_type;
            });

            // Circle Info Sheet
            const circleInfo = [{
                [isRTL ? 'اسم الحلقة' : 'Circle Name']: getCircleName(circle),
                [isRTL ? 'المحفظ' : 'Teacher']: circle.teacher_name || '-',
                [isRTL ? 'الأيام' : 'Days']: getScheduleDisplay(circle.schedule),
                [isRTL ? 'الوقت' : 'Time']: getScheduleTime(circle.schedule) || '-',
                [isRTL ? 'عدد المسجلين' : 'Enrolled Count']: bens.length,
                [isRTL ? 'عدد الجلسات' : 'Sessions Count']: sessionsData?.length || 0
            }];

            // Sessions Sheet
            const sessionsSheet = (sessionsData || []).map((s: any, idx: number) => {
                const attCount = Object.keys(attendanceBySession[s.id] || {}).length;
                return {
                    [isRTL ? 'رقم الجلسة' : 'Session #']: idx + 1,
                    [isRTL ? 'التاريخ' : 'Date']: s.session_date,
                    [isRTL ? 'اليوم' : 'Day']: format(new Date(s.session_date), 'EEEE', { locale }),
                    [isRTL ? 'عدد الحضور' : 'Attendees']: attCount,
                    [isRTL ? 'ملاحظات' : 'Notes']: s.notes || '-'
                };
            });

            // Attendance Sheet
            const attendanceSheet = bens.map(ben => {
                const row: any = {
                    [isRTL ? 'الاسم' : 'Name']: ben.name_ar,
                    [isRTL ? 'الاسم الانجليزي' : 'English Name']: ben.name_en || '-'
                };

                let totalAttended = 0;
                let memorization = 0;
                let revision = 0;

                (sessionsData || []).forEach((s: any, idx: number) => {
                    const colName = isRTL ? `ج${idx + 1}` : `S${idx + 1}`;
                    const attType = attendanceBySession[s.id]?.[ben.id];

                    if (attType) {
                        totalAttended++;
                        if (attType === 'memorization') {
                            row[colName] = isRTL ? 'حفظ' : 'M';
                            memorization++;
                        } else {
                            row[colName] = isRTL ? 'مراجعة' : 'R';
                            revision++;
                        }
                    } else {
                        row[colName] = '-';
                    }
                });

                row[isRTL ? 'إجمالي الحضور' : 'Total'] = totalAttended;
                row[isRTL ? 'حفظ' : 'Memorization'] = memorization;
                row[isRTL ? 'مراجعة' : 'Revision'] = revision;
                row[isRTL ? 'نسبة الحضور' : 'Attendance %'] = sessionsData?.length
                    ? `${Math.round((totalAttended / sessionsData.length) * 100)}%`
                    : '0%';

                return row;
            });

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(circleInfo), isRTL ? 'معلومات الحلقة' : 'Circle Info');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessionsSheet), isRTL ? 'الجلسات' : 'Sessions');
            if (attendanceSheet.length > 0) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendanceSheet), isRTL ? 'شيت الحضور' : 'Attendance');
            }

            const fileName = `${getCircleName(circle).replace(/[^a-zA-Z0-9أ-ي]/g, '_')}_Report.xlsx`;
            XLSX.writeFile(wb, fileName);
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
                    {isRTL ? 'الحلقات اللي بتنظمها' : 'Circles you are organizing'}
                </p>
            </div>

            {/* Circles Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {circles.map(circle => (
                    <Card key={circle.id} className="group hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{getCircleName(circle)}</CardTitle>
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
                ))}

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

            {/* Circle Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedCircle && getCircleName(selectedCircle)}</DialogTitle>
                        <DialogDescription>
                            {selectedCircle && getScheduleDisplay(selectedCircle.schedule)} • {getScheduleTime(selectedCircle?.schedule || [])}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="sessions" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="beneficiaries">{isRTL ? 'المستفيدين' : 'Beneficiaries'}</TabsTrigger>
                            <TabsTrigger value="sessions">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger>
                            <TabsTrigger value="sheet">{isRTL ? 'شيت الحضور' : 'Attendance Sheet'}</TabsTrigger>
                        </TabsList>

                        {/* Beneficiaries Tab */}
                        <TabsContent value="beneficiaries" className="space-y-4 py-4">
                            {/* Add Beneficiary Form */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">{isRTL ? 'إضافة مستفيد جديد' : 'Add New Beneficiary'}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col gap-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                            <Input
                                                placeholder={isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}
                                                value={newBeneficiary.name_ar}
                                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name_ar: e.target.value })}
                                            />
                                            <Input
                                                placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                                                value={newBeneficiary.phone}
                                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, phone: e.target.value })}
                                            />
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
                                        <div className="flex justify-end">
                                            <Button onClick={handleAddBeneficiary} className="w-full sm:w-auto">
                                                <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'إضافة' : 'Add'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Beneficiaries Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                <TableHead>{isRTL ? 'رقم الهاتف' : 'Phone'}</TableHead>
                                                <TableHead>{isRTL ? 'النوع' : 'Gender'}</TableHead>
                                                <TableHead>{isRTL ? 'الفئة' : 'Type'}</TableHead>
                                                <TableHead className="w-24"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredSessionBeneficiaries.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        {isRTL ? 'لا يوجد مستفيدين' : 'No beneficiaries found'}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredSessionBeneficiaries.map((b) => (
                                                    <TableRow key={b.id}>
                                                        <TableCell className="font-medium">
                                                            {/* Inline Edit for Name */}
                                                            {editingBeneficiary?.id === b.id ? (
                                                                <Input
                                                                    value={newBeneficiary.name_ar}
                                                                    onChange={e => setNewBeneficiary({ ...newBeneficiary, name_ar: e.target.value })}
                                                                    className="h-8"
                                                                />
                                                            ) : (
                                                                <div>
                                                                    <div>{b.name_ar}</div>
                                                                    {b.name_en && <div className="text-xs text-muted-foreground">{b.name_en}</div>}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editingBeneficiary?.id === b.id ? (
                                                                <Input
                                                                    value={newBeneficiary.phone}
                                                                    onChange={e => setNewBeneficiary({ ...newBeneficiary, phone: e.target.value })}
                                                                    className="h-8"
                                                                />
                                                            ) : (
                                                                b.phone || '-'
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editingBeneficiary?.id === b.id ? (
                                                                <Select
                                                                    value={newBeneficiary.gender}
                                                                    onValueChange={(val: 'male' | 'female') => setNewBeneficiary({ ...newBeneficiary, gender: val })}
                                                                >
                                                                    <SelectTrigger className="h-8">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="male">{isRTL ? 'ذكر' : 'Male'}</SelectItem>
                                                                        <SelectItem value="female">{isRTL ? 'أنثى' : 'Female'}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <span className={b.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}>
                                                                    {b.gender === 'male' ? (isRTL ? 'ذكر' : 'Male') : (isRTL ? 'أنثى' : 'Female')}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editingBeneficiary?.id === b.id ? (
                                                                <Select
                                                                    value={newBeneficiary.beneficiary_type}
                                                                    onValueChange={(val: 'adult' | 'child') => setNewBeneficiary({ ...newBeneficiary, beneficiary_type: val })}
                                                                >
                                                                    <SelectTrigger className="h-8">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="adult">{isRTL ? 'بالغ' : 'Adult'}</SelectItem>
                                                                        <SelectItem value="child">{isRTL ? 'طفل' : 'Child'}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <Badge variant="outline">
                                                                    {b.beneficiary_type === 'adult' ? (isRTL ? 'بالغ' : 'Adult') : (isRTL ? 'طفل' : 'Child')}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editingBeneficiary?.id === b.id ? (
                                                                <div className="flex gap-1">
                                                                    <Button size="sm" variant="ghost" onClick={handleAddBeneficiary}>
                                                                        <Check className="w-4 h-4 text-green-600" />
                                                                    </Button>
                                                                    <Button size="sm" variant="ghost" onClick={() => {
                                                                        setEditingBeneficiary(null);
                                                                        setNewBeneficiary({
                                                                            name_ar: '', name_en: '', phone: '', gender: 'male', beneficiary_type: 'adult'
                                                                        });
                                                                    }}>
                                                                        <X className="w-4 h-4 text-red-600" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-1">
                                                                    <Button size="sm" variant="ghost" onClick={() => {
                                                                        setEditingBeneficiary(b);
                                                                        setNewBeneficiary({
                                                                            name_ar: b.name_ar, name_en: b.name_en || '', phone: b.phone || '', gender: b.gender || 'male', beneficiary_type: b.beneficiary_type || 'adult'
                                                                        });
                                                                    }}>
                                                                        <Pencil className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button size="sm" variant="ghost" onClick={async () => {
                                                                        if (!confirm(isRTL ? 'هل أنت متأكد من إزالة هذا المستفيد من الحلقة؟' : 'Are you sure you want to remove this beneficiary?')) return;
                                                                        try {
                                                                            const { error } = await supabase
                                                                                .from('quran_enrollments')
                                                                                .update({ status: 'inactive' })
                                                                                .eq('circle_id', selectedCircle?.id)
                                                                                .eq('beneficiary_id', b.id);

                                                                            if (error) throw error;
                                                                            toast.success(isRTL ? 'تم إلغاء التسجيل' : 'Unenrolled successfully');
                                                                            if (selectedCircle) openCircleDetails(selectedCircle);
                                                                            fetchMyCircles();
                                                                        } catch (err: any) {
                                                                            toast.error(err.message);
                                                                        }
                                                                    }}>
                                                                        <UserMinus className="w-4 h-4 text-destructive" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {isRTL ? `إجمالي المستفيدين: ${filteredSessionBeneficiaries.length}` : `Total beneficiaries: ${filteredSessionBeneficiaries.length}`}
                            </div>
                        </TabsContent>

                        {/* Sessions Tab */}
                        <TabsContent value="sessions" className="space-y-4 py-4">
                            {/* Add Session Button */}
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold">{isRTL ? 'الجلسات' : 'Sessions'}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {sessions.length} {isRTL ? 'جلسة' : 'sessions'}
                                    </p>
                                </div>
                                <Button onClick={() => {
                                    if (selectedCircle) {
                                        setSessionDate(getNextScheduleDate(selectedCircle.schedule));
                                    }
                                    setIsSessionDialogOpen(true);
                                }} size="sm">
                                    <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                    {isRTL ? 'جلسة جديدة' : 'New Session'}
                                </Button>
                            </div>

                            {beneficiaries.length === 0 && (
                                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {isRTL
                                        ? 'يمكنك إضافة مستفيدين جديد من تبويب المستفيدين.'
                                        : 'You can add new beneficiaries from the Beneficiaries tab.'}
                                </div>
                            )}

                            {/* Sessions List */}
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {sessions.map((session, index) => {
                                    const rate = getAttendanceRate(session);
                                    const hasAttendance = session.attendees_count > 0;
                                    return (
                                        <div
                                            key={session.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm ${hasAttendance
                                                ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10 hover:bg-green-50 dark:hover:bg-green-950/20'
                                                : 'hover:bg-muted/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${hasAttendance ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary/10'}`}>
                                                    <Calendar className={`h-4 w-4 ${hasAttendance ? 'text-green-600 dark:text-green-400' : 'text-primary'}`} />
                                                </div>
                                                <div>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono">
                                                                #{sessions.length - index}
                                                            </Badge>
                                                            <p className="font-medium">
                                                                {format(new Date(session.session_date), 'EEEE, d MMMM', { locale })}
                                                            </p>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {isRTL ? 'الحضور:' : 'Attendance:'} <span className={hasAttendance ? 'font-bold text-green-600 dark:text-green-400' : ''}>{session.attendees_count || 0}</span> / {beneficiaries.length}
                                                        </p>
                                                        {session.notes && (
                                                            <div className="flex items-start gap-1 mt-2 text-xs text-muted-foreground bg-muted/50 p-1.5 rounded w-full">
                                                                <span className="shrink-0 mt-0.5">📝</span>
                                                                <span className="break-words line-clamp-2">{session.notes}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {rate !== null && hasAttendance && (
                                                    <Badge variant="secondary" className={`text-xs ${rate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        rate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                        <Percent className="h-3 w-3 ltr:mr-0.5 rtl:ml-0.5" />
                                                        {rate}
                                                    </Badge>
                                                )}
                                                <Badge variant={hasAttendance ? 'default' : 'outline'}>
                                                    <Users className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                                    {session.attendees_count || 0}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteSessionId(session.id);
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {sessions.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <div className="p-3 rounded-full bg-muted/50 mb-3">
                                            <Calendar className="h-8 w-8 opacity-30" />
                                        </div>
                                        <p className="font-medium">{isRTL ? 'لا توجد جلسات بعد' : 'No sessions yet'}</p>
                                        <p className="text-sm mt-1">{isRTL ? 'أنشئ أول جلسة للبدء' : 'Create the first session to get started'}</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Attendance Sheet Tab */}
                        <TabsContent value="sheet" className="py-4">
                            <div className="border rounded-lg overflow-x-auto max-h-[600px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[200px] sticky left-0 z-10 bg-background shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#1f2937]">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                            <TableHead className="min-w-[120px]">{isRTL ? 'رقم الهاتف' : 'Phone'}</TableHead>
                                            {sessions.map((s, idx) => (
                                                <TableHead key={s.id} className="text-center min-w-[80px]">
                                                    <div className="flex flex-col items-center">
                                                        <span>{idx + 1}</span>
                                                        <span className="text-[10px] font-normal text-muted-foreground">
                                                            {format(new Date(s.session_date), 'd/M')}
                                                        </span>
                                                    </div>
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-center min-w-[80px]">{isRTL ? 'حضر' : 'Attended'}</TableHead>
                                            <TableHead className="text-center min-w-[80px]">{isRTL ? 'غاب' : 'Missed'}</TableHead>
                                            <TableHead className="text-center min-w-[80px]">{isRTL ? 'نسبة' : '%'}</TableHead>
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
                                                <TableRow key={beneficiary.id}>
                                                    <TableCell className="font-medium sticky left-0 z-10 bg-background shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#1f2937]">
                                                        {beneficiary.name_ar}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">{beneficiary.phone || '-'}</TableCell>
                                                    {sessions.map((session, idx) => {
                                                        const attendanceRecord = attendanceData[session.id]?.find(a => a.beneficiary_id === beneficiary.id);
                                                        const isPresent = !!attendanceRecord;

                                                        return (
                                                            <TableCell key={session.id} className="text-center p-2">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <Checkbox
                                                                        checked={isPresent}
                                                                        onCheckedChange={() => toggleCircleAttendance(session.id, beneficiary.id)}
                                                                        className="mx-auto"
                                                                    />
                                                                    {isPresent && (
                                                                        <Select
                                                                            value={attendanceRecord?.attendance_type}
                                                                            onValueChange={(val: 'memorization' | 'revision') => updateSheetAttendanceType(session.id, beneficiary.id, val)}
                                                                        >
                                                                            <SelectTrigger className="h-6 text-[10px] w-[65px] px-1 bg-background">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="memorization">{isRTL ? 'حفظ' : 'Mem'}</SelectItem>
                                                                                <SelectItem value="revision">{isRTL ? 'مراجعة' : 'Rev'}</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        );
                                                    })}
                                                    <TableCell className="text-center font-bold text-green-600">{attendedCount}</TableCell>
                                                    <TableCell className="text-center font-bold text-red-600">{missedCount}</TableCell>
                                                    <TableCell className="text-center font-bold">
                                                        <span className={`${attendanceRate >= 80 ? 'text-green-600' : attendanceRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
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
                        </TabsContent>
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
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {isRTL ? 'تسجيل الحضور' : 'Record Attendance'}
                            {selectedSession && (
                                <Badge variant="outline" className="ml-2">
                                    {format(new Date(selectedSession.session_date), 'd MMM', { locale })}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'حدد الحاضرين لهذه الجلسة' : 'Select attendees for this session'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Quick Actions */}
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={markAllPresent}>
                                <Check className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                                {isRTL ? 'تحديد الكل' : 'Mark All'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setAttendance([])}>
                                <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                                {isRTL ? 'إلغاء الكل' : 'Clear All'}
                            </Button>
                        </div>

                        {/* Search */}
                        <Input
                            placeholder={isRTL ? 'بحث...' : 'Search...'}
                            value={beneficiarySearch}
                            onChange={e => setBeneficiarySearch(e.target.value)}
                        />

                        {/* Beneficiaries List */}
                        <ScrollArea className="h-[300px] border rounded-md p-2">
                            <div className="space-y-1">
                                {filteredBeneficiaries.map(b => {
                                    const isPresent = attendance.some(a => a.beneficiary_id === b.id);
                                    const attendanceRecord = attendance.find(a => a.beneficiary_id === b.id);

                                    return (
                                        <div
                                            key={b.id}
                                            className={`flex items-center justify-between p-2 rounded-md ${isPresent ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 'hover:bg-muted'
                                                }`}
                                        >
                                            <div
                                                className="flex items-center gap-2 flex-1 cursor-pointer"
                                                onClick={() => toggleBeneficiary(b.id)}
                                            >
                                                <Checkbox checked={isPresent} />
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={b.image_url || undefined} />
                                                    <AvatarFallback>{b.name_ar?.slice(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{b.name_ar}</span>
                                            </div>

                                            {isPresent && (
                                                <div className="flex items-center gap-1 bg-background rounded-md border p-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateAttendanceType(b.id, 'memorization')}
                                                        className={`px-2 py-1 text-xs rounded-sm transition-all ${attendanceRecord?.attendance_type === 'memorization'
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'hover:bg-muted'
                                                            }`}
                                                    >
                                                        {isRTL ? 'حفظ' : 'Mem'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateAttendanceType(b.id, 'revision')}
                                                        className={`px-2 py-1 text-xs rounded-sm transition-all ${attendanceRecord?.attendance_type === 'revision'
                                                            ? 'bg-amber-500 text-white'
                                                            : 'hover:bg-muted'
                                                            }`}
                                                    >
                                                        {isRTL ? 'مراجعة' : 'Rev'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>

                        {/* Summary */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <span>{isRTL ? 'الحضور:' : 'Present:'}</span>
                                <div className="flex items-center gap-2">
                                    <Badge className="text-lg px-3">{attendance.length}</Badge>
                                    <span className="text-muted-foreground text-sm">/ {beneficiaries.length}</span>
                                </div>
                            </div>
                            {beneficiaries.length > 0 && (
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${(attendance.length / beneficiaries.length) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setIsAttendanceDialogOpen(false)}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleSaveAttendance}>
                            {isRTL ? 'حفظ الحضور' : 'Save Attendance'}
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
        </div>
    );
}
