import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Megaphone, CheckCircle2, Circle, ChevronRight, ChevronLeft, Calendar, FileText, ImageIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, addMonths, subMonths, parseISO, differenceInCalendarDays } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

interface CourseAd {
    id: string;
    course_id: string;
    ad_number: number;
    ad_date: string;
    poster_done: boolean;
    content_done: boolean;
    course?: {
        name: string;
        start_date: string;
        has_interview: boolean;
        interview_date: string | null;
    };
    [key: string]: any; // Allow other properties
}

interface CourseAdsTableProps {
    ads?: CourseAd[];
    title?: string;
}

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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from 'lucide-react';

export function CourseAdsTable({ ads: propAds, title }: CourseAdsTableProps) {
    const { isRTL, language } = useLanguage();
    const locale = language === 'ar' ? ar : enUS;
    const [ads, setAds] = useState<CourseAd[]>(propAds || []);
    const [loading, setLoading] = useState(!propAds);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedAd, setSelectedAd] = useState<CourseAd | null>(null);
    const [marketers, setMarketers] = useState<any[]>([]);
    const [loadingMarketers, setLoadingMarketers] = useState(false);

    useEffect(() => {
        const fetchMarketers = async () => {
            if (!selectedAd || !selectedAd.course_id) return;

            setLoadingMarketers(true);
            try {
                const { data, error } = await supabase
                    .from('course_marketers')
                    .select('id, profiles:volunteer_id(full_name, full_name_ar, phone, avatar_url)')
                    .eq('course_id', selectedAd.course_id);

                if (error) throw error;
                setMarketers(data || []);
            } catch (error) {
                console.error('Error fetching marketers:', error);
            } finally {
                setLoadingMarketers(false);
            }
        };

        if (selectedAd) {
            fetchMarketers();
        } else {
            setMarketers([]);
        }
    }, [selectedAd]);

    useEffect(() => {
        if (propAds) {
            setAds(propAds);
            setLoading(false);
        } else {
            fetchAds();
        }
    }, [propAds]);

    const fetchAds = async () => {
        try {
            // Fetch all ads (or optimization: fetch based on range if needed)
            const { data, error } = await supabase
                .from('course_ads')
                .select(`
          id,
          course_id,
          ad_number,
          ad_date,
          poster_done,
          content_done,
          course:courses(name, start_date, has_interview, interview_date)
        `)
                .order('ad_date', { ascending: true });

            if (error) throw error;

            const formattedData = (data || []).map((item: any) => ({
                ...item,
                course: item.course || { name: 'Unknown Course' }
            }));

            setAds(formattedData);
        } catch (error) {
            console.error('Error fetching course ads:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter ads for specific date
    const getAdsForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return ads.filter(ad => ad.ad_date === dateStr);
    };

    // Generate calendar
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Align with Saturday (week starts Saturday)
    const startDayIndex = (getDay(monthStart) + 1) % 7; // Saturday = 0
    const paddedDays = [...Array(startDayIndex).fill(null), ...calendarDays];

    if (loading) {
        return (
            <Card className="col-span-full">
                <CardContent className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    // if (ads.length === 0) return null; // Removed to show empty calendar

    return (
        <>
            <Card className="col-span-full">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Megaphone className="h-6 w-6 text-primary" />
                            {title || (isRTL ? 'تقويم الإعلانات' : 'Ads Calendar')}
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
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Desktop View (Calender Grid) */}
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
                                    return <div key={`empty-${idx}`} className="min-h-[100px] bg-muted/20 rounded"></div>;
                                }
                                const dayAds = getAdsForDate(day);
                                const isDayToday = isToday(day);

                                return (
                                    <div
                                        key={day.toISOString()}
                                        className={`min-h-[100px] p-2 rounded border ${isDayToday ? 'border-primary bg-primary/5' : 'border-border'}`}
                                    >
                                        <div className={`text-sm font-medium mb-1 ${isDayToday ? 'text-primary' : ''}`}>
                                            {format(day, 'd')}
                                        </div>
                                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                                            {dayAds.map(ad => {
                                                // Determine target date (interview date or start date)

                                                const targetDateStr = ad.course?.has_interview && ad.course?.interview_date
                                                    ? ad.course.interview_date
                                                    : ad.course?.start_date;

                                                const targetDate = targetDateStr ? parseISO(targetDateStr) : null;

                                                const isUrgent = targetDate && (!ad.poster_done || !ad.content_done) &&
                                                    differenceInCalendarDays(targetDate, new Date()) <= 5;

                                                return (
                                                    <div
                                                        key={ad.id}
                                                        className={`p-1.5 rounded text-xs border cursor-pointer hover:opacity-80 transition-all ${isUrgent
                                                            ? 'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300'
                                                            : 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 text-purple-700 dark:text-purple-300'
                                                            }`}
                                                        onClick={() => setSelectedAd(ad)}
                                                        title={`${ad.course.name} - #${ad.ad_number}`}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <Megaphone className="h-3 w-3" />
                                                            <span className="font-medium truncate flex-1 leading-tight">
                                                                {ad.course.name} #{ad.ad_number}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Mobile View (List) */}
                    <div className="md:hidden space-y-4">
                        {calendarDays.map((day) => {
                            const dayAds = getAdsForDate(day);
                            if (dayAds.length === 0) return null;

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
                                        {dayAds.map(ad => {
                                            // Determine target date (interview date or start date)
                                            const targetDateStr = ad.course?.has_interview && ad.course?.interview_date
                                                ? ad.course.interview_date
                                                : ad.course?.start_date;

                                            const targetDate = targetDateStr ? parseISO(targetDateStr) : null;

                                            const isUrgent = targetDate && (!ad.poster_done || !ad.content_done) &&
                                                differenceInCalendarDays(targetDate, new Date()) <= 5;

                                            return (
                                                <div
                                                    key={ad.id}
                                                    className={`p-3 rounded-md border flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform ${isUrgent
                                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                                        : 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800'
                                                        }`}
                                                    onClick={() => setSelectedAd(ad)}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="font-semibold text-sm truncate text-purple-900 dark:text-purple-300">
                                                                {ad.course.name}
                                                            </p>
                                                            <Badge variant="outline" className="text-xs bg-background">#{ad.ad_number}</Badge>
                                                        </div>
                                                        <div className="flex gap-3 mt-2">
                                                            <div className={`flex items-center gap-1 text-xs ${ad.poster_done ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                                                {ad.poster_done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                                                                <span>{isRTL ? 'بوستر' : 'Poster'}</span>
                                                            </div>
                                                            <div className={`flex items-center gap-1 text-xs ${ad.content_done ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                                                {ad.content_done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                                                                <span>{isRTL ? 'محتوى' : 'Content'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedAd} onOpenChange={() => setSelectedAd(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Megaphone className="h-5 w-5 text-primary" />
                            {selectedAd?.course.name}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedAd && (
                        <div className="space-y-6 py-2">
                            <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">{isRTL ? 'رقم الإعلان' : 'Ad Number'}</p>
                                    <p className="text-xl font-bold font-mono">#{selectedAd.ad_number}</p>
                                </div>
                                <div className="text-end">
                                    <p className="text-sm text-muted-foreground mb-1">{isRTL ? 'تاريخ النشر' : 'Publish Date'}</p>
                                    <p className="font-semibold">{format(parseISO(selectedAd.ad_date), 'dd MMMM yyyy', { locale })}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                            <ImageIcon className="h-5 w-5" />
                                        </div>
                                        <span className="font-medium">{isRTL ? 'تصميم البوستر' : 'Poster Design'}</span>
                                    </div>
                                    {selectedAd.poster_done ? (
                                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border-green-200">
                                            <CheckCircle2 className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                            {isRTL ? 'تم' : 'Done'}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                            <Circle className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                            {isRTL ? 'قيد التنفيذ' : 'Pending'}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <span className="font-medium">{isRTL ? 'كتابة المحتوى' : 'Content Writing'}</span>
                                    </div>
                                    {selectedAd.content_done ? (
                                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border-green-200">
                                            <CheckCircle2 className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                            {isRTL ? 'تم' : 'Done'}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                            <Circle className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                            {isRTL ? 'قيد التنفيذ' : 'Pending'}
                                        </Badge>
                                    )}
                                </div>

                                <div className="space-y-2 pt-2 border-t">
                                    <h4 className="font-medium flex items-center gap-2">
                                        <Users className="h-4 w-4 text-primary" />
                                        {isRTL ? 'فريق التسويق' : 'Marketing Team'}
                                    </h4>

                                    {loadingMarketers ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : marketers.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {marketers.map((marketer) => (
                                                <div key={marketer.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={marketer.profiles?.avatar_url || ''} />
                                                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                            {(marketer.profiles?.full_name || 'U').substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            {isRTL && marketer.profiles?.full_name_ar
                                                                ? marketer.profiles.full_name_ar
                                                                : marketer.profiles?.full_name}
                                                        </p>
                                                        {marketer.profiles?.phone && (
                                                            <p className="text-xs text-muted-foreground font-mono">
                                                                {marketer.profiles.phone}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-2">
                                            {isRTL ? 'لا يوجد مسوقين لهذا الكورس' : 'No marketers assigned'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog >
        </>
    );
}
