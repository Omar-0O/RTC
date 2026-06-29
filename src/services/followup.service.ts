/**
 * Follow-up service — all users_followup Supabase calls.
 *
 * Pure service: no React, no hooks, no toast.
 *
 * SINGLE SOURCE OF TRUTH for all follow-up business logic.
 * The component layer (FollowUpManagement.tsx) must NOT contain
 * any direct Supabase calls — everything goes through here.
 */
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneE164, phonesAreEqual } from '@/utils/phoneUtils';
import type { Branch } from '@/contexts/BranchContext';
import type { Database } from '@/integrations/supabase/types';

// ─── Types ──────────────────────────────────────────────────────────

export interface FollowUpUser {
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

export interface FetchFollowUpOptions {
  branchId?: string;
  canViewAllBranches: boolean;
}

export interface AddFollowUpPayload {
  fullName: string;
  phone1: string;
  phone2: string | null;
  branchId: string | null;
}

export interface EditFollowUpPayload {
  id: number;
  fullName: string;
  phone1: string;
  phone2: string | null;
  branchId: string | null;
  /** Previous values for change detection */
  previousPhone1?: string;
  previousPhone2?: string | null;
  previousBranchId?: string | null;
}

export interface SyncFollowUpOptions {
  canViewAllBranches: boolean;
  branchId?: string;
  branches: Branch[];
}

export interface LinkFollowUpPayload {
  sourceUser: FollowUpUser;
  targetUser: FollowUpUser;
}

export type FollowUpConflictMatch = Pick<FollowUpUser, 'id' | 'full_name' | 'phone_1' | 'status' | 'branch_id'>;

export interface ImportReplaceOptions {
  targetBranchId: string;
  records: ImportFollowUpRecord[];
}

export interface SyncResult {
  newCount: number;
  cleanedCount: number;
}

export interface ParticipationItem {
  id: string;
  date: string | null;
  submitted_at: string | null;
  created_at: string;
  activity_types: { name: string; name_ar: string } | null;
}

type UsersFollowUpInsert = Database['public']['Tables']['users_followup']['Insert'];
type UsersFollowUpUpdate = Database['public']['Tables']['users_followup']['Update'];
type ActivitySubmissionUpdate = Database['public']['Tables']['activity_submissions']['Update'];

interface FollowUpPhoneRow {
  id: number;
  full_name: string;
  phone_1: string;
  phone_2?: string | null;
  branch_id?: string | null;
  status?: string;
  linked_to?: number | null;
}

interface FollowUpImportRow {
  id: number;
  phone_1: string;
  phone_2: string | null;
  full_name: string;
  status: string;
  linked_to: number | null;
}

interface AliasPhoneRow {
  phone_1: string | null;
  phone_2: string | null;
}

interface SubmissionIdRow {
  id: string;
}

interface ProfilePhoneRow {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  phone: string | null;
}

interface TrainerPhoneRow {
  id: string;
  user_id: string | null;
  name_en: string;
  name_ar: string;
  phone: string | null;
}

interface FollowUpSourceSubmission {
  id: string;
  guest_name: string | null;
  guest_phone: string | null;
  volunteer_id: string | null;
  trainer_id: string | null;
  branch_id: string | null;
  location: string | null;
}

export type ImportFollowUpRecord = UsersFollowUpInsert & {
  _linkedToRow?: unknown;
  _mappedToExistingId?: number;
};

type PaginatedQuery<T> = PromiseLike<{
  data: T[] | null;
  error: unknown;
}>;

type BranchScopedQuery<T> = PaginatedQuery<T> & {
  eq(column: string, value: unknown): BranchScopedQuery<T>;
  or(filter: string): BranchScopedQuery<T>;
};

// ─── Internal helpers ───────────────────────────────────────────────

const normalizePhone = (raw: string | null | undefined): string =>
  normalizePhoneE164(raw);

/** Paginated fetch helper — fetches all rows from a table in batches. */
async function fetchAllPaginated<T>(
  buildQuery: (from: number, to: number) => PaginatedQuery<T>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!batch || batch.length === 0) {
      hasMore = false;
    } else {
      allData.push(...batch);
      offset += PAGE_SIZE;
      if (batch.length < PAGE_SIZE) hasMore = false;
    }
  }
  return allData;
}

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Fetch follow-up users (approved + pending).
 *
 * SECURITY FIX: Both approved AND pending records are now branch-scoped.
 * Previously pending records were fetched without branch filter, leaking
 * cross-branch data to branch_admin users.
 */
