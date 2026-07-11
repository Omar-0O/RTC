import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BookOpen, Calendar, Clock, MapPin, Users, Check, X, Loader2, GraduationCap, Search, UserPlus, Table as TableIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Plus, Trash2, Pencil, MoreHorizontal, Download, Megaphone, Image, FileText, MessageSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { exportCourseReportToXlsx } from '@/utils/courseExport';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CACHE_TTL, getLocalCache, setLocalCache } from '@/utils/localCache';

type RoomRow = Database['public']['Tables']['rooms']['Row'];
type TrainerRow = Database['public']['Tables']['trainers']['Row'];
type CourseTrainerRow = Database['public']['Tables']['course_trainers']['Row'];
type CourseAdRow = Database['public']['Tables']['course_ads']['Row'];
type CourseAdInsert = Database['public']['Tables']['course_ads']['Insert'];
type CourseAdUpdate = Database['public']['Tables']['course_ads']['Update'];
type CourseAttendanceRow = Database['public']['Tables']['course_attendance']['Row'];
type TrainerLectureRecordInsert = Database['public']['Tables']['trainer_lecture_records']['Insert'];
type SupabaseErrorWithCode = { code?: string };

const getErrorCode = (error: unknown): string | undefined => {
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = (error as SupabaseErrorWithCode).code;
        return typeof code === 'string' ? code : undefined;
    }
    return undefined;
};

type CourseAdWithUpdater = CourseAdRow & {
    updater?: { full_name: string | null, full_name_ar: string | null } | null;
};

interface Course {
    id: string;
    name: string;
    trainer_id: string | null;
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
    committee_id?: string | null;
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
    national_id?: string | null;
}

interface CourseAd {
    id: string;
    course_id: string;
    ad_number: number;
    ad_date: string;
    poster_url: string | null;
    content: string | null;
    poster_done: boolean;
    content_done: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: string | null;
    updated_at: string | null;
    updater?: { full_name: string | null, full_name_ar: string | null } | null;
}

type MyCoursesCache = {
    courses?: Course[];
    organizerCourseIds?: string[];
    marketerCourseIds?: string[];
};

const isMyCoursesCache = (value: unknown): value is MyCoursesCache =>
    typeof value === 'object' && value !== null;

const DAYS_LABELS: Record<string, { en: string; ar: string }> = {
    'saturday': { en: 'Sat', ar: 'سبت' },
    'sunday': { en: 'Sun', ar: 'أحد' },
    'monday': { en: 'Mon', ar: 'إثنين' },
    'tuesday': { en: 'Tue', ar: 'ثلاثاء' },
    'wednesday': { en: 'Wed', ar: 'أربعاء' },
    'thursday': { en: 'Thu', ar: 'خميس' },
    'friday': { en: 'Fri', ar: 'جمعة' },
};

const MY_COURSE_COLUMNS = 'id, name, trainer_id, trainer_name, trainer_phone, room, schedule_days, schedule_time, schedule_end_time, has_interview, interview_date, total_lectures, start_date, end_date, committee_id, course_lectures(status)';
const COURSE_AD_COLUMNS = 'id, course_id, ad_number, ad_date, poster_url, content, poster_done, content_done, created_by, updated_by, created_at, updated_at, updater:profiles!course_ads_updated_by_fkey(full_name, full_name_ar)';
const COURSE_LECTURE_COLUMNS = 'id, course_id, lecture_number, date, status';
const COURSE_BENEFICIARY_COLUMNS = 'id, course_id, name, phone, national_id';
const COURSE_ATTENDANCE_COLUMNS = 'id, lecture_id, student_name, student_phone, status';

