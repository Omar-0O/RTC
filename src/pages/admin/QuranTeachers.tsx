import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
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
import { Plus, Search, MoreVertical, Pencil, Trash2, Users, Link as LinkIcon, AlertCircle } from 'lucide-react';

interface QuranTeacher {
    id: string;
    name_ar: string;
    name_en: string;
    phone: string;
    user_id?: string;
    linked_user?: {
        full_name: string;
        full_name_ar: string;
    };
    created_at: string;
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

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        volunteer_id: 'none',
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
                .from('trainers')
                .select('*, linked_user:profiles(full_name, full_name_ar)')
                .eq('type', 'quran_teacher')
                .order('name_ar');

            if (error) throw error;
            setTeachers(data as any || []);
        } catch (error) {
            console.error('Error fetching teachers:', error);
            // toast.error(isRTL ? 'فشل تحميل المحفظين' : 'Failed to fetch teachers');
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
                name_ar: formData.name,
                name_en: formData.name, // Using same name for EN/AR for simplicity in this view
                phone: formData.phone,
                type: 'quran_teacher',
                user_id: formData.volunteer_id === 'none' ? null : formData.volunteer_id
            };

            if (isEditMode && selectedId) {
                const { error } = await supabase
                    .from('trainers')
                    .update(commonData)
                    .eq('id', selectedId);

                if (error) throw error;
                toast.success(isRTL ? 'تم التحديث بنجاح' : 'Updated successfully');
            } else {
                const { error } = await supabase
                    .from('trainers')
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

    const handleDelete = async (id: string) => {
        if (!confirm(isRTL ? 'هل أنت متأكد؟' : 'Are you sure?')) return;

        try {
            const { error } = await supabase
                .from('trainers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success(isRTL ? 'تم الحذف' : 'Deleted');
            fetchTeachers();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            phone: '',
            volunteer_id: 'none',
        });
        setIsEditMode(false);
        setSelectedId(null);
    };

    const handleEdit = (t: QuranTeacher) => {
        setFormData({
            name: t.name_ar, // Assuming name_ar is primary
            phone: t.phone,
            volunteer_id: t.user_id || 'none',
        });
        setSelectedId(t.id);
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const filteredTeachers = teachers.filter(t =>
        t.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{isEditMode ? (isRTL ? 'تعديل محفظ' : 'Edit Teacher') : (isRTL ? 'إضافة محفظ جديد' : 'Add New Teacher')}</DialogTitle>
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

            <div className="flex items-center gap-2 max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={isRTL ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                            <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24">{isRTL ? 'جاري التحميل...' : 'Loading...'}</TableCell>
                            </TableRow>
                        ) : filteredTeachers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">{isRTL ? 'لا توجد بيانات' : 'No data found'}</TableCell>
                            </TableRow>
                        ) : (
                            filteredTeachers.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{t.name_ar}</span>
                                            {t.linked_user && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                    <LinkIcon className="h-3 w-3" />
                                                    <span>{isRTL ? t.linked_user.full_name_ar : t.linked_user.full_name}</span>
                                                </div>
                                            )}
                                            {!t.linked_user && (
                                                <div className="flex items-center gap-1 text-xs text-amber-600/70 mt-0.5" title={isRTL ? 'غير مربوط بحساب' : 'Not linked to account'}>
                                                    <AlertCircle className="h-3 w-3" />
                                                    <span>{isRTL ? 'غير مربوط' : 'Unlinked'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{t.phone}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(t)}>
                                                    <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'تعديل' : 'Edit'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(t.id)}>
                                                    <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'حذف' : 'Delete'}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