export async function getFollowUpUsers(opts: FetchFollowUpOptions): Promise<FollowUpUser[]> {
  const buildBranchQuery = (q: BranchScopedQuery<FollowUpUser>) => {
    if (opts.branchId) {
      if (opts.canViewAllBranches) {
        // Admin viewing a specific branch: show that branch + orphaned NULL records
        return q.or(`branch_id.eq.${opts.branchId},branch_id.is.null`);
      } else {
        // Branch user: only their own branch
        return q.eq('branch_id', opts.branchId);
      }
    }
    // No branch selected (admin viewing all) — no filter
    return q;
  };

  // Fetch approved records — always branch-scoped
  const approved = await fetchAllPaginated<FollowUpUser>((from, to) => {
    const q = supabase
      .from('users_followup')
      .select('*')
      .eq('status', 'approved')
      .order('id', { ascending: true })
      .range(from, to) as unknown as BranchScopedQuery<FollowUpUser>;
    return buildBranchQuery(q);
  });

  // Fetch pending records — ALSO branch-scoped (BUG #2 fix)
  const pending = await fetchAllPaginated<FollowUpUser>((from, to) => {
    const q = supabase
      .from('users_followup')
      .select('*')
      .eq('status', 'pending')
      .order('id', { ascending: true })
      .range(from, to) as unknown as BranchScopedQuery<FollowUpUser>;
    return buildBranchQuery(q);
  });

  return [...approved, ...pending];
}

// ─── Mutations ──────────────────────────────────────────────────────

export async function addFollowUp(payload: AddFollowUpPayload): Promise<void> {
  const normPhone1 = normalizePhoneE164(payload.phone1);
  const normPhone2 = payload.phone2 ? normalizePhoneE164(payload.phone2) : null;

  if (normPhone2 && phonesAreEqual(normPhone1, normPhone2)) {
    throw new Error('Phone 1 and Phone 2 are the same number');
  }

  if (normPhone1 && payload.branchId) {
    const { data: existing } = await supabase
      .from('users_followup')
      .select('id, full_name, phone_1')
      .eq('branch_id', payload.branchId)
      .or(`phone_1.eq.${normPhone1},phone_2.eq.${normPhone1}${normPhone2 ? `,phone_1.eq.${normPhone2},phone_2.eq.${normPhone2}` : ''}`);

    if (existing && existing.length > 0) {
      throw new Error(`Phone already exists in this branch: "${existing[0].full_name}"`);
    }
  }

  const row: UsersFollowUpInsert = {
    full_name: payload.fullName.trim(),
    phone_1: normPhone1 || payload.phone1.trim(),
    phone_2: normPhone2,
    branch_id: payload.branchId || null,
    status: 'approved',
  };

  const { error } = await supabase.from('users_followup').insert(row);
  if (error) throw error;
}

