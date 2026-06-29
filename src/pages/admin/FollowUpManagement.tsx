import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Pencil, Trash2, Loader2, Download, Upload, RefreshCw, Check, History, Link2, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { normalizePhoneE164, phonesAreEqual } from '@/utils/phoneUtils';
import {
  addFollowUp,
  approveFollowUp,
  editFollowUp,
  findFollowUpConflicts,
  getFollowUpUsers,
  getParticipations,
  importReplace,
  linkToAnother,
  rejectFollowUp,
  syncFollowUp,
  type FollowUpConflictMatch,
  type FollowUpUser,
  type ImportFollowUpRecord,
  type ParticipationItem,
} from '@/services/followup.service';

interface ConflictRecord {
  excelRow: ImportFollowUpRecord;
  possibleMatches: FollowUpConflictMatch[];
  selectedMatchId?: number | 'skip' | 'new';
}

type ExcelCell = string | number | boolean | null | undefined;
type ExcelRow = ExcelCell[];


// ---------------------------------------------------------------------------
// Phone normalization — delegate entirely to the centralized utility.
// Do NOT use this alias for anything else; import from phoneUtils directly.
// ---------------------------------------------------------------------------
const normalizePhone = (raw: string | null | undefined): string =>
  normalizePhoneE164(raw);

