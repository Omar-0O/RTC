import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Calendar, Clock, MapPin, Users, Sparkles, Download, Plus, Trash2, Mic, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';

interface MyEvent {
    id: string;
    name: string;
    type: string;
    location: string;
    date: string;
    time: string | null;
    description: string | null;
    committee_name?: string;
}

interface Speaker {
    id: string;
    name: string;
    phone: string | null;
    social_media_link: string | null;
}

interface Beneficiary {
    id: string;
    name: string;
    phone: string | null;
}

export default function MyEvents() {
    const { user } = useAuth();
    const { isRTL } = useLanguage();

    const [events, setEvents] = useState<MyEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Beneficiaries
    const [beneficiariesOpen, setBeneficiariesOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<MyEvent | null>(null);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [newBeneficiary, setNewBeneficiary] = useState({ name: '', phone: '' });

    // Speakers
    const [speakersOpen, setSpeakersOpen] = useState(false);
    const [eventSpeakers, setEventSpeakers] = useState<Speaker[]>([]);

    useEffect(() => {
        if (user) fetchMyEvents();
    }, [user]);

    const fetchMyEvents = async () => {
        try {
            const { data: orgData, error: orgError } = await supabase
                .from('event_organizers')
                .select('event_id')
                .eq('volunteer_id', user!.id);

            if (orgError) throw orgError;
            if (!orgData || orgData.length === 0) {
                setEvents([]);
                setLoading(false);
                return;
            }

            const eventIds = orgData.map(o => o.event_id);
            const { data, error } = await supabase
                .from('events')
                .select('*, committees(name, name_ar)')
                .in('id', eventIds)
                .order('date', { ascending: false });

            if (error) throw error;

            setEvents((data || []).map((e: any) => ({
                ...e,
                committee_name: e.committees?.name_ar || e.committees?.name || ''
            })));
        } catch (error) {
            console.error('Error fetching my events:', error);
            toast.error(isRTL ? 'فشل تحميل إيفينتاتي' : 'Failed to load my events');
        } finally {
            setLoading(false);
        }
    };

    const openBeneficiaries = async (event: MyEvent) => {
        setSelectedEvent(event);
        setBeneficiariesOpen(true);
        const { data } = await supabase
            .from('event_beneficiaries')
            .select('*')
            .eq('event_id', event.id)
            .order('name');
        setBeneficiaries((data as Beneficiary[]) || []);
    };

    const handleAddBeneficiary = async () => {
        if (!selectedEvent || !newBeneficiary.name) return;
        try {
            const { data, error } = await supabase
                .from('event_beneficiaries')
                .insert({ event_id: selectedEvent.id, name: newBeneficiary.name, phone: newBeneficiary.phone || null })
                .select()
                .single();
            if (error) throw error;
            setBeneficiaries([...beneficiaries, data as Beneficiary]);
            setNewBeneficiary({ name: '', phone: '' });
            toast.success(isRTL ? 'تم إضافة المستفيد' : 'Beneficiary added');
        } catch {
            toast.error(isRTL ? 'فشل إضافة المستفيد' : 'Failed to add beneficiary');
        }
    };

    const handleRemoveBeneficiary = async (id: string) => {
        try {
            await supabase.from('event_beneficiaries').delete().eq('id', id);
            setBeneficiaries(beneficiaries.filter(b => b.id !== id));
            toast.success(isRTL ? 'تم حذف المستفيد' : 'Beneficiary removed');
        } catch {
            toast.error(isRTL ? 'فشل حذف المستفيد' : 'Failed to remove beneficiary');
        }
    };

    const openSpeakers = async (event: MyEvent) => {
        setSelectedEvent(event);
        setSpeakersOpen(true);
        const { data } = await supabase
            .from('event_speakers')
            .select('*')
            .eq('event_id', event.id)
            .order('name');
        setEventSpeakers((data as Speaker[]) || []);
    };

    const handleExportBeneficiaries = () => {
        if (!selectedEvent || beneficiaries.length === 0) {
            toast.error(isRTL ? 'لا توجد بيانات' : 'No data to export');
            return;
        }
        const rows = beneficiaries.map(b => ({
            [isRTL ? 'الاسم' : 'Name']: b.name,
            [isRTL ? 'الهاتف' : 'Phone']: b.phone || ''
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, isRTL ? 'المستفيدين' : 'Beneficiaries');
        XLSX.writeFile(wb, `${selectedEvent.name}_beneficiaries.xlsx`);
    };

    const formatTime = (timeStr: string | null) => {
        if (!timeStr) return '';
        try {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes);
            return format(date, 'h:mm a');
        } catch { return timeStr; }
    };

    const filteredEvents = events.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Sparkles className="h-7 w-7" />
                    {isRTL ? 'إيفينتاتي' : 'My Events'}
                </h1>
                <p className="text-muted-foreground">{isRTL ? 'الإيفينتات التي أنت منظم فيها' : 'Events you are organizing'}</p>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground rtl:right-2.5 rtl:left-auto" />
                <Input
                    placeholder={isRTL ? 'بحث...' : 'Search...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rtl:pr-9 rtl:pl-4"
                />
            </div>

            {filteredEvents.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">{isRTL ? 'لا توجد إيفينتات' : 'No events found'}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEvents.map(event => (
                        <Card key={event.id}>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">{event.name}</CardTitle>
                                <CardDescription>{event.type}</CardDescription>
                                {event.committee_name && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary mt-1 inline-block w-fit">
                                        {event.committee_name}
                                    </span>
                                )}
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
                                {event.description && (
                                    <p className="text-muted-foreground text-xs mt-2">{event.description}</p>
                                )}
                                <div className="flex gap-2 mt-3">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openBeneficiaries(event)}>
                                        <Users className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                        {isRTL ? 'المستفيدين' : 'Beneficiaries'}
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openSpeakers(event)}>
                                        <Mic className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                        {isRTL ? 'المتحدثون' : 'Speakers'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Beneficiaries Dialog */}
            <Dialog open={beneficiariesOpen} onOpenChange={setBeneficiariesOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'المستفيدين' : 'Beneficiaries'} - {selectedEvent?.name}</DialogTitle>
                        <DialogDescription>{isRTL ? 'إدارة مستفيدين الإيفينت' : 'Manage event beneficiaries'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
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
                                className="w-32"
                            />
                            <Button onClick={handleAddBeneficiary}><Plus className="h-4 w-4" /></Button>
                        </div>
                        {beneficiaries.length > 0 ? (
                            <>
                                <div className="border rounded-md overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                                <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {beneficiaries.map(b => (
                                                <TableRow key={b.id}>
                                                    <TableCell>{b.name}</TableCell>
                                                    <TableCell>{b.phone || '—'}</TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveBeneficiary(b.id)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleExportBeneficiaries}>
                                    <Download className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                                    {isRTL ? 'تصدير' : 'Export'}
                                </Button>
                            </>
                        ) : (
                            <p className="text-center text-muted-foreground py-4">{isRTL ? 'لا يوجد مستفيدين' : 'No beneficiaries yet'}</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Speakers Dialog */}
            <Dialog open={speakersOpen} onOpenChange={setSpeakersOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'المتحدثون' : 'Speakers'} - {selectedEvent?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {eventSpeakers.length > 0 ? eventSpeakers.map(s => (
                            <div key={s.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2 text-sm">
                                <Mic className="h-4 w-4 text-primary" />
                                <div>
                                    <span className="font-medium">{s.name}</span>
                                    {s.phone && <span className="text-muted-foreground ml-2">{s.phone}</span>}
                                    {s.social_media_link && (
                                        <a href={s.social_media_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 ml-2">
                                            <LinkIcon className="h-3 w-3 inline" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-muted-foreground py-4">{isRTL ? 'لا يوجد متحدثون' : 'No speakers'}</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
