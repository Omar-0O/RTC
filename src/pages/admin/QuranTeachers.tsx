import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Plus, Search, MoreHorizontal, Pencil, Trash2, Users, Link as LinkIcon,
    AlertCircle, FileSpreadsheet, Building2, User
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { utils, writeFile } from 'xlsx';

interface QuranTeacher {
    id: string;
    name: string;
    phone: string;
    user_id?: string;
    linked_user?: {
        full_name: string;
        full_name_ar: string;
        email: string;
    };
    created_at: string;
    teaching_mode: string;
    target_gender: string;
    specialization: string;
    // Stats
    active_circles_count?: number;
    total_students_count?: number;
}

interface Profile {
    id: string;
    full_name: string;
    full_name_ar: string;
    email: string;
}

export default function QuranTeachers() {
    const { isRTL } = useLanguage();
    const [teachers, setTeachers] = useState<QuranTeacher[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        volunteer_id: 'none',
        teaching_mode: 'both',
        target_gender: 'men',
        specialization: '',
    });

    useEffect(() => {
        fetchTeachers();
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, full_name_ar, email')
                .order('full_name');
            setProfiles(data || []);
        } catch (error) {
            console.error('Error fetching profiles:', error);
        }
    };

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('quran_teachers')
                .select('*, profiles!quran_teachers_user_id_fkey(full_name, full_name_ar, email)')
                .order('name');

            if (error) throw error;

            console.log('Teachers fetched successfully', data?.length);

            // Fetch stats for each teacher
            const teachersWithStats = await Promise.all((data || []).map(async (t: any) => {
                // Map profiles to linked_user
                const linked_user = t.profiles || null;

                // Active Circles
                const { count: circlesCount } = await supabase
                    .from('quran_circles')
                    .select('id', { count: 'exact', head: true })
                    .eq('teacher_id', t.id)
                    .eq('is_active', true);

                // Total Students (Enrollments)
                // We need to find all circles for this teacher, then count enrollments in those circles
                const { data: circles } = await supabase
                    .from('quran_circles')
                    .select('id')
                    .eq('teacher_id', t.id);

                let studentsCount = 0;
                if (circles && circles.length > 0) {
                    const circleIds = circles.map(c => c.id);
                    const { count } = await supabase
                        .from('quran_enrollments')
                        .select('id', { count: 'exact', head: true })
                        .in('circle_id', circleIds)
                        .eq('status', 'active');
                    studentsCount = count || 0;
                }

                return {
                    ...t,
                    linked_user, // Manual mapping
                    active_circles_count: circlesCount || 0,
                    total_students_count: studentsCount
                };
            }));

            setTeachers(teachersWithStats);
        } catch (error) {
            console.error('Error fetching teachers:', error);
            toast.error(isRTL ? 'فشل تحميل المحفظين' : 'Failed to fetch teachers');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.phone) {
            toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
            return;
        }

        try {
            const commonData = {
                name: formData.name,
                phone: formData.phone,
                user_id: formData.volunteer_id === 'none' ? null : formData.volunteer_id,
                teaching_mode: formData.teaching_mode,
                target_gender: formData.target_gender,
                specialization: formData.specialization
            };

            if (isEditMode && selectedId) {
                const { error } = await supabase
                    .from('quran_teachers')
                    .update(commonData)
                    .eq('id', selectedId);

                if (error) throw error;
                toast.success(isRTL ? 'تم التحديث بنجاح' : 'Updated successfully');
            } else {
                const { error } = await supabase
                    .from('quran_teachers')
                    .insert(commonData);

                if (error) throw error;
                toast.success(isRTL ? 'تم الإضافة بنجاح' : 'Added successfully');
            }

            setIsCreateOpen(false);
            resetForm();
            fetchTeachers();
        } catch (error: any) {
            console.error('Error saving:', error);
            toast.error(error.message || 'Error occurred');
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteId) return;

        try {
            const { error } = await supabase
                .from('quran_teachers')
                .delete()
                .eq('id', deleteId);

            if (error) throw error;
            toast.success(isRTL ? 'تم الحذف' : 'Deleted');
            fetchTeachers();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete');
        } finally {
            setDeleteId(null);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            phone: '',
            volunteer_id: 'none',
            teaching_mode: 'both',
            target_gender: 'men',
            specialization: '',
        });
        setIsEditMode(false);
        setSelectedId(null);
    };

    const handleEdit = (t: QuranTeacher) => {
        setFormData({
            name: t.name,
            phone: t.phone,
            volunteer_id: t.user_id || 'none',
            teaching_mode: t.teaching_mode || 'both',
            target_gender: t.target_gender || 'men',
            specialization: t.specialization || '',
        });
        setSelectedId(t.id);
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const getTeacherInitials = (teacher: QuranTeacher) => {
        return teacher.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleExportTeacher = async (teacher: QuranTeacher) => {
        try {
            toast.info(isRTL ? 'جاري تحضير التقرير...' : 'Preparing report...');

            // Fetch circles for this teacher
            const { data: circles, error } = await supabase
                .from('quran_circles')
                .select('*')
                .eq('teacher_id', teacher.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const wb = utils.book_new();

            // --- Sheet 1: Teacher Info ---
            const teacherInfoData = [
                // Headers
                [
                    isRTL ? 'الاسم' : 'Name',
                    isRTL ? 'رقم الهاتف' : 'Phone',
                    isRTL ? 'النوع' : 'Teaching Mode',
                    isRTL ? 'الفئة المستهدفة' : 'Target Group',
                    isRTL ? 'الحلقات النشطة' : 'Active Circles',
                    isRTL ? 'إجمالي الطلاب' : 'Total Students',
                    isRTL ? 'تاريخ الانضمام' : 'Join Date'
                ],
                // Data
                [
                    teacher.name,
                    teacher.phone,
                    teacher.teaching_mode,
                    teacher.target_gender,
                    teacher.active_circles_count || 0,
                    teacher.total_students_count || 0,
                    new Date(teacher.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')
                ]
            ];

            const wsInfo = utils.aoa_to_sheet(teacherInfoData);

            // Set widths
            wsInfo['!cols'] = [
                { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
            ];

            utils.book_append_sheet(wb, wsInfo, isRTL ? 'بيانات المحفظ' : 'Teacher Info');

            // --- Sheet 2: Circles List ---
            const circlesHeader = [
                isRTL ? 'اسم الحلقة' : 'Circle Name',
                isRTL ? 'الموعد' : 'Schedule',
                isRTL ? 'الحالة' : 'Status'
            ];

            // Helper for schedule string
            const getScheduleStr = (schedule: any) => {
                if (!schedule || !Array.isArray(schedule)) return '-';
                const days = isRTL
                    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
                    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return schedule.map((s: any) => {
                    const dayIdx = s.day % 7; // Ensure valid index
                    return `${days[dayIdx]} ${s.time}`;
                }).join(', ');
            };

            const circlesData = (circles || []).map(c => [
                isRTL ? `حلقة المحفظ ${teacher.name}` : `${teacher.name}'s Circle` /* Usually auto-named */,
                getScheduleStr(c.schedule),
                c.is_active ? (isRTL ? 'نشطة' : 'Active') : (isRTL ? 'متوقفة' : 'Inactive')
            ]);

            const wsCircles = utils.aoa_to_sheet([circlesHeader, ...circlesData]);
            wsCircles['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 10 }];

            utils.book_append_sheet(wb, wsCircles, isRTL ? 'الحلقات' : 'Circles');

            // --- Export ---
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = teacher.name.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_'); // Allow Arabic chars
            const fileName = `Quran_Teacher_${safeName}_${dateStr}.xlsx`;

            writeFile(wb, fileName);
            toast.success(isRTL ? 'تم تصدير التقرير بنجاح' : 'Report exported successfully');

        } catch (error) {
            console.error('Export failed:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء التصدير' : 'Export failed');
        }
    };

    const handleExportAllTeachers = () => {
        try {
            const allTeachersData = [
                // Headers
                [
                    isRTL ? 'الاسم' : 'Name',
                    isRTL ? 'رقم الهاتف' : 'Phone',
                    isRTL ? 'النوع' : 'Mode',
                    isRTL ? 'الفئة' : 'Gender',
                    isRTL ? 'التخصص' : 'Specialization',
                    isRTL ? 'الحلقات النشطة' : 'Active Circles',
                    isRTL ? 'إجمالي الطلاب' : 'Students',
                    isRTL ? 'الارتباط بحساب' : 'Linked Account'
                ],
                // Data
                ...teachers.map(t => [
                    t.name,
                    t.phone || '-',
                    t.teaching_mode,
                    t.target_gender,
                    t.specialization || '-',
                    t.active_circles_count || 0,
                    t.total_students_count || 0,
                    t.linked_user ? t.linked_user.full_name : (isRTL ? 'غير مربوط' : 'Unlinked')
                ])
            ];

            const wb = utils.book_new();
            const ws = utils.aoa_to_sheet(allTeachersData);

            ws['!cols'] = [
                { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }
            ];

            utils.book_append_sheet(wb, ws, isRTL ? 'كل المحفظين' : 'All Teachers');

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `All_Quran_Teachers_${dateStr}.xlsx`;

            writeFile(wb, fileName);
            toast.success(isRTL ? 'تم الددير بنجاح' : 'Export successful');

        } catch (error) {
            console.error('Export all failed:', error);
            toast.error('Export failed');
        }
    };


    const filteredTeachers = teachers.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone?.includes(searchQuery)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <Users className="h-8 w-8 text-primary" />
                        {isRTL ? 'إدارة المحفظين' : 'Quran Teachers'}
                    </h1>
                </div>

                <div className="flex gap-2">
                    <Button onClick={handleExportAllTeachers} variant="outline" className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        {isRTL ? 'تصدير الكل' : 'Export All'}
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={(open) => {
                        setIsCreateOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" />
                                {isRTL ? 'إضافة محفظ' : 'Add Teacher'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{isEditMode ? (isRTL ? 'تعديل محفظ' : 'Edit Teacher') : (isRTL ? 'إضافة محفظ جديد' : 'Add New Teacher')}</DialogTitle>
                                <DialogDescription>
                                    {isRTL ? 'أدخل تفاصيل المحفظ في الأسفل.' : 'Enter teacher details below.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>{isRTL ? 'الاسم' : 'Name'} <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{isRTL ? 'رقم الهاتف' : 'Phone'} <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'نوع التحفيظ' : 'Teaching Mode'}</Label>
                                        <Select
                                            value={formData.teaching_mode}
                                            onValueChange={(val) => setFormData({ ...formData, teaching_mode: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="online">{isRTL ? 'أونلاين' : 'Online'}</SelectItem>
                                                <SelectItem value="offline">{isRTL ? 'أوفلاين' : 'Offline'}</SelectItem>
                                                <SelectItem value="both">{isRTL ? 'كلاهما' : 'Both'}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'الفئة المستهدفة' : 'Target Group'}</Label>
                                        <Select
                                            value={formData.target_gender}
                                            onValueChange={(val) => setFormData({ ...formData, target_gender: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="men">{isRTL ? 'رجال' : 'Men'}</SelectItem>
                                                <SelectItem value="women">{isRTL ? 'نساء' : 'Women'}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>{isRTL ? 'التخصص (اختياري)' : 'Specialization (Optional)'}</Label>
                                    <Input
                                        placeholder={isRTL ? 'مثال: تجويد، حفظ...' : 'e.g. Tajweed, Memorization...'}
                                        value={formData.specialization}
                                        onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>{isRTL ? 'ربط بحساب متطوع (اختياري)' : 'Link to Volunteer Account (Optional)'}</Label>
                                    <Select
                                        value={formData.volunteer_id}
                                        onValueChange={(val) => setFormData({ ...formData, volunteer_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={isRTL ? 'اختر متطوع...' : 'Select volunteer...'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">{isRTL ? 'بدون ربط' : 'No Link'}</SelectItem>
                                            {profiles.map(profile => (
                                                <SelectItem key={profile.id} value={profile.id}>
                                                    {isRTL ? profile.full_name_ar || profile.full_name : profile.full_name || profile.full_name_ar}
                                                    {profile.email && ` (${profile.email})`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {isRTL
                                            ? 'ربط المحفظ بحساب متطوع يسمح بتسجيل المشاركات له تلقائياً.'
                                            : 'Linking to a volunteer account allows automatic participation logging.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                                <Button onClick={handleSave}>{isRTL ? 'حفظ' : 'Save'}</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{isRTL ? 'هل أنت متأكد؟' : 'Are you sure?'}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {isRTL
                                    ? 'هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المحفظ نهائياً.'
                                    : 'This action cannot be undone. This will permanently delete the teacher.'}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                                {isRTL ? 'حذف' : 'Delete'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <div className="flex items-center gap-2 max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={isRTL ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Teacher Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-full bg-muted" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 bg-muted rounded w-3/4" />
                                        <div className="h-3 bg-muted rounded w-1/2" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredTeachers.length === 0 ? (
                <Card className="p-8 text-center">
                    <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                        {searchQuery
                            ? (isRTL ? 'لا توجد نتائج' : 'No results found')
                            : (isRTL ? 'لا يوجد محفظين' : 'No teachers registered')}
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTeachers.map(t => (
                        <Card key={t.id} className="group hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <Avatar className="h-16 w-16 border-4 border-muted">
                                        <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                                            {getTeacherInitials(t)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg leading-tight truncate">
                                                {t.name}
                                            </h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{t.phone}</p>

                                        <div className="flex flex-wrap gap-1 mt-2">
                                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs border border-primary/20">
                                                {t.teaching_mode === 'online' ? (isRTL ? 'أونلاين' : 'Online') :
                                                    t.teaching_mode === 'offline' ? (isRTL ? 'أوفلاين' : 'Offline') :
                                                        (isRTL ? 'كلاهما' : 'Both')}
                                            </span>
                                            <span className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs border border-secondary/20">
                                                {t.target_gender === 'men' ? (isRTL ? 'رجال' : 'Men') : (isRTL ? 'نساء' : 'Women')}
                                            </span>
                                        </div>

                                        {t.specialization && (
                                            <p className="text-xs text-muted-foreground mt-2 italic">
                                                {t.specialization}
                                            </p>
                                        )}

                                        {t.linked_user && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                                <LinkIcon className="h-3 w-3" />
                                                <span>{isRTL ? t.linked_user.full_name_ar : t.linked_user.full_name}</span>
                                            </div>
                                        )}
                                    </div>

                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleExportTeacher(t)}>
                                                <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'تصدير تقرير' : 'Export Report'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEdit(t)}>
                                                <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'تعديل' : 'Edit'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(t.id)}>
                                                <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'حذف' : 'Delete'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t text-center">
                                    <div>
                                        <p className="text-2xl font-bold">{t.active_circles_count || 0}</p>
                                        <p className="text-xs text-muted-foreground">{isRTL ? 'حلقات نشطة' : 'Active Circles'}</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{t.total_students_count || 0}</p>
                                        <p className="text-xs text-muted-foreground">{isRTL ? 'طالب' : 'Students'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div >
    );
}
