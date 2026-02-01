import { useState, useEffect } from 'react';
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
    BookOpen, Calendar, Clock, Users, Plus, Check, X,
    MoreHorizontal, Loader2, Download
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

    useEffect(() => {
        if (user) fetchMyCircles();
    }, [user]);

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
                    teacher: trainers(name_ar, user_id),
                    quran_circle_sessions(id)
                `)
                .in('id', circleIds)
                .eq('is_active', true);

            if (error) throw error;

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

            const formatted = data?.map((c: any) => ({
                id: c.id,
                teacher_id: c.teacher_id,
                teacher_name: c.teacher?.name_ar,
                teacher_volunteer_id: c.teacher?.user_id,
                schedule: c.schedule || [],
                sessions_count: c.quran_circle_sessions?.length || 0,
                enrolled_count: enrollmentCounts[c.id] || 0
            })) || [];

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
                quran_beneficiaries!inner(id, name_ar, name_en, image_url)
            `)
            .eq('circle_id', circle.id)
            .eq('status', 'active');

        if (!error && enrolledData) {
            const bens = enrolledData.map((e: any) => ({
                id: e.quran_beneficiaries.id,
                name_ar: e.quran_beneficiaries.name_ar,
                name_en: e.quran_beneficiaries.name_en,
                image_url: e.quran_beneficiaries.image_url
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
            setSessionDate(new Date().toISOString().split('T')[0]);
            setSessionNotes('');



            // Refresh sessions
            await openCircleDetails(selectedCircle);

            // Auto-open attendance
            setSelectedSession(data);
            setAttendance([]);
            setIsAttendanceDialogOpen(true);
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

            // Insert new beneficiaries
            if (attendance.length > 0) {
                const records = attendance.map(a => ({
                    session_id: selectedSession.id,
                    circle_id: selectedCircle.id,
                    beneficiary_id: a.beneficiary_id,
                    attendance_type: a.attendance_type
                }));

                const { error } = await supabase
                    .from('quran_circle_beneficiaries')
                    .insert(records);

                if (error) throw error;
            }

            // Handle guests - create or find them as beneficiaries
            for (const guest of guests) {
                // First check if beneficiary exists
                const { data: existing } = await supabase
                    .from('quran_beneficiaries')
                    .select('id')
                    .eq('phone', guest.phone)
                    .single();

                let beneficiaryId = existing?.id;

                if (!beneficiaryId) {
                    // Create new beneficiary
                    const { data: newBen, error: benError } = await supabase
                        .from('quran_beneficiaries')
                        .insert({
                            name_ar: guest.name,
                            phone: guest.phone,
                            is_active: true
                        })
                        .select('id')
                        .single();

                    if (!benError && newBen) {
                        beneficiaryId = newBen.id;
                    }
                }

                if (beneficiaryId) {
                    // Add attendance for guest
                    await supabase
                        .from('quran_circle_beneficiaries')
                        .insert({
                            session_id: selectedSession.id,
                            circle_id: selectedCircle.id,
                            beneficiary_id: beneficiaryId,
                            attendance_type: 'memorization'
                        });
                }
            }

            toast.success(isRTL ? 'تم حفظ الحضور' : 'Attendance saved');
            setIsAttendanceDialogOpen(false);
            await openCircleDetails(selectedCircle);
        } catch (error: any) {
            console.error('Error saving attendance:', error);
            toast.error(error.message || 'Error occurred');
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
        const period = hours >= 12 ? (isRTL ? 'م' : 'PM') : (isRTL ? 'ص' : 'AM');
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const filteredBeneficiaries = beneficiaries.filter(b =>
        b.name_ar.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
        (b.name_en?.toLowerCase() || '').includes(beneficiarySearch.toLowerCase())
    );



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
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="w-4 h-4" />
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
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {circles.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-muted-foreground">
                        <BookOpen className="w-12 h-12 mb-2 opacity-20" />
                        <p>{isRTL ? 'لا توجد حلقات مسندة إليك' : 'No circles assigned to you'}</p>
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
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="sessions">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger>
                            <TabsTrigger value="sheet">{isRTL ? 'شيت الحضور' : 'Attendance Sheet'}</TabsTrigger>
                        </TabsList>

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
                                <Button onClick={() => setIsSessionDialogOpen(true)} size="sm">
                                    <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                    {isRTL ? 'جلسة جديدة' : 'New Session'}
                                </Button>
                            </div>

                            {beneficiaries.length === 0 && (
                                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {isRTL
                                        ? 'لا يوجد مستفيدين مسجلين. تواصل مع مسؤول القرآن.'
                                        : 'No students enrolled. Contact the Quran admin.'}
                                </div>
                            )}

                            {/* Sessions List */}
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-full bg-primary/10">
                                                <Calendar className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {format(new Date(session.session_date), 'EEEE, d MMMM', { locale })}
                                                </p>
                                                {session.notes && (
                                                    <p className="text-xs text-muted-foreground">{session.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                        <Badge variant={session.attendees_count ? 'default' : 'outline'}>
                                            <Users className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                            {session.attendees_count || 0}
                                        </Badge>
                                    </div>
                                ))}

                                {sessions.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">
                                        {isRTL ? 'لا توجد جلسات بعد' : 'No sessions yet'}
                                    </p>
                                )}
                            </div>
                        </TabsContent>

                        {/* Attendance Sheet Tab */}
                        <TabsContent value="sheet" className="py-4 space-y-4">
                            {/* Session Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{isRTL ? 'اختر الجلسة' : 'Select Session'}</label>
                                <select
                                    className="w-full p-2 border rounded-md bg-background"
                                    value={selectedSession?.id || ''}
                                    onChange={(e) => {
                                        const session = sessions.find(s => s.id === e.target.value);
                                        if (session) {
                                            setSelectedSession(session);
                                            setAttendance(attendanceData[session.id] || []);
                                            setGuests([]);
                                        } else {
                                            setSelectedSession(null);
                                            setAttendance([]);
                                        }
                                    }}
                                >
                                    <option value="">{isRTL ? '-- اختر جلسة --' : '-- Select a session --'}</option>
                                    {sessions.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {format(new Date(s.session_date), 'EEEE, d MMMM', { locale })}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedSession ? (
                                <>
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
                                        placeholder={isRTL ? 'بحث عن مستفيد...' : 'Search...'}
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

                                    {/* Guests Section */}
                                    <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                                        <h4 className="font-medium text-sm">{isRTL ? 'إضافة ضيوف' : 'Add Guests'}</h4>
                                        <div className="flex gap-2 flex-wrap">
                                            <Input
                                                placeholder={isRTL ? 'اسم الضيف' : 'Guest name'}
                                                value={guestName}
                                                onChange={e => setGuestName(e.target.value)}
                                                className="flex-1 min-w-[120px]"
                                            />
                                            <Input
                                                placeholder={isRTL ? 'رقم الضيف' : 'Guest phone'}
                                                value={guestPhone}
                                                onChange={e => setGuestPhone(e.target.value)}
                                                className="flex-1 min-w-[120px]"
                                            />
                                            <Button onClick={addGuest} size="sm">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {guests.length > 0 && (
                                            <div className="space-y-1">
                                                {guests.map((g, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary">{isRTL ? 'ضيف' : 'Guest'}</Badge>
                                                            <span>{g.name}</span>
                                                            {g.phone && <span className="text-xs text-muted-foreground">({g.phone})</span>}
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => removeGuest(i)}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Summary */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                            <span>{isRTL ? 'الحضور:' : 'Present:'}</span>
                                            <div className="flex items-center gap-2">
                                                <Badge className="text-lg px-3">{attendance.length + guests.length}</Badge>
                                                <span className="text-muted-foreground text-sm">
                                                    ({attendance.length} {isRTL ? 'مسجل' : 'enrolled'} + {guests.length} {isRTL ? 'ضيف' : 'guests'})
                                                </span>
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

                                    {/* Save Button */}
                                    <Button onClick={handleSaveAttendance} className="w-full">
                                        {isRTL ? 'حفظ الحضور' : 'Save Attendance'}
                                    </Button>
                                </>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p>{isRTL ? 'اختر جلسة لتسجيل الحضور' : 'Select a session to record attendance'}</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* New Session Dialog */}
            <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
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
        </div>
    );
}
