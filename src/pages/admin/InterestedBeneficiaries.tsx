import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Download, Users } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

type CommitteeCategory = 'production' | 'quran' | 'fourth_year';
type QuranGroup = 'all' | 'unclassified' | 'adult_male' | 'adult_female' | 'child_male' | 'child_female';

interface Committee { id: string; name: string; name_ar: string; }

interface InterestedBeneficiary {
    id: string;
    name: string;
    phone: string;
    committee_category: CommitteeCategory;
    gender_age_group: string | null;
    production_committee_id: string | null;
    source_circle_id: string | null;
    notes: string | null;
    source_course_id: string | null;
    created_at: string;
    source_course?: { name: string } | null;
    source_circle?: { name: string; organizer?: { full_name: string | null; full_name_ar: string | null } | null } | null;
    creator?: { full_name: string | null; full_name_ar: string | null } | null;
}

interface Course { id: string; name: string; }
interface CourseBeneficiary { id: string; name: string; phone: string; }

// ─── Constants ───────────────────────────────────────────────────────────────

const QURAN_GROUPS: { value: QuranGroup; labelAr: string; labelEn: string }[] = [
    { value: 'all', labelAr: 'عام', labelEn: 'All' },
    { value: 'unclassified', labelAr: 'غير مصنف', labelEn: 'Unclassified' },
    { value: 'adult_male', labelAr: 'ذكور بالغين', labelEn: 'Adult Males' },
    { value: 'adult_female', labelAr: 'إناث بالغات', labelEn: 'Adult Females' },
    { value: 'child_male', labelAr: 'ذكور أطفال', labelEn: 'Male Children' },
    { value: 'child_female', labelAr: 'إناث أطفال', labelEn: 'Female Children' },
];
const QURAN_GROUPS_SELECTABLE = QURAN_GROUPS.filter(g => g.value !== 'all' && g.value !== 'unclassified');

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterestedBeneficiaries() {
    const { user } = useAuth();
    const { isRTL } = useLanguage();

    const [beneficiaries, setBeneficiaries] = useState<InterestedBeneficiary[]>([]);
    const [committees, setCommittees] = useState<Committee[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeCommittee, setActiveCommittee] = useState<CommitteeCategory>('production');
    // Production sub-tab: 'all' | committee.id
    const [activeProdCommitteeId, setActiveProdCommitteeId] = useState<string>('all');
    // Fourth Year sub-tab: 'all' | committee.id
    const [activeFourthYearCommitteeId, setActiveFourthYearCommitteeId] = useState<string>('all');
    // Quran sub-tab
    const [activeQuranGroup, setActiveQuranGroup] = useState<QuranGroup>('all');

    // Add manually
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', phone: '', notes: '', gender_age_group: '', production_committee_id: '' });
    const [addSaving, setAddSaving] = useState(false);

    // Delete
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchBeneficiaries = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('interested_beneficiaries')
                .select(`
                    *,
                    source_course:source_course_id(name),
                    source_circle:source_circle_id(name, organizer:organizer_id(full_name, full_name_ar)),
                    creator:created_by(full_name, full_name_ar)
                `)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setBeneficiaries((data as unknown as InterestedBeneficiary[]) || []);
        } catch (err) {
            console.error(err);
            toast.error(isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [isRTL]);

    const fetchCommittees = useCallback(async () => {
        const { data } = await supabase
            .from('committees')
            .select('id, name, name_ar')
            .order('name_ar');
        setCommittees((data as Committee[]) || []);
    }, []);

    const fetchCourses = useCallback(async () => {
        const { data } = await supabase
            .from('courses')
            .select('id, name')
            .order('start_date', { ascending: false });
        setCourses((data as Course[]) || []);
    }, []);

    useEffect(() => {
        fetchBeneficiaries();
        fetchCommittees();
        fetchCourses();
    }, [fetchBeneficiaries, fetchCommittees, fetchCourses]);

    // ── Derived ───────────────────────────────────────────────────────────────

    const productionAll = beneficiaries.filter(b => b.committee_category === 'production');
    const fourthYearAll = beneficiaries.filter(b => b.committee_category === 'fourth_year');

    // Only committees that actually have beneficiaries registered
    const activeProdCommittees = committees.filter(c =>
        productionAll.some(b => b.production_committee_id === c.id)
    );
    const activeFourthYearCommittees = committees.filter(c =>
        fourthYearAll.some(b => b.production_committee_id === c.id)
    );

    const prodFiltered = activeProdCommitteeId === 'all'
        ? productionAll
        : productionAll.filter(b => b.production_committee_id === activeProdCommitteeId);

    const fourthYearFiltered = activeFourthYearCommitteeId === 'all'
        ? fourthYearAll
        : fourthYearAll.filter(b => b.production_committee_id === activeFourthYearCommitteeId);

    const quranAll = beneficiaries.filter(b => b.committee_category === 'quran');
    const quranFiltered = activeQuranGroup === 'all'
        ? quranAll
        : activeQuranGroup === 'unclassified'
            ? quranAll.filter(b => b.gender_age_group === null)
            : quranAll.filter(b => b.gender_age_group === activeQuranGroup);

    const currentlyVisible = activeCommittee === 'production' ? prodFiltered
        : activeCommittee === 'fourth_year' ? fourthYearFiltered
            : quranFiltered;

    // Label for export button
    const exportLabel = (() => {
        if (activeCommittee === 'production') {
            if (activeProdCommitteeId === 'all') return isRTL ? 'عام — لجان إنتاجية' : 'All — Production';
            const c = committees.find(c => c.id === activeProdCommitteeId);
            return isRTL ? (c?.name_ar || c?.name || '') : (c?.name || '');
        }
        if (activeCommittee === 'fourth_year') {
            if (activeFourthYearCommitteeId === 'all') return isRTL ? 'عام — لجان سنة رابعة' : 'All — Fourth Year';
            const c = committees.find(c => c.id === activeFourthYearCommitteeId);
            return isRTL ? (c?.name_ar || c?.name || '') : (c?.name || '');
        }
        const grp = QURAN_GROUPS.find(g => g.value === activeQuranGroup);
        return isRTL
            ? `لجنة أهل القرآن — ${grp?.labelAr}`
            : `Quran — ${grp?.labelEn}`;
    })();

    // ── Add Manually ─────────────────────────────────────────────────────────

    const handleAdd = async () => {
        if (!addForm.name.trim() || !addForm.phone.trim()) {
            toast.error(isRTL ? 'الاسم والهاتف مطلوبان' : 'Name and phone are required');
            return;
        }
        if (activeCommittee === 'quran' && !addForm.gender_age_group) {
            toast.error(isRTL ? 'اختر الفئة' : 'Select a group');
            return;
        }
        setAddSaving(true);
        try {
            const { error } = await supabase.from('interested_beneficiaries').insert({
                name: addForm.name.trim(),
                phone: addForm.phone.trim(),
                notes: addForm.notes.trim() || null,
                committee_category: activeCommittee,
                gender_age_group: activeCommittee === 'quran' ? addForm.gender_age_group : null,
                production_committee_id: (activeCommittee === 'production' || activeCommittee === 'fourth_year') && addForm.production_committee_id
                    ? addForm.production_committee_id : null,
                created_by: user?.id,
            });
            if (error) {
                if (error.code === '23505') {
                    toast.error(isRTL ? 'الهاتف مسجل بالفعل في هذه الفئة' : 'Phone already exists in this category');
                } else throw error;
                return;
            }
            toast.success(isRTL ? 'تم الإضافة بنجاح' : 'Added successfully');
            setIsAddOpen(false);
            setAddForm({ name: '', phone: '', notes: '', gender_age_group: '', production_committee_id: '' });
            fetchBeneficiaries();
        } catch (err) {
            console.error(err);
            toast.error(isRTL ? 'حدث خطأ' : 'An error occurred');
        } finally {
            setAddSaving(false);
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from('interested_beneficiaries').delete().eq('id', deleteId);
            if (error) throw error;
            toast.success(isRTL ? 'تم الحذف' : 'Deleted');
            setDeleteId(null);
            fetchBeneficiaries();
        } catch (err) {
            console.error(err);
            toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
        } finally {
            setDeleting(false);
        }
    };

    // ── Export Excel ──────────────────────────────────────────────────────────

    const handleExport = () => {
        if (currentlyVisible.length === 0) {
            toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
            return;
        }
        const rows = currentlyVisible.map((b, i) => ({
            '#': i + 1,
            [isRTL ? 'الاسم' : 'Name']: b.name,
            [isRTL ? 'الهاتف' : 'Phone']: b.phone,
            [isRTL ? 'المصدر' : 'Source']: b.source_course?.name || (isRTL ? 'إدخال يدوي' : 'Manual'),
            [isRTL ? 'ملاحظات' : 'Notes']: b.notes || '',
            [isRTL ? 'تاريخ الإضافة' : 'Added At']: format(new Date(b.created_at), 'yyyy-MM-dd'),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, exportLabel.slice(0, 31));
        XLSX.writeFile(wb, `المهتمين_${exportLabel}.xlsx`);
    };

    // ── Shared Table ──────────────────────────────────────────────────────────

    // ── Source badge helper ───────────────────────────────────────────────────
    const SourceBadge = ({ b }: { b: InterestedBeneficiary }) => {
        if (b.source_course) return <Badge variant="secondary" className="text-xs">{b.source_course.name}</Badge>;
        if (b.source_circle) return <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-400">{b.source_circle.name}</Badge>;
        return <span className="text-muted-foreground text-xs">{isRTL ? 'يدوي' : 'Manual'}</span>;
    };

    const creatorName = (b: InterestedBeneficiary) => {
        // For quran entries: prefer circle organizer name
        if (b.committee_category === 'quran' && b.source_circle?.organizer) {
            const org = b.source_circle.organizer;
            return (isRTL ? org.full_name_ar || org.full_name : org.full_name || org.full_name_ar) || '—';
        }
        // Fallback: who inserted the DB record
        if (b.creator) {
            return (isRTL ? b.creator.full_name_ar || b.creator.full_name : b.creator.full_name || b.creator.full_name_ar) || '—';
        }
        return '—';
    };

    // ── Shared Table / Card ───────────────────────────────────────────────────

    const BeneficiaryTable = ({ rows }: { rows: InterestedBeneficiary[] }) => {
        if (loading) return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
        );
        if (rows.length === 0) return (
            <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{isRTL ? 'لا توجد بيانات بعد' : 'No beneficiaries yet'}</p>
            </div>
        );
        return (
            <>
                {/* ── Mobile: card list ── */}
                <div className="md:hidden space-y-3">
                    {rows.map((b, i) => (
                        <div key={b.id} className="border rounded-xl p-4 shadow-sm bg-card transition-all hover:shadow-md space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                                        {i + 1}
                                    </div>
                                    <span className="font-semibold text-base">{b.name}</span>
                                </div>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 rounded-full"
                                    onClick={() => setDeleteId(b.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2 gap-2 text-sm">
                                <span dir="ltr" className="text-muted-foreground font-mono">{b.phone}</span>
                                <SourceBadge b={b} />
                            </div>
                            <div className="flex gap-2 text-xs text-muted-foreground flex-wrap bg-muted/30 p-2 rounded-lg items-center justify-between">
                                <span className="flex gap-1">
                                    <span className="font-medium text-foreground">{isRTL ? 'أضافه:' : 'By:'}</span>
                                    {creatorName(b)}
                                </span>
                                <span>{format(new Date(b.created_at), 'yyyy/MM/dd')}</span>
                            </div>
                            {b.notes && (
                                <p className="text-sm text-muted-foreground bg-primary/5 p-2 rounded-lg mt-2 border border-primary/10">{b.notes}</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Desktop: table ── */}
                <div className="hidden md:block">
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap w-16 text-center">#</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'المصدر' : 'Source'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'تاريخ الإضافة' : 'Added At'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'أضافه' : 'Added By'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'ملاحظات' : 'Notes'}</TableHead>
                                    <TableHead className="w-16" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((b, i) => (
                                    <TableRow key={b.id} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-muted-foreground font-mono text-center">{(i + 1).toString().padStart(2, '0')}</TableCell>
                                        <TableCell className="font-semibold">{b.name}</TableCell>
                                        <TableCell dir="ltr" className={isRTL ? 'text-right font-mono' : 'font-mono'}>{b.phone}</TableCell>
                                        <TableCell><SourceBadge b={b} /></TableCell>
                                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{format(new Date(b.created_at), 'yyyy MMM dd')}</TableCell>
                                        <TableCell className="text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-bold">
                                                    {creatorName(b).charAt(0)}
                                                </div>
                                                {creatorName(b)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={b.notes || ''}>
                                            {b.notes ? <span className="bg-primary/10 text-primary/80 px-2 py-1 rounded text-xs">{b.notes}</span> : <span className="text-muted-foreground/30">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                                                onClick={() => setDeleteId(b.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </>
        );
    };

    // ── Sub-tab card wrapper ──────────────────────────────────────────────────

    const TabCard = ({ title, count, rows }: { title: string; count: number; rows: InterestedBeneficiary[] }) => (
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-xl">
            <CardHeader className="pb-4 border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center justify-between">
                    <span className="font-bold">{title}</span>
                    <Badge variant="outline" className="bg-background text-sm font-medium px-3 py-1 text-primary border-primary/20">
                        {count} {isRTL ? 'مستفيد' : 'beneficiaries'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-4"><BeneficiaryTable rows={rows} /></CardContent>
        </Card>
    );

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="container py-4 md:py-6 space-y-4 md:space-y-6 px-3 md:px-6" dir={isRTL ? 'rtl' : 'ltr'}>

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card/50 backdrop-blur-xl p-4 md:p-6 rounded-2xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight">{isRTL ? 'المهتمين' : 'Interested Beneficiaries'}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {isRTL ? 'بيانات المستفيدين المهتمين مقسمة حسب اللجنة والفئة' : 'Beneficiary contacts organized by committee and group'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Button variant="outline" onClick={handleExport}
                        className="gap-2 bg-background hover:bg-muted/50 border-muted-foreground/20">
                        <Download className="h-4 w-4" />
                        <span>{isRTL ? 'تصدير' : 'Export'}</span>
                    </Button>
                    <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-md hover:shadow-lg transition-all">
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{isRTL ? 'إضافة يدوية' : 'Add Manually'}</span>
                        <span className="sm:hidden">{isRTL ? 'إضافة' : 'Add'}</span>
                    </Button>
                </div>
            </div>

            {/* Main Tabs */}
            <Tabs value={activeCommittee} onValueChange={v => setActiveCommittee(v as CommitteeCategory)}>
                <div className="overflow-x-auto pb-2">
                    <TabsList className="w-max min-w-full justify-start h-auto p-1 bg-muted/50 rounded-xl">
                        <TabsTrigger value="production" className="gap-2 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2">
                            {isRTL ? 'لجنة إنتاجية' : 'Production Committee'}
                            <Badge variant={activeCommittee === 'production' ? 'default' : 'secondary'} className="ml-1 rounded-full px-2" >{productionAll.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="fourth_year" className="gap-2 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2">
                            {isRTL ? 'لجنة سنة رابعة' : 'Fourth Year'}
                            <Badge variant={activeCommittee === 'fourth_year' ? 'default' : 'secondary'} className="ml-1 rounded-full px-2">{fourthYearAll.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="quran" className="gap-2 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2">
                            {isRTL ? 'لجنة أهل القرآن' : 'Quran Committee'}
                            <Badge variant={activeCommittee === 'quran' ? 'default' : 'secondary'} className="ml-1 rounded-full px-2">{quranAll.length}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ── Production: عام + per-committee sub-tabs ── */}
                <TabsContent value="production" className="mt-6">
                    <Tabs value={activeProdCommitteeId} onValueChange={setActiveProdCommitteeId}>
                        <div className="overflow-x-auto pb-2 mb-4">
                            <TabsList className="w-max min-w-full justify-start h-auto p-1 bg-transparent border-b rounded-none gap-6">
                                {/* عام */}
                                <TabsTrigger value="all" className="gap-2 whitespace-nowrap rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-3 text-muted-foreground data-[state=active]:text-foreground">
                                    {isRTL ? 'عام' : 'All'}
                                    <Badge variant="secondary" className="rounded-full px-2 font-normal">{productionAll.length}</Badge>
                                </TabsTrigger>
                                {/* One tab per committee that has beneficiaries */}
                                {activeProdCommittees.map(c => (
                                    <TabsTrigger key={c.id} value={c.id} className="gap-2 whitespace-nowrap rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-3 text-muted-foreground data-[state=active]:text-foreground">
                                        {isRTL ? c.name_ar : c.name}
                                        <Badge variant="secondary" className="rounded-full px-2 font-normal">
                                            {productionAll.filter(b => b.production_committee_id === c.id).length}
                                        </Badge>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {/* عام content */}
                        <TabsContent value="all">
                            <TabCard
                                title={isRTL ? 'عام — كل اللجان الإنتاجية' : 'All Production Committees'}
                                count={productionAll.length}
                                rows={productionAll}
                            />
                        </TabsContent>
                        {/* Per-committee content */}
                        {activeProdCommittees.map(c => {
                            const rows = productionAll.filter(b => b.production_committee_id === c.id);
                            return (
                                <TabsContent key={c.id} value={c.id}>
                                    <TabCard
                                        title={isRTL ? c.name_ar : c.name}
                                        count={rows.length}
                                        rows={rows}
                                    />
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                </TabsContent>

                {/* ── Fourth Year: عام + per-committee sub-tabs ── */}
                <TabsContent value="fourth_year" className="mt-6">
                    <Tabs value={activeFourthYearCommitteeId} onValueChange={setActiveFourthYearCommitteeId}>
                        <div className="overflow-x-auto pb-2 mb-4">
                            <TabsList className="w-max min-w-full justify-start h-auto p-1 bg-transparent border-b rounded-none gap-6">
                                {/* عام */}
                                <TabsTrigger value="all" className="gap-2 whitespace-nowrap rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-3 text-muted-foreground data-[state=active]:text-foreground">
                                    {isRTL ? 'عام' : 'All'}
                                    <Badge variant="secondary" className="rounded-full px-2 font-normal">{fourthYearAll.length}</Badge>
                                </TabsTrigger>
                                {/* One tab per committee that has beneficiaries */}
                                {activeFourthYearCommittees.map(c => (
                                    <TabsTrigger key={c.id} value={c.id} className="gap-2 whitespace-nowrap rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-3 text-muted-foreground data-[state=active]:text-foreground">
                                        {isRTL ? c.name_ar : c.name}
                                        <Badge variant="secondary" className="rounded-full px-2 font-normal">
                                            {fourthYearAll.filter(b => b.production_committee_id === c.id).length}
                                        </Badge>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {/* عام content */}
                        <TabsContent value="all">
                            <TabCard
                                title={isRTL ? 'عام — كل لجان سنة رابعة' : 'All Fourth Year Committees'}
                                count={fourthYearAll.length}
                                rows={fourthYearAll}
                            />
                        </TabsContent>
                        {/* Per-committee content */}
                        {activeFourthYearCommittees.map(c => {
                            const rows = fourthYearAll.filter(b => b.production_committee_id === c.id);
                            return (
                                <TabsContent key={c.id} value={c.id}>
                                    <TabCard
                                        title={isRTL ? c.name_ar : c.name}
                                        count={rows.length}
                                        rows={rows}
                                    />
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                </TabsContent>

                {/* ── Quran: عام + group sub-tabs ── */}
                <TabsContent value="quran" className="mt-6">
                    <Tabs value={activeQuranGroup} onValueChange={v => setActiveQuranGroup(v as QuranGroup)}>
                        <div className="overflow-x-auto pb-2 mb-4">
                            <TabsList className="w-max min-w-full justify-start h-auto p-1 bg-transparent border-b rounded-none gap-6">
                                {QURAN_GROUPS.map(g => {
                                    const count = g.value === 'all' ? quranAll.length
                                        : g.value === 'unclassified' ? quranAll.filter(b => b.gender_age_group === null).length
                                            : quranAll.filter(b => b.gender_age_group === g.value).length;
                                    return (
                                        <TabsTrigger key={g.value} value={g.value} className="gap-2 whitespace-nowrap rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-3 text-muted-foreground data-[state=active]:text-foreground">
                                            {isRTL ? g.labelAr : g.labelEn}
                                            <Badge variant="secondary" className="rounded-full px-2 font-normal">{count}</Badge>
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>
                        </div>
                        {QURAN_GROUPS.map(g => (
                            <TabsContent key={g.value} value={g.value}>
                                <TabCard
                                    title={isRTL ? `لجنة أهل القرآن — ${g.labelAr}` : `Quran — ${g.labelEn}`}
                                    count={quranFiltered.length}
                                    rows={quranFiltered}
                                />
                            </TabsContent>
                        ))}
                    </Tabs>
                </TabsContent>
            </Tabs>

            {/* ── Add Manually Dialog ────────────────────────────────────────── */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'إضافة مستفيد يدوياً' : 'Add Beneficiary Manually'}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground -mt-2">
                        {activeCommittee === 'production'
                            ? (isRTL ? 'يضاف إلى: اللجنة الإنتاجية' : 'Adding to: Production Committee')
                            : activeCommittee === 'fourth_year'
                                ? (isRTL ? 'يضاف إلى: لجنة سنة رابعة' : 'Adding to: Fourth Year Committee')
                                : (isRTL ? 'يضاف إلى: لجنة أهل القرآن' : 'Adding to: Quran Committee')}
                    </p>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>{isRTL ? 'الاسم *' : 'Name *'}</Label>
                            <Input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                                placeholder={isRTL ? 'اسم المستفيد' : 'Beneficiary name'} />
                        </div>
                        <div className="space-y-2">
                            <Label>{isRTL ? 'رقم الهاتف *' : 'Phone *'}</Label>
                            <Input value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                                placeholder="01xxxxxxxxx" dir="ltr" />
                        </div>
                        {(activeCommittee === 'production' || activeCommittee === 'fourth_year') && (
                            <div className="space-y-2">
                                <Label>{isRTL ? 'اللجنة (اختياري)' : 'Committee (optional)'}</Label>
                                <Select value={addForm.production_committee_id} onValueChange={v => setAddForm(p => ({ ...p, production_committee_id: v }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={isRTL ? 'اختر اللجنة...' : 'Select committee...'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {committees.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{isRTL ? c.name_ar : c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {activeCommittee === 'quran' && (
                            <div className="space-y-2">
                                <Label>{isRTL ? 'الفئة *' : 'Group *'}</Label>
                                <Select value={addForm.gender_age_group} onValueChange={v => setAddForm(p => ({ ...p, gender_age_group: v }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={isRTL ? 'اختر الفئة...' : 'Select group...'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {QURAN_GROUPS_SELECTABLE.map(g => (
                                            <SelectItem key={g.value} value={g.value}>{isRTL ? g.labelAr : g.labelEn}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                            <Input value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                                placeholder={isRTL ? 'ملاحظات اختيارية' : 'Optional notes'} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={addSaving}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleAdd} disabled={addSaving}>
                            {addSaving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ─────────────────────────────────────────────── */}
            <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
                <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL ? 'هل أنت متأكد؟ لا يمكن التراجع.' : 'Are you sure? This cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {deleting ? (isRTL ? 'جارٍ...' : 'Deleting...') : (isRTL ? 'حذف' : 'Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
