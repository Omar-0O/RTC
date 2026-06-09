import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Plus, Download, Bus, Calendar, Clock, MapPin, Users, Check, ChevronsUpDown, Trash2, FileSpreadsheet, X, Search, Pencil, MoreVertical, BarChart3 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StatsCard } from '@/components/ui/stats-card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';


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
    target_meals?: number | null;
    actual_meals?: number | null;
    total_bags?: number | null;
    bag_contents?: string[] | null;
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
    const { activeBranch } = useBranch();

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
        return_time: '',
        target_meals: '',
        actual_meals: '',
        total_bags: '',
        bag_contents: ''
    });

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [isVolunteerSelectorOpen, setIsVolunteerSelectorOpen] = useState(false);
    const [volunteerSearch, setVolunteerSearch] = useState('');
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
            return_time: caravan.return_time || '',
            target_meals: caravan.target_meals !== undefined && caravan.target_meals !== null ? String(caravan.target_meals) : '',
            actual_meals: caravan.actual_meals !== undefined && caravan.actual_meals !== null ? String(caravan.actual_meals) : '',
            total_bags: caravan.total_bags !== undefined && caravan.total_bags !== null ? String(caravan.total_bags) : '',
            bag_contents: caravan.bag_contents ? caravan.bag_contents.join(', ') : ''
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
            const updatePayload: any = {
                name: formData.name,
                type: formData.type,
                location: formData.location,
                date: formData.date,
                move_time: formData.move_time || null,
                actual_move_time: formData.actual_move_time || null,
                bus_arrival_time: formData.bus_arrival_time || null,
                return_time: formData.return_time || null,
                target_meals: formData.type === 'food_distribution' ? (formData.target_meals ? Number(formData.target_meals) : null) : null,
                actual_meals: formData.type === 'food_distribution' ? (formData.actual_meals ? Number(formData.actual_meals) : null) : null,
                total_bags: formData.type === 'charity_market' ? (formData.total_bags ? Number(formData.total_bags) : null) : null,
                bag_contents: formData.type === 'charity_market' ? (formData.bag_contents.trim() ? formData.bag_contents.split(',').map((item: string) => item.trim()).filter(Boolean) : null) : null
            };

            const { error: updateError } = await supabase
                .from('caravans')
                .update(updatePayload)
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
        const cacheKey = `rtc_caravans_data_${user?.id}`;
        const cached = localStorage.getItem(cacheKey);
        let hasCache = false;
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    setCaravans(parsed);
                    setLoading(false);
                    hasCache = true;
                }
            } catch (e) {
                console.error('Error parsing cached caravans:', e);
            }
        }

        fetchCaravans(hasCache);
        fetchVolunteers();
        fetchCaravansCommittee();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBranch?.id, user]);

    const fetchCaravans = async (hasCache = false) => {
        if (!hasCache) {
            setLoading(true);
        }
        try {
            let query: any = supabase
                .from('caravans')
                .select('*, participants_count:caravan_participants(count)');

            if (activeBranch?.id) {
                query = query.eq('branch_id', activeBranch.id);
            }

            const { data, error } = await query.order('date', { ascending: false });

            if (error) throw error;

            const caravansData = (data || []).map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                ...c,
                participants_count: c.participants_count?.[0]?.count || 0
            } as Caravan));
            setCaravans(caravansData);

            const cacheKey = `rtc_caravans_data_${user?.id}`;
            localStorage.setItem(cacheKey, JSON.stringify(caravansData));
        } catch (error) {
            console.error('Error fetching caravans:', error);
            toast.error(isRTL ? 'فشل في تحميل القوافل' : 'Failed to fetch caravans');
        } finally {
            setLoading(false);
        }
    };

    const fetchVolunteers = async () => {
        let query: any = (supabase as any)
            .from('profiles')
            .select('id, full_name, phone, committee_id, avatar_url')
            .neq('full_name', 'RTC Admin');

        if (activeBranch?.id) {
            query = query.eq('branch_id', activeBranch.id);
        }

        const { data } = await query.order('full_name');
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
        // Keep selector open for multi-selection (user closes with "تمام!")
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

        // Validate guest phone if provided
        if (guestPhone) {
            if (guestPhone.length !== 11 || !guestPhone.startsWith('01')) {
                toast.error(isRTL ? 'يجب أن يكون رقم الهاتف مكوناً من 11 رقماً ويبدأ بـ 01' : 'Phone number must be exactly 11 digits and start with 01');
                return;
            }
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

    const toggleParticipantVest = (index: number) => {
        const newParticipants = [...participants];
        newParticipants[index].wore_vest = !newParticipants[index].wore_vest;
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
            const insertPayload: any = {
                name: formData.name,
                type: formData.type,
                location: formData.location,
                date: formData.date,
                move_time: formData.move_time || null,
                actual_move_time: formData.actual_move_time || null,
                bus_arrival_time: formData.bus_arrival_time || null,
                return_time: formData.return_time || null,
                created_by: user?.id,
                branch_id: activeBranch?.id || null,
                target_meals: formData.type === 'food_distribution' ? (formData.target_meals ? Number(formData.target_meals) : null) : null,
                actual_meals: formData.type === 'food_distribution' ? (formData.actual_meals ? Number(formData.actual_meals) : null) : null,
                total_bags: formData.type === 'charity_market' ? (formData.total_bags ? Number(formData.total_bags) : null) : null,
                bag_contents: formData.type === 'charity_market' ? (formData.bag_contents.trim() ? formData.bag_contents.split(',').map((item: string) => item.trim()).filter(Boolean) : null) : null
            };

            const { data: caravan, error: caravanError } = await supabase
                .from('caravans' as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .insert(insertPayload)
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
            return_time: '',
            target_meals: '',
            actual_meals: '',
            total_bags: '',
            bag_contents: ''
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
             toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
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
             toast.error(isRTL ? 'فشل تصدير الكل' : 'Failed to export all');
        }
    };

    return (
        <div className="space-y-6">


            {/* Header and Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold">{t('caravans.title')}</h1>
                
                <div className="flex w-full sm:w-auto gap-2">
                    <Button variant="outline" onClick={exportAllCaravans} className="flex-1 sm:flex-none">
                        <FileSpreadsheet className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                        <span className="text-xs sm:text-sm">
                            {t('caravans.exportAll')} <span className="hidden sm:inline">({getFilterDisplayLabel(timeFilter)})</span>
                        </span>
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="flex-1 sm:flex-none" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                                <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                <span className="text-xs sm:text-sm">{t('caravans.add')}</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl">
                            <DialogHeader className="px-4 sm:px-6 py-5 border-b-2 border-border/50 dark:border-border/80 shrink-0 bg-muted/30 flex flex-col items-center text-center">
                                <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
                                    <Bus className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                    {isEditMode ? (isRTL ? 'تعديل القافلة' : 'Edit Caravan') : t('caravans.add')}
                                </DialogTitle>
                                <DialogDescription className="text-center mt-1.5">{isEditMode ? (isRTL ? 'تعديل تفاصيل القافلة' : 'Edit caravan details') : (isRTL ? 'أضف تفاصيل القافلة الجديدة' : 'Add new caravan details')}</DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-8">
                                {/* القسم الأول: البيانات الأساسية */}
                                <div className="space-y-4 sm:space-y-5">
                                    <h3 className="text-lg sm:text-xl font-bold border-b-2 border-primary/20 dark:border-primary/40 pb-2 flex items-center gap-2 text-foreground/90">
                                        <MapPin className="h-5 w-5 text-primary" />
                                        {isRTL ? 'البيانات الأساسية' : 'Basic Info'}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                            <div className="space-y-2 relative">
                                                <Label className="text-sm font-semibold">{t('caravans.name')} <span className="text-destructive">*</span></Label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    className={`h-11 sm:h-12 ${!formData.name ? 'border-primary/20 hover:border-primary/50' : ''}`}
                                                    placeholder={isRTL ? 'مثال: قافلة إطعام رمضان' : 'e.g., Ramadan Food Caravan'}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold">{t('caravans.type')} <span className="text-destructive">*</span></Label>
                                                <Select
                                                    value={formData.type}
                                                    onValueChange={val => setFormData({ ...formData, type: val })}
                                                    dir={isRTL ? 'rtl' : 'ltr'}
                                                >
                                                    <SelectTrigger className={`h-11 sm:h-12 ${!formData.type ? 'border-primary/20 hover:border-primary/50' : ''}`}>
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
                                            <div className="space-y-2 relative">
                                                <Label className="text-sm font-semibold flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {t('caravans.location')} <span className="text-destructive">*</span>
                                                </Label>
                                                <Input
                                                    value={formData.location}
                                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                                    className={`h-11 sm:h-12 ${!formData.location ? 'border-primary/20 hover:border-primary/50' : ''}`}
                                                    placeholder={isRTL ? 'مثال: قرية النهضة' : 'e.g., Al-Nahda Village'}
                                                />
                                            </div>
                                             <div className="space-y-2 relative">
                                                 <Label className="text-sm font-semibold flex items-center gap-1.5">
                                                     <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                     {t('caravans.date')} <span className="text-destructive">*</span>
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
                                            
                                            {formData.type === 'food_distribution' && (
                                                <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/50 pt-4 mt-2">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-semibold">{isRTL ? 'وجبات التارجت (العدد المستهدف)' : 'Target Meals'}</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.target_meals}
                                                            onChange={e => setFormData({ ...formData, target_meals: e.target.value })}
                                                            placeholder="100"
                                                            className="h-11 sm:h-12"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-semibold">{isRTL ? 'العدد الفعلي للوجبات' : 'Actual Meals'}</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.actual_meals}
                                                            onChange={e => setFormData({ ...formData, actual_meals: e.target.value })}
                                                            placeholder="110"
                                                            className="h-11 sm:h-12"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {formData.type === 'charity_market' && (
                                                <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/50 pt-4 mt-2">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-semibold">{isRTL ? 'عدد الشنط' : 'Total Bags'}</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.total_bags}
                                                            onChange={e => setFormData({ ...formData, total_bags: e.target.value })}
                                                            placeholder="50"
                                                            className="h-11 sm:h-12"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-semibold">{isRTL ? 'محتويات الشنطة (مفصولة بفواصل)' : 'Bag Contents (comma-separated)'}</Label>
                                                        <Input
                                                            value={formData.bag_contents}
                                                            onChange={e => setFormData({ ...formData, bag_contents: e.target.value })}
                                                            placeholder={isRTL ? 'مثال: كيلو سكر، كيلو زيت، علبة سمن' : 'e.g., Sugar, Oil, Rice'}
                                                            className="h-11 sm:h-12"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                </div>

                                {/* القسم الثاني: المواعيد */}
                                <div className="space-y-4 sm:space-y-5">
                                    <h3 className="text-lg sm:text-xl font-bold border-b-2 border-primary/20 dark:border-primary/40 pb-2 flex items-center gap-2 text-foreground/90">
                                        <Clock className="h-5 w-5 text-primary" />
                                        {isRTL ? 'المواعيد الزمانية' : 'Timings'}
                                    </h3>
                                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                {isRTL ? 'أدخل مواعيد القافلة لتتبع الجدول الزمني بدقة.' : 'Enter caravan timings for accurate scheduling tracking.'}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                                <div className="space-y-2 relative">
                                                    <Label className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                                                        {t('caravans.moveTime')}
                                                    </Label>
                                                    <Input type="time" value={formData.move_time} onChange={e => setFormData({ ...formData, move_time: e.target.value })} className="h-11" />
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5 text-orange-500" />
                                                        {t('caravans.actualMoveTime')}
                                                    </Label>
                                                    <Input type="time" value={formData.actual_move_time} onChange={e => setFormData({ ...formData, actual_move_time: e.target.value })} className="h-11" />
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5 text-emerald-500" />
                                                        {t('caravans.busArrivalTime')}
                                                    </Label>
                                                    <Input type="time" value={formData.bus_arrival_time} onChange={e => setFormData({ ...formData, bus_arrival_time: e.target.value })} className="h-11" />
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5 text-purple-500" />
                                                        {t('caravans.returnTime')}
                                                    </Label>
                                                    <Input type="time" value={formData.return_time} onChange={e => setFormData({ ...formData, return_time: e.target.value })} className="h-11" />
                                                </div>
                                            </div>
                                        </div>
                                </div>

                                {/* القسم الثالث: المشاركين */}
                                <div className="space-y-4 sm:space-y-5">
                                    <h3 className="text-lg sm:text-xl font-bold border-b-2 border-primary/20 dark:border-primary/40 pb-2 flex items-center gap-2 text-foreground/90">
                                        <Users className="h-5 w-5 text-primary" />
                                        {isRTL ? 'المشاركين' : 'Participants'}
                                        {participants.length > 0 && (
                                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                                                {participants.length}
                                            </span>
                                        )}
                                    </h3>
                                    <div className="space-y-4 sm:space-y-5 flex flex-col h-full min-h-[300px]">
                                        {/* Actions Row: Add Volunteer & Add Guest */}
                                        <div className="flex flex-col gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
                                            <Button
                                                type="button"
                                                className="w-full h-10 sm:h-11 shadow-sm"
                                                onClick={() => { setVolunteerSearch(''); setIsVolunteerSelectorOpen(true); }}
                                            >
                                                <Users className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                                                <span className="text-sm font-medium">
                                                    {isRTL ? 'إضافة متطوعين' : 'Add Volunteers'}
                                                </span>
                                            </Button>

                                            <div className="pt-3 border-t-2 border-primary/10 dark:border-primary/20 flex flex-col gap-2 w-full mt-1">
                                                <span className="text-xs font-medium text-muted-foreground px-1">
                                                    {isRTL ? 'إضافة ضيف (من خارج المتطوعين):' : 'Add guest (non-volunteer):'}
                                                </span>
                                                <div className="flex flex-col sm:flex-row gap-2 w-full">
                                                <Input
                                                    value={guestName}
                                                    onChange={e => setGuestName(e.target.value)}
                                                    placeholder={isRTL ? 'الاسم الثلاثي (ضيف)' : 'Guest Full Name'}
                                                    className="h-10 sm:h-11 text-sm bg-background flex-1"
                                                />
                                                <Input
                                                    value={guestPhone}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (/^\d*$/.test(val)) setGuestPhone(val);
                                                    }}
                                                    placeholder={isRTL ? 'رقم الموبايل 01xxxxxxxxx' : '01xxxxxxxxx'}
                                                    className="h-10 sm:h-11 text-sm bg-background flex-1"
                                                    dir="ltr"
                                                    maxLength={11}
                                                />
                                                <Button onClick={handleAddGuest} variant="secondary" disabled={!guestName} className="h-10 sm:h-11 w-full sm:w-auto shrink-0">
                                                    <Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1 sm:block" />
                                                    {isRTL ? 'إضافة ضيف' : 'Add Guest'}
                                                </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Participants List */}
                                        <div className="border rounded-xl overflow-hidden shadow-sm bg-card flex-1 flex flex-col">
                                            {participants.length === 0 ? (
                                                <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center text-muted-foreground bg-muted/5 flex-1">
                                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                                        <Users className="h-6 w-6 opacity-50" />
                                                    </div>
                                                    <p className="text-sm font-medium">{isRTL ? 'لا يوجد مشاركين بعد' : 'No participants added yet'}</p>
                                                    <p className="text-xs opacity-70 mt-1">{isRTL ? 'قم بإضافة متطوعين أو ضيوف للبدء' : 'Add volunteers or guests to begin'}</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto w-full max-h-[350px] overflow-y-auto">
                                                    <Table className="min-w-[500px]">
                                                        <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                                                            <TableRow>
                                                                <TableHead className="text-xs sm:text-sm font-semibold">{t('leaderboard.name')}</TableHead>
                                                                <TableHead className="text-xs sm:text-sm font-semibold">{t('users.role')}</TableHead>
                                                                <TableHead className="text-xs sm:text-sm font-semibold text-center w-24">{isRTL ? 'Vest' : 'Vest'}</TableHead>
                                                                <TableHead className="w-12"></TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {participants.map((p, idx) => (
                                                                <TableRow key={idx} className="group hover:bg-muted/20">
                                                                    <TableCell>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs sm:text-sm font-medium truncate max-w-[160px] sm:max-w-xs">{p.name}</span>
                                                                            {p.phone && <span className="text-[10px] sm:text-xs text-muted-foreground font-mono" dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>{p.phone}</span>}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${p.is_volunteer ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                                                            {p.is_volunteer ? t('common.volunteer') : t('caravans.addGuest')}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-center align-middle">
                                                                        {p.is_volunteer ? (
                                                                            <div className="flex justify-center">
                                                                                <Switch
                                                                                    checked={p.wore_vest}
                                                                                    onCheckedChange={() => toggleParticipantVest(idx)}
                                                                                    className="scale-75 sm:scale-90"
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-xs text-muted-foreground opacity-50">—</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-end align-middle">
                                                                        <Button variant="ghost" size="icon" onClick={() => removeParticipant(idx)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>

                                        {/* Full-screen Volunteer Selector Dialog */}
                                        <Dialog open={isVolunteerSelectorOpen} onOpenChange={setIsVolunteerSelectorOpen}>
                                            <DialogContent className="w-full max-w-[95vw] sm:max-w-md max-h-[92vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
                                                <div className="flex items-center justify-between px-4 py-4 border-b bg-background shrink-0">
                                                    <DialogTitle className="text-base sm:text-lg font-bold">
                                                        {isRTL ? 'اختر المتطوعين' : 'Select Volunteers'}
                                                    </DialogTitle>
                                                </div>
                                                <div className="px-4 py-3 border-b bg-muted/10 shrink-0">
                                                    <div className="relative">
                                                        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            className="ltr:pl-9 rtl:pr-9 h-10 shadow-sm"
                                                            placeholder={isRTL ? 'بحث باسم المتطوع...' : 'Search volunteers...'}
                                                            value={volunteerSearch}
                                                            onChange={e => setVolunteerSearch(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-2">
                                                    {volunteers
                                                        .filter(v => v.full_name.toLowerCase().includes(volunteerSearch.toLowerCase()))
                                                        .map(volunteer => {
                                                            const isAdded = participants.some(p => p.volunteer_id === volunteer.id);
                                                            return (
                                                                <button
                                                                    key={volunteer.id}
                                                                    type="button"
                                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-start transition-colors mb-1 ${isAdded ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'hover:bg-muted'}`}
                                                                    onClick={() => {
                                                                        if (!isAdded) handleAddVolunteer(volunteer.id);
                                                                        else {
                                                                            const idx = participants.findIndex(p => p.volunteer_id === volunteer.id);
                                                                            if (idx !== -1) removeParticipant(idx);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Avatar className="h-9 w-9 shrink-0 border border-background shadow-sm">
                                                                        <AvatarImage src={volunteer.avatar_url || undefined} />
                                                                        <AvatarFallback className="text-xs font-semibold bg-background">{volunteer.full_name?.charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span className={`flex-1 text-sm truncate ${isAdded ? 'font-semibold' : 'font-medium'}`}>{volunteer.full_name}</span>
                                                                    {isAdded ? (
                                                                        <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                                                                            <Check className="h-3 w-3" />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="h-5 w-5 rounded-full border border-muted-foreground/30 flex items-center justify-center shrink-0" />
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    {volunteers.filter(v => v.full_name.toLowerCase().includes(volunteerSearch.toLowerCase())).length === 0 && (
                                                        <div className="text-center text-muted-foreground text-sm py-12 flex flex-col items-center">
                                                            <Search className="h-8 w-8 opacity-20 mb-3" />
                                                            {isRTL ? 'لا يوجد نتائج تطابق بحثك' : 'No results found'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="px-4 py-3 border-t bg-background shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                                                    <Button
                                                        className="w-full h-11 font-semibold"
                                                        onClick={() => setIsVolunteerSelectorOpen(false)}
                                                    >
                                                        <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                        {isRTL
                                                            ? `تمام! (${participants.filter(p => p.is_volunteer).length} مختار)`
                                                            : `Done! (${participants.filter(p => p.is_volunteer).length} selected)`}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t-2 border-border/50 dark:border-border/80 bg-muted/10 shrink-0">
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="h-11 sm:h-12 px-4 sm:px-8 w-full sm:w-auto text-sm font-medium">
                                    {t('common.cancel')}
                                </Button>
                                <Button onClick={isEditMode ? handleUpdateCaravan : handleCreateCaravan} className="h-11 sm:h-12 px-4 sm:px-8 w-full sm:w-auto text-sm font-semibold shadow-sm">
                                    {isEditMode ? (isRTL ? 'تحديث البيانات' : 'Update Info') : (isRTL ? 'حفظ القافلة' : 'Save Caravan')}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 sm:p-4 rounded-xl border border-border/50">
                <div className="relative">
                    <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder={isRTL ? 'بحث باسم القافلة...' : 'Search by caravan name...'}
                        className="ltr:pl-9 rtl:pr-9 w-full bg-background"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="relative w-full">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full justify-start text-start font-normal bg-background h-10 border border-input",
                                    filterDate ? (isRTL ? "pl-8" : "pr-8") : "",
                                    !filterDate && "text-muted-foreground"
                                )}
                            >
                                <Calendar className="ltr:mr-2 rtl:ml-2 h-4 w-4 shrink-0" />
                                {filterDate ? (
                                    format(new Date(filterDate), "PPP", { locale: isRTL ? ar : undefined })
                                ) : (
                                    <span>{isRTL ? 'اختر التاريخ...' : 'Choose Date...'}</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                                mode="single"
                                selected={filterDate ? new Date(filterDate) : undefined}
                                onSelect={(date) => setFilterDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                initialFocus
                                captionLayout="dropdown-buttons"
                                fromYear={2020}
                                toYear={new Date().getFullYear() + 5}
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
                <Select value={timeFilter} onValueChange={setTimeFilter} dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectTrigger className="w-full bg-background h-10">
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
            </div>

            {/* Statistics Section */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 sm:p-6 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                
                <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2 text-foreground/90 relative z-10">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    {isRTL ? 'الإحصائيات والتقارير' : 'Statistics & Reports'}
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 relative z-10">
                    <StatsCard
                        title={isRTL ? 'إجمالي القوافل' : 'Total Caravans'}
                        value={filteredCaravans.length.toString()}
                        icon={Bus}
                    />
                    <StatsCard
                        title={isRTL ? 'إجمالي المشاركين' : 'Total Participants'}
                        value={filteredCaravans.reduce((sum, c) => sum + (c.participants_count || 0), 0).toString()}
                        icon={Users}
                    />
                    <StatsCard
                        className="col-span-2 lg:col-span-1"
                        title={isRTL ? 'آخر قافلة' : 'Most Recent'}
                        value={filteredCaravans.length > 0 ? format(new Date(filteredCaravans[0].date), isRTL ? 'dd MMMM yyyy' : 'MMM dd, yyyy', { locale: isRTL ? ar : undefined }) : (isRTL ? 'لا يوجد' : 'None')}
                        icon={Calendar}
                    />
                </div>
            </div>

            {/* Caravans List Section */}
            <div className="space-y-4">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2 text-foreground/90">
                    <Bus className="w-5 h-5 text-primary" />
                    {isRTL ? 'سجل القوافل' : 'Caravans Log'}
                </h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCaravans.map(caravan => (
                    <Card key={caravan.id} className="group relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-primary/40 bg-card/50 backdrop-blur-sm">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary"></div>
                        <CardHeader className="pb-2 pt-5">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-2 min-w-0">
                                    <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors truncate">
                                        {caravan.name}
                                    </CardTitle>
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                        {getCaravanTypeLabel(caravan.type)}
                                    </div>
                                </div>
                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="h-8 w-8 p-0 shrink-0 hover:bg-primary/10"
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
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-3 text-sm">
                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الموقع' : 'Location'}</span>
                                    <div className="flex items-center gap-2 font-medium">
                                        <div className="w-7 h-7 rounded-md bg-secondary/60 flex items-center justify-center shrink-0">
                                            <MapPin className="w-3.5 h-3.5 text-foreground/70" />
                                        </div>
                                        <span className="truncate">{caravan.location}</span>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'التاريخ' : 'Date'}</span>
                                    <div className="flex items-center gap-2 font-medium">
                                        <div className="w-7 h-7 rounded-md bg-secondary/60 flex items-center justify-center shrink-0">
                                            <Calendar className="w-3.5 h-3.5 text-foreground/70" />
                                        </div>
                                        <span className="truncate">{caravan.date ? format(new Date(caravan.date), isRTL ? 'dd MMM yyyy' : 'MMM dd, yyyy', { locale: isRTL ? ar : undefined }) : 'N/A'}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'المشاركون' : 'Participants'}</span>
                                    <div className="flex items-center gap-2 font-medium">
                                        <div className="w-7 h-7 rounded-md bg-secondary/60 flex items-center justify-center shrink-0">
                                            <Users className="w-3.5 h-3.5 text-foreground/70" />
                                        </div>
                                        <span className="truncate">{caravan.participants_count || 0}</span>
                                    </div>
                                </div>

                                {caravan.type === 'food_distribution' && (
                                    <>
                                        {(caravan.target_meals !== null && caravan.target_meals !== undefined) && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الهدف (وجبات)' : 'Target Meals'}</span>
                                                <div className="flex items-center gap-2 font-medium">
                                                    <span className="text-base text-primary font-bold">{caravan.target_meals}</span>
                                                </div>
                                            </div>
                                        )}
                                        {(caravan.actual_meals !== null && caravan.actual_meals !== undefined) && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'الفعلي (وجبات)' : 'Actual Meals'}</span>
                                                <div className="flex items-center gap-2 font-medium">
                                                    <span className="text-base text-emerald-600 dark:text-emerald-400 font-bold">{caravan.actual_meals}</span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {caravan.type === 'charity_market' && (
                                    <>
                                        {(caravan.total_bags !== null && caravan.total_bags !== undefined) && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'عدد الشنط' : 'Total Bags'}</span>
                                                <div className="flex items-center gap-2 font-medium">
                                                    <span className="text-base text-primary font-bold">{caravan.total_bags}</span>
                                                </div>
                                            </div>
                                        )}
                                        {caravan.bag_contents && caravan.bag_contents.length > 0 && (
                                            <div className="flex flex-col gap-1.5 col-span-2">
                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{isRTL ? 'محتويات الشنطة' : 'Bag Contents'}</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {caravan.bag_contents.map((item, idx) => (
                                                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border">
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
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