export async function editFollowUp(payload: EditFollowUpPayload): Promise<void> {
  const normPhone1 = normalizePhoneE164(payload.phone1);
  const normPhone2 = payload.phone2 ? normalizePhoneE164(payload.phone2) : null;

  if (normPhone2 && phonesAreEqual(normPhone1, normPhone2)) {
    throw new Error('Phone 1 and Phone 2 are the same number');
  }

  // Only check for duplicates if phone or branch actually changed
  const isPhoneChanged =
    payload.phone1.trim() !== (payload.previousPhone1 || '').trim() ||
    (payload.phone2 || '').trim() !== (payload.previousPhone2 || '').trim();
  const isBranchChanged = (payload.branchId || '') !== (payload.previousBranchId || '');

  const targetBranch = payload.branchId;

  if ((isPhoneChanged || isBranchChanged) && normPhone1 && targetBranch) {
    const { data: existing } = await supabase
      .from('users_followup')
      .select('id, full_name, phone_1')
      .eq('branch_id', targetBranch)
      .or(`phone_1.eq.${normPhone1},phone_2.eq.${normPhone1}${normPhone2 ? `,phone_1.eq.${normPhone2},phone_2.eq.${normPhone2}` : ''}`);

    const conflicts = (existing || []).filter((r: FollowUpPhoneRow) => r.id !== payload.id);
    if (conflicts.length > 0) {
      throw new Error(`Phone already exists: "${conflicts[0].full_name}"`);
    }
  }

  const changes: UsersFollowUpUpdate = {
    full_name: payload.fullName.trim(),
    phone_1: normPhone1 || payload.phone1.trim(),
    phone_2: normPhone2,
    branch_id: payload.branchId || null,
  };

  const { error } = await supabase.from('users_followup').update(changes).eq('id', payload.id);
  if (error) throw error;
}

export async function approveFollowUp(id: number): Promise<void> {
  const { data: pendingRec, error: fetchErr } = await supabase
    .from('users_followup')
    .select('phone_1, branch_id')
    .eq('id', id)
    .single();

  if (fetchErr) throw fetchErr;

  if (pendingRec?.phone_1) {
    let dupQuery = supabase
      .from('users_followup')
      .select('id, full_name')
      .eq('status', 'approved')
      .eq('phone_1', pendingRec.phone_1)
      .neq('id', id)
      .limit(1);

    if (pendingRec.branch_id) dupQuery = dupQuery.eq('branch_id', pendingRec.branch_id);

    const { data: duplicates } = await dupQuery;
    if (duplicates && duplicates.length > 0) {
      throw new Error(`Phone ${pendingRec.phone_1} already approved for "${duplicates[0].full_name}"`);
    }
  }

  const { error } = await supabase.from('users_followup').update({ status: 'approved' }).eq('id', id);
  if (error) throw error;
}

export async function rejectFollowUp(id: number): Promise<void> {
  const { error } = await supabase.from('users_followup').update({ status: 'rejected' }).eq('id', id);
  if (error) throw error;
}

export async function findFollowUpConflicts(
  phones: string[],
  branchId?: string,
): Promise<FollowUpConflictMatch[]> {
  if (phones.length === 0) return [];

  let query = supabase
    .from('users_followup')
    .select('id, full_name, phone_1, status, branch_id')
    .in('phone_1', phones);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as FollowUpConflictMatch[]).filter((user) => user.status !== 'rejected');
}

// ─── Link to Another ───────────────────────────────────────────────

/**
 * Link a source user to a target user:
 * 1. Mark source as rejected + linked_to target
 * 2. Transfer participations (update guest_phone in activity_submissions)
 */
export async function linkToAnother(payload: LinkFollowUpPayload): Promise<number> {
  const { sourceUser, targetUser } = payload;

  // 1. Mark source as rejected + linked
  const sourceUpdate: UsersFollowUpUpdate = {
    status: 'rejected',
    linked_to: targetUser.id,
  };

  const { error: updateErr } = await supabase
    .from('users_followup')
    .update(sourceUpdate)
    .eq('id', sourceUser.id);
  if (updateErr) throw updateErr;

  // 2. Transfer participations
  const sourcePhones = [sourceUser.phone_1, sourceUser.phone_2].filter(Boolean);
  const sourceVariants = new Set<string>();
  sourcePhones.forEach(p => {
    if (!p) return;
    const norm = normalizePhone(p);
    sourceVariants.add(norm);
    if (norm.startsWith('+')) sourceVariants.add(norm.slice(1));
    if (norm.startsWith('+20')) sourceVariants.add('0' + norm.slice(3));
  });

  let transferredCount = 0;

  if (sourceVariants.size > 0) {
    const targetPhone = targetUser.phone_1;
    const orFilter = [...sourceVariants].map(v => `guest_phone.eq.${v}`).join(',');
    const { data: submissions } = await supabase
      .from('activity_submissions')
      .select('id')
      .or(orFilter);

    if (submissions && submissions.length > 0) {
      const ids = (submissions as SubmissionIdRow[]).map((s) => s.id);
      const BATCH = 100;
      const transferUpdate: ActivitySubmissionUpdate = { guest_phone: targetPhone };
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        await supabase
          .from('activity_submissions')
          .update(transferUpdate)
          .in('id', chunk);
      }
      transferredCount = submissions.length;
    }
  }

  return transferredCount;
}

