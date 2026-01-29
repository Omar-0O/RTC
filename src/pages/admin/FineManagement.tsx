import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

type FineType = {
    id: string;
    name: string;
    name_ar: string;
    amount: number;
};

export default function FineManagement() {
    const { t, isRTL } = useLanguage();
    const [fines, setFines] = useState<FineType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingFine, setEditingFine] = useState<FineType | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        name_ar: '',
        amount: '',
    });

    useEffect(() => {
        fetchFines();
    }, []);

    const fetchFines = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('fine_types')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setFines(data || []);
        } catch (error) {
            console.error('Error fetching fines:', error);
            toast.error(isRTL ? 'فشل تحميل أنواع الغرامات' : 'Failed to fetch fine types');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.name_ar || !formData.amount) return;

        setSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                name_ar: formData.name_ar,
                amount: parseFloat(formData.amount),
            };

            if (editingFine) {
                const { error } = await supabase
                    .from('fine_types')
                    .update(payload)
                    .eq('id', editingFine.id);
                if (error) throw error;
                toast.success(isRTL ? 'تم تحديث الغرامة' : 'Fine updated successfully');
            } else {
                const { error } = await supabase
                    .from('fine_types')
                    .insert(payload);
                if (error) throw error;
                toast.success(isRTL ? 'تم إضافة الغرامة' : 'Fine added successfully');
            }

            setIsDialogOpen(false);
            resetForm();
            fetchFines();
        } catch (error) {
            console.error('Error saving fine:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء الحفظ' : 'Error saving fine');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;

        try {
            const { error } = await supabase.from('fine_types').delete().eq('id', id);
            if (error) throw error;
            toast.success(isRTL ? 'تم حذف الغرامة' : 'Fine deleted successfully');
            fetchFines();
        } catch (error) {
            console.error('Error deleting fine:', error);
            toast.error(isRTL ? 'فشل الحذف' : 'Failed to delete');
        }
    };

    const resetForm = () => {
        setFormData({ name: '', name_ar: '', amount: '' });
        setEditingFine(null);
    };

    const openEdit = (fine: FineType) => {
        setEditingFine(fine);
        setFormData({
            name: fine.name,
            name_ar: fine.name_ar,
            amount: fine.amount.toString(),
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">
                    {isRTL ? 'إدارة الغرامات' : 'Fines Management'}
                </h1>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            {isRTL ? 'إضافة غرامة' : 'Add Fine'}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingFine
                                    ? (isRTL ? 'تعديل الغرامة' : 'Edit Fine')
                                    : (isRTL ? 'إضافة غرامة جديدة' : 'Add New Fine')}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{isRTL ? 'الاسم (EN)' : 'Name (EN)'}</Label>
                                    <Input
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Late Arrival"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{isRTL ? 'الاسم (AR)' : 'Name (AR)'}</Label>
                                    <Input
                                        required
                                        value={formData.name_ar}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                                        placeholder="مثال: تأخير"
                                        dir="rtl"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{isRTL ? 'القيمة (ج.م)' : 'Amount (EGP)'}</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        className="pl-9"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    {isRTL ? 'إلغاء' : 'Cancel'}
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isRTL ? 'حفظ' : 'Save'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{isRTL ? 'قائمة الغرامات' : 'Fines List'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                <TableHead>{isRTL ? 'القيمة' : 'Amount'}</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : fines.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                        {isRTL ? 'لا توجد غرامات مضافة' : 'No fines added yet'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                fines.map((fine) => (
                                    <TableRow key={fine.id}>
                                        <TableCell className="font-medium">
                                            {isRTL ? fine.name_ar : fine.name}
                                            <span className="block text-xs text-muted-foreground">
                                                {isRTL ? fine.name : fine.name_ar}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {fine.amount} {isRTL ? 'ج.م' : 'EGP'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEdit(fine)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDelete(fine.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
