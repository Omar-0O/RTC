import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { Plus, Search, MoreVertical, Pencil, Trash2, BookOpen, MessageCircle, Upload, X, Loader2 } from 'lucide-react';
import { QuranProgress } from '@/components/quran/QuranProgress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { compressImage } from '@/utils/imageCompression';

interface Beneficiary {
    id: string;
    name_ar: string;
    name_en: string;
    phone: string;
    image_url: string | null;
    previous_parts: number;
    current_parts: number;
    date_added: string;
}

export default function QuranManagement() {
    const navigate = useNavigate();
    const { isRTL } = useLanguage();
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name_ar: '',
        name_en: '',
        phone: '',
        image_url: '',
        previous_parts: 0,
        current_parts: 0,
        date_added: new Date().toISOString().split('T')[0]
    });

    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [unit, setUnit] = useState<'page' | 'quarter' | 'hizb' | 'juz'>('juz');

    useEffect(() => {
        fetchBeneficiaries();
    }, []);

    const fetchBeneficiaries = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('quran_beneficiaries')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBeneficiaries(data || []);
        } catch (error) {
            console.error('Error fetching beneficiaries:', error);
            toast.error(isRTL ? 'فشل تحميل البيانات' : 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        setFormData({ ...formData, image_url: '' });
    };

    const handleSave = async () => {
        const MAX_PARTS = 240; // 30 Juz * 8 quarters = 240 quarters

        if (!formData.name_ar || !formData.phone) {
            toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
            return;
        }

        // Validate max 30 juz
        const totalParts = formData.previous_parts + formData.current_parts;
        if (totalParts > MAX_PARTS) {
            toast.error(isRTL ? 'الحد الأقصى للحفظ هو 30 جزء' : 'Maximum memorization is 30 Juz');
            return;
        }

        setIsUploading(true);
        let finalImageUrl = formData.image_url;

        try {
            // Handle Image Upload
            if (selectedImage) {
                try {
                    const compressedFile = await compressImage(selectedImage);
                    const fileExt = 'jpg'; // compressed is always jpeg
                    const fileName = `quran-beneficiaries/${Date.now()}.${fileExt}`;

                    const { error: uploadError, data } = await supabase.storage
                        .from('avatars')
                        .upload(fileName, compressedFile, {
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(fileName);

                    finalImageUrl = publicUrl;
                } catch (error) {
                    console.error('Image upload failed:', error);
                    toast.error(isRTL ? 'فشل رفع الصورة' : 'Image upload failed');
                    setIsUploading(false);
                    return;
                }
            }

            // Ensure we save integers (quarters)
            const dataToSave = {
                name_ar: formData.name_ar,
                name_en: formData.name_en,
                phone: formData.phone,
                image_url: finalImageUrl || null,
                previous_parts: Math.round(formData.previous_parts),
                current_parts: Math.round(formData.current_parts),
                date_added: formData.date_added
            };

            if (isEditMode && selectedId) {
                const { error } = await supabase
                    .from('quran_beneficiaries')
                    .update(dataToSave)
                    .eq('id', selectedId);

                if (error) throw error;
                toast.success(isRTL ? 'تم التحديث بنجاح' : 'Updated successfully');
            } else {
                const { error } = await supabase
                    .from('quran_beneficiaries')
                    .insert(dataToSave);

                if (error) throw error;
                toast.success(isRTL ? 'تم الإضافة بنجاح' : 'Added successfully');
            }

            setIsCreateOpen(false);
            resetForm();
            fetchBeneficiaries();
        } catch (error: any) {
            console.error('Error saving:', error);
            toast.error(error.message || 'Error occurred');
        } finally {
            setIsUploading(false);
        }
    };

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            const { error } = await supabase
                .from('quran_beneficiaries')
                .delete()
                .eq('id', deleteId);

            if (error) throw error;
            toast.success(isRTL ? 'تم الحذف' : 'Deleted');
            fetchBeneficiaries();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete');
        } finally {
            setDeleteId(null);
        }
    };

    const resetForm = () => {
        setFormData({
            name_ar: '',
            name_en: '',
            phone: '',
            image_url: '',
            previous_parts: 0,
            current_parts: 0,
            date_added: new Date().toISOString().split('T')[0]
        });
        setSelectedImage(null);
        setImagePreview(null);
        setIsEditMode(false);
        setSelectedId(null);
    };

    const handleEdit = (b: Beneficiary) => {
        setFormData({
            name_ar: b.name_ar,
            name_en: b.name_en || '',
            phone: b.phone,
            image_url: b.image_url || '',
            previous_parts: b.previous_parts,
            current_parts: b.current_parts,
            date_added: b.date_added
        });
        setImagePreview(b.image_url);
        setSelectedId(b.id);
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const handleWhatsApp = (phone: string) => {
        let cleanPhone = phone.replace(/\D/g, '');
        // Assuming Egyptian numbers for now, remove leading 0 and add 20
        if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
        if (!cleanPhone.startsWith('20')) cleanPhone = '20' + cleanPhone;
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const filteredBeneficiaries = beneficiaries.filter(b =>
        b.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.name_en && b.name_en.toLowerCase().includes(searchQuery.toLowerCase())) ||
        b.phone.includes(searchQuery)
    );

    const [quickAddValues, setQuickAddValues] = useState<{ [key: string]: string }>({});

    const handleQuickAdd = async (id: string, currentParts: number) => {
        const MAX_PARTS = 240; // 30 Juz * 8 quarters = 240 quarters
        const val = parseFloat(quickAddValues[id]);
        if (!val || isNaN(val)) return;

        // Check if adding would exceed 30 juz
        const beneficiary = beneficiaries.find(b => b.id === id);
        if (beneficiary) {
            const totalAfterAdd = beneficiary.previous_parts + currentParts + val;
            if (totalAfterAdd > MAX_PARTS) {
                toast.error(isRTL ? 'الحد الأقصى للحفظ هو 30 جزء' : 'Maximum memorization is 30 Juz');
                return;
            }
        }

        try {
            // Default assumes quarters if unit is not specified, but here we just add to the existing parts
            // Since the system seems to store everything in "quarters" (based on the * 8 logic elsewhere),
            // and the user asks for "increase", we need to know what unit they expect.
            // Given the input elsewhere uses a global 'unit' state, but here it's a quick add per row.
            // I will assume the input is in "Quarters" for consistency with the storage, OR I should add a small selector?
            // "increase in new memorization amount" -> usually implies pages or quarters.
            // The main form inputs save as `val * multiplier`.
            // Let's assume the user inputs "Quarters" for now as it's the base unit, or add a label "Qtr".
            // Actually, to be safe and useful, let's treat it as "Quarters" (0.25 hizb, 0.125 juz).

            const newParts = currentParts + val;

            const { error } = await supabase
                .from('quran_beneficiaries')
                .update({ current_parts: newParts })
                .eq('id', id);

            if (error) throw error;

            toast.success(isRTL ? 'تم تحديث الحفظ بنجاح' : 'Progress updated');

            // Clear input
            const newValues = { ...quickAddValues };
            delete newValues[id];
            setQuickAddValues(newValues);

            fetchBeneficiaries();
        } catch (error) {
            console.error('Error updating progress:', error);
            toast.error(isRTL ? 'فشل التحديث' : 'Update failed');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <BookOpen className="h-8 w-8 text-primary" />
                        {isRTL ? 'إدارة مستفيدين القرآن' : 'Quran Beneficiaries'}
                    </h1>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            {isRTL ? 'إضافة مستفيد' : 'Add Beneficiary'}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{isEditMode ? (isRTL ? 'تعديل مستفيد' : 'Edit Beneficiary') : (isRTL ? 'إضافة مستفيد جديد' : 'Add New Beneficiary')}</DialogTitle>
                        </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                            {/* Personal Info Section */}
                            <div className="md:col-span-2 bg-muted/30 p-4 rounded-lg space-y-4 border">
                                <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                                    <span className="w-1 h-6 bg-primary rounded-full"></span>
                                    {isRTL ? 'البيانات الشخصية' : 'Personal Information'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'} <span className="text-destructive">*</span></Label>
                                        <Input
                                            value={formData.name_ar}
                                            onChange={e => setFormData({ ...formData, name_ar: e.target.value })}
                                            placeholder={isRTL ? 'الاسم رباعي' : 'Full Name'}
                                            className="bg-background"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                                        <Input
                                            value={formData.name_en}
                                            onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                                            placeholder="Optional"
                                            className="bg-background"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'رقم الهاتف' : 'Phone'} <span className="text-destructive">*</span></Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="01xxxxxxxxx"
                                            className="bg-background"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{isRTL ? 'تاريخ الإضافة' : 'Date Added'}</Label>
                                        <Input
                                            type="date"
                                            value={formData.date_added}
                                            onChange={e => setFormData({ ...formData, date_added: e.target.value })}
                                            className="bg-background"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-2 flex flex-col items-center gap-4 border rounded-lg p-4 bg-background">
                                <div className="relative">
                                    <Avatar className="h-24 w-24 border-2 border-primary/20">
                                        <AvatarImage src={imagePreview || undefined} />
                                        <AvatarFallback className="text-2xl">{formData.name_en?.slice(0, 2).toUpperCase() || 'NA'}</AvatarFallback>
                                    </Avatar>
                                    {imagePreview && (
                                        <button
                                            onClick={handleRemoveImage}
                                            className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90 transition-colors"
                                            type="button"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                                    <Label htmlFor="image-upload" className="cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-md flex items-center gap-2 transition-colors w-full justify-center">
                                        <Upload className="h-4 w-4" />
                                        {isRTL ? 'رفع صورة شخصية' : 'Upload Photo'}
                                    </Label>
                                    <Input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageSelect}
                                    />
                                    <span className="text-xs text-muted-foreground text-center">
                                        {isRTL ? 'سيتم ضغط الصورة تلقائياً لتكون أصغر حجماً' : 'Image will be automatically compressed'}
                                    </span>
                                </div>
                            </div>


                            {/* Memorization Progress Section */}
                            <div className="md:col-span-2 bg-muted/30 p-4 rounded-lg space-y-4 border">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <span className="w-1 h-6 bg-primary rounded-full"></span>
                                        {isRTL ? 'بيانات الحفظ' : 'Memorization Progress'}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm text-muted-foreground whitespace-nowrap">{isRTL ? 'وحدة الإدخال:' : 'Input Unit:'}</Label>
                                        <div className="flex bg-background rounded-md border p-1">
                                            {(['page', 'quarter', 'hizb', 'juz'] as const).map((u) => (
                                                <button
                                                    key={u}
                                                    onClick={() => setUnit(u)}
                                                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${unit === u
                                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                                        : 'hover:bg-muted text-muted-foreground'
                                                        }`}
                                                >
                                                    {u === 'page' ? (isRTL ? 'صفحة' : 'Page') :
                                                        u === 'quarter' ? (isRTL ? 'ربع' : 'Quarter') :
                                                            u === 'hizb' ? (isRTL ? 'حزب' : 'Hizb') :
                                                                (isRTL ? 'جزء' : 'Juz')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Previous Progress */}
                                    <div className="space-y-2 p-4 rounded-lg border-2 border-slate-200 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-800">
                                        <Label className="text-slate-600 dark:text-slate-400 font-medium">
                                            {isRTL ? 'رصيد مسبق' : 'Previous Balance'}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min={0}
                                                step={unit === 'page' ? 1 : unit === 'juz' ? 0.125 : unit === 'hizb' ? 0.25 : 1}
                                                value={formData.previous_parts === 0 ? '' : Number((formData.previous_parts / (unit === 'page' ? 0.4 : unit === 'juz' ? 8 : unit === 'hizb' ? 4 : 1)).toFixed(2))}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const multiplier = unit === 'page' ? 0.4 : unit === 'juz' ? 8 : unit === 'hizb' ? 4 : 1;
                                                    setFormData({ ...formData, previous_parts: val * multiplier });
                                                }}
                                                className="border-slate-300 focus-visible:ring-slate-400 font-bold text-lg h-12 bg-white dark:bg-black"
                                            />
                                            <span className="absolute end-3 top-3 text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded">
                                                {unit === 'page' ? (isRTL ? 'صفحة' : 'Page') :
                                                    unit === 'quarter' ? (isRTL ? 'ربع' : 'Qtr') :
                                                        unit === 'hizb' ? (isRTL ? 'حزب' : 'Hizb') :
                                                            (isRTL ? 'جزء' : 'Juz')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-end">
                                            = {Number(formData.previous_parts.toFixed(2))} {isRTL ? 'ربع' : 'Quarters'}
                                        </p>
                                    </div>

                                    {/* Current Progress */}
                                    <div className="space-y-2 p-4 rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                                        <Label className="text-amber-700 dark:text-amber-500 font-medium">
                                            {isRTL ? 'حفظ جديد' : 'Current Progress'}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min={0}
                                                step={unit === 'page' ? 1 : unit === 'juz' ? 0.125 : unit === 'hizb' ? 0.25 : 1}
                                                value={formData.current_parts === 0 ? '' : Number((formData.current_parts / (unit === 'page' ? 0.4 : unit === 'juz' ? 8 : unit === 'hizb' ? 4 : 1)).toFixed(2))}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const multiplier = unit === 'page' ? 0.4 : unit === 'juz' ? 8 : unit === 'hizb' ? 4 : 1;
                                                    setFormData({ ...formData, current_parts: val * multiplier });
                                                }}
                                                className="border-amber-300 focus-visible:ring-amber-400 font-bold text-lg h-12 bg-white dark:bg-black"
                                            />
                                            <span className="absolute end-3 top-3 text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded">
                                                {unit === 'page' ? (isRTL ? 'صفحة' : 'Page') :
                                                    unit === 'quarter' ? (isRTL ? 'ربع' : 'Qtr') :
                                                        unit === 'hizb' ? (isRTL ? 'حزب' : 'Hizb') :
                                                            (isRTL ? 'جزء' : 'Juz')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-end">
                                            = {Number(formData.current_parts.toFixed(2))} {isRTL ? 'ربع' : 'Quarters'}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Label className="mb-2 block text-sm font-medium">{isRTL ? 'معاينة الإجمالي' : 'Total Preview'}</Label>
                                    <QuranProgress previousParts={formData.previous_parts} currentParts={formData.current_parts} readOnly />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                            <Button onClick={handleSave} className="min-w-[100px]" disabled={isUploading}>
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                                        {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                                    </>
                                ) : (
                                    isRTL ? 'حفظ البيانات' : 'Save Data'
                                )}
                            </Button>
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
                            <TableHead className="w-[40%]">{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                            <TableHead>{isRTL ? 'إضافة حفظ' : 'Quick Add'}</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">{isRTL ? 'جاري التحميل...' : 'Loading...'}</TableCell>
                            </TableRow>
                        ) : filteredBeneficiaries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">{isRTL ? 'لا توجد بيانات' : 'No data found'}</TableCell>
                            </TableRow>
                        ) : (
                            filteredBeneficiaries.map((b) => (
                                <TableRow key={b.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border">
                                                <AvatarImage src={b.image_url || undefined} />
                                                <AvatarFallback className="font-bold text-primary">{b.name_en?.slice(0, 2).toUpperCase() || 'NA'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-base">{b.name_ar}</span>
                                                {b.name_en && <span className="text-xs text-muted-foreground">{b.name_en}</span>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span dir="ltr" className="font-medium font-mono text-sm">{b.phone}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1.5">
                                            <QuranProgress previousParts={b.previous_parts} currentParts={b.current_parts} readOnly />
                                            <div className="flex justify-between items-center text-xs px-1">
                                                <span className="text-muted-foreground">
                                                    {isRTL ? 'مسبق: ' : 'Prev: '}
                                                    <span className="font-medium text-foreground/80">{b.previous_parts / 8} {isRTL ? 'جزء' : 'Juz'}</span>
                                                </span>
                                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                                    {isRTL ? 'جديد: ' : 'Curr: '}
                                                    {b.current_parts / 8} {isRTL ? 'جزء' : 'Juz'}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                min={0.25}
                                                step={0.25}
                                                placeholder={isRTL ? 'ربع' : 'Qtr'}
                                                className="w-20 h-8 text-sm"
                                                value={quickAddValues[b.id] || ''}
                                                onChange={(e) => setQuickAddValues({ ...quickAddValues, [b.id]: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleQuickAdd(b.id, b.current_parts);
                                                    }
                                                }}
                                            />
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-8 w-8 p-0"
                                                onClick={() => handleQuickAdd(b.id, b.current_parts)}
                                                disabled={!quickAddValues[b.id]}
                                            >
                                                <Plus className="h-4 w-4 text-primary" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => navigate(`/admin/quran/${b.id}`)}>
                                                    <BookOpen className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'التفاصيل' : 'Details'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleEdit(b)}>
                                                    <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'تعديل' : 'Edit'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleWhatsApp(b.phone)}>
                                                    <MessageCircle className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'واتساب' : 'WhatsApp'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(b.id)}>
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

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? 'هل أنت متأكد من حذف هذا المستفيد؟ لا يمكن التراجع عن هذا الإجراء.'
                                : 'Are you sure you want to delete this beneficiary? This action cannot be undone.'}
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
        </div>
    );
}
