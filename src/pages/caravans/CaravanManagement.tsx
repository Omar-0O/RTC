import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { Plus, Download, Bus, Calendar, Clock, MapPin, Users, Check, ChevronsUpDown, Trash2, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';


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
}

interface Volunteer {
    id: string;
    full_name: string;
    phone: string | null;
}

export default function CaravanManagement() {
    const { user } = useAuth();
    const { t, language, isRTL } = useLanguage();

    const [caravans, setCaravans] = useState<Caravan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);

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

    // Guest Input State
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    useEffect(() => {
        fetchCaravans();
        fetchVolunteers();
    }, []);

    const fetchCaravans = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('caravans')
                .select('*, participants_count:caravan_participants(count)')
                .order('date', { ascending: false });

            if (error) throw error;

            setCaravans(data.map(c => ({
                ...c,
                participants_count: c.participants_count?.[0]?.count || 0
            })));
        } catch (error) {
            console.error('Error fetching caravans:', error);
            toast.error('Failed to fetch caravans');
        } finally {
            setLoading(false);
        }
    };

    const fetchVolunteers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .order('full_name');
        if (data) setVolunteers(data);
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
            is_volunteer: true
        }]);
        setOpenCombobox(false);
    };

    const handleAddGuest = () => {
        if (!guestName) return;

        // Validate tripartite name (at least 3 parts)
        const nameParts = guestName.trim().split(/\s+/);
        if (nameParts.length < 3) {
            toast.error(isRTL ? 'يجب إدخال الاسم ثلاثي على الأقل' : 'Please enter at least a tripartite name');
            return;
        }

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

    const handleCreateCaravan = async () => {
        if (!formData.name || !formData.date || !formData.location) {
            toast.error(isRTL ? 'يرجى ملء البيانات الأساسية' : 'Please fill basic details');
            return;
        }

        try {
            // 1. Create Caravan
            const { data: caravan, error: caravanError } = await supabase
                .from('caravans')
                .insert({
                    ...formData,
                    created_by: user?.id
                })
                .select()
                .single();

            if (caravanError) throw caravanError;

            // 2. Add Participants
            if (participants.length > 0) {
                const { error: partsError } = await supabase
                    .from('caravan_participants')
                    .insert(participants.map(p => ({
                        caravan_id: caravan.id,
                        volunteer_id: p.volunteer_id || null,
                        name: p.name,
                        phone: p.phone,
                        is_volunteer: p.is_volunteer
                    })));

                if (partsError) throw partsError;
            }

            toast.success(isRTL ? 'تم إنشاء القافلة بنجاح' : 'Caravan created successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchCaravans();
        } catch (error) {
            console.error('Error creating caravan:', error);
            toast.error(isRTL ? 'حدث خطأ أثناء إنشاء القافلة' : 'Error creating caravan');
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
    };

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
        link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);

        toast.success(language === 'ar' ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
    };

    const exportCaravanDetails = async (caravan: Caravan) => {
        try {
            // Fetch participants
            const { data: parts } = await supabase
                .from('caravan_participants')
                .select('*')
                .eq('caravan_id', caravan.id);

            const exportData = (parts || []).map(p => ({
                [t('leaderboard.name')]: p.name,
                [t('users.phoneNumber')]: p.phone,
                [t('users.role')]: p.is_volunteer ? t('common.volunteer') : t('caravans.addGuest'),
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

    const exportAllCaravans = async () => {
        try {
            // Fetch all caravans with participants
            // This might be heavy, but let's assume reasonable size or paginate later.
            // For now, fetching simple list.
            const { data: allCaravans } = await supabase
                .from('caravans')
                .select('*, caravan_participants(*)');

            if (!allCaravans) return;

            const flattenedData: any[] = [];
            allCaravans.forEach(c => {
                if (c.caravan_participants && c.caravan_participants.length > 0) {
                    c.caravan_participants.forEach((p: any) => {
                        flattenedData.push({
                            [t('caravans.name')]: c.name,
                            [t('caravans.type')]: c.type,
                            [t('caravans.date')]: c.date,
                            [t('caravans.location')]: c.location,
                            [t('caravans.moveTime')]: c.move_time,
                            [t('caravans.actualMoveTime')]: c.actual_move_time,
                            [t('caravans.busArrivalTime')]: c.bus_arrival_time,
                            [t('caravans.returnTime')]: c.return_time,
                            [t('leaderboard.name')]: p.name,
                            [t('users.phoneNumber')]: p.phone,
                            [t('users.role')]: p.is_volunteer ? 'Volunteer' : 'Guest'
                        });
                    });
                } else {
                    // Entry for caravan even if no participants?
                    flattenedData.push({
                        [t('caravans.name')]: c.name,
                        [t('caravans.type')]: c.type,
                        [t('caravans.date')]: c.date,
                        [t('caravans.location')]: c.location,
                        [t('caravans.moveTime')]: c.move_time,
                        [t('caravans.actualMoveTime')]: c.actual_move_time,
                        [t('caravans.busArrivalTime')]: c.bus_arrival_time,
                        [t('caravans.returnTime')]: c.return_time,
                        [t('leaderboard.name')]: '-',
                        [t('users.phoneNumber')]: '-',
                        [t('users.role')]: '-'
                    });
                }
            });

            downloadCSV(flattenedData, 'All_Caravans_Report');

        } catch (e) {
            console.error(e);
            toast.error('Failed to export all');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{t('caravans.title')}</h1>
                    <p className="text-muted-foreground">{t('admin.overview')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportAllCaravans}>
                        <FileSpreadsheet className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                        {t('caravans.exportAll')}
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                                {t('caravans.add')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{t('caravans.add')}</DialogTitle>
                                <DialogDescription>Add new caravan details</DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{t('caravans.name')}</Label>
                                        <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('caravans.type')}</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={val => setFormData({ ...formData, type: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={isRTL ? 'اختر نوع القافلة' : 'Select Type'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="food_distribution">{isRTL ? 'إطعام' : 'Food Distribution'}</SelectItem>
                                                <SelectItem value="charity_market">{isRTL ? 'سوق خيري' : 'Charity Market'}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('caravans.location')}</Label>
                                        <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('caravans.date')}</Label>
                                        <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">{t('caravans.moveTime')}</Label>
                                        <Input type="time" value={formData.move_time} onChange={e => setFormData({ ...formData, move_time: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">{t('caravans.actualMoveTime')}</Label>
                                        <Input type="time" value={formData.actual_move_time} onChange={e => setFormData({ ...formData, actual_move_time: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">{t('caravans.busArrivalTime')}</Label>
                                        <Input type="time" value={formData.bus_arrival_time} onChange={e => setFormData({ ...formData, bus_arrival_time: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">{t('caravans.returnTime')}</Label>
                                        <Input type="time" value={formData.return_time} onChange={e => setFormData({ ...formData, return_time: e.target.value })} />
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h3 className="text-lg font-medium mb-4">{t('caravans.participants')}</h3>

                                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                                        <div className="flex-1">
                                            <Label className="text-xs mb-1 block">{t('caravans.addVolunteer')}</Label>
                                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                                        {t('caravans.addVolunteer')}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0" side="bottom">
                                                    <Command>
                                                        <CommandInput placeholder={t('common.search')} />
                                                        <CommandList>
                                                            <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results'}</CommandEmpty>
                                                            <CommandGroup>
                                                                {volunteers.map((volunteer) => (
                                                                    <CommandItem
                                                                        key={volunteer.id}
                                                                        value={volunteer.full_name}
                                                                        onSelect={() => handleAddVolunteer(volunteer.id)}
                                                                    >
                                                                        <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                                                        {volunteer.full_name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex-[2] flex gap-2 items-end">
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-xs">{t('caravans.addGuest')} ({t('users.fullName')})</Label>
                                                <Input value={guestName} onChange={e => setGuestName(e.target.value)} />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-xs">{t('users.phoneNumber')}</Label>
                                                <Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
                                            </div>
                                            <Button onClick={handleAddGuest} variant="secondary" disabled={!guestName}>
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t('leaderboard.name')}</TableHead>
                                                    <TableHead>{t('users.phoneNumber')}</TableHead>
                                                    <TableHead>{t('users.role')}</TableHead>
                                                    <TableHead></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {participants.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-muted-foreground">{isRTL ? 'لا يوجد مشاركين' : 'No participants added'}</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    participants.map((p, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>{p.name}</TableCell>
                                                            <TableCell>{p.phone}</TableCell>
                                                            <TableCell>{p.is_volunteer ? t('common.volunteer') : t('caravans.addGuest')}</TableCell>
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

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('common.cancel')}</Button>
                                <Button onClick={handleCreateCaravan}>{t('common.save')}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {caravans.map(caravan => (
                    <Card key={caravan.id}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{caravan.name}</CardTitle>
                                    <CardDescription>{caravan.type}</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => exportCaravanDetails(caravan)}>
                                    <Download className="w-4 h-4" />
                                </Button>
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
                                    <span>{format(new Date(caravan.date), 'PPP')}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Users className="w-4 h-4" />
                                    <span>{caravan.participants_count || 0} {t('caravans.participants')}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {caravans.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-muted-foreground">
                        <Bus className="w-12 h-12 mb-2 opacity-20" />
                        <p>{t('caravans.noCaravans')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
