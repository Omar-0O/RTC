import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, User, Users, Phone, FileSpreadsheet, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface QuranCircle {
    id: string;
    teacher_name?: string;
    teacher_gender?: string;
    schedule: { day: number; time: string }[];
    is_active: boolean;
    time?: string;
}

const ROOMS: Record<string, { en: string; ar: string; color: string; bg: string }> = {
    'lab_1': { en: 'Lab 1', ar: 'لاب 1', color: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300' },
    'lab_2': { en: 'Lab 2', ar: 'لاب 2', color: 'bg-green-500', bg: 'bg-green-100 dark:bg-green-900/30 border-green-300' },
    'lab_3': { en: 'Lab 3', ar: 'لاب 3', color: 'bg-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300' },
    'lab_4': { en: 'Lab 4', ar: 'لاب 4', color: 'bg-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300' },
    'impact_hall': { en: 'Impact Hall', ar: 'قاعة الأثر', color: 'bg-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30 border-pink-300' },
    'quran_circle': { en: 'Quran Circle', ar: 'حلقة قرآن', color: 'bg-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30 border-teal-300' },
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
    const [circles, setCircles] = useState<QuranCircle[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedCircle, setSelectedCircle] = useState<QuranCircle | null>(null);
    const [organizers, setOrganizers] = useState<CourseOrganizer[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const canViewDetails = true; // Everyone can view details now, but content varies
    const isHead = HEAD_ROLES.includes(primaryRole || '');
    const locale = language === 'ar' ? ar : enUS;

    useEffect(() => {
        fetchCourses();
        fetchCircles();
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

    const fetchCircles = async () => {
        try {
            // Fetch circles
            const { data: circlesData, error: circlesError } = await supabase
                .from('quran_circles')
                .select('id, schedule, is_active, teacher_id')
                .eq('is_active', true);

            if (circlesError) throw circlesError;

            // Fetch teachers
            const { data: teachersData, error: teachersError } = await supabase
                .from('quran_teachers')
                .select('id, name, target_gender');

            if (teachersError) throw teachersError;

            // Create a map of teachers for easy lookup
            const teachersMap = new Map(teachersData?.map(t => [t.id, t]) || []);

            setCircles(circlesData?.map((c: any) => {
                const teacher = teachersMap.get(c.teacher_id);
                return {
                    id: c.id,
                    teacher_name: teacher?.name,
                    teacher_gender: teacher?.target_gender,
                    schedule: c.schedule || [],
                    is_active: c.is_active
                };
            }) || []);
        } catch (error) {
            console.error('Error fetching circles:', error);
        }
    };

    const openCourseDetails = async (course: Course) => {
        setSelectedCourse(course);
        if (isHead) {
            try {
                const { data } = await supabase
                    .from('course_organizers')
                    .select('*')
                    .eq('course_id', course.id);
                setOrganizers(data || []);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const openCircleDetails = (circle: any) => {
        setSelectedCircle(circle);
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
        let data;

        if (isHead) {
            data = courses.map(c => ({
                [isRTL ? 'اسم الكورس' : 'Course']: c.name,
                [isRTL ? 'المدرب' : 'Trainer']: c.trainer_name,
                [isRTL ? 'القاعة' : 'Room']: getRoomLabel(c.room),
                [isRTL ? 'الأيام' : 'Days']: c.schedule_days.map(d => DAYS_LABELS[d]?.[language as 'en' | 'ar']).join(', '),
                [isRTL ? 'الوقت' : 'Time']: formatTime(c.schedule_time),
                [isRTL ? 'المحاضرات' : 'Lectures']: c.total_lectures,
            }));
        } else {
            // Volunteer: Filter for current month and simplified columns
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);

            const filteredCourses = courses.filter(c => {
                // Basic overlap check: Course started before end of month AND (no end date OR ended after start of month)
                const start = new Date(c.start_date);
                const end = c.end_date ? new Date(c.end_date) : null;
                return start <= monthEnd && (!end || end >= monthStart);
            });

            data = filteredCourses.map(c => ({
                [isRTL ? 'الشهر' : 'Month']: format(currentMonth, 'MMMM', { locale }),
                [isRTL ? 'اسم الكورس' : 'Course Name']: c.name,
                [isRTL ? 'المعاد' : 'Time']: formatTime(c.schedule_time),
            }));
        }

        downloadCSV(data, 'courses_schedule');
    };

    interface CalendarEvent {
        id: string;
        type: 'lecture' | 'interview';
        title: string;
        time: string; // HH:mm
        course: Course;
        room?: string;
    }

    const getEventsForDate = (date: Date) => {
        const events: CalendarEvent[] = [];
        const dayName = DAY_MAP[getDay(date)];
        const dateStr = format(date, 'yyyy-MM-dd');

        // Normalize check date
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        courses.forEach(c => {
            // 1. Check for Lectures
            let isLectureDay = false;
            // Check day of week
            if (c.schedule_days.includes(dayName)) {
                const startDate = new Date(c.start_date + 'T00:00:00');
                // Check start date
                if (startDate.setHours(0, 0, 0, 0) <= checkDate.getTime()) {
                    // Check end date
                    if (!c.end_date) {
                        isLectureDay = true;
                    } else {
                        const endDate = new Date(c.end_date + 'T00:00:00');
                        if (endDate.setHours(0, 0, 0, 0) >= checkDate.getTime()) {
                            isLectureDay = true;
                        }
                    }
                }
            }

            if (isLectureDay) {
                events.push({
                    id: `${c.id}-lecture-${dateStr}`,
                    type: 'lecture',
                    title: c.name,
                    time: c.schedule_time,
                    course: c,
                    room: c.room
                });
            }

            // 2. Check for Interviews
            if (c.has_interview && c.interview_date) {
                // Determine interview date (handling both ISO 'yyyy-MM-dd' and potential time components if any)
                // Assuming interview_date is YYYY-MM-DD
                if (c.interview_date === dateStr) {
                    events.push({
                        id: `${c.id}-interview`,
                        type: 'interview',
                        title: `${isRTL ? 'مقابلة' : 'Interview'}: ${c.name}`,
                        time: "09:00", // Default or if you have a specific time for interviews? 
                        // Ideally course.schedule_time or a separate field. 
                        // Just using course time for now or a generic start
                        // The schema doesn't seem to have specific 'interview_time', 
                        // so we might assume it starts at a standard time or same as schedule_time?
                        // Let's use schedule_time for now as a fallback or "All Day" logic if needed.
                        // But let's stick to schedule_time to sort it properly.
                        course: c,
                        room: 'interview'
                    });
                }
            }
        });

        // Sort by time
        return events.sort((a, b) => a.time.localeCompare(b.time));
    };

    // Get circles for a specific date based on their recurring schedule
    const getCirclesForDate = (date: Date) => {
        const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
        return circles.filter(c =>
            c.schedule.some(s => s.day === dayOfWeek)
        ).map(c => ({
            ...c,
            time: c.schedule.find(s => s.day === dayOfWeek)?.time || ''
        }));
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
                        {/* Only show back button if we're ahead of current month */}
                        {(currentMonth.getFullYear() > new Date().getFullYear() ||
                            (currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() > new Date().getMonth())) && (
                                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                    {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                                </Button>
                            )}
                        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                            {isRTL ? 'اليوم' : 'Today'}
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportAllCourses} className="ml-2">
                            <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {isRTL ? 'تصدير' : 'Export'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {courses.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">
                            {isRTL ? 'لا توجد كورسات هذا الشهر' : 'No courses this month'}
                        </p>
                    ) : (
                        <>
                            {/* Desktop View (Calendar Grid) */}
                            <div className="hidden md:block">
                                <div className="grid grid-cols-7 mb-2">
                                    {['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => (
                                        <div key={day} className="text-center font-semibold text-sm py-2 text-muted-foreground">
                                            {DAYS_LABELS[day][language as 'en' | 'ar']}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-1">
                                    {paddedDays.map((day, idx) => {
                                        if (!day) {
                                            return <div key={`empty-${idx}`} className="min-h-[120px] bg-muted/20 rounded"></div>;
                                        }
                                        const dayEvents = getEventsForDate(day);
                                        const isDayToday = isToday(day);
                                        return (
                                            <div
                                                key={day.toISOString()}
                                                className={`min-h-[120px] p-2 rounded border ${isDayToday ? 'border-primary bg-primary/5' : 'border-border'}`}
                                            >
                                                <div className={`text-sm font-medium mb-1 ${isDayToday ? 'text-primary' : ''}`}>
                                                    {format(day, 'd')}
                                                </div>
                                                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                                                    {dayEvents.slice(0, 10).map(event => (
                                                        <div
                                                            key={event.id}
                                                            className={`p-1.5 rounded text-xs border cursor-pointer hover:opacity-80 group transition-all ${event.type === 'interview'
                                                                ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 font-medium'
                                                                : getRoomBg(event.room || '')
                                                                }`}
                                                            onClick={() => openCourseDetails(event.course)}
                                                            title={`${event.title} - ${formatTime(event.time)}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="truncate flex-1 flex items-center gap-1.5">
                                                                    {event.type === 'interview' && <Users className="h-3 w-3 shrink-0" />}
                                                                    {event.title}
                                                                </span>
                                                                {event.type === 'lecture' && (
                                                                    <span className="text-[10px] opacity-70 group-hover:opacity-100 whitespace-nowrap">
                                                                        {formatTime(event.time)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {/* Quran Circles */}
                                                    {getCirclesForDate(day).map(circle => (
                                                        <div
                                                            key={`circle-${circle.id}`}
                                                            className={`p-1.5 rounded text-xs border cursor-pointer hover:opacity-80 group transition-all bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400`}
                                                            title={`${circle.teacher_name ? (isRTL ? 'حلقة المحفظ ' : '') + circle.teacher_name : (isRTL ? 'حلقة قرآن' : 'Quran Circle')} - ${circle.time}`}
                                                            onClick={() => openCircleDetails(circle)}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <BookOpen className="h-3 w-3 shrink-0" />
                                                                    <span className="font-medium truncate">
                                                                        {circle.teacher_name
                                                                            ? (isRTL ? `حلقة: ${circle.teacher_name}` : `${circle.teacher_name}`)
                                                                            : (isRTL ? 'حلقة قرآن' : 'Quran Circle')}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] opacity-70 group-hover:opacity-100 whitespace-nowrap">
                                                                    {formatTime(circle.time)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {dayEvents.length > 10 && (
                                                        <p className="text-[10px] text-muted-foreground text-center pt-1 font-medium">
                                                            <span dir="ltr">+{dayEvents.length - 10}</span> {isRTL ? 'المزيد' : 'more'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Mobile View (List) */}
                            <div className="md:hidden space-y-4">
                                {calendarDays.filter(day => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return day >= today;
                                }).map((day) => {
                                    const dayEvents = getEventsForDate(day);
                                    const dayCircles = getCirclesForDate(day);
                                    if (dayEvents.length === 0 && dayCircles.length === 0) return null; // Only show days with courses or circles

                                    const isDayToday = isToday(day);
                                    return (
                                        <div key={day.toISOString()} className={`rounded-lg border p-4 ${isDayToday ? 'border-primary bg-primary/5' : 'bg-card'}`}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className={`text-lg font-bold ${isDayToday ? 'text-primary' : ''}`}>
                                                    {format(day, 'EEEE, d MMMM', { locale })}
                                                </div>
                                                {isDayToday && (
                                                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                                        {isRTL ? 'اليوم' : 'Today'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {dayEvents.map(event => (
                                                    <div
                                                        key={event.id}
                                                        className={`p-3 rounded-md border flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform ${event.type === 'interview'
                                                            ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700'
                                                            : getRoomBg(event.room || '')
                                                            }`}
                                                        onClick={() => openCourseDetails(event.course)}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                {event.type === 'interview' && <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                                                                <p className={`font-semibold text-sm truncate ${event.type === 'interview' ? 'text-violet-700 dark:text-violet-300' : ''}`}>
                                                                    {event.title}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                                {event.type === 'lecture' && (
                                                                    <div className="flex items-center gap-1">
                                                                        <Clock className="h-3 w-3" />
                                                                        {formatTime(event.time)}
                                                                    </div>
                                                                )}
                                                                {isHead && event.type === 'lecture' && (
                                                                    <div className="flex items-center gap-1">
                                                                        <MapPin className="h-3 w-3" />
                                                                        {getRoomLabel(event.room || '')}
                                                                    </div>
                                                                )}
                                                                {event.type === 'interview' && (
                                                                    <div className="flex items-center gap-1 text-violet-600/80 dark:text-violet-400/80 font-medium">
                                                                        {isRTL ? 'مقابلة شخصية' : 'Personal Interview'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {/* Quran Circles for mobile */}
                                                {dayCircles.map(circle => (
                                                    <div
                                                        key={`circle-${circle.id}`}
                                                        className={`p-3 rounded-md border flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800`}
                                                        onClick={() => openCircleDetails(circle)}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                                <p className="font-semibold text-sm truncate text-emerald-900 dark:text-emerald-100">
                                                                    {circle.teacher_name
                                                                        ? (isRTL ? `حلقة القرآن - ${circle.teacher_name}` : `Quran Circle - ${circle.teacher_name}`)
                                                                        : (isRTL ? 'حلقة قرآن' : 'Quran Circle')}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                                <div className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {formatTime(circle.time)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Show message if no courses found in the list view (only redundant if we filter) - actually we filter above. 
                                    If no courses in the whole month, the parent 'courses.length === 0' check handles it. 
                                    So we are safe here. */}
                            </div>

                            {/* Legend */}
                            {isHead && (
                                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
                                    {Object.entries(ROOMS).map(([key, val]) => (
                                        <div key={key} className="flex items-center gap-2 text-sm">
                                            <div className={`w-4 h-4 rounded ${val.color}`}></div>
                                            <span>{val[language as 'en' | 'ar']}</span>
                                        </div>
                                    ))}
                                    {/* Circle Legend */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-4 h-4 rounded bg-emerald-500"></div>
                                        <span>{isRTL ? 'حلقات القرآن' : 'Quran Circles'}</span>
                                    </div>
                                    {/* Interview Legend */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-4 h-4 rounded bg-violet-500"></div>
                                        <span>{isRTL ? 'مقابلات' : 'Interviews'}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Course/Circle Details Dialog */}
            <Dialog open={!!selectedCourse || !!selectedCircle} onOpenChange={() => { setSelectedCourse(null); setSelectedCircle(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedCourse ? selectedCourse.name : (selectedCircle?.teacher_name ? (isRTL ? 'حلقة المحفظ ' + selectedCircle.teacher_name : selectedCircle.teacher_name + "'s Circle") : (isRTL ? 'حلقة قرآن' : 'Quran Circle'))}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCourse ? (
                        /* Course Details */
                        isHead ? (
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
                        ) : (
                            /* Simplified View for Volunteers (Course) */
                            <div className="space-y-4 py-4">
                                <div className="flex flex-col items-center justify-center text-center gap-4">
                                    <div className="bg-primary/10 p-4 rounded-full">
                                        <Clock className="h-8 w-8 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-sm mb-1">{isRTL ? 'معاد الكورس' : 'Class Time'}</p>
                                        <p className="text-3xl font-bold">{selectedCourse && formatTime(selectedCourse.schedule_time)}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    ) : (
                        /* Quran Circle Details */
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-muted-foreground">{isRTL ? 'المحفظ' : 'Teacher'}</p>
                                        <p className="font-medium">{selectedCircle?.teacher_name || '—'}</p>
                                    </div>
                                </div>

                            </div>

                            <div className="flex flex-col items-center justify-center text-center gap-4 border-t pt-4">
                                <div className="bg-primary/10 p-4 rounded-full">
                                    <Clock className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm mb-1">{isRTL ? 'المعاد' : 'Time'}</p>
                                    <p className="text-3xl font-bold">{selectedCircle && formatTime(selectedCircle.time)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
