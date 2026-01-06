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
        setLectures(lecturesData || []);

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

    const markAttendance = async (lectureId: string, beneficiary: CourseBeneficiary, status: 'present' | 'absent') => {
        // Check if attendance record exists
        const existing = attendanceData[lectureId]?.find(a => a.student_name === beneficiary.name);

        if (existing) {
            // Update
            const { error } = await supabase
                .from('course_attendance')
                .update({ status })
                .eq('id', existing.id);

            if (error) {
                toast.error(isRTL ? 'فشل تحديث الحضور' : 'Failed to update attendance');
                return;
            }
        } else {
            // Insert
            const { error } = await supabase
                .from('course_attendance')
                .insert({
                    lecture_id: lectureId,
                    student_name: beneficiary.name,
                    student_phone: beneficiary.phone,
                    status,
                    created_by: user?.id
                });

            if (error) {
                toast.error(isRTL ? 'فشل تسجيل الحضور' : 'Failed to record attendance');
                return;
            }
        }

        // Refresh attendance
        const { data } = await supabase
            .from('course_attendance')
            .select('*')
            .eq('lecture_id', lectureId);

        setAttendanceData(prev => ({ ...prev, [lectureId]: data || [] }));
        toast.success(isRTL ? 'تم تسجيل الحضور' : 'Attendance recorded');
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
            {courses.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                            {isRTL ? 'لا توجد كورسات تنظمها حالياً' : 'You are not organizing any courses'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {courses.map(course => {
                        const progress = getProgress(course);
                        return (
                            <Card key={course.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openCourseDetails(course)}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg">{course.name}</CardTitle>
                                            <CardDescription>{course.trainer_name}</CardDescription>
                                        </div>
                                        <Badge variant="secondary">
                                            {progress.completed}/{progress.total}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Calendar className="h-4 w-4" />
                                        <span>{course.schedule_days.map(d => DAYS_LABELS[d]?.[language as 'en' | 'ar']).join(', ')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>{formatTime(course.schedule_time)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        <span>{getRoomLabel(course.room)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Course Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedCourse?.name}</DialogTitle>
                        <DialogDescription>{selectedCourse?.trainer_name}</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="lectures" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="lectures">{isRTL ? 'المحاضرات' : 'Lectures'}</TabsTrigger>
                            <TabsTrigger value="attendance">{isRTL ? 'الحضور' : 'Attendance'}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="lectures" className="space-y-4">
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16">#</TableHead>
                                            <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                                            <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                                            <TableHead className="w-32">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lectures.map(lecture => (
                                            <TableRow key={lecture.id}>
                                                <TableCell className="font-medium">{lecture.lecture_number}</TableCell>
                                                <TableCell>{format(new Date(lecture.date), 'PPP', { locale })}</TableCell>
                                                <TableCell>
                                                    <Badge variant={lecture.status === 'completed' ? 'default' : lecture.status === 'cancelled' ? 'destructive' : 'secondary'}>
                                                        {lecture.status === 'completed' ? (isRTL ? 'تمت' : 'Done') :
                                                            lecture.status === 'cancelled' ? (isRTL ? 'ملغاة' : 'Cancelled') :
                                                                (isRTL ? 'مجدولة' : 'Scheduled')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => updateLectureStatus(lecture.id, 'completed')}>
                                                            <Check className="h-4 w-4 text-green-600" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => updateLectureStatus(lecture.id, 'cancelled')}>
                                                            <X className="h-4 w-4 text-red-600" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="attendance" className="space-y-4">
                            {lectures.filter(l => l.status !== 'cancelled').map(lecture => (
                                <Card key={lecture.id}>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-sm flex items-center justify-between">
                                            <span>{isRTL ? `محاضرة ${lecture.lecture_number}` : `Lecture ${lecture.lecture_number}`}</span>
                                            <span className="text-muted-foreground font-normal">{format(new Date(lecture.date), 'PPP', { locale })}</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {beneficiaries.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                {isRTL ? 'لا يوجد مستفيدين مسجلين' : 'No beneficiaries registered'}
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {beneficiaries.map(ben => {
                                                    const att = attendanceData[lecture.id]?.find(a => a.student_name === ben.name);
                                                    return (
                                                        <div key={ben.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                                            <span className="text-sm">{ben.name}</span>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant={att?.status === 'present' ? 'default' : 'outline'}
                                                                    onClick={() => markAttendance(lecture.id, ben, 'present')}
                                                                >
                                                                    <Check className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant={att?.status === 'absent' ? 'destructive' : 'outline'}
                                                                    onClick={() => markAttendance(lecture.id, ben, 'absent')}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}
