import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Pencil, Trash2, Loader2, Download, Upload, RefreshCw, Check, History, Link2
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
import { normalizePhoneE164, phonesAreEqual } from '@/utils/phoneUtils';

interface FollowUpUser {
  id: number;
  full_name: string;
  /** Normalized E.164 value stored in DB */
  phone_1: string;
  /** Normalized E.164 value stored in DB */
  phone_2: string | null;
  branch: string | null;
  branch_id: string | null;
  created_at: string;
  status: string;
  linked_to: number | null;
}

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
  const [pendingImportRecords, setPendingImportRecords] = useState<any[]>([]);



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
          ? (() => {
              // Generate search variants for each phone to catch all storage formats.
              // e.g. +201005784855 → also search 201005784855 and 01005784855
              const variants = new Set<string>();
              phones.forEach(p => {
                variants.add(p); // full normalized: +201...
                if (p.startsWith('+')) variants.add(p.slice(1));         // 201...
                if (p.startsWith('+20')) variants.add('0' + p.slice(3)); // 01...
                if (p.startsWith('201')) variants.add('0' + p.slice(2)); // 01...
              });
              const orFilter = [...variants].map(v => `guest_phone.ilike.%${v}%`).join(',');
              return (supabase as any)
                .from('activity_submissions')
                .select('id, date, submitted_at, created_at, activity_types(name, name_ar)')
                .or(orFilter)
                .order('date', { ascending: false, nullsLast: true })
                .limit(200);
            })()
          : Promise.resolve({ data: [] }),
        phones.length > 0
          ? (() => {
              // Generate search variants for profiles too
              const profileVariants = new Set<string>();
              phones.forEach(p => {
                profileVariants.add(p);
                if (p.startsWith('+')) profileVariants.add(p.slice(1));
                if (p.startsWith('+20')) profileVariants.add('0' + p.slice(3));
              });
              return (supabase as any)
                .from('profiles')
                .select('id, full_name, phone')
                .in('phone', [...profileVariants])
                .limit(1);
            })()
          : Promise.resolve({ data: [] }),
      ]);

      let items: any[] = submissionsRes.data || [];

      // If we found a volunteer profile, also get their submissions by volunteer_id
      if (profileRes.data && profileRes.data.length > 0) {
        const volunteerId = profileRes.data[0].id;
        const { data: volunteerSubmissions } = await (supabase as any)
          .from('activity_submissions')
          .select('id, date, submitted_at, created_at, activity_types(name, name_ar)')
          .eq('volunteer_id', volunteerId)
          .order('date', { ascending: false, nullsLast: true })
          .limit(100);
        if (volunteerSubmissions) {
          const existingIds = new Set(items.map((i: any) => i.id));
          volunteerSubmissions.forEach((s: any) => {
            if (!existingIds.has(s.id)) items.push(s);
          });
        }
      }

      // Sort by actual session date (most recent first)
      items.sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.submitted_at || a.created_at).getTime();
        const dateB = new Date(b.date || b.submitted_at || b.created_at).getTime();
        return dateB - dateA;
      });
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
      // Only fetch approved + pending — rejected records are invisible to the UI
      const statusFilter = ['approved', 'pending'];

      // Build base query — branch_admin sees only their branch
      const baseQuery = () => {
        let q = (supabase as any).from('users_followup').select('*', { count: 'exact', head: true })
          .in('status', statusFilter);
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
          .in('status', statusFilter)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranch?.id, canViewAllBranches]);

  const handleSyncAndRefresh = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Follow-up Users normal refresh
      await fetchUsers();

      // 2. Fetch submissions with only the columns needed for sync
      // Sync only needs phone/name/branch info — not full records
      // NOTE: This query intentionally fetches ALL statuses/branches because we need
      //       to detect new participants across the entire system.
      let submissions: any[] = [];
      const subBatchSize = 1000;
      let hasMoreSubmissions = true;
      let subOffset = 0;

      while (hasMoreSubmissions) {
        let subQuery = (supabase as any)
          .from('activity_submissions')
          .select('id, guest_name, guest_phone, volunteer_id, trainer_id, branch_id, location')
          .range(subOffset, subOffset + subBatchSize - 1);

        // Branch admin only syncs their own branch submissions
        if (!canViewAllBranches && activeBranch?.id) {
          subQuery = subQuery.eq('branch_id', activeBranch.id);
        }

        const { data: batch, error: subError } = await subQuery;

        if (subError) throw subError;
        if (!batch || batch.length === 0) {
          hasMoreSubmissions = false;
        } else {
          submissions = [...submissions, ...batch];
          subOffset += subBatchSize;
          if (batch.length < subBatchSize) hasMoreSubmissions = false;
        }
      }

      const { data: trainers } = await (supabase as any).from('trainers').select('id, user_id, name_en, name_ar, phone');
      const { data: profiles } = await (supabase as any).from('profiles').select('id, full_name, full_name_ar, phone');

      if (submissions.length === 0) return;

      const profilesMap = new Map();
      profiles?.forEach((p: any) => profilesMap.set(p.id, p));

      // Fetch all existing phones directly from the database to avoid branch filtering and closure issues
      // Use pagination to ensure we get all records beyond the 1000 limit
      let allExistingUsers: any[] = [];
      const userBatchSize = 1000;
      let hasMoreUsers = true;
      let userOffset = 0;

      while (hasMoreUsers) {
        const { data: batch, error: existError } = await (supabase as any)
          .from('users_followup')
          .select('id, phone_1, phone_2, full_name, status')
          .range(userOffset, userOffset + userBatchSize - 1);

        if (existError) throw existError;
        if (!batch || batch.length === 0) {
          hasMoreUsers = false;
        } else {
          allExistingUsers = [...allExistingUsers, ...batch];
          userOffset += userBatchSize;
          if (batch.length < userBatchSize) hasMoreUsers = false;
        }
      }

      // Build a set of ALL phones that already exist in any status (approved, pending, duplicate, rejected).
      // This is the critical fix: we must NOT re-insert a person who already exists in ANY form.
      const phoneToExistingUser = new Map<string, string>();
      const approvedPhones = new Set<string>();
      const pendingOrDuplicateToClean: any[] = [];

      allExistingUsers?.forEach((u: any) => {
        const p1 = normalizePhone(u.phone_1);
        const p2 = normalizePhone(u.phone_2);

        // Track ALL phones regardless of status so we never re-insert them
        if (p1) phoneToExistingUser.set(p1, u.full_name);
        if (p2) phoneToExistingUser.set(p2, u.full_name);

        if (u.status === 'approved') {
          if (p1) approvedPhones.add(p1);
          if (p2) approvedPhones.add(p2);
        } else if (u.status === 'pending' || u.status === 'duplicate') {
          // Collect pending & duplicate records so we can clean them up if they match an approved phone
          pendingOrDuplicateToClean.push(u);
        }
      });

      // Build map: normalized phone → approved user ID (for linked_to assignment)
      const approvedPhoneToId = new Map<string, number>();
      allExistingUsers?.forEach((u: any) => {
        if (u.status === 'approved') {
          const p1 = normalizePhone(u.phone_1);
          const p2 = normalizePhone(u.phone_2);
          if (p1) approvedPhoneToId.set(p1, u.id);
          if (p2) approvedPhoneToId.set(p2, u.id);
        }
      });

      // Cleanup: auto-reject pending/duplicate rows whose phone already exists as approved
      // Also set linked_to → approved record so their participations show under the right person
      const duplicatesToClear = pendingOrDuplicateToClean.filter(p => {
        const p1 = normalizePhone(p.phone_1);
        const p2 = normalizePhone(p.phone_2);
        return (p1 && approvedPhones.has(p1)) || (p2 && approvedPhones.has(p2));
      });

      if (duplicatesToClear.length > 0) {
        // Update each record individually to set its specific linked_to value
        await Promise.all(
          duplicatesToClear.map(d => {
            const p1 = normalizePhone(d.phone_1);
            const p2 = normalizePhone(d.phone_2);
            const linkedToId = (p1 && approvedPhoneToId.get(p1)) || (p2 && approvedPhoneToId.get(p2)) || null;
            return (supabase as any)
              .from('users_followup')
              .update({
                status: 'rejected',
                ...(linkedToId && !d.linked_to ? { linked_to: linkedToId } : {}),
              })
              .eq('id', d.id)
              .in('status', ['pending', 'duplicate']); // SAFETY: never touch approved
          })
        );
        console.log(`[Sync] Automatically cleaned up ${duplicatesToClear.length} duplicates/pending, linked them to approved records.`);
        toast.info(ar(`تم تنظيف ${duplicatesToClear.length} طلبات مكررة تلقائياً!`, `Automatically cleaned up ${duplicatesToClear.length} duplicate requests!`));
      }

      console.log(`[Sync] Fetched ${allExistingUsers.length} existing users. Map size: ${phoneToExistingUser.size}`);
      console.log(`[Sync] Fetched ${submissions.length} submissions.`);

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
        let foundBy: string | null = null;
        for (const p of cleanPhones) {
          if (phoneToExistingUser.has(p)) {
            found = true;
            foundBy = p;
            break;
          }
        }

        if (!found && cleanPhones.length > 0) {
          const primaryPhone = cleanPhones[0];
          phoneToExistingUser.set(primaryPhone, participantName);
          console.log(`[Sync] Found NEW participant: ${participantName} (${primaryPhone})`);

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

          // If still null, fallback to the currently active branch in the UI
          if (!resolvedBranchId && activeBranch?.id) {
            resolvedBranchId = activeBranch.id;
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

      // Always refresh after cleanup (even if 0 new inserts) so rejected duplicates disappear
      const needsRefresh = duplicatesToClear.length > 0;

      if (newUsersToInsert.length > 0) {
        // -----------------------------------------------------------------------
        // CRITICAL: Do a final DB-level check right before inserting.
        // The in-memory map can miss cases where branch_id is NULL because
        // PostgreSQL unique constraints treat NULL as distinct (NULL ≠ NULL),
        // so the upsert onConflict clause silently fails for null-branch rows.
        // Querying the DB directly is the only 100% reliable dedup mechanism.
        // -----------------------------------------------------------------------
        const phonesToCheck = [...new Set(
          newUsersToInsert.map(u => u.phone_1).filter(Boolean) as string[]
        )];

        // Chunk into groups of 100 to stay within Supabase's query limits
        const CHUNK = 100;
        const alreadyExistingPhones = new Set<string>();
        for (let i = 0; i < phonesToCheck.length; i += CHUNK) {
          const chunk = phonesToCheck.slice(i, i + CHUNK);
          const { data: existingRows } = await (supabase as any)
            .from('users_followup')
            .select('phone_1')
            .in('phone_1', chunk);
          (existingRows || []).forEach((r: any) => {
            if (r.phone_1) alreadyExistingPhones.add(r.phone_1);
          });
        }

        // Filter to only phones that truly don't exist in the DB at all
        const trulyNew = newUsersToInsert.filter(u => u.phone_1 && !alreadyExistingPhones.has(u.phone_1));

        console.log(`[Sync] Pre-check: ${newUsersToInsert.length} candidates → ${trulyNew.length} truly new (${newUsersToInsert.length - trulyNew.length} already in DB)`);

        if (trulyNew.length > 0) {
          const { error } = await (supabase as any).from('users_followup').insert(trulyNew);
          if (error) throw error;
          toast.success(ar(
            `تم العثور على ${trulyNew.length} مشارك جديد وإضافتهم لطلبات الإضافة!`,
            `Found and added ${trulyNew.length} new participants to pending!`
          ));
          await fetchUsers();
        } else if (needsRefresh) {
          await fetchUsers();
          toast.success(ar('تم تنظيف السجلات المكررة بنجاح!', 'Duplicate records cleaned up successfully!'));
        } else {
          toast.info(ar('البيانات محدثة بالفعل، لا يوجد مشاركين جدد.', 'Data is up to date, no new participants.'));
        }
      } else if (needsRefresh) {
        await fetchUsers();
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

    const normPhone1 = normalizePhoneE164(formPhone1);
    const normPhone2 = formPhone2.trim() ? normalizePhoneE164(formPhone2) : null;

    // Guard: phone_1 and phone_2 must not be the same number
    if (normPhone2 && phonesAreEqual(normPhone1, normPhone2)) {
      toast.error(ar(
        'الهاتف الأول والثاني هما نفس الرقم بعد التطبيع — يرجى إدخال رقمين مختلفين',
        'Phone 1 and Phone 2 are the same number after normalization — please enter two different numbers'
      ));
      return;
    }

    // Guard: no existing record in the SAME BRANCH should have the same phone_1 or phone_2
    // (same phone is allowed in different branches)
    if (normPhone1 && formBranch) {
      const { data: existing } = await (supabase as any)
        .from('users_followup')
        .select('id, full_name, phone_1, phone_2')
        .eq('branch_id', formBranch)
        .or(`phone_1.eq.${normPhone1},phone_2.eq.${normPhone1}${normPhone2 ? `,phone_1.eq.${normPhone2},phone_2.eq.${normPhone2}` : ''}`);

      if (existing && existing.length > 0) {
        const clash = existing[0];
        toast.error(ar(
          `رقم الهاتف موجود مسبقاً في نفس الفرع: "${clash.full_name}" (${clash.phone_1})`,
          `Phone number already exists in this branch: "${clash.full_name}" (${clash.phone_1})`
        ));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('users_followup')
        .insert({
          full_name: formName.trim(),
          phone_1: normPhone1 || formPhone1.trim(),
          phone_2: normPhone2,
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

    const normPhone1 = normalizePhoneE164(formPhone1);
    const normPhone2 = formPhone2.trim() ? normalizePhoneE164(formPhone2) : null;

    // Guard: phone_1 and phone_2 must not be the same number
    if (normPhone2 && phonesAreEqual(normPhone1, normPhone2)) {
      toast.error(ar(
        'الهاتف الأول والثاني هما نفس الرقم بعد التطبيع — يرجى إدخال رقمين مختلفين',
        'Phone 1 and Phone 2 are the same number after normalization — please enter two different numbers'
      ));
      return;
    }

    // Guard: no OTHER record in the SAME BRANCH should have the same phone_1 or phone_2
    // (same phone is allowed in different branches)
    const targetBranch = formBranch || selected.branch_id;
    if (normPhone1 && targetBranch) {
      const { data: existing } = await (supabase as any)
        .from('users_followup')
        .select('id, full_name, phone_1, phone_2')
        .eq('branch_id', targetBranch)
        .or(`phone_1.eq.${normPhone1},phone_2.eq.${normPhone1}${normPhone2 ? `,phone_1.eq.${normPhone2},phone_2.eq.${normPhone2}` : ''}`);

      const conflicts = (existing || []).filter((r: any) => r.id !== selected.id);
      if (conflicts.length > 0) {
        const clash = conflicts[0];
        toast.error(ar(
          `رقم الهاتف موجود مسبقاً في نفس الفرع: "${clash.full_name}" (${clash.phone_1})`,
          `Phone number already exists in this branch: "${clash.full_name}" (${clash.phone_1})`
        ));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('users_followup')
        .update({
          full_name: formName.trim(),
          phone_1: normPhone1 || formPhone1.trim(),
          phone_2: normPhone2,
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
      // Fetch the pending record to get its phone
      const { data: pendingRec, error: fetchErr } = await (supabase as any)
        .from('users_followup')
        .select('phone_1, branch_id')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      // Guard: check if an approved record with the same phone already exists
      if (pendingRec?.phone_1) {
        let dupQuery = (supabase as any)
          .from('users_followup')
          .select('id, full_name')
          .eq('status', 'approved')
          .eq('phone_1', pendingRec.phone_1)
          .neq('id', id)
          .limit(1);
        // Scope to same branch if present
        if (pendingRec.branch_id) {
          dupQuery = dupQuery.eq('branch_id', pendingRec.branch_id);
        }
        const { data: duplicates } = await dupQuery;
        if (duplicates && duplicates.length > 0) {
          const dup = duplicates[0];
          toast.error(ar(
            `لا يمكن القبول: الرقم ${pendingRec.phone_1} موجود بالفعل كمعتمد لـ "${dup.full_name}"`,
            `Cannot approve: phone ${pendingRec.phone_1} already approved for "${dup.full_name}"`
          ));
          setIsSubmitting(false);
          return;
        }
      }

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
      // 1. Mark the source record as rejected + linked_to target
      const { error: updateErr } = await (supabase as any)
        .from('users_followup')
        .update({
          status: 'rejected',
          linked_to: selectedLinkTarget.id,
        })
        .eq('id', linkSourceUser.id);
      if (updateErr) throw updateErr;

      // 2. Transfer participations: update activity_submissions where guest_phone matches
      //    source phone → change to target phone
      const sourcePhones = [linkSourceUser.phone_1, linkSourceUser.phone_2].filter(Boolean);
      const sourceVariants = new Set<string>();
      sourcePhones.forEach(p => {
        if (!p) return;
        const norm = normalizePhone(p);
        sourceVariants.add(norm);
        if (norm.startsWith('+')) sourceVariants.add(norm.slice(1));
        if (norm.startsWith('+20')) sourceVariants.add('0' + norm.slice(3));
      });

      if (sourceVariants.size > 0) {
        const targetPhone = selectedLinkTarget.phone_1;
        // Find submissions with source phone
        const orFilter = [...sourceVariants].map(v => `guest_phone.eq.${v}`).join(',');
        const { data: submissions } = await (supabase as any)
          .from('activity_submissions')
          .select('id')
          .or(orFilter);

        if (submissions && submissions.length > 0) {
          const ids = submissions.map((s: any) => s.id);
          // Update in batches
          const BATCH = 100;
          for (let i = 0; i < ids.length; i += BATCH) {
            const chunk = ids.slice(i, i + BATCH);
            await (supabase as any)
              .from('activity_submissions')
              .update({ guest_phone: targetPhone })
              .in('id', chunk);
          }
          toast.info(ar(
            `تم نقل ${submissions.length} مشاركة إلى "${selectedLinkTarget.full_name}"`,
            `Transferred ${submissions.length} participations to "${selectedLinkTarget.full_name}"`
          ));
        }
      }

      toast.success(ar(
        `تم ربط "${linkSourceUser.full_name}" بـ "${selectedLinkTarget.full_name}" بنجاح`,
        `Linked "${linkSourceUser.full_name}" to "${selectedLinkTarget.full_name}" successfully`
      ));
      setIsLinkDialogOpen(false);
      setLinkSourceUser(null);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || ar('فشل في الربط', 'Failed to link'));
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
        .update({ status: 'rejected' })
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
          // Keep ALL records — do NOT drop duplicates.
          // For records sharing the same phone_1, auto-set _linkedToRow so that
          // the 2nd, 3rd, etc. occurrences point to the first via linked_to.
          const phoneToFirstIdx = new Map<string, number>(); // phone → 0-based index of first occurrence
          for (let i = 0; i < newRecords.length; i++) {
            const rec = newRecords[i];
            const phone = rec.phone_1;
            if (phoneToFirstIdx.has(phone)) {
              // Duplicate — link to first occurrence (1-based row index)
              if (!rec._linkedToRow) {
                rec._linkedToRow = phoneToFirstIdx.get(phone)! + 1;
              }
            } else {
              phoneToFirstIdx.set(phone, i);
            }
          }

          // All records go straight to confirmation (no conflict dialog needed)
          setPendingImportRecords(newRecords);
          setIsImportConfirmOpen(true);
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
      const targetBranchId = activeBranch?.id || null;

      if (!targetBranchId) {
        toast.error(ar(
          'يجب اختيار فرع محدد قبل استبدال الشيت. اختر فرع من فلتر الفروع أولاً.',
          'You must select a specific branch before replacing the sheet. Choose a branch from the filter first.'
        ));
        setIsSubmitting(false);
        return;
      }

      // 1. Soft-delete existing approved users FOR THIS BRANCH AND ANY ORPHANED NULL BRANCHES
      const { error: deleteError } = await (supabase as any)
        .from('users_followup')
        .update({ status: 'rejected' })
        .eq('status', 'approved')
        .or(`branch_id.eq.${targetBranchId},branch_id.is.null`);

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
    </div>
  );
}
