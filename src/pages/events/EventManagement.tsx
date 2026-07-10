import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
    getEventCommittees,
    getEventSummaries,
    getEventsCommitteeId,
    getEventVolunteers,
    type EventCommittee,
    type EventParticipant,
    type EventSummary,
    type EventVolunteer,
} from '@/services/events.service';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Calendar, Clock, MapPin, Users, Check, ChevronsUpDown, Trash2, Sparkles, Download, Pencil, Mic, UserPlus, Link as LinkIcon, Activity, FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CACHE_TTL, getLocalCache, setLocalCache } from '@/utils/localCache';
import { exportEventDetailsToXlsx, exportEventsListToXlsx } from '@/utils/eventExport';

type Committee = EventCommittee;
type Event = EventSummary;
type Participant = EventParticipant;
type Volunteer = EventVolunteer;

interface Speaker {
    id?: string;
    name: string;
    phone: string;
    social_media_link: string;
}

interface EventOrganizer {
    id?: string;
    volunteer_id: string;
    volunteer_name?: string;
}

interface EventBeneficiary {
    id?: string;
    name: string;
    phone: string;
}

type Tables = Database['public']['Tables'];
type EventBeneficiaryInsert = Tables['event_beneficiaries']['Insert'];
type EventOrganizerInsert = Tables['event_organizers']['Insert'];
type EventParticipantInsert = Tables['event_participants']['Insert'];
type EventSpeakerInsert = Tables['event_speakers']['Insert'];

type EventOrganizerWithProfile = Tables['event_organizers']['Row'] & {
    profiles?: { full_name: string | null } | null;
};

const getErrorMessage = (error: unknown, fallback = 'Error occurred') =>
    error instanceof Error ? error.message : fallback;

const isEventCache = (value: unknown): value is Event[] => Array.isArray(value);

