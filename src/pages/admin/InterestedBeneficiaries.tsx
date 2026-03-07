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
import { Plus, Trash2, Download, Users, Import } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

type CommitteeCategory = 'production' | 'quran';
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
    // Quran sub-tab
    const [activeQuranGroup, setActiveQuranGroup] = useState<QuranGroup>('all');

    // Add manually
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', phone: '', notes: '', gender_age_group: '', production_committee_id: '' });
    const [addSaving, setAddSaving] = useState(false);

    // Import from course
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [importGroup, setImportGroup] = useState('');
    const [importProdCommitteeId, setImportProdCommitteeId] = useState('');
    const [courseBeneficiaries, setCourseBeneficiaries] = useState<CourseBeneficiary[]>([]);
    const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
    const [importLoading, setImportLoading] = useState(false);
    const [importSaving, setImportSaving] = useState(false);

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

    // Only committees that actually have beneficiaries registered
    const activeProdCommittees = committees.filter(c =>
        productionAll.some(b => b.production_committee_id === c.id)
    );

    const prodFiltered = activeProdCommitteeId === 'all'
        ? productionAll
        : productionAll.filter(b => b.production_committee_id === activeProdCommitteeId);

    const quranAll = beneficiaries.filter(b => b.committee_category === 'quran');
    const quranFiltered = activeQuranGroup === 'all'
        ? quranAll
        : activeQuranGroup === 'unclassified'
            ? quranAll.filter(b => b.gender_age_group === null)
            : quranAll.filter(b => b.gender_age_group === activeQuranGroup);

    const currentlyVisible = activeCommittee === 'production' ? prodFiltered : quranFiltered;

    // Label for export button
    const exportLabel = (() => {
        if (activeCommittee === 'production') {
            if (activeProdCommitteeId === 'all') return isRTL ? 'عام — لجان إنتاجية' : 'All — Production';
            const c = committees.find(c => c.id === activeProdCommitteeId);
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
                production_committee_id: activeCommittee === 'production' && addForm.production_committee_id
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

    // ── Import from Course ────────────────────────────────────────────────────

    const handleCourseSelect = async (courseId: string) => {
        setSelectedCourseId(courseId);
        setSelectedImportIds(new Set());
        if (!courseId) { setCourseBeneficiaries([]); return; }
        setImportLoading(true);
        try {
            const { data, error } = await supabase
                .from('course_beneficiaries')
                .select('id, name, phone')
                .eq('course_id', courseId)
                .order('name');
            if (error) throw error;
            setCourseBeneficiaries((data as CourseBeneficiary[]) || []);
        } catch (err) {
            console.error(err);
            toast.error(isRTL ? 'فشل في تحميل مستفيدي الكورس' : 'Failed to load course beneficiaries');
        } finally {
            setImportLoading(false);
        }
    };

    const toggleImportSelection = (id: string) =>
        setSelectedImportIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    const selectAllImport = () =>
        setSelectedImportIds(
            selectedImportIds.size === courseBeneficiaries.length
                ? new Set() : new Set(courseBeneficiaries.map(b => b.id))
        );

    const handleImport = async () => {
        if (selectedImportIds.size === 0) {
            toast.error(isRTL ? 'اختر مستفيداً على الأقل' : 'Select at least one');
            return;
        }
        if (activeCommittee === 'quran' && !importGroup) {
            toast.error(isRTL ? 'اختر الفئة العمرية أولاً' : 'Select a group first');
            return;
        }
        setImportSaving(true);
        try {
            const toInsert = courseBeneficiaries
                .filter(b => selectedImportIds.has(b.id))
                .map(b => ({
                    name: b.name,
                    phone: b.phone,
                    committee_category: activeCommittee,
                    gender_age_group: activeCommittee === 'quran' ? importGroup : null,
                    production_committee_id: activeCommittee === 'production' && importProdCommitteeId ? importProdCommitteeId : null,
                    source_course_id: selectedCourseId,
                    created_by: user?.id,
                }));

            const { error } = await supabase
                .from('interested_beneficiaries')
                .upsert(toInsert, { onConflict: 'phone,committee_category,gender_age_group,production_committee_id', ignoreDuplicates: true });

            if (error) throw error;
            toast.success(isRTL ? 'تم الاستيراد بنجاح' : 'Imported successfully');
            setIsImportOpen(false);
            setSelectedCourseId(''); setImportGroup(''); setImportProdCommitteeId('');
            setCourseBeneficiaries([]); setSelectedImportIds(new Set());
            fetchBeneficiaries();
        } catch (err) {
            console.error(err);
            toast.error(isRTL ? 'حدث خطأ أثناء الاستيراد' : 'Import failed');
        } finally {
            setImportSaving(false);
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
                        <div key={b.id} className="border rounded-lg p-4 space-y-2 bg-card">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground text-xs shrink-0">{i + 1}.</span>
                                    <span className="font-semibold truncate">{b.name}</span>
                                </div>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeleteId(b.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-sm">
                                <span dir="ltr" className="text-muted-foreground font-mono">{b.phone}</span>
                                <SourceBadge b={b} />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-1">
                                <span>{isRTL ? 'أضافه:' : 'By:'} {creatorName(b)}</span>
                                <span>{format(new Date(b.created_at), 'yyyy-MM-dd')}</span>
                            </div>
                            {b.notes && (
                                <p className="text-xs text-muted-foreground border-t pt-2 mt-1">{b.notes}</p>
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
                                    <TableHead className="whitespace-nowrap">#</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'المصدر' : 'Source'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'أضافه' : 'Added By'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'ملاحظات' : 'Notes'}</TableHead>
                                    <TableHead className="whitespace-nowrap">{isRTL ? 'تاريخ الإضافة' : 'Added At'}</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((b, i) => (
                                    <TableRow key={b.id}>
                                        <TableCell className="text-muted-foreground whitespace-nowrap">{i + 1}</TableCell>
                                        <TableCell className="font-medium whitespace-nowrap">{b.name}</TableCell>
                                        <TableCell dir="ltr" className={isRTL ? 'text-right whitespace-nowrap' : 'whitespace-nowrap'}>{b.phone}</TableCell>
                                        <TableCell className="whitespace-nowrap"><SourceBadge b={b} /></TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">{creatorName(b)}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate whitespace-nowrap">{b.notes || '—'}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{format(new Date(b.created_at), 'yyyy-MM-dd')}</TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost" size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                    <span>{title}</span>
                    <span className="text-muted-foreground font-normal text-sm">{count} {isRTL ? 'مستفيد' : 'beneficiaries'}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0"><BeneficiaryTable rows={rows} /></CardContent>
        </Card>
    );

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="container py-4 md:py-6 space-y-4 md:space-y-6 px-3 md:px-6" dir={isRTL ? 'rtl' : 'ltr'}>

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 md:h-7 md:w-7 text-primary shrink-0" />
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">{isRTL ? 'المهتمين' : 'Interested Beneficiaries'}</h1>
                        <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                            {isRTL ? 'بيانات المستفيدين المهتمين مقسمة حسب اللجنة والفئة' : 'Beneficiary contacts organized by committee and group'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={handleExport}
                        className="gap-2 h-auto flex-col items-start py-2 px-3 min-w-[110px] md:min-w-[130px]">
                        <div className="flex items-center gap-2 w-full">
                            <Download className="h-4 w-4 shrink-0" />
                            <span className="font-medium text-sm">{isRTL ? 'تصدير' : 'Export'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-normal w-full truncate">{exportLabel}</span>
                    </Button>
                    <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2 text-sm">
                        <Import className="h-4 w-4" />
                        <span className="hidden sm:inline">{isRTL ? 'استيراد من كورس' : 'Import from Course'}</span>
                        <span className="sm:hidden">{isRTL ? 'استيراد' : 'Import'}</span>
                    </Button>
                    <Button onClick={() => setIsAddOpen(true)} className="gap-2 text-sm">
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{isRTL ? 'إضافة يدوية' : 'Add Manually'}</span>
                        <span className="sm:hidden">{isRTL ? 'إضافة' : 'Add'}</span>
                    </Button>
                </div>
            </div>

            {/* Main Tabs */}
            <Tabs value={activeCommittee} onValueChange={v => setActiveCommittee(v as CommitteeCategory)}>
                <div className="overflow-x-auto pb-1">
                    <TabsList className="w-max min-w-full">
                        <TabsTrigger value="production" className="gap-2 whitespace-nowrap">
                            {isRTL ? 'لجنة إنتاجية' : 'Production Committee'}
                            <Badge variant="secondary">{productionAll.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="quran" className="gap-2 whitespace-nowrap">
                            {isRTL ? 'لجنة أهل القرآن' : 'Quran Committee'}
                            <Badge variant="secondary">{quranAll.length}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ── Production: عام + per-committee sub-tabs ── */}
                <TabsContent value="production" className="mt-4">
                    <Tabs value={activeProdCommitteeId} onValueChange={setActiveProdCommitteeId}>
                        <div className="overflow-x-auto pb-1 mb-3">
                            <TabsList className="w-max min-w-full justify-start gap-1">
                                {/* عام */}
                                <TabsTrigger value="all" className="gap-2 whitespace-nowrap">
                                    {isRTL ? 'عام' : 'All'}
                                    <Badge variant="outline">{productionAll.length}</Badge>
                                </TabsTrigger>
                                {/* One tab per committee that has beneficiaries */}
                                {activeProdCommittees.map(c => (
                                    <TabsTrigger key={c.id} value={c.id} className="gap-2 whitespace-nowrap">
                                        {isRTL ? c.name_ar : c.name}
                                        <Badge variant="outline">
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

                {/* ── Quran: عام + group sub-tabs ── */}
                <TabsContent value="quran" className="mt-4">
                    <Tabs value={activeQuranGroup} onValueChange={v => setActiveQuranGroup(v as QuranGroup)}>
                        <div className="overflow-x-auto pb-1 mb-3">
                            <TabsList className="w-max min-w-full justify-start gap-1">
                                {QURAN_GROUPS.map(g => {
                                    const count = g.value === 'all' ? quranAll.length
                                        : g.value === 'unclassified' ? quranAll.filter(b => b.gender_age_group === null).length
                                            : quranAll.filter(b => b.gender_age_group === g.value).length;
                                    return (
                                        <TabsTrigger key={g.value} value={g.value} className="gap-2 whitespace-nowrap">
                                            {isRTL ? g.labelAr : g.labelEn}
                                            <Badge variant="outline">{count}</Badge>
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
                        {activeCommittee === 'production' && (
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

            {/* ── Import from Course Dialog ──────────────────────────────────── */}
            <Dialog open={isImportOpen} onOpenChange={open => {
                setIsImportOpen(open);
                if (!open) {
                    setSelectedCourseId(''); setImportGroup(''); setImportProdCommitteeId('');
                    setCourseBeneficiaries([]); setSelectedImportIds(new Set());
                }
            }}>
                <DialogContent className="max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'استيراد من كورس' : 'Import from Course'}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground -mt-2">
                        {activeCommittee === 'production'
                            ? (isRTL ? 'يستورد إلى: اللجنة الإنتاجية' : 'Importing to: Production Committee')
                            : (isRTL ? 'يستورد إلى: لجنة أهل القرآن' : 'Importing to: Quran Committee')}
                    </p>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>{isRTL ? 'اختر الكورس' : 'Select Course'}</Label>
                            <Select value={selectedCourseId} onValueChange={handleCourseSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder={isRTL ? 'اختر كورساً...' : 'Choose a course...'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {courses.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {activeCommittee === 'production' && (
                            <div className="space-y-2">
                                <Label>{isRTL ? 'اللجنة (اختياري)' : 'Committee (optional)'}</Label>
                                <Select value={importProdCommitteeId} onValueChange={setImportProdCommitteeId}>
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
                                <Label>{isRTL ? 'الفئة العمرية *' : 'Group *'}</Label>
                                <Select value={importGroup} onValueChange={setImportGroup}>
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
                        {importLoading && (
                            <div className="flex justify-center py-6">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                            </div>
                        )}
                        {!importLoading && courseBeneficiaries.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>{isRTL ? `المستفيدون (${courseBeneficiaries.length})` : `Beneficiaries (${courseBeneficiaries.length})`}</Label>
                                    <Button variant="ghost" size="sm" onClick={selectAllImport}>
                                        {selectedImportIds.size === courseBeneficiaries.length
                                            ? (isRTL ? 'إلغاء تحديد الكل' : 'Deselect all')
                                            : (isRTL ? 'تحديد الكل' : 'Select all')}
                                    </Button>
                                </div>
                                <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
                                    {courseBeneficiaries.map(b => (
                                        <label key={b.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted cursor-pointer">
                                            <input type="checkbox" checked={selectedImportIds.has(b.id)}
                                                onChange={() => toggleImportSelection(b.id)} className="accent-primary" />
                                            <span className="flex-1 font-medium">{b.name}</span>
                                            <span className="text-sm text-muted-foreground" dir="ltr">{b.phone}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {isRTL ? `تم تحديد ${selectedImportIds.size} من ${courseBeneficiaries.length}` : `${selectedImportIds.size} of ${courseBeneficiaries.length} selected`}
                                </p>
                            </div>
                        )}
                        {!importLoading && selectedCourseId && courseBeneficiaries.length === 0 && (
                            <p className="text-center text-muted-foreground py-4 text-sm">
                                {isRTL ? 'لا يوجد مستفيدون في هذا الكورس' : 'No beneficiaries in this course'}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={importSaving}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleImport} disabled={importSaving || selectedImportIds.size === 0}>
                            {importSaving
                                ? (isRTL ? 'جارٍ الاستيراد...' : 'Importing...')
                                : (isRTL ? `استيراد (${selectedImportIds.size})` : `Import (${selectedImportIds.size})`)}
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
