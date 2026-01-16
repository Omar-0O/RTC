import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Phone, BookOpen, Award, Search, User, Camera, Loader2, Check, Building2, FileSpreadsheet, MoreHorizontal, MessageCircle } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { utils, writeFile } from 'xlsx';

// Image compression utility
const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_DIMENSION = 800;
                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Image compression failed'));
                            return;
                        }
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    0.8
                );
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

interface Trainer {
    id: string;
    name_en: string;
    name_ar: string;
    phone: string | null;
    image_url: string | null;
    committee_id: string | null;
    committee_name?: string;
    created_at: string;
    courses_count?: number;
    completed_courses_count?: number;
    certificates_delivered_count?: number;
    is_active?: boolean;
}

interface Committee {
    id: string;
    name: string;
    name_ar: string;
}

export default function TrainerManagement() {
    const { user } = useAuth();
    const { isRTL } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [trainers, setTrainers] = useState<Trainer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [trainerToDelete, setTrainerToDelete] = useState<Trainer | null>(null);
    const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name_en: '',
        name_ar: '',
        phone: '',
        image_url: '',
        committee_id: ''
    });

    const [committees, setCommittees] = useState<Committee[]>([]);
    const [selectedCommittee, setSelectedCommittee] = useState<string>('all');
    const [viewTrainer, setViewTrainer] = useState<Trainer | null>(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);


    useEffect(() => {
        fetchTrainers();
        fetchCommittees();
    }, []);

    const fetchTrainers = async () => {
        setLoading(true);
        try {
            // Try to fetch with committee join first, fallback to simple query if column doesn't exist
            let data: any[] = [];
            let fetchError = null;

            try {
                const result = await supabase
                    .from('trainers')
                    .select('*, committee:committees(id, name, name_ar)')
                    .order('name_ar');
                data = result.data || [];
                fetchError = result.error;
            } catch {
                // If join fails, try without committee
                const result = await supabase
                    .from('trainers')
                    .select('*')
                    .order('name_ar');
                data = result.data || [];
                fetchError = result.error;
            }

            // If there's still an error with the basic query, try simpler
            if (fetchError) {
                const result = await supabase
                    .from('trainers')
                    .select('*')
                    .order('name_ar');
                data = result.data || [];
                if (result.error) throw result.error;
            }

            const today = new Date().toISOString().split('T')[0];

            // Fetch stats and active status for each trainer
            const trainersWithStats = await Promise.all(
                (data || []).map(async (trainer: any) => {
                    // Get stats
                    const { data: stats } = await supabase
                        .rpc('get_trainer_stats', { p_trainer_id: trainer.id });

                    // Check if trainer has active courses (end_date >= today)
                    const { data: activeCourses } = await supabase
                        .from('courses')
                        .select('id')
                        .eq('trainer_id', trainer.id)
                        .gte('end_date', today)
                        .limit(1);

                    // Get completed courses count (end_date < today)
                    const { count: completedCount } = await supabase
                        .from('courses')
                        .select('id', { count: 'exact', head: true })
                        .eq('trainer_id', trainer.id)
                        .lt('end_date', today);

                    return {
                        ...trainer,
                        committee_name: trainer.committee
                            ? (isRTL ? trainer.committee.name_ar : trainer.committee.name)
                            : null,
                        courses_count: stats?.[0]?.courses_count || 0,
                        completed_courses_count: completedCount || 0,
                        certificates_delivered_count: stats?.[0]?.certificates_delivered_count || 0,
                        is_active: (activeCourses && activeCourses.length > 0)
                    };
                })
            );

            setTrainers(trainersWithStats);
        } catch (error) {
            console.error('Error fetching trainers:', error);
            toast.error(isRTL ? 'فشل في تحميل المدربين' : 'Failed to fetch trainers');
        } finally {
            setLoading(false);
        }
    };

    const fetchCommittees = async () => {
        try {
            const { data, error } = await supabase
                .from('committees')
                .select('id, name, name_ar')
                .order('name_ar');

            if (error) throw error;
            setCommittees(data || []);
        } catch (error) {
            console.error('Error fetching committees:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            name_en: '',
            name_ar: '',
            phone: '',
            image_url: '',
            committee_id: ''
        });
        setEditingTrainer(null);
        setImageFile(null);
        setPreviewUrl(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const openEditDialog = (trainer: Trainer) => {
        setEditingTrainer(trainer);
        setFormData({
            name_en: trainer.name_en,
            name_ar: trainer.name_ar,
            phone: trainer.phone || '',
            image_url: trainer.image_url || '',
            committee_id: trainer.committee_id || ''
        });
        setPreviewUrl(trainer.image_url || null);
        setImageFile(null);
        setIsDialogOpen(true);
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error(isRTL ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Compress if needed
        let processedFile = file;
        if (file.size > 1 * 1024 * 1024) {
            try {
                processedFile = await compressImage(file);
            } catch (error) {
                console.error('Compression error:', error);
            }
        }
        setImageFile(processedFile);
    };

    const handleSave = async () => {
        if (!formData.name_en || !formData.name_ar) {
            toast.error(isRTL ? 'يرجى إدخال اسم المدرب بالعربية والإنجليزية' : 'Please enter trainer name in Arabic and English');
            return;
        }

        setIsSaving(true);
        try {
            let imageUrl = formData.image_url;

            // Upload new image if selected
            if (imageFile) {
                setIsUploading(true);
                try {
                    const fileExt = imageFile.name.split('.').pop() || 'jpg';
                    const fileName = `trainer_${Date.now()}.${fileExt}`;

                    // Try trainers bucket first
                    const { error: uploadError } = await supabase.storage
                        .from('trainers')
                        .upload(fileName, imageFile, { upsert: true });

                    if (uploadError) {
                        // Try avatars bucket as fallback
                        const { error: uploadError2 } = await supabase.storage
                            .from('avatars')
                            .upload(`trainers/${fileName}`, imageFile, { upsert: true });

                        if (!uploadError2) {
                            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`trainers/${fileName}`);
                            imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;
                        } else {
                            // Both failed, just log and continue without image
                            console.warn('Image upload failed, saving trainer without image:', uploadError2);
                        }
                    } else {
                        const { data: urlData } = supabase.storage.from('trainers').getPublicUrl(fileName);
                        imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;
                    }
                } catch (uploadErr) {
                    // Log but don't fail the whole save
                    console.warn('Image upload error, saving trainer without image:', uploadErr);
                } finally {
                    setIsUploading(false);
                }
            }

            if (editingTrainer) {
                // Update - try with committee_id first, fallback without it
                let updateData: any = {
                    name_en: formData.name_en,
                    name_ar: formData.name_ar,
                    phone: formData.phone || null,
                    image_url: imageUrl || null,
                    updated_at: new Date().toISOString()
                };

                // Try to include committee_id
                if (formData.committee_id) {
                    updateData.committee_id = formData.committee_id;
                }

                const { error } = await supabase
                    .from('trainers')
                    .update(updateData)
                    .eq('id', editingTrainer.id);

                if (error) throw error;
                toast.success(isRTL ? 'تم تحديث المدرب بنجاح' : 'Trainer updated successfully');
            } else {
                // Create - try with committee_id first, fallback without it
                let insertData: any = {
                    name_en: formData.name_en,
                    name_ar: formData.name_ar,
                    phone: formData.phone || null,
                    image_url: imageUrl || null
                };

                // Try to include committee_id
                if (formData.committee_id) {
                    insertData.committee_id = formData.committee_id;
                }

                let { error } = await supabase
                    .from('trainers')
                    .insert(insertData);

                // If error mentions committee_id, retry without it
                if (error && error.message?.includes('committee_id')) {
                    delete insertData.committee_id;
                    const retryResult = await supabase
                        .from('trainers')
                        .insert(insertData);
                    error = retryResult.error;
                }

                if (error) throw error;
                toast.success(isRTL ? 'تم إضافة المدرب بنجاح' : 'Trainer added successfully');
            }

            setIsDialogOpen(false);
            resetForm();
            fetchTrainers();
        } catch (error) {
            console.error('Error saving trainer:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء الحفظ' : 'Error saving trainer');
        } finally {
            setIsSaving(false);
            setIsUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!trainerToDelete) return;

        try {
            const { error } = await supabase
                .from('trainers')
                .delete()
                .eq('id', trainerToDelete.id);

            if (error) throw error;

            toast.success(isRTL ? 'تم حذف المدرب بنجاح' : 'Trainer deleted successfully');
            setIsDeleteDialogOpen(false);
            setTrainerToDelete(null);
            fetchTrainers();
        } catch (error) {
            console.error('Error deleting trainer:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء الحذف' : 'Error deleting trainer');
        }
    };

    const filteredTrainers = trainers.filter(trainer => {
        const matchesSearch = !searchQuery || (
            trainer.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trainer.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (trainer.phone && trainer.phone.includes(searchQuery.toLowerCase()))
        );

        const matchesCommittee = selectedCommittee === 'all' || trainer.committee_id === selectedCommittee;

        return matchesSearch && matchesCommittee;
    });

    const getTrainerInitials = (trainer: Trainer) => {
        const name = isRTL ? trainer.name_ar : trainer.name_en;
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleExportTrainer = async (trainer: Trainer) => {
        try {
            toast.info(isRTL ? 'جاري تحضير التقرير...' : 'Preparing report...');

            // Fetch comprehensive course history for this trainer with full beneficiary data
            const { data: courses, error } = await supabase
                .from('courses')
                .select('*, course_beneficiaries(*), course_organizers(name, phone)')
                .eq('trainer_id', trainer.id)
                .order('start_date', { ascending: false });

            if (error) throw error;

            const wb = utils.book_new();

            // --- Sheet 1: Trainer Report (تقرير المدرب) ---
            const trainerInfoData = [
                // Unified Headers
                [
                    isRTL ? 'الاسم بالعربية' : 'Arabic Name',
                    isRTL ? 'الاسم بالإنجليزية' : 'English Name',
                    isRTL ? 'رقم الهاتف' : 'Phone',
                    isRTL ? 'اللجنة' : 'Committee',
                    isRTL ? 'تاريخ الانضمام' : 'Join Date',
                    isRTL ? 'الحالة' : 'Status',
                    isRTL ? 'إجمالي الكورسات' : 'Total Courses',
                    isRTL ? 'الكورسات المكتملة' : 'Completed Courses',
                    isRTL ? 'الشهادات المسلمة' : 'Certificates Delivered'
                ],
                // Unified Data
                [
                    trainer.name_ar,
                    trainer.name_en,
                    trainer.phone || '-',
                    trainer.committee_name || '-',
                    new Date(trainer.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US'),
                    trainer.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive'),
                    trainer.courses_count || 0,
                    trainer.completed_courses_count || 0,
                    trainer.certificates_delivered_count || 0
                ]
            ];

            const wsInfo = utils.aoa_to_sheet(trainerInfoData);

            // Set column widths
            wsInfo['!cols'] = [
                { wch: 20 }, // Name Ar
                { wch: 20 }, // Name En
                { wch: 15 }, // Phone
                { wch: 20 }, // Committee
                { wch: 15 }, // Join Date
                { wch: 10 }, // Status
                { wch: 15 }, // Total Courses
                { wch: 15 }, // Completed Courses
                { wch: 15 }  // Certs Delivered
            ];

            utils.book_append_sheet(wb, wsInfo, isRTL ? 'تقرير المدرب' : 'Trainer Report');


            // --- Sheet 2: Work and Impact (عمله واثره) ---
            const impactHeader = [
                isRTL ? 'اسم الكورس' : 'Course Name',
                isRTL ? 'شهادة؟' : 'Certificate?',
                isRTL ? 'تاريخ البداية' : 'Start Date',
                isRTL ? 'تاريخ النهاية' : 'End Date',
                isRTL ? 'الوقت' : 'Time',
                isRTL ? 'عدد المستفيدين' : 'Beneficiaries',
                isRTL ? 'منظم 1' : 'Organizer 1',
                isRTL ? 'منظم 2' : 'Organizer 2'
            ];

            const impactData = (courses || []).map((course: any) => {
                const beneficiaryCount = course.course_beneficiaries?.length || 0;
                const hasCert = course.has_certificates ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No');
                const org1 = course.course_organizers?.[0]?.name || '-';
                const org2 = course.course_organizers?.[1]?.name || '-';

                return [
                    course.name,
                    hasCert,
                    course.start_date,
                    course.end_date || '-',
                    `${course.schedule_time}${course.schedule_end_time ? ' - ' + course.schedule_end_time : ''}`,
                    beneficiaryCount,
                    org1,
                    org2
                ];
            });

            const wsImpact = utils.aoa_to_sheet([impactHeader, ...impactData]);

            // Set column widths for Impact sheet
            wsImpact['!cols'] = [
                { wch: 30 }, // Name
                { wch: 10 }, // Cert?
                { wch: 15 }, // Start
                { wch: 15 }, // End
                { wch: 20 }, // Time
                { wch: 15 }, // Beneficiaries
                { wch: 20 }, // Org 1
                { wch: 20 }  // Org 2
            ];

            utils.book_append_sheet(wb, wsImpact, isRTL ? 'عمله واثره' : 'Work and Impact');

            // --- Sheet 3: Certificates (الشهادات) ---
            const certHeader = [
                isRTL ? 'الاسم' : 'Name',
                isRTL ? 'رقم الهاتف' : 'Phone',
                isRTL ? 'اسم الكورس' : 'Course Name',
                isRTL ? 'التاريخ' : 'Date'
            ];

            const certData: any[][] = [];
            (courses || []).forEach((course: any) => {
                if (course.has_certificates && course.certificate_status === 'delivered') {
                    (course.course_beneficiaries || []).forEach((b: any) => {
                        certData.push([
                            b.name,
                            b.phone,
                            course.name,
                            course.end_date || course.start_date
                        ]);
                    });
                }
            });

            if (certData.length > 0) {
                const wsCerts = utils.aoa_to_sheet([certHeader, ...certData]);

                // Set column widths for Certificates sheet
                wsCerts['!cols'] = [
                    { wch: 25 }, // Name
                    { wch: 15 }, // Phone
                    { wch: 30 }, // Course Name
                    { wch: 15 }  // Date
                ];

                utils.book_append_sheet(wb, wsCerts, isRTL ? 'الشهادات' : 'Certificates');
            }


            // Generate filename with timestamp to prevent caching
            const dateStr = new Date().toISOString().split('T')[0];
            const timeStr = new Date().getTime();
            const safeName = (isRTL ? trainer.name_en : trainer.name_ar).replace(/[^a-z0-9]/gi, '_');
            const fileName = `Trainer_Report_${safeName}_${dateStr}_${timeStr}.xlsx`;

            // Download
            writeFile(wb, fileName);
            toast.success(isRTL ? 'تم تصدير التقرير بنجاح' : 'Report exported successfully');

        } catch (error) {
            console.error('Export failed:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء التصدير' : 'Export failed');
        }
    };

    const handleWhatsApp = (phone: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{isRTL ? 'إدارة المدربين' : 'Trainer Management'}</h1>
                    <p className="text-muted-foreground">
                        {isRTL ? 'إدارة مدربي الكورسات' : 'Manage course trainers'}
                    </p>
                </div>
                <Button onClick={openCreateDialog} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {isRTL ? 'إضافة مدرب' : 'Add Trainer'}
                </Button>
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={isRTL ? 'بحث عن مدرب...' : 'Search trainers...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={isRTL ? 'كل اللجان' : 'All Committees'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{isRTL ? 'كل اللجان' : 'All Committees'}</SelectItem>
                        {committees.map(committee => (
                            <SelectItem key={committee.id} value={committee.id}>
                                {isRTL ? committee.name_ar : committee.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Trainers Grid */}
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
            ) : filteredTrainers.length === 0 ? (
                <Card className="p-8 text-center">
                    <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                        {searchQuery
                            ? (isRTL ? 'لا توجد نتائج' : 'No results found')
                            : (isRTL ? 'لا يوجد مدربين مسجلين' : 'No trainers registered')}
                    </p>
                    {!searchQuery && (
                        <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                            {isRTL ? 'إضافة أول مدرب' : 'Add first trainer'}
                        </Button>
                    )}
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTrainers.map(trainer => (
                        <Card
                            key={trainer.id}
                            className="group hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => {
                                setViewTrainer(trainer);
                                setIsViewDialogOpen(true);
                            }}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <Avatar className={`h-16 w-16 border-4 ${trainer.is_active ? 'border-green-500' : 'border-muted'
                                        }`}>
                                        <AvatarImage src={trainer.image_url || undefined} alt={trainer.name_ar} />
                                        <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                                            {getTrainerInitials(trainer)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg leading-tight">
                                                {isRTL ? trainer.name_ar : trainer.name_en}
                                            </h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {isRTL ? trainer.name_en : trainer.name_ar}
                                        </p>
                                        {trainer.phone && (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                                <Phone className="h-3 w-3" />
                                                <span dir="ltr">{trainer.phone}</span>
                                            </div>
                                        )}
                                        {trainer.committee_name && (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                                <Building2 className="h-3 w-3" />
                                                <span>{trainer.committee_name}</span>
                                            </div>
                                        )}
                                    </div>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                openEditDialog(trainer);
                                            }}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                {isRTL ? 'تعديل' : 'Edit'}
                                            </DropdownMenuItem>

                                            {trainer.phone && (
                                                <DropdownMenuItem onClick={(e) => handleWhatsApp(trainer.phone!, e)}>
                                                    <MessageCircle className="mr-2 h-4 w-4" />
                                                    {isRTL ? 'واتساب' : 'WhatsApp'}
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation();
                                                handleExportTrainer(trainer);
                                            }}>
                                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                                {isRTL ? 'تصدير Excel' : 'Export Excel'}
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTrainerToDelete(trainer);
                                                    setIsDeleteDialogOpen(true);
                                                }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                {isRTL ? 'حذف' : 'Delete'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Stats */}
                                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
                                    <div className="flex items-center gap-2 text-sm">
                                        <BookOpen className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium">{trainer.courses_count || 0}</span>
                                        <span className="text-muted-foreground">
                                            {isRTL ? 'كورس' : 'total'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Check className="h-4 w-4 text-green-500" />
                                        <span className="font-medium">{trainer.completed_courses_count || 0}</span>
                                        <span className="text-muted-foreground">
                                            {isRTL ? 'تم' : 'completed'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Award className="h-4 w-4 text-amber-500" />
                                        <span className="font-medium">{trainer.certificates_delivered_count || 0}</span>
                                        <span className="text-muted-foreground">
                                            {isRTL ? 'شهادة' : 'certs'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTrainer
                                ? (isRTL ? 'تعديل المدرب' : 'Edit Trainer')
                                : (isRTL ? 'إضافة مدرب جديد' : 'Add New Trainer')}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'أدخل بيانات المدرب' : 'Enter trainer details'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name_ar">{isRTL ? 'الاسم بالعربية *' : 'Arabic Name *'}</Label>
                            <Input
                                id="name_ar"
                                value={formData.name_ar}
                                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                                placeholder={isRTL ? 'مثال: محمد أحمد' : 'e.g., محمد أحمد'}
                                dir="rtl"
                                className="h-11"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="name_en">{isRTL ? 'الاسم بالإنجليزية *' : 'English Name *'}</Label>
                            <Input
                                id="name_en"
                                value={formData.name_en}
                                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                placeholder="e.g., Mohamed Ahmed"
                                dir="ltr"
                                className="h-11"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="phone">{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="01xxxxxxxxx"
                                dir="ltr"
                                className="h-11"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>{isRTL ? 'اللجنة التابع لها' : 'Committee'}</Label>
                            <Select
                                value={formData.committee_id || 'none'}
                                onValueChange={(value) => setFormData({ ...formData, committee_id: value === 'none' ? '' : value })}
                            >
                                <SelectTrigger className="h-11">
                                    <SelectValue placeholder={isRTL ? 'اختر لجنة (اختياري)' : 'Select committee (optional)'} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{isRTL ? 'بدون لجنة' : 'No committee'}</SelectItem>
                                    {committees.map(committee => (
                                        <SelectItem key={committee.id} value={committee.id}>
                                            {isRTL ? committee.name_ar : committee.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>{isRTL ? 'صورة المدرب' : 'Trainer Photo'}</Label>
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-dashed border-muted-foreground/50 hover:border-primary transition-colors">
                                        <AvatarImage src={previewUrl || undefined} />
                                        <AvatarFallback className="text-lg bg-muted">
                                            {formData.name_ar.charAt(0) || <User className="h-8 w-8 text-muted-foreground" />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isUploading ? (
                                            <Loader2 className="h-6 w-6 text-white animate-spin" />
                                        ) : (
                                            <Camera className="h-6 w-6 text-white" />
                                        )}
                                    </div>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                                <p className="text-xs text-muted-foreground text-center">
                                    {isRTL ? 'اضغط لاختيار صورة' : 'Click to select photo'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || isUploading} className="w-full sm:w-auto">
                            {isUploading
                                ? (isRTL ? 'جاري رفع الصورة...' : 'Uploading...')
                                : isSaving
                                    ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                                    : (isRTL ? 'حفظ' : 'Save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? `هل أنت متأكد من حذف المدرب "${trainerToDelete?.name_ar}"؟ لا يمكن التراجع عن هذا الإجراء.`
                                : `Are you sure you want to delete trainer "${trainerToDelete?.name_en}"? This action cannot be undone.`}
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

            {/* View Details Dialog */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'تفاصيل المدرب' : 'Trainer Details'}</DialogTitle>
                    </DialogHeader>
                    {viewTrainer && (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center text-center">
                                <Avatar className={`h-24 w-24 border-4 mb-4 ${viewTrainer.is_active ? 'border-green-500' : 'border-muted'
                                    }`}>
                                    <AvatarImage src={viewTrainer.image_url || undefined} alt={viewTrainer.name_ar} />
                                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                                        {getTrainerInitials(viewTrainer)}
                                    </AvatarFallback>
                                </Avatar>
                                <h2 className="text-xl font-bold">{isRTL ? viewTrainer.name_ar : viewTrainer.name_en}</h2>
                                <p className="text-muted-foreground">{isRTL ? viewTrainer.name_en : viewTrainer.name_ar}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-4 bg-muted/50 rounded-lg">
                                    <p className="text-2xl font-bold">{viewTrainer.courses_count || 0}</p>
                                    <p className="text-xs text-muted-foreground">{isRTL ? 'كورس' : 'Courses'}</p>
                                </div>
                                <div className="p-4 bg-muted/50 rounded-lg">
                                    <p className="text-2xl font-bold">{viewTrainer.completed_courses_count || 0}</p>
                                    <p className="text-xs text-muted-foreground">{isRTL ? 'مكتمل' : 'Completed'}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {viewTrainer.phone && (
                                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                                        <Phone className="h-5 w-5 text-muted-foreground" />
                                        <span dir="ltr" className="flex-1">{viewTrainer.phone}</span>
                                        <a href={`tel:${viewTrainer.phone}`} className="text-primary hover:underline text-sm">
                                            {isRTL ? 'اتصل' : 'Call'}
                                        </a>
                                    </div>
                                )}
                                {viewTrainer.committee_name && (
                                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                                        <Building2 className="h-5 w-5 text-muted-foreground" />
                                        <span className="flex-1">{viewTrainer.committee_name}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t mt-4">
                                <Button
                                    variant="outline"
                                    className="gap-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                    onClick={() => viewTrainer && handleExportTrainer(viewTrainer)}
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    {isRTL ? 'تصدير تقرير' : 'Export Report'}
                                </Button>

                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                                        {isRTL ? 'إغلاق' : 'Close'}
                                    </Button>
                                    <Button onClick={() => {
                                        setIsViewDialogOpen(false);
                                        openEditDialog(viewTrainer);
                                    }}>
                                        {isRTL ? 'تعديل' : 'Edit'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div >
    );
}
