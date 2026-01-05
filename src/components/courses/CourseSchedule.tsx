import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, User, Phone, FileSpreadsheet, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

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
}

interface CourseOrganizer {
    id: string;
    name: string;
    phone: string;
}

const ROOMS: Record<string, { en: string; ar: string; color: string; bg: string }> = {
    'lab_1': { en: 'Lab 1', ar: 'لاب 1', color: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300' },
    'lab_2': { en: 'Lab 2', ar: 'لاب 2', color: 'bg-green-500', bg: 'bg-green-100 dark:bg-green-900/30 border-green-300' },
    'lab_3': { en: 'Lab 3', ar: 'لاب 3', color: 'bg-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300' },
    'lab_4': { en: 'Lab 4', ar: 'لاب 4', color: 'bg-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300' },
    'impact_hall': { en: 'Impact Hall', ar: 'قاعة الأثر', color: 'bg-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30 border-pink-300' },
};

const DAY_MAP: Record<number, string> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
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

const HEAD_ROLES = ['admin', 'supervisor', 'head_production', 'head_fourth_year', 'head_events', 'head_caravans', 'committee_leader'];

export default function CourseSchedule() {
    const { primaryRole } = useAuth();
    const { isRTL, language } = useLanguage();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [organizers, setOrganizers] = useState<CourseOrganizer[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const canViewDetails = HEAD_ROLES.includes(primaryRole || '');
    const locale = language === 'ar' ? ar : enUS;

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .order('schedule_time', { ascending: true });

            if (error) throw error;
            setCourses(data || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
        }
    };

    const openCourseDetails = async (course: Course) => {
        if (!canViewDetails) return;
        setSelectedCourse(course);
        try {
            const { data } = await supabase
                .from('course_organizers')
                .select('*')
                .eq('course_id', course.id);
            setOrganizers(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const getRoomLabel = (room: string) => ROOMS[room]?.[language as 'en' | 'ar'] || room;
    const getRoomBg = (room: string) => ROOMS[room]?.bg || 'bg-gray-100 border-gray-300';
    const getRoomColor = (room: string) => ROOMS[room]?.color || 'bg-gray-500';

    const formatTime = (timeStr: string) => {
        if (!timeStr) return '';
        try {
            // parse "HH:mm"
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes);
            return format(date, 'h:mm a', { locale });
        } catch (e) {
            return timeStr;
        }
    };

    const downloadCSV = (data: any[], filename: string) => {
        if (data.length === 0) return;
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(h => {
                const val = row[h];
                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val ?? '';
            }).join(','))
        ].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    const exportAllCourses = () => {
        const data = courses.map(c => ({
            [isRTL ? 'اسم الكورس' : 'Course']: c.name,
            [isRTL ? 'المدرب' : 'Trainer']: c.trainer_name,
            [isRTL ? 'القاعة' : 'Room']: getRoomLabel(c.room),
            [isRTL ? 'الأيام' : 'Days']: c.schedule_days.map(d => DAYS_LABELS[d]?.[language as 'en' | 'ar']).join(', '),
            [isRTL ? 'الوقت' : 'Time']: formatTime(c.schedule_time),
            [isRTL ? 'المحاضرات' : 'Lectures']: c.total_lectures,
        }));
        downloadCSV(data, 'courses_report');
    };

    // Get courses for a specific date (only active courses)
    const getCoursesForDate = (date: Date) => {
        const dayName = DAY_MAP[getDay(date)];
        const dateStr = date.toDateString();
        return courses.filter(c => {
            // Check if the day matches
            if (!c.schedule_days.includes(dayName)) return false;
            // Check if course has started (start_date <= date)
            if (new Date(c.start_date) > date) return false;
            // Check if course hasn't ended (end_date is null or end_date >= date)
            if (c.end_date && new Date(c.end_date) < new Date(dateStr)) return false;
            return true;
        });
    };

    // Generate calendar days
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Pad start to align with Saturday (week starts Saturday)
    const startDayIndex = (getDay(monthStart) + 1) % 7; // Saturday = 0
    const paddedDays = [...Array(startDayIndex).fill(null), ...calendarDays];

    if (loading) {
        return (
            <Card className="col-span-full">
                <CardHeader>
                    <CardTitle>{isRTL ? 'جدول الكورسات' : 'Course Schedule'}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="col-span-full">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BookOpen className="h-6 w-6" />
                            {isRTL ? 'جدول الكورسات الشهري' : 'Monthly Course Calendar'}
                        </CardTitle>
                        <CardDescription>{format(currentMonth, 'MMMM yyyy', { locale })}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                            {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                            {isRTL ? 'اليوم' : 'Today'}
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        {canViewDetails && (
                            <Button variant="outline" size="sm" onClick={exportAllCourses} className="ml-2">
                                <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {isRTL ? 'تصدير' : 'Export'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {courses.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">
                            {isRTL ? 'لا توجد كورسات هذا الشهر' : 'No courses this month'}
                        </p>
                    ) : (
                        <>
                            {/* Day Headers */}
                            <div className="grid grid-cols-7 mb-2">
                                {['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => (
                                    <div key={day} className="text-center font-semibold text-sm py-2 text-muted-foreground">
                                        {DAYS_LABELS[day][language as 'en' | 'ar']}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {paddedDays.map((day, idx) => {
                                    if (!day) {
                                        return <div key={`empty-${idx}`} className="min-h-[120px] bg-muted/20 rounded"></div>;
                                    }
                                    const dayCourses = getCoursesForDate(day);
                                    const isDayToday = isToday(day);
                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className={`min-h-[120px] p-2 rounded border ${isDayToday ? 'border-primary bg-primary/5' : 'border-border'}`}
                                        >
                                            <div className={`text-sm font-medium mb-1 ${isDayToday ? 'text-primary' : ''}`}>
                                                {format(day, 'd')}
                                            </div>
                                            <div className="space-y-1">
                                                {dayCourses.slice(0, 3).map(course => (
                                                    <div
                                                        key={course.id}
                                                        className={`p-1.5 rounded text-xs border cursor-pointer hover:opacity-80 ${getRoomBg(course.room)}`}
                                                        onClick={() => openCourseDetails(course)}
                                                    >
                                                        <p className="font-medium truncate">{course.name}</p>
                                                        <p className="text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatTime(course.schedule_time)}
                                                        </p>
                                                    </div>
                                                ))}
                                                {dayCourses.length > 3 && (
                                                    <p className="text-xs text-muted-foreground text-center">
                                                        +{dayCourses.length - 3} {isRTL ? 'المزيد' : 'more'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
                                {Object.entries(ROOMS).map(([key, val]) => (
                                    <div key={key} className="flex items-center gap-2 text-sm">
                                        <div className={`w-4 h-4 rounded ${val.color}`}></div>
                                        <span>{val[language as 'en' | 'ar']}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Course Details Dialog */}
            <Dialog open={!!selectedCourse} onOpenChange={() => setSelectedCourse(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{selectedCourse?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-muted-foreground">{isRTL ? 'المدرب' : 'Trainer'}</p>
                                    <p className="font-medium">{selectedCourse?.trainer_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-muted-foreground">{isRTL ? 'رقم المدرب' : 'Phone'}</p>
                                    <p className="font-medium">{selectedCourse?.trainer_phone || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-muted-foreground">{isRTL ? 'القاعة' : 'Room'}</p>
                                    <p className="font-medium">{selectedCourse && getRoomLabel(selectedCourse.room)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-muted-foreground">{isRTL ? 'الأيام' : 'Days'}</p>
                                    <p className="font-medium">{selectedCourse?.schedule_days.map(d => DAYS_LABELS[d]?.[language as 'en' | 'ar']).join(', ')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center border-t pt-4">
                            <div>
                                <p className="text-2xl font-bold">{selectedCourse?.total_lectures}</p>
                                <p className="text-xs text-muted-foreground">{isRTL ? 'المحاضرات' : 'Lectures'}</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{selectedCourse && formatTime(selectedCourse.schedule_time)}</p>
                                <p className="text-xs text-muted-foreground">{isRTL ? 'الوقت' : 'Time'}</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{selectedCourse?.has_interview ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No')}</p>
                                <p className="text-xs text-muted-foreground">{isRTL ? 'انترفيو' : 'Interview'}</p>
                            </div>
                        </div>

                        {organizers.length > 0 && (
                            <div className="border-t pt-4">
                                <p className="font-medium mb-2">{isRTL ? 'المنظمين' : 'Organizers'}</p>
                                <div className="space-y-2">
                                    {organizers.map(org => (
                                        <div key={org.id} className="flex items-center justify-between text-sm">
                                            <span>{org.name}</span>
                                            <span className="text-muted-foreground">{org.phone || '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