export default function MyCourses() {
    const { user } = useAuth();
    const { language, isRTL } = useLanguage();
    const locale = language === 'ar' ? ar : enUS;

    const [courses, setCourses] = useState<Course[]>([]);
    const [rooms, setRooms] = useState<Record<string, { en: string; ar: string }>>({});
    const [loading, setLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [lectures, setLectures] = useState<CourseLecture[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<CourseBeneficiary[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, Attendance[]>>({});
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Beneficiary State
    const [newBeneficiary, setNewBeneficiary] = useState({ name: '', phone: '', national_id: '' });
    const [editingBeneficiary, setEditingBeneficiary] = useState<CourseBeneficiary | null>(null);
    const [courseAds, setCourseAds] = useState<CourseAd[]>([]);
    const [isMarketer, setIsMarketer] = useState(false);
    const [isOrganizer, setIsOrganizer] = useState(false);
    const [marketerCourseIds, setMarketerCourseIds] = useState<Set<string>>(new Set());
    const [organizerCourseIds, setOrganizerCourseIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState('beneficiaries');
    const [beneficiaryTabSearch, setBeneficiaryTabSearch] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [isEditStudentDialogOpen, setIsEditStudentDialogOpen] = useState(false);
    const [historyStudent, setHistoryStudent] = useState<CourseBeneficiary | null>(null);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<CourseBeneficiary | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [leaveCourseId, setLeaveCourseId] = useState<string | null>(null);
    const [leaveType, setLeaveType] = useState<'organizer' | 'marketer' | null>(null);
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);


    useEffect(() => {
        if (user) {
            const cacheKey = `rtc_my_courses_data_${user.id}`;
            const cached = getLocalCache<MyCoursesCache>(cacheKey, isMyCoursesCache);
            let hasCache = false;
            if (cached) {
                setCourses(cached.courses || []);
                setOrganizerCourseIds(new Set(cached.organizerCourseIds || []));
                setMarketerCourseIds(new Set(cached.marketerCourseIds || []));
                setLoading(false);
                hasCache = true;
            }

            fetchMyCourses(hasCache);
            fetchRooms();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const fetchRooms = async () => {
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('id, name, name_ar');

            if (error) {
                console.error('Error fetching rooms:', error);
                return;
            }

            if (data) {
                const roomsMap: Record<string, { en: string; ar: string }> = {};
                (data as Pick<RoomRow, 'id' | 'name' | 'name_ar'>[]).forEach(r => {
                    roomsMap[r.id] = { en: r.name, ar: r.name_ar };
                });
                setRooms(roomsMap);
            }
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    };

    const fetchMyCourses = async (hasCache = false) => {
        if (!user) return;

        if (!hasCache) {
            setLoading(true);
        }
        try {
            const [organizerResult, marketerResult, trainerResult] = await Promise.all([
                supabase.from('course_organizers').select('course_id').eq('volunteer_id', user.id),
                supabase.from('course_marketers').select('course_id').eq('volunteer_id', user.id),
                supabase.from('trainers').select('id').eq('user_id', user.id).maybeSingle(),
            ]);

            if (organizerResult.error) throw organizerResult.error;
            if (marketerResult.error) throw marketerResult.error;
            if (trainerResult.error) throw trainerResult.error;

            const organizerData = organizerResult.data;
            const marketerData = marketerResult.data;
            const trainerRecord = trainerResult.data;

            let trainerCourseIds: string[] = [];
            if (trainerRecord?.id) {
                const [trainerCourseResult, primaryTrainerResult] = await Promise.all([
                    supabase.from('course_trainers').select('course_id').eq('trainer_id', trainerRecord.id),
                    supabase.from('courses').select('id').eq('trainer_id', trainerRecord.id),
                ]);

                if (trainerCourseResult.error) throw trainerCourseResult.error;
                if (primaryTrainerResult.error) throw primaryTrainerResult.error;

                const trainerCourseData = trainerCourseResult.data;
                trainerCourseIds = (trainerCourseData as Pick<CourseTrainerRow, 'course_id'>[] | null)?.map(t => t.course_id) || [];
                const primaryIds = primaryTrainerResult.data?.map(course => course.id) || [];
                trainerCourseIds = Array.from(new Set([...trainerCourseIds, ...primaryIds]));
            }

            const organizerIds = organizerData?.map(o => o.course_id) || [];
            const marketerIds = marketerData?.map(m => m.course_id) || [];
            const orgIdsSet = new Set([...organizerIds, ...trainerCourseIds]);
            const mktIdsSet = new Set(marketerIds);
            setOrganizerCourseIds(orgIdsSet); // trainers can manage lectures
            setMarketerCourseIds(mktIdsSet);
            const allCourseIds = Array.from(new Set([...organizerIds, ...marketerIds, ...trainerCourseIds]));

            if (allCourseIds.length === 0) {
                setCourses([]);
                
                const cacheKey = `rtc_my_courses_data_${user.id}`;
                setLocalCache(cacheKey, {
                    courses: [],
                    organizerCourseIds: [],
                    marketerCourseIds: []
                }, CACHE_TTL.short);

                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('courses')
                .select(MY_COURSE_COLUMNS)
                .in('id', allCourseIds)
                .order('start_date', { ascending: false });

            if (error) throw error;
            const coursesData = data || [];
            setCourses(coursesData);

            const cacheKey = `rtc_my_courses_data_${user.id}`;
            setLocalCache(cacheKey, {
                courses: coursesData,
                organizerCourseIds: Array.from(orgIdsSet),
                marketerCourseIds: Array.from(mktIdsSet)
            }, CACHE_TTL.short);
        } catch (error) {
            console.error('Error fetching courses:', error);
            toast.error(isRTL ? 'فشل في تحميل الكورسات' : 'Failed to fetch courses');
        } finally {
            setLoading(false);
        }
    };

    const handleAddAd = async () => {
        if (!selectedCourse) return;

        try {
            const nextAdNumber = (courseAds.length > 0 ? Math.max(...courseAds.map(a => a.ad_number)) : 0) + 1;
            const newAdData = {
                course_id: selectedCourse.id,
                ad_number: nextAdNumber,
                ad_date: format(new Date(), 'yyyy-MM-dd'),
                created_by: user?.id,
                poster_done: false,
                content_done: false
            };

            const newAdPayload: CourseAdInsert = newAdData;
            const { data, error } = await supabase
                .from('course_ads')
                .insert(newAdPayload)
                .select()
                .single();

            if (error) throw error;

            setCourseAds([...courseAds, data as CourseAd]);
            toast.success(isRTL ? 'تم إضافة إعلان جديد' : 'New ad added successfully');
        } catch (error) {
            console.error('Error adding ad:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء إضافة الإعلان' : 'Error adding ad');
        }
    };

    const handleUpdateAd = async (adId: string, updates: Partial<CourseAd>) => {
        try {
            const adUpdates: CourseAdUpdate = { ...updates, updated_by: user?.id, updated_at: new Date().toISOString() };
            const { error } = await supabase
                .from('course_ads')
                .update(adUpdates)
                .eq('id', adId);

            if (error) throw error;

            setCourseAds(courseAds.map(ad => ad.id === adId ? { ...ad, ...updates } : ad));
            toast.success(isRTL ? 'تم تحديث الإعلان' : 'Ad updated successfully');
        } catch (error) {
            console.error('Error updating ad:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء تحديث الإعلان' : 'Error updating ad');
        }
    };

    const handleDeleteAd = async (adId: string) => {
        if (!confirm(isRTL ? 'هل أنت متأكد من حذف هذا الإعلان؟' : 'Are you sure you want to delete this ad?')) return;

        try {
            const { error } = await supabase
                .from('course_ads')
                .delete()
                .eq('id', adId);

            if (error) throw error;

            setCourseAds(courseAds.filter(ad => ad.id !== adId));
            toast.success(isRTL ? 'تم حذف الإعلان' : 'Ad deleted successfully');
        } catch (error) {
            console.error('Error deleting ad:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء حذف الإعلان' : 'Error deleting ad');
        }
    };

    const handleLeaveCourse = (courseId: string, type: 'organizer' | 'marketer') => {
        setLeaveCourseId(courseId);
        setLeaveType(type);
        setIsLeaveConfirmOpen(true);
    };

    const confirmLeaveCourse = async () => {
        if (!user || !leaveCourseId || !leaveType) return;
        const table = leaveType === 'organizer' ? 'course_organizers' : 'course_marketers';
        
        try {
            const { error } = await supabase
                .from(table)
                .delete()
                .match({ course_id: leaveCourseId, volunteer_id: user.id });

            if (error) throw error;
            toast.success(isRTL ? 'تمت الإزالة بنجاح' : 'Removed successfully');
            setIsLeaveConfirmOpen(false);
            setLeaveCourseId(null);
            setLeaveType(null);
            fetchMyCourses();
        } catch (error: unknown) {
            console.error('Error leaving course:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء الإزالة' : 'Error removing role');
        }
    };

    const openCourseDetails = async (course: Course, tab: string = 'beneficiaries') => {
        setSelectedCourse(course);
        setIsDetailsOpen(true);
        setCourseAds([]);
        setActiveTab(tab);

        // Check if user is marketer using pre-fetched data
        const isUserMarketer = marketerCourseIds.has(course.id);
        const isUserOrganizer = organizerCourseIds.has(course.id);
        setIsMarketer(isUserMarketer);
        setIsOrganizer(isUserOrganizer);

        // If only marketer (not organizer), force marketing tab
        if (isUserMarketer && !isUserOrganizer) {
            setActiveTab('marketing');
        } else {
            setActiveTab(tab);
        }

        try {
            const [adsResult, lecturesResult, beneficiariesResult] = await Promise.all([
                supabase.from('course_ads').select(COURSE_AD_COLUMNS).eq('course_id', course.id).order('ad_number'),
                supabase.from('course_lectures').select(COURSE_LECTURE_COLUMNS).eq('course_id', course.id).order('lecture_number'),
                supabase.from('course_beneficiaries').select(COURSE_BENEFICIARY_COLUMNS).eq('course_id', course.id).order('name'),
            ]);

            if (adsResult.error) throw adsResult.error;
            if (lecturesResult.error) throw lecturesResult.error;
            if (beneficiariesResult.error) throw beneficiariesResult.error;

            const lecturesData = lecturesResult.data || [];
            setCourseAds((adsResult.data as CourseAdWithUpdater[] | null) || []);
            setLectures(lecturesData as CourseLecture[]);
            setBeneficiaries((beneficiariesResult.data as CourseBeneficiary[] | null) || []);

            if (lecturesData.length === 0) {
                setAttendanceData({});
                return;
            }

            const lectureIds = lecturesData.map(lecture => lecture.id);
            const { data: attendanceList, error: attendanceError } = await supabase
                .from('course_attendance')
                .select(COURSE_ATTENDANCE_COLUMNS)
                .in('lecture_id', lectureIds);

            if (attendanceError) throw attendanceError;

            const attendanceMap: Record<string, Attendance[]> = {};
            ((attendanceList || []) as CourseAttendanceRow[]).forEach(attendance => {
                if (!attendance.lecture_id) return;
                if (!attendanceMap[attendance.lecture_id]) attendanceMap[attendance.lecture_id] = [];
                attendanceMap[attendance.lecture_id].push(attendance as Attendance);
            });
            setAttendanceData(attendanceMap);
        } catch (error) {
            console.error('Error fetching course details:', error);
            toast.error(isRTL ? 'فشل في تحميل تفاصيل الكورس' : 'Failed to fetch course details');
        }
    };

    const updateLectureStatus = async (lectureId: string, status: 'scheduled' | 'completed' | 'cancelled') => {
        const { error } = await supabase
            .from('course_lectures')
            .update({ status })
            .eq('id', lectureId);

        if (error) {
            toast.error(isRTL ? 'فشل تحديث الحالة' : 'Failed to update status');
            return;
        }

        // If marked as completed, create trainer participation
        // Only register if lecture was NOT already completed (prevent duplicate)
        if (status === 'completed' && selectedCourse) {
            const currentLecture = lectures.find(l => l.id === lectureId);
            if (currentLecture?.status !== 'completed') {
                await createTrainerParticipation(selectedCourse, lectureId);
            }
        }

        toast.success(isRTL ? 'تم التحديث' : 'Updated');
        setLectures(prev => prev.map(l => l.id === lectureId ? { ...l, status } : l));
    };

    // Create trainer participation when lecture is completed
    // Always logs in trainer_lecture_records (name + phone, no account needed)
    // Additionally logs in activity_submissions if the trainer has a system profile
    const createTrainerParticipation = async (course: Course, lectureId: string) => {
        try {
            // Helper: find profile ID by phone
            const findProfileByPhone = async (phone: string): Promise<string | null> => {
                const cleanPhone = phone.replace(/[\s-]/g, '');
                const { data } = await supabase.from('profiles').select('id')
                    .or(`phone.eq.${cleanPhone},phone.eq.${phone}`).limit(1).maybeSingle();
                return data?.id || null;
            };

            // Helper: always log in trainer_lecture_records (no profile needed)
            const logTrainerRecord = async (name: string, phone: string | null, volunteerId: string | null) => {
                const record: TrainerLectureRecordInsert = {
                    course_id: course.id, lecture_id: lectureId,
                    trainer_name: name, trainer_phone: phone || null, volunteer_id: volunteerId || null
                };
                await supabase.from('trainer_lecture_records').insert(record);
            };

            interface TrainerEntry { name: string; phone: string | null; volunteerId: string | null; hasTrainerId: boolean; }
            const trainers: TrainerEntry[] = [];

            // Case A: Trainers from trainers table (trainer_id + course_trainers from DB)
            const trainerIds = new Set<string>();
            if (course.trainer_id) trainerIds.add(course.trainer_id);
            const { data: ctData } = await supabase
                .from('course_trainers').select('trainer_id').eq('course_id', course.id);
            (ctData as Pick<CourseTrainerRow, 'trainer_id'>[] | null)?.forEach(ct => trainerIds.add(ct.trainer_id));

            for (const tId of trainerIds) {
                const { data: td } = await supabase
                    .from('trainers').select('user_id, phone, name_ar, name_en').eq('id', tId).single();
                if (!td) continue;
                const trainer = td as Pick<TrainerRow, 'user_id' | 'phone' | 'name_ar' | 'name_en'>;
                let vid: string | null = trainer.user_id || null;
                if (!vid && trainer.phone) vid = await findProfileByPhone(trainer.phone);
                trainers.push({ name: trainer.name_ar || trainer.name_en || 'مدرب', phone: trainer.phone, volunteerId: vid, hasTrainerId: true });
            }

            // Case B: External trainer (name + phone on course, no trainer_id)
            if (!course.trainer_id && course.trainer_name) {
                const phones = course.trainer_phone
                    ? course.trainer_phone.split(/[-,]/).map((p: string) => p.trim()).filter(Boolean)
                    : [null];
                for (const phone of phones) {
                    const vid = phone ? await findProfileByPhone(phone) : null;
                    trainers.push({ name: course.trainer_name, phone: phone || course.trainer_phone || null, volunteerId: vid, hasTrainerId: false });
                }
            }

            if (trainers.length === 0) return;

            const lecture = lectures.find(l => l.id === lectureId);
            const lectureNum = lecture?.lecture_number || '';
            const lectureDate = lecture?.date;

            // Get committee + activity type (only for profile trainers)
            let committeeId: string | null = null;
            let activityTypeId: string | null = null;
            let activityPoints = 0;

            if (trainers.some(t => t.volunteerId)) {
                const { data: allCommittees } = await supabase.from('committees').select('id, name');
                if (allCommittees?.length) {
                    const found = allCommittees.find(c =>
                        c.name.toLowerCase().includes('trainer') || c.name.toLowerCase().includes('course') ||
                        c.name.includes('تدريب') || c.name.includes('كورس'));
                    committeeId = found?.id || course.committee_id || allCommittees[0].id;
                }
                const { data: allTypes } = await supabase.from('activity_types').select('id, points, name');
                if (allTypes?.length) {
                    const chosen = allTypes.find(a => a.name === 'Trainer Lecture')
                        || allTypes.find(a => a.name.toLowerCase().includes('trainer') || a.name.includes('محاضر'));
                    if (chosen) { activityTypeId = chosen.id; activityPoints = chosen.points; }
                }
            }

            for (const trainer of trainers) {
                // 1. Always record with name + phone (no account needed)
                await logTrainerRecord(trainer.name, trainer.phone, trainer.volunteerId);

                // 2. If has profile + committee + activity AND is external → also record points
                // Internal trainers with trainer_id are logged automatically by the database trigger
                if (trainer.volunteerId && committeeId && activityTypeId && !trainer.hasTrainerId) {
                    const { error } = await supabase.from('activity_submissions').insert({
                        volunteer_id: trainer.volunteerId,
                        activity_type_id: activityTypeId,
                        committee_id: committeeId,
                        description: `محاضرة ${lectureNum} في كورس: ${course.name}`,
                        points_awarded: activityPoints,
                        status: 'approved', location: 'branch', proof_url: null,
                        submitted_at: lectureDate ? new Date(lectureDate + 'T12:00:00').toISOString() : new Date().toISOString()
                    });
                    if (error) console.error('خطأ في activity_submissions:', error);
                }
            }
        } catch (error) {
            console.error('Error in createTrainerParticipation:', error);
        }
    };


    const isLectureOpen = (dateStr: string) => {
        // Use parseISO to avoid UTC midnight timezone shift (+03:00 would make it previous day)
        const lectureDate = parseISO(dateStr);
        const now = new Date();
        lectureDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        return now >= lectureDate;
    };

    const studentStatsByPhone = useMemo(() => {
        const completedLectureIds = new Set(lectures.filter((lecture) => lecture.status === 'completed').map((lecture) => lecture.id));
        const attendanceCountByPhone = new Map<string, number>();

        Object.entries(attendanceData).forEach(([lectureId, attendance]) => {
            if (!completedLectureIds.has(lectureId)) return;
            attendance.forEach((record) => {
                if (record.status === 'present') {
                    attendanceCountByPhone.set(record.student_phone, (attendanceCountByPhone.get(record.student_phone) || 0) + 1);
                }
            });
        });

        const totalCompleted = completedLectureIds.size;
        return new Map(beneficiaries.map((beneficiary) => {
            const attended = attendanceCountByPhone.get(beneficiary.phone) || 0;
            return [beneficiary.phone, {
                attended,
                missed: totalCompleted - attended,
                rate: totalCompleted > 0 ? Math.round((attended / totalCompleted) * 100) : 0,
            }];
        }));
    }, [attendanceData, beneficiaries, lectures]);

    const getStudentStats = (studentPhone: string) =>
        studentStatsByPhone.get(studentPhone) || { attended: 0, missed: 0, rate: 0 };

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

    const getRoomLabel = (room: string) => rooms[room]?.[language as 'en' | 'ar'] || room;

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
                    national_id: newBeneficiary.national_id || null,
                    created_by: user?.id
                })
                .select()
                .single();

            if (error) throw error;

            setBeneficiaries([...beneficiaries, data]);
            setNewBeneficiary({ name: '', phone: '', national_id: '' });
            toast.success(isRTL ? 'تم إضافة المستفيد' : 'Beneficiary added');
        } catch (error: unknown) {
            console.error('Error adding beneficiary:', error);
            if (getErrorCode(error) === '23505') {
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
                .update({
                    name: editingBeneficiary.name,
                    phone: editingBeneficiary.phone,
                    national_id: editingBeneficiary.national_id || null
                })
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
            await exportCourseReportToXlsx({
                course,
                isRTL,
                getRoomLabel: room => rooms[room]?.[language as 'en' | 'ar'] || room,
                getDayLabel: day => DAYS_LABELS[day]?.[language as 'en' | 'ar'],
            });
        } catch (error) {
            console.error('Export error:', error);
            toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
        }
    };

    const confirmDeleteBeneficiary = (beneficiary: CourseBeneficiary) => {
        setBeneficiaryToDelete(beneficiary);
        setIsDeleteConfirmOpen(true);
    };

    const deleteBeneficiary = async () => {
        if (!beneficiaryToDelete) return;
        try {
            const { error } = await supabase
                .from('course_beneficiaries')
                .delete()
                .eq('id', beneficiaryToDelete.id);

            if (error) throw error;

            setBeneficiaries(beneficiaries.filter(b => b.id !== beneficiaryToDelete.id));
            toast.success(isRTL ? 'تم حذف المستفيد' : 'Beneficiary deleted');
        } catch (error) {
            console.error('Error deleting beneficiary:', error);
            toast.error(isRTL ? 'فشل الحذف' : 'Failed to delete');
        } finally {
            setBeneficiaryToDelete(null);
            setIsDeleteConfirmOpen(false);
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
                                            {organizerCourseIds.has(course.id) && (
                                                <>
                                                    <DropdownMenuItem onClick={() => openCourseDetails(course)}>
                                                        <BookOpen className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                        {isRTL ? 'التفاصيل والحضور' : 'Details & Attendance'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleLeaveCourse(course.id, 'organizer')} className="text-destructive focus:bg-destructive/10">
                                                        <Trash2 className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                        {isRTL ? 'إزالة نفسي كمنظم' : 'Leave as Organizer'}
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                            {marketerCourseIds.has(course.id) && (
                                                <>
                                                    <DropdownMenuItem onClick={() => openCourseDetails(course, 'marketing')}>
                                                        <Megaphone className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                        {isRTL ? 'إدارة التسويق' : 'Marketing Management'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleLeaveCourse(course.id, 'marketer')} className="text-destructive focus:bg-destructive/10">
                                                        <Trash2 className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                        {isRTL ? 'إزالة نفسي كمسوق' : 'Leave as Marketer'}
                                                    </DropdownMenuItem>
                                                </>
                                            )}
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

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                {(() => {
                    const filteredTabBeneficiaries = beneficiaries.filter(b => 
                        b.name.toLowerCase().includes(beneficiaryTabSearch.toLowerCase()) ||
                        b.phone.includes(beneficiaryTabSearch) ||
                        (b.national_id && b.national_id.includes(beneficiaryTabSearch))
                    );
                    return (
                        <DialogContent className="w-full h-full sm:w-[calc(100%-1.5rem)] sm:max-w-4xl sm:max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                                <div className="flex flex-col h-full bg-background overflow-hidden">
                                    {/* Sticky Header */}
                                    <div className="border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                                        <DialogHeader className="p-4 sm:p-6 pb-2 text-center sm:text-center flex flex-col items-center justify-center relative">
                                            <DialogTitle className="text-xl sm:text-2xl font-bold text-center w-full mt-2 sm:mt-0 px-8">
                                                {selectedCourse?.name}
                                            </DialogTitle>
                                            <DialogDescription className="text-center w-full mt-1">
                                                {selectedCourse?.trainer_name} {selectedCourse?.room && ` - ${rooms[selectedCourse.room]?.[language as 'en' | 'ar'] || selectedCourse.room}`}
                                            </DialogDescription>
                                        </DialogHeader>

                                        {/* Tabs Header Selection */}
                                        <div className="px-4 sm:px-6 pb-3">
                                            <div className="overflow-x-auto -mx-2 px-2 pb-0.5 scrollbar-none">
                                                <TabsList className="flex w-full h-auto p-1 bg-muted/50 rounded-xl gap-0.5 xs:gap-1">
                                                    {isOrganizer && (
                                                        <>
                                                            <TabsTrigger
                                                                value="beneficiaries"
                                                                className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                            >
                                                                <span className="flex items-center gap-1.5 justify-center w-full">
                                                                    <Users className="w-3.5 h-3.5" />
                                                                    <span>{isRTL ? 'المستفيدين' : 'Beneficiaries'}</span>
                                                                </span>
                                                            </TabsTrigger>
                                                            <TabsTrigger
                                                                value="lectures"
                                                                className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                            >
                                                                <span className="flex items-center gap-1.5 justify-center w-full">
                                                                    <BookOpen className="w-3.5 h-3.5" />
                                                                    <span>{isRTL ? 'المحاضرات' : 'Lectures'}</span>
                                                                </span>
                                                            </TabsTrigger>
                                                            <TabsTrigger
                                                                value="sheet"
                                                                className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                            >
                                                                <span className="flex items-center gap-1.5 justify-center w-full">
                                                                    <TableIcon className="w-3.5 h-3.5" />
                                                                    <span>{isRTL ? 'شيت الحضور' : 'Attendance'}</span>
                                                                </span>
                                                            </TabsTrigger>
                                                        </>
                                                    )}
                                                    {isMarketer && (
                                                        <TabsTrigger
                                                            value="marketing"
                                                            className="flex-1 sm:flex-initial px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 text-center whitespace-nowrap"
                                                        >
                                                            <span className="flex items-center gap-1.5 justify-center w-full">
                                                                <Megaphone className="w-3.5 h-3.5" />
                                                                <span>{isRTL ? 'التسويق' : 'Marketing'}</span>
                                                            </span>
                                                        </TabsTrigger>
                                                    )}
                                                </TabsList>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Scrollable Tabs Content Area */}
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/5 dark:bg-muted/10">
                                        {/* Beneficiaries Tab - Only render if organizer */}
                                        {isOrganizer && (
                                            <TabsContent value="beneficiaries" className="space-y-4 py-0 outline-none">
                                                {/* Action Bar */}
                                                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                                                    <div className="relative w-full sm:w-72">
                                                        <Search className="absolute ltr:left-3 rtl:right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            placeholder={isRTL ? 'بحث عن مستفيد...' : 'Search beneficiary...'}
                                                            value={beneficiaryTabSearch}
                                                            onChange={e => setBeneficiaryTabSearch(e.target.value)}
                                                            className="ltr:pl-9 rtl:pr-9 h-9 bg-background"
                                                        />
                                                    </div>
                                                    <Button
                                                        onClick={() => {
                                                            setEditingBeneficiary(null);
                                                            setNewBeneficiary({ name: '', phone: '', national_id: '' });
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
                                                                <UserPlus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                                {isRTL ? 'إضافة مستفيد' : 'Add Beneficiary'}
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>

                                                {/* Add Beneficiary Form */}
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
                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'الاسم *' : 'Name *'}</label>
                                                                        <Input
                                                                            placeholder={isRTL ? 'الاسم' : 'Name'}
                                                                            value={newBeneficiary.name}
                                                                            onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name: e.target.value })}
                                                                            className="bg-background"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'رقم الهاتف *' : 'Phone *'}</label>
                                                                        <Input
                                                                            placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                                                                            value={newBeneficiary.phone}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                if (/^[0-9+]*$/.test(val)) {
                                                                                    setNewBeneficiary({ ...newBeneficiary, phone: val });
                                                                                }
                                                                            }}
                                                                            className="bg-background"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[11px] font-semibold text-muted-foreground">{isRTL ? 'الرقم القومي' : 'National ID'}</label>
                                                                        <Input
                                                                            placeholder={isRTL ? 'الرقم القومي' : 'National ID'}
                                                                            value={newBeneficiary.national_id}
                                                                            onChange={(e) => setNewBeneficiary({ ...newBeneficiary, national_id: e.target.value })}
                                                                            className="bg-background"
                                                                        />
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
                                                                        onClick={addBeneficiary}
                                                                        size="sm"
                                                                        className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
                                                                    >
                                                                        <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                                                                        {isRTL ? 'إضافة' : 'Add'}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )}

                                                {/* Mobile Cards View */}
                                                <div className="grid gap-3 sm:hidden">
                                                    {filteredTabBeneficiaries.length === 0 ? (
                                                        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed text-xs">
                                                            {isRTL ? 'لا يوجد مستفيدين' : 'No beneficiaries found'}
                                                        </div>
                                                    ) : (
                                                        filteredTabBeneficiaries.map((b) => {
                                                            const stats = getStudentStats(b.phone);
                                                            return (
                                                                <Card key={b.id} className="border hover:border-primary/20 transition-all bg-card shadow-sm">
                                                                    <CardContent className="p-4 flex flex-col gap-3">
                                                                        <div className="flex items-start justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <Avatar className="h-10 w-10 border border-muted">
                                                                                    <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                                        {b.name?.slice(0, 2)}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                                <div>
                                                                                    <div className="font-semibold text-xs text-foreground">{b.name}</div>
                                                                                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono" dir="ltr">{b.phone}</div>
                                                                                    {b.national_id && <div className="text-[10px] text-muted-foreground">{b.national_id}</div>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-col items-end gap-1.5">
                                                                                <div className="text-[10px] font-semibold">
                                                                                    <span className={stats.rate >= 80 ? 'text-green-600 dark:text-green-400' : stats.rate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                                                                                        {isRTL ? 'حضور:' : 'Attendance:'} {stats.rate}%
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Progress bar */}
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
                                                                                    onClick={() => confirmDeleteBeneficiary(b)}
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
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
                                                                <TableHead>{isRTL ? 'الرقم القومي' : 'National ID'}</TableHead>
                                                                <TableHead className="text-center">{isRTL ? 'إحصائيات الحضور' : 'Attendance Stats'}</TableHead>
                                                                <TableHead className="w-28 text-center">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {filteredTabBeneficiaries.length === 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                                        {isRTL ? 'لا يوجد مستفيدين' : 'No beneficiaries found'}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : (
                                                                filteredTabBeneficiaries.map((b) => {
                                                                    const stats = getStudentStats(b.phone);
                                                                    return (
                                                                        <TableRow key={b.id} className="hover:bg-muted/20 transition-colors">
                                                                            <TableCell>
                                                                                <div className="flex items-center gap-3">
                                                                                    <Avatar className="h-8 w-8 border border-muted">
                                                                                        <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                                            {b.name?.slice(0, 2)}
                                                                                        </AvatarFallback>
                                                                                    </Avatar>
                                                                                    <div className="font-semibold text-xs text-foreground">{b.name}</div>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-xs font-mono text-muted-foreground" dir="ltr">{b.phone}</TableCell>
                                                                            <TableCell className="text-xs text-muted-foreground">{b.national_id || '-'}</TableCell>
                                                                            <TableCell>
                                                                                <div className="flex flex-col items-center justify-center gap-1.5 max-w-[150px] mx-auto">
                                                                                    <div className="flex justify-between items-center w-full text-[10px]">
                                                                                        <span className="font-bold text-muted-foreground">
                                                                                            {isRTL 
                                                                                                ? `نسبة: ${stats.rate}%` 
                                                                                                : `Rate: ${stats.rate}%`}
                                                                                        </span>
                                                                                        <span className="text-[9px] text-muted-foreground">
                                                                                            {isRTL 
                                                                                                ? `حضور ${stats.attended}/${lectures.filter(l => l.status === 'completed').length}` 
                                                                                                : `${stats.attended}/${lectures.filter(l => l.status === 'completed').length} attended`}
                                                                                        </span>
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
                                                                                            setIsEditStudentDialogOpen(true);
                                                                                        }}
                                                                                    >
                                                                                        <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                                                        onClick={() => confirmDeleteBeneficiary(b)}
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
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
                                                <div className="text-sm text-muted-foreground">
                                                    {isRTL ? `إجمالي المستفيدين: ${beneficiaries.length}` : `Total beneficiaries: ${beneficiaries.length}`}
                                                </div>
                                            </TabsContent>
                                        )}

                                        {/* Lectures Tab */}
                                        {isOrganizer && (
                                            <TabsContent value="lectures" className="space-y-4 py-0 outline-none">
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
                                                ))}
                                            </TabsContent>
                                        )}

                                        {/* Attendance Tab */}
                                        {isOrganizer && (
                                            <TabsContent value="sheet" className="py-0 outline-none">
                                                {/* Desktop View Table */}
                                                <div className="hidden sm:block border rounded-xl overflow-hidden shadow-sm bg-card">
                                                    <div className="overflow-x-auto w-full">
                                                        <Table>
                                                            <TableHeader className="bg-muted/40">
                                                                <TableRow>
                                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                                    <TableHead className="whitespace-nowrap">{isRTL ? 'الرقم' : 'Phone'}</TableHead>
                                                                    {lectures.map(l => (
                                                                        <TableHead key={l.id} className="text-center w-12 whitespace-nowrap">
                                                                            L{l.lecture_number}
                                                                        </TableHead>
                                                                    ))}
                                                                    <TableHead className="text-center whitespace-nowrap">{isRTL ? 'حضر' : 'Attended'}</TableHead>
                                                                    <TableHead className="text-center whitespace-nowrap">{isRTL ? 'غاب' : 'Missed'}</TableHead>
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
                                                                            <TableCell className="font-medium whitespace-nowrap">{beneficiary.name}</TableCell>
                                                                            <TableCell className="whitespace-nowrap font-mono" dir="ltr">
                                                                                <div className="flex items-center gap-1">
                                                                                    <span>{beneficiary.phone}</span>
                                                                                    {beneficiary.phone && (
                                                                                        <a
                                                                                            href={`https://wa.me/${beneficiary.phone.replace(/\D/g, '')}`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-green-500 hover:text-green-600 transition-colors p-1"
                                                                                            title={isRTL ? 'مراسلة عبر واتساب' : 'Chat on WhatsApp'}
                                                                                        >
                                                                                            <MessageSquare className="w-4 h-4" />
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                            {lectures.map((lecture, idx) => {
                                                                                const isPresent = attendanceData[lecture.id]?.some(a => a.student_phone === beneficiary.phone && a.status === 'present');
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
                                                                            <TableCell className="text-center font-bold text-green-600 whitespace-nowrap">{attendedCount}</TableCell>
                                                                            <TableCell className="text-center font-bold text-red-600 whitespace-nowrap">{missedCount}</TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                                {beneficiaries.length === 0 && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={lectures.length + 4} className="text-center py-8 text-muted-foreground whitespace-nowrap">
                                                                            {isRTL ? 'لا يوجد مستفيدين - أضف مستفيدين من تبويب المستفيدين أولاً' : 'No beneficiaries - Add beneficiaries from the Beneficiaries tab first'}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>

                                                {/* Mobile View - Student Cards with detailed history dialog */}
                                                <div className="sm:hidden space-y-3">
                                                    {beneficiaries.length === 0 ? (
                                                        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed text-xs">
                                                            {isRTL ? 'لا يوجد مستفيدين - أضف مستفيدين من تبويب المستفيدين أولاً' : 'No beneficiaries - Add beneficiaries from the Beneficiaries tab first'}
                                                        </div>
                                                    ) : (
                                                        beneficiaries.map(beneficiary => {
                                                            const stats = getStudentStats(beneficiary.phone);
                                                            return (
                                                                <Card key={beneficiary.id} className="border hover:border-primary/20 transition-all bg-card shadow-sm">
                                                                    <CardContent className="p-4 flex flex-col gap-3">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <Avatar className="h-9 w-9 border border-muted">
                                                                                    <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                                                                        {beneficiary.name?.slice(0, 2)}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                                <div>
                                                                                    <div className="font-semibold text-xs text-foreground">{beneficiary.name}</div>
                                                                                    <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1" dir="ltr">
                                                                                        <span>{beneficiary.phone || '-'}</span>
                                                                                        {beneficiary.phone && (
                                                                                            <a
                                                                                                href={`https://wa.me/${beneficiary.phone.replace(/\D/g, '')}`}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-green-500 hover:text-green-600 transition-colors p-0.5"
                                                                                                title={isRTL ? 'مراسلة عبر واتساب' : 'Chat on WhatsApp'}
                                                                                            >
                                                                                                <MessageSquare className="w-3.5 h-3.5" />
                                                                                            </a>
                                                                                        )}
                                                                                    </div>
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
                                        )}

                                        {/* Marketing Tab */}
                                        {isMarketer && (
                                            <TabsContent value="marketing" className="space-y-4 py-0 outline-none">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-lg font-semibold">{isRTL ? 'إعلانات الكورس' : 'Course Ads'}</h3>
                                                </div>

                                                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                                    {courseAds.length === 0 ? (
                                                        <div className="col-span-full text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                                                            {isRTL ? 'لا توجد إعلانات بعد' : 'No ads yet'}
                                                        </div>
                                                    ) : (
                                                        courseAds.map((ad) => (
                                                            <Card key={ad.id} className="overflow-hidden">
                                                                <CardHeader className="p-4 pb-2 bg-muted/20">
                                                                    <div className="flex justify-between items-center">
                                                                        <CardTitle className="text-base font-medium">#{ad.ad_number}</CardTitle>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteAd(ad.id)}>
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <Calendar className="w-3 h-3 text-muted-foreground" />
                                                                        <Input
                                                                            type="date"
                                                                            value={ad.ad_date}
                                                                            onChange={(e) => handleUpdateAd(ad.id, { ad_date: e.target.value })}
                                                                            className="h-7 w-auto text-xs p-1"
                                                                            disabled
                                                                        />
                                                                    </div>
                                                                    {ad.updated_at && (
                                                                        <div className="text-[10px] text-muted-foreground mt-1">
                                                                            {isRTL ? 'آخر تحديث: ' : 'Updated: '}
                                                                            {format(new Date(ad.updated_at), 'MMM d, h:mm a')}
                                                                            {ad.updater && ` (${isRTL && ad.updater.full_name_ar ? ad.updater.full_name_ar : ad.updater.full_name})`}
                                                                        </div>
                                                                    )}
                                                                </CardHeader>
                                                                <CardContent className="p-4 flex flex-col gap-4">
                                                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`p-2 rounded-full ${ad.poster_done ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                                                                                <Image className="w-4 h-4" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-sm font-medium">{isRTL ? 'البوستر' : 'Poster'}</span>
                                                                                <span className="text-xs text-muted-foreground">{ad.poster_done ? (isRTL ? 'جاهز' : 'Done') : (isRTL ? 'غير جاهز' : 'Pending')}</span>
                                                                            </div>
                                                                        </div>
                                                                        <Checkbox
                                                                            checked={ad.poster_done}
                                                                            onCheckedChange={(c) => handleUpdateAd(ad.id, { poster_done: !!c })}
                                                                        />
                                                                    </div>

                                                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`p-2 rounded-full ${ad.content_done ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                                                                                <FileText className="w-4 h-4" />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-sm font-medium">{isRTL ? 'المحتوى' : 'Content'}</span>
                                                                                <span className="text-xs text-muted-foreground">{ad.content_done ? (isRTL ? 'جاهز' : 'Done') : (isRTL ? 'غير جاهز' : 'Pending')}</span>
                                                                            </div>
                                                                        </div>
                                                                        <Checkbox
                                                                            checked={ad.content_done}
                                                                            onCheckedChange={(c) => handleUpdateAd(ad.id, { content_done: !!c })}
                                                                        />
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        ))
                                                    )}
                                                </div>
                                            </TabsContent>
                                        )}
                                    </div>
                                </div>
                            </Tabs>
                        </DialogContent>
                    );
                })()}
            </Dialog>

            {/* Edit Student Dialog */}
            <Dialog open={isEditStudentDialogOpen} onOpenChange={setIsEditStudentDialogOpen}>
                <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                            {isRTL ? 'تعديل بيانات المستفيد' : 'Edit Beneficiary Details'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            {isRTL ? 'تعديل الاسم ورقم الهاتف والرقم القومي للمستفيد' : 'Edit name, phone, and national ID for the beneficiary'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">{isRTL ? 'الاسم' : 'Name'}</Label>
                            <Input
                                value={editingBeneficiary?.name || ''}
                                onChange={(e) => setEditingBeneficiary(prev => prev ? { ...prev, name: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">{isRTL ? 'رقم الهاتف' : 'Phone'}</Label>
                            <Input
                                value={editingBeneficiary?.phone || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (/^[0-9+]*$/.test(val)) {
                                        setEditingBeneficiary(prev => prev ? { ...prev, phone: val } : null);
                                    }
                                }}
                                className="h-10 font-mono"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">{isRTL ? 'الرقم القومي' : 'National ID'}</Label>
                            <Input
                                value={editingBeneficiary?.national_id || ''}
                                onChange={(e) => setEditingBeneficiary(prev => prev ? { ...prev, national_id: e.target.value } : null)}
                                className="h-10"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row gap-2 justify-end mt-4">
                        <Button variant="outline" onClick={() => setIsEditStudentDialogOpen(false)} className="h-10 px-4">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!editingBeneficiary) return;
                                await updateBeneficiary();
                                setIsEditStudentDialogOpen(false);
                            }}
                            className="h-10 px-4"
                        >
                            {isRTL ? 'حفظ التعديلات' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Student Attendance History Dialog */}
            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="w-full h-full sm:w-[calc(100%-1.5rem)] sm:max-w-md sm:max-h-[85vh] p-0 flex flex-col rounded-none sm:rounded-2xl overflow-hidden">
                    <DialogHeader className="p-4 sm:p-6 pb-2 border-b shrink-0">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Avatar className="h-8 w-8 border border-muted shrink-0">
                                <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                    {historyStudent?.name?.slice(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[200px]">{historyStudent?.name}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground font-medium">
                            {isRTL ? 'سجل حضور المحاضرات وتعديله' : 'Lecture attendance history and management'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Scrollable checklist of lectures */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5 dark:bg-muted/10">
                        {lectures.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed text-xs">
                                {isRTL ? 'لا توجد محاضرات في هذا الكورس بعد' : 'No lectures in this course yet'}
                            </div>
                        ) : (
                            lectures.map((l) => {
                                const isPresent = attendanceData[l.id]?.some(a => a.student_phone === historyStudent?.phone && a.status === 'present');
                                const isCancelled = l.status === 'cancelled';
                                const isCompleted = l.status === 'completed';
                                const isOpen = isLectureOpen(l.date);
                                const disabled = isCancelled || !(isCompleted || isOpen);

                                return (
                                    <div
                                        key={l.id}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                            isPresent
                                                ? 'border-green-200 bg-green-50/20 dark:border-green-950 dark:bg-green-950/5'
                                                : isCancelled
                                                ? 'border-destructive/20 bg-destructive/5 opacity-70'
                                                : 'bg-background hover:bg-muted/30'
                                        }`}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                                {isRTL ? `محاضرة ${l.lecture_number}` : `Lecture ${l.lecture_number}`}
                                            </span>
                                            <span className="font-medium text-xs">
                                                {l.date}
                                            </span>
                                            {isCancelled && (
                                                <span className="text-[9px] text-destructive font-semibold">
                                                    {isRTL ? 'ملغية' : 'Cancelled'}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <label className="text-xs cursor-pointer select-none font-medium" htmlFor={`hist-att-${l.id}`}>
                                                {isPresent ? (
                                                    <span className="text-green-600 dark:text-green-400 font-bold">{isRTL ? 'حاضر' : 'Present'}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">{isRTL ? 'غائب' : 'Absent'}</span>
                                                )}
                                            </label>

                                            <Checkbox
                                                id={`hist-att-${l.id}`}
                                                checked={isPresent}
                                                disabled={disabled}
                                                onCheckedChange={() => toggleBeneficiaryAttendance(l.id, historyStudent!)}
                                                className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-4 border-t shrink-0 flex justify-end bg-background">
                        <Button className="w-full sm:w-auto" onClick={() => setIsHistoryDialogOpen(false)}>
                            {isRTL ? 'إغلاق' : 'Close'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Beneficiary Confirmation */}
            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="w-5 h-5" />
                            {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                            {isRTL
                                ? `هل أنت متأكد من حذف المستفيد "${beneficiaryToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                                : `Are you sure you want to delete "${beneficiaryToDelete?.name}"? This action cannot be undone.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="flex-1 sm:flex-none">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={deleteBeneficiary}
                            className="flex-1 sm:flex-none bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            <Trash2 className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                            {isRTL ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Leave Course Confirmation */}
            <AlertDialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
                <AlertDialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <X className="w-5 h-5" />
                            {isRTL ? 'تأكيد الإزالة' : 'Confirm Removal'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                            {isRTL
                                ? `هل أنت متأكد من إزالة نفسك ك${leaveType === 'organizer' ? 'منظم' : 'مسوق'} من هذا الكورس؟`
                                : `Are you sure you want to remove yourself as a ${leaveType === 'organizer' ? 'organizer' : 'marketer'} from this course?`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="flex-1 sm:flex-none">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmLeaveCourse}
                            className="flex-1 sm:flex-none bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isRTL ? 'تأكيد' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
