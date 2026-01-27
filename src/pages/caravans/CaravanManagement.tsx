import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Plus, Download, Bus, Calendar, Clock, MapPin, Users, Check, ChevronsUpDown, Trash2, FileSpreadsheet, X, Search, Pencil, MoreVertical } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { StatsCard } from '@/components/ui/stats-card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


interface Caravan {
    id: string;
    name: string;
    type: string; // e.g., 'medical', 'aid', etc.
    location: string;
    date: string;
    move_time: string | null;
    actual_move_time: string | null;
    bus_arrival_time: string | null;
    return_time: string | null;
    created_by: string;
    participants_count?: number;
}

interface Participant {
    id?: string; // DB ID if exists
    volunteer_id?: string;
    name: string;
    phone: string;
    is_volunteer: boolean;
    role?: string;
    committee_id?: string | null;
    wore_vest?: boolean;
}

interface Volunteer {
    id: string;
    full_name: string;
    phone: string | null;
    committee_id?: string | null;
    avatar_url?: string | null;
}

const CARAVANS_COMMITTEE_NAME = 'Caravans'; // Must match DB migration name

export default function CaravanManagement() {
    const { user, profile: userProfile } = useAuth();
    const { t, language, isRTL } = useLanguage();

    const [caravans, setCaravans] = useState<Caravan[]>([]);
    const [timeFilter, setTimeFilter] = useState('all');

    // New Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState('');

    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
    const [caravansCommitteeId, setCaravansCommitteeId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        location: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        move_time: '',
        actual_move_time: '',
        bus_arrival_time: '',
        return_time: ''
    });

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [caravanToDelete, setCaravanToDelete] = useState<Caravan | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Guest Input State
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [woreVest, setWoreVest] = useState(true);

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedCaravanId, setSelectedCaravanId] = useState<string | null>(null);

    const getFilterDisplayLabel = (filter: string) => {
        switch (filter) {
            case 'weekly': return language === 'ar' ? 'أسبوعي' : 'Weekly';
            case 'monthly': return language === 'ar' ? 'شهري' : 'Monthly';
            case 'quarterly': return language === 'ar' ? 'ربع سنوي' : 'Quarterly';
            case 'trimester': return language === 'ar' ? 'ثلث سنوي' : 'Trimester';
            case 'semi_annual': return language === 'ar' ? 'نصف سنوي' : 'Semi-Annual';
            case 'annual': return language === 'ar' ? 'سنوي' : 'Annual';
            default: return language === 'ar' ? 'الكل' : 'All';
        }
    };

    const handleEditCaravan = async (caravan: Caravan) => {
        setIsEditMode(true);
        setSelectedCaravanId(caravan.id);
        setFormData({
            name: caravan.name,
            type: caravan.type,
            location: caravan.location,
            date: caravan.date,
            move_time: caravan.move_time || '',
            actual_move_time: caravan.actual_move_time || '',
            bus_arrival_time: caravan.bus_arrival_time || '',
            return_time: caravan.return_time || ''
        });

        // Fetch participants
        const { data: participantsData } = await supabase
            .from('caravan_participants')
            .select('*')
            .eq('caravan_id', caravan.id);

        if (participantsData) {
            setParticipants(participantsData.map(p => ({
                id: p.id,
                volunteer_id: p.volunteer_id,
                name: p.name,
                phone: p.phone,
                is_volunteer: p.is_volunteer,
                committee_id: null,
                wore_vest: p.wore_vest ?? true
            })));
        }

        setIsCreateOpen(true);
    };

    const handleUpdateCaravan = async () => {
        const missingFields: string[] = [];

        if (!formData.name?.trim()) {
            missingFields.push(isRTL ? 'اسم القافلة' : 'Caravan name');
        }
        if (!formData.date) {
            missingFields.push(isRTL ? 'التاريخ' : 'Date');
        }
        if (!formData.location?.trim()) {
            missingFields.push(isRTL ? 'الموقع' : 'Location');
        }
        if (!selectedCaravanId) {
            missingFields.push(isRTL ? 'معرف القافلة' : 'Caravan ID');
        }

        if (missingFields.length > 0) {
            toast.error(
                isRTL
                    ? `يرجى ملء الحقول التالية: ${missingFields.join('، ')}`
                    : `Please fill in: ${missingFields.join(', ')}`
            );
            return;
        }

        try {
            // 1. Update Caravan Details
            const { error: updateError } = await supabase
                .from('caravans')
                .update({
                    name: formData.name,
                    type: formData.type,
                    location: formData.location,
                    date: formData.date,
                    move_time: formData.move_time || null,
                    actual_move_time: formData.actual_move_time || null,
                    bus_arrival_time: formData.bus_arrival_time || null,
                    return_time: formData.return_time || null
                })
                .eq('id', selectedCaravanId);

            if (updateError) throw updateError;

            // 2. Manage Participants
            const { data: existingParticipants } = await supabase
                .from('caravan_participants')
                .select('*')
                .eq('caravan_id', selectedCaravanId);

            const existingIds = existingParticipants?.map(p => p.id) || [];
            const currentIds = participants.filter(p => p.id).map(p => p.id);

            // Identify Removed Participants
            const toRemove = existingParticipants?.filter(p => !currentIds.includes(p.id)) || [];

            if (toRemove.length > 0) {
                const removeIds = toRemove.map(p => p.id);
                await supabase.from('caravan_participants').delete().in('id', removeIds);

                // POINTS CLEANUP
                const volIdsToRemove = toRemove
                    .filter(p => p.is_volunteer && p.volunteer_id)
                    .map(p => p.volunteer_id);

                if (volIdsToRemove.length > 0) {
                    const originalCaravan = caravans.find(c => c.id === selectedCaravanId);
                    const originalName = originalCaravan?.name || formData.name;

                    const { error: deletePointsError } = await supabase
                        .from('activity_submissions')
                        .delete()
                        .in('volunteer_id', volIdsToRemove)
                        .eq('description', `Caravan: ${originalName}`);

                    if (deletePointsError) console.error('Error removing points', deletePointsError);
                }
            }

            // Identify New/Updated Participants
            const toInsert = participants.filter(p => !p.id);
            const toUpdate = participants.filter(p => p.id);

            if (toInsert.length > 0) {
                await supabase.from('caravan_participants').insert(toInsert.map(p => ({
                    caravan_id: selectedCaravanId,
                    volunteer_id: p.is_volunteer ? (p.volunteer_id || null) : null, // Force null for guests
                    name: p.name,
                    phone: p.phone,
                    is_volunteer: Boolean(p.is_volunteer),
                    wore_vest: p.wore_vest
                })));
            }

            if (toUpdate.length > 0) {
                await supabase.from('caravan_participants').upsert(toUpdate.map(p => ({
                    id: p.id,
                    caravan_id: selectedCaravanId,
                    volunteer_id: p.is_volunteer ? (p.volunteer_id || null) : null, // Force null for guests
                    name: p.name,
                    phone: p.phone,
                    is_volunteer: Boolean(p.is_volunteer),
                    wore_vest: p.wore_vest
                })));
            }

            toast.success(isRTL ? 'تم تحديث القافلة بنجاح' : 'Caravan updated successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchCaravans();

        } catch (error: any) {
            console.error('Error updating caravan:', error);
            const errorMessage = error.message || (isRTL ? 'حدث خطأ أثناء تحديث القافلة' : 'Error updating caravan');
            toast.error(errorMessage);
        }
    };

    const filteredCaravans = caravans.filter(caravan => {
        // 1. Search Query
        if (searchQuery && !caravan.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }

        // 2. Specific Date Filter
        if (filterDate && caravan.date !== filterDate) {
            return false;
        }

        // 3. Time Period Filter (Only if specific date is NOT set)
        // If filterDate is set, we ignore timeFilter
        if (filterDate) return true;

        if (timeFilter === 'all') return true;

        if (!caravan.date) return false;
        const date = parseISO(caravan.date);
        const now = new Date();

        try {
            switch (timeFilter) {
                case 'weekly':
                    return isWithinInterval(date, {
                        start: startOfWeek(now, { weekStartsOn: 6 }),
                        end: endOfWeek(now, { weekStartsOn: 6 })
                    });
                case 'monthly':
                    return isWithinInterval(date, {
                        start: startOfMonth(now),
                        end: endOfMonth(now)
                    });
                case 'quarterly': // 3 months
                    return isWithinInterval(date, {
                        start: startOfQuarter(now),
                        end: endOfQuarter(now)
                    });
                case 'trimester': // 4 months (Third of year)
                    {
                        const currentMonth = now.getMonth();
                        const currentYear = now.getFullYear();
                        // 0-3 (Jan-Apr), 4-7 (May-Aug), 8-11 (Sep-Dec)
                        const startMonth = Math.floor(currentMonth / 4) * 4;
                        const start = new Date(currentYear, startMonth, 1);
                        const end = endOfMonth(new Date(currentYear, startMonth + 3));
                        return isWithinInterval(date, { start, end });
                    }
                case 'semi_annual': // 6 months
                    {
                        const currentMonth = now.getMonth();
                        const currentYear = now.getFullYear();
                        // 0-5 (Jan-Jun), 6-11 (Jul-Dec)
                        const startMonth = Math.floor(currentMonth / 6) * 6;
                        const start = new Date(currentYear, startMonth, 1);
                        const end = endOfMonth(new Date(currentYear, startMonth + 5));
                        return isWithinInterval(date, { start, end });
                    }
                case 'annual':
                    return isWithinInterval(date, {
                        start: startOfYear(now),
                        end: endOfYear(now)
                    });
                default:
                    return true;
            }
        } catch (e) {
            console.error('Date filtering error', e);
            return false;
        }
    });

    useEffect(() => {
        fetchCaravans();
        fetchVolunteers();
        fetchCaravansCommittee();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchCaravans = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('caravans')
                .select('*, participants_count:caravan_participants(count)')
                .order('date', { ascending: false });

            if (error) throw error;

            setCaravans((data || []).map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                ...c,
                participants_count: c.participants_count?.[0]?.count || 0
            } as Caravan))); // Cast to Caravan to ensure type safety downstream
        } catch (error) {
            console.error('Error fetching caravans:', error);
            toast.error(isRTL ? 'فشل في تحميل القوافل' : 'Failed to fetch caravans');
        } finally {
            setLoading(false);
        }
    };

    const fetchVolunteers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, phone, committee_id, avatar_url')
            .neq('full_name', 'RTC Admin')
            .order('full_name');
        if (data) setVolunteers(data);
    };

    const fetchCaravansCommittee = async () => {
        const { data } = await supabase
            .from('committees')
            .select('id')
            .ilike('name', 'Caravans') // Match name used in migration
            .maybeSingle();
        console.log('Fetched Caravans Committee:', data);
        if (data) setCaravansCommitteeId(data.id);
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
            name: volunteer.full_name || '',
            phone: volunteer.phone || '',
            is_volunteer: true,
            committee_id: volunteer.committee_id,
            wore_vest: woreVest
        }]);
        setOpenCombobox(false);
        setWoreVest(true); // Reset to default
    };

    const handleAddGuest = () => {
        if (!guestName) return;

        // Validate tripartite name (at least 3 parts)
        const nameParts = guestName.trim().split(/\s+/);
        if (nameParts.length < 3) {
            toast.error(isRTL ? 'يجب إدخال الاسم ثلاثي على الأقل' : 'Please enter at least a tripartite name');
            return;
        }

        // Check for duplicate name
        if (participants.some(p => p.name.trim().toLowerCase() === guestName.trim().toLowerCase())) {
            toast.error(isRTL ? 'هذا الاسم مضاف بالفعل' : 'This name is already added');
            return;
        }

        // Check for duplicate phone (if provided)
        if (guestPhone && participants.some(p => p.phone === guestPhone)) {
            toast.error(isRTL ? 'رقم الهاتف مضاف بالفعل' : 'This phone number is already added');
            return;
        }

        setParticipants([...participants, {
            name: guestName,
            phone: guestPhone,
            is_volunteer: false,
            wore_vest: false // Guests don't get points/vest tracking usually, but keep schema consistent
        }]);
        setGuestName('');
        setGuestPhone('');
    };

    const removeParticipant = (index: number) => {
        const newParticipants = [...participants];
        newParticipants.splice(index, 1);
        setParticipants(newParticipants);
    };

    // Helper to get or create 'Caravan' activity type
    const ensureCaravanActivityType = async () => {
        // 1. Try to find existing 'Caravan' activity

        const { data: existing } = await supabase
            .from('activity_types')
            .select('id')
            .ilike('name', 'Caravan')
            .maybeSingle();

        if (existing) return existing.id;

        // 2. Create if not exists
        // 2. Create if not exists
        const { data: newActivity, error } = await supabase
            .from('activity_types')
            .insert({
                name: 'Caravan',
                name_ar: 'قافلة',
                category: 'community_service', // Assuming this category exists or is valid text
                description: 'Participation in a caravan',
                description_ar: 'المشاركة في قافلة',
                points: 5,
                mode: 'group',
                committee_id: caravansCommitteeId, // Assign to Caravans committee
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating caravan activity type:', error);
            return null;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (newActivity as any).id;
    };

    const handleCreateCaravan = async () => {
        // Specific validation with clear error messages
        const missingFields: string[] = [];

        if (!formData.name?.trim()) {
            missingFields.push(isRTL ? 'اسم القافلة' : 'Caravan name');
        }
        if (!formData.date) {
            missingFields.push(isRTL ? 'التاريخ' : 'Date');
        }
        if (!formData.location?.trim()) {
            missingFields.push(isRTL ? 'الموقع' : 'Location');
        }
        if (!formData.type) {
            missingFields.push(isRTL ? 'نوع القافلة' : 'Caravan type');
        }

        if (missingFields.length > 0) {
            toast.error(
                isRTL
                    ? `يرجى ملء الحقول التالية: ${missingFields.join('، ')}`
                    : `Please fill in: ${missingFields.join(', ')}`
            );
            return;
        }

        try {
            // 1. Create Caravan
            // 1. Create Caravan
            const { data: caravan, error: caravanError } = await supabase
                .from('caravans' as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .insert({
                    ...formData,
                    created_by: user?.id
                })
                .select()
                .single();

            if (caravanError) throw caravanError;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const caravanData = caravan as any;

            // 2. Add Participants & Award Points
            if (participants.length > 0) {
                // Add to caravan_participants
                const { error: partsError } = await supabase
                    .from('caravan_participants' as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                    .insert(participants.map(p => ({
                        caravan_id: caravanData.id,
                        volunteer_id: p.is_volunteer ? (p.volunteer_id || null) : null, // Force null for guests
                        name: p.name,
                        phone: p.phone,
                        is_volunteer: Boolean(p.is_volunteer),
                        wore_vest: p.wore_vest // Pass wore_vest status
                    })));

                if (partsError) throw partsError;
                // Note: Points are now automatically awarded by the database trigger 'on_caravan_participant_added'
            }

            toast.success(isRTL ? 'تم إنشاء القافلة بنجاح' : 'Caravan created successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchCaravans();
        } catch (error: any) {
            console.error('Error creating caravan:', error);
            const errorMessage = error.message || (isRTL ? 'حدث خطأ أثناء إنشاء القافلة' : 'Error creating caravan');
            toast.error(errorMessage);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: '',
            location: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            move_time: '',
            actual_move_time: '',
            bus_arrival_time: '',
            return_time: ''
        });
        setParticipants([]);
        setWoreVest(true); // Reset vest status
        setIsEditMode(false);
        setSelectedCaravanId(null);
    };

    const handleDeleteCaravan = async () => {
        if (!caravanToDelete) return;

        setIsDeleting(true);
        try {
            // 1. First, delete related activity_submissions for this caravan
            // These submissions have description like "Caravan: {caravan_name}"
            const { error: submissionsError } = await supabase
                .from('activity_submissions')
                .delete()
                .ilike('description', `Caravan: ${caravanToDelete.name}`);

            if (submissionsError) {
                console.error('Error deleting caravan submissions:', submissionsError);
                // Continue with caravan deletion even if submissions fail
            }

            // 2. Delete the caravan (caravan_participants will be deleted via ON DELETE CASCADE)
            const { error } = await supabase
                .from('caravans' as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .delete()
                .eq('id', caravanToDelete.id);

            if (error) throw error;

            toast.success(isRTL ? 'تم حذف القافلة ومشاركات المتطوعين' : 'Caravan and volunteer participations deleted');
            setIsDeleteDialogOpen(false);
            setCaravanToDelete(null);
            fetchCaravans();
        } catch (error: any) {
            console.error('Error deleting caravan:', error);
            toast.error(error.message || (isRTL ? 'فشل حذف القافلة' : 'Failed to delete caravan'));
        } finally {
            setIsDeleting(false);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const downloadCSV = (data: any[], filename: string) => {
        if (data.length === 0) {
            toast.error(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                // Escape commas and quotes in values
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value ?? '';
            }).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${getFilterDisplayLabel(timeFilter)}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        toast.success(language === 'ar' ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
    };

    const exportCaravanDetails = async (caravan: Caravan) => {
        try {
            // Fetch participants
            const { data: parts } = await supabase
                .from('caravan_participants' as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .select('*')
                .eq('caravan_id', caravan.id);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const exportData = ((parts as any[]) || []).map(p => ({
                [t('leaderboard.name')]: p.name,
                [t('users.phoneNumber')]: p.phone,
                [isRTL ? 'متطوع/ضيف' : 'Volunteer/Guest']: p.is_volunteer ? t('common.volunteer') : (isRTL ? 'ضيف' : 'Guest'),
                [isRTL ? 'ارتدى الـ Vest' : 'Wore Vest']: p.is_volunteer ? (p.wore_vest ? 'Yes' : 'No') : 'N/A', // Added vest status
                [t('caravans.name')]: caravan.name,
                [t('caravans.date')]: caravan.date,
                [t('caravans.location')]: caravan.location
            }));

            downloadCSV(exportData, `${caravan.name}_Report`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Export failed');
        }
    };

    const getCaravanTypeLabel = (type: string) => {
        switch (type) {
            case 'food_distribution': return isRTL ? 'إطعام' : 'Food Distribution';
            case 'charity_market': return isRTL ? 'سوق خيري' : 'Charity Market';
            case 'eid_carnival': return isRTL ? 'كرنفال العيد' : 'Eid Carnival';
            case 'other': return isRTL ? 'أخرى' : 'Other';
            default: return type;
        }
    };

    const exportAllCaravans = async () => {
        try {
            // Fetch all caravans with participants
            // Filter by the IDs currently shown in the list
            const shownCaravanIds = filteredCaravans.map(c => c.id);

            if (shownCaravanIds.length === 0) {
                toast.error(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
                return;
            }

            const { data: allCaravans } = await supabase
                .from('caravans' as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .select('*, caravan_participants(*)')
                .in('id', shownCaravanIds);

            if (!allCaravans) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const flattenedData: any[] = [];
            allCaravans.forEach((c: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const volunteersCount = (c.caravan_participants || []).filter((p: any) => p.is_volunteer).length;
                const guestsCount = (c.caravan_participants || []).filter((p: any) => !p.is_volunteer).length;

                if (c.caravan_participants && c.caravan_participants.length > 0) {
                    c.caravan_participants.forEach((p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                        flattenedData.push({
                            [t('caravans.name')]: c.name,
                            [t('caravans.type')]: c.type,
                            [t('caravans.date')]: c.date,
                            [t('caravans.location')]: c.location,
                            [t('caravans.volunteersCount')]: volunteersCount,
                            [t('caravans.guestsCount')]: guestsCount,
                            [t('caravans.moveTime')]: c.move_time,
                            [t('caravans.actualMoveTime')]: c.actual_move_time,
                            [t('caravans.busArrivalTime')]: c.bus_arrival_time,
                            [t('caravans.returnTime')]: c.return_time,
                            [t('leaderboard.name')]: p.name,
                            [t('users.phoneNumber')]: p.phone,
                            [isRTL ? 'متطوع/ضيف' : 'Volunteer/Guest']: p.is_volunteer ? 'Volunteer' : 'Guest',
                            [isRTL ? 'ارتدى الـ Vest' : 'Wore Vest']: p.is_volunteer ? (p.wore_vest ? 'Yes' : 'No') : 'N/A' // Added vest status
                        });
                    });
                } else {
                    // Entry for caravan even if no participants?
                    flattenedData.push({
                        [t('caravans.name')]: c.name,
                        [t('caravans.type')]: c.type,
                        [t('caravans.date')]: c.date,
                        [t('caravans.location')]: c.location,
                        [t('caravans.volunteersCount')]: volunteersCount,
                        [t('caravans.guestsCount')]: guestsCount,
                        [t('caravans.moveTime')]: c.move_time,
                        [t('caravans.actualMoveTime')]: c.actual_move_time,
                        [t('caravans.busArrivalTime')]: c.bus_arrival_time,
                        [t('caravans.returnTime')]: c.return_time,
                        [t('leaderboard.name')]: '-',
                        [t('users.phoneNumber')]: '-',
                        [isRTL ? 'متطوع/ضيف' : 'Volunteer/Guest']: '-',
                        [isRTL ? 'ارتدى الـ Vest' : 'Wore Vest']: 'N/A' // Added vest status
                    });
                }
            });

            // Add metadata row at the top
            const metadata = `${isRTL ? 'الفترة' : 'Period'}: ${getFilterDisplayLabel(timeFilter)}`;

            // We need to modify downloadCSV to accept this or handle it here. 
            // Let's handle it here by constructing CSV manually or modifying downloadCSV. 
            // For simplicity, let's inject it into the first row's keys or just use a custom logic here.

            // Better: Prepend the metadata to the CSV content.
            // Since downloadCSV is generic, let's just pass the data and modify downloadCSV or handle it.
            // I'll modify downloadCSV call slightly or just reimplement the simple join here for this specific export if needed.
            // But downloadCSV is used by others.

            // Let's just create the CSV string here and download it, to avoid breaking other calls or modifying downloadCSV signature too much.

            const headers = Object.keys(flattenedData[0]);
            const csvRows = flattenedData.map(row => headers.map(header => {
                const value = row[header];
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value ?? '';
            }).join(','));

            const csvContent = [
                metadata, // Add metadata as the first line
                headers.join(','),
                ...csvRows
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Caravans_Report_${getFilterDisplayLabel(timeFilter)}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);

            toast.success(language === 'ar' ? 'تم تصدير الملف بنجاح' : 'File exported successfully');

        } catch (e) {
            console.error(e);
            toast.error('Failed to export all');
        }
    };

    return (
        <div className="space-y-6">


            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">{t('caravans.title')}</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">{t('admin.overview')}</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder={isRTL ? 'بحث باسم القافلة...' : 'Search by caravan name...'}
                            className="ltr:pl-8 rtl:pr-8 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Input
                        type="date"
                        className="w-full sm:w-auto"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                        <SelectTrigger className="w-full sm:w-[180px] h-10">
                            <SelectValue placeholder={isRTL ? 'اختر الفترة' : 'Select Period'} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                            <SelectItem value="weekly">{isRTL ? 'أسبوعي' : 'Weekly'}</SelectItem>
                            <SelectItem value="monthly">{isRTL ? 'شهري' : 'Monthly'}</SelectItem>
                            <SelectItem value="quarterly">{isRTL ? 'ربع سنوي' : 'Quarterly'}</SelectItem>
                            <SelectItem value="trimester">{isRTL ? 'ثلث سنوي' : 'Trimester'}</SelectItem>
                            <SelectItem value="semi_annual">{isRTL ? 'نصف سنوي' : 'Semi-Annual'}</SelectItem>
                            <SelectItem value="annual">{isRTL ? 'سنوي' : 'Annual'}</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="bg-card text-card-foreground shadow-sm border rounded-md px-3 h-10 flex items-center gap-2 min-w-fit">
                        <Bus className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{filteredCaravans.length}</span>
                        <span className="text-xs text-muted-foreground hidden lg:inline">{isRTL ? 'قافلة' : 'Caravans'}</span>
                    </div>

                    <Button variant="outline" onClick={exportAllCaravans} className="flex-1 sm:flex-none">
                        <FileSpreadsheet className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                        <span className="text-xs sm:text-sm">
                            {t('caravans.exportAll')} ({getFilterDisplayLabel(timeFilter)})
                        </span>
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="flex-1 sm:flex-none" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                                <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                <span className="text-xs sm:text-sm">{t('caravans.add')}</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold">{isEditMode ? (isRTL ? 'تعديل القافلة' : 'Edit Caravan') : t('caravans.add')}</DialogTitle>
                                <DialogDescription>{isEditMode ? (isRTL ? 'تعديل تفاصيل القافلة' : 'Edit caravan details') : (isRTL ? 'أضف تفاصيل القافلة الجديدة' : 'Add new caravan details')}</DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm sm:text-base font-medium">{t('caravans.name')}</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="h-11 sm:h-12"
                                            placeholder={isRTL ? 'مثال: قافلة إطعام رمضان' : 'e.g., Ramadan Food Caravan'}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm sm:text-base font-medium">{t('caravans.type')}</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={val => setFormData({ ...formData, type: val })}
                                        >
                                            <SelectTrigger className="h-11 sm:h-12">
                                                <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select Type'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="food_distribution">{isRTL ? 'إطعام' : 'Food Distribution'}</SelectItem>
                                                <SelectItem value="charity_market">{isRTL ? 'سوق خيري' : 'Charity Market'}</SelectItem>
                                                <SelectItem value="eid_carnival">{isRTL ? 'كرنفال العيد' : 'Eid Carnival'}</SelectItem>
                                                <SelectItem value="other">{isRTL ? 'أخرى' : 'Other'}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm sm:text-base font-medium">{t('caravans.location')}</Label>
                                        <Input
                                            value={formData.location}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                            className="h-11 sm:h-12"
                                            placeholder={isRTL ? 'مثال: قرية النهضة' : 'e.g., Al-Nahda Village'}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm sm:text-base font-medium">{t('caravans.date')}</Label>
                                        <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-11 sm:h-12" />
                                    </div>
                                </div>

                                <div className="space-y-2 sm:space-y-3">
                                    <Label className="text-sm sm:text-base font-medium">{isRTL ? 'مواعيد التحرك' : 'Timings'}</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <Label className="text-xs sm:text-sm text-muted-foreground">{t('caravans.moveTime')}</Label>
                                            <Input type="time" value={formData.move_time} onChange={e => setFormData({ ...formData, move_time: e.target.value })} className="h-11 sm:h-12" />
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <Label className="text-xs sm:text-sm text-muted-foreground">{t('caravans.actualMoveTime')}</Label>
                                            <Input type="time" value={formData.actual_move_time} onChange={e => setFormData({ ...formData, actual_move_time: e.target.value })} className="h-11 sm:h-12" />
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <Label className="text-xs sm:text-sm text-muted-foreground">{t('caravans.busArrivalTime')}</Label>
                                            <Input type="time" value={formData.bus_arrival_time} onChange={e => setFormData({ ...formData, bus_arrival_time: e.target.value })} className="h-11 sm:h-12" />
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <Label className="text-xs sm:text-sm text-muted-foreground">{t('caravans.returnTime')}</Label>
                                            <Input type="time" value={formData.return_time} onChange={e => setFormData({ ...formData, return_time: e.target.value })} className="h-11 sm:h-12" />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-4 sm:pt-6">
                                    <h3 className="text-sm sm:text-base font-medium mb-3 sm:mb-4">{t('caravans.participants')}</h3>

                                    <div className="space-y-4 sm:space-y-6">
                                        <div className="space-y-2 sm:space-y-3">
                                            <Label className="text-xs sm:text-sm text-muted-foreground">{t('caravans.addVolunteer')}</Label>
                                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
                                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" role="combobox" className="w-full sm:flex-1 justify-between h-11 sm:h-12">
                                                            <span className="truncate text-sm">{t('caravans.addVolunteer')}</span>
                                                            <ChevronsUpDown className="ltr:ml-2 rtl:mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0 w-[calc(100vw-2rem)] sm:w-[400px]" side="bottom" align="start">
                                                        <Command>
                                                            <CommandInput placeholder={t('common.search')} />
                                                            <CommandList className="max-h-[200px]">
                                                                <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results'}</CommandEmpty>
                                                                <CommandGroup>
                                                                    {volunteers.map((volunteer) => (
                                                                        <CommandItem
                                                                            key={volunteer.id}
                                                                            value={volunteer.full_name}
                                                                            onSelect={() => handleAddVolunteer(volunteer.id)}
                                                                        >
                                                                            <Check className={cn("ltr:mr-2 rtl:ml-2 h-4 w-4", "opacity-0")} />
                                                                            <div className="flex items-center gap-2">
                                                                                <Avatar className="h-6 w-6">
                                                                                    <AvatarImage src={volunteer.avatar_url || undefined} />
                                                                                    <AvatarFallback className="text-[10px]">{volunteer.full_name?.charAt(0)}</AvatarFallback>
                                                                                </Avatar>
                                                                                <span className="truncate text-sm">{volunteer.full_name}</span>
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>

                                                <div className="flex w-full sm:w-auto items-center space-x-2 rtl:space-x-reverse h-11 sm:h-12 border rounded-md px-3 bg-card/50">
                                                    <Switch
                                                        id="vest-toggle"
                                                        checked={woreVest}
                                                        onCheckedChange={setWoreVest}
                                                    />
                                                    <Label htmlFor="vest-toggle" className="cursor-pointer text-xs sm:text-sm whitespace-nowrap">
                                                        {isRTL ? 'ارتدى الـ Vest' : 'Wore Vest'}
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2 sm:space-y-3">
                                            <Label className="text-xs sm:text-sm text-muted-foreground">{t('caravans.addGuest')}</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                                                <Input
                                                    value={guestName}
                                                    onChange={e => setGuestName(e.target.value)}
                                                    placeholder={isRTL ? 'الاسم الثلاثي كاملاً' : 'Full tripartite name'}
                                                    className="h-11 sm:h-12 text-sm"
                                                />
                                                <Input
                                                    value={guestPhone}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (/^\d*$/.test(val)) setGuestPhone(val);
                                                    }}
                                                    placeholder={isRTL ? '01xxxxxxxxx' : '01xxxxxxxxx'}
                                                    className="h-11 sm:h-12 text-sm"
                                                    dir="ltr"
                                                />
                                                <Button onClick={handleAddGuest} variant="secondary" disabled={!guestName} className="h-11 sm:h-12 w-full text-sm">
                                                    <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                                    {isRTL ? 'إضافة ضيف' : 'Add Guest'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border rounded-md overflow-x-auto">
                                        <Table className="min-w-[400px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-xs sm:text-sm">{t('leaderboard.name')}</TableHead>
                                                    <TableHead className="text-xs sm:text-sm">{t('users.phoneNumber')}</TableHead>
                                                    <TableHead className="text-xs sm:text-sm">{t('users.role')}</TableHead>
                                                    <TableHead className="text-xs sm:text-sm w-20 text-center">{isRTL ? 'Vest' : 'Vest'}</TableHead>
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {participants.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">{isRTL ? 'لا يوجد مشاركين' : 'No participants added'}</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    participants.map((p, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="text-xs sm:text-sm truncate max-w-[120px]">{p.name}</TableCell>
                                                            <TableCell className="text-xs sm:text-sm">{p.phone}</TableCell>
                                                            <TableCell className="text-xs sm:text-sm">{p.is_volunteer ? t('common.volunteer') : t('caravans.addGuest')}</TableCell>
                                                            <TableCell className="text-center">
                                                                {p.is_volunteer && (
                                                                    p.wore_vest ?
                                                                        <Check className="w-4 h-4 text-green-500 mx-auto" /> :
                                                                        <X className="w-4 h-4 text-muted-foreground mx-auto opacity-50" />
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Button variant="ghost" size="sm" onClick={() => removeParticipant(idx)}>
                                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                            </div>

                            <DialogFooter className="gap-2 sm:gap-0 pt-3 sm:pt-4">
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="h-11 sm:h-12 px-4 sm:px-6 w-full sm:w-auto text-sm">{t('common.cancel')}</Button>
                                <Button onClick={isEditMode ? handleUpdateCaravan : handleCreateCaravan} className="h-11 sm:h-12 px-4 sm:px-6 w-full sm:w-auto text-sm">{isEditMode ? (isRTL ? 'تحديث' : 'Update') : t('common.save')}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCaravans.map(caravan => (
                    <Card key={caravan.id} className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{caravan.name}</CardTitle>
                                    <CardDescription>{getCaravanTypeLabel(caravan.type)}</CardDescription>
                                </div>
                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span className="sr-only">Open menu</span>
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditCaravan(caravan)} className="cursor-pointer">
                                            <Pencil className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                            {isRTL ? 'تعديل' : 'Edit'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => exportCaravanDetails(caravan)} className="cursor-pointer">
                                            <Download className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                            {isRTL ? 'تصدير الشيت' : 'Export Sheet'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                setCaravanToDelete(caravan);
                                                setIsDeleteDialogOpen(true);
                                            }}
                                            className="text-destructive focus:text-destructive cursor-pointer"
                                        >
                                            <Trash2 className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                            {isRTL ? 'حذف القافلة' : 'Delete Caravan'}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="w-4 h-4" />
                                    <span>{caravan.location}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="w-4 h-4" />
                                    <span>{caravan.date ? format(new Date(caravan.date), 'PPP') : 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Users className="w-4 h-4" />
                                    <span>{caravan.participants_count || 0} {t('caravans.participants')}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {filteredCaravans.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-muted-foreground">
                        <Bus className="w-12 h-12 mb-2 opacity-20" />
                        <p>{t('caravans.noCaravans')}</p>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Deletion'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? `هل أنت متأكد من حذف القافلة "${caravanToDelete?.name}"؟ سيتم حذف جميع المشاركين المسجلين في هذه القافلة.`
                                : `Are you sure you want to delete the caravan "${caravanToDelete?.name}"? All registered participants will be deleted.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCaravan}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? (isRTL ? 'جاري الحذف...' : 'Deleting...') : (isRTL ? 'حذف' : 'Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
