import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
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
    DialogTrigger
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
import {
    Plus, Search, MoreVertical, Pencil, Trash2, Users, Calendar,
    Clock, User, CalendarDays, X, Check, UserPlus
} from 'lucide-react';
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

interface Teacher {
    id: string;
    name: string;
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
    schedule: ScheduleItem[];
    is_active: boolean;
    organizers?: Organizer[];
    enrolled_count?: number;
}

interface Beneficiary {
    id: string;
    name_ar: string;
    name_en: string | null;
    image_url: string | null;
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

export default function QuranCircles() {
    const { isRTL, language } = useLanguage();
    const [circles, setCircles] = useState<QuranCircle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [organizerPopoverOpen, setOrganizerPopoverOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        teacher_id: '',
        schedule_days: [] as number[],
        schedule_time: '18:00',
        is_active: true
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
                    teacher: trainers!quran_circles_teacher_id_fkey(name_ar),
                    quran_circle_organizers(volunteer_id, name, phone)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedData = data?.map((circle: any) => ({
                id: circle.id,
                teacher_id: circle.teacher_id,
                teacher_name: circle.teacher?.name_ar,
                schedule: circle.schedule || [],
                is_active: circle.is_active ?? true,
                organizers: circle.quran_circle_organizers || []
            })) || [];

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
            const { data, error } = await supabase
                .from('trainers')
                .select('id, name_ar')
                .eq('type', 'quran_teacher')
                .order('name_ar');

            if (error) throw error;

            // Map to existing interface
            const teachers = data?.map((t: any) => ({
                id: t.id,
                name: t.name_ar
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
            return `${day?.label[language as 'en' | 'ar'] || ''} ${s.time}`;
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

    const toggleDay = (day: number) => {
        if (formData.schedule_days.includes(day)) {
            setFormData({ ...formData, schedule_days: formData.schedule_days.filter(d => d !== day) });
        } else {
            setFormData({ ...formData, schedule_days: [...formData.schedule_days, day] });
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

            const dataToSave = {
                teacher_id: formData.teacher_id,
                schedule: schedule,
                is_active: formData.is_active,
                name: 'auto', // Legacy
                date: new Date().toISOString().split('T')[0] // Legacy
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
            is_active: circle.is_active
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

        setSelectedId(circle.id);
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const resetForm = () => {
        setFormData({
            teacher_id: '',
            schedule_days: [],
            schedule_time: '18:00',
            is_active: true
        });
        setOrganizers([]);
        setIsEditMode(false);
        setSelectedId(null);
    };

    // Enrollment functions
    const fetchAllBeneficiaries = async () => {
        try {
            const { data, error } = await supabase
                .from('quran_beneficiaries')
                .select('id, name_ar, name_en, image_url')
                .order('name_ar');
            if (error) throw error;
            setAllBeneficiaries(data || []);
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
                    quran_beneficiaries!inner(id, name_ar, name_en, image_url)
                `)
                .eq('circle_id', circleId)
                .eq('status', 'active');

            if (error) throw error;

            const beneficiaries = data?.map((e: any) => ({
                id: e.quran_beneficiaries.id,
                name_ar: e.quran_beneficiaries.name_ar,
                name_en: e.quran_beneficiaries.name_en,
                image_url: e.quran_beneficiaries.image_url
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
        } catch (error: any) {
            console.error('Error unenrolling:', error);
            toast.error(error.message || 'Error unenrolling');
        }
    };

    const filteredBeneficiariesForEnrollment = allBeneficiaries.filter(b =>
        b.name_ar.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
        (b.name_en?.toLowerCase() || '').includes(beneficiarySearch.toLowerCase())
    );

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
                    <div className="col-span-full text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>{isRTL ? 'لا توجد حلقات' : 'No circles found'}</p>
                    </div>
                ) : (
                    filteredCircles.map((c) => (
                        <Card
                            key={c.id}
                            className={`group relative overflow-hidden transition-all hover:shadow-md ${c.is_active ? 'hover:border-primary/50' : 'opacity-60'
                                }`}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg leading-tight">
                                                {getCircleName(c)}
                                            </CardTitle>
                                            {!c.is_active && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {isRTL ? 'متوقفة' : 'Inactive'}
                                                </Badge>
                                            )}
                                        </div>
                                        <CardDescription className="flex items-center gap-2">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            <span>{getScheduleDisplay(c.schedule)}</span>
                                        </CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEnrollmentDialog(c)}>
                                                <UserPlus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'إدارة المسجلين' : 'Manage Students'}
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
                            </CardHeader>
                            <CardContent>
                                {/* Organizers */}
                                {c.organizers && c.organizers.length > 0 && (
                                    <div className="flex items-center gap-2 pt-2 border-t">
                                        <div className="flex -space-x-2">
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
                            <div className={`absolute inset-x-0 bottom-0 h-1 ${c.is_active ? 'bg-primary' : 'bg-muted'}`} />
                        </Card>
                    ))
                )}
            </div>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
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
            </AlertDialog>

            {/* Enrollment Management Dialog */}
            <Dialog open={isEnrollmentOpen} onOpenChange={setIsEnrollmentOpen}>
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
            </Dialog>
        </div>
    );
}
