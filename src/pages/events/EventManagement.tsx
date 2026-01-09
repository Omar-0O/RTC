import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';
import { Plus, Calendar, Clock, MapPin, Users, Check, ChevronsUpDown, Trash2, Sparkles, Download, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Event {
    id: string;
    name: string;
    type: string;
    location: string;
    date: string;
    time: string | null;
    description: string | null;
    created_by: string;
    participants_count?: number;
}

interface Participant {
    id?: string;
    volunteer_id?: string;
    name: string;
    phone: string;
    is_volunteer: boolean;
}

interface Volunteer {
    id: string;
    full_name: string;
    phone: string | null;
    avatar_url?: string | null;
}

export default function EventManagement() {
    const { user } = useAuth();
    const { t, language, isRTL } = useLanguage();

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        location: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '',
        description: ''
    });

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    // Delete state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [eventsCommitteeId, setEventsCommitteeId] = useState<string | null>(null);

    useEffect(() => {
        fetchEvents();
        fetchVolunteers();
        fetchEventsCommittee();
    }, []);

    const filteredEvents = events.filter(event => {
        const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDate = filterDate ? event.date === filterDate : true;
        return matchesSearch && matchesDate;
    });

    const fetchEventsCommittee = async () => {
        const { data } = await supabase
            .from('committees')
            .select('id')
            .ilike('name', 'Events') // Match name or adjust if different
            .maybeSingle();
        if (data) setEventsCommitteeId(data.id);
    };

    const fetchEvents = async () => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select(`
                    *,
                    event_participants (count)
                `)
                .order('date', { ascending: false });

            if (error) throw error;

            const eventsData = data?.map((event: any) => ({
                ...event,
                participants_count: event.event_participants?.[0]?.count || 0
            })) || [];

            setEvents(eventsData);
        } catch (error) {
            console.error('Error fetching events:', error);
            toast.error(isRTL ? 'فشل تحميل الإيفينتات' : 'Failed to load events');
        } finally {
            setLoading(false);
        }
    };

    const fetchVolunteers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, phone, avatar_url')
            .order('full_name');

        if (data) {
            setVolunteers(data.map((p: any) => ({
                id: p.id,
                full_name: p.full_name || 'Unknown',
                phone: p.phone,
                avatar_url: p.avatar_url
            })));
        }
    };

    const ensureEventActivityType = async () => {
        const { data } = await supabase
            .from('activity_types')
            .select('id')
            .ilike('name', 'Event')
            .maybeSingle();

        return data?.id;
    };

    const handleAddVolunteer = (volunteerId: string) => {
        const volunteer = volunteers.find(v => v.id === volunteerId);
        if (!volunteer) return;

        if (participants.some(p => p.volunteer_id === volunteerId)) {
            toast.error(isRTL ? 'المتطوع مضاف بالفعل' : 'Volunteer already added');
            return;
        }

        setParticipants([...participants, {
            volunteer_id: volunteer.id,
            name: volunteer.full_name,
            phone: volunteer.phone || '',
            is_volunteer: true
        }]);
        setOpenCombobox(false);
    };

    const handleAddGuest = () => {
        if (!guestName) return;

        setParticipants([...participants, {
            name: guestName,
            phone: guestPhone,
            is_volunteer: false
        }]);
        setGuestName('');
        setGuestPhone('');
    };

    const removeParticipant = (index: number) => {
        const newParticipants = [...participants];
        newParticipants.splice(index, 1);
        setParticipants(newParticipants);
    };

    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const handleEditEvent = async (event: Event) => {
        setLoading(true);
        try {
            // Fetch full participant details for this event
            const { data: parts, error } = await supabase
                .from('event_participants')
                .select('*')
                .eq('event_id', event.id);

            if (error) throw error;

            setFormData({
                name: event.name,
                type: event.type,
                location: event.location,
                date: event.date,
                time: event.time || '',
                description: event.description || ''
            });

            setParticipants((parts || []).map((p: any) => ({
                id: p.id, // Keep ID to track existing
                volunteer_id: p.volunteer_id,
                name: p.name,
                phone: p.phone,
                is_volunteer: p.is_volunteer
            })));

            setSelectedEventId(event.id);
            setIsEditMode(true);
            setIsCreateOpen(true);
        } catch (error) {
            console.error('Error fetching event details:', error);
            toast.error(isRTL ? 'فشل تحميل تفاصيل الإيفينت' : 'Failed to load event details');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEvent = async () => {
        if (!formData.name || !formData.date || !formData.location || !formData.type) {
            toast.error(isRTL ? 'يرجى ملء البيانات الأساسية' : 'Please fill basic details');
            return;
        }

        try {
            // 1. Create Event
            const { data: event, error: eventError } = await supabase
                .from('events')
                .insert({
                    name: formData.name,
                    type: formData.type,
                    location: formData.location,
                    date: formData.date,
                    time: formData.time || null,
                    description: formData.description || null,
                    created_by: user?.id
                })
                .select()
                .single();

            if (eventError) throw eventError;

            const eventData = event as any;

            // 2. Add Participants & Award Points
            if (participants.length > 0) {
                const { error: partsError } = await supabase
                    .from('event_participants' as any)
                    .insert(participants.map(p => ({
                        event_id: eventData.id,
                        volunteer_id: p.volunteer_id || null,
                        name: p.name,
                        phone: p.phone,
                        is_volunteer: p.is_volunteer
                    })));

                if (partsError) throw partsError;

                // Award Points for Volunteers
                const volunteerParticipants = participants.filter(p => p.is_volunteer && p.volunteer_id);
                if (volunteerParticipants.length > 0) {
                    const activityTypeId = await ensureEventActivityType();
                    // Fallback to first available committee if 'Events' not found, or user's committee?
                    // Ideally should be 'Events' committee. If not found, using first one as fallback to avoid crash, 
                    // requires better handling but for now assuming it exists or preventing insert if critical.
                    // Using Optional Chaining or default to avoid hard crash, but DB will reject if null.
                    // Let's rely on eventCommitteeId being present.

                    const targetCommitteeId = eventsCommitteeId || (await supabase.from('committees').select('id').limit(1).single()).data?.id;

                    if (activityTypeId && targetCommitteeId) {
                        const submissions = volunteerParticipants.map(p => ({
                            volunteer_id: p.volunteer_id,
                            activity_type_id: activityTypeId,
                            committee_id: targetCommitteeId,
                            status: 'approved' as const,
                            points_awarded: 5,
                            submitted_at: new Date().toISOString(),
                            description: `Event: ${formData.name}`,
                        }));

                        const { error: pointsError } = await supabase
                            .from('activity_submissions')
                            .insert(submissions);

                        if (pointsError) {
                            console.error('Error awarding points:', pointsError);
                            toast.error(isRTL ? 'تم إنشاء الإيفينت ولكن فشل تسجيل النقاط' : 'Event created but failed to award points');
                        } else {
                            toast.success(isRTL ? 'تم تسجيل 5 نقاط للمتطوعين' : 'Awarded 5 points to volunteers');
                        }
                    } else {
                        console.warn('Could not award points: Missing activity type or committee ID');
                    }
                }
            }

            toast.success(isRTL ? 'تم إنشاء الإيفينت بنجاح' : 'Event created successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchEvents();
        } catch (error) {
            console.error('Error creating event:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء إنشاء الإيفينت' : 'Error creating event');
        }
    };

    const handleUpdateEvent = async () => {
        if (!selectedEventId || !formData.name || !formData.date || !formData.location) {
            toast.error(isRTL ? 'يرجى ملء البيانات الأساسية' : 'Please fill basic details');
            return;
        }

        try {
            // 1. Update Event Details
            const { error: updateError } = await supabase
                .from('events')
                .update({
                    name: formData.name,
                    type: formData.type,
                    location: formData.location,
                    date: formData.date,
                    time: formData.time || null,
                    description: formData.description || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedEventId);

            if (updateError) throw updateError;

            // 2. Manage Participants
            // Fetch existing to compare
            const { data: existingPartsType } = await supabase
                .from('event_participants')
                .select('id, volunteer_id, is_volunteer')
                .eq('event_id', selectedEventId);

            const existingParts = existingPartsType as any[] || [];

            // Identify Added, Removed, Kept
            const currentParticipantIds = participants.filter(p => p.id).map(p => p.id); // IDs of those still in the list
            const existingIds = existingParts.map(p => p.id);

            const toRemove = existingParts.filter(p => !currentParticipantIds.includes(p.id));
            const toAdd = participants.filter(p => !p.id); // No ID means new

            // Remove deleted participants
            if (toRemove.length > 0) {
                const removeIds = toRemove.map(p => p.id);
                await supabase.from('event_participants').delete().in('id', removeIds);

                // Remove points (activity_submissions) for removed volunteers
                const volIdsToRemove = toRemove
                    .filter(p => p.is_volunteer && p.volunteer_id)
                    .map(p => p.volunteer_id);

                if (volIdsToRemove.length > 0) {
                    // Use the original event name to find submissions to delete
                    const originalEvent = events.find(e => e.id === selectedEventId);
                    const originalEventName = originalEvent?.name || formData.name;

                    // Cleanup based on standard description format "Event: <EventName>"
                    const { error: deletePointsError } = await supabase
                        .from('activity_submissions')
                        .delete()
                        .in('volunteer_id', volIdsToRemove)
                        .eq('description', `Event: ${originalEventName}`);

                    if (deletePointsError) {
                        console.error('Error removing points for removed participants:', deletePointsError);
                    }
                }
            }

            // Add new participants
            if (toAdd.length > 0) {
                const { data: newParts, error: addError } = await supabase
                    .from('event_participants')
                    .insert(toAdd.map(p => ({
                        event_id: selectedEventId,
                        volunteer_id: p.volunteer_id || null,
                        name: p.name,
                        phone: p.phone,
                        is_volunteer: p.is_volunteer
                    })))
                    .select();

                if (addError) throw addError;

                // Award points for NEW volunteers
                const newVolunteers = toAdd.filter(p => p.is_volunteer && p.volunteer_id);
                if (newVolunteers.length > 0) {
                    const activityTypeId = await ensureEventActivityType();
                    // Use stored committee ID or fallback
                    const targetCommitteeId = eventsCommitteeId || (await supabase.from('committees').select('id').limit(1).single()).data?.id;

                    if (activityTypeId && targetCommitteeId) {
                        const submissions = newVolunteers.map(p => ({
                            volunteer_id: p.volunteer_id,
                            activity_type_id: activityTypeId,
                            committee_id: targetCommitteeId,
                            status: 'approved' as const,
                            points_awarded: 5,
                            submitted_at: new Date().toISOString(),
                            description: `Event: ${formData.name}`,
                        }));
                        await supabase.from('activity_submissions').insert(submissions);
                        toast.success(isRTL ? `تم إضافة ${newVolunteers.length} نقاط جديدة` : `Awarded points to ${newVolunteers.length} new volunteers`);
                    }
                }
            }

            toast.success(isRTL ? 'تم تحديث الإيفينت بنجاح' : 'Event updated successfully');
            setIsCreateOpen(false);
            setIsEditMode(false);
            setSelectedEventId(null);
            resetForm();
            fetchEvents();

        } catch (error) {
            console.error('Error updating event:', error);
            toast.error(isRTL ? 'فشل تحديث الإيفينت' : 'Failed to update event');
        }
    };

    const handleSave = () => {
        if (isEditMode) {
            handleUpdateEvent();
        } else {
            handleCreateEvent();
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: '',
            location: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            time: '',
            description: ''
        });
        setParticipants([]);
        setIsEditMode(false);
        setSelectedEventId(null);
    };

    const handleExportAllEvents = () => {
        if (events.length === 0) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }

        const data = events.map(e => ({
            [isRTL ? 'الاسم' : 'Event Name']: e.name,
            [isRTL ? 'النوع' : 'Type']: e.type,
            [isRTL ? 'التاريخ' : 'Date']: e.date,
            [isRTL ? 'الوقت' : 'Time']: formatTime(e.time),
            [isRTL ? 'المكان' : 'Location']: e.location,
            [isRTL ? 'عدد المشاركين' : 'Participants Count']: e.participants_count,
            [isRTL ? 'الوصف' : 'Description']: e.description || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Events");
        XLSX.writeFile(wb, `Events_List_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast.success(isRTL ? 'تم تصدير كل الايفينتات بنجاح' : 'All events exported successfully');
    };

    const handleExportSingleEvent = async (event: Event) => {
        try {
            // Fetch participants
            const { data: participantsData, error } = await supabase
                .from('event_participants')
                .select('*')
                .eq('event_id', event.id);

            if (error) throw error;

            // Prepare Data for Sheet
            // 1. Event Info Header
            const eventInfo = [
                [isRTL ? 'اسم الايفينت' : 'Event Name', event.name],
                [isRTL ? 'التاريخ' : 'Date', event.date],
                [isRTL ? 'الوقت' : 'Time', formatTime(event.time)],
                [isRTL ? 'المكان' : 'Location', event.location],
                [isRTL ? 'النوع' : 'Type', event.type],
                [], // Empty row
                [isRTL ? 'قائمة المشاركين' : 'Participants List']
            ];

            // 2. Participants Table
            const participantsList = (participantsData || []).map(p => ({
                [isRTL ? 'الاسم' : 'Name']: p.name,
                [isRTL ? 'الهاتف' : 'Phone']: p.phone ? `'${p.phone}` : '', // Force string format
                [isRTL ? 'النوع' : 'Type']: p.is_volunteer ? (isRTL ? 'متطوع' : 'Volunteer') : (isRTL ? 'ضيف' : 'Guest'),
                [isRTL ? 'كود التطوع' : 'Volunteer ID']: p.volunteer_id || ''
            }));

            // Create Worksheet
            const ws = XLSX.utils.aoa_to_sheet(eventInfo);

            // Append participants starting from row 8 (index 7)
            XLSX.utils.sheet_add_json(ws, participantsList, { origin: "A8" });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Event Details");
            XLSX.writeFile(wb, `${event.name.replace(/[^a-z0-9]/gi, '_')}_Details.xlsx`);
            toast.success(isRTL ? 'تم تصدير تفاصيل الايفينت بنجاح' : 'Event details exported successfully');

        } catch (error) {
            console.error('Error exporting event:', error);
            toast.error(isRTL ? 'فشل تصدير تفاصيل الايفينت' : 'Failed to export event details');
        }
    };

    const handleDeleteEvent = async () => {
        if (!eventToDelete) return;

        setIsDeleting(true);
        try {
            // 1. Delete related activity_submissions
            const { error: submissionsError } = await supabase
                .from('activity_submissions')
                .delete()
                .ilike('description', `Event: ${eventToDelete.name}`);

            if (submissionsError) {
                console.error('Error deleting event submissions:', submissionsError);
            }

            // 2. Delete the event (event_participants will be deleted via CASCADE)
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', eventToDelete.id);

            if (error) throw error;

            toast.success(isRTL ? 'تم حذف الإيفينت ومشاركات المتطوعين' : 'Event and participations deleted');
            setIsDeleteDialogOpen(false);
            setEventToDelete(null);
            fetchEvents();
        } catch (error: any) {
            console.error('Error deleting event:', error);
            toast.error(error.message || (isRTL ? 'فشل حذف الإيفينت' : 'Failed to delete event'));
        } finally {
            setIsDeleting(false);
        }
    };

    const formatTime = (timeStr: string | null) => {
        if (!timeStr) return '';
        try {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes);
            return format(date, 'h:mm a');
        } catch {
            return timeStr;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Sparkles className="h-7 w-7" />
                        {isRTL ? 'إدارة الإيفينتات' : 'Event Management'}
                    </h1>
                    <p className="text-muted-foreground">{isRTL ? 'إنشاء وإدارة الإيفينتات' : 'Create and manage events'}</p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {isRTL ? 'إيفينت جديد' : 'New Event'}
                        </Button>
                    </DialogTrigger>

                    <Button variant="outline" onClick={handleExportAllEvents}>
                        <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {isRTL ? 'تصدير الكل' : 'Export All'}
                    </Button>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{isEditMode ? (isRTL ? 'تعديل الإيفينت' : 'Edit Event') : (isRTL ? 'إنشاء إيفينت جديد' : 'Create New Event')}</DialogTitle>
                            <DialogDescription>{isRTL ? 'أضف تفاصيل الإيفينت والمشاركين' : 'Add event details and participants'}</DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            {/* Event Name */}
                            <div className="grid gap-2">
                                <Label>{isRTL ? 'اسم الإيفينت' : 'Event Name'} *</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={isRTL ? 'اسم الإيفينت' : 'Event Name'}
                                />
                            </div>

                            {/* Event Type - Free Text */}
                            <div className="grid gap-2">
                                <Label>{isRTL ? 'نوع الإيفينت' : 'Event Type'} *</Label>
                                <Input
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    placeholder={isRTL ? 'مثال: ورشة عمل، محاضرة، مسابقة...' : 'e.g., Workshop, Lecture, Competition...'}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Date */}
                                <div className="grid gap-2">
                                    <Label>{isRTL ? 'التاريخ' : 'Date'} *</Label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>

                                {/* Time */}
                                <div className="grid gap-2">
                                    <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
                                    <Input
                                        type="time"
                                        value={formData.time}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Location */}
                            <div className="grid gap-2">
                                <Label>{isRTL ? 'المكان' : 'Location'} *</Label>
                                <Input
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder={isRTL ? 'مكان الإيفينت' : 'Event Location'}
                                />
                            </div>

                            {/* Description */}
                            <div className="grid gap-2">
                                <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={isRTL ? 'وصف الإيفينت (اختياري)' : 'Event description (optional)'}
                                    rows={3}
                                />
                            </div>

                            {/* Participants Section */}
                            <div className="border-t pt-4 mt-2">
                                <h4 className="font-medium mb-3">{isRTL ? 'المشاركين' : 'Participants'}</h4>

                                {/* Add Volunteer */}
                                <div className="space-y-3">
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

                                    {/* Add Guest */}
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={isRTL ? 'اسم الضيف (ثلاثي)' : 'Guest name (tripartite)'}
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
                                {isEditMode ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'إنشاء الإيفينت' : 'Create Event')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-sm">
                    <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground rtl:right-2.5 rtl:left-auto" />
                    <Input
                        placeholder={isRTL ? 'بحث باسم الإيفينت...' : 'Search event name...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 rtl:pr-9 rtl:pl-4"
                    />
                </div>
                <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-auto"
                />
            </div>

            {/* Events Grid */}
            {filteredEvents.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">{isRTL ? 'لا توجد إيفينتات تطابق بحثك' : 'No events match your search'}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEvents.map(event => (
                        <Card key={event.id} className="relative group">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{event.name}</CardTitle>
                                        <CardDescription>{event.type}</CardDescription>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary"
                                        onClick={() => handleEditEvent(event)}
                                        title={isRTL ? 'تعديل' : 'Edit'}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary"
                                        onClick={() => handleExportSingleEvent(event)}
                                        title={isRTL ? 'تصدير التفاصيل' : 'Export Details'}
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                        onClick={() => {
                                            setEventToDelete(event);
                                            setIsDeleteDialogOpen(true);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span>{format(new Date(event.date), 'PPP')}</span>
                                </div>
                                {event.time && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>{formatTime(event.time)}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span>{event.location}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Users className="h-4 w-4" />
                                    <span>{event.participants_count || 0} {isRTL ? 'مشارك' : 'participants'}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'حذف الإيفينت؟' : 'Delete Event?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? `هل أنت متأكد من حذف "${eventToDelete?.name}"؟ سيتم حذف المشاركات المرتبطة أيضاً.`
                                : `Are you sure you want to delete "${eventToDelete?.name}"? Associated participations will also be deleted.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteEvent}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (isRTL ? 'جاري الحذف...' : 'Deleting...') : (isRTL ? 'حذف' : 'Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
