import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
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
import type { Database, Json } from '@/integrations/supabase/types';
import { appendAoaSheet, ensureXlsxFilename, loadXlsx } from '@/utils/xlsx';

type QuranTeacherRow = Database['public']['Tables']['quran_teachers']['Row'];
type QuranTeacherInsert = Database['public']['Tables']['quran_teachers']['Insert'];
type QuranTeacherUpdate = Database['public']['Tables']['quran_teachers']['Update'];
type QuranCircleRow = Pick<Database['public']['Tables']['quran_circles']['Row'], 'id' | 'teacher_id' | 'is_active' | 'schedule'>;
type QuranEnrollmentRow = Pick<Database['public']['Tables']['quran_enrollments']['Row'], 'circle_id'>;
type ProfileRow = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'full_name_ar' | 'email'>;

type LinkedUser = Pick<ProfileRow, 'full_name' | 'full_name_ar' | 'email'>;
type QuranTeacherRecord = Pick<
    QuranTeacherRow,
    'id' | 'name' | 'phone' | 'user_id' | 'branch_id' | 'created_at' | 'teaching_mode' | 'target_gender' | 'specialization'
> & {
    profiles?: LinkedUser | null;
};

type CircleStats = {
    activeCirclesByTeacher: Map<string, number>;
    activeStudentsByTeacher: Map<string, number>;
};

type ScheduleEntry = {
    day: number;
    time: string;
};

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : 'Error occurred'
);

const isScheduleEntry = (value: Json): value is ScheduleEntry => {
    if (!value || Array.isArray(value) || typeof value !== 'object') return false;
    const entry = value as Record<string, Json | undefined>;
    return typeof entry.day === 'number' && typeof entry.time === 'string';
};

interface QuranTeacher {
    id: string;
    name: string;
    phone: string;
    user_id?: string | null;
    branch_id?: string | null;
    linked_user?: {
        full_name: string;
        full_name_ar: string;
        email: string;
    };
    created_at: string;
    teaching_mode: string | null;
    target_gender: string | null;
    specialization: string | null;
    active_circles_count?: number;
    total_students_count?: number;
}

type Profile = ProfileRow;

