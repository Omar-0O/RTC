import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from '@/components/ui/dialog';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as XLSX from 'xlsx';
import {
    Activity, BookOpen, Calendar, Clock, Users, Plus, Check, X, Trash2,
    MoreHorizontal, Loader2, Download, Globe, MapPin, MonitorPlay, User,
    CalendarDays, TrendingUp, Percent, Filter, Search, MoreVertical, Pencil, UserPlus, UserMinus, ClipboardList, Megaphone
} from 'lucide-react';

interface Teacher {
    id: string;
    name: string;
    target_gender: 'men' | 'women';
    teaching_mode: 'online' | 'offline' | 'both';
}

interface Volunteer {
    id: string;
    full_name: string;
    full_name_ar: string | null;
    phone: string | null;
    avatar_url: string | null;
}

interface Organizer {
    volunteer_id?: string;
    name: string;
    phone: string;
}

interface ScheduleItem {
    day: number; // 0 = Sunday, 6 = Saturday
    time: string; // HH:mm format
}

interface QuranCircle {
    id: string;
    teacher_id: string | null;
    teacher_name?: string;
    teacher_gender?: 'men' | 'women';
    teaching_mode?: 'online' | 'offline' | 'both';
    schedule: ScheduleItem[];
    is_active: boolean;
    organizers?: Organizer[];
    enrolled_count?: number;
    description?: string;
    target_group?: string; // 'adults' | 'children'
    beneficiary_gender?: 'male' | 'female';
    sessions_count?: number;
}

interface Session {
    id: string;
    circle_id: string;
    session_date: string;
    notes: string | null;
    attendees_count?: number;
    status?: 'scheduled' | 'completed' | 'cancelled';
}

interface Attendance {
    beneficiary_id: string;
    attendance_type: 'memorization' | 'revision';
}

interface Guest {
    name: string;
    phone: string;
}

interface Beneficiary {
    id: string;
    name_ar: string;
    name_en: string | null;
    image_url: string | null;
    gender: 'male' | 'female' | null;
    beneficiary_type: 'child' | 'adult';
    phone: string | null;
}

interface QuranCircleMarketer {
    id?: string;
    circle_id?: string;
    volunteer_id?: string;
    name: string;
    phone: string;
}

const DAYS = [
    { value: 6, label: { en: 'Saturday', ar: 'السبت' } },
    { value: 0, label: { en: 'Sunday', ar: 'الأحد' } },
    { value: 1, label: { en: 'Monday', ar: 'الإثنين' } },
    { value: 2, label: { en: 'Tuesday', ar: 'الثلاثاء' } },
    { value: 3, label: { en: 'Wednesday', ar: 'الأربعاء' } },
    { value: 4, label: { en: 'Thursday', ar: 'الخميس' } },
    { value: 5, label: { en: 'Friday', ar: 'الجمعة' } },
];

