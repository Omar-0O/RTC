import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Pencil, Trash2, Loader2, Download, Upload, RefreshCw, Check, History
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
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface FollowUpUser {
  id: number;
  full_name: string;
  phone_1: string;
  phone_2: string | null;
  branch: string | null;
  branch_id: string | null;
  created_at: string;
  status: string;
  linked_to: number | null;
}

// Converts Arabic/Eastern Arabic numerals to Western Arabic numerals and strips non-digit chars
const normalizePhone = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return String(raw)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)) // Eastern Arabic
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0)) // Persian
    .replace(/[^\d+]/g, '')  // keep only digits and leading +
    .replace(/^\+/, '');     // strip leading + for storage consistency
};

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
  const [branchFilter, setBranchFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('approved');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<FollowUpUser | null>(null);

  // Import Confirmation State
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [pendingImportRecords, setPendingImportRecords] = useState<any[]>([]);

  // Conflict Resolution State
  // conflictGroups: array of groups, each group = array of records sharing the same phone
  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [conflictGroups, setConflictGroups] = useState<any[][]>([]);
  // selectedConflictChoice: for each group index, which record index is selected
  const [selectedConflictChoice, setSelectedConflictChoice] = useState<Record<number, number>>({});
  // cleanRecords: the non-conflicting records from the import that are ready to go
  const [cleanImportRecords, setCleanImportRecords] = useState<any[]>([]);

  // Template State
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  // Participations viewer
  const [isParticipationsOpen, setIsParticipationsOpen] = useState(false);
  const [participationsUser, setParticipationsUser] = useState<FollowUpUser | null>(null);
  const [participationsList, setParticipationsList] = useState<any[]>([]);
  const [isLoadingParticipations, setIsLoadingParticipations] = useState(false);

  const openParticipations = async (user: FollowUpUser) => {
    setParticipationsUser(user);
    setParticipationsList([]);
    setIsParticipationsOpen(true);
    setIsLoadingParticipations(true);
    try {
      // Collect own phones
      const ownPhones = [user.phone_1, user.phone_2].filter(Boolean).map(p => normalizePhone(p!));

      // Also collect phones from any alias entries (users whose linked_to = this user's id)
      const { data: aliasEntries } = await (supabase as any)
        .from('users_followup')
        .select('phone_1, phone_2, full_name')
        .eq('linked_to', user.id);

      const aliasPhones: string[] = [];
      if (aliasEntries) {
        aliasEntries.forEach((a: any) => {
          if (a.phone_1) aliasPhones.push(normalizePhone(a.phone_1));
          if (a.phone_2) aliasPhones.push(normalizePhone(a.phone_2));
        });
      }

      const phones = [...new Set([...ownPhones, ...aliasPhones])].filter(Boolean);

      const [submissionsRes, profileRes] = await Promise.all([
        phones.length > 0
          ? (supabase as any)
              .from('activity_submissions')
              .select('*, activity_types(name, name_ar)')
              .or(phones.map(p => `guest_phone.ilike.%${p}%`).join(','))
              .order('created_at', { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [] }),
        phones.length > 0
          ? (supabase as any)
              .from('profiles')
              .select('id, full_name, phone')
              .in('phone', phones)
              .limit(1)
          : Promise.resolve({ data: [] }),
      ]);

      let items: any[] = submissionsRes.data || [];

      // If we found a volunteer profile, also get their submissions by volunteer_id
      if (profileRes.data && profileRes.data.length > 0) {
        const volunteerId = profileRes.data[0].id;
        const { data: volunteerSubmissions } = await (supabase as any)
          .from('activity_submissions')
          .select('*, activity_types(name, name_ar)')
          .eq('volunteer_id', volunteerId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (volunteerSubmissions) {
          const existingIds = new Set(items.map((i: any) => i.id));
          volunteerSubmissions.forEach((s: any) => {
            if (!existingIds.has(s.id)) items.push(s);
          });
        }
      }

      items.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setParticipationsList(items);
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
      // Build base query — branch_admin sees only their branch
      const baseQuery = () => {
        let q = (supabase as any).from('users_followup').select('*', { count: 'exact', head: true });
        if (!canViewAllBranches && activeBranch?.id) {
          q = q.eq('branch_id', activeBranch.id);
        }
        return q;
      };

      const { count, error: countError } = await baseQuery();
      if (countError) throw countError;

      const total = count ?? 0;
      const pageSize = 1000;
      let allData: FollowUpUser[] = [];

      const promises = [];
      for (let from = 0; from < total; from += pageSize) {
        const to = Math.min(from + pageSize - 1, total - 1);
        let q = (supabase as any)
          .from('users_followup')
          .select('*')
          .order('id', { ascending: true })
          .range(from, to);
        if (!canViewAllBranches && activeBranch?.id) {
          q = q.eq('branch_id', activeBranch.id);
        }
        promises.push(q);
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.error) throw res.error;
        if (res.data) allData = allData.concat(res.data as FollowUpUser[]);
      }

      setUsers(allData);
    } catch (err) {
      toast.error(ar('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSyncAndRefresh = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Follow-up Users normal refresh
      await fetchUsers();

      // 2. Fetch all submissions, trainers, profiles to sync missing
      const { data: submissions } = await (supabase as any).from('activity_submissions').select('*');
      const { data: trainers } = await (supabase as any).from('trainers').select('id, user_id, name_en, name_ar, phone');
      const { data: profiles } = await (supabase as any).from('profiles').select('id, full_name, full_name_ar, phone');

      if (!submissions) return;

      const profilesMap = new Map();
      profiles?.forEach((p: any) => profilesMap.set(p.id, p));

      const phoneToExistingUser = new Map<string, string>();
      users.forEach(u => {
        if (u.phone_1) phoneToExistingUser.set(normalizePhone(u.phone_1), u.full_name);
        if (u.phone_2) phoneToExistingUser.set(normalizePhone(u.phone_2), u.full_name);
      });

      const newUsersToInsert: any[] = [];

      submissions.forEach((s: any) => {
        let participantName = '';
        const phones: string[] = [];

        if (s.guest_name || s.guest_phone) {
          participantName = s.guest_name || '';
          if (s.guest_phone) phones.push(s.guest_phone);
        }

        if (s.volunteer_id) {
          const p = profilesMap.get(s.volunteer_id);
          if (p) {
            if (!participantName) participantName = p.full_name_ar || p.full_name || '';
            if (p.phone) phones.push(p.phone);
          }
        }

        if (s.trainer_id) {
          const tr = trainers?.find((t: any) => t.id === s.trainer_id);
          if (tr) {
            if (!participantName) participantName = tr.name_ar || tr.name_en;
            if (tr.phone) phones.push(tr.phone);
          }
        } else if (s.volunteer_id) {
          const tr = trainers?.find((t: any) => t.user_id === s.volunteer_id);
          if (tr) {
            if (!participantName) participantName = tr.name_ar || tr.name_en;
            if (tr.phone) phones.push(tr.phone);
          }
        }

        if (!participantName) participantName = ar('غير معروف', 'Unknown');

        const cleanPhones = phones.map(p => normalizePhone(p)).filter(p => p.length > 0);

        let found = false;
        for (const p of cleanPhones) {
          if (phoneToExistingUser.has(p)) { found = true; break; }
        }

        if (!found && cleanPhones.length > 0) {
          const primaryPhone = cleanPhones[0];
          phoneToExistingUser.set(primaryPhone, participantName);

          // Try to resolve branch_id from the submission
          let resolvedBranchId: string | null = s.branch_id || null;

          // If no branch_id on submission, try to match via location string (code or name)
          if (!resolvedBranchId && s.location) {
            const loc = String(s.location).toLowerCase().trim();
            const bMatch = branches.find(b =>
              (b.code && b.code.toLowerCase() === loc) ||
              b.name.toLowerCase() === loc ||
              b.name_ar === s.location
            );
            if (bMatch) resolvedBranchId = bMatch.id;
          }

          newUsersToInsert.push({
            full_name: participantName,
            phone_1: primaryPhone,
            phone_2: cleanPhones[1] || null,
            branch_id: resolvedBranchId,
            status: 'pending'
          });
        }
      });

      if (newUsersToInsert.length > 0) {
        const { error } = await (supabase as any).from('users_followup').insert(newUsersToInsert);
        if (error) throw error;
        toast.success(ar(`تم العثور على ${newUsersToInsert.length} مشارك جديد وإضافتهم لطلبات الإضافة!`, `Found and added ${newUsersToInsert.length} new participants to pending!`));
        await fetchUsers(); // Refresh the list with the newly inserted pending users
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

  // Map id → user for quick lookup (linked_to display)
  const userById = useMemo(() => {
    const m = new Map<number, FollowUpUser>();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const dataSource = activeTab === 'approved' ? approvedUsers : pendingUsers;
    const q = searchQuery.toLowerCase();
    return dataSource.filter(u => {
      const matchSearch =
        u.full_name.toLowerCase().includes(q) ||
        u.phone_1.includes(q) ||
        (u.phone_2 || '').includes(q);
      const matchBranch = branchFilter === 'all' || u.branch_id === branchFilter;
      return matchSearch && matchBranch;
    });
  }, [approvedUsers, pendingUsers, activeTab, searchQuery, branchFilter]);

  // Reset pagination when searching/filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, branchFilter]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const resetForm = () => {
    setFormName('');
    setFormPhone1('');
    setFormPhone2('');
    setFormBranch('');
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
      const { error } = await (supabase as any)
        .from('users_followup')
        .insert({
          full_name: formName.trim(),
          phone_1: normalizePhone(formPhone1),
          phone_2: formPhone2.trim() ? normalizePhone(formPhone2) : null,
          branch_id: formBranch || null,
          status: 'approved'
        });
      if (error) throw error;
      toast.success(ar('تم الإضافة بنجاح', 'Added successfully'));
      setIsAddOpen(false);
      resetForm();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || ar('فشل في الإضافة', 'Failed to add'));
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
      const { error } = await (supabase as any)
        .from('users_followup')
        .update({
          full_name: formName.trim(),
          phone_1: normalizePhone(formPhone1),
          phone_2: formPhone2.trim() ? normalizePhone(formPhone2) : null,
          branch_id: formBranch || null,
        })
        .eq('id', selected.id);
      if (error) throw error;
      toast.success(ar('تم التعديل بنجاح', 'Updated successfully'));
      setIsEditOpen(false);
      setSelected(null);
      resetForm();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || ar('فشل في التعديل', 'Failed to update'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('users_followup')
        .update({ status: 'approved' })
        .eq('id', id);
      if (error) throw error;
      toast.success(ar('تم قبول الشخص بنجاح', 'Person approved successfully'));
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || ar('فشل في القبول', 'Failed to approve'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('users_followup')
        .delete()
        .eq('id', selected.id);
      if (error) throw error;
      toast.success(ar('تم الحذف بنجاح', 'Deleted successfully'));
      setIsDeleteOpen(false);
      setSelected(null);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || ar('فشل في الحذف', 'Failed to delete'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
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

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ar('شيت المتابعة', 'Follow-up'));
    
    XLSX.writeFile(wb, `followup_users_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(ar('تم التصدير بنجاح', 'Exported successfully'));
  };

  const downloadCSVTemplate = () => {
    const headers = ['id', 'full_name', 'phone_1', 'phone_2', 'branch_id', 'linked_to'];
    const example1 = ['', 'أحمد محمد', '01012345678', '01123456789', 'ma', ''];
    const example2 = ['', 'محمود خليل', '01234567890', '', 'hq', ''];
    const example3 = ['', 'أحمد م. القديم', '01099999999', '', 'ma', '1'];
    
    // Create CSV string with UTF-8 BOM so Excel opens Arabic correctly
    const csvContent = '\uFEFF' + [headers, example1, example2, example3].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    toast.info(ar('جاري معالجة الملف...', 'Processing file...'));

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

          // Smart parsing: scan the first 10 rows to find the headers and normalize arabic letters
          let headerRowIdx = -1;
          let nameIdx = -1, phone1Idx = -1, phone2Idx = -1, branchIdx = -1, linkedToIdx = -1;

          for (let r = 0; r < Math.min(data.length, 10); r++) {
            const row = data[r] || [];
            if (!Array.isArray(row)) continue;

            const normalize = (val: any) => typeof val === 'string' ? val.toLowerCase().replace(/[أإآ]/g, 'ا').trim() : '';

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
          const newRecords: any[] = [];
          for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0 || !row[nameIdx] || !row[phone1Idx]) continue;
            const rawBranch = branchIdx !== -1 && row[branchIdx] ? String(row[branchIdx]).trim() : null;
            let branchIdToUse = null;
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

            // Normalize phone numbers (Arabic/Eastern digits → Western digits)
            const p1 = normalizePhone(String(row[phone1Idx]));
            const p2 = phone2Idx !== -1 && row[phone2Idx] ? normalizePhone(String(row[phone2Idx])) : null;

            if (!p1) continue; // skip rows with no valid phone after normalization

            // Parse linked_to as a 1-based row index within this same sheet (resolved after insert)
            let linkedToRow: number | null = null;
            if (linkedToIdx !== -1 && row[linkedToIdx] !== undefined && row[linkedToIdx] !== null && row[linkedToIdx] !== '') {
              const parsed = parseInt(String(row[linkedToIdx]).trim(), 10);
              if (!isNaN(parsed) && parsed > 0) linkedToRow = parsed;
            }

            newRecords.push({
              full_name: String(row[nameIdx]).trim(),
              phone_1: p1,
              phone_2: p2 || null,
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

          // ── Detect duplicates within the uploaded file ────────────────────────
          // Group records by their primary phone
          const phoneGroupMap = new Map<string, any[]>();
          for (const rec of newRecords) {
            const key = rec.phone_1;
            if (!phoneGroupMap.has(key)) phoneGroupMap.set(key, []);
            phoneGroupMap.get(key)!.push(rec);
          }

          const conflicts: any[][] = [];
          const clean: any[] = [];

          for (const [, group] of phoneGroupMap.entries()) {
            if (group.length > 1) {
              conflicts.push(group);
            } else {
              clean.push(group[0]);
            }
          }

          if (conflicts.length > 0) {
            // Show conflict resolution dialog — user picks which record to keep per group
            setCleanImportRecords(clean);
            setConflictGroups(conflicts);
            // Default selection: first entry in each group
            const defaults: Record<number, number> = {};
            conflicts.forEach((_, gi) => { defaults[gi] = 0; });
            setSelectedConflictChoice(defaults);
            setIsConflictOpen(true);
          } else {
            // No conflicts — go straight to confirmation
            setPendingImportRecords(clean);
            setIsImportConfirmOpen(true);
          }
        } catch (err: any) {
          console.error('Parse error:', err);
          toast.error(ar('حدث خطأ أثناء قراءة الملف.', 'Error parsing file.'));
        } finally {
          setIsSubmitting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      toast.error(err.message || ar('حدث خطأ', 'An error occurred'));
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImportReplace = async () => {
    setIsSubmitting(true);
    setIsImportConfirmOpen(false);
    try {
      // 1. Delete all existing approved users (replacing the sheet)
      const { error: deleteError } = await (supabase as any)
        .from('users_followup')
        .delete()
        .eq('status', 'approved');
        
      if (deleteError) throw deleteError;

      // 2. Extract linked_to row references (temporary field, not sent to DB)
      const linkedToRows: (number | null)[] = pendingImportRecords.map(r => r._linkedToRow ?? null);
      const cleanRecords = pendingImportRecords.map(({ _linkedToRow, ...rest }) => rest);

      // 3. Insert records in batches and capture the returned IDs in insertion order
      const insertedIds: number[] = [];
      const BATCH = 100;
      for (let i = 0; i < cleanRecords.length; i += BATCH) {
        const batch = cleanRecords.slice(i, i + BATCH);
        const { data: inserted, error: insertError } = await (supabase as any)
          .from('users_followup')
          .insert(batch)
          .select('id');
        if (insertError) throw insertError;
        (inserted as { id: number }[])?.forEach(r => insertedIds.push(r.id));
      }

      // 4. Build 1-based row index → DB id map and apply linked_to updates
      const rowToDbId: Record<number, number> = {};
      insertedIds.forEach((dbId, idx) => { rowToDbId[idx + 1] = dbId; });

      const linkUpdates = linkedToRows
        .map((rowRef, idx) =>
          rowRef && rowToDbId[rowRef] && insertedIds[idx]
            ? { id: insertedIds[idx], linked_to: rowToDbId[rowRef] }
            : null
        )
        .filter((x): x is { id: number; linked_to: number } => x !== null);

      if (linkUpdates.length > 0) {
        await Promise.all(
          linkUpdates.map(upd =>
            (supabase as any)
              .from('users_followup')
              .update({ linked_to: upd.linked_to })
              .eq('id', upd.id)
          )
        );
      }

      toast.success(ar(
        `تم استبدال الشيت بنجاح بـ ${pendingImportRecords.length} سجل${linkUpdates.length > 0 ? ` (${linkUpdates.length} مرتبط)` : ''}.`,
        `Sheet successfully replaced with ${pendingImportRecords.length} records${linkUpdates.length > 0 ? ` (${linkUpdates.length} linked)` : ''}.`
      ));
      setPendingImportRecords([]);
      await fetchUsers();
    } catch (err: any) {
      console.error('Import insert error:', err);
      toast.error(ar('حدث خطأ أثناء تحديث قاعدة البيانات.', 'Error updating database.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const UserFormFields = () => (
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
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">{ar('-- بدون فرع --', '-- No Branch --')}</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{language === 'ar' ? b.name_ar : b.name}</option>
          ))}
        </select>
      </div>
    </div>
  );

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
            <p className="text-2xl font-bold text-primary">{users.length}</p>
            <p className="text-xs text-muted-foreground">{ar('إجمالي السجلات', 'Total Records')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">{ar('نتائج البحث', 'Search Results')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-green-600">{branches.length}</p>
            <p className="text-xs text-muted-foreground">{ar('عدد الفروع', 'Branches')}</p>
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
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[150px]"
            >
              <option value="all">{ar('كل الفروع', 'All Branches')}</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{language === 'ar' ? b.name_ar : b.name}</option>
              ))}
            </select>
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
              {searchQuery || branchFilter !== 'all'
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
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((user, idx) => {
                    const actualIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                    <TableRow key={user.id}>
                      <TableCell className="text-center text-muted-foreground text-sm">{actualIdx}</TableCell>
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
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <span className="text-lg leading-none">⋯</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {activeTab === 'pending' && (
                              <DropdownMenuItem onClick={() => handleApprove(user.id)}>
                                <Check className={cn('h-4 w-4 text-success', isRTL ? 'ml-2' : 'mr-2')} />
                                {ar('قبول', 'Approve')}
                              </DropdownMenuItem>
                            )}
                            {activeTab === 'pending' && (
                              <DropdownMenuItem onClick={() => openParticipations(user)}>
                                <History className={cn('h-4 w-4 text-blue-500', isRTL ? 'ml-2' : 'mr-2')} />
                                {ar('مشاركاته', 'Participations')}
                              </DropdownMenuItem>
                            )}
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
                  )})}
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
            <UserFormFields />
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
            <UserFormFields />
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
            <AlertDialogTitle>{ar('تأكيد الحذف', 'Confirm Deletion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar(
                `هل أنت متأكد من حذف "${selected?.full_name}" من قائمة المتابعة؟ لا يمكن التراجع.`,
                `Are you sure you want to remove "${selected?.full_name}" from the follow-up list? This cannot be undone.`
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
              <br/><br/>
              <span className="font-bold text-destructive">
                {ar(
                  'تنبيه: سيتم مسح "قائمة المتابعة" الحالية بالكامل ووضع هؤلاء الأسماء مكانهم.',
                  'Note: The current "Follow-Up List" will be COMPLETELY wiped and replaced by these names.'
                )}
              </span>
              <br/>
              {ar(
                'ملاحظة: طلبات الإضافة (الأسماء برا الشيت) لن يتم مسحها ولن تتأثر.',
                'Note: Pending approvals (names out of sheet) will not be deleted.'
              )}
              <br/><br/>
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

      {/* ── Conflict Resolution Dialog ─────────────────────────────────────── */}
      <Dialog open={isConflictOpen} onOpenChange={open => {
        if (!open) setIsConflictOpen(false);
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="text-start rtl:text-right ltr:text-left">
            <DialogTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2">
              ⚠ {ar('تعارض في الأرقام — اختر الأولوية', 'Duplicate Phone Numbers — Choose Priority')}
            </DialogTitle>
            <DialogDescription>
              {ar(
                `الشيت يحتوي على ${conflictGroups.length} رقم هاتف متكرر. اختر لكل رقم الاسم الذي سيُحفظ في الشيت.`,
                `The sheet contains ${conflictGroups.length} duplicated phone number(s). Choose which name to keep for each.`
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {conflictGroups.map((group, gi) => (
              <div key={gi} className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                  {ar('الرقم المتكرر:', 'Duplicated phone:')} <span className="font-mono">{group[0].phone_1}</span>
                </p>
                <div className="space-y-2">
                  {group.map((rec: any, ri: number) => (
                    <label
                      key={ri}
                      className={`flex items-center gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${
                        selectedConflictChoice[gi] === ri
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`conflict-group-${gi}`}
                        checked={selectedConflictChoice[gi] === ri}
                        onChange={() => setSelectedConflictChoice(prev => ({ ...prev, [gi]: ri }))}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{rec.full_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{rec.phone_1}{rec.phone_2 ? ` / ${rec.phone_2}` : ''}</p>
                      </div>
                      {selectedConflictChoice[gi] === ri && (
                        <span className="text-xs font-semibold text-primary shrink-0">{ar('✓ مختار', '✓ Selected')}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsConflictOpen(false);
                setConflictGroups([]);
                setCleanImportRecords([]);
              }}
            >
              {ar('إلغاء الاستيراد', 'Cancel Import')}
            </Button>
            <Button
              onClick={() => {
                // Merge: clean + one chosen record per conflict group
                const chosen = conflictGroups.map((group, gi) => group[selectedConflictChoice[gi] ?? 0]);
                const finalRecords = [...cleanImportRecords, ...chosen];
                setIsConflictOpen(false);
                setConflictGroups([]);
                setCleanImportRecords([]);
                setPendingImportRecords(finalRecords);
                setIsImportConfirmOpen(true);
              }}
            >
              {ar('تأكيد الاختيار والمتابعة', 'Confirm & Continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              - يُمكنك استخدام شيت Excel (.xlsx) أو شيت ملف نصي (.csv).<br/>
              - الهاتف الثاني والفرع حقول اختيارية يُمكن تركها فارغة.<br/>
              - النظام يتعرف بذكاء على العناوين بالإنجليزية (مثال: full_name, phone_1, phone_2, branch_id) وأيضاً يتجاهل عمود الـ ID تلقائياً.<br/>
              - في عمود (الفرع)، تأكد من وضع <b>الكود (Code)</b> الخاص بالفرع بحروف إنجليزية (مثل ma, 6o).
            </div>
            <div className="text-sm text-blue-700 bg-blue-50 dark:bg-blue-950/30 p-3 rounded border border-blue-200 dark:border-blue-900 leading-relaxed font-medium">
              🔗 <b>عمود linked_to (اختياري — للربط بشخص آخر):</b><br/>
              لو شخصان مختلفان في الاسم والرقم لكنهم في الواقع نفس الشخص، اكتب في هذا العمود <b>رقم الصف (م)</b> للشخص الأساسي.<br/>
              مثال: في الصف الأخير أعلاه، «أحمد م. القديم» مرتبط بـ «أحمد محمد» (الصف رقم 1)، فتُضاف مشاركاته تلقائياً لحساب «أحمد محمد» ويظهر عليه أيقونة 🔗.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              {ar('إغلاق', 'Close')}
            </Button>
            <Button onClick={downloadCSVTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              {ar('تحميل شيت فارغ (CSV)', 'Download Empty CSV')}
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
                      <TableHead className="text-center">{ar('الحالة', 'Status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participationsList.map((p: any, i: number) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-center text-muted-foreground text-sm">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          {language === 'ar'
                            ? p.activity_types?.name_ar || p.activity_types?.name || ar('نشاط', 'Activity')
                            : p.activity_types?.name || p.activity_types?.name_ar || 'Activity'}
                        </TableCell>
                        <TableCell className="text-center text-sm font-mono">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString('ar-EG') : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                            p.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                          }`}>
                            {p.status === 'approved' ? ar('مقبول', 'Approved') :
                             p.status === 'rejected' ? ar('مرفوض', 'Rejected') :
                             ar('قيد المراجعة', 'Pending')}
                          </span>
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
    </div>
  );
}