export default function EventManagement() {
    const { user, hasRole, primaryRole } = useAuth();
    const { t, language, isRTL } = useLanguage();
    const { activeBranch, canViewAllBranches } = useBranch();

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
    const [committees, setCommittees] = useState<Committee[]>([]);
    const committeesRef = useRef<Committee[]>([]);

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
        description: '',
        committee_id: ''
    });

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    // Speakers state
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [newSpeaker, setNewSpeaker] = useState<Speaker>({ name: '', phone: '', social_media_link: '' });

    // Organizers state
    const [organizers, setOrganizers] = useState<EventOrganizer[]>([]);
    const [openOrgCombobox, setOpenOrgCombobox] = useState(false);

    // Beneficiaries state
    const [beneficiariesDialogOpen, setBeneficiariesDialogOpen] = useState(false);
    const [selectedEventForBeneficiaries, setSelectedEventForBeneficiaries] = useState<Event | null>(null);
    const [eventBeneficiaries, setEventBeneficiaries] = useState<EventBeneficiary[]>([]);
    const [newBeneficiary, setNewBeneficiary] = useState({ name: '', phone: '' });

    // Delete state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [eventsCommitteeId, setEventsCommitteeId] = useState<string | null>(null);

    useEffect(() => {
        committeesRef.current = committees;
    }, [committees]);

    // Role-based committee mapping
    const ROLE_COMMITTEE_MAP: Record<string, string> = {
        head_events: 'Events', head_caravans: 'Caravans', head_ethics: 'Ethics',
        head_quran: 'Quran', head_ashbal: 'Ashbal', head_marketing: 'Marketing',
        head_production: 'Production', head_fourth_year: 'Fourth Year', head_hr: 'HR'
    };

    const isAdmin = hasRole('admin') || hasRole('supervisor');
    const userCommitteeName = ROLE_COMMITTEE_MAP[primaryRole] || null;

    const filteredEvents = events.filter(event => {
        const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDate = filterDate ? event.date === filterDate : true;
        return matchesSearch && matchesDate;
    });

    const fetchEventsCommittee = useCallback(async () => {
        const id = await getEventsCommitteeId();
        if (id) setEventsCommitteeId(id);
    }, []);

    const fetchCommittees = useCallback(async () => {
        const data = await getEventCommittees();
        setCommittees(data);

        // Auto-set committee_id for non-admin heads
        if (!isAdmin && userCommitteeName) {
            const match = data.find(c => c.name === userCommitteeName);
            if (match) setFormData(prev => ({ ...prev, committee_id: match.id }));
        }

        return data;
    }, [isAdmin, userCommitteeName]);

    const fetchEvents = useCallback(async (committeesList?: Committee[], hasCache = false) => {
        if (!hasCache) {
            setLoading(true);
        }
        try {
            let committeeId: string | undefined;
            if (!isAdmin && userCommitteeName) {
                const currentCommittees = committeesList || committeesRef.current;
                const committeeMatch = currentCommittees.find(c => c.name === userCommitteeName);
                committeeId = committeeMatch?.id;
            }

            const eventsData = await getEventSummaries({
                activeBranchId: activeBranch?.id,
                canViewAllBranches,
                committeeId,
            });

            setEvents(eventsData);

            const cacheKey = `rtc_events_data_${user?.id}_${activeBranch?.id || 'all'}`;
            setLocalCache(cacheKey, eventsData, CACHE_TTL.short);
        } catch (error) {
            console.error('Error fetching events:', error);
            toast.error(isRTL ? 'فشل تحميل الإيفينتات' : 'Failed to load events');
        } finally {
            setLoading(false);
        }
    }, [activeBranch?.id, canViewAllBranches, isAdmin, isRTL, user?.id, userCommitteeName]);

    const fetchVolunteers = useCallback(async () => {
        const data = await getEventVolunteers({
            activeBranchId: activeBranch?.id,
            canViewAllBranches,
        });
        setVolunteers(data);
    }, [activeBranch?.id, canViewAllBranches]);

    useEffect(() => {
        const loadData = async () => {
            const cacheKey = `rtc_events_data_${user?.id}_${activeBranch?.id || 'all'}`;
            const cached = getLocalCache<Event[]>(cacheKey, isEventCache);
            let hasCache = false;
            if (cached) {
                setEvents(cached);
                setLoading(false);
                hasCache = true;
            }

            fetchVolunteers();
            fetchEventsCommittee();
            const committeesData = await fetchCommittees();
            fetchEvents(committeesData, hasCache);
        };
        loadData();
    }, [activeBranch?.id, user?.id, fetchVolunteers, fetchEventsCommittee, fetchCommittees, fetchEvents]);

    const ensureEventActivityType = async () => {
        const { data } = await supabase
            .from('activity_types')
            .select('id')
            .ilike('name', 'Event')
            .maybeSingle();

        return data?.id;
    };

    // Speaker management
    const handleAddSpeaker = () => {
        if (!newSpeaker.name) return;
        setSpeakers([...speakers, { ...newSpeaker }]);
        setNewSpeaker({ name: '', phone: '', social_media_link: '' });
    };

    const handleRemoveSpeaker = (idx: number) => {
        setSpeakers(speakers.filter((_, i) => i !== idx));
    };

    // Organizer management
    const handleAddOrganizer = (volunteerId: string) => {
        const volunteer = volunteers.find(v => v.id === volunteerId);
        if (!volunteer) return;
        if (organizers.some(o => o.volunteer_id === volunteerId)) {
            toast.error(isRTL ? 'المنظم مضاف بالفعل' : 'Organizer already added');
            return;
        }
        setOrganizers([...organizers, { volunteer_id: volunteer.id, volunteer_name: volunteer.full_name }]);
        setOpenOrgCombobox(false);
    };

    const handleRemoveOrganizer = (idx: number) => {
        setOrganizers(organizers.filter((_, i) => i !== idx));
    };

    // Beneficiary management
    const openBeneficiaries = async (event: Event) => {
        setSelectedEventForBeneficiaries(event);
        setBeneficiariesDialogOpen(true);
        const { data } = await supabase
            .from('event_beneficiaries')
            .select('*')
            .eq('event_id', event.id)
            .order('name');
        setEventBeneficiaries((data as EventBeneficiary[]) || []);
    };

    const handleAddBeneficiary = async () => {
        if (!selectedEventForBeneficiaries || !newBeneficiary.name) return;
        try {
            const beneficiaryToCreate: EventBeneficiaryInsert = {
                event_id: selectedEventForBeneficiaries.id,
                name: newBeneficiary.name,
                phone: newBeneficiary.phone || null
            };
            const { data, error } = await supabase
                .from('event_beneficiaries')
                .insert(beneficiaryToCreate)
                .select()
                .single();
            if (error) throw error;
            setEventBeneficiaries([...eventBeneficiaries, data as EventBeneficiary]);
            setNewBeneficiary({ name: '', phone: '' });
            toast.success(isRTL ? 'تم إضافة المستفيد' : 'Beneficiary added');
        } catch (error) {
            console.error('Error adding beneficiary:', error);
            toast.error(isRTL ? 'فشل إضافة المستفيد' : 'Failed to add beneficiary');
        }
    };

    const handleRemoveBeneficiary = async (id: string) => {
        try {
            const { error } = await supabase.from('event_beneficiaries').delete().eq('id', id);
            if (error) throw error;
            setEventBeneficiaries(eventBeneficiaries.filter(b => b.id !== id));
            toast.success(isRTL ? 'تم حذف المستفيد' : 'Beneficiary removed');
        } catch (error) {
            toast.error(isRTL ? 'فشل حذف المستفيد' : 'Failed to remove beneficiary');
        }
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
            // Fetch participants, speakers, organizers in parallel
            const [partsRes, speakersRes, orgsRes] = await Promise.all([
                supabase.from('event_participants').select('*').eq('event_id', event.id),
                supabase.from('event_speakers').select('*').eq('event_id', event.id),
                supabase.from('event_organizers').select('*, profiles:volunteer_id(full_name)').eq('event_id', event.id)
            ]);

            setFormData({
                name: event.name,
                type: event.type,
                location: event.location,
                date: event.date,
                time: event.time || '',
                description: event.description || '',
                committee_id: event.committee_id || ''
            });

            setParticipants((partsRes.data || []).map((p) => ({
                id: p.id, volunteer_id: p.volunteer_id,
                name: p.name, phone: p.phone || '', is_volunteer: Boolean(p.is_volunteer)
            })));

            setSpeakers((speakersRes.data || []).map((s) => ({
                id: s.id, name: s.name, phone: s.phone || '',
                social_media_link: s.social_media_link || ''
            })));

            setOrganizers(((orgsRes.data || []) as unknown as EventOrganizerWithProfile[]).map((o) => ({
                id: o.id, volunteer_id: o.volunteer_id,
                volunteer_name: o.profiles?.full_name || ''
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
            // 1. Create Event with committee_id
            const { data: event, error: eventError } = await supabase
                .from('events')
                .insert({
                    name: formData.name,
                    type: formData.type,
                    location: formData.location,
                    date: formData.date,
                    time: formData.time || null,
                    description: formData.description || null,
                    committee_id: formData.committee_id === 'general' ? null : (formData.committee_id || null),
                    created_by: user?.id
                })
                .select()
                .single();

            if (eventError) throw eventError;

            const targetCommitteeId = formData.committee_id || eventsCommitteeId;
            const activityTypeId = speakers.length > 0 || organizers.length > 0
                ? await ensureEventActivityType()
                : undefined;

            // 2. Add Participants & Award Points
            if (participants.length > 0) {
                const participantRows: EventParticipantInsert[] = participants.map(p => ({
                    event_id: event.id,
                    volunteer_id: p.volunteer_id || null,
                    name: p.name,
                    phone: p.phone,
                    is_volunteer: p.is_volunteer
                }));
                const { error: partsError } = await supabase
                    .from('event_participants')
                    .insert(participantRows);
                if (partsError) throw partsError;
            }

            // 3. Save speakers
            if (speakers.length > 0) {
                const speakerRows: EventSpeakerInsert[] = speakers.map(s => ({
                        event_id: event.id,
                        name: s.name, phone: s.phone || null,
                        social_media_link: s.social_media_link || null
                    }));
                const { error: speakersError } = await supabase.from('event_speakers').insert(speakerRows);
                if (speakersError) throw speakersError;

                // Award points to speakers who match existing volunteers
                const matchedVolunteers = speakers.map(s => 
                    volunteers.find(v => 
                        (s.phone && v.phone === s.phone) || 
                        v.full_name === s.name
                    )
                ).filter(Boolean);
                
                const uniqueSpeakerIds = Array.from(new Set(matchedVolunteers.map(v => v!.id)));
                
                if (activityTypeId && targetCommitteeId && uniqueSpeakerIds.length > 0) {
                    const { error: speakerParticipationError } = await supabase.from('activity_submissions').insert(
                        uniqueSpeakerIds.map(volunteerId => ({
                            volunteer_id: volunteerId,
                            activity_type_id: activityTypeId,
                            committee_id: targetCommitteeId,
                            status: 'approved' as const,
                            points_awarded: 5,
                            submitted_at: formData.date ? new Date(formData.date + 'T12:00:00').toISOString() : new Date().toISOString(),
                            description: `Event Speaker: ${formData.name}`,
                        }))
                    );
                    if (speakerParticipationError) throw speakerParticipationError;
                }
            }

            // 4. Save organizers & award participation
            if (organizers.length > 0) {
                const organizerRows: EventOrganizerInsert[] = organizers.map(o => ({ event_id: event.id, volunteer_id: o.volunteer_id }));
                const { error: organizersError } = await supabase.from('event_organizers').insert(organizerRows);
                if (organizersError) throw organizersError;

                // Award points to organizers
                if (activityTypeId && targetCommitteeId) {
                    const { error: organizerParticipationError } = await supabase.from('activity_submissions').insert(
                        organizers.map(o => ({
                            volunteer_id: o.volunteer_id,
                            activity_type_id: activityTypeId,
                            committee_id: targetCommitteeId,
                            status: 'approved' as const,
                            points_awarded: 5,
                            submitted_at: formData.date ? new Date(formData.date + 'T12:00:00').toISOString() : new Date().toISOString(),
                            description: `Event: ${formData.name}`,
                        }))
                    );
                    if (organizerParticipationError) throw organizerParticipationError;
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
                    committee_id: formData.committee_id === 'general' ? null : (formData.committee_id || null),
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedEventId);

            if (updateError) throw updateError;

            // 2. Manage Participants (existing logic)
            const { data: existingPartsType } = await supabase
                .from('event_participants')
                .select('id, volunteer_id, is_volunteer')
                .eq('event_id', selectedEventId);
            const existingParts = existingPartsType || [];
            const currentParticipantIds = participants.filter(p => p.id).map(p => p.id);
            const toRemove = existingParts.filter(p => !currentParticipantIds.includes(p.id));
            const toAdd = participants.filter(p => !p.id);

            if (toRemove.length > 0) {
                await supabase.from('event_participants').delete().in('id', toRemove.map(p => p.id));
            }

            if (toAdd.length > 0) {
                await supabase.from('event_participants').insert(toAdd.map(p => ({
                    event_id: selectedEventId,
                    volunteer_id: p.volunteer_id || null,
                    name: p.name, phone: p.phone, is_volunteer: p.is_volunteer
                })));
            }

            // 3. Sync speakers (delete all + reinsert)
            await supabase.from('event_speakers').delete().eq('event_id', selectedEventId);
            if (speakers.length > 0) {
                const speakerRows: EventSpeakerInsert[] = speakers.map(s => ({
                        event_id: selectedEventId,
                        name: s.name, phone: s.phone || null,
                        social_media_link: s.social_media_link || null
                    }));
                await supabase.from('event_speakers').insert(speakerRows);
            }

            // 4. Sync organizers (delete all + reinsert)
            await supabase.from('event_organizers').delete().eq('event_id', selectedEventId);
            if (organizers.length > 0) {
                const organizerRows: EventOrganizerInsert[] = organizers.map(o => ({ event_id: selectedEventId, volunteer_id: o.volunteer_id }));
                await supabase.from('event_organizers').insert(organizerRows);
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
            name: '', type: '', location: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            time: '', description: '', committee_id: ''
        });
        setParticipants([]);
        setSpeakers([]);
        setOrganizers([]);
        setIsEditMode(false);
        setSelectedEventId(null);
        // Re-set default committee for non-admin heads
        if (!isAdmin && userCommitteeName) {
            const match = committees.find(c => c.name === userCommitteeName);
            if (match) setFormData(prev => ({ ...prev, committee_id: match.id }));
        }
    };

    const handleExportAllEvents = async () => {
        if (events.length === 0) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }
        try {
            await exportEventsListToXlsx({ events, isRTL, formatTime });
            toast.success(isRTL ? 'تم تصدير كل الايفينتات بنجاح' : 'All events exported successfully');
        } catch (error) {
            console.error('Error exporting events:', error);
            toast.error(isRTL ? 'فشل تصدير الإيفينتات' : 'Failed to export events');
        }
    };

    const handleExportSingleEvent = async (event: Event) => {
        try {
            await exportEventDetailsToXlsx({ event, isRTL, formatTime });
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
        } catch (error: unknown) {
            console.error('Error deleting event:', error);
            toast.error(getErrorMessage(error, isRTL ? 'فشل حذف الإيفينت' : 'Failed to delete event'));
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Sparkles className="h-7 w-7 text-primary" />
                        <span>{isRTL ? 'إدارة الإيفينتات' : 'Event Management'}</span>
                        {!isAdmin && userCommitteeName && (
                            <span className="text-lg font-normal text-muted-foreground">
                                - {isRTL ? committees.find(c => c.name === userCommitteeName)?.name_ar : userCommitteeName}
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إنشاء وإدارة الإيفينتات' : 'Create and manage events'}</p>
                </div>

                <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
                    <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button className="flex-1 sm:flex-initial">
                                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {isRTL ? 'إيفينت جديد' : 'New Event'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl">
                        <DialogHeader className="px-4 sm:px-6 py-5 border-b-2 border-border/50 dark:border-border/80 shrink-0 bg-muted/30 flex flex-col items-center text-center">
                            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
                                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                {isEditMode ? (isRTL ? 'تعديل الإيفينت' : 'Edit Event') : (isRTL ? 'إنشاء إيفينت جديد' : 'Create New Event')}
                            </DialogTitle>
                            <DialogDescription className="text-center mt-1.5">{isRTL ? 'أضف تفاصيل الإيفينت والمشاركين' : 'Add event details and participants'}</DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
                            {/* القسم الأول: البيانات الأساسية */}
                            <h3 className="text-lg sm:text-xl font-bold border-b-2 border-primary/20 dark:border-primary/40 pb-2 flex items-center gap-2 text-foreground/90">
                                <Sparkles className="h-5 w-5 text-primary" />
                                {isRTL ? 'البيانات الأساسية' : 'Basic Info'}
                            </h3>

                            {/* Event Name */}
                            <div className="space-y-2 relative">
                                <Label className="text-sm font-semibold flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 text-primary" />
                                    {isRTL ? 'اسم الإيفينت' : 'Event Name'} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`h-11 sm:h-12 ${!formData.name ? 'border-primary/20 hover:border-primary/50' : ''}`}
                                    placeholder={isRTL ? 'مثال: ملتقى المتطوعين السنوي' : 'e.g., Annual Volunteer Meeting'}
                                />
                            </div>

                            {/* Event Type - Free Text */}
                            <div className="space-y-2 relative">
                                <Label className="text-sm font-semibold flex items-center gap-1.5">
                                    <Activity className="h-3.5 w-3.5 text-primary" />
                                    {isRTL ? 'نوع الإيفينت' : 'Event Type'} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className={`h-11 sm:h-12 ${!formData.type ? 'border-primary/20 hover:border-primary/50' : ''}`}
                                    placeholder={isRTL ? 'مثال: ورشة عمل، محاضرة، مسابقة...' : 'e.g., Workshop, Lecture, Competition...'}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Date */}
                                <div className="space-y-2 relative">
                                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        {isRTL ? 'التاريخ' : 'Date'} <span className="text-destructive">*</span>
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-start font-normal h-11 sm:h-12 border-primary/20 hover:border-primary/50",
                                                    !formData.date && "text-muted-foreground"
                                                )}
                                            >
                                                <Calendar className="ltr:mr-2 rtl:ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                                {formData.date ? (
                                                    format(new Date(formData.date), "PPP", { locale: isRTL ? ar : undefined })
                                                ) : (
                                                    <span>{isRTL ? 'اختر التاريخ' : 'Pick a date'}</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarComponent
                                                mode="single"
                                                selected={formData.date ? new Date(formData.date) : undefined}
                                                onSelect={(date) => setFormData({ ...formData, date: date ? format(date, 'yyyy-MM-dd') : '' })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Time */}
                                <div className="space-y-2 relative">
                                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                        {isRTL ? 'الوقت' : 'Time'}
                                    </Label>
                                    <Input
                                        type="time"
                                        value={formData.time}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                        className={`h-11 sm:h-12 ${!formData.time ? 'border-primary/20 hover:border-primary/50' : ''}`}
                                    />
                                </div>
                            </div>

                            {/* Location */}
                            <div className="space-y-2 relative">
                                <Label className="text-sm font-semibold flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                    {isRTL ? 'المكان' : 'Location'} <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className={`h-11 sm:h-12 ${!formData.location ? 'border-primary/20 hover:border-primary/50' : ''}`}
                                    placeholder={isRTL ? 'مكان الإيفينت' : 'Event Location'}
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2 relative">
                                <Label className="text-sm font-semibold flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    {isRTL ? 'الوصف' : 'Description'}
                                </Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={cn("text-sm", !formData.description ? "border-primary/20 hover:border-primary/50" : "")}
                                    placeholder={isRTL ? 'وصف الإيفينت (اختياري)' : 'Event description (optional)'}
                                    rows={3}
                                />
                            </div>

                            {/* Committee Selector */}
                            <div className="space-y-2 relative">
                                <Label className="text-sm font-semibold flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                    {isRTL ? 'اللجنة' : 'Committee'}
                                </Label>
                                <Select
                                    value={formData.committee_id || 'general'}
                                    onValueChange={(val) => setFormData({ ...formData, committee_id: val })}
                                    dir={isRTL ? 'rtl' : 'ltr'}
                                >
                                    <SelectTrigger className={cn("h-11 sm:h-12", !formData.committee_id ? "border-primary/20 hover:border-primary/50" : "")}>
                                        <SelectValue placeholder={isRTL ? 'اختر اللجنة' : 'Select committee'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(isAdmin || !userCommitteeName) && (
                                            <SelectItem value="general">{isRTL ? 'عام (بدون لجنة)' : 'General (No Committee)'}</SelectItem>
                                        )}
                                        {committees
                                            .filter(c => isAdmin || !userCommitteeName || c.name === userCommitteeName)
                                            .map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {isRTL ? c.name_ar : c.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Speakers Section */}
                            <div className="border-t pt-4 mt-2">
                                <h4 className="font-semibold mb-3 flex items-center gap-1.5 text-sm">
                                    <Mic className="h-3.5 w-3.5 text-primary" />
                                    {isRTL ? 'المتحدثون' : 'Speakers'}
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Input
                                            placeholder={isRTL ? 'اسم المتحدث' : 'Speaker name'}
                                            value={newSpeaker.name}
                                            onChange={(e) => setNewSpeaker({ ...newSpeaker, name: e.target.value })}
                                            className={cn("flex-1 h-11 sm:h-12", !newSpeaker.name ? "border-primary/20 hover:border-primary/50" : "")}
                                        />
                                        <Input
                                            placeholder={isRTL ? 'الهاتف' : 'Phone'}
                                            value={newSpeaker.phone}
                                            onChange={(e) => setNewSpeaker({ ...newSpeaker, phone: e.target.value })}
                                            className={cn("w-full sm:w-28 h-11 sm:h-12", !newSpeaker.phone ? "border-primary/20 hover:border-primary/50" : "")}
                                        />
                                        <Input
                                            placeholder={isRTL ? 'رابط التواصل' : 'Social link'}
                                            value={newSpeaker.social_media_link}
                                            onChange={(e) => setNewSpeaker({ ...newSpeaker, social_media_link: e.target.value })}
                                            className={cn("w-full sm:w-36 h-11 sm:h-12", !newSpeaker.social_media_link ? "border-primary/20 hover:border-primary/50" : "")}
                                        />
                                        <Button type="button" variant="secondary" onClick={handleAddSpeaker} className="w-full sm:w-auto h-11 sm:h-12">
                                            <Plus className="h-4 w-4 sm:mr-0 rtl:ml-2 sm:rtl:ml-0" />
                                            <span className="sm:hidden">{isRTL ? 'إضافة' : 'Add'}</span>
                                        </Button>
                                    </div>
                                    {speakers.length > 0 && (
                                        <div className="space-y-2">
                                            {speakers.map((s, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                                                    <div className="flex items-center gap-3">
                                                        <Mic className="h-4 w-4 text-primary" />
                                                        <span className="font-medium">{s.name}</span>
                                                        {s.phone && <span className="text-muted-foreground">{s.phone}</span>}
                                                        {s.social_media_link && (
                                                            <a href={s.social_media_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                                <LinkIcon className="h-3 w-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSpeaker(idx)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Organizers Section */}
                            <div className="border-t pt-4 mt-2">
                                <h4 className="font-semibold mb-3 flex items-center gap-1.5 text-sm">
                                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                                    {isRTL ? 'المنظمون' : 'Organizers'}
                                </h4>
                                <Popover open={openOrgCombobox} onOpenChange={setOpenOrgCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between h-11 sm:h-12", organizers.length === 0 ? "border-primary/20 hover:border-primary/50" : "")}>
                                            {isRTL ? 'اختر منظم...' : 'Select organizer...'}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder={isRTL ? 'بحث عن متطوع أو رقم الهاتف...' : 'Search volunteer or phone...'} />
                                            <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                                                <CommandEmpty>{isRTL ? 'لا توجد نتائج' : 'No results found'}</CommandEmpty>
                                                <CommandGroup>
                                                    {volunteers.map((v) => {
                                                        const isSelected = organizers.some(o => o.volunteer_id === v.id);
                                                        return (
                                                            <CommandItem
                                                                key={v.id}
                                                                value={`${v.full_name} ${v.phone || ''}`}
                                                                onSelect={() => {
                                                                    handleAddOrganizer(v.id);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2 w-full">
                                                                    <Avatar className="h-8 w-8">
                                                                        <AvatarImage src={v.avatar_url || undefined} />
                                                                        <AvatarFallback>{(v.full_name?.[0] || '?').toUpperCase()}</AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex flex-col flex-1">
                                                                        <span className={isSelected ? 'text-muted-foreground' : ''}>
                                                                            {v.full_name}
                                                                        </span>
                                                                        {v.phone && <span className="text-xs text-muted-foreground font-mono" dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>{v.phone}</span>}
                                                                    </div>
                                                                    {isSelected && (
                                                                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                                                                    )}
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {organizers.length > 0 && (
                                    <div className="space-y-2 mt-3">
                                        {organizers.map((o, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <UserPlus className="h-4 w-4 text-green-600" />
                                                    <span>{o.volunteer_name}</span>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveOrganizer(idx)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t-2 border-border/50 dark:border-border/80 bg-muted/10 shrink-0">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="h-11 sm:h-12 px-4 sm:px-8 w-full sm:w-auto text-sm font-medium">
                                {isRTL ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button onClick={handleSave} className="h-11 sm:h-12 px-4 sm:px-8 w-full sm:w-auto text-sm font-semibold shadow-sm">
                                {isEditMode ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'إنشاء الإيفينت' : 'Create Event')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Button variant="outline" onClick={handleExportAllEvents} className="flex-1 sm:flex-initial">
                    <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {isRTL ? 'تصدير الكل' : 'Export All'}
                </Button>
            </div>
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
                <div className="relative">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-auto justify-start text-start font-normal bg-background h-10 border border-input",
                                    filterDate ? (isRTL ? "pl-8" : "pr-8") : "",
                                    !filterDate && "text-muted-foreground"
                                )}
                            >
                                <Calendar className="ltr:mr-2 rtl:ml-2 h-4 w-4 shrink-0" />
                                {filterDate ? (
                                    format(new Date(filterDate), "PPP", { locale: isRTL ? ar : undefined })
                                ) : (
                                    <span>{isRTL ? 'تصفية بالتاريخ' : 'Filter by date'}</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                                mode="single"
                                selected={filterDate ? new Date(filterDate) : undefined}
                                onSelect={(date) => setFilterDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    {filterDate && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute ltr:right-2 rtl:left-2 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-transparent"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFilterDate('');
                            }}
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
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
                                        {event.committee_name && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary mt-1 inline-block">
                                                {event.committee_name}
                                            </span>
                                        )}
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
                                <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => openBeneficiaries(event)}>
                                    <Users className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                    {isRTL ? 'إدارة المستفيدين' : 'Manage Beneficiaries'}
                                </Button>
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

            {/* Beneficiaries Dialog */}
            <Dialog open={beneficiariesDialogOpen} onOpenChange={setBeneficiariesDialogOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'إدارة المستفيدين' : 'Manage Beneficiaries'} - {selectedEventForBeneficiaries?.name}</DialogTitle>
                        <DialogDescription>{isRTL ? 'إضافة وإزالة المستفيدين من الإيفينت' : 'Add and remove event beneficiaries'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                placeholder={isRTL ? 'اسم المستفيد' : 'Beneficiary name'}
                                value={newBeneficiary.name}
                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, name: e.target.value })}
                                className="flex-1"
                            />
                            <Input
                                placeholder={isRTL ? 'الهاتف' : 'Phone'}
                                value={newBeneficiary.phone}
                                onChange={(e) => setNewBeneficiary({ ...newBeneficiary, phone: e.target.value })}
                                className="w-full sm:w-32"
                            />
                            <Button onClick={handleAddBeneficiary} className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 sm:mr-0 rtl:ml-2 sm:rtl:ml-0" />
                                <span className="sm:hidden">{isRTL ? 'إضافة' : 'Add'}</span>
                            </Button>
                        </div>
                        {eventBeneficiaries.length > 0 ? (
                            <div className="border rounded-md overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="whitespace-nowrap">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                <TableHead className="whitespace-nowrap">{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                                                <TableHead className="w-12 whitespace-nowrap"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {eventBeneficiaries.map((b) => (
                                                <TableRow key={b.id}>
                                                    <TableCell className="whitespace-nowrap">{b.name}</TableCell>
                                                    <TableCell className="whitespace-nowrap">{b.phone || '—'}</TableCell>
                                                    <TableCell className="whitespace-nowrap">
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveBeneficiary(b.id!)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-4">{isRTL ? 'لا يوجد مستفيدين' : 'No beneficiaries yet'}</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
