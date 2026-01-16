import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
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
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Download, BookOpen, Calendar, Clock, MapPin, Users, Trash2, FileSpreadsheet, Check, X, MoreHorizontal, Pencil, Search } from 'lucide-react';
import { format, addDays, getDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Switch } from '@/components/ui/switch';

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
    course_lectures?: { status: string }[];
    has_certificates: boolean;
    certificate_status: 'pending' | 'printing' | 'ready' | 'delivered';
}

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

interface Trainer {
    id: string;
    name_en: string;
    name_ar: string;
    phone: string | null;
    image_url: string | null;
}

const ROOMS = [
    { value: 'lab_1', label: { en: 'Lab 1', ar: 'لاب 1' } },
    { value: 'lab_2', label: { en: 'Lab 2', ar: 'لاب 2' } },
    { value: 'lab_3', label: { en: 'Lab 3', ar: 'لاب 3' } },
    { value: 'lab_4', label: { en: 'Lab 4', ar: 'لاب 4' } },
    { value: 'impact_hall', label: { en: 'Impact Hall', ar: 'قاعة الأثر' } },
];

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
    const { user, hasRole } = useAuth();
    const { t, language, isRTL } = useLanguage();

    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [lectures, setLectures] = useState<CourseLecture[]>([]);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [attendanceData, setAttendanceData] = useState<Record<string, Attendance[]>>({});
    const [showPastCourses, setShowPastCourses] = useState(false);
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
    const [organizerPopoverOpen, setOrganizerPopoverOpen] = useState(false);
    const [beneficiaries, setBeneficiaries] = useState<CourseBeneficiary[]>([]);
    const [newBeneficiary, setNewBeneficiary] = useState({ name: '', phone: '' });
    const [editingBeneficiary, setEditingBeneficiary] = useState<CourseBeneficiary | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
    const [detailsOrganizers, setDetailsOrganizers] = useState<CourseOrganizer[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [trainers, setTrainers] = useState<Trainer[]>([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
    const [isExternalTrainer, setIsExternalTrainer] = useState(false);

    // Filter out ended courses unless showPastCourses is true
    const activeCourses = courses.filter(course => {
        if (showPastCourses) return true;

        // Show if course has certificates (or has a status set) and they are NOT delivered yet
        if ((course.has_certificates || course.certificate_status) && course.certificate_status !== 'delivered') return true;

        if (!course.end_date) return true;
        return new Date(course.end_date) >= new Date(new Date().toDateString());
    });

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        trainer_name: '',
        trainer_phone: '',
        room: 'lab_1',
        schedule_days: [] as string[],
        schedule_time: '10:00',
        schedule_end_time: '12:00',
        has_interview: false,
        interview_date: '',
        total_lectures: 8,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: '',
        has_certificates: false,
    });

    const [organizers, setOrganizers] = useState<CourseOrganizer[]>([]);

    useEffect(() => {
        fetchCourses();
        fetchVolunteers();
        fetchTrainers();
    }, []);



    // Auto-calculate end date
    useEffect(() => {
        if (!formData.start_date || !formData.total_lectures || formData.schedule_days.length === 0) {
            return;
        }

        const calculateEndDate = () => {
            const start = new Date(formData.start_date);
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

    const fetchVolunteers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, full_name_ar, phone, avatar_url')
                .neq('full_name', 'RTC Admin')
                .order('full_name');
            if (error) throw error;
            setVolunteers(data || []);
        } catch (error) {
            console.error('Error fetching volunteers:', error);
        }
    };

    const fetchTrainers = async () => {
        try {
            const { data, error } = await supabase
                .from('trainers')
                .select('id, name_en, name_ar, phone, image_url')
                .order('name_ar');
            if (error) throw error;
            setTrainers((data as Trainer[]) || []);
        } catch (error) {
            console.error('Error fetching trainers:', error);
        }
    };

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*, course_lectures(status)')
                .order('start_date', { ascending: false });

            if (error) throw error;
            setCourses((data as Course[]) || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
            toast.error(isRTL ? 'فشل في تحميل الكورسات' : 'Failed to fetch courses');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            trainer_name: '',
            trainer_phone: '',
            room: 'lab_1',
            schedule_days: [],
            schedule_time: '10:00',
            schedule_end_time: '12:00',
            has_interview: false,
            interview_date: '',
            total_lectures: 8,
            start_date: format(new Date(), 'yyyy-MM-dd'),
            end_date: '',
            has_certificates: false,
        });
        setOrganizers([]);
        setSelectedTrainerId('');
        setIsExternalTrainer(false);
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

    const toggleDay = (day: string) => {
        if (formData.schedule_days.includes(day)) {
            setFormData({ ...formData, schedule_days: formData.schedule_days.filter(d => d !== day) });
        } else {
            setFormData({ ...formData, schedule_days: [...formData.schedule_days, day] });
        }
    };

    const handleCreateCourse = async () => {
        if (!formData.name || formData.schedule_days.length === 0) {
            toast.error(isRTL ? 'يرجى ملء البيانات المطلوبة' : 'Please fill required fields');
            return;
        }

        if (organizers.length < 2) {
            toast.error(isRTL ? 'يجب اختيار 2 منظمين على الأقل' : 'Must select at least 2 organizers');
            return;
        }

        try {
            // Smart Date Calculation
            const start = new Date(formData.start_date);
            let current = start;
            let lectureDates: Date[] = [];
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
                created_by: user?.id
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
                const { error: orgError } = await supabase
                    .from('course_organizers')
                    .insert(organizers.map(o => ({
                        course_id: course.id,
                        volunteer_id: o.volunteer_id || null,
                        name: o.name,
                        phone: o.phone
                    })));

                if (orgError) throw orgError;
            }

            // Create lecture entries
            const lectureEntries = lectureDates.map((date, index) => ({
                course_id: course.id,
                lecture_number: index + 1,
                date: format(date, 'yyyy-MM-dd'),
                status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled'
            }));

            const { error: lectError } = await supabase
                .from('course_lectures')
                .insert(lectureEntries);

            if (lectError) throw lectError;

            toast.success(isRTL ? 'تم إنشاء الكورس بنجاح' : 'Course created successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchCourses();
        } catch (error) {
            console.error('Error creating course:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء إنشاء الكورس' : 'Error creating course');
        }
    };

    const openCourseDetails = async (course: Course) => {
        setSelectedCourse(course);
        setLectures([]);
        setAttendanceData({});
        setBeneficiaries([]);
        setNewBeneficiary({ name: '', phone: '' });
        setEditingBeneficiary(null);
        try {
            // Fetch lectures
            const { data: lecturesData } = await supabase
                .from('course_lectures')
                .select('*')
                .eq('course_id', course.id)
                .order('lecture_number');

            // Fetch beneficiaries
            const { data: beneficiariesData } = await supabase
                .from('course_beneficiaries')
                .select('*')
                .eq('course_id', course.id)
                .order('name');

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
            // Fetch organizers
            const { data: organizersData } = await supabase
                .from('course_organizers')
                .select('*')
                .eq('course_id', course.id);

            if (organizersData) {
                setDetailsOrganizers(organizersData);
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

            setLectures(lectures.map(l => l.id === lectureId ? { ...l, status } : l));
            toast.success(isRTL ? 'تم تحديث حالة المحاضرة' : 'Lecture status updated');
        } catch (error) {
            console.error('Error updating lecture:', error);
            toast.error(isRTL ? 'فشل تحديث المحاضرة' : 'Failed to update lecture');
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
                [isRTL ? 'القاعة' : 'Room']: ROOMS.find(r => r.value === course.room)?.label[language as 'en' | 'ar'] || course.room,
                [isRTL ? 'الأيام' : 'Days']: course.schedule_days.map(d => DAYS.find(day => day.value === d)?.label[language as 'en' | 'ar']).join(', '),
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
                [isRTL ? 'حالة الشهادات' : 'Certificates Status']: course.has_certificates
                    ? (isRTL
                        ? (course.certificate_status === 'printing' ? 'جاري الطباعة' :
                            course.certificate_status === 'ready' ? 'جاهزة للتسليم' :
                                course.certificate_status === 'delivered' ? 'تم التسليم' : 'انتظار')
                        : (course.certificate_status || 'Pending'))
                    : (isRTL ? 'لا يوجد شهادات' : 'No Certificates'),
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

    const exportAllCourses = async () => {
        try {
            const allData = courses.map(c => ({
                [isRTL ? 'اسم الكورس' : 'Course Name']: c.name,
                [isRTL ? 'المدرب' : 'Trainer']: c.trainer_name,
                [isRTL ? 'رقم المدرب' : 'Trainer Phone']: c.trainer_phone || '-',
                [isRTL ? 'القاعة' : 'Room']: ROOMS.find(r => r.value === c.room)?.label[language as 'en' | 'ar'] || c.room,
                [isRTL ? 'الأيام' : 'Days']: c.schedule_days.map(d => DAYS.find(day => day.value === d)?.label[language as 'en' | 'ar']).join(', '),
                [isRTL ? 'وقت البداية' : 'Start Time']: c.schedule_time,
                [isRTL ? 'وقت الانتهاء' : 'End Time']: c.schedule_end_time || '-',
                [isRTL ? 'عدد المحاضرات' : 'Lectures']: c.total_lectures,
                [isRTL ? 'تاريخ البداية' : 'Start Date']: c.start_date,
                [isRTL ? 'تاريخ النهاية' : 'End Date']: c.end_date || '-',
                [isRTL ? 'انترفيو' : 'Interview']: c.has_interview ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No'),
                [isRTL ? 'تاريخ الانترفيو' : 'Interview Date']: c.interview_date || '-',
            }));

            const ws = XLSX.utils.json_to_sheet(allData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, isRTL ? 'كل الكورسات' : 'All Courses');
            XLSX.writeFile(wb, `All_Courses_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
        }
    };

    const getRoomLabel = (room: string) => {
        const r = ROOMS.find(rm => rm.value === room);
        return r ? r.label[language as 'en' | 'ar'] : room;
    };

    const getDaysLabel = (days: string[]) => {
        return days.map(d => DAYS.find(day => day.value === d)?.label[language as 'en' | 'ar']).join(', ');
    };

    const isLectureOpen = (dateStr: string) => {
        const lectureDate = new Date(dateStr);
        const now = new Date();
        lectureDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        return now >= lectureDate;
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

    const deleteBeneficiary = async (id: string) => {
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
        } catch (error: any) {
            console.error('Error deleting course:', error);
            toast.error(error.message || (isRTL ? 'فشل حذف الكورس' : 'Failed to delete course'));
        } finally {
            setIsDeleting(false);
        }
    };

    const updateCertificateStatus = async (courseId: string, status: string) => {
        try {
            const { error } = await supabase
                .from('courses')
                .update({ certificate_status: status })
                .eq('id', courseId);

            if (error) throw error;

            setCourses(courses.map(c => c.id === courseId ? { ...c, certificate_status: status as any } : c));
            if (selectedCourse?.id === courseId) {
                setSelectedCourse({ ...selectedCourse, certificate_status: status as any });
            }
            toast.success(isRTL ? 'تم تحديث حالة الشهادات' : 'Certificates status updated');
        } catch (error) {
            console.error('Error updating certificate status:', error);
            toast.error(isRTL ? 'فشل تحديث الحالة' : 'Failed to update status');
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
            const newOrganizer = {
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
                    <h1 className="text-3xl font-bold">{isRTL ? 'إدارة الكورسات' : 'Course Management'}</h1>
                    <p className="text-muted-foreground">{isRTL ? 'إدارة الكورسات والمحاضرات' : 'Manage courses and lectures'}</p>
                </div>
                <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                    <label className="flex items-center gap-2 cursor-pointer text-sm px-1">
                        <Checkbox
                            checked={showPastCourses}
                            onCheckedChange={(checked) => setShowPastCourses(!!checked)}
                        />
                        <span className="text-muted-foreground">{isRTL ? 'عرض الكورسات المنتهية' : 'Show ended courses'}</span>
                    </label>
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
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">{isRTL ? 'إضافة كورس جديد' : 'Add New Course'}</DialogTitle>
                                    <DialogDescription>{isRTL ? 'أضف تفاصيل الكورس' : 'Add course details'}</DialogDescription>
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
                                                    {ROOMS.map(room => (
                                                        <SelectItem key={room.value} value={room.value} className="py-3">
                                                            {room.label[language as 'en' | 'ar']}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Trainer Info */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-base">{isRTL ? 'المدرب' : 'Trainer'}</Label>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-sm ${!isExternalTrainer ? 'font-medium' : 'text-muted-foreground'}`}>
                                                    {isRTL ? 'من الفرع' : 'Internal'}
                                                </span>
                                                <Switch
                                                    checked={isExternalTrainer}
                                                    onCheckedChange={(checked) => {
                                                        setIsExternalTrainer(checked);
                                                        if (checked) {
                                                            setSelectedTrainerId('');
                                                        } else {
                                                            setFormData({ ...formData, trainer_name: '', trainer_phone: '' });
                                                        }
                                                    }}
                                                />
                                                <span className={`text-sm ${isExternalTrainer ? 'font-medium' : 'text-muted-foreground'}`}>
                                                    {isRTL ? 'خارجي' : 'External'}
                                                </span>
                                            </div>
                                        </div>

                                        {!isExternalTrainer ? (
                                            // Internal trainer - dropdown
                                            <div className="space-y-3">
                                                <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
                                                    <SelectTrigger className="h-12">
                                                        <SelectValue placeholder={isRTL ? 'اختر مدرب من الفرع...' : 'Select trainer from branch...'} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {trainers.map(trainer => (
                                                            <SelectItem key={trainer.id} value={trainer.id} className="py-3">
                                                                <div className="flex items-center gap-2 w-full flex-row-reverse justify-end">
                                                                    <div className="flex flex-col items-end">
                                                                        <span>{isRTL ? trainer.name_ar : trainer.name_en}</span>
                                                                        {trainer.phone && <span className="text-muted-foreground text-xs">{trainer.phone}</span>}
                                                                    </div>
                                                                    <Avatar className="h-8 w-8">
                                                                        <AvatarImage src={trainer.image_url || undefined} />
                                                                        <AvatarFallback>{(isRTL ? trainer.name_ar : trainer.name_en).charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {trainers.length === 0 && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {isRTL ? 'لا يوجد مدربين مسجلين. أضف مدربين من صفحة المدربين أولاً.' : 'No trainers registered. Add trainers from Trainers page first.'}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            // External trainer - manual input
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>{isRTL ? 'اسم المدرب *' : 'Trainer Name *'}</Label>
                                                    <Input
                                                        value={formData.trainer_name}
                                                        onChange={e => setFormData({ ...formData, trainer_name: e.target.value })}
                                                        className="h-12"
                                                        placeholder={isRTL ? 'أدخل اسم المدرب' : 'Enter trainer name'}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{isRTL ? 'رقم المدرب' : 'Trainer Phone'}</Label>
                                                    <Input
                                                        value={formData.trainer_phone}
                                                        onChange={e => setFormData({ ...formData, trainer_phone: e.target.value })}
                                                        className="h-12"
                                                        placeholder="01xxxxxxxxx"
                                                        dir="ltr"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Schedule */}
                                    <div className="space-y-3">
                                        <Label className="text-base">{isRTL ? 'أيام الكورس *' : 'Course Days *'}</Label>
                                        <div className="flex flex-wrap gap-3">
                                            {DAYS.map(day => {
                                                const isSelected = formData.schedule_days.includes(day.value);
                                                return (
                                                    <div
                                                        key={day.value}
                                                        onClick={() => toggleDay(day.value)}
                                                        className={`
                                                        flex items-center gap-2 px-4 py-3 border rounded-lg cursor-pointer transition-all
                                                        ${isSelected
                                                                ? 'bg-primary text-primary-foreground border-primary'
                                                                : 'hover:bg-accent hover:border-accent-foreground/50 bg-background'
                                                            }
                                                    `}
                                                    >
                                                        <span className="font-medium">{day.label[language as 'en' | 'ar']}</span>
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

                                    {/* End Date (Read Only) */}
                                    <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-dashed">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-base text-muted-foreground">{isRTL ? 'تاريخ النهاية المتوقع' : 'Expected End Date'}</Label>
                                            <Badge variant="outline" className="text-base px-3 py-1">
                                                {formData.end_date || '-'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {isRTL
                                                ? 'يتم حساب تاريخ النهاية تلقائياً بناءً على تاريخ البداية وعدد المحاضرات والأيام المختارة.'
                                                : 'End date is calculated automatically based on start date, lectures count, and selected days.'}
                                        </p>
                                    </div>

                                    {/* Interview */}
                                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                                            <Checkbox
                                                checked={formData.has_interview}
                                                onCheckedChange={(checked) => setFormData({ ...formData, has_interview: !!checked })}
                                                className="h-5 w-5"
                                            />
                                            <span className="text-base font-medium">{isRTL ? 'يوجد انترفيو لهذا الكورس' : 'This course has an interview'}</span>
                                        </label>
                                        {formData.has_interview && (
                                            <div className="w-1/3 min-w-[200px]">
                                                <Input
                                                    type="date"
                                                    value={formData.interview_date}
                                                    onChange={e => setFormData({ ...formData, interview_date: e.target.value })}
                                                    className="h-10"
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

                                    {/* Organizers */}
                                    <div className="border-t pt-4">
                                        <h3 className="text-base sm:text-lg font-medium mb-3">{isRTL ? 'المنظمين' : 'Organizers'}</h3>
                                        <Popover open={organizerPopoverOpen} onOpenChange={setOrganizerPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start text-sm">
                                                    <Search className="w-4 h-4 ltr:mr-2 rtl:ml-2 shrink-0" />
                                                    <span className="truncate">{isRTL ? 'بحث عن متطوع...' : 'Search volunteers...'}</span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start" side="bottom">
                                                <Command>
                                                    <CommandInput placeholder={isRTL ? 'اكتب اسم المتطوع...' : 'Type volunteer name...'} />
                                                    <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                                                        <CommandEmpty>{isRTL ? 'لا يوجد متطوعين' : 'No volunteers found'}</CommandEmpty>
                                                        <CommandGroup heading={isRTL ? 'المتطوعين' : 'Volunteers'}>
                                                            {volunteers.slice(0, 50).map(volunteer => (
                                                                <CommandItem
                                                                    key={volunteer.id}
                                                                    value={`${volunteer.full_name} ${volunteer.full_name_ar || ''}`}
                                                                    onSelect={() => handleAddOrganizer(volunteer)}
                                                                >
                                                                    <div className="flex items-center gap-2 w-full">
                                                                        <Avatar className="h-8 w-8">
                                                                            <AvatarImage src={volunteer.avatar_url || undefined} />
                                                                            <AvatarFallback>{(volunteer.full_name?.[0] || '?').toUpperCase()}</AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="truncate font-medium">{isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name}</span>
                                                                            <span className="text-xs text-muted-foreground">{volunteer.phone || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>

                                        {organizers.length > 0 && (
                                            <div className="border rounded-md mt-3 overflow-x-auto">
                                                <Table className="min-w-[280px]">
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-xs sm:text-sm">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                            <TableHead className="text-xs sm:text-sm">{isRTL ? 'الرقم' : 'Phone'}</TableHead>
                                                            <TableHead className="w-10"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {organizers.map((org, idx) => (
                                                            <TableRow key={idx}>
                                                                <TableCell className="text-xs sm:text-sm truncate max-w-[120px]">{org.name}</TableCell>
                                                                <TableCell className="text-xs sm:text-sm">{org.phone || '-'}</TableCell>
                                                                <TableCell>
                                                                    <Button variant="ghost" size="sm" onClick={() => removeOrganizer(idx)}>
                                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <DialogFooter className="flex-col sm:flex-row gap-2">
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="h-12 px-6 w-full sm:w-auto">{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                                    <Button onClick={handleCreateCourse} className="h-12 px-6 w-full sm:w-auto">{isRTL ? 'إنشاء الكورس' : 'Create Course'}</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* Course Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeCourses.map(course => (
                    <Card key={course.id}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">{course.name}</CardTitle>
                                        {course.has_certificates && (() => {
                                            // Check if all lectures are completed
                                            const lectureStatuses = course.course_lectures || [];
                                            const allCompleted = lectureStatuses.length > 0 &&
                                                lectureStatuses.every((l: any) => l.status === 'completed' || l.status === 'cancelled');

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
                                    <span>{course.schedule_time}</span>
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
                ))}
                {courses.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-muted-foreground">
                        <BookOpen className="w-12 h-12 mb-2 opacity-20" />
                        <p>{isRTL ? 'لا توجد كورسات' : 'No courses yet'}</p>
                    </div>
                )}
            </div>

            {/* Course Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            {selectedCourse?.name}
                            {selectedCourse?.has_certificates && (
                                <Badge variant="outline">
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
                        <DialogDescription className="flex flex-col gap-1">
                            <span>{selectedCourse?.trainer_name} - {selectedCourse?.room && getRoomLabel(selectedCourse.room)}</span>
                            {detailsOrganizers.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    {isRTL ? 'المنظمين: ' : 'Organizers: '}
                                    {detailsOrganizers.map(o => o.name).join(', ')}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedCourse?.has_certificates && (hasRole('admin') || hasRole('committee_leader') || detailsOrganizers.some(o => o.volunteer_id === user?.id)) && (
                        <div className="bg-muted/10 p-4 rounded-lg border mb-4">
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4" />
                                {isRTL ? 'إدارة الشهادات' : 'Certificates Management'}
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                                        {isRTL ? 'حالة الشهادات' : 'Certificates Status'}
                                    </Label>
                                    <Select
                                        value={selectedCourse.certificate_status}
                                        onValueChange={(val) => updateCertificateStatus(selectedCourse.id, val)}
                                        disabled={!selectedCourse.end_date || new Date(selectedCourse.end_date) > new Date()}
                                    >
                                        <SelectTrigger>
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
                                        <p className="text-[10px] text-muted-foreground mt-1 text-red-500">
                                            {isRTL ? '* لا يمكن تغيير الحالة قبل انتهاء الكورس' : '* Cannot change status before course ends'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <Tabs defaultValue="beneficiaries" className="w-full">
                        <div className="overflow-x-auto -mx-2 px-2">
                            <TabsList className={`grid w-full min-w-[300px] ${(hasRole('admin') || hasRole('committee_leader') || hasRole('supervisor')) ? 'grid-cols-4' : 'grid-cols-3'}`}>
                                <TabsTrigger value="beneficiaries" className="text-xs sm:text-sm">{isRTL ? 'المستفيدين' : 'Beneficiaries'}</TabsTrigger>
                                <TabsTrigger value="lectures" className="text-xs sm:text-sm">{isRTL ? 'المحاضرات' : 'Lectures'}</TabsTrigger>
                                <TabsTrigger value="sheet" className="text-xs sm:text-sm">{isRTL ? 'شيت الحضور' : 'Attendance Sheet'}</TabsTrigger>
                                {(hasRole('admin') || hasRole('committee_leader') || hasRole('supervisor')) && (
                                    <TabsTrigger value="organizers" className="text-xs sm:text-sm">{isRTL ? 'المنظمين' : 'Organizers'}</TabsTrigger>
                                )}
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

                                        {/* Quick Attendance Checkboxes */}
                                        {isLectureOpen(lecture.date) && lecture.status !== 'cancelled' && beneficiaries.length > 0 && (
                                            <div className="border rounded-lg p-3 bg-muted/20">
                                                <p className="text-sm font-medium mb-2">{isRTL ? 'تسجيل الحضور:' : 'Mark Attendance:'}</p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                                                    <span className="text-muted-foreground text-xs">-</span>
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
                        {(hasRole('admin') || hasRole('committee_leader') || hasRole('supervisor')) && (
                            <TabsContent value="organizers" className="space-y-4 py-4">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">{isRTL ? 'إدارة المنظمين' : 'Manage Organizers'}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start text-sm">
                                                        <Search className="w-4 h-4 ltr:mr-2 rtl:ml-2 shrink-0" />
                                                        <span className="truncate">{isRTL ? 'إضافة منظم...' : 'Add organizer...'}</span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[calc(100vw-4rem)] sm:w-[400px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
                                                        <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                                                            <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results found'}</CommandEmpty>
                                                            <CommandGroup>
                                                                {volunteers.slice(0, 50).map(volunteer => (
                                                                    <CommandItem
                                                                        key={volunteer.id}
                                                                        value={`${volunteer.full_name} ${volunteer.full_name_ar || ''}`}
                                                                        onSelect={() => handleAddOrganizerToDetails(volunteer)}
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
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>

                                            <div className="border rounded-lg">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                            <TableHead>{isRTL ? 'الرقم' : 'Phone'}</TableHead>
                                                            <TableHead className="w-16"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {detailsOrganizers.map(org => (
                                                            <TableRow key={org.id}>
                                                                <TableCell>{org.name}</TableCell>
                                                                <TableCell>{org.phone}</TableCell>
                                                                <TableCell>
                                                                    <Button size="sm" variant="ghost" onClick={() => handleRemoveOrganizerFromDetails(org.id!)}>
                                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {detailsOrganizers.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                                                    {isRTL ? 'لا يوجد منظمين' : 'No organizers'}
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
            <PopoverContent className="w-80" align="end">
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
