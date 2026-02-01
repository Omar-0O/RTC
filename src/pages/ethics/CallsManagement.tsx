import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, PhoneCall, Calendar, Users, Check, ChevronsUpDown, Trash2, ExternalLink, Pencil, MapPin, Search, Download } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format, parseISO, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StatsCard } from '@/components/ui/stats-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ETHICS_COMMITTEE_ID = '722d7feb-0b46-48a8-8652-75c1e1a8487a';

interface EthicsCall {
    id: string;
    name: string;
    date: string;
    calls_count: number;
    drive_link: string | null;
    created_by: string;
    participants_count?: number;
    accepted_count: number;
}

interface Participant {
    id?: string;
    volunteer_id?: string;
    name: string;
    phone: string;
    is_volunteer: boolean;
    wore_vest?: boolean;
}

interface Volunteer {
    id: string;
    full_name: string;
    phone: string | null;
    avatar_url?: string | null;
}

interface EthicsCallParticipantRow {
    id: string;
    call_id: string;
    volunteer_id: string | null;
    name: string;
    phone: string | null;
    is_volunteer: boolean | null;
    created_at: string | null;
    wore_vest: boolean | null;
}

export default function CallsManagement() {
    const { user } = useAuth();
    const { t, isRTL, language } = useLanguage();

    const [calls, setCalls] = useState<EthicsCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);

    // Filter State
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        calls_count: 0,
        accepted_count: 0,
        drive_link: ''
    });

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [woreVest, setWoreVest] = useState(true);

    // Delete state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [callToDelete, setCallToDelete] = useState<EthicsCall | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

    useEffect(() => {
        fetchCalls();
        fetchVolunteers();
    }, []);

    const fetchCalls = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ethics_calls')
                .select('*, participants_count:ethics_calls_participants(count)')
                .order('date', { ascending: false });

            if (error) throw error;

            setCalls((data || []).map((c: any) => ({
                ...c,
                participants_count: c.participants_count?.[0]?.count || 0
            })));
        } catch (error) {
            console.error('Error fetching calls:', error);
            toast.error(isRTL ? 'فشل في تحميل النزولات' : 'Failed to fetch calls');
        } finally {
            setLoading(false);
        }
    };

    const fetchVolunteers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, phone, avatar_url')
            .order('full_name');
        if (data) setVolunteers(data);
    };

    // ... (Participant Handling Functions - unchanged)
    const handleAddVolunteer = (volunteerId: string) => {
        const volunteer = volunteers.find(v => v.id === volunteerId);
        if (!volunteer) return;

        if (participants.some(p => p.volunteer_id === volunteerId)) {
            toast.error(isRTL ? 'المتطوع مضاف بالفعل' : 'Volunteer already added');
            return;
        }

        setParticipants([...participants, {
            volunteer_id: volunteer.id,
            name: volunteer.full_name || '',
            phone: volunteer.phone || '',
            is_volunteer: true,
            wore_vest: woreVest
        }]);

        setOpenCombobox(false);
        setWoreVest(true); // Reset to default
    };

    const handleAddGuest = () => {
        if (!guestName) return;

        setParticipants([...participants, {
            name: guestName,
            phone: guestPhone,
            is_volunteer: false,
            wore_vest: false
        }]);

        setGuestName('');
        setGuestPhone('');
    };

    const removeParticipant = (index: number) => {
        const newParticipants = [...participants];
        newParticipants.splice(index, 1);
        setParticipants(newParticipants);
    };

    const getEthicsActivityTypeId = async () => {
        const { data } = await supabase
            .from('activity_types')
            .select('id')
            .eq('name', 'Ethics Publishing')
            .maybeSingle();

        return data?.id;
    };


    const awardPoints = async (participantsList: Participant[], callName: string) => {
        console.log('Awarding points for:', callName, participantsList);
        const activityTypeId = await getEthicsActivityTypeId();

        // Filter valid volunteers
        const validParticipants = participantsList.filter(p => p.is_volunteer && p.volunteer_id);
        console.log('Valid volunteers found:', validParticipants.length, validParticipants);

        if (!activityTypeId) {
            console.error('Ethics Publishing activity type not found');
            toast.error(isRTL ? 'خطأ: لم يتم العثور على نوع نشاط "نشر أخلاقيات"' : 'Error: "Ethics Publishing" activity type not found');
            return;
        }

        if (validParticipants.length === 0) {
            const hasVolunteers = participantsList.some(p => p.is_volunteer);
            if (hasVolunteers) {
                console.error('Volunteers found but missing IDs. Raw list:', participantsList);
                toast.error(isRTL ? 'خطأ: بيانات المتطوعين غير مكتملة' : 'Error: Volunteer data incomplete');
            } else {
                console.log('No volunteers to award points to.');
            }
            return;
        }

        const submissions = validParticipants.map(participant => {
            // Points calculation: 10 if wore_vest, 5 otherwise (or as user requested "calculate based on that")
            // I'm setting: With Vest = 10, Without Vest = 5.
            const points = participant.wore_vest ? 10 : 5;

            return {
                volunteer_id: participant.volunteer_id,
                activity_type_id: activityTypeId,
                committee_id: ETHICS_COMMITTEE_ID,
                status: 'approved' as const,
                points_awarded: points,
                submitted_at: new Date().toISOString(),
                description: `مكالمات: ${callName}`,
                wore_vest: participant.wore_vest
            };
        });

        console.log('Submitting RPC payload:', submissions);

        // Use RPC to bypass RLS issues cleanly
        const { error } = await supabase.rpc('award_ethics_call_points', {
            participants: submissions
        });

        if (error) {
            console.error('Error awarding points:', error);
            toast.error(isRTL ? `خطأ في تسجيل النقاط: ${error.message}` : `Error awarding points: ${error.message}`);
        } else {
            console.log('Points awarded successfully');
            toast.success(isRTL ? `تم تسجيل 10 أثر للمتطوعين` : `Awarded 10 points to volunteers`);
        }
    };

    const handleCreateCall = async () => {
        if (!formData.name || !formData.date) {
            toast.error(isRTL ? 'يرجى ملء البيانات الأساسية' : 'Please fill basic details');
            return;
        }

        try {
            // 1. Create Call
            const { data: call, error: callError } = await supabase
                .from('ethics_calls')
                .insert({
                    name: formData.name,
                    date: formData.date,
                    calls_count: formData.calls_count || 0,
                    accepted_count: formData.accepted_count || 0,
                    drive_link: formData.drive_link || null,
                    created_by: user?.id
                })
                .select()
                .single();

            if (callError) throw callError;

            const callData = call as any;

            // 2. Add Participants
            if (participants.length > 0) {
                const { error: partsError } = await supabase
                    .from('ethics_calls_participants')
                    .insert(participants.map(p => ({
                        call_id: callData.id,
                        volunteer_id: p.volunteer_id || null,
                        name: p.name,
                        phone: p.phone,
                        is_volunteer: p.is_volunteer,
                        wore_vest: p.wore_vest
                    })));

                if (partsError) throw partsError;

                if (participants.some(p => p.is_volunteer)) {
                    await awardPoints(participants, formData.name);
                }
            }

            toast.success(isRTL ? 'تم إنشاء النزولة بنجاح' : 'Call created successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchCalls();
        } catch (error) {
            console.error('Error creating call:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء الإنشاء' : 'Error creating call');
        }
    };

    const handleEditCall = async (call: EthicsCall) => {
        setIsEditMode(true);
        setSelectedCallId(call.id);
        setFormData({
            name: call.name,
            date: call.date,
            calls_count: call.calls_count || 0,
            accepted_count: call.accepted_count || 0,
            drive_link: call.drive_link || ''
        });

        // Fetch participants
        const { data: participantsData } = await supabase
            .from('ethics_calls_participants')
            .select('*')
            .eq('call_id', call.id);

        if (participantsData) {
            setParticipants(participantsData.map(p => ({
                id: p.id,
                volunteer_id: p.volunteer_id,
                name: p.name,
                phone: p.phone,
                is_volunteer: p.is_volunteer,
                wore_vest: p.wore_vest
            })));
        }

        setIsCreateOpen(true);
    };

    const handleUpdateCall = async () => {
        if (!formData.name || !formData.date || !selectedCallId) {
            toast.error(isRTL ? 'يرجى ملء البيانات الأساسية' : 'Please fill basic details');
            return;
        }

        try {
            // 1. Update Call Details
            const { error: updateError } = await supabase
                .from('ethics_calls')
                .update({
                    name: formData.name,
                    date: formData.date,
                    calls_count: formData.calls_count || 0,
                    accepted_count: formData.accepted_count || 0,
                    drive_link: formData.drive_link || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedCallId);

            if (updateError) throw updateError;

            // 2. Manage Participants
            const { data: existingParticipants } = await supabase
                .from('ethics_calls_participants')
                .select('*')
                .eq('call_id', selectedCallId)
                .returns<EthicsCallParticipantRow[]>();

            const currentIds = participants.filter(p => p.id).map(p => p.id);

            // Remove deleted participants
            const toRemove = existingParticipants?.filter(p => !currentIds.includes(p.id)) || [];
            if (toRemove.length > 0) {
                const removeIds = toRemove.map(p => p.id);
                await supabase.from('ethics_calls_participants').delete().in('id', removeIds);

                // Remove points for removed volunteers
                const volIdsToRemove = toRemove
                    .filter(p => p.is_volunteer && p.volunteer_id)
                    .map(p => p.volunteer_id);

                if (volIdsToRemove.length > 0) {
                    const originalCall = calls.find(c => c.id === selectedCallId);
                    const originalName = originalCall?.name || formData.name;

                    await supabase
                        .from('activity_submissions')
                        .delete()
                        .in('volunteer_id', volIdsToRemove)
                        .eq('description', `مكالمات: ${originalName}`);
                }
            }

            // Add new participants
            const toInsert = participants.filter(p => !p.id);
            if (toInsert.length > 0) {
                await supabase.from('ethics_calls_participants').insert(toInsert.map(p => ({
                    call_id: selectedCallId,
                    volunteer_id: p.volunteer_id || null,
                    name: p.name,
                    phone: p.phone,
                    is_volunteer: p.is_volunteer,
                    wore_vest: p.wore_vest
                })));

                // Award points to new volunteers
                if (toInsert.some(p => p.is_volunteer)) {
                    await awardPoints(toInsert, formData.name);
                }
            }

            toast.success(isRTL ? 'تم تحديث النزولة بنجاح' : 'Call updated successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchCalls();

        } catch (error) {
            console.error('Error updating call:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء التحديث' : 'Error updating call');
        }
    };

    const handleDeleteCall = async () => {
        if (!callToDelete) return;

        setIsDeleting(true);
        try {
            // 1. Fetch participants to specifically target their submissions
            const { data: callParticipants } = await supabase
                .from('ethics_calls_participants')
                .select('volunteer_id')
                .eq('call_id', callToDelete.id)
                .not('volunteer_id', 'is', null);

            if (callParticipants && callParticipants.length > 0) {
                const volunteerIds = callParticipants.map(p => p.volunteer_id);

                // 2. Delete related activity_submissions for these volunteers
                const { error: submissionsError } = await supabase
                    .from('activity_submissions')
                    .delete()
                    .in('volunteer_id', volunteerIds)
                    .eq('description', `مكالمات: ${callToDelete.name}`);

                if (submissionsError) {
                    console.error('Error deleting submissions:', submissionsError);
                }
            }

            // 2. Delete the call (participants will be deleted via CASCADE)
            const { error } = await supabase
                .from('ethics_calls')
                .delete()
                .eq('id', callToDelete.id);

            if (error) throw error;

            toast.success(isRTL ? 'تم حذف النزولة ومشاركات المتطوعين' : 'Call and participations deleted');
            setIsDeleteDialogOpen(false);
            setCallToDelete(null);
            fetchCalls();
        } catch (error: any) {
            console.error('Error deleting call:', error);
            toast.error(error.message || (isRTL ? 'فشل حذف النزولة' : 'Failed to delete call'));
        } finally {
            setIsDeleting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            calls_count: 0,
            accepted_count: 0,
            drive_link: ''
        });
        setParticipants([]);
        setWoreVest(true);
        setIsEditMode(false);
        setSelectedCallId(null);
    };

    const handleSave = () => {
        if (isEditMode) {
            handleUpdateCall();
        } else {
            handleCreateCall();
        }
    };

    // Filter Logic
    const currentMonth = format(new Date(), 'yyyy-MM');

    // Archive Download Logic
    const downloadCSV = (data: any[], filename: string) => {
        if (data.length === 0) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
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
        link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        toast.success(isRTL ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <Tabs defaultValue="current" className="w-full space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <PhoneCall className="h-6 w-6 text-primary" />
                            {t('ethics.calls')}
                        </h1>
                        <p className="text-muted-foreground">
                            {isRTL ? 'إدارة نزولات المكالمات وإحصائياتها' : 'Manage calls outreach and statistics'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <TabsList>
                            <TabsTrigger value="current">{isRTL ? 'الشهر الحالي' : 'Current Month'}</TabsTrigger>
                            <TabsTrigger value="archive">{isRTL ? 'الأرشيف' : 'Archive'}</TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="current" className="space-y-6">
                    {/* Header & Controls */}
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">
                            {format(new Date(), 'MMMM yyyy', { locale: isRTL ? ar : enUS })}
                        </h2>

                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                    {isRTL ? 'نزولة جديدة' : 'New Call'}
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>
                                        {isEditMode ? (isRTL ? 'تعديل النزولة' : 'Edit Call') : (isRTL ? 'إنشاء نزولة جديدة' : 'Create New Call')}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {isRTL ? 'أضف تفاصيل النزولة والمشاركين' : 'Add call details and participants'}
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-4 py-4">
                                    {/* Call Name */}
                                    <div className="grid gap-2">
                                        <Label>{isRTL ? 'اسم النزولة *' : 'Call Name *'}</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Date */}
                                        <div className="grid gap-2">
                                            <Label>{isRTL ? 'التاريخ *' : 'Date *'}</Label>
                                            <Input
                                                type="date"
                                                value={formData.date}
                                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            />
                                        </div>

                                        {/* Calls Count */}
                                        <div className="grid gap-2">
                                            <Label>{t('ethics.callsCount')}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={formData.calls_count}
                                                onChange={(e) => setFormData({ ...formData, calls_count: parseInt(e.target.value) || 0 })}
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Accepted Count */}
                                        <div className="grid gap-2">
                                            <Label>{isRTL ? 'عدد المقبولين' : 'Accepted Count'}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                value={formData.accepted_count}
                                                onChange={(e) => setFormData({ ...formData, accepted_count: parseInt(e.target.value) || 0 })}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    {/* Drive Link */}
                                    <div className="grid gap-2">
                                        <Label>{t('ethics.driveLink')} ({isRTL ? 'اختياري' : 'Optional'})</Label>
                                        <Input
                                            value={formData.drive_link}
                                            onChange={(e) => setFormData({ ...formData, drive_link: e.target.value })}
                                            placeholder="https://drive.google.com/..."
                                            dir="ltr"
                                        />
                                    </div>

                                    {/* Participants Section */}
                                    <div className="border-t pt-4 mt-2">
                                        <h4 className="font-medium mb-3">{isRTL ? 'المشاركين' : 'Participants'}</h4>

                                        {/* Add Volunteer */}
                                        <div className="space-y-3">
                                            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                                            {isRTL ? 'اختر متطوع...' : 'Select volunteer...'}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-full p-0">
                                                        <Command>
                                                            <CommandInput placeholder={isRTL ? 'بحث...' : 'Search...'} />
                                                            <CommandList>
                                                                <CommandEmpty>{isRTL ? 'لا توجد نتائج' : 'No results'}</CommandEmpty>
                                                                <CommandGroup>
                                                                    {volunteers.map((v) => (
                                                                        <CommandItem
                                                                            key={v.id}
                                                                            value={v.full_name || v.id}
                                                                            onSelect={() => handleAddVolunteer(v.id)}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <Check className={cn("mr-2 h-4 w-4", participants.some(p => p.volunteer_id === v.id) ? "opacity-100" : "opacity-0")} />
                                                                                <Avatar className="h-6 w-6">
                                                                                    <AvatarImage src={v.avatar_url || undefined} />
                                                                                    <AvatarFallback className="text-[10px]">{v.full_name?.charAt(0)}</AvatarFallback>
                                                                                </Avatar>
                                                                                {v.full_name}
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>

                                                <div className="flex w-full sm:w-auto items-center space-x-2 rtl:space-x-reverse h-10 border rounded-md px-3 bg-card/50 whitespace-nowrap">
                                                    <Switch
                                                        id="vest-toggle"
                                                        checked={woreVest}
                                                        onCheckedChange={setWoreVest}
                                                    />
                                                    <Label htmlFor="vest-toggle" className="cursor-pointer text-sm">
                                                        {isRTL ? 'ارتدى الـ Vest' : 'Wore Vest'}
                                                    </Label>
                                                </div>
                                            </div>

                                            {/* Add Guest */}
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder={isRTL ? 'اسم الضيف' : 'Guest name'}
                                                    value={guestName}
                                                    onChange={(e) => setGuestName(e.target.value)}
                                                    className="flex-1"
                                                />
                                                <Input
                                                    placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                                                    value={guestPhone}
                                                    onChange={(e) => setGuestPhone(e.target.value)}
                                                    className="w-32"
                                                />
                                                <Button type="button" variant="secondary" onClick={handleAddGuest}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Participants List */}
                                        {participants.length > 0 && (
                                            <div className="mt-4 border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                            <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                                                            <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                                                            <TableHead>{isRTL ? 'إرتدى الـvest' : 'Vest'}</TableHead>
                                                            <TableHead className="w-12"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {participants.map((p, idx) => (
                                                            <TableRow key={idx}>
                                                                <TableCell>{p.name}</TableCell>
                                                                <TableCell>{p.phone || '—'}</TableCell>
                                                                <TableCell>
                                                                    <span className={cn("text-xs px-2 py-0.5 rounded-full", p.is_volunteer ? "bg-primary/10 text-primary" : "bg-muted")}>
                                                                        {p.is_volunteer ? (isRTL ? 'متطوع' : 'Volunteer') : (isRTL ? 'ضيف' : 'Guest')}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {p.is_volunteer && (
                                                                        <div className="flex items-center space-x-2">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={p.wore_vest || false}
                                                                                onChange={(e) => {
                                                                                    const updated = [...participants];
                                                                                    updated[idx].wore_vest = e.target.checked;
                                                                                    setParticipants(updated);
                                                                                }}
                                                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button variant="ghost" size="icon" onClick={() => removeParticipant(idx)}>
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                        {isRTL ? 'إلغاء' : 'Cancel'}
                                    </Button>
                                    <Button onClick={handleSave}>
                                        {isEditMode ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'إنشاء النزولة' : 'Create Call')}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatsCard
                            title={isRTL ? 'مكالمات الشهر' : 'Monthly Calls'}
                            value={calls.filter(c => format(parseISO(c.date), 'yyyy-MM') === currentMonth).reduce((sum, c) => sum + (c.calls_count || 0), 0)}
                            icon={PhoneCall}
                            description={isRTL ? `خلال شهر ${format(new Date(), 'MMMM', { locale: isRTL ? ar : enUS })}` : `In ${format(new Date(), 'MMMM')}`}
                        />
                        <StatsCard
                            title={isRTL ? 'المكالمات المقبولة' : 'Accepted Calls'}
                            value={calls.filter(c => format(parseISO(c.date), 'yyyy-MM') === currentMonth).reduce((sum, c) => sum + (c.accepted_count || 0), 0)}
                            icon={Check}
                            description={isRTL ? `خلال شهر ${format(new Date(), 'MMMM', { locale: isRTL ? ar : enUS })}` : `In ${format(new Date(), 'MMMM')}`}
                        />
                        <StatsCard
                            title={isRTL ? 'نزولات الشهر' : 'Monthly Descents'}
                            value={calls.filter(c => format(parseISO(c.date), 'yyyy-MM') === currentMonth).length}
                            icon={MapPin}
                            description={isRTL ? `خلال شهر ${format(new Date(), 'MMMM', { locale: isRTL ? ar : enUS })}` : `In ${format(new Date(), 'MMMM')}`}
                        />
                    </div>

                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={isRTL ? 'بحث باسم النزولة...' : 'Search by call name...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Calls Grid - Current Month */}
                    {(() => {
                        const currentMonthCalls = calls.filter(call => {
                            if (!call.date) return false;
                            try {
                                return format(parseISO(call.date), 'yyyy-MM') === currentMonth;
                            } catch (e) { return false; }
                        }).filter(call => call.name.toLowerCase().includes(searchQuery.toLowerCase()));

                        if (currentMonthCalls.length === 0) {
                            return (
                                <Card className="p-8 text-center">
                                    <PhoneCall className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">
                                        {searchQuery
                                            ? (isRTL ? 'لا توجد نتائج' : 'No results found')
                                            : (isRTL ? 'لا توجد نزولات لهذا الشهر' : 'No calls for this month')}
                                    </p>
                                    {!searchQuery && (
                                        <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="mt-4">
                                            {isRTL ? 'إضافة أول نزولة' : 'Add first call'}
                                        </Button>
                                    )}
                                </Card>
                            );
                        }

                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {currentMonthCalls.map(call => (
                                    <Card key={call.id} className="hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-lg">{call.name}</CardTitle>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditCall(call)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => {
                                                            setCallToDelete(call);
                                                            setIsDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-4 w-4" />
                                                <span>{call.date}</span>
                                            </div>

                                            <div className="flex items-center gap-4 flex-wrap">
                                                <div className="flex items-center gap-2">
                                                    <PhoneCall className="h-4 w-4 text-primary" />
                                                    <span className="font-semibold">{call.calls_count || 0}</span>
                                                    <span className="text-sm text-muted-foreground">{isRTL ? 'مكالمة' : 'calls'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-blue-500" />
                                                    <span className="font-semibold">{call.participants_count || 0}</span>
                                                    <span className="text-sm text-muted-foreground">{isRTL ? 'مشارك' : 'participants'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-sm text-green-700 dark:text-green-300">
                                                    <Check className="h-3 w-3" />
                                                    <span>{isRTL ? 'المقبول:' : 'Accepted:'} {call.accepted_count || 0}/{call.calls_count || 0}</span>
                                                </div>
                                            </div>

                                            {call.drive_link && (
                                                <a
                                                    href={call.drive_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    {isRTL ? 'رابط الدرايف' : 'Drive Link'}
                                                </a>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        );
                    })()}
                </TabsContent>

                <TabsContent value="archive" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{isRTL ? 'أرشيف النزولات' : 'Calls Archive'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {(() => {
                                    const months = [];
                                    const startDate = new Date(2025, 0, 1); // Start from reasonable time
                                    const now = new Date();
                                    let currentDate = now;

                                    // Only show past months (exclusive of current month)
                                    // Or inclusive? Reports implies past months usually.
                                    // Let's match Reports.tsx loop but exclude current if desired.
                                    // Reports.tsx loop: while (currentDate >= startDate)
                                    // User said "Archive page like the one in the report".
                                    // Reports.tsx loop includes current month. I'll include it or slightly previous.
                                    // Usually archive implies past. But let's show all available months except maybe empty ones?
                                    // Let's generate months list.

                                    while (currentDate >= startDate) {
                                        months.push(new Date(currentDate));
                                        currentDate = subMonths(currentDate, 1);
                                    }

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {months.map((date, i) => {
                                                const monthStr = format(date, 'yyyy-MM');
                                                // Filter calls for this month
                                                const monthCalls = calls.filter(c => {
                                                    if (!c.date) return false;
                                                    try {
                                                        return format(parseISO(c.date), 'yyyy-MM') === monthStr;
                                                    } catch { return false; }
                                                });

                                                if (monthCalls.length === 0) return null;

                                                const callsCount = monthCalls.reduce((sum, c) => sum + (c.calls_count || 0), 0);
                                                const participantsCount = monthCalls.reduce((sum, c) => sum + (c.participants_count || 0), 0);

                                                return (
                                                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                                        <div>
                                                            <p className="font-medium">
                                                                {format(date, 'MMMM yyyy', { locale: isRTL ? ar : enUS })}
                                                            </p>
                                                            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                                                <span>{monthCalls.length} {isRTL ? 'نزولة' : 'outreaches'}</span>
                                                                <span>•</span>
                                                                <span>{callsCount} {isRTL ? 'مكالمة' : 'calls'}</span>
                                                            </div>
                                                        </div>
                                                        <Button variant="outline" size="sm" onClick={() => {
                                                            const csvData = monthCalls.map(c => ({
                                                                [isRTL ? 'النزولة' : 'Outreach']: c.name,
                                                                [isRTL ? 'التاريخ' : 'Date']: c.date,
                                                                [isRTL ? 'عدد المكالمات' : 'Calls Count']: c.calls_count,
                                                                [isRTL ? 'عدد المشاركين' : 'Participants Count']: c.participants_count,
                                                                [isRTL ? 'رابط الدرايف' : 'Drive Link']: c.drive_link || '',
                                                            }));
                                                            downloadCSV(csvData, `calls_archive_${format(date, 'yyyy_MM')}`);
                                                        }}>
                                                            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                            {isRTL ? 'تحميل' : 'Download'}
                                                        </Button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                })()}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isRTL ? 'حذف النزولة؟' : 'Delete Call?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? `هل أنت متأكد من حذف "${callToDelete?.name}"؟ سيتم حذف جميع المشاركين وإزالة نقاطهم.`
                                : `Are you sure you want to delete "${callToDelete?.name}"? All participants and their points will be removed.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCall}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRTL ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