const DAYS_SHORT_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function QuranCircles() {
    const { isRTL, language } = useLanguage();
    const navigate = useNavigate();
    const { hasRole } = useAuth();
    const canManageOrganizers = hasRole('admin') || hasRole('head_quran');

    const [circles, setCircles] = useState<QuranCircle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [organizerPopoverOpen, setOrganizerPopoverOpen] = useState(false);

    // Details dialog
    const [selectedCircle, setSelectedCircle] = useState<QuranCircle | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [detailsBeneficiaries, setDetailsBeneficiaries] = useState<Beneficiary[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, Attendance[]>>({});

    // Session creation
    const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionNotes, setSessionNotes] = useState('');

    // Attendance dialog
    const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [sessionBeneficiarySearch, setSessionBeneficiarySearch] = useState('');

    // Guest state
    const [guests, setGuests] = useState<Guest[]>([]);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    // Delete session state
    const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        teacher_id: '',
        schedule_days: [] as number[],
        schedule_time: '18:00',
        is_active: true,
        description: '',
        target_group: 'adults',
        beneficiary_gender: 'male' as 'male' | 'female'
    });
    const [organizers, setOrganizers] = useState<Organizer[]>([]);

    // Reference data
    const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);

    // Enrollment management
    const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
    const [enrollmentCircle, setEnrollmentCircle] = useState<QuranCircle | null>(null);
    const [enrolledBeneficiaries, setEnrolledBeneficiaries] = useState<Beneficiary[]>([]);
    const [allBeneficiaries, setAllBeneficiaries] = useState<Beneficiary[]>([]);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');
    const [enrollmentLoading, setEnrollmentLoading] = useState(false);

    // New Beneficiary Management State
    const [isAddingBeneficiary, setIsAddingBeneficiary] = useState(false);
    const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
    const [newBeneficiary, setNewBeneficiary] = useState({
        name_ar: '',
        name_en: '',
        phone: '',
        gender: 'male' as 'male' | 'female',
        beneficiary_type: 'adult' as 'child' | 'adult'
    });

    // Marketing Team State
    const [marketers, setMarketers] = useState<QuranCircleMarketer[]>([]);
    const [marketerPopoverOpen, setMarketerPopoverOpen] = useState(false);

    useEffect(() => {
        fetchCircles();
        fetchTeachers();
        fetchVolunteers();
    }, []);

    const fetchCircles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('quran_circles')
                .select(`
                    *,
                    quran_circle_organizers(volunteer_id, name, phone)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch enrolled counts
            const circleIds = (data || []).map(c => c.id);
            const { data: enrollments } = await supabase
                .from('quran_enrollments')
                .select('circle_id')
                .in('circle_id', circleIds)
                .eq('status', 'active');

            const enrollmentCounts: Record<string, number> = {};
            (enrollments || []).forEach(e => {
                enrollmentCounts[e.circle_id] = (enrollmentCounts[e.circle_id] || 0) + 1;
            });

            // Fetch teachers separately to ensure we have data for mapping
            const { data: teachersData } = await supabase
                .from('quran_teachers')
                .select('id, name, target_gender, teaching_mode');

            const teachersMap = new Map(teachersData?.map(t => [t.id, t]) || []);

            const formattedData = (data || []).map((circle: any) => {
                const teacher = teachersMap.get(circle.teacher_id);
                return {
                    id: circle.id,
                    teacher_id: circle.teacher_id,
                    teacher_name: teacher?.name,
                    teacher_gender: teacher?.target_gender as 'men' | 'women',
                    teaching_mode: teacher?.teaching_mode as 'online' | 'offline' | 'both',
                    schedule: circle.schedule || [],
                    is_active: circle.is_active ?? true,
                    organizers: circle.quran_circle_organizers || [],
                    enrolled_count: enrollmentCounts[circle.id] || 0,
                    description: circle.description,
                    target_group: circle.target_group,
                    beneficiary_gender: circle.beneficiary_gender
                };
            });

            setCircles(formattedData);
        } catch (error) {
            console.error('Error fetching circles:', error);
            toast.error(isRTL ? 'فشل تحميل الحلقات' : 'Failed to fetch circles');
        } finally {
            setLoading(false);
        }
    };

    const fetchTeachers = async () => {
        try {
            const { data: teachersData, error } = await supabase
                .from('quran_teachers')
                .select('*')
                .order('name');

            if (error) throw error;

            // Map to existing interface
            const teachers = teachersData?.map((t: any) => ({
                id: t.id,
                name: t.name,
                target_gender: t.target_gender,
                teaching_mode: t.teaching_mode
            })) || [];

            setAllTeachers(teachers);
        } catch (error) {
            console.error('Error fetching teachers:', error);
        }
    };

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

    const getCircleName = (circle: QuranCircle) => {
        if (circle.teacher_name) {
            return isRTL ? `حلقة المحفظ ${circle.teacher_name}` : `${circle.teacher_name}'s Circle`;
        }
        return isRTL ? 'حلقة قرآن' : 'Quran Circle';
    };

    const getScheduleDisplay = (schedule: ScheduleItem[]) => {
        if (!schedule || schedule.length === 0) return isRTL ? 'لم يتم تحديد موعد' : 'No schedule set';

        return schedule.map(s => {
            const day = DAYS.find(d => d.value === s.day);

            // Convert 24-hour time to 12-hour format with AM/PM
            const [hours, minutes] = s.time.split(':');
            const hour = parseInt(hours);
            const period = hour >= 12 ? (isRTL ? 'مساءً' : 'PM') : (isRTL ? 'صباحاً' : 'AM');
            const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const time12 = `${hour12}:${minutes} ${period}`;

            return `${day?.label[language as 'en' | 'ar'] || ''} ${time12}`;
        }).join(' • ');
    };

    const handleAddOrganizer = (volunteer: Volunteer) => {
        if (organizers.some(o => o.volunteer_id === volunteer.id)) return;

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

    const handleAddMarketer = (volunteer: Volunteer) => {
        // Check if already added
        if (marketers.some(m => m.volunteer_id === volunteer.id)) {
            return;
        }
        setMarketers([...marketers, {
            volunteer_id: volunteer.id,
            name: isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name,
            phone: volunteer.phone || ''
        }]);
        setMarketerPopoverOpen(false);
    };

    const removeMarketer = (index: number) => {
        setMarketers(marketers.filter((_, i) => i !== index));
    };

    const toggleDay = (day: number) => {
        if (formData.schedule_days.includes(day)) {
            setFormData({ ...formData, schedule_days: formData.schedule_days.filter(d => d !== day) });
        } else {
            setFormData({ ...formData, schedule_days: [...formData.schedule_days, day] });
        }
    };

    const handleAddOrganizerToCircle = async (organizer: Organizer) => {
        if (!selectedCircle || !organizer.volunteer_id) return;

        try {
            const { error } = await supabase
                .from('quran_circle_organizers')
                .insert({
                    circle_id: selectedCircle.id,
                    volunteer_id: organizer.volunteer_id,
                    name: organizer.name,
                    phone: organizer.phone
                });

            if (error) throw error;

            toast.success(isRTL ? 'تم إضافة المنظم' : 'Organizer added');

            // Update local state
            const updatedOrganizers = [...(selectedCircle.organizers || []), organizer];
            const updatedCircle = { ...selectedCircle, organizers: updatedOrganizers };

            setSelectedCircle(updatedCircle);
            setCircles(circles.map(c => c.id === selectedCircle.id ? updatedCircle : c));

        } catch (error) {
            console.error('Error adding organizer:', error);
            toast.error(isRTL ? 'فشل إضافة المنظم' : 'Failed to add organizer');
        }
    };

    const handleRemoveOrganizerFromCircle = async (organizer: Organizer) => {
        if (!selectedCircle || !organizer.volunteer_id) return;

        try {
            const { error } = await supabase
                .from('quran_circle_organizers')
                .delete()
                .eq('circle_id', selectedCircle.id)
                .eq('volunteer_id', organizer.volunteer_id);

            if (error) throw error;

            toast.success(isRTL ? 'تم حذف المنظم' : 'Organizer removed');

            // Update local state
            const updatedOrganizers = (selectedCircle.organizers || []).filter(o => o.volunteer_id !== organizer.volunteer_id);
            const updatedCircle = { ...selectedCircle, organizers: updatedOrganizers };

            setSelectedCircle(updatedCircle);
            setCircles(circles.map(c => c.id === selectedCircle.id ? updatedCircle : c));

        } catch (error) {
            console.error('Error removing organizer:', error);
            toast.error(isRTL ? 'فشل حذف المنظم' : 'Failed to remove organizer');
        }
    };

    const handleSave = async () => {
        if (!formData.teacher_id) {
            toast.error(isRTL ? 'يرجى اختيار المحفظ' : 'Please select a teacher');
            return;
        }
        if (formData.schedule_days.length === 0) {
            toast.error(isRTL ? 'يرجى اختيار يوم واحد على الأقل' : 'Please select at least one day');
            return;
        }

        try {
            // Build schedule array from selected days and time
            const schedule = formData.schedule_days.map(day => ({
                day,
                time: formData.schedule_time
            }));

            // If new circle or editing, valid teacher must be from quran_teachers
            // If the DB FK still points to trainers, this insert might fail if the ID exists in quran_teachers but not trainers (if they are separate).
            // But if we moved them, they are new IDs?
            // User instruction was: "make teachers quran_teachers table and don't touch trainers".
            // So we assume quran_teachers are independent.
            // If quran_circles.teacher_id still references trainers, we have a problem.
            // We'll proceed assuming the user will fix the FK constraint to point to quran_teachers as per plan.
            const dataToSave = {
                teacher_id: formData.teacher_id,
                schedule: schedule,
                is_active: formData.is_active,
                name: 'auto', // Legacy
                date: new Date().toISOString().split('T')[0], // Legacy
                description: formData.description,
                target_group: formData.target_group,
                beneficiary_gender: formData.beneficiary_gender
            };

            let circleId = selectedId;

            if (isEditMode && selectedId) {
                const { error } = await supabase
                    .from('quran_circles')
                    .update(dataToSave)
                    .eq('id', selectedId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('quran_circles')
                    .insert(dataToSave)
                    .select()
                    .single();
                if (error) throw error;
                circleId = data.id;
            }

            // Update organizers - delete all and re-insert
            if (circleId) {
                await supabase.from('quran_circle_organizers').delete().eq('circle_id', circleId);

                if (organizers.length > 0) {
                    await supabase.from('quran_circle_organizers').insert(
                        organizers.map(o => ({
                            circle_id: circleId,
                            volunteer_id: o.volunteer_id || null,
                            name: o.name,
                            phone: o.phone
                        }))
                    );
                }

                // Update marketers - delete all and re-insert
                await supabase.from('quran_circle_marketers').delete().eq('circle_id', circleId);

                if (marketers.length > 0) {
                    await supabase.from('quran_circle_marketers').insert(
                        marketers.map(m => ({
                            circle_id: circleId,
                            volunteer_id: m.volunteer_id
                        }))
                    );
                }
            }

            toast.success(isRTL ? (isEditMode ? 'تم التحديث بنجاح' : 'تم إنشاء الحلقة بنجاح') : (isEditMode ? 'Updated successfully' : 'Circle created successfully'));
            setIsCreateOpen(false);
            resetForm();
            fetchCircles();
        } catch (error: any) {
            console.error('Error saving:', error);
            toast.error(error.message || 'Error occurred');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            const { error } = await supabase
                .from('quran_circles')
                .delete()
                .eq('id', deleteId);

            if (error) throw error;
            toast.success(isRTL ? 'تم الحذف' : 'Deleted');
            fetchCircles();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete');
        } finally {
            setDeleteId(null);
        }
    };

    const handleEdit = async (circle: QuranCircle) => {
        // Extract days from schedule
        const scheduleDays = circle.schedule.map(s => s.day);
        const scheduleTime = circle.schedule[0]?.time || '18:00';

        setFormData({
            teacher_id: circle.teacher_id || '',
            schedule_days: scheduleDays,
            schedule_time: scheduleTime,
            is_active: circle.is_active,
            description: circle.description || '',
            target_group: circle.target_group || 'adults',
            beneficiary_gender: circle.beneficiary_gender || 'male'
        });

        // Fetch organizers
        const { data: orgData } = await supabase
            .from('quran_circle_organizers')
            .select('*')
            .eq('circle_id', circle.id);

        setOrganizers(orgData?.map((o: any) => ({
            volunteer_id: o.volunteer_id,
            name: o.name,
            phone: o.phone || ''
        })) || []);

        // Fetch marketers
        const { data: marketersData } = await supabase
            .from('quran_circle_marketers')
            .select(`
                id,
                circle_id,
                volunteer_id,
                profiles:volunteer_id (
                    full_name,
                    full_name_ar,
                    phone
                )
            `)
            .eq('circle_id', circle.id);

        if (marketersData) {
            const formattedMarketers = marketersData.map((m: any) => ({
                id: m.id,
                circle_id: m.circle_id,
                volunteer_id: m.volunteer_id,
                name: isRTL && m.profiles?.full_name_ar ? m.profiles.full_name_ar : m.profiles?.full_name || '',
                phone: m.profiles?.phone || ''
            }));
            setMarketers(formattedMarketers);
        }

        setSelectedId(circle.id);
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const resetForm = () => {
        setFormData({
            teacher_id: '',
            schedule_days: [],
            schedule_time: '18:00',
            is_active: true,
            description: '',
            target_group: 'adults',
            beneficiary_gender: 'male'
        });
        setOrganizers([]);
        setMarketers([]);
        setIsEditMode(false);
        setSelectedId(null);
    };

    // Enrollment functions
    const fetchAllBeneficiaries = async () => {
        try {
            const { data, error } = await supabase
                .from('quran_beneficiaries')
                .select('id, name_ar, name_en, image_url, gender, beneficiary_type, phone')
                .order('name_ar');
            if (error) throw error;
            setAllBeneficiaries((data as unknown as Beneficiary[]) || []);
        } catch (error) {
            console.error('Error fetching beneficiaries:', error);
        }
    };

    const fetchEnrollments = async (circleId: string) => {
        setEnrollmentLoading(true);
        try {
            const { data, error } = await supabase
                .from('quran_enrollments')
                .select(`
                    beneficiary_id,
                    quran_beneficiaries!inner(id, name_ar, name_en, image_url, gender, beneficiary_type, phone)
                `)
                .eq('circle_id', circleId)
                .eq('status', 'active');

            if (error) throw error;

            const beneficiaries = data?.map((e: any) => ({
                id: e.quran_beneficiaries.id,
                name_ar: e.quran_beneficiaries.name_ar,
                name_en: e.quran_beneficiaries.name_en,
                image_url: e.quran_beneficiaries.image_url,
                gender: e.quran_beneficiaries.gender,
                beneficiary_type: e.quran_beneficiaries.beneficiary_type,
                phone: e.quran_beneficiaries.phone
            })) || [];

            setEnrolledBeneficiaries(beneficiaries);
        } catch (error) {
            console.error('Error fetching enrollments:', error);
        } finally {
            setEnrollmentLoading(false);
        }
    };

    const openEnrollmentDialog = async (circle: QuranCircle) => {
        setEnrollmentCircle(circle);
        setIsEnrollmentOpen(true);
        await fetchAllBeneficiaries();
        await fetchEnrollments(circle.id);
    };

    const handleEnroll = async (beneficiaryId: string) => {
        if (!enrollmentCircle) return;
        try {
            const { error } = await supabase
                .from('quran_enrollments')
                .insert({
                    circle_id: enrollmentCircle.id,
                    beneficiary_id: beneficiaryId,
                    status: 'active'
                });

            if (error) throw error;
            toast.success(isRTL ? 'تم تسجيل المستفيد' : 'Beneficiary enrolled');
            await fetchEnrollments(enrollmentCircle.id);
            fetchCircles(); // Refresh count

            // Refresh details view if open for this circle
            if (selectedCircle?.id === enrollmentCircle.id) {
                openCircleDetails(selectedCircle);
            }
        } catch (error: any) {
            console.error('Error enrolling:', error);
            toast.error(error.message || 'Error enrolling');
        }
    };

    const handleUnenroll = async (beneficiaryId: string) => {
        if (!enrollmentCircle) return;
        try {
            const { error } = await supabase
                .from('quran_enrollments')
                .delete()
                .eq('circle_id', enrollmentCircle.id)
                .eq('beneficiary_id', beneficiaryId);

            if (error) throw error;
            toast.success(isRTL ? 'تم إلغاء التسجيل' : 'Enrollment removed');
            await fetchEnrollments(enrollmentCircle.id);
            fetchCircles(); // Refresh count

            // Refresh details view if open for this circle
            if (selectedCircle?.id === enrollmentCircle.id) {
                openCircleDetails(selectedCircle);
            }
        } catch (error: any) {
            console.error('Error unenrolling:', error);
            toast.error(error.message || 'Error unenrolling');
        }
    };

    const filteredBeneficiariesForEnrollment = allBeneficiaries.filter(b => {
        const matchesSearch = b.name_ar.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
            (b.name_en?.toLowerCase() || '').includes(beneficiarySearch.toLowerCase());

        if (!matchesSearch) return false;
        if (!enrollmentCircle) return true;

        // Filter by Circle Target Group (Adults/Children)
        const isChild = b.beneficiary_type === 'child';
        if (enrollmentCircle.target_group === 'children' && !isChild) return false;
        if (enrollmentCircle.target_group === 'adults' && isChild) return false;

        // Filter by Circle Beneficiary Gender
        // Use the circle's explicit beneficiary_gender field instead of teacher gender
        if (enrollmentCircle.beneficiary_gender === 'male' && b.gender !== 'male') return false;
        if (enrollmentCircle.beneficiary_gender === 'female' && b.gender !== 'female') return false;

        return true;
    });

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

        // Fetch enrolled beneficiaries for details view
        const { data: enrolledData, error } = await supabase
            .from('quran_enrollments')
            .select(`
                beneficiary_id,
                quran_beneficiaries!inner(id, name_ar, name_en, phone, image_url, gender, beneficiary_type)
            `)
            .eq('circle_id', circle.id)
            .eq('status', 'active');

        if (!error && enrolledData) {
            const bens = enrolledData.map((e: any) => ({
                id: e.quran_beneficiaries.id,
                name_ar: e.quran_beneficiaries.name_ar,
                name_en: e.quran_beneficiaries.name_en,
                phone: e.quran_beneficiaries.phone,
                image_url: e.quran_beneficiaries.image_url,
                gender: e.quran_beneficiaries.gender,
                beneficiary_type: e.quran_beneficiaries.beneficiary_type
            }));
            setDetailsBeneficiaries(bens);
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

            // --- Record Teacher Participation ---
            try {
                const { data: teacherData } = await supabase
                    .from('quran_teachers')
                    .select('user_id')
                    .eq('id', selectedCircle.teacher_id)
                    .single();

                if (teacherData?.user_id) {
                    // 1. Get or create the Quran committee
                    let committeeId: string;
                    const { data: existingComm } = await supabase
                        .from('committees')
                        .select('id')
                        .eq('name', 'Quran')
                        .single();

                    if (existingComm) {
                        committeeId = existingComm.id;
                    } else {
                        const { data: newComm, error: commErr } = await supabase
                            .from('committees')
                            .insert({ name: 'Quran', name_ar: 'قرآن' })
                            .select('id')
                            .single();
                        if (commErr || !newComm) throw commErr;
                        committeeId = newComm.id;
                    }

                    // 2. Get or create the activity type
                    let activityTypeId: string;
                    let points: number;
                    const { data: existingAct } = await supabase
                        .from('activity_types')
                        .select('id, points')
                        .eq('name', 'Quran Circle')
                        .single();

                    if (existingAct) {
                        activityTypeId = existingAct.id;
                        points = existingAct.points;
                    } else {
                        const { data: newAct, error: actErr } = await supabase
                            .from('activity_types')
                            .insert({
                                name: 'Quran Circle',
                                name_ar: 'حلقة قرآن',
                                points: 10,
                                committee_id: committeeId
                            })
                            .select('id, points')
                            .single();
                        if (actErr || !newAct) throw actErr;
                        activityTypeId = newAct.id;
                        points = newAct.points;
                    }

                    // 3. Insert the activity submission
                    const { error: partError } = await supabase.from('activity_submissions').insert({
                        volunteer_id: teacherData.user_id,
                        committee_id: committeeId,
                        activity_type_id: activityTypeId,
                        description: `حلقة قرآن: ${selectedCircle.teacher_name || ''} - ${sessionDate}`,
                        status: 'approved',
                        points_awarded: points,
                        participant_type: 'trainer'
                    } as any);

                    if (partError) {
                        console.error('Error recording participation:', partError);
                    } else {
                        toast.success(isRTL ? 'تم تسجيل مشاركة المحفظ' : 'Teacher participation recorded');
                    }
                }
            } catch (partErr) {
                console.error('Participation logic error:', partErr);
            }

            // Refresh sessions
            await openCircleDetails(selectedCircle);

            // Auto-open attendance dialog
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
                        // Use circle's beneficiary_gender with fallback to teacher_gender for backward compatibility
                        gender: (selectedCircle.beneficiary_gender || selectedCircle.teacher_gender) === 'female' ||
                            (selectedCircle.beneficiary_gender || selectedCircle.teacher_gender) === 'women'
                            ? 'female' : 'male',
                        // Determine beneficiary type from circle's target_group
                        beneficiary_type: selectedCircle.target_group === 'children' ? 'child' : 'adult'
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

            // Single Bulk Insert - Remove duplicates based on beneficiary_id
            if (allRecords.length > 0) {
                // Deduplicate by beneficiary_id to prevent duplicate key errors
                const uniqueRecords = Array.from(
                    new Map(allRecords.map(r => [r.beneficiary_id, r])).values()
                );

                const { error } = await supabase
                    .from('quran_circle_beneficiaries')
                    .insert(uniqueRecords);

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
        setAttendance(detailsBeneficiaries.map(b => ({
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
        if (!detailsBeneficiaries.length) return null;
        const att = attendanceData[session.id] || [];
        return Math.round((att.length / detailsBeneficiaries.length) * 100);
    };

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
                    [isRTL ? 'اليوم' : 'Day']: format(new Date(s.session_date), 'EEEE', { locale: isRTL ? ar : enUS }),
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

    const filteredDetailsBeneficiaries = detailsBeneficiaries.filter(b =>
        b.name_ar.toLowerCase().includes(sessionBeneficiarySearch.toLowerCase()) ||
        (b.name_en?.toLowerCase() || '').includes(sessionBeneficiarySearch.toLowerCase())
    );

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
                // Create new logic (existing)
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
            setIsAddingBeneficiary(false);
            setEditingBeneficiary(null);
            setNewBeneficiary({
                name_ar: '',
                name_en: '',
                phone: '',
                gender: 'male',
                beneficiary_type: 'adult'
            });
            await openCircleDetails(selectedCircle);
            fetchCircles(); // Refresh counts

        } catch (error: any) {
            console.error('Error saving beneficiary:', error);
            toast.error(error.message || (isRTL ? 'حدث خطأ أثناء الحفظ' : 'Error saving beneficiary'));
        }
    };

    const handleViewDetails = (circleId: string) => {
        // Find the circle
        const circle = circles.find(c => c.id === circleId);
        if (circle) {
            openCircleDetails(circle);
        }
    };

    const filteredCircles = circles.filter(c =>
        getCircleName(c).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <Users className="h-8 w-8 text-primary" />
                        {isRTL ? 'إدارة حلقات القرآن' : 'Quran Circles Management'}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {isRTL ? 'إنشاء وإدارة الحلقات الأسبوعية المتكررة' : 'Create and manage recurring weekly circles'}
                    </p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            {isRTL ? 'إضافة حلقة' : 'Add Circle'}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {isEditMode
                                    ? (isRTL ? 'تعديل الحلقة' : 'Edit Circle')
                                    : (isRTL ? 'إضافة حلقة جديدة' : 'Add New Circle')}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            {/* Teacher Selection */}
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {isRTL ? 'المحفظ' : 'Teacher'} <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={formData.teacher_id}
                                    onValueChange={val => setFormData({ ...formData, teacher_id: val })}
                                >
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder={isRTL ? 'اختر المحفظ...' : 'Select teacher...'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allTeachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {isRTL ? 'اسم الحلقة سيكون "حلقة المحفظ [الاسم]" تلقائياً' : 'Circle name will be auto-generated from teacher name'}
                                </p>
                            </div>

                            {/* Target Group */}
                            <div className="grid gap-2">
                                <Label>{isRTL ? 'الفئة المستهدفة' : 'Target Group'}</Label>
                                <Select
                                    value={formData.target_group}
                                    onValueChange={val => setFormData({ ...formData, target_group: val })}
                                >
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder={isRTL ? 'اختر الفئة...' : 'Select Target Group...'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="adults">{isRTL ? 'بالغين' : 'Adults'}</SelectItem>
                                        <SelectItem value="children">{isRTL ? 'أطفال' : 'Children'}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Beneficiary Gender */}
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {isRTL ? 'نوع المستفيدين' : 'Beneficiary Gender'}
                                </Label>
                                <Select
                                    value={formData.beneficiary_gender}
                                    onValueChange={val => setFormData({ ...formData, beneficiary_gender: val as 'male' | 'female' })}
                                >
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder={isRTL ? 'اختر النوع...' : 'Select Gender...'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4" />
                                                {isRTL ? 'رجال' : 'Men'}
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="female">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4" />
                                                {isRTL ? 'نساء' : 'Women'}
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Schedule Days */}
                            <div className="grid gap-3">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {isRTL ? 'أيام الحلقة' : 'Circle Days'} <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS.map(day => (
                                        <div
                                            key={day.value}
                                            onClick={() => toggleDay(day.value)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${formData.schedule_days.includes(day.value)
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-background hover:bg-muted border-input'
                                                }`}
                                        >
                                            <Checkbox
                                                checked={formData.schedule_days.includes(day.value)}
                                                className="pointer-events-none"
                                            />
                                            <span className="font-medium">{day.label[language as 'en' | 'ar']}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Schedule Time */}
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    {isRTL ? 'وقت الحلقة' : 'Circle Time'}
                                </Label>
                                <Input
                                    type="time"
                                    value={formData.schedule_time}
                                    onChange={e => setFormData({ ...formData, schedule_time: e.target.value })}
                                    className="h-12 w-48"
                                />
                            </div>

                            {/* Description */}
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2">
                                    {isRTL ? 'وصف الحلقة' : 'Description'}
                                </Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={isRTL ? 'اكتب وصفاً للحلقة...' : 'Enter circle description...'}
                                    className="min-h-[80px]"
                                />
                            </div>

                            {/* Organizers */}
                            <div className="grid gap-3">
                                <Label className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {isRTL ? 'المنظمين' : 'Organizers'}
                                </Label>

                                <Popover open={organizerPopoverOpen} onOpenChange={setOrganizerPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-12 justify-start gap-2">
                                            <Plus className="h-4 w-4" />
                                            {isRTL ? 'إضافة منظم' : 'Add Organizer'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
                                            <CommandList>
                                                <CommandEmpty>{isRTL ? 'لم يتم العثور على نتائج' : 'No results found'}</CommandEmpty>
                                                <CommandGroup>
                                                    {volunteers.map(v => (
                                                        <CommandItem
                                                            key={v.id}
                                                            onSelect={() => handleAddOrganizer(v)}
                                                            className="flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={v.avatar_url || undefined} />
                                                                <AvatarFallback>{v.full_name?.slice(0, 2)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1">
                                                                <p className="font-medium">{isRTL && v.full_name_ar ? v.full_name_ar : v.full_name}</p>
                                                                <p className="text-xs text-muted-foreground">{v.phone}</p>
                                                            </div>
                                                            {organizers.some(o => o.volunteer_id === v.id) && (
                                                                <Check className="h-4 w-4 text-primary" />
                                                            )}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {organizers.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {organizers.map((org, idx) => (
                                            <Badge key={idx} variant="secondary" className="px-3 py-2 gap-2">
                                                <span>{org.name}</span>
                                                <button onClick={() => removeOrganizer(idx)} className="hover:text-destructive">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Marketing Team */}
                            <div className="grid gap-3">
                                <Label className="flex items-center gap-2">
                                    <Megaphone className="h-4 w-4" />
                                    {isRTL ? 'فريق التسويق' : 'Marketing Team'}
                                </Label>

                                <Popover open={marketerPopoverOpen} onOpenChange={setMarketerPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-12 justify-start gap-2">
                                            <Plus className="h-4 w-4" />
                                            {isRTL ? 'إضافة مسوق' : 'Add Marketer'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
                                            <CommandList>
                                                <CommandEmpty>{isRTL ? 'لم يتم العثور على نتائج' : 'No results found'}</CommandEmpty>
                                                <CommandGroup>
                                                    {volunteers.map(v => (
                                                        <CommandItem
                                                            key={v.id}
                                                            onSelect={() => handleAddMarketer(v)}
                                                            className="flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={v.avatar_url || undefined} />
                                                                <AvatarFallback>{v.full_name?.slice(0, 2)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1">
                                                                <p className="font-medium">{isRTL && v.full_name_ar ? v.full_name_ar : v.full_name}</p>
                                                                <p className="text-xs text-muted-foreground">{v.phone}</p>
                                                            </div>
                                                            {marketers.some(m => m.volunteer_id === v.id) && (
                                                                <Check className="h-4 w-4 text-primary" />
                                                            )}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {marketers.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {marketers.map((mkt, idx) => (
                                            <Badge key={idx} variant="secondary" className="px-3 py-2 gap-2">
                                                <span>{mkt.name}</span>
                                                <button onClick={() => removeMarketer(idx)} className="hover:text-destructive">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>


                            {/* Active Toggle */}
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                                <div>
                                    <Label>{isRTL ? 'الحلقة نشطة' : 'Circle Active'}</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {isRTL ? 'إيقاف الحلقة مؤقتاً بدون حذفها' : 'Temporarily disable without deleting'}
                                    </p>
                                </div>
                                <Switch
                                    checked={formData.is_active}
                                    onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t pt-4">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                {isRTL ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button onClick={handleSave} className="px-6">
                                {isRTL ? 'حفظ' : 'Save'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={isRTL ? 'بحث...' : 'Search...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Circles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-48 rounded-lg border bg-card animate-pulse bg-muted/20" />
                    ))
                ) : filteredCircles.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center py-12 text-muted-foreground border rounded-lg bg-gradient-to-br from-muted/30 to-transparent">
                        <div className="p-4 rounded-full bg-muted/50 mb-3">
                            <Users className="h-10 w-10 opacity-30" />
                        </div>
                        <p className="font-medium text-lg">{isRTL ? 'لا توجد حلقات' : 'No circles found'}</p>
                        <p className="text-sm mt-1">{searchQuery ? (isRTL ? 'جرب كلمة بحث مختلفة' : 'Try a different search') : (isRTL ? 'أنشئ أول حلقة' : 'Create your first circle')}</p>
                    </div>
                ) : (
                    filteredCircles.map((c) => (
                        <Card
                            key={c.id}
                            className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg ${c.is_active ? 'hover:border-primary/50 hover:-translate-y-1' : 'opacity-70'
                                }`}
                        >
                            {/* Status indicator bar */}
                            <div className={`absolute inset-x-0 top-0 h-1.5 ${c.is_active
                                ? 'bg-gradient-to-r from-primary via-primary/70 to-primary/30'
                                : 'bg-gradient-to-r from-muted to-muted/50'
                                }`} />

                            <CardHeader className="pb-3 space-y-3">
                                {/* Title Row with Actions */}
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <CardTitle className="text-lg font-semibold truncate">
                                                {getCircleName(c)}
                                            </CardTitle>
                                            {c.enrolled_count !== undefined && c.enrolled_count > 0 && (
                                                <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-0 px-2.5 py-0.5 text-xs font-semibold">
                                                    {c.enrolled_count} {isRTL ? 'طالب' : 'students'}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Schedule Info */}
                                        <CardDescription className="flex items-center gap-1.5 mt-2 text-xs">
                                            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span className="truncate">{getScheduleDisplay(c.schedule)}</span>
                                        </CardDescription>
                                    </div>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleViewDetails(c.id)}>
                                                <ClipboardList className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'التفاصيل والحضور' : 'Details & Attendance'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEdit(c)}>
                                                <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'تعديل' : 'Edit'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(c.id)}>
                                                <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'حذف' : 'Delete'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Badges Row - All in one line */}
                                <div className="flex flex-wrap gap-2 text-xs">
                                    {/* Target Group Badge */}
                                    {c.target_group && (
                                        <Badge
                                            variant="outline"
                                            className={`flex items-center gap-1.5 px-2.5 py-1 font-medium ${c.target_group === 'children'
                                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
                                                : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800'
                                                }`}
                                        >
                                            <Users className="h-3.5 w-3.5" />
                                            {c.target_group === 'children' ? (isRTL ? 'أطفال' : 'Children') : (isRTL ? 'بالغين' : 'Adults')}
                                        </Badge>
                                    )}

                                    {/* Beneficiary Gender Badge */}
                                    {c.beneficiary_gender && (
                                        <Badge
                                            variant="outline"
                                            className={`flex items-center gap-1.5 px-2.5 py-1 font-medium ${c.beneficiary_gender === 'male'
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800'
                                                : 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800'
                                                }`}
                                        >
                                            <User className="h-3.5 w-3.5" />
                                            {c.beneficiary_gender === 'male' ? (isRTL ? 'رجال' : 'Men') : (isRTL ? 'نساء' : 'Women')}
                                        </Badge>
                                    )}

                                    {/* Teaching Mode Badge */}
                                    {c.teaching_mode && (
                                        <Badge
                                            variant="outline"
                                            className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 flex items-center gap-1.5 px-2.5 py-1 font-medium"
                                        >
                                            {c.teaching_mode === 'online' ? <Globe className="h-3.5 w-3.5" /> :
                                                c.teaching_mode === 'offline' ? <MapPin className="h-3.5 w-3.5" /> :
                                                    <MonitorPlay className="h-3.5 w-3.5" />}
                                            {c.teaching_mode === 'online' ? (isRTL ? 'أونلاين' : 'Online') :
                                                c.teaching_mode === 'offline' ? (isRTL ? 'حضوري' : 'Offline') :
                                                    (isRTL ? 'كلاهما' : 'Mixed')}
                                        </Badge>
                                    )}

                                    {/* Inactive Badge */}
                                    {!c.is_active && (
                                        <Badge variant="secondary" className="text-xs px-2.5 py-1 font-medium">
                                            {isRTL ? 'متوقفة' : 'Inactive'}
                                        </Badge>
                                    )}
                                </div>

                                {/* Description */}
                                {c.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                        {c.description}
                                    </p>
                                )}
                            </CardHeader>

                            <CardContent className="pt-0">
                                {/* Organizers */}
                                {c.organizers && c.organizers.length > 0 && (
                                    <div className="flex items-center gap-2 pt-3 border-t">
                                        <div className="flex -space-x-2 rtl:space-x-reverse">
                                            {c.organizers.slice(0, 3).map((org, idx) => (
                                                <Avatar key={idx} className="h-7 w-7 border-2 border-background">
                                                    <AvatarFallback className="text-xs">
                                                        {org.name?.slice(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ))}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-muted-foreground truncate">
                                                {c.organizers.length === 1
                                                    ? c.organizers[0].name
                                                    : `${c.organizers.length} ${isRTL ? 'منظمين' : 'organizers'}`}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )
                }
            </div >

            {/* Delete Confirmation */}
            < AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? 'هل أنت متأكد من حذف هذه الحلقة؟ سيتم حذف جميع الجلسات المرتبطة بها.'
                                : 'Are you sure? All associated sessions will be deleted.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isRTL ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >

            {/* Circle Details Dialog */}
            < Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen} >
                <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedCircle && getCircleName(selectedCircle)}</DialogTitle>
                        <DialogDescription>
                            {selectedCircle && getScheduleDisplay(selectedCircle.schedule)} • {getScheduleTime(selectedCircle?.schedule || [])}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="sessions" className="w-full">
                        <TabsList className={`grid w-full ${canManageOrganizers ? 'grid-cols-4' : 'grid-cols-3'}`}>
                            <TabsTrigger value="sessions">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger>
                            <TabsTrigger value="sheet">{isRTL ? 'شيت الحضور' : 'Attendance Sheet'}</TabsTrigger>
                            <TabsTrigger value="beneficiaries">{isRTL ? 'المستفيدين' : 'Beneficiaries'}</TabsTrigger>
                            {canManageOrganizers && (
                                <TabsTrigger value="organizers">{isRTL ? 'المنظمين' : 'Organizers'}</TabsTrigger>
                            )}
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
                                <div className="flex gap-2">
                                    <Button onClick={() => selectedCircle && exportCircleToExcel(selectedCircle)} variant="outline" size="sm">
                                        <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                        {isRTL ? 'تصدير' : 'Export'}
                                    </Button>
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
                            </div>

                            {detailsBeneficiaries.length === 0 && (
                                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {isRTL
                                        ? 'لا يوجد مستفيدين مسجلين.'
                                        : 'No students enrolled.'}
                                </div>
                            )}

                            {/* Sessions List */}
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {sessions.map(session => {
                                    const rate = getAttendanceRate(session);
                                    const hasAttendance = session.attendees_count !== undefined && session.attendees_count > 0;
                                    return (
                                        <div
                                            key={session.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${hasAttendance
                                                ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10 hover:bg-green-50 dark:hover:bg-green-950/20'
                                                : 'hover:bg-muted/50'
                                                }`}
                                            onClick={() => {
                                                setSelectedSession(session);
                                                setAttendance(attendanceData[session.id] || []);
                                                setGuests([]);
                                                setSessionBeneficiarySearch('');
                                                setIsAttendanceDialogOpen(true);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${hasAttendance ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary/10'}`}>
                                                    <Calendar className={`h-4 w-4 ${hasAttendance ? 'text-green-600 dark:text-green-400' : 'text-primary'}`} />
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        {format(new Date(session.session_date), 'EEEE, d MMMM', { locale: isRTL ? ar : enUS })}
                                                    </p>
                                                    {session.notes && (
                                                        <p className="text-xs text-muted-foreground">{session.notes}</p>
                                                    )}
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

                        {/* Beneficiaries Tab */}
                        <TabsContent value="beneficiaries" className="space-y-4 py-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold">{isRTL ? 'المستفيدين' : 'Beneficiaries'}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {detailsBeneficiaries.length} {isRTL ? 'مستفيد' : 'beneficiaries'}
                                    </p>
                                </div>
                                <Button onClick={() => {
                                    if (isAddingBeneficiary) {
                                        setIsAddingBeneficiary(false);
                                        setEditingBeneficiary(null);
                                        setNewBeneficiary({
                                            name_ar: '',
                                            name_en: '',
                                            phone: '',
                                            gender: 'male',
                                            beneficiary_type: 'adult'
                                        });
                                    } else {
                                        // Auto-fill based on circle properties
                                        const autoGender = (selectedCircle?.beneficiary_gender === 'female' || selectedCircle?.teacher_gender === 'women') ? 'female' : 'male';
                                        const autoBeneficiaryType = (selectedCircle?.target_group === 'children' || selectedCircle?.target_group === 'child' || selectedCircle?.target_group === 'kids') ? 'child' : 'adult';

                                        setNewBeneficiary({
                                            name_ar: '',
                                            name_en: '',
                                            phone: '',
                                            gender: autoGender,
                                            beneficiary_type: autoBeneficiaryType
                                        });
                                        setIsAddingBeneficiary(true);
                                    }
                                }} size="sm">
                                    {isAddingBeneficiary ? (
                                        <>
                                            <X className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                            {isRTL ? 'إلغاء' : 'Cancel'}
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                            {isRTL ? 'إضافة جديد' : 'Add New'}
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Add/Edit Beneficiary Form */}
                            {isAddingBeneficiary && (
                                <div className="p-4 border rounded-lg bg-muted/30 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-sm">
                                            {editingBeneficiary
                                                ? (isRTL ? 'تعديل بيانات مستفيد' : 'Edit Beneficiary')
                                                : (isRTL ? 'إضافة مستفيد جديد' : 'Add New Beneficiary')}
                                        </h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
                                            <Input
                                                value={newBeneficiary.name_ar}
                                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name_ar: e.target.value })}
                                                placeholder={isRTL ? 'الاسم رباعي' : 'Full Name'}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{isRTL ? 'الاسم (إنجليزي - اختياري)' : 'Name (English - Optional)'}</Label>
                                            <Input
                                                value={newBeneficiary.name_en}
                                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name_en: e.target.value })}
                                                placeholder="Name in English"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
                                            <Input
                                                value={newBeneficiary.phone}
                                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, phone: e.target.value })}
                                                placeholder="01xxxxxxxxx"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{isRTL ? 'النوع' : 'Gender'}</Label>
                                            <Select
                                                value={newBeneficiary.gender}
                                                onValueChange={(val: 'male' | 'female') => setNewBeneficiary({ ...newBeneficiary, gender: val })}
                                                disabled={!editingBeneficiary}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="male">{isRTL ? 'ذكر' : 'Male'}</SelectItem>
                                                    <SelectItem value="female">{isRTL ? 'أنثى' : 'Female'}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {!editingBeneficiary && (
                                                <p className="text-xs text-muted-foreground">
                                                    {isRTL ? 'محدد تلقائياً بناءً على نوع الحلقة' : 'Auto-filled based on circle type'}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{isRTL ? 'نوع المستفيد' : 'Beneficiary Type'}</Label>
                                            <Select
                                                value={newBeneficiary.beneficiary_type}
                                                onValueChange={(val: 'adult' | 'child') => setNewBeneficiary({ ...newBeneficiary, beneficiary_type: val })}
                                                disabled={!editingBeneficiary}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="adult">{isRTL ? 'بالغ' : 'Adult'}</SelectItem>
                                                    <SelectItem value="child">{isRTL ? 'طفل' : 'Child'}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {!editingBeneficiary && (
                                                <p className="text-xs text-muted-foreground">
                                                    {isRTL ? 'محدد تلقائياً بناءً على الفئة المستهدفة' : 'Auto-filled based on target group'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button variant="outline" size="sm" onClick={() => {
                                            setIsAddingBeneficiary(false);
                                            setEditingBeneficiary(null);
                                            setNewBeneficiary({
                                                name_ar: '',
                                                name_en: '',
                                                phone: '',
                                                gender: 'male',
                                                beneficiary_type: 'adult'
                                            });
                                        }}>
                                            {isRTL ? 'إلغاء' : 'Cancel'}
                                        </Button>
                                        <Button size="sm" onClick={handleAddBeneficiary}>
                                            {editingBeneficiary
                                                ? (isRTL ? 'تحديث البيانات' : 'Update Beneficiary')
                                                : (isRTL ? 'حفظ وإضافة' : 'Save & Add')}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Search */}
                            <Input
                                placeholder={isRTL ? 'بحث عن مستفيد...' : 'Search beneficiaries...'}
                                value={sessionBeneficiarySearch}
                                onChange={(e) => setSessionBeneficiarySearch(e.target.value)}
                            />

                            {/* List */}
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {filteredDetailsBeneficiaries.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p>{isRTL ? 'لا يوجد نتائج' : 'No beneficiaries found'}</p>
                                    </div>
                                ) : (
                                    filteredDetailsBeneficiaries.map((b) => (
                                        <div
                                            key={b.id}
                                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={b.image_url || undefined} />
                                                    <AvatarFallback>{b.name_ar?.slice(0, 2)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{b.name_ar}</p>
                                                    {(b.phone || b.name_en) && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {b.phone} {b.phone && b.name_en && '•'} {b.name_en}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                    onClick={() => {
                                                        setEditingBeneficiary(b);
                                                        setNewBeneficiary({
                                                            name_ar: b.name_ar,
                                                            name_en: b.name_en || '',
                                                            phone: b.phone || '', // Need to add phone to view query first if missing
                                                            gender: b.gender || 'male',
                                                            beneficiary_type: b.beneficiary_type || 'adult'
                                                        });
                                                        setIsAddingBeneficiary(true);
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={async () => {
                                                        if (!confirm(isRTL ? 'هل أنت متأكد من إزالة هذا الطالب من الحلقة؟' : 'Are you sure you want to remove this student?')) return;
                                                        try {
                                                            const { error } = await supabase
                                                                .from('quran_enrollments')
                                                                .update({ status: 'inactive' })
                                                                .eq('circle_id', selectedCircle?.id)
                                                                .eq('beneficiary_id', b.id);

                                                            if (error) throw error;
                                                            toast.success(isRTL ? 'تم إلغاء التسجيل' : 'Unenrolled successfully');
                                                            if (selectedCircle) openCircleDetails(selectedCircle);
                                                            fetchCircles();
                                                        } catch (err: any) {
                                                            toast.error(err.message);
                                                        }
                                                    }}
                                                >
                                                    <UserMinus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
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
                                        {detailsBeneficiaries.map(beneficiary => {
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
                                                                        <select
                                                                            className="text-[10px] border rounded bg-transparent p-0.5 w-[50px] text-center"
                                                                            value={attendanceRecord?.attendance_type}
                                                                            onChange={(e) => updateSheetAttendanceType(session.id, beneficiary.id, e.target.value as any)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <option value="memorization">{isRTL ? 'حفظ' : 'Mem'}</option>
                                                                            <option value="revision">{isRTL ? 'مراجعة' : 'Rev'}</option>
                                                                        </select>
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
                                        {detailsBeneficiaries.length === 0 && (
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

                        {/* Organizers Tab */}
                        {canManageOrganizers && (
                            <TabsContent value="organizers" className="space-y-4 py-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-semibold">{isRTL ? 'المنظمين' : 'Organizers'}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedCircle?.organizers?.length || 0} {isRTL ? 'منظم' : 'organizer'}
                                        </p>
                                    </div>
                                    <Popover open={organizerPopoverOpen} onOpenChange={setOrganizerPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button size="sm">
                                                <UserPlus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'إضافة منظم' : 'Add Organizer'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" align={isRTL ? "end" : "start"}>
                                            <Command>
                                                <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
                                                <CommandList>
                                                    <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results found.'}</CommandEmpty>
                                                    <CommandGroup>
                                                        {volunteers.map(volunteer => (
                                                            <CommandItem
                                                                key={volunteer.id}
                                                                onSelect={() => {
                                                                    handleAddOrganizerToCircle({
                                                                        volunteer_id: volunteer.id,
                                                                        name: isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name,
                                                                        phone: volunteer.phone || ''
                                                                    });
                                                                    setOrganizerPopoverOpen(false);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-6 w-6">
                                                                        <AvatarImage src={volunteer.avatar_url || undefined} />
                                                                        <AvatarFallback>{volunteer.full_name.charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex flex-col">
                                                                        <span>{isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name}</span>
                                                                        {volunteer.phone && <span className="text-xs text-muted-foreground">{volunteer.phone}</span>}
                                                                    </div>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    {selectedCircle?.organizers?.map((organizer, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-primary/10 text-primary">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{organizer.name}</p>
                                                    {organizer.phone && <p className="text-sm text-muted-foreground">{organizer.phone}</p>}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() => handleRemoveOrganizerFromCircle(organizer)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {(!selectedCircle?.organizers || selectedCircle.organizers.length === 0) && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                            <p>{isRTL ? 'لا يوجد منظمين لهذه الحلقة' : 'No organizers for this circle'}</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        )}
                    </Tabs>
                </DialogContent>
            </Dialog >

            {/* New Session Dialog */}
            < Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen} >
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
            </Dialog >

            {/* Attendance Dialog - Reused Logic */}
            < Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen} >
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {isRTL ? 'تسجيل الحضور' : 'Record Attendance'}
                            {selectedSession && (
                                <Badge variant="outline" className="ml-2">
                                    {format(new Date(selectedSession.session_date), 'd MMM', { locale: isRTL ? ar : enUS })}
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
                            value={sessionBeneficiarySearch}
                            onChange={e => setSessionBeneficiarySearch(e.target.value)}
                        />

                        {/* Beneficiaries List */}
                        <ScrollArea className="h-[300px] border rounded-md p-2">
                            <div className="space-y-1">
                                {filteredDetailsBeneficiaries.map(b => {
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
                                    <span className="text-muted-foreground text-sm">/ {detailsBeneficiaries.length}</span>
                                </div>
                            </div>
                            {detailsBeneficiaries.length > 0 && (
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${(attendance.length / detailsBeneficiaries.length) * 100}%` }}
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
            </Dialog >

            {/* Session Delete Confirmation */}
            < AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
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
            </AlertDialog >

            {/* Enrollment Management Dialog */}
            < Dialog open={isEnrollmentOpen} onOpenChange={setIsEnrollmentOpen} >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" />
                            {isRTL ? 'إدارة المسجلين في الحلقة' : 'Manage Circle Enrollments'}
                        </DialogTitle>
                        {enrollmentCircle && (
                            <p className="text-sm text-muted-foreground">
                                {getCircleName(enrollmentCircle)}
                            </p>
                        )}
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Enrolled count */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>{isRTL ? 'عدد المسجلين:' : 'Enrolled Students:'}</span>
                            <Badge className="text-lg px-3">{enrolledBeneficiaries.length}</Badge>
                        </div>

                        {/* Search */}
                        <Input
                            placeholder={isRTL ? 'بحث عن مستفيد...' : 'Search beneficiaries...'}
                            value={beneficiarySearch}
                            onChange={e => setBeneficiarySearch(e.target.value)}
                        />

                        {/* Beneficiaries List */}
                        <ScrollArea className="h-[400px] border rounded-md p-2">
                            {enrollmentLoading ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredBeneficiariesForEnrollment.map(b => {
                                        const isEnrolled = enrolledBeneficiaries.some(e => e.id === b.id);

                                        return (
                                            <div
                                                key={b.id}
                                                className={`flex items-center justify-between p-2 rounded-md ${isEnrolled
                                                    ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                                                    : 'hover:bg-muted'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={b.image_url || undefined} />
                                                        <AvatarFallback>{b.name_ar?.slice(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{b.name_ar}</span>
                                                </div>
                                                {isEnrolled ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleUnenroll(b.id)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                                                        {isRTL ? 'إلغاء' : 'Remove'}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEnroll(b.id)}
                                                        className="text-primary"
                                                    >
                                                        <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                                                        {isRTL ? 'تسجيل' : 'Enroll'}
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <div className="flex justify-end border-t pt-4">
                        <Button variant="outline" onClick={() => setIsEnrollmentOpen(false)}>
                            {isRTL ? 'إغلاق' : 'Close'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >
        </div >
    );
}
