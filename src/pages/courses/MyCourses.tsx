import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BookOpen, Calendar, Clock, MapPin, Users, Check, X, Loader2, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Plus, Trash2, Pencil, MoreHorizontal, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    course_lectures?: { status: string }[];
}

interface CourseLecture {
    id: string;
    course_id: string;
    lecture_number: number;
    date: string;
    status: 'scheduled' | 'completed' | 'cancelled';
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
}

const ROOMS: Record<string, { en: string; ar: string }> = {
    'lab_1': { en: 'Lab 1', ar: 'لاب 1' },
    'lab_2': { en: 'Lab 2', ar: 'لاب 2' },
    'lab_3': { en: 'Lab 3', ar: 'لاب 3' },
    'lab_4': { en: 'Lab 4', ar: 'لاب 4' },
    'impact_hall': { en: 'Impact Hall', ar: 'قاعة الأثر' },
};

const DAYS_LABELS: Record<string, { en: string; ar: string }> = {
    'saturday': { en: 'Sat', ar: 'سبت' },
    'sunday': { en: 'Sun', ar: 'أحد' },
    'monday': { en: 'Mon', ar: 'إثنين' },
    'tuesday': { en: 'Tue', ar: 'ثلاثاء' },
    'wednesday': { en: 'Wed', ar: 'أربعاء' },
    'thursday': { en: 'Thu', ar: 'خميس' },
    'friday': { en: 'Fri', ar: 'جمعة' },
};

