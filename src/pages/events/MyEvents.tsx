import { useState, useEffect, useCallback } from 'react';
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
import { CACHE_TTL, getLocalCache, setLocalCache } from '@/utils/localCache';
import { exportXlsxSheets } from '@/utils/xlsx';
import type { SpreadsheetRow } from '@/utils/spreadsheetSecurity';
import { toSafeExternalUrl } from '@/utils/safeUrls';

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

type MyEventQueryRow = MyEvent & {
    committees?: {
        name: string | null;
        name_ar: string | null;
    } | null;
};

const isMyEventCache = (value: unknown): value is MyEvent[] => Array.isArray(value);

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

    const fetchMyEvents = useCallback(async (hasCache = false) => {
        if (!user?.id) return;
        if (!hasCache) {
            setLoading(true);
        }
        try {
            const { data: orgData, error: orgError } = await supabase
                .from('event_organizers')
                .select('event_id')
                .eq('volunteer_id', user.id);

            if (orgError) throw orgError;
            if (!orgData || orgData.length === 0) {
                setEvents([]);
                const cacheKey = `rtc_my_events_data_${user?.id}`;
                setLocalCache(cacheKey, [], CACHE_TTL.short);
                setLoading(false);
                return;
            }

            const eventIds = orgData.map(o => o.event_id);
            const { data, error } = await supabase
                .from('events')
                .select('id, name, type, location, date, time, description, committees(name, name_ar)')
                .in('id', eventIds)
                .order('date', { ascending: false });

            if (error) throw error;

            const eventsData = ((data || []) as MyEventQueryRow[]).map((e) => ({
                ...e,
                committee_name: e.committees?.name_ar || e.committees?.name || ''
            }));
            setEvents(eventsData);

            const cacheKey = `rtc_my_events_data_${user?.id}`;
            setLocalCache(cacheKey, eventsData, CACHE_TTL.short);
        } catch (error) {
            console.error('Error fetching my events:', error);
            toast.error(isRTL ? 'فشل تحميل إيفينتاتي' : 'Failed to load my events');
        } finally {
            setLoading(false);
        }
    }, [user?.id, isRTL]);

    useEffect(() => {
        if (!user?.id) {
            setEvents([]);
            setLoading(false);
            return;
        }

        const cacheKey = `rtc_my_events_data_${user.id}`;
        const cached = getLocalCache<MyEvent[]>(cacheKey, isMyEventCache);
        let hasCache = false;
        if (cached) {
            setEvents(cached);
            setLoading(false);
            hasCache = true;
        }
        void fetchMyEvents(hasCache);
    }, [user?.id, fetchMyEvents]);

    const openBeneficiaries = async (event: MyEvent) => {
        setSelectedEvent(event);
        setBeneficiariesOpen(true);
        try {
            const { data, error } = await supabase
                .from('event_beneficiaries')
                .select('id, name, phone')
                .eq('event_id', event.id)
                .order('name');
            if (error) throw error;
            setBeneficiaries((data as Beneficiary[]) || []);
        } catch (error) {
            console.error('Error fetching beneficiaries:', error);
            toast.error(isRTL ? 'فشل تحميل المستفيدين' : 'Failed to load beneficiaries');
        }
    };

    const handleAddBeneficiary = async () => {
        const name = newBeneficiary.name.trim();
        if (!selectedEvent || !name) return;

        try {
            const { data, error } = await supabase
                .from('event_beneficiaries')
                .insert({ event_id: selectedEvent.id, name, phone: newBeneficiary.phone.trim() || null })
                .select('id, name, phone')
                .single();
            if (error) throw error;
            setBeneficiaries((current) => [...current, data as Beneficiary]);
            setNewBeneficiary({ name: '', phone: '' });
            toast.success(isRTL ? 'تم إضافة المستفيد' : 'Beneficiary added');
        } catch (error) {
            console.error('Error adding beneficiary:', error);
            toast.error(isRTL ? 'فشل إضافة المستفيد' : 'Failed to add beneficiary');
        }
    };

    const handleRemoveBeneficiary = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('event_beneficiaries')
                .delete()
                .eq('id', id)
                .select('id');
            if (error) throw error;
            if (!data?.length) throw new Error('Beneficiary was not found or cannot be removed');

            setBeneficiaries((current) => current.filter((beneficiary) => beneficiary.id !== id));
            toast.success(isRTL ? 'تم حذف المستفيد' : 'Beneficiary removed');
        } catch (error) {
            console.error('Error removing beneficiary:', error);
            toast.error(isRTL ? 'فشل حذف المستفيد' : 'Failed to remove beneficiary');
        }
    };

    const openSpeakers = async (event: MyEvent) => {
        setSelectedEvent(event);
        setSpeakersOpen(true);
        try {
            const { data, error } = await supabase
                .from('event_speakers')
                .select('id, name, phone, social_media_link')
                .eq('event_id', event.id)
                .order('name');
            if (error) throw error;
            setEventSpeakers((data as Speaker[]) || []);
        } catch (error) {
            console.error('Error fetching speakers:', error);
            toast.error(isRTL ? 'فشل تحميل المتحدثين' : 'Failed to load speakers');
        }
    };

    const handleExportBeneficiaries = async () => {
        if (!selectedEvent || beneficiaries.length === 0) {
            toast.error(isRTL ? 'لا توجد بيانات' : 'No data to export');
            return;
        }
        const rows: SpreadsheetRow[] = beneficiaries.map(b => ({
            [isRTL ? 'الاسم' : 'Name']: b.name,
            [isRTL ? 'الهاتف' : 'Phone']: b.phone || ''
        }));

        await exportXlsxSheets(
            [{ name: isRTL ? 'المستفيدين' : 'Beneficiaries', rows }],
            `${selectedEvent.name}_beneficiaries.xlsx`,
        );
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
                                                {beneficiaries.map(b => (
                                                    <TableRow key={b.id}>
                                                        <TableCell className="whitespace-nowrap">{b.name}</TableCell>
                                                        <TableCell className="whitespace-nowrap">{b.phone || '—'}</TableCell>
                                                        <TableCell className="whitespace-nowrap">
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveBeneficiary(b.id)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
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
                        {eventSpeakers.length > 0 ? eventSpeakers.map((speaker) => {
                            const socialMediaUrl = toSafeExternalUrl(speaker.social_media_link);

                            return (
                                <div key={speaker.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2 text-sm">
                                    <Mic className="h-4 w-4 text-primary" />
                                    <div>
                                        <span className="font-medium">{speaker.name}</span>
                                        {speaker.phone && <span className="text-muted-foreground ml-2">{speaker.phone}</span>}
                                        {socialMediaUrl && (
                                            <a href={socialMediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 ml-2">
                                                <LinkIcon className="h-3 w-3 inline" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-center text-muted-foreground py-4">{isRTL ? 'لا يوجد متحدثون' : 'No speakers'}</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