// ─── Participations ─────────────────────────────────────────────────

/**
 * Get participations for a follow-up user by matching their phone numbers
 * against activity_submissions.guest_phone and profiles.phone.
 */
export async function getParticipations(user: FollowUpUser): Promise<ParticipationItem[]> {
  // Collect own phones
  const ownPhones = [user.phone_1, user.phone_2].filter(Boolean).map(p => normalizePhone(p!));

  // Also collect phones from alias entries (users whose linked_to = this user's id)
  const { data: aliasEntries } = await supabase
    .from('users_followup')
    .select('phone_1, phone_2')
    .eq('linked_to', user.id);

  const aliasPhones: string[] = [];
  if (aliasEntries) {
    (aliasEntries as AliasPhoneRow[]).forEach((a) => {
      if (a.phone_1) aliasPhones.push(normalizePhone(a.phone_1));
      if (a.phone_2) aliasPhones.push(normalizePhone(a.phone_2));
    });
  }

  const phones = [...new Set([...ownPhones, ...aliasPhones])].filter(Boolean);
  if (phones.length === 0) return [];

  // Generate search variants for each phone
  const variants = new Set<string>();
  phones.forEach(p => {
    variants.add(p);
    if (p.startsWith('+')) variants.add(p.slice(1));
    if (p.startsWith('+20')) variants.add('0' + p.slice(3));
    if (p.startsWith('201')) variants.add('0' + p.slice(2));
  });

  // Fetch guest_phone submissions
  const orFilter = [...variants].map(v => `guest_phone.eq.${v}`).join(',');
  const { data: guestSubmissions } = await supabase
    .from('activity_submissions')
    .select('id, date, submitted_at, created_at, activity_types(name, name_ar)')
    .or(orFilter)
    .order('date', { ascending: false, nullsLast: true })
    .limit(200);

  const items: ParticipationItem[] = (guestSubmissions || []) as unknown as ParticipationItem[];

  // Check if this person has a volunteer profile
  const profileVariants = new Set<string>();
  phones.forEach(p => {
    profileVariants.add(p);
    if (p.startsWith('+')) profileVariants.add(p.slice(1));
    if (p.startsWith('+20')) profileVariants.add('0' + p.slice(3));
  });

  const { data: profileRes } = await supabase
    .from('profiles')
    .select('id')
    .in('phone', [...profileVariants])
    .limit(1);

  // If profile found, also get their volunteer_id submissions
  if (profileRes && profileRes.length > 0) {
    const volunteerId = profileRes[0].id;
    const { data: volunteerSubmissions } = await supabase
      .from('activity_submissions')
      .select('id, date, submitted_at, created_at, activity_types(name, name_ar)')
      .eq('volunteer_id', volunteerId)
      .order('date', { ascending: false, nullsLast: true })
      .limit(100);
    if (volunteerSubmissions) {
      const existingIds = new Set(items.map((i) => i.id));
      (volunteerSubmissions as unknown as ParticipationItem[]).forEach((s) => {
        if (!existingIds.has(s.id)) items.push(s);
      });
    }
  }

  // Sort by date (most recent first)
  items.sort((a, b) => {
    const dateA = new Date(a.date || a.submitted_at || a.created_at).getTime();
    const dateB = new Date(b.date || b.submitted_at || b.created_at).getTime();
    return dateB - dateA;
  });

  return items;
}

// ─── Sync ───────────────────────────────────────────────────────────

