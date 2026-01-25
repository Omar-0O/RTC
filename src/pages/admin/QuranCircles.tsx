import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {

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
import { Plus, Search, MoreVertical, Pencil, Trash2, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Beneficiary {
    id: string;
    name_ar: string;
    name_en: string;
    image_url: string | null;
}

interface Guest {
    name: string;
    phone: string;
}

interface QuranCircle {
    id: string;
    name: string;
    date: string;
    guest_names: Guest[];
    beneficiaries_count?: number;
}

export default function QuranCircles() {
    const { isRTL } = useLanguage();
    const [circles, setCircles] = useState<QuranCircle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        date: new Date().toISOString().split('T')[0],
        guest_names: [] as Guest[]
    });
    const [guestNameInput, setGuestNameInput] = useState('');
    const [guestPhoneInput, setGuestPhoneInput] = useState('');

    // Store selected beneficiaries with their attendance type
    const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<{ id: string, type: 'memorization' | 'revision' }[]>([]);

    // Beneficiaries Selection State
    const [allBeneficiaries, setAllBeneficiaries] = useState<Beneficiary[]>([]);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');

    useEffect(() => {
        fetchCircles();
        fetchBeneficiaries();
    }, []);

    const fetchCircles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('quran_circles')
                .select(`
                    *,
                    quran_circle_beneficiaries (count)
                `)
                .order('date', { ascending: false });

            if (error) throw error;

            const formattedData = data.map((circle: any) => {
                // Handle legacy data (array of strings) or new data (array of objects)
                const rawGuests = circle.guest_names || [];
                const formattedGuests: Guest[] = rawGuests.map((g: any) =>
                    typeof g === 'string' ? { name: g, phone: '' } : g
                );

                return {
                    id: circle.id,
                    name: circle.name,
                    date: circle.date,
                    guest_names: formattedGuests,
                    beneficiaries_count: circle.quran_circle_beneficiaries[0]?.count || 0
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

    const fetchBeneficiaries = async () => {
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

    const handleSave = async () => {
        if (!formData.name || !formData.date) {
            toast.error(isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
            return;
        }

        try {
            let circleId = selectedId;

            if (isEditMode && selectedId) {
                // Update Circle
                const { error } = await supabase
                    .from('quran_circles')
                    .update({
                        name: formData.name,
                        date: formData.date,
                        guest_names: formData.guest_names
                    })
                    .eq('id', selectedId);

                if (error) throw error;
            } else {
                // Create Circle
                const { data, error } = await supabase
                    .from('quran_circles')
                    .insert({
                        name: formData.name,
                        date: formData.date,
                        guest_names: formData.guest_names
                    })
                    .select()
                    .single();

                if (error) throw error;
                circleId = data.id;
            }

            // Sync Beneficiaries
            // 1. Delete existing connections for this circle
            if (isEditMode) {
                const { error: deleteError } = await supabase
                    .from('quran_circle_beneficiaries')
                    .delete()
                    .eq('circle_id', circleId);
                if (deleteError) throw deleteError;
            }

            // 2. Insert new connections
            if (selectedBeneficiaries.length > 0 && circleId) {
                const relations = selectedBeneficiaries.map(b => ({
                    circle_id: circleId,
                    beneficiary_id: b.id,
                    attendance_type: b.type
                }));

                const { error: insertError } = await supabase
                    .from('quran_circle_beneficiaries')
                    .insert(relations);

                if (insertError) throw insertError;
            }

            toast.success(isEditMode ? (isRTL ? 'تم التحديث بنجاح' : 'Updated successfully') : (isRTL ? 'تم إنشاء الحلقة بنجاح' : 'Circle created successfully'));
            setIsCreateOpen(false);
            resetForm();
            fetchCircles();
        } catch (error: any) {
            console.error('Error saving:', error);
            toast.error(error.message || 'Error occurred');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(isRTL ? 'هل أنت متأكد؟' : 'Are you sure?')) return;

        try {
            const { error } = await supabase
                .from('quran_circles')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success(isRTL ? 'تم الحذف' : 'Deleted');
            fetchCircles();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete');
        }
    };

    const handleEdit = async (circle: QuranCircle) => {
        // Fetch relations for this circle
        const { data } = await supabase
            .from('quran_circle_beneficiaries')
            .select('beneficiary_id, attendance_type')
            .eq('circle_id', circle.id);

        const loadedBeneficiaries = data?.map((r: any) => ({
            id: r.beneficiary_id,
            type: r.attendance_type || 'memorization'
        })) || [];

        setFormData({
            name: circle.name,
            date: circle.date,
            guest_names: circle.guest_names
        });
        setSelectedBeneficiaries(loadedBeneficiaries);
        setSelectedId(circle.id);
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            date: new Date().toISOString().split('T')[0],
            guest_names: []
        });
        setSelectedBeneficiaries([]);
        setGuestNameInput('');
        setGuestPhoneInput('');
        setIsEditMode(false);
        setSelectedId(null);
    };

    const addGuest = () => {
        if (guestNameInput.trim()) {
            setFormData(prev => ({
                ...prev,
                guest_names: [...prev.guest_names, { name: guestNameInput.trim(), phone: guestPhoneInput.trim() }]
            }));
            setGuestNameInput('');
            setGuestPhoneInput('');
        }
    };

    const removeGuest = (index: number) => {
        setFormData(prev => ({
            ...prev,
            guest_names: prev.guest_names.filter((_, i) => i !== index)
        }));
    };

    const toggleBeneficiary = (id: string) => {
        setSelectedBeneficiaries(prev => {
            const exists = prev.find(b => b.id === id);
            if (exists) {
                return prev.filter(b => b.id !== id);
            } else {
                return [...prev, { id, type: 'memorization' }];
            }
        });
    };

    const updateAttendanceType = (id: string, type: 'memorization' | 'revision') => {
        setSelectedBeneficiaries(prev =>
            prev.map(b => b.id === id ? { ...b, type } : b)
        );
    };

    const filteredBeneficiaries = allBeneficiaries.filter(b =>
        b.name_ar.toLowerCase().includes(beneficiarySearch.toLowerCase()) ||
        b.name_en.toLowerCase().includes(beneficiarySearch.toLowerCase())
    );

    const filteredCircles = circles.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <Users className="h-8 w-8 text-primary" />
                        {isRTL ? 'إدارة حلقات القرآن' : 'Quran Circles'}
                    </h1>
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
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{isEditMode ? (isRTL ? 'تعديل الحلقة' : 'Edit Circle') : (isRTL ? 'إضافة حلقة جديدة' : 'Add New Circle')}</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{isRTL ? 'اسم الحلقة' : 'Circle Name'} <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder={isRTL ? 'مثال: حلقة الفجر' : 'Ex: Fajr Circle'}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{isRTL ? 'التاريخ' : 'Date'} <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Beneficiaries Selection */}
                            <div className="space-y-2 border p-4 rounded-lg bg-muted/20">
                                <div className="flex justify-between items-center mb-2">
                                    <Label className="text-base font-semibold">{isRTL ? 'المستفيدين المسجلين' : 'Registered Beneficiaries'}</Label>
                                    <span className="text-sm text-muted-foreground">{selectedBeneficiaries.length} {isRTL ? 'محدد' : 'Selected'}</span>
                                </div>
                                <Input
                                    placeholder={isRTL ? 'بحث عن مستفيد...' : 'Search beneficiaries...'}
                                    value={beneficiarySearch}
                                    onChange={e => setBeneficiarySearch(e.target.value)}
                                    className="mb-2"
                                />
                                <ScrollArea className="h-[200px] border rounded-md bg-background p-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {filteredBeneficiaries.map(b => {
                                            const isSelected = selectedBeneficiaries.some(sb => sb.id === b.id);
                                            const selectedData = selectedBeneficiaries.find(sb => sb.id === b.id);

                                            return (
                                                <div
                                                    key={b.id}
                                                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md transition-colors ${isSelected ? 'bg-primary/5 border-primary/20 border' : 'hover:bg-muted border border-transparent'}`}
                                                >
                                                    <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleBeneficiary(b.id)}>
                                                        <Checkbox checked={isSelected} />
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={b.image_url || undefined} />
                                                            <AvatarFallback>{b.name_en?.slice(0, 1) || 'B'}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm font-medium">{b.name_ar}</span>
                                                    </div>

                                                    {isSelected && (
                                                        <div className="flex items-center gap-1 bg-background rounded-md border p-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateAttendanceType(b.id, 'memorization')}
                                                                className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${selectedData?.type === 'memorization'
                                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                                    : 'hover:bg-muted text-muted-foreground'
                                                                    }`}
                                                            >
                                                                {isRTL ? 'حفظ' : 'Memorization'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateAttendanceType(b.id, 'revision')}
                                                                className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${selectedData?.type === 'revision'
                                                                    ? 'bg-amber-500 text-white shadow-sm'
                                                                    : 'hover:bg-muted text-muted-foreground'
                                                                    }`}
                                                            >
                                                                {isRTL ? 'مراجعة' : 'Revision'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Guests Input */}
                            <div className="space-y-2 border p-4 rounded-lg bg-muted/20">
                                <Label className="text-base font-semibold">{isRTL ? 'الضيوف (من خارج النظام)' : 'Guests'}</Label>
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs text-muted-foreground">{isRTL ? 'الاسم' : 'Name'}</Label>
                                        <Input
                                            value={guestNameInput}
                                            onChange={e => setGuestNameInput(e.target.value)}
                                            placeholder={isRTL ? 'اسم الضيف' : 'Guest Name'}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs text-muted-foreground">{isRTL ? 'الهاتف' : 'Phone'}</Label>
                                        <Input
                                            value={guestPhoneInput}
                                            onChange={e => setGuestPhoneInput(e.target.value)}
                                            placeholder={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                                        />
                                    </div>
                                    <Button onClick={addGuest} variant="secondary" type="button" className="mb-0.5">{isRTL ? 'إضافة' : 'Add'}</Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {formData.guest_names.map((guest, idx) => (
                                        <Badge key={idx} variant="outline" className="pl-1 pr-2 py-1 gap-1 flex items-center">
                                            <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeGuest(idx)} />
                                            <span>{guest.name}</span>
                                            {guest.phone && <span className="text-muted-foreground text-[10px] ml-1">({guest.phone})</span>}
                                        </Badge>
                                    ))}
                                    {formData.guest_names.length === 0 && <span className="text-xs text-muted-foreground">{isRTL ? 'لا يوجد ضيوف' : 'No guests added'}</span>}
                                </div>
                            </div>

                            {/* Total Summary */}
                            <div className="flex justify-end items-center gap-4 pt-2 border-t">
                                <div className="text-sm text-muted-foreground">
                                    {isRTL ? 'إجمالي الحضور:' : 'Total Attendance:'} <span className="font-bold text-foreground text-lg">{selectedBeneficiaries.length + formData.guest_names.length}</span>
                                </div>
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
                    placeholder={isRTL ? 'بحث باسم الحلقة...' : 'Search circle name...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-40 rounded-lg border bg-card text-card-foreground shadow-sm animate-pulse bg-muted/20" />
                    ))
                ) : filteredCircles.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>{isRTL ? 'لا توجد حلقات' : 'No circles found'}</p>
                    </div>
                ) : (
                    filteredCircles.map((c) => (
                        <div key={c.id} className="group relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-lg leading-none tracking-tight">{c.name}</h3>
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                {format(new Date(c.date), 'yyyy-MM-dd')}
                                            </span>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(c)}>
                                                <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'تعديل' : 'Edit'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c.id)}>
                                                <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                {isRTL ? 'حذف' : 'Delete'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex items-center gap-4 pt-2">
                                    <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-full text-sm font-medium text-primary">
                                        <Users className="h-4 w-4" />
                                        <span>
                                            {(c.beneficiaries_count || 0) + c.guest_names.length} {isRTL ? 'حضور' : 'Attendees'}
                                        </span>
                                    </div>
                                    {(c.guest_names.length > 0) && (
                                        <span className="text-xs text-muted-foreground">
                                            ({c.guest_names.length} {isRTL ? 'ضيوف' : 'Guests'})
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/10 group-hover:bg-primary transition-colors" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