export default function FollowUpManagement() {
  const { language, isRTL } = useLanguage();
  const { branches, canViewAllBranches, activeBranch } = useBranch();

  const ar = (ar: string, en: string) => language === 'ar' ? ar : en;

  // helper: get branch display name from branch_id
  const getBranchName = (branch_id: string | null, branch: string | null) => {
    if (branch_id) {
      const found = branches.find(b => b.id === branch_id);
      if (found) return language === 'ar' ? found.name_ar : found.name;
    }
    return branch || '—';
  };

  const [users, setUsers] = useState<FollowUpUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Link-to-another dialog state
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkSourceUser, setLinkSourceUser] = useState<FollowUpUser | null>(null);
  const [linkTargetPhone, setLinkTargetPhone] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<FollowUpUser[]>([]);
  const [selectedLinkTarget, setSelectedLinkTarget] = useState<FollowUpUser | null>(null);
  const [activeTab, setActiveTab] = useState('approved');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<FollowUpUser | null>(null);

  // Import Confirmation State
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [pendingImportRecords, setPendingImportRecords] = useState<ImportFollowUpRecord[]>([]);



  // Template State
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  // Participations viewer
  const [isParticipationsOpen, setIsParticipationsOpen] = useState(false);
  const [participationsUser, setParticipationsUser] = useState<FollowUpUser | null>(null);
  const [participationsList, setParticipationsList] = useState<ParticipationItem[]>([]);
  const [isLoadingParticipations, setIsLoadingParticipations] = useState(false);

  // Conflict Resolution
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictRecords, setConflictRecords] = useState<ConflictRecord[]>([]);

  const openParticipations = async (user: FollowUpUser) => {
    setParticipationsUser(user);
    setParticipationsList([]);
    setIsParticipationsOpen(true);
    setIsLoadingParticipations(true);
    try {
      setParticipationsList(await getParticipations(user));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingParticipations(false);
    }
  };

  // Form
  const [formName, setFormName] = useState('');
  const [formPhone1, setFormPhone1] = useState('');
  const [formPhone2, setFormPhone2] = useState('');
  const [formBranch, setFormBranch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      setUsers(await getFollowUpUsers({
        branchId: activeBranch?.id,
        canViewAllBranches,
      }));
    } catch (err) {
      toast.error(ar('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranch?.id, canViewAllBranches]);

  const handleSyncAndRefresh = async () => {
    setIsLoading(true);
    try {
      const result = await syncFollowUp({
        canViewAllBranches,
        branchId: activeBranch?.id,
        branches,
      });

      await fetchUsers();

      if (result.newCount > 0) {
        toast.success(ar(
          `تم العثور على ${result.newCount} مشارك جديد وإضافتهم لطلبات الإضافة!`,
          `Found and added ${result.newCount} new participants to pending!`
        ));
      } else if (result.cleanedCount > 0) {
        toast.success(ar('تم تنظيف السجلات المكررة بنجاح!', 'Duplicate records cleaned up successfully!'));
      } else {
        toast.info(ar('البيانات محدثة بالفعل، لا يوجد مشاركين جدد.', 'Data is up to date, no new participants.'));
      }
    } catch (err) {
      console.error(err);
      toast.error(ar('حدث خطأ أثناء المزامنة', 'Error syncing participants'));
    } finally {
      setIsLoading(false);
    }
  };

  const pendingUsers = useMemo(() => users.filter(u => u.status === 'pending'), [users]);
  const approvedUsers = useMemo(() => users.filter(u => u.status === 'approved'), [users]);

  // Sequential row number (1-based) for each user in the approved sheet.
  // Stable even when searching — based on position in the full sorted list.
  const approvedRowNumber = useMemo(() => {
    const m = new Map<number, number>();
    approvedUsers.forEach((u, i) => m.set(u.id, i + 1));
    return m;
  }, [approvedUsers]);

  // Pre-computed pending row numbers to avoid O(n²) findIndex in render loop
  const pendingRowNumber = useMemo(() => {
    const m = new Map<number, number>();
    pendingUsers.forEach((u, i) => m.set(u.id, i + 1));
    return m;
  }, [pendingUsers]);

  // Map id → user for quick lookup (linked_to display)
  const userById = useMemo(() => {
    const m = new Map<number, FollowUpUser>();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const dataSource = activeTab === 'approved' ? approvedUsers : pendingUsers;
    const q = searchQuery.toLowerCase().trim();
    // Also normalize the search query so that entering any phone format works
    const qNorm = normalizePhoneE164(q);
    return dataSource.filter(u => {
      const matchSearch =
        u.full_name.toLowerCase().includes(q) ||
        // Compare normalized stored value against normalized query
        (qNorm ? u.phone_1 === qNorm || u.phone_2 === qNorm : false) ||
        // Also allow raw substring search for partial numbers
        u.phone_1.includes(q) ||
        (u.phone_2 || '').includes(q);
      return matchSearch;
    });
  }, [approvedUsers, pendingUsers, activeTab, searchQuery]);

  // Reset pagination when searching/filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const resetForm = () => {
    setFormName('');
    setFormPhone1('');
    setFormPhone2('');
    setFormBranch(activeBranch?.id || '');
  };

  const openAdd = () => { resetForm(); setIsAddOpen(true); };

  const openEdit = (user: FollowUpUser) => {
    setSelected(user);
    setFormName(user.full_name);
    setFormPhone1(user.phone_1);
    setFormPhone2(user.phone_2 || '');
    setFormBranch(user.branch_id || '');
    setIsEditOpen(true);
  };

  const openDelete = (user: FollowUpUser) => {
    setSelected(user);
    setIsDeleteOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone1.trim()) {
      toast.error(ar('الاسم والهاتف الأول مطلوبان', 'Name and Phone 1 are required'));
      return;
    }

    setIsSubmitting(true);
    try {
      await addFollowUp({
        fullName: formName,
        phone1: formPhone1,
        phone2: formPhone2.trim() ? formPhone2 : null,
        branchId: formBranch || null,
      });
      toast.success(ar('تم الإضافة بنجاح', 'Added successfully'));
      setIsAddOpen(false);
      resetForm();
      await fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : ar('فشل في الإضافة', 'Failed to add'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!formName.trim() || !formPhone1.trim()) {
      toast.error(ar('الاسم والهاتف الأول مطلوبان', 'Name and Phone 1 are required'));
      return;
    }

    setIsSubmitting(true);
    try {
      await editFollowUp({
        id: selected.id,
        fullName: formName,
        phone1: formPhone1,
        phone2: formPhone2.trim() ? formPhone2 : null,
        branchId: formBranch || null,
        previousPhone1: selected.phone_1,
        previousPhone2: selected.phone_2,
        previousBranchId: selected.branch_id,
      });
      toast.success(ar('تم التعديل بنجاح', 'Updated successfully'));
      setIsEditOpen(false);
      setSelected(null);
      resetForm();
      await fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : ar('فشل في التعديل', 'Failed to update'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    setIsSubmitting(true);
    try {
      await approveFollowUp(id);
      toast.success(ar('تم قبول الشخص بنجاح', 'Person approved successfully'));
      await fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : ar('فشل في القبول', 'Failed to approve'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Link-to-Another Flow ──────────────────────────────────────

  const openLinkDialog = (user: FollowUpUser) => {
    setLinkSourceUser(user);
    setLinkTargetPhone('');
    setLinkSearchResults([]);
    setSelectedLinkTarget(null);
    setIsLinkDialogOpen(true);
  };

  const searchLinkTarget = async (query: string) => {
    setLinkTargetPhone(query);
    setSelectedLinkTarget(null);
    if (query.trim().length < 3) {
      setLinkSearchResults([]);
      return;
    }

    const q = query.trim().toLowerCase();
    const qNorm = normalizePhoneE164(q);

    // Search in approved users
    const results = approvedUsers.filter(u => {
      if (u.id === linkSourceUser?.id) return false;
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.phone_1.includes(q) ||
        (u.phone_2 || '').includes(q) ||
        (qNorm && (u.phone_1 === qNorm || u.phone_2 === qNorm))
      );
    }).slice(0, 10);
    setLinkSearchResults(results);
  };

  const handleLinkToAnother = async () => {
    if (!linkSourceUser || !selectedLinkTarget) return;
    setIsSubmitting(true);
    try {
      const transferredCount = await linkToAnother({
        sourceUser: linkSourceUser,
        targetUser: selectedLinkTarget,
      });

      if (transferredCount > 0) {
        toast.info(ar(
          `تم نقل ${transferredCount} مشاركة إلى "${selectedLinkTarget.full_name}"`,
          `Transferred ${transferredCount} participations to "${selectedLinkTarget.full_name}"`
        ));
      }

      toast.success(ar(
        `تم ربط "${linkSourceUser.full_name}" بـ "${selectedLinkTarget.full_name}" بنجاح`,
        `Linked "${linkSourceUser.full_name}" to "${selectedLinkTarget.full_name}" successfully`
      ));
      setIsLinkDialogOpen(false);
      setLinkSourceUser(null);
      await fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : ar('فشل في الربط', 'Failed to link'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await rejectFollowUp(selected.id);
      toast.success(ar('تم الحذف بنجاح', 'Deleted successfully'));
      setIsDeleteOpen(false);
      setSelected(null);
      await fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : ar('فشل في الحذف', 'Failed to delete'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');

    if (filtered.length === 0) {
      toast.error(ar('لا توجد بيانات للتصدير', 'No data to export'));
      return;
    }
    // Build a map from DB id → row number (1-based) in the exported list
    const exportIdToRow = new Map<number, number>();
    filtered.forEach((u, i) => exportIdToRow.set(u.id, i + 1));

    const headers = [
      ar('م', '#'),
      ar('الاسم', 'Name'),
      ar('الهاتف الأول', 'Phone 1'),
      ar('الهاتف الثاني', 'Phone 2'),
      ar('الفرع', 'Branch'),
      ar('مرتبط بـ (م)', 'linked_to'),
    ];
    const rows = filtered.map((u, i) => [
      i + 1,
      u.full_name,
      u.phone_1,
      u.phone_2 || '',
      getBranchName(u.branch_id, u.branch),
      u.linked_to ? (exportIdToRow.get(u.linked_to) ?? '') : '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!rtl'] = isRTL;
    ws['!cols'] = [
      { wch: 5 },  // م
      { wch: 30 }, // الاسم
      { wch: 15 }, // الهاتف الأول
      { wch: 15 }, // الهاتف الثاني
      { wch: 15 }, // الفرع
      { wch: 15 }, // مرتبط بـ
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ar('شيت المتابعة', 'Follow-up'));

    XLSX.writeFile(wb, `followup_users_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(ar('تم التصدير بنجاح', 'Exported successfully'));
  };

  const downloadExcelTemplate = async () => {
    const XLSX = await import('xlsx');

    const headers = ['id', 'full_name', 'phone_1', 'phone_2', 'branch_id', 'linked_to'];
    const example1 = ['', 'أحمد محمد', '01012345678', '01123456789', 'ma', ''];
    const example2 = ['', 'محمود خليل', '01234567890', '', 'hq', ''];
    const example3 = ['', 'أحمد م. القديم', '01099999999', '', 'ma', '1'];

    const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2, example3]);
    ws['!rtl'] = false; // System parser expects standard English columns for id mapping
    ws['!cols'] = [
      { wch: 10 }, // id
      { wch: 30 }, // full_name
      { wch: 15 }, // phone_1
      { wch: 15 }, // phone_2
      { wch: 15 }, // branch_id
      { wch: 15 }, // linked_to
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    XLSX.writeFile(wb, 'import_template.xlsx');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    toast.info(ar('جاري معالجة الملف...', 'Processing file...'));

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json<ExcelRow>(ws, { header: 1 });

          // Smart parsing: scan the first 10 rows to find the headers and normalize arabic letters
          let headerRowIdx = -1;
          let nameIdx = -1, phone1Idx = -1, phone2Idx = -1, branchIdx = -1, linkedToIdx = -1;

          for (let r = 0; r < Math.min(data.length, 10); r++) {
            const row = data[r] || [];
            if (!Array.isArray(row)) continue;

            const normalize = (val: ExcelCell) => typeof val === 'string' ? val.toLowerCase().replace(/[أإآ]/g, 'ا').trim() : '';

            const idxName = row.findIndex(h => {
              const s = normalize(h);
              return s.includes('الاسم') || s.includes('name') || s === 'full_name';
            });
            const idxPhone1 = row.findIndex(h => {
              const s = normalize(h);
              return s.includes('الهاتف الاول') || s === 'الهاتف' || s.includes('رقم الهاتف') || s.includes('موبايل') || s.includes('رقم 1') || s.includes('phone 1') || s === 'phone' || s === 'mobile' || s === 'phone_1';
            });

            if (idxName !== -1 && idxPhone1 !== -1) {
              headerRowIdx = r;
              nameIdx = idxName;
              phone1Idx = idxPhone1;
              phone2Idx = row.findIndex(h => {
                const s = normalize(h);
                return s.includes('الهاتف الثاني') || s.includes('رقم 2') || s.includes('رقم اضافي') || s.includes('phone 2') || s.includes('mobile 2') || s === 'phone_2';
              });
              branchIdx = row.findIndex(h => {
                const s = normalize(h);
                return s.includes('فرع') || s.includes('branch') || s.includes('location') || s === 'branch_id';
              });
              // linked_to: optional column referencing another row's م (1-based index)
              linkedToIdx = row.findIndex(h => {
                const s = normalize(h);
                return s === 'linked_to' || s.includes('مرتبط') || s.includes('مدمج') || s === 'م مرتبط';
              });
              break;
            }
          }

          if (headerRowIdx === -1) {
            toast.error(ar('لم يتم التعرف على الأعمدة. يرجى التأكد من وجود عمود لـ "الاسم" وعمود لـ "لهاتف".', 'Could not identify columns. Make sure Name and Phone columns exist.'));
            setIsSubmitting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          // Parse rows starting after the discovered header bounds
          const newRecords: ImportFollowUpRecord[] = [];
          for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0 || !row[nameIdx] || !row[phone1Idx]) continue;
            const rawBranch = branchIdx !== -1 && row[branchIdx] ? String(row[branchIdx]).trim() : null;
            let branchIdToUse = activeBranch?.id || null;
            if (rawBranch) {
              const rbLower = rawBranch.toLowerCase();
              const bMatch = branches.find(b =>
                (b.id === rawBranch) ||
                (b.code && b.code.toLowerCase() === rbLower) ||
                b.name === rawBranch ||
                b.name_ar === rawBranch
              );
              if (bMatch) branchIdToUse = bMatch.id;
            }

            // Normalize phone numbers to E.164 using the centralized utility
            const p1 = normalizePhoneE164(String(row[phone1Idx]));
            const p2 = phone2Idx !== -1 && row[phone2Idx] ? normalizePhoneE164(String(row[phone2Idx])) : null;

            if (!p1) continue; // skip rows with no valid phone after normalization

            // Guard: phone_1 and phone_2 in the same row must not be the same number
            if (p2 && phonesAreEqual(p1, p2)) {
              console.warn(`[Import] Row ${i}: phone_1 and phone_2 are the same number (${p1}) — phone_2 cleared.`);
            }

            // Parse linked_to as a 1-based row index within this same sheet (resolved after insert)
            let linkedToRow: number | null = null;
            if (linkedToIdx !== -1 && row[linkedToIdx] !== undefined && row[linkedToIdx] !== null && row[linkedToIdx] !== '') {
              const parsed = parseInt(String(row[linkedToIdx]).trim(), 10);
              if (!isNaN(parsed) && parsed > 0) linkedToRow = parsed;
            }

            newRecords.push({
              full_name: String(row[nameIdx]).trim(),
              phone_1: p1,
              // Clear phone_2 if it is the same number as phone_1 after normalization
              phone_2: (p2 && !phonesAreEqual(p1, p2)) ? p2 : null,
              branch_id: branchIdToUse,
              status: 'approved',
              _linkedToRow: linkedToRow, // temporary — resolved after DB insert
            });
          }

          if (newRecords.length === 0) {
            toast.error(ar('لم يتم العثور على بيانات صالحة.', 'No valid data found in file.'));
            setIsSubmitting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }

          // ── Handle duplicate phones within the uploaded file ──────────────────
          const phoneSeenInFile = new Set<string>();
          for (const rec of newRecords) {
            const phone = rec.phone_1;
            if (phoneSeenInFile.has(phone)) {
              rec.status = 'pending';
            } else {
              phoneSeenInFile.add(phone);
            }
          }

          // === Conflict Detection Logic ===
          const uniquePhones = Array.from(new Set(newRecords.map(r => r.phone_1).filter(Boolean)));
          
          if (uniquePhones.length > 0) {
            const existingUsers = await findFollowUpConflicts(uniquePhones, activeBranch?.id);

            if (existingUsers.length > 0) {
              const conflicts: ConflictRecord[] = [];
              const cleanRecords: ImportFollowUpRecord[] = [];

              newRecords.forEach(rec => {
                const matches = existingUsers.filter((eu) => eu.phone_1 === rec.phone_1);
                if (matches.length > 0) {
                  conflicts.push({
                    excelRow: rec,
                    possibleMatches: matches,
                    selectedMatchId: matches[0].id // default select first match
                  });
                } else {
                  cleanRecords.push(rec);
                }
              });

              if (conflicts.length > 0) {
                setConflictRecords(conflicts);
                setPendingImportRecords(cleanRecords);
                setIsConflictModalOpen(true);
                return; // Stop here, wait for manual resolution
              }
            }
          }

          // All records go straight to confirmation (no conflict dialog needed)
          setPendingImportRecords(newRecords);
          setIsImportConfirmOpen(true);
        } catch (err: unknown) {
          console.error('Parse error:', err);
          toast.error(ar('حدث خطأ أثناء قراءة الملف.', 'Error parsing file.'));
        } finally {
          setIsSubmitting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : ar('حدث خطأ', 'An error occurred'));
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImportReplace = async () => {
    setIsSubmitting(true);
    setIsImportConfirmOpen(false);
    try {
      const targetBranchId = activeBranch?.id || null;

      if (!targetBranchId) {
        toast.error(ar(
          'يجب اختيار فرع محدد قبل استبدال الشيت. اختر فرع من فلتر الفروع أولاً.',
          'You must select a specific branch before replacing the sheet. Choose a branch from the filter first.'
        ));
        setIsSubmitting(false);
        return;
      }

      const { approvedCount, updatedCount, duplicateCount } = await importReplace({
        targetBranchId,
        records: pendingImportRecords,
      });

      toast.success(ar(
        `تم العملية بنجاح! تم إدراج ${approvedCount} سجل جديد وتم ربط/تحديث ${updatedCount} سجل موجود${duplicateCount > 0 ? ` — ${duplicateCount} رقم مكرر ينتظر مراجعتك في تاب "برا الشيت"` : ''}.`,
        `Operation successful! ${approvedCount} new records inserted and ${updatedCount} existing mapped${duplicateCount > 0 ? ` — ${duplicateCount} duplicates waiting in "Out of Sheet" tab` : ''}.`
      ));
      setPendingImportRecords([]);
      await fetchUsers();
    } catch (err: unknown) {
      console.error('Import insert error:', err);
      toast.error(ar('حدث خطأ أثناء تحديث قاعدة البيانات.', 'Error updating database.'));
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleConflictResolutionSubmit = () => {
    const resolvedRecords = conflictRecords.map(cr => {
      if (cr.selectedMatchId === 'skip') {
        return null;
      }
      if (cr.selectedMatchId === 'new') {
        return { ...cr.excelRow, status: 'pending' }; // Insert as new duplicate, but send to pending
      }
      // Mapped to existing
      return { ...cr.excelRow, _mappedToExistingId: cr.selectedMatchId };
    }).filter((record): record is ImportFollowUpRecord => Boolean(record));

    setPendingImportRecords(prev => [...prev, ...resolvedRecords]);
    setIsConflictModalOpen(false);
    setIsImportConfirmOpen(true);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ar('إدارة شيت المتابعة', 'Follow-Up Sheet Management')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ar(
              'إضافة وتعديل بيانات المتابعة واستبدال الشيت',
              'Add, edit follow-up data, and replace the sheet'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSyncAndRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5', isLoading && 'animate-spin')} />
            {ar('تحديث ومزامنة', 'Sync & Refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isLoading}>
            <Download className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
            {ar('تصدير Excel', 'Export Excel')}
          </Button>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImportExcel}
          />
          <Button variant="outline" size="sm" onClick={() => setIsTemplateDialogOpen(true)} disabled={isLoading}>
            <Download className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
            {ar('صيغة التصدير/الاستيراد', 'Template Format')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isSubmitting}>
            <Upload className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
            {ar('استبدال الشيت بجديد', 'Replace with New Sheet')}
          </Button>
          <Button onClick={openAdd} disabled={isLoading || isSubmitting}>
            <Plus className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
            {ar('إضافة شخص', 'Add Person')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-primary">{approvedUsers.length}</p>
            <p className="text-xs text-muted-foreground">{ar('في الشيت (معتمد)', 'In Sheet (Approved)')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-amber-600">{pendingUsers.length}</p>
            <p className="text-xs text-muted-foreground">{ar('طلبات إضافة', 'Pending Requests')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">{ar('النتائج الحالية', 'Current Results')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
              <Input
                placeholder={ar('بحث بالاسم أو رقم الهاتف...', 'Search by name or phone...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="ltr:pl-9 rtl:pr-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
        <TabsList>
          <TabsTrigger value="approved">
            {ar('شيت المتابعة', 'Follow-Up List')}
          </TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            {ar('برا الشيت (طلبات الاضافة)', 'Out of Sheet (Pending)')}
            {pendingUsers.length > 0 && (
              <Badge variant="destructive" className="ltr:ml-2 rtl:mr-2 rounded-full px-1.5 py-0.5 text-[10px]">
                {pendingUsers.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center">
            {activeTab === 'approved' ? ar('قائمة المتابعة', 'Follow-Up List') : ar('عناصر برا الشيت', 'Items Out of Sheet')}
            <Badge variant="secondary" className="ltr:ml-2 rtl:mr-2">
              {filtered.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {searchQuery
                ? ar('لا توجد نتائج مطابقة', 'No matching results')
                : ar('لا توجد سجلات بعد. أضف أول شخص!', 'No records yet. Add your first person!')}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">{ar('م', '#')}</TableHead>
                    <TableHead className="text-center">{ar('الاسم الكامل', 'Full Name')}</TableHead>
                    <TableHead className="text-center">{ar('الهاتف الأول', 'Phone 1')}</TableHead>
                    <TableHead className="text-center">{ar('الهاتف الثاني', 'Phone 2')}</TableHead>
                    {canViewAllBranches && (
                      <TableHead className="text-center">{ar('الفرع', 'Branch')}</TableHead>
                    )}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="text-center text-muted-foreground text-sm">
                        {activeTab === 'approved'
                          ? (approvedRowNumber.get(user.id) ?? '—')
                          : (pendingRowNumber.get(user.id) ?? '—')}
                      </TableCell>
                      <TableCell className="text-center font-medium whitespace-nowrap">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{user.full_name}</span>
                          {user.linked_to && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-full">
                              🔗 {ar('مرتبط بـ', 'Linked →')} {userById.get(user.linked_to)?.full_name ?? `#${user.linked_to}`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm ltr:tracking-wide whitespace-nowrap">
                        {user.phone_1}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm text-muted-foreground whitespace-nowrap">
                        {user.phone_2 || '—'}
                      </TableCell>
                      {canViewAllBranches && (
                        <TableCell className="text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border">
                            {getBranchName(user.branch_id, user.branch)}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <span className="text-lg leading-none">⋯</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {activeTab === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleApprove(user.id)}>
                                  <Check className={cn('h-4 w-4 text-success', isRTL ? 'ml-2' : 'mr-2')} />
                                  {ar('قبول', 'Approve')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openLinkDialog(user)}>
                                  <Link2 className={cn('h-4 w-4 text-orange-500', isRTL ? 'ml-2' : 'mr-2')} />
                                  {ar('ربط بشخص آخر', 'Link to Another')}
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => openParticipations(user)}>
                                <History className={cn('h-4 w-4 text-blue-500', isRTL ? 'ml-2' : 'mr-2')} />
                                {ar('مشاركاته', 'Participations')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(user)}>
                              <Pencil className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                              {ar('تعديل', 'Edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDelete(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                              {ar('حذف', 'Delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {ar(`عرض ${(currentPage - 1) * itemsPerPage + 1} إلى ${Math.min(currentPage * itemsPerPage, filtered.length)} من ${filtered.length}`, `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, filtered.length)} of ${filtered.length}`)}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  {ar('السابق', 'Previous')}
                </Button>
                <span className="text-sm font-medium px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  {ar('التالي', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={open => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-start sm:text-start rtl:text-right ltr:text-left">
            <DialogTitle>{ar('إضافة شخص جديد', 'Add New Person')}</DialogTitle>
            <DialogDescription>
              {ar('أضف شخصاً جديداً لقائمة المتابعة', 'Add a new person to the follow-up list')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{ar('الاسم الكامل', 'Full Name')} *</Label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={ar('محمد أحمد', 'Mohamed Ahmed')}
                  required
                  dir="auto"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{ar('الهاتف الأول', 'Phone 1')} *</Label>
                  <Input
                    value={formPhone1}
                    onChange={e => setFormPhone1(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    type="tel"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{ar('الهاتف الثاني', 'Phone 2')} ({ar('اختياري', 'Optional')})</Label>
                  <Input
                    value={formPhone2}
                    onChange={e => setFormPhone2(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    type="tel"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{ar('الفرع', 'Branch')}</Label>
                <select
                  value={formBranch}
                  onChange={e => setFormBranch(e.target.value)}
                  disabled={!canViewAllBranches}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">{ar('-- بدون فرع --', '-- No Branch --')}</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{language === 'ar' ? b.name_ar : b.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                {ar('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ar('إضافة', 'Add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={open => { setIsEditOpen(open); if (!open) { setSelected(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-start sm:text-start rtl:text-right ltr:text-left">
            <DialogTitle>{ar('تعديل البيانات', 'Edit Person')}</DialogTitle>
            <DialogDescription>
              {ar('تعديل بيانات الشخص في قائمة المتابعة', 'Update person details in follow-up list')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{ar('الاسم الكامل', 'Full Name')} *</Label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={ar('محمد أحمد', 'Mohamed Ahmed')}
                  required
                  dir="auto"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{ar('الهاتف الأول', 'Phone 1')} *</Label>
                  <Input
                    value={formPhone1}
                    onChange={e => setFormPhone1(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    type="tel"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{ar('الهاتف الثاني', 'Phone 2')} ({ar('اختياري', 'Optional')})</Label>
                  <Input
                    value={formPhone2}
                    onChange={e => setFormPhone2(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    type="tel"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{ar('الفرع', 'Branch')}</Label>
                <select
                  value={formBranch}
                  onChange={e => setFormBranch(e.target.value)}
                  disabled={!canViewAllBranches}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">{ar('-- بدون فرع --', '-- No Branch --')}</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{language === 'ar' ? b.name_ar : b.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                {ar('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ar('حفظ', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-start sm:text-start rtl:text-right ltr:text-left">
            <AlertDialogTitle>{ar('تأكيد الإزالة', 'Confirm Removal')}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar(
                `هل أنت متأكد من إزالة "${selected?.full_name}" من الشيت؟ سيتم نقله لقائمة المرفوضين ولن يظهر في الشيت.`,
                `Are you sure you want to remove "${selected?.full_name}" from the sheet? They will be moved to rejected and hidden from the sheet.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ar('حذف', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Import Replace Dialog */}
      <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-start sm:text-start rtl:text-right ltr:text-left w-full">
            <AlertDialogTitle className="text-destructive font-bold text-lg">
              {ar('تحذير: استبدال الشيت بالكامل!', 'Warning: Entire Sheet Replacement!')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground leading-relaxed mt-4 text-start rtl:text-right ltr:text-left">
              {ar(
                `أنت على وشك إضافة ملف يحتوي على ${pendingImportRecords.length} شخص.`,
                `You are about to upload a file containing ${pendingImportRecords.length} participants.`
              )}
              <br /><br />
              <span className="font-bold text-destructive">
                {ar(
                  'تنبيه: سيتم مسح "قائمة المتابعة" الحالية للفرع المحدد ووضع هؤلاء الأسماء مكانهم.',
                  'Note: The current "Follow-Up List" for the selected branch will be wiped and replaced by these names.'
                )}
              </span>
              <br />
              {ar(
                'ملاحظة: طلبات الإضافة (الأسماء برا الشيت) لن يتم مسحها ولن تتأثر.',
                'Note: Pending approvals (names out of sheet) will not be deleted.'
              )}
              <br /><br />
              {ar('هل أنت متأكد أنك تريد الاستمرار واستبدال الشيت؟', 'Are you sure you want to proceed and replace the sheet?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>{ar('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmImportReplace}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : null}
              {ar('تأكيد الاستبدال والمسح', 'Confirm Wipe and Replace')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Template Instructions Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="text-start sm:text-start rtl:text-right ltr:text-left">
            <DialogTitle>{ar('شكل الشيت المطلوب (CSV/Excel)', 'Required Sheet Format')}</DialogTitle>
            <DialogDescription>
              {ar('الشيت يجب أن يحتوي على هذه الأعمدة بالترتيب الموضح، ويتم ربط الفرع باستخدام كود الفرع الذي عينته مسبقاً (مثال: ma للمهندسين).', 'The sheet must have these exact columns. Use branch codes (e.g. ma) mapping for the branch column.')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-left ltr:text-left rtl:text-left">
                    <TableHead className="font-bold text-foreground">id</TableHead>
                    <TableHead className="font-bold text-foreground">full_name</TableHead>
                    <TableHead className="font-bold text-foreground">phone_1</TableHead>
                    <TableHead className="font-bold text-foreground">phone_2</TableHead>
                    <TableHead className="font-bold text-foreground">branch_id</TableHead>
                    <TableHead className="font-bold text-foreground text-blue-600">linked_to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-left ltr:text-left rtl:text-left">
                  <TableRow>
                    <TableCell className="font-mono text-muted-foreground"></TableCell>
                    <TableCell>أحمد محمد</TableCell>
                    <TableCell className="font-mono">01012345678</TableCell>
                    <TableCell className="font-mono text-muted-foreground">01123456789</TableCell>
                    <TableCell className="font-mono text-primary font-bold">ma</TableCell>
                    <TableCell className="font-mono text-muted-foreground"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-muted-foreground"></TableCell>
                    <TableCell>محمود خليل</TableCell>
                    <TableCell className="font-mono">01234567890</TableCell>
                    <TableCell className="font-mono text-muted-foreground"></TableCell>
                    <TableCell className="font-mono text-primary font-bold">hq</TableCell>
                    <TableCell className="font-mono text-muted-foreground"></TableCell>
                  </TableRow>
                  <TableRow className="bg-blue-50/50 dark:bg-blue-950/20">
                    <TableCell className="font-mono text-muted-foreground"></TableCell>
                    <TableCell>أحمد م. القديم</TableCell>
                    <TableCell className="font-mono">01099999999</TableCell>
                    <TableCell className="font-mono text-muted-foreground"></TableCell>
                    <TableCell className="font-mono text-primary font-bold">ma</TableCell>
                    <TableCell className="font-mono text-blue-600 font-bold">1</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded border border-amber-200 dark:border-amber-900 leading-relaxed font-medium">
              - يُمكنك استخدام شيت Excel (.xlsx) أو شيت ملف نصي (.csv).<br />
              - الهاتف الثاني والفرع حقول اختيارية يُمكن تركها فارغة.<br />
              - النظام يتعرف بذكاء على العناوين بالإنجليزية (مثال: full_name, phone_1, phone_2, branch_id) وأيضاً يتجاهل عمود الـ ID تلقائياً.<br />
              - في عمود (الفرع)، تأكد من وضع <b>الكود (Code)</b> الخاص بالفرع بحروف إنجليزية (مثل ma, 6o).
            </div>
            <div className="text-sm text-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3 rounded border border-blue-200 dark:border-blue-900 leading-relaxed font-medium">
              🔗 <b>عمود linked_to (اختياري — للربط بشخص آخر):</b><br />
              لو شخصان مختلفان في الاسم والرقم لكنهم في الواقع نفس الشخص، اكتب في هذا العمود <b>رقم الصف (م)</b> للشخص الأساسي.<br />
              مثال: في الصف الأخير أعلاه، «أحمد م. القديم» مرتبط بـ «أحمد محمد» (الصف رقم 1)، فتُضاف مشاركاته تلقائياً لحساب «أحمد محمد» ويظهر عليه أيقونة 🔗.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              {ar('إغلاق', 'Close')}
            </Button>
            <Button onClick={downloadExcelTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              {ar('تحميل شيت فارغ (Excel)', 'Download Empty Excel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Participations Viewer Dialog */}
      <Dialog open={isParticipationsOpen} onOpenChange={setIsParticipationsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="text-start sm:text-start rtl:text-right ltr:text-left">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {ar(`مشاركات: ${participationsUser?.full_name}`, `Participations: ${participationsUser?.full_name}`)}
            </DialogTitle>
            <DialogDescription>
              {ar('سجل المشاركات المرتبطة بهذا الرقم في نظام الأنشطة', 'Activity submission history linked to this phone number')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {isLoadingParticipations ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : participationsList.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {ar('لا توجد مشاركات مسجلة لهذا الشخص', 'No participations found for this person')}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-center">{ar('م', '#')}</TableHead>
                      <TableHead>{ar('نوع النشاط', 'Activity Type')}</TableHead>
                      <TableHead className="text-center">{ar('التاريخ', 'Date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participationsList.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-center text-muted-foreground text-sm">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          {language === 'ar'
                            ? p.activity_types?.name_ar || p.activity_types?.name || ar('نشاط', 'Activity')
                            : p.activity_types?.name || p.activity_types?.name_ar || 'Activity'}
                        </TableCell>
                        <TableCell className="text-center text-sm font-mono" dir="ltr">
                          {(() => {
                            const d = p.date || p.submitted_at || p.created_at;
                            return d ? new Date(d).toLocaleDateString('en-GB') : '—';
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsParticipationsOpen(false)}>
              {ar('إغلاق', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Link-to-Another Dialog ─────────────────────────────────── */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{ar('ربط بشخص آخر', 'Link to Another Person')}</DialogTitle>
            <DialogDescription>
              {linkSourceUser && ar(
                `"${linkSourceUser.full_name}" (${linkSourceUser.phone_1}) — هيتحذف من الشيت ومشاركاته هتتنقل للشخص اللي تختاره.`,
                `"${linkSourceUser.full_name}" (${linkSourceUser.phone_1}) — will be removed from the sheet and participations transferred to the person you select.`
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>{ar('ابحث عن الشخص المعتمد', 'Search approved person')}</Label>
              <Input
                placeholder={ar('اسم أو رقم...', 'Name or phone...')}
                value={linkTargetPhone}
                onChange={e => searchLinkTarget(e.target.value)}
                className="mt-1"
              />
            </div>

            {linkSearchResults.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {linkSearchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedLinkTarget(u)}
                    className={cn(
                      'w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between',
                      selectedLinkTarget?.id === u.id && 'bg-accent ring-1 ring-primary'
                    )}
                  >
                    <div>
                      <span className="font-medium">{u.full_name}</span>
                      <span className="text-muted-foreground text-xs mx-2">{u.phone_1}</span>
                    </div>
                    {selectedLinkTarget?.id === u.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}

            {selectedLinkTarget && (
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md p-3 text-sm">
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  {ar('سيتم:', 'Will:')}
                </p>
                <ul className={cn('mt-1 space-y-1 text-orange-600 dark:text-orange-300', isRTL ? 'pr-4' : 'pl-4')} style={{ listStyleType: 'disc' }}>
                  <li>{ar(
                    `حذف "${linkSourceUser?.full_name}" من طلبات الإضافة`,
                    `Remove "${linkSourceUser?.full_name}" from pending requests`
                  )}</li>
                  <li>{ar(
                    `نقل كل مشاركاته بالرقم ${linkSourceUser?.phone_1} إلى "${selectedLinkTarget.full_name}"`,
                    `Transfer all participations with phone ${linkSourceUser?.phone_1} to "${selectedLinkTarget.full_name}"`
                  )}</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLinkDialogOpen(false)}>
              {ar('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={handleLinkToAnother}
              disabled={!selectedLinkTarget || isSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              <Link2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {ar('ربط ونقل المشاركات', 'Link & Transfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict Resolution Modal */}
      <Dialog open={isConflictModalOpen} onOpenChange={setIsConflictModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="text-start sm:text-start rtl:text-right ltr:text-left">
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {ar('حل التعارضات (أرقام مكررة)', 'Resolve Conflicts (Duplicate Phones)')}
            </DialogTitle>
            <DialogDescription>
              {ar(
                'تم العثور على أرقام هواتف في الشيت موجودة بالفعل في قاعدة البيانات. اختر الإجراء المناسب لكل سجل.',
                'Some phone numbers in the sheet already exist in the database. Choose the appropriate action for each record.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {conflictRecords.map((conflict, idx) => (
              <div key={idx} className="border rounded-md p-4 bg-muted/20">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <Badge variant="outline" className="mb-2">
                      {ar('من الشيت', 'From Sheet')}
                    </Badge>
                    <p className="font-semibold text-base">{conflict.excelRow.full_name}</p>
                    <p className="text-sm font-mono text-muted-foreground">{conflict.excelRow.phone_1}</p>
                  </div>
                  
                  <div className="w-full sm:w-1/2">
                    <Label className="text-xs mb-1.5 inline-block text-muted-foreground">
                      {ar('الإجراء', 'Action')}
                    </Label>
                    <Select
                      value={conflict.selectedMatchId?.toString()}
                      onValueChange={(val) => {
                        const newConflicts = [...conflictRecords];
                        let parsedVal: number | 'skip' | 'new' = 'skip';
                        if (val === 'new') parsedVal = 'new';
                        else if (val !== 'skip') parsedVal = parseInt(val, 10);
                        
                        newConflicts[idx].selectedMatchId = parsedVal;
                        setConflictRecords(newConflicts);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip" className="text-red-500 font-medium">
                          {ar('تخطي (لا تقم بالإضافة)', 'Skip (Do not import)')}
                        </SelectItem>
                        <SelectItem value="new" className="text-blue-500 font-medium">
                          {ar('إضافة كملف جديد منفصل (مكرر)', 'Add as new separate profile')}
                        </SelectItem>
                        {conflict.possibleMatches.map((match) => (
                          <SelectItem key={match.id} value={match.id.toString()}>
                            {ar('ربط مع:', 'Link to:')} {match.full_name} ({match.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => {
              setIsConflictModalOpen(false);
              setPendingImportRecords([]);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}>
              {ar('إلغاء الاستيراد', 'Cancel Import')}
            </Button>
            <Button onClick={handleConflictResolutionSubmit}>
              {ar('متابعة للاستبدال', 'Continue to Replace')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
