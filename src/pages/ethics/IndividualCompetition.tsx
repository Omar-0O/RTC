import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Search, Award, Trash2, MessageSquarePlus, User, Phone, Camera, Loader2, History, Calendar, Users, BarChart3, Trophy, Archive, Download } from 'lucide-react';
import { format, parse, subMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ar, enUS } from 'date-fns/locale';

interface Participant {
    id: string;
    name: string;
    phone: string | null;
    image_url: string | null;
    created_at: string;
    month_year?: string;
    entries_count?: number;
}

interface Entry {
    id: string;
    participant_id: string;
    description: string;
    created_at: string;
    month_year?: string;
}

// Helper to get current month in YYYY-MM format
const getCurrentMonthYear = () => format(new Date(), 'yyyy-MM');

// Helper to format month for display
const formatMonthDisplay = (monthYear: string, isRTL: boolean) => {
    try {
        const date = parse(monthYear, 'yyyy-MM', new Date());
        return format(date, 'MMMM yyyy', { locale: isRTL ? ar : enUS });
    } catch {
        return monthYear;
    }
};

export default function IndividualCompetition() {
    const { user } = useAuth();
    const { t, isRTL } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Month selection for archive
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [selectedArchiveMonth, setSelectedArchiveMonth] = useState<string>(format(subMonths(new Date(), 1), 'yyyy-MM'));

    // Stats
    const [totalEntries, setTotalEntries] = useState(0);
    const [topParticipant, setTopParticipant] = useState<Participant | null>(null);

    // Dialog states
    const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
    const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
    const [isViewEntriesOpen, setIsViewEntriesOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Form states
    const [formData, setFormData] = useState({ name: '', phone: '' });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Entry states
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [entryDescription, setEntryDescription] = useState('');
    const [participantEntries, setParticipantEntries] = useState<Entry[]>([]);
    const [participantToDelete, setParticipantToDelete] = useState<Participant | null>(null);

    useEffect(() => {
        fetchAvailableMonths();
    }, []);

    useEffect(() => {
        fetchParticipants();
    }, []);

    const fetchAvailableMonths = async () => {
        try {
            // Get distinct months from participants
            const { data: participantMonths } = await supabase
                .from('competition_participants')
                .select('month_year')
                .not('month_year', 'is', null);

            const { data: entryMonths } = await supabase
                .from('competition_entries')
                .select('month_year')
                .not('month_year', 'is', null);

            const allMonths = new Set<string>();
            allMonths.add(getCurrentMonthYear()); // Always include current month

            participantMonths?.forEach((p: any) => p.month_year && allMonths.add(p.month_year));
            entryMonths?.forEach((e: any) => e.month_year && allMonths.add(e.month_year));

            const sortedMonths = Array.from(allMonths).sort().reverse();
            setAvailableMonths(sortedMonths);

            // Set default archive month to previous month if available, otherwise first available
            const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
            if (sortedMonths.includes(prevMonth)) {
                setSelectedArchiveMonth(prevMonth);
            } else if (sortedMonths.length > 0) {
                setSelectedArchiveMonth(sortedMonths[0]);
            }

        } catch (error) {
            console.error('Error fetching available months:', error);
        }
    };

    const fetchParticipants = async (month: string = getCurrentMonthYear()) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('competition_participants')
                .select('*')
                .eq('month_year', month)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Get entries count for each participant in selected month
            const participantsWithCount = await Promise.all(
                (data || []).map(async (p: any) => {
                    const { count } = await supabase
                        .from('competition_entries')
                        .select('id', { count: 'exact', head: true })
                        .eq('participant_id', p.id)
                        .eq('month_year', month);

                    return {
                        ...p,
                        entries_count: count || 0
                    };
                })
            );

            // Sort by entries count descending
            participantsWithCount.sort((a, b) => (b.entries_count || 0) - (a.entries_count || 0));

            setParticipants(participantsWithCount);

            // Calculate stats
            const total = participantsWithCount.reduce((sum, p) => sum + (p.entries_count || 0), 0);
            setTotalEntries(total);

            if (participantsWithCount.length > 0) {
                setTopParticipant(participantsWithCount[0]);
            } else {
                setTopParticipant(null);
            }
        } catch (error) {
            console.error('Error fetching participants:', error);
            toast.error(isRTL ? 'فشل تحميل المشاركين' : 'Failed to load participants');
        } finally {
            setLoading(false);
        }
    };

    const downloadArchive = async (month: string) => {
        try {
            const { data: participantsData, error: pError } = await supabase
                .from('competition_participants')
                .select('*')
                .eq('month_year', month);

            if (pError) throw pError;

            const { data: entriesData, error: eError } = await supabase
                .from('competition_entries')
                .select('*')
                .eq('month_year', month);

            if (eError) throw eError;

            const exportData = (entriesData || []).map((entry: any) => {
                const participant = (participantsData || []).find((p: any) => p.id === entry.participant_id);
                return {
                    [isRTL ? 'الاسم' : 'Name']: participant?.name || 'Unknown',
                    [isRTL ? 'الهاتف' : 'Phone']: participant?.phone || '',
                    [isRTL ? 'الوصف' : 'Description']: entry.description,
                    [isRTL ? 'التاريخ' : 'Date']: format(new Date(entry.created_at), 'yyyy-MM-dd'),
                };
            });

            if (exportData.length === 0) {
                toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
                return;
            }

            const headers = Object.keys(exportData[0]);
            const csvContent = [
                headers.join(','),
                ...exportData.map(row => headers.map(header => {
                    const value = row[header];
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value ?? '';
                }).join(','))
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `competition_entries_${month}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);

            toast.success(isRTL ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
        } catch (error) {
            console.error('Error downloading archive:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء التصدير' : 'Error exporting data');
        }
    };

    const fetchParticipantEntries = async (participantId: string) => {
        try {
            const { data, error } = await supabase
                .from('competition_entries')
                .select('*')
                .eq('participant_id', participantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setParticipantEntries(data || []);
        } catch (error) {
            console.error('Error fetching entries:', error);
            toast.error(isRTL ? 'فشل تحميل المشاركات' : 'Failed to load entries');
        }
    };

    const handleRepairData = async () => {
        setIsSaving(true);
        try {
            // Fix Participants
            const { data: participantsToFix } = await supabase
                .from('competition_participants')
                .select('id, created_at')
                .is('month_year', null);

            if (participantsToFix && participantsToFix.length > 0) {
                for (const p of participantsToFix) {
                    const month = format(new Date(p.created_at), 'yyyy-MM');
                    await supabase
                        .from('competition_participants')
                        .update({ month_year: month })
                        .eq('id', p.id);
                }
            }

            // Fix Entries
            const { data: entriesToFix } = await supabase
                .from('competition_entries')
                .select('id, created_at')
                .is('month_year', null);

            if (entriesToFix && entriesToFix.length > 0) {
                for (const e of entriesToFix) {
                    const month = format(new Date(e.created_at), 'yyyy-MM');
                    await supabase
                        .from('competition_entries')
                        .update({ month_year: month })
                        .eq('id', e.id);
                }
            }

            toast.success(isRTL ? 'تم إصلاح البيانات بنجاح' : 'Data repaired successfully');
            await fetchAvailableMonths();
            fetchParticipants();

        } catch (error) {
            console.error('Error repairing data:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء إصلاح البيانات' : 'Error repairing data');
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error(isRTL ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
        setImageFile(file);
    };

    const resetForm = () => {
        setFormData({ name: '', phone: '' });
        setImageFile(null);
        setPreviewUrl(null);
    };

    const handleAddParticipant = async () => {
        if (!formData.name.trim()) {
            toast.error(isRTL ? 'يرجى إدخال اسم المشارك' : 'Please enter participant name');
            return;
        }

        setIsSaving(true);
        try {
            let imageUrl = null;

            // Upload image if selected
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop() || 'jpg';
                const fileName = `competition_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(`competition/${fileName}`, imageFile, { upsert: true });

                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`competition/${fileName}`);
                    imageUrl = urlData.publicUrl;
                }
            }

            const { error } = await supabase
                .from('competition_participants')
                .insert({
                    name: formData.name.trim(),
                    phone: formData.phone.trim() || null,
                    image_url: imageUrl,
                    created_by: user?.id,
                    month_year: getCurrentMonthYear()
                });

            if (error) throw error;

            toast.success(isRTL ? 'تم إضافة المشارك بنجاح' : 'Participant added successfully');
            setIsAddParticipantOpen(false);
            resetForm();
            fetchParticipants();
            fetchAvailableMonths();
        } catch (error) {
            console.error('Error adding participant:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء الإضافة' : 'Error adding participant');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddEntry = async () => {
        if (!selectedParticipant || !entryDescription.trim()) {
            toast.error(isRTL ? 'يرجى كتابة وصف المشاركة' : 'Please enter entry description');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('competition_entries')
                .insert({
                    participant_id: selectedParticipant.id,
                    description: entryDescription.trim(),
                    created_by: user?.id,
                    month_year: getCurrentMonthYear()
                });

            if (error) throw error;

            toast.success(isRTL ? 'تم تسجيل المشاركة بنجاح' : 'Entry added successfully');
            setIsAddEntryOpen(false);
            setEntryDescription('');
            setSelectedParticipant(null);
            fetchParticipants();
        } catch (error) {
            console.error('Error adding entry:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء التسجيل' : 'Error adding entry');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteParticipant = async () => {
        if (!participantToDelete) return;

        try {
            const { error } = await supabase
                .from('competition_participants')
                .delete()
                .eq('id', participantToDelete.id);

            if (error) throw error;

            toast.success(isRTL ? 'تم حذف المشارك بنجاح' : 'Participant deleted successfully');
            setIsDeleteDialogOpen(false);
            setParticipantToDelete(null);
            fetchParticipants();
        } catch (error) {
            console.error('Error deleting participant:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء الحذف' : 'Error deleting participant');
        }
    };

    const openViewEntries = async (participant: Participant) => {
        setSelectedParticipant(participant);
        await fetchParticipantEntries(participant.id);
        setIsViewEntriesOpen(true);
    };

    const openAddEntry = (participant: Participant) => {
        setSelectedParticipant(participant);
        setEntryDescription('');
        setIsAddEntryOpen(true);
    };

    const filteredParticipants = participants.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone && p.phone.includes(searchQuery))
    );

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const [activeTab, setActiveTab] = useState('current');

    // ... existing code ...

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (value === 'archive') {
            fetchParticipants(selectedArchiveMonth);
        } else {
            fetchParticipants(getCurrentMonthYear());
        }
    };

    if (loading && !participants.length && !availableMonths.length) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Award className="h-6 w-6 text-primary" />
                            {t('ethics.competition')}
                        </h1>
                        <p className="text-muted-foreground">
                            {isRTL ? 'إدارة المشاركين وتسجيل المشاركات' : 'Manage participants and log entries'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TabsList>
                            <TabsTrigger value="current" onClick={() => fetchParticipants(getCurrentMonthYear())}>{isRTL ? 'الشهر الحالي' : 'Current Month'}</TabsTrigger>
                            <TabsTrigger value="archive" onClick={() => fetchParticipants(selectedArchiveMonth)}>{isRTL ? 'الأرشيف' : 'Archive'}</TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="current" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">
                            {format(new Date(), 'MMMM yyyy', { locale: isRTL ? ar : enUS })}
                        </h2>
                        <Button onClick={() => setIsAddParticipantOpen(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            {t('ethics.addParticipant')}
                        </Button>
                    </div>

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{isRTL ? 'عدد المشاركين' : 'Participants'}</p>
                                    <p className="text-2xl font-bold">{participants.length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                                    <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي المشاركات' : 'Total Entries'}</p>
                                    <p className="text-2xl font-bold">{totalEntries}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                                    <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{isRTL ? 'أكثر مشارك' : 'Top Participant'}</p>
                                    {topParticipant ? (
                                        <p className="text-lg font-bold truncate">{topParticipant.name} ({topParticipant.entries_count})</p>
                                    ) : (
                                        <p className="text-muted-foreground">-</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={isRTL ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Participants Grid */}
                    {filteredParticipants.length === 0 ? (
                        <Card className="p-8 text-center">
                            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                {searchQuery
                                    ? (isRTL ? 'لا توجد نتائج' : 'No results found')
                                    : (isRTL ? 'لا يوجد مشاركين مسجلين' : 'No participants registered')}
                            </p>
                            {!searchQuery && (
                                <Button onClick={() => setIsAddParticipantOpen(true)} variant="outline" className="mt-4">
                                    {isRTL ? 'إضافة أول مشارك' : 'Add first participant'}
                                </Button>
                            )}
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredParticipants.map((participant, index) => (
                                <Card key={participant.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            <div className="relative">
                                                <Avatar className="h-14 w-14">
                                                    <AvatarImage src={participant.image_url || undefined} alt={participant.name} />
                                                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                                                        {getInitials(participant.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {index === 0 && (participant.entries_count || 0) > 0 && (
                                                    <Trophy className="absolute -top-1 -right-1 h-5 w-5 text-amber-500" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-lg leading-tight truncate">{participant.name}</h3>
                                                {participant.phone && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                        <Phone className="h-3 w-3" />
                                                        {participant.phone}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-1 mt-2">
                                                    <Award className="h-4 w-4 text-amber-500" />
                                                    <span className="font-semibold text-lg">{participant.entries_count || 0}</span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {isRTL ? 'مشاركة' : 'entries'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 mt-4 pt-4 border-t">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="flex-1 gap-1"
                                                onClick={() => openAddEntry(participant)}
                                            >
                                                <MessageSquarePlus className="h-4 w-4" />
                                                {isRTL ? 'تسجيل' : 'Log'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 gap-1"
                                                onClick={() => openViewEntries(participant)}
                                            >
                                                <History className="h-4 w-4" />
                                                {isRTL ? 'السجل' : 'History'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => {
                                                    setParticipantToDelete(participant);
                                                    setIsDeleteDialogOpen(true);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="archive" className="space-y-6">
                    {availableMonths.length === 0 ? (
                        <Card className="p-8 text-center bg-muted/50">
                            <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-muted-foreground">
                                {isRTL ? 'لا يوجد أرشيف حتى الآن' : 'No archive available yet'}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-2 mb-4">
                                {isRTL
                                    ? 'سيتم ترحيل البيانات تلقائياً بنهاية الشهر'
                                    : 'Data will be automatically archived at the end of the month'}
                            </p>
                            <Button variant="secondary" size="sm" onClick={handleRepairData} disabled={isSaving}>
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRTL ? 'إصلاح البيانات القديمة' : 'Repair Old Data')}
                            </Button>
                        </Card>
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <Select value={selectedArchiveMonth} onValueChange={(val) => {
                                        setSelectedArchiveMonth(val);
                                        fetchParticipants(val);
                                    }}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder={isRTL ? 'اختر الشهر' : 'Select Month'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableMonths.map(month => (
                                                <SelectItem key={month} value={month}>
                                                    {formatMonthDisplay(month, isRTL)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" onClick={() => downloadArchive(selectedArchiveMonth)}>
                                    <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                    {isRTL ? 'تصدير' : 'Export'}
                                </Button>

                            </div>

                            {/* Statistics Cards (Archive) */}


                            {/* Search Archive */}
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={isRTL ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            {/* Participants Grid (Archive) */}
                            {filteredParticipants.length === 0 ? (
                                <Card className="p-8 text-center">
                                    <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">
                                        {isRTL ? 'لا توجد بيانات لهذا الشهر' : 'No data for this month'}
                                    </p>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredParticipants.map((participant, index) => (
                                        <Card key={participant.id} className="hover:shadow-md transition-shadow opacity-75 hover:opacity-100">
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="relative">
                                                        <Avatar className="h-14 w-14">
                                                            <AvatarImage src={participant.image_url || undefined} alt={participant.name} />
                                                            <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                                                {getInitials(participant.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {index === 0 && (participant.entries_count || 0) > 0 && (
                                                            <Trophy className="absolute -top-1 -right-1 h-5 w-5 text-amber-500" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-lg leading-tight truncate">{participant.name}</h3>
                                                        {participant.phone && (
                                                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                                <Phone className="h-3 w-3" />
                                                                {participant.phone}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-1 mt-2">
                                                            <Award className="h-4 w-4 text-amber-500" />
                                                            <span className="font-semibold text-lg">{participant.entries_count || 0}</span>
                                                            <span className="text-sm text-muted-foreground">
                                                                {isRTL ? 'مشاركة' : 'entries'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 mt-4 pt-4 border-t">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full gap-1"
                                                        onClick={() => openViewEntries(participant)}
                                                    >
                                                        <History className="h-4 w-4" />
                                                        {isRTL ? 'السجل' : 'History'}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </TabsContent>
            </Tabs>

            {/* Add Participant Dialog */}
            <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('ethics.addParticipant')}</DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'أدخل بيانات المشارك الجديد' : 'Enter new participant details'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Image Upload */}
                        <div className="flex justify-center">
                            <div
                                className="relative cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Avatar className="h-24 w-24">
                                    <AvatarImage src={previewUrl || undefined} />
                                    <AvatarFallback className="bg-muted">
                                        <Camera className="h-8 w-8 text-muted-foreground" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Camera className="h-6 w-6 text-white" />
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="name">{isRTL ? 'الاسم *' : 'Name *'}</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder={isRTL ? 'اسم المشارك' : 'Participant name'}
                                dir={isRTL ? 'rtl' : 'ltr'}
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
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsAddParticipantOpen(false); resetForm(); }}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleAddParticipant} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isRTL ? 'إضافة' : 'Add'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Entry Dialog */}
            <Dialog open={isAddEntryOpen} onOpenChange={setIsAddEntryOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('ethics.addEntry')}</DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? `تسجيل مشاركة جديدة لـ ${selectedParticipant?.name}`
                                : `Log new entry for ${selectedParticipant?.name}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>{isRTL ? 'ماذا فعل؟ *' : 'What did they do? *'}</Label>
                            <Textarea
                                value={entryDescription}
                                onChange={(e) => setEntryDescription(e.target.value)}
                                placeholder={isRTL ? 'اكتب وصف المشاركة...' : 'Describe what they did...'}
                                rows={4}
                                dir={isRTL ? 'rtl' : 'ltr'}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddEntryOpen(false)}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleAddEntry} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isRTL ? 'تسجيل' : 'Log Entry'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Entries Dialog */}
            <Dialog open={isViewEntriesOpen} onOpenChange={setIsViewEntriesOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            {isRTL ? `سجل مشاركات ${selectedParticipant?.name}` : `${selectedParticipant?.name}'s Entry History`}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        {participantEntries.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                {isRTL ? 'لا توجد مشاركات مسجلة' : 'No entries recorded'}
                            </p>
                        ) : (
                            participantEntries.map((entry, index) => (
                                <div key={entry.id} className="border rounded-lg p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                                                {participantEntries.length - index}
                                            </span>
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(entry.created_at), 'yyyy/MM/dd - h:mm a')}
                                        </div>
                                        {entry.month_year && entry.month_year !== getCurrentMonthYear() && (
                                            <Badge variant="secondary" className="text-xs">
                                                {formatMonthDisplay(entry.month_year, isRTL)}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="mt-2 text-sm">{entry.description}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsViewEntriesOpen(false)}>
                            {isRTL ? 'إغلاق' : 'Close'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isRTL ? 'حذف المشارك؟' : 'Delete Participant?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? `هل أنت متأكد من حذف "${participantToDelete?.name}"؟ سيتم حذف جميع مشاركاته أيضاً.`
                                : `Are you sure you want to delete "${participantToDelete?.name}"? All their entries will also be deleted.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteParticipant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isRTL ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
