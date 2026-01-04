import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Download, BookOpen, Calendar, Clock, MapPin, Users, Trash2, FileSpreadsheet, Check, X, MoreHorizontal, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
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
    has_interview: boolean;
    interview_date: string | null;
    total_lectures: number;
    start_date: string;
    end_date: string | null;
    created_by: string;
    committee_id: string | null;
}

interface CourseOrganizer {
    id?: string;
    course_id?: string;
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
    const { user } = useAuth();
    const { t, language, isRTL } = useLanguage();

    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [lectures, setLectures] = useState<CourseLecture[]>([]);
    const [isLecturesOpen, setIsLecturesOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        trainer_name: '',
        trainer_phone: '',
        room: 'lab_1',
        schedule_days: [] as string[],
        schedule_time: '10:00',
        has_interview: false,
        interview_date: '',
        total_lectures: 8,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: '',
    });

    const [organizers, setOrganizers] = useState<CourseOrganizer[]>([]);
    const [newOrganizerName, setNewOrganizerName] = useState('');
    const [newOrganizerPhone, setNewOrganizerPhone] = useState('');

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*')
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

    const resetForm = () => {
        setFormData({
            name: '',
            trainer_name: '',
            trainer_phone: '',
            room: 'lab_1',
            schedule_days: [],
            schedule_time: '10:00',
            has_interview: false,
            interview_date: '',
            total_lectures: 8,
            start_date: format(new Date(), 'yyyy-MM-dd'),
            end_date: '',
        });
        setOrganizers([]);
    };

    const handleAddOrganizer = () => {
        if (!newOrganizerName.trim()) return;
        setOrganizers([...organizers, { name: newOrganizerName, phone: newOrganizerPhone }]);
        setNewOrganizerName('');
        setNewOrganizerPhone('');
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
        if (!formData.name || !formData.trainer_name || formData.schedule_days.length === 0) {
            toast.error(isRTL ? 'يرجى ملء البيانات المطلوبة' : 'Please fill required fields');
            return;
        }

        try {
            // Create course
            const { data: course, error: courseError } = await supabase
                .from('courses')
                .insert({
                    ...formData,
                    created_by: user?.id
                })
                .select()
                .single();

            if (courseError) throw courseError;

            // Add organizers
            if (organizers.length > 0) {
                const { error: orgError } = await supabase
                    .from('course_organizers')
                    .insert(organizers.map(o => ({
                        course_id: course.id,
                        name: o.name,
                        phone: o.phone
                    })));

                if (orgError) throw orgError;
            }

            // Create lecture entries
            const lectureEntries = [];
            for (let i = 1; i <= formData.total_lectures; i++) {
                lectureEntries.push({
                    course_id: course.id,
                    lecture_number: i,
                    date: formData.start_date, // Can be updated individually later
                    status: 'scheduled'
                });
            }

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

    const openLecturesDialog = async (course: Course) => {
        setSelectedCourse(course);
        try {
            const { data } = await supabase
                .from('course_lectures')
                .select('*')
                .eq('course_id', course.id)
                .order('lecture_number');

            setLectures(data || []);
            setIsLecturesOpen(true);
        } catch (error) {
            console.error('Error fetching lectures:', error);
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

            const courseInfo = [{
                [isRTL ? 'اسم الكورس' : 'Course Name']: course.name,
                [isRTL ? 'اسم المدرب' : 'Trainer Name']: course.trainer_name,
                [isRTL ? 'رقم المدرب' : 'Trainer Phone']: course.trainer_phone || '-',
                [isRTL ? 'القاعة' : 'Room']: ROOMS.find(r => r.value === course.room)?.label[language as 'en' | 'ar'] || course.room,
                [isRTL ? 'الأيام' : 'Days']: course.schedule_days.map(d => DAYS.find(day => day.value === d)?.label[language as 'en' | 'ar']).join(', '),
                [isRTL ? 'الوقت' : 'Time']: course.schedule_time,
                [isRTL ? 'عدد المحاضرات' : 'Total Lectures']: course.total_lectures,
                [isRTL ? 'تاريخ البداية' : 'Start Date']: course.start_date,
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

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(courseInfo), isRTL ? 'معلومات الكورس' : 'Course Info');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(organizersData), isRTL ? 'المنظمين' : 'Organizers');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lecturesData), isRTL ? 'المحاضرات' : 'Lectures');

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
                [isRTL ? 'القاعة' : 'Room']: ROOMS.find(r => r.value === c.room)?.label[language as 'en' | 'ar'] || c.room,
                [isRTL ? 'الأيام' : 'Days']: c.schedule_days.map(d => DAYS.find(day => day.value === d)?.label[language as 'en' | 'ar']).join(', '),
                [isRTL ? 'الوقت' : 'Time']: c.schedule_time,
                [isRTL ? 'عدد المحاضرات' : 'Lectures']: c.total_lectures,
                [isRTL ? 'البداية' : 'Start']: c.start_date,
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

    const getCompletedLectures = (courseId: string) => {
        // This would need async fetch, for now return placeholder
        return 0;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{isRTL ? 'إدارة الكورسات' : 'Course Management'}</h1>
                    <p className="text-muted-foreground">{isRTL ? 'إدارة الكورسات والمحاضرات' : 'Manage courses and lectures'}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportAllCourses}>
                        <FileSpreadsheet className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                        {isRTL ? 'تصدير الكل' : 'Export All'}
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                {isRTL ? 'إضافة كورس' : 'Add Course'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{isRTL ? 'إضافة كورس جديد' : 'Add New Course'}</DialogTitle>
                                <DialogDescription>{isRTL ? 'أضف تفاصيل الكورس' : 'Add course details'}</DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-6 py-4">
                                {/* Course Name */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'اسم الكورس *' : 'Course Name *'}</Label>
                                        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'القاعة *' : 'Room *'}</Label>
                                        <Select value={formData.room} onValueChange={val => setFormData({ ...formData, room: val })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROOMS.map(room => (
                                                    <SelectItem key={room.value} value={room.value}>
                                                        {room.label[language as 'en' | 'ar']}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Trainer Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'اسم المدرب *' : 'Trainer Name *'}</Label>
                                        <Input value={formData.trainer_name} onChange={e => setFormData({ ...formData, trainer_name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'رقم المدرب' : 'Trainer Phone'}</Label>
                                        <Input value={formData.trainer_phone} onChange={e => setFormData({ ...formData, trainer_phone: e.target.value })} />
                                    </div>
                                </div>

                                {/* Schedule */}
                                <div className="space-y-2">
                                    <Label>{isRTL ? 'أيام الكورس *' : 'Course Days *'}</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map(day => (
                                            <label key={day.value} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted">
                                                <Checkbox
                                                    checked={formData.schedule_days.includes(day.value)}
                                                    onCheckedChange={() => toggleDay(day.value)}
                                                />
                                                <span className="text-sm">{day.label[language as 'en' | 'ar']}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
                                        <Input type="time" value={formData.schedule_time} onChange={e => setFormData({ ...formData, schedule_time: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'عدد المحاضرات' : 'Total Lectures'}</Label>
                                        <Input type="number" min={1} value={formData.total_lectures} onChange={e => setFormData({ ...formData, total_lectures: parseInt(e.target.value) || 1 })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'تاريخ البداية' : 'Start Date'}</Label>
                                        <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'تاريخ النهاية' : 'End Date'}</Label>
                                        <Input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                                    </div>
                                </div>

                                {/* Interview */}
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={formData.has_interview}
                                            onCheckedChange={(checked) => setFormData({ ...formData, has_interview: !!checked })}
                                        />
                                        <span>{isRTL ? 'يوجد انترفيو' : 'Has Interview'}</span>
                                    </label>
                                    {formData.has_interview && (
                                        <div className="flex-1">
                                            <Input
                                                type="date"
                                                value={formData.interview_date}
                                                onChange={e => setFormData({ ...formData, interview_date: e.target.value })}
                                                placeholder={isRTL ? 'تاريخ الانترفيو' : 'Interview Date'}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Organizers */}
                                <div className="border-t pt-4">
                                    <h3 className="text-lg font-medium mb-4">{isRTL ? 'المنظمين' : 'Organizers'}</h3>
                                    <div className="flex gap-2 mb-4">
                                        <Input
                                            placeholder={isRTL ? 'اسم المنظم' : 'Organizer Name'}
                                            value={newOrganizerName}
                                            onChange={e => setNewOrganizerName(e.target.value)}
                                        />
                                        <Input
                                            placeholder={isRTL ? 'رقم التليفون' : 'Phone'}
                                            value={newOrganizerPhone}
                                            onChange={e => setNewOrganizerPhone(e.target.value)}
                                        />
                                        <Button onClick={handleAddOrganizer} variant="secondary" disabled={!newOrganizerName}>
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {organizers.length > 0 && (
                                        <div className="border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                        <TableHead>{isRTL ? 'الرقم' : 'Phone'}</TableHead>
                                                        <TableHead></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {organizers.map((org, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>{org.name}</TableCell>
                                                            <TableCell>{org.phone || '-'}</TableCell>
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

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                                <Button onClick={handleCreateCourse}>{isRTL ? 'إنشاء الكورس' : 'Create Course'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Course Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map(course => (
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
                                        <DropdownMenuItem onClick={() => openLecturesDialog(course)}>
                                            <Calendar className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                            {isRTL ? 'المحاضرات' : 'Lectures'}
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

            {/* Lectures Dialog */}
            <Dialog open={isLecturesOpen} onOpenChange={setIsLecturesOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedCourse?.name} - {isRTL ? 'المحاضرات' : 'Lectures'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {lectures.map(lecture => (
                            <div
                                key={lecture.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${lecture.status === 'cancelled' ? 'bg-destructive/10 border-destructive/30' :
                                        lecture.status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                                            'bg-muted/50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="font-medium">{isRTL ? 'محاضرة' : 'Lecture'} {lecture.lecture_number}</span>
                                    <Badge variant={
                                        lecture.status === 'cancelled' ? 'destructive' :
                                            lecture.status === 'completed' ? 'default' : 'secondary'
                                    }>
                                        {lecture.status === 'completed' ? (isRTL ? 'تمت' : 'Completed') :
                                            lecture.status === 'cancelled' ? (isRTL ? 'ملغية' : 'Cancelled') :
                                                (isRTL ? 'مجدولة' : 'Scheduled')}
                                    </Badge>
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant={lecture.status === 'completed' ? 'default' : 'outline'}
                                        onClick={() => updateLectureStatus(lecture.id, 'completed')}
                                    >
                                        <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={lecture.status === 'cancelled' ? 'destructive' : 'outline'}
                                        onClick={() => updateLectureStatus(lecture.id, 'cancelled')}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