export async function syncFollowUp(opts: SyncFollowUpOptions): Promise<SyncResult> {
  // Fetch submissions
  const submissions = await fetchAllPaginated<FollowUpSourceSubmission>((from, to) => {
    let q = supabase
      .from('activity_submissions')
      .select('id, guest_name, guest_phone, volunteer_id, trainer_id, branch_id, location')
      .range(from, to) as unknown as BranchScopedQuery<FollowUpSourceSubmission>;
    if (opts.branchId) {
      q = q.eq('branch_id', opts.branchId);
    }
    return q;
  });

  const { data: trainers } = await supabase.from('trainers').select('id, user_id, name_en, name_ar, phone');
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, full_name_ar, phone');
  if (submissions.length === 0) return { newCount: 0, cleanedCount: 0 };

  const trainerRows = (trainers || []) as TrainerPhoneRow[];
  const profilesMap = new Map<string, ProfilePhoneRow>();
  (profiles || []).forEach((p) => profilesMap.set(p.id, p as ProfilePhoneRow));

  // Fetch ALL existing follow-up users (across all branches for dedup)
  const allExisting = await fetchAllPaginated<FollowUpImportRow>((from, to) =>
    supabase
      .from('users_followup')
      .select('id, phone_1, phone_2, full_name, status, linked_to')
      .range(from, to) as unknown as PaginatedQuery<FollowUpImportRow>
  );

  // Build phone maps
  const phoneToUser = new Map<string, string>();
  const approvedPhones = new Set<string>();
  const pendingToClean: FollowUpImportRow[] = [];
  const approvedPhoneToId = new Map<string, number>();

  allExisting.forEach((u) => {
    const p1 = normalizePhone(u.phone_1);
    const p2 = normalizePhone(u.phone_2);
    if (p1) phoneToUser.set(p1, u.full_name);
    if (p2) phoneToUser.set(p2, u.full_name);
    if (u.status === 'approved') {
      if (p1) { approvedPhones.add(p1); approvedPhoneToId.set(p1, u.id); }
      if (p2) { approvedPhones.add(p2); approvedPhoneToId.set(p2, u.id); }
    } else if (u.status === 'pending' || u.status === 'duplicate') {
      pendingToClean.push(u);
    }
  });

  // Auto-reject pending/duplicate whose phone already approved
  const dupsToClean = pendingToClean.filter(p => {
    const p1 = normalizePhone(p.phone_1);
    const p2 = normalizePhone(p.phone_2);
    return (p1 && approvedPhones.has(p1)) || (p2 && approvedPhones.has(p2));
  });

  if (dupsToClean.length > 0) {
    await Promise.all(dupsToClean.map(d => {
      const p1 = normalizePhone(d.phone_1);
      const p2 = normalizePhone(d.phone_2);
      const linkedToId = (p1 && approvedPhoneToId.get(p1)) || (p2 && approvedPhoneToId.get(p2)) || null;
      const update: UsersFollowUpUpdate = {
        status: 'rejected',
        ...(linkedToId && !d.linked_to ? { linked_to: linkedToId } : {}),
      };
      return supabase.from('users_followup').update(update).eq('id', d.id).in('status', ['pending', 'duplicate']);
    }));
  }

  // Find new participants from submissions
  const newToInsert: UsersFollowUpInsert[] = [];
  submissions.forEach((s) => {
    let name = '';
    const phones: string[] = [];
    if (s.guest_name || s.guest_phone) { name = s.guest_name || ''; if (s.guest_phone) phones.push(s.guest_phone); }
    if (s.volunteer_id) {
      const p = profilesMap.get(s.volunteer_id);
      if (p) { if (!name) name = p.full_name_ar || p.full_name || ''; if (p.phone) phones.push(p.phone); }
    }
    if (s.trainer_id) {
      const tr = trainerRows.find((t) => t.id === s.trainer_id);
      if (tr) { if (!name) name = tr.name_ar || tr.name_en; if (tr.phone) phones.push(tr.phone); }
    } else if (s.volunteer_id) {
      const tr = trainerRows.find((t) => t.user_id === s.volunteer_id);
      if (tr) { if (!name) name = tr.name_ar || tr.name_en; if (tr.phone) phones.push(tr.phone); }
    }
    if (!name) name = 'Unknown';
    const clean = phones.map(p => normalizePhone(p)).filter(p => p.length > 0);

    if (clean.length > 0 && !clean.some(p => phoneToUser.has(p))) {
      const primary = clean[0];
      phoneToUser.set(primary, name);
      let branchId: string | null = s.branch_id || null;
      if (!branchId && s.location) {
        const loc = String(s.location).toLowerCase().trim();
        const match = opts.branches.find(b =>
          (b.code && b.code.toLowerCase() === loc) ||
          b.name.toLowerCase() === loc ||
          b.name_ar === s.location
        );
        if (match) branchId = match.id;
      }
      if (!branchId && opts.branchId) branchId = opts.branchId;
      newToInsert.push({
        full_name: name,
        phone_1: primary,
        phone_2: clean[1] || null,
        branch_id: branchId,
        status: 'pending',
      });
    }
  });

  // Final DB-level dedup check before inserting
  let insertedCount = 0;
  if (newToInsert.length > 0) {
    const phonesToCheck = [...new Set(newToInsert.map(u => u.phone_1).filter(Boolean))];
    const existing = new Set<string>();
    const CHUNK = 100;
    for (let i = 0; i < phonesToCheck.length; i += CHUNK) {
      const chunk = phonesToCheck.slice(i, i + CHUNK);
      const { data: rows } = await supabase.from('users_followup').select('phone_1').in('phone_1', chunk);
      (rows || []).forEach((r: Pick<FollowUpPhoneRow, 'phone_1'>) => { if (r.phone_1) existing.add(r.phone_1); });
    }
    const trulyNew = newToInsert.filter(u => u.phone_1 && !existing.has(u.phone_1));
    if (trulyNew.length > 0) {
      const { error } = await supabase.from('users_followup').insert(trulyNew);
      if (error) throw error;
      insertedCount = trulyNew.length;
    }
  }

  return { newCount: insertedCount, cleanedCount: dupsToClean.length };
}