export default function MyCourses() {
    const { user } = useAuth();
    const { language, isRTL } = useLanguage();
    const locale = language === 'ar' ? ar : enUS;

    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [lectures, setLectures] = useState<CourseLecture[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<CourseBeneficiary[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, Attendance[]>>({});
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Beneficiary State
    const [newBeneficiary, setNewBeneficiary] = useState({ name: '', phone: '' });
    const [editingBeneficiary, setEditingBeneficiary] = useState<CourseBeneficiary | null>(null);


    useEffect(() => {
        if (user) fetchMyCourses();
    }, [user]);

    const fetchMyCourses = async () => {
        setLoading(true);
        try {
            // Get courses where current user is an organizer
            const { data: organizerData, error: orgError } = await supabase
                .from('course_organizers')
                .select('course_id')
                .eq('volunteer_id', user?.id);

            if (orgError) throw orgError;

            if (!organizerData || organizerData.length === 0) {
                setCourses([]);
                setLoading(false);
                return;
            }

            const courseIds = organizerData.map(o => o.course_id);

            const { data, error } = await supabase
                .from('courses')
                .select('*, course_lectures(status)')
                .in('id', courseIds)
                .order('start_date', { ascending: false });

            if (error) throw error;
            setCourses(data || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
            toast.error(isRTL ? 'فشل في تحميل الكورسات' : 'Failed to fetch courses');
        } finally {
            setLoading(false);
        }
    };

    const openCourseDetails = async (course: Course) => {
        setSelectedCourse(course);
        setIsDetailsOpen(true);

        // Fetch lectures
        const { data: lecturesData } = await supabase
            .from('course_lectures')
            .select('*')
            .eq('course_id', course.id)
            .order('lecture_number');
        setLectures((lecturesData as unknown as CourseLecture[]) || []);

        // Fetch beneficiaries
        const { data: beneficiariesData } = await supabase
            .from('course_beneficiaries')
            .select('*')
            .eq('course_id', course.id)
            .order('name');
        setBeneficiaries((beneficiariesData as CourseBeneficiary[]) || []);

        // Fetch attendance for all lectures
        if (lecturesData && lecturesData.length > 0) {
            const lectureIds = lecturesData.map(l => l.id);
            const { data: attendanceList } = await supabase
                .from('course_attendance')
                .select('*')
                .in('lecture_id', lectureIds);

            const attendanceMap: Record<string, Attendance[]> = {};
            (attendanceList || []).forEach((a: any) => {
                if (!attendanceMap[a.lecture_id]) attendanceMap[a.lecture_id] = [];
                attendanceMap[a.lecture_id].push(a);
            });
            setAttendanceData(attendanceMap);
        }
    };

    const updateLectureStatus = async (lectureId: string, status: 'scheduled' | 'completed' | 'cancelled') => {
        const { error } = await supabase
            .from('course_lectures')
            .update({ status })
            .eq('id', lectureId);

        if (error) {
            toast.error(isRTL ? 'فشل تحديث الحالة' : 'Failed to update status');
        } else {
            toast.success(isRTL ? 'تم التحديث' : 'Updated');
            setLectures(prev => prev.map(l => l.id === lectureId ? { ...l, status } : l));
        }
    };

    const isLectureOpen = (dateStr: string) => {
        const lectureDate = new Date(dateStr);
        const now = new Date();
        lectureDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        return now >= lectureDate;
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

    const formatTime = (timeStr: string | null) => {
        if (!timeStr) return '';
        try {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes);
            return format(date, 'h:mm a', { locale });
        } catch {
            return timeStr;
        }
    };

    const getRoomLabel = (room: string) => ROOMS[room]?.[language as 'en' | 'ar'] || room;

    const getProgress = (course: Course) => {
        const completed = course.course_lectures?.filter(l => l.status === 'completed').length || 0;
        return { completed, total: course.total_lectures };
    };

    // Beneficiary CRUD
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
                    created_by: user?.id
                })
                .select()
                .single();

            if (error) throw error;

            setBeneficiaries([...beneficiaries, data]);
            setNewBeneficiary({ name: '', phone: '' });
            toast.success(isRTL ? 'تم إضافة المستفيد' : 'Beneficiary added');
        } catch (error: any) {
            console.error('Error adding beneficiary:', error);
            if (error.code === '23505') {
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
                .update({ name: editingBeneficiary.name, phone: editingBeneficiary.phone })
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

    const exportCourseToExcel = async (course: Course) => {
        try {
            // Fetch organizers
            const { data: orgs } = await supabase
                .from('course_organizers')
                .select('*')
                .eq('course_id', course.id);

            // Fetch lectures
            const { data: lects } = await supabase
                .from('course_lectures')
                .select('*')
                .eq('course_id', course.id)
                .order('lecture_number');

            // Fetch beneficiaries
            const { data: beneficiariesData } = await supabase
                .from('course_beneficiaries')
                .select('*')
                .eq('course_id', course.id)
                .order('name') as { data: CourseBeneficiary[] | null };

            // Fetch attendance
            const lectureIds = (lects || []).map(l => l.id);
            const { data: attendance } = await supabase
                .from('course_attendance')
                .select('*')
                .in('lecture_id', lectureIds);

            const completedLectures = (lects || []).filter(l => l.status === 'completed').length;
            const cancelledLectures = (lects || []).filter(l => l.status === 'cancelled').length;

            const courseInfo = [{
                [isRTL ? 'اسم الكورس' : 'Course Name']: course.name,
                [isRTL ? 'اسم المدرب' : 'Trainer Name']: course.trainer_name,
                [isRTL ? 'رقم المدرب' : 'Trainer Phone']: course.trainer_phone || '-',
                [isRTL ? 'القاعة' : 'Room']: ROOMS[course.room]?.[language as 'en' | 'ar'] || course.room,
                [isRTL ? 'الأيام' : 'Days']: course.schedule_days.map(d => DAYS_LABELS[d]?.[language as 'en' | 'ar']).join(', '),
                [isRTL ? 'وقت البداية' : 'Start Time']: course.schedule_time,
                [isRTL ? 'وقت الانتهاء' : 'End Time']: course.schedule_end_time || '-',
                [isRTL ? 'عدد المحاضرات' : 'Total Lectures']: course.total_lectures,
                [isRTL ? 'المحاضرات المكتملة' : 'Completed']: completedLectures,
                [isRTL ? 'المحاضرات الملغية' : 'Cancelled']: cancelledLectures,
                [isRTL ? 'تاريخ البداية' : 'Start Date']: course.start_date,
                [isRTL ? 'تاريخ النهاية' : 'End Date']: course.end_date || '-',
                [isRTL ? 'يوجد انترفيو' : 'Has Interview']: course.has_interview ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No'),
                [isRTL ? 'تاريخ الانترفيو' : 'Interview Date']: course.interview_date || '-',
                [isRTL ? 'عدد المستفيدين' : 'Beneficiaries Count']: beneficiariesData?.length || 0,
            }];

            const organizersData = (orgs || []).map(o => ({
                [isRTL ? 'اسم المنظم' : 'Organizer Name']: o.name,
                [isRTL ? 'رقم التليفون' : 'Phone']: o.phone || '-'
            }));

            const lecturesData = (lects || []).map(l => ({
                [isRTL ? 'رقم المحاضرة' : 'Lecture #']: l.lecture_number,
                [isRTL ? 'التاريخ' : 'Date']: l.date,
                [isRTL ? 'الحالة' : 'Status']: l.status === 'completed' ? (isRTL ? 'تمت' : 'Completed') :
                    l.status === 'cancelled' ? (isRTL ? 'ملغية' : 'Cancelled') : (isRTL ? 'مجدولة' : 'Scheduled')
            }));

            // Create attendance lookup
            const attendanceByLecture: Record<string, Record<string, string>> = {};
            (attendance || []).forEach((att: any) => {
                if (!attendanceByLecture[att.lecture_id]) {
                    attendanceByLecture[att.lecture_id] = {};
                }
                attendanceByLecture[att.lecture_id][att.student_phone] = att.status;
            });

            // Create attendance sheet from beneficiaries
            const attendanceSheetValues = (beneficiariesData || []).map(beneficiary => {
                const row: any = {
                    [isRTL ? 'الاسم' : 'Name']: beneficiary.name,
                    [isRTL ? 'الرقم' : 'Phone']: beneficiary.phone
                };
                let attended = 0;
                let missed = 0;
                (lects || []).forEach(l => {
                    const status = attendanceByLecture[l.id]?.[beneficiary.phone];
                    const colName = isRTL ? `م${l.lecture_number}` : `L${l.lecture_number}`;
                    if (status === 'present') {
                        row[colName] = isRTL ? 'حضر' : 'Present';
                        attended++;
                    } else if (l.status === 'completed') {
                        row[colName] = isRTL ? 'غائب' : 'Absent';
                        missed++;
                    } else {
                        row[colName] = '-';
                    }
                });
                row[isRTL ? 'عدد الحضور' : 'Total Attended'] = attended;
                row[isRTL ? 'عدد الغياب' : 'Total Missed'] = missed;
                return row;
            });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(courseInfo), isRTL ? 'معلومات الكورس' : 'Course Info');
            if (organizersData.length > 0) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(organizersData), isRTL ? 'المنظمين' : 'Organizers');
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lecturesData), isRTL ? 'المحاضرات' : 'Lectures');
            if (attendanceSheetValues.length > 0) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendanceSheetValues), isRTL ? 'شيت الحضور' : 'Attendance Sheet');
            }

            XLSX.writeFile(wb, `${course.name}_Report.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
        }
    };

    const deleteBeneficiary = async (id: string) => {
        if (!confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) return;
        try {
            const { error } = await supabase
                .from('course_beneficiaries')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setBeneficiaries(beneficiaries.filter(b => b.id !== id));
            toast.success(isRTL ? 'تم حذف المستفيد' : 'Beneficiary deleted');
        } catch (error) {
            console.error('Error deleting beneficiary:', error);
            toast.error(isRTL ? 'فشل الحذف' : 'Failed to delete');
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
                    <GraduationCap className="h-7 w-7" />
                    {isRTL ? 'كورساتي' : 'My Courses'}
                </h1>
                <p className="text-muted-foreground">
                    {isRTL ? 'الكورسات اللي بتنظمها' : 'Courses you are organizing'}
                </p>
            </div>

            {/* Courses Grid */}
            {/* Courses Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map(course => {
                    const progress = getProgress(course);
                    const remaining = Math.max(0, course.total_lectures - progress.completed);

                    return (
                        <Card key={course.id}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{course.name}</CardTitle>
                                        <CardDescription>{course.trainer_name}</CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openCourseDetails(course)}>
                                                <BookOpen className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'التفاصيل والحضور' : 'Details & Attendance'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => exportCourseToExcel(course)}>
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
                                        <MapPin className="w-4 h-4" />
                                        <span>{getRoomLabel(course.room)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Calendar className="w-4 h-4" />
                                        <span>{course.schedule_days.map(d => DAYS_LABELS[d]?.[language as 'en' | 'ar']).join(', ')}</span>
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
                                            {remaining}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {courses.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-muted-foreground">
                        <BookOpen className="w-12 h-12 mb-2 opacity-20" />
                        <p>{isRTL ? 'لا توجد كورسات تنظمها حالياً' : 'You are not organizing any courses'}</p>
                    </div>
                )}
            </div>

            {/* Course Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedCourse?.name}</DialogTitle>
                        <DialogDescription>{selectedCourse?.trainer_name}</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="beneficiaries" className="w-full">
                        <div className="overflow-x-auto -mx-2 px-2">
                            <TabsList className="grid w-full min-w-[300px] grid-cols-3">
                                <TabsTrigger value="beneficiaries" className="text-xs sm:text-sm">{isRTL ? 'المستفيدين' : 'Beneficiaries'}</TabsTrigger>
                                <TabsTrigger value="lectures" className="text-xs sm:text-sm">{isRTL ? 'المحاضرات' : 'Lectures'}</TabsTrigger>
                                <TabsTrigger value="sheet" className="text-xs sm:text-sm">{isRTL ? 'شيت الحضور' : 'Attendance Sheet'}</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Beneficiaries Tab */}
                        <TabsContent value="beneficiaries" className="space-y-4 py-4">
                            {/* Add Beneficiary Form */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">{isRTL ? 'إضافة مستفيد جديد' : 'Add New Beneficiary'}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Input
                                            placeholder={isRTL ? 'الاسم' : 'Name'}
                                            value={newBeneficiary.name}
                                            onChange={e => setNewBeneficiary({ ...newBeneficiary, name: e.target.value })}
                                            className="w-full sm:flex-1"
                                        />
                                        <Input
                                            placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                                            value={newBeneficiary.phone}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (/^[0-9+]*$/.test(val)) {
                                                    setNewBeneficiary({ ...newBeneficiary, phone: val });
                                                }
                                            }}
                                            className="w-full sm:flex-1"
                                        />
                                        <Button onClick={addBeneficiary} className="w-full sm:w-auto">
                                            <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                            {isRTL ? 'إضافة' : 'Add'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Beneficiaries List */}
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                            <TableHead>{isRTL ? 'رقم الهاتف' : 'Phone'}</TableHead>
                                            <TableHead className="w-24"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {beneficiaries.map(b => (
                                            <TableRow key={b.id}>
                                                <TableCell>
                                                    {editingBeneficiary?.id === b.id ? (
                                                        <Input
                                                            value={editingBeneficiary.name}
                                                            onChange={e => setEditingBeneficiary({ ...editingBeneficiary, name: e.target.value })}
                                                            className="h-8"
                                                        />
                                                    ) : (
                                                        b.name
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingBeneficiary?.id === b.id ? (
                                                        <Input
                                                            value={editingBeneficiary.phone}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (/^[0-9+]*$/.test(val)) {
                                                                    setEditingBeneficiary({ ...editingBeneficiary, phone: val });
                                                                }
                                                            }}
                                                            className="h-8"
                                                        />
                                                    ) : (
                                                        b.phone
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingBeneficiary?.id === b.id ? (
                                                        <div className="flex gap-1">
                                                            <Button size="sm" variant="ghost" onClick={updateBeneficiary}>
                                                                <Check className="w-4 h-4 text-green-600" />
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => setEditingBeneficiary(null)}>
                                                                <X className="w-4 h-4 text-red-600" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-1">
                                                            <Button size="sm" variant="ghost" onClick={() => setEditingBeneficiary(b)}>
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => deleteBeneficiary(b.id)}>
                                                                <Trash2 className="w-4 h-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {beneficiaries.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    {isRTL ? 'لا يوجد مستفيدين بعد' : 'No beneficiaries yet'}
                                                </TableCell>
                                            </TableRow>
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

                                    </CardContent>
                                </Card>
                            ))}</TabsContent>

                        <TabsContent value="sheet" className="py-4">
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                            <TableHead>{isRTL ? 'الرقم' : 'Phone'}</TableHead>
                                            {lectures.map(l => (
                                                <TableHead key={l.id} className="text-center w-12">
                                                    L{l.lecture_number}
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-center">{isRTL ? 'حضر' : 'Attended'}</TableHead>
                                            <TableHead className="text-center">{isRTL ? 'غاب' : 'Missed'}</TableHead>
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
                                                    <TableCell className="font-medium">{beneficiary.name}</TableCell>
                                                    <TableCell>{beneficiary.phone}</TableCell>
                                                    {lectures.map((lecture, idx) => {
                                                        const isPresent = attendanceData[lecture.id]?.some(a => a.student_phone === beneficiary.phone);
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
                                                                    <Checkbox
                                                                        checked={false}
                                                                        disabled
                                                                        className="mx-auto opacity-50 cursor-not-allowed"
                                                                    />
                                                                )}
                                                            </TableCell>
                                                        );
                                                    })}
                                                    <TableCell className="text-center font-bold text-green-600">{attendedCount}</TableCell>
                                                    <TableCell className="text-center font-bold text-red-600">{missedCount}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {beneficiaries.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={lectures.length + 4} className="text-center py-8 text-muted-foreground">
                                                    {isRTL ? 'لا يوجد مستفيدين - أضف مستفيدين من تبويب المستفيدين أولاً' : 'No beneficiaries - Add beneficiaries from the Beneficiaries tab first'}
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
        </div >
    );
}
