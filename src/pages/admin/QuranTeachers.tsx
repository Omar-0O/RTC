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
import { Plus, Search, MoreVertical, Pencil, Trash2, Users } from 'lucide-react';

interface QuranTeacher {
    id: string;
    name: string;
    phone: string;
    created_at: string;
}

export default function QuranTeachers() {
    const { isRTL } = useLanguage();
    const [teachers, setTeachers] = useState<QuranTeacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
    });

    useEffect(() => {
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('quran_teachers')
                .select('*')
                .order('name');

            if (error) throw error;
            setTeachers(data || []);
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
            if (isEditMode && selectedId) {
                const { error } = await supabase
                    .from('quran_teachers')
                    .update(formData)
                    .eq('id', selectedId);

                if (error) throw error;
                toast.success(isRTL ? 'تم التحديث بنجاح' : 'Updated successfully');
            } else {
                const { error } = await supabase
                    .from('quran_teachers')
                    .insert(formData);

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
                .from('quran_teachers')
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
        });
        setIsEditMode(false);
        setSelectedId(null);
    };

    const handleEdit = (t: QuranTeacher) => {
        setFormData({
            name: t.name,
            phone: t.phone,
        });
        setSelectedId(t.id);
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const filteredTeachers = teachers.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone.includes(searchQuery)
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
                                    <TableCell className="font-medium">{t.name}</TableCell>
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