// ─── Import Replace ─────────────────────────────────────────────────

/**
 * Replace the follow-up sheet for a specific branch.
 *
 * BUG #3 FIX: Only soft-deletes records matching the target branch.
 * Previously also deleted all NULL-branch records which could belong to other branches.
 */
export async function importReplace(opts: ImportReplaceOptions): Promise<{
  approvedCount: number;
  updatedCount: number;
  duplicateCount: number;
}> {
  const { targetBranchId, records } = opts;

  // 1. Soft-delete existing approved users FOR THIS BRANCH ONLY
  const rejectApproved: UsersFollowUpUpdate = { status: 'rejected' };
  const { error: deleteError } = await supabase
    .from('users_followup')
    .update(rejectApproved)
    .eq('status', 'approved')
    .eq('branch_id', targetBranchId);
  if (deleteError) throw deleteError;

  // 2. Separate mapped (update existing) vs new (insert) records
  const recordsToUpdate = records.filter((r) => r._mappedToExistingId);
  const cleanRecords = records
    .filter((r) => !r._mappedToExistingId)
    .map(({ _linkedToRow, _mappedToExistingId, ...rest }) => rest);

  // 3. Update mapped existing records
  if (recordsToUpdate.length > 0) {
    const approveMapped: UsersFollowUpUpdate = {
      status: 'approved',
      branch_id: targetBranchId,
    };
    await Promise.all(recordsToUpdate.map((r) =>
      supabase
        .from('users_followup')
        .update(approveMapped)
        .eq('id', r._mappedToExistingId)
    ));
  }

  // 4. Insert new records in batches
  const BATCH = 100;
  for (let i = 0; i < cleanRecords.length; i += BATCH) {
    const batch = cleanRecords.slice(i, i + BATCH);
    const { error: insertError } = await supabase
      .from('users_followup')
      .insert(batch);
    if (insertError) throw insertError;
  }

  const duplicateCount = cleanRecords.filter((r) => r.status === 'pending').length;
  const approvedCount = cleanRecords.length - duplicateCount;
  const updatedCount = recordsToUpdate.length;

  return { approvedCount, updatedCount, duplicateCount };
}