export default function QuranTeachers() {
    const { isRTL } = useLanguage();
    const { branches, canViewAllBranches, activeBranch } = useBranch();
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
        branch_id: '',
    });

    const loadTeacherStats = useCallback(async (teacherIds: string[]): Promise<CircleStats> => {
        const emptyStats = {
            activeCirclesByTeacher: new Map<string, number>(),
            activeStudentsByTeacher: new Map<string, number>(),
        };

        if (teacherIds.length === 0) return emptyStats;

        const { data: circles, error: circlesError } = await supabase
            .from('quran_circles')
            .select('id, teacher_id, is_active')
            .in('teacher_id', teacherIds);

        if (circlesError) throw circlesError;

        const circleRows = (circles ?? []) as QuranCircleRow[];
        const activeCirclesByTeacher = new Map<string, number>();
        const teacherByCircle = new Map<string, string>();

        circleRows.forEach((circle) => {
            if (!circle.teacher_id) return;
            teacherByCircle.set(circle.id, circle.teacher_id);
            if (circle.is_active) {
                activeCirclesByTeacher.set(
                    circle.teacher_id,
                    (activeCirclesByTeacher.get(circle.teacher_id) ?? 0) + 1
                );
            }
        });

        const circleIds = circleRows.map((circle) => circle.id);
        if (circleIds.length === 0) {
            return {
                activeCirclesByTeacher,
                activeStudentsByTeacher: emptyStats.activeStudentsByTeacher,
            };
        }

        const { data: enrollments, error: enrollmentsError } = await supabase
            .from('quran_enrollments')
            .select('circle_id')
            .in('circle_id', circleIds)
            .eq('status', 'active');

        if (enrollmentsError) throw enrollmentsError;

        const activeStudentsByTeacher = new Map<string, number>();
        ((enrollments ?? []) as QuranEnrollmentRow[]).forEach((enrollment) => {
            const teacherId = teacherByCircle.get(enrollment.circle_id);
            if (!teacherId) return;
            activeStudentsByTeacher.set(
                teacherId,
                (activeStudentsByTeacher.get(teacherId) ?? 0) + 1
            );
        });

        return { activeCirclesByTeacher, activeStudentsByTeacher };
    }, []);

    const fetchProfiles = useCallback(async () => {
        try {
            let query = supabase
                .from('profiles')
                .select('id, full_name, full_name_ar, email');

            if (activeBranch?.id) {
                query = query.eq('branch_id', activeBranch.id);
            }

            const { data, error } = await query.order('full_name');
            if (error) throw error;
            setProfiles((data ?? []) as Profile[]);
        } catch (error) {
            console.error('Error fetching profiles:', error);
            toast.error(isRTL ? 'فشل تحميل حسابات المتطوعين' : 'Failed to load volunteer accounts');
        }
    }, [activeBranch?.id, isRTL]);

    const fetchTeachers = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('quran_teachers')
                .select('id, name, phone, user_id, branch_id, created_at, teaching_mode, target_gender, specialization, profiles!quran_teachers_user_id_fkey(full_name, full_name_ar, email)');

            if (activeBranch?.id) {
                query = query.eq('branch_id', activeBranch.id);
            }

            const { data, error } = await query.order('name');

            if (error) throw error;

            const rows = (data ?? []) as QuranTeacherRecord[];
            const stats = await loadTeacherStats(rows.map((teacher) => teacher.id));
            const teachersWithStats = rows.map((teacher): QuranTeacher => {
                return {
                    ...teacher,
                    linked_user: teacher.profiles ?? undefined,
                    active_circles_count: stats.activeCirclesByTeacher.get(teacher.id) ?? 0,
                    total_students_count: stats.activeStudentsByTeacher.get(teacher.id) ?? 0
                };
            });

            setTeachers(teachersWithStats);
        } catch (error) {
            console.error('Error fetching teachers:', error);
            toast.error(isRTL ? 'فشل تحميل المحفظين' : 'Failed to fetch teachers');
        } finally {
            setLoading(false);
        }
    }, [activeBranch?.id, isRTL, loadTeacherStats]);

    useEffect(() => {
        fetchTeachers();
        fetchProfiles();
    }, [fetchTeachers, fetchProfiles]);

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.phone.trim()) {
            toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
            return;
        }

        try {
            const commonData: QuranTeacherInsert & QuranTeacherUpdate = {
                name: formData.name.trim(),
                phone: formData.phone.trim(),
                user_id: formData.volunteer_id === 'none' ? null : formData.volunteer_id,
                teaching_mode: formData.teaching_mode,
                target_gender: formData.target_gender,
                specialization: formData.specialization,
                branch_id: formData.branch_id && formData.branch_id !== 'none' ? formData.branch_id : (activeBranch?.id || null)
            };

            if (isEditMode && selectedId) {
                const { data, error } = await supabase
                    .from('quran_teachers')
                    .update(commonData)
                    .eq('id', selectedId)
                    .select('id')
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Teacher was not updated');
                toast.success(isRTL ? 'تم التحديث بنجاح' : 'Updated successfully');
            } else {
                const { data, error } = await supabase
                    .from('quran_teachers')
                    .insert(commonData)
                    .select('id')
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Teacher was not created');
                toast.success(isRTL ? 'تم الإضافة بنجاح' : 'Added successfully');
            }

            setIsCreateOpen(false);
            resetForm();
            fetchTeachers();
        } catch (error) {
            console.error('Error saving:', error);
            toast.error(getErrorMessage(error));
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteId) return;

        try {
            const { data, error } = await supabase
                .from('quran_teachers')
                .delete()
                .eq('id', deleteId)
                .select('id');

            if (error) throw error;
            if (!data?.length) throw new Error('Teacher was not deleted');
            toast.success(isRTL ? 'تم الحذف' : 'Deleted');
            fetchTeachers();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error(isRTL ? 'فشل الحذف' : 'Failed to delete');
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
            branch_id: activeBranch?.id || '',
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
            branch_id: t.branch_id || '',
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
            const { utils, writeFile } = await loadXlsx();

            // Fetch circles for this teacher
            const { data: circles, error } = await supabase
                .from('quran_circles')
                .select('schedule, is_active')
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

            appendAoaSheet(utils, wb, teacherInfoData, isRTL ? 'بيانات المحفظ' : 'Teacher Info', (ws) => {
                ws['!cols'] = [
                    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
                ];
            });

            // --- Sheet 2: Circles List ---
            const circlesHeader = [
                isRTL ? 'اسم الحلقة' : 'Circle Name',
                isRTL ? 'الموعد' : 'Schedule',
                isRTL ? 'الحالة' : 'Status'
            ];

            // Helper for schedule string
            const getScheduleStr = (schedule: Json | null) => {
                if (!schedule || !Array.isArray(schedule)) return '-';
                const days = isRTL
                    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
                    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return schedule.filter(isScheduleEntry).map((s) => {
                    const dayIdx = s.day % 7; // Ensure valid index
                    return `${days[dayIdx]} ${s.time}`;
                }).join(', ');
            };

            const circlesData = (circles || []).map(c => [
                isRTL ? `حلقة المحفظ ${teacher.name}` : `${teacher.name}'s Circle` /* Usually auto-named */,
                getScheduleStr(c.schedule),
                c.is_active ? (isRTL ? 'نشطة' : 'Active') : (isRTL ? 'متوقفة' : 'Inactive')
            ]);

            appendAoaSheet(utils, wb, [circlesHeader, ...circlesData], isRTL ? 'الحلقات' : 'Circles', (ws) => {
                ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 10 }];
            });

            // --- Export ---
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = teacher.name.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_'); // Allow Arabic chars
            const fileName = `Quran_Teacher_${safeName}_${dateStr}.xlsx`;

            writeFile(wb, ensureXlsxFilename(fileName));
            toast.success(isRTL ? 'تم تصدير التقرير بنجاح' : 'Report exported successfully');

        } catch (error) {
            console.error('Export failed:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء التصدير' : 'Export failed');
        }
    };

    const handleExportAllTeachers = async () => {
        try {
            const { utils, writeFile } = await loadXlsx();

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
            appendAoaSheet(utils, wb, allTeachersData, isRTL ? 'كل المحفظين' : 'All Teachers', (ws) => {
                ws['!cols'] = [
                    { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }
                ];
            });

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `All_Quran_Teachers_${dateStr}.xlsx`;

            writeFile(wb, ensureXlsxFilename(fileName));
            toast.success(isRTL ? 'تم الددير بنجاح' : 'Export successful');

        } catch (error) {
            console.error('Export all failed:', error);
            toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
        }
    };


    const filteredTeachers = useMemo(() => teachers.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone?.includes(searchQuery)
    ), [teachers, searchQuery]);

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
                                    <Label>{isRTL ? 'الفرع' : 'Branch'}</Label>
                                    <Select
                                        value={formData.branch_id || 'none'}
                                        disabled={!canViewAllBranches}
                                        onValueChange={(val) => setFormData({ ...formData, branch_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={isRTL ? 'اختر الفرع...' : 'Select branch...'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">{isRTL ? '-- بدون فرع --' : '-- No Branch --'}</SelectItem>
                                            {branches.map(b => (
                                                <SelectItem key={b.id} value={b.id}>
                                                    {isRTL ? b.name_ar : b.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                            {canViewAllBranches && (
                                                <span className="bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 px-1.5 py-0.5 rounded text-xs border border-orange-200 dark:border-orange-900">
                                                    {branches.find(b => b.id === t.branch_id)?.[isRTL ? 'name_ar' : 'name'] || (isRTL ? 'بدون فرع' : 'No Branch')}
                                                </span>
                                            )}
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
