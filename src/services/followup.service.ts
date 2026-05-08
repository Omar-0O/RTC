/**
 * Follow-up service — all users_followup Supabase calls.
 *
 * Pure service: no React, no hooks, no toast.
 */
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneE164, phonesAreEqual } from '@/utils/phoneUtils';
import type { Branch } from '@/contexts/BranchContext';

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
}

export interface SyncFollowUpOptions {
  canViewAllBranches: boolean;
  branchId?: string;
  branches: Branch[];
}

// ─── Queries ────────────────────────────────────────────────────────

export async function getFollowUpUsers(opts: FetchFollowUpOptions): Promise<FollowUpUser[]> {
  const statusFilter = ['approved', 'pending'];
  const pageSize = 1000;

  let countQuery = (supabase as any)
    .from('users_followup')
    .select('*', { count: 'exact', head: true })
    .in('status', statusFilter);

  if (!opts.canViewAllBranches && opts.branchId) {
    countQuery = countQuery.eq('branch_id', opts.branchId);
  }

  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  const total = count ?? 0;
  if (total === 0) return [];

  // Parallel page fetches
  const pages: Promise<any>[] = [];
  for (let from = 0; from < total; from += pageSize) {
    const to = Math.min(from + pageSize - 1, total - 1);
    let q = (supabase as any)
      .from('users_followup')
      .select('*')
      .in('status', statusFilter)
      .order('id', { ascending: true })
      .range(from, to);

    if (!opts.canViewAllBranches && opts.branchId) {
      q = q.eq('branch_id', opts.branchId);
    }
    pages.push(q);
  }

  const results = await Promise.all(pages);
  let allData: FollowUpUser[] = [];
  for (const res of results) {
    if (res.error) throw res.error;
    if (res.data) allData = allData.concat(res.data);
  }
  return allData;
}

// ─── Mutations ──────────────────────────────────────────────────────

export async function addFollowUp(payload: AddFollowUpPayload): Promise<void> {
  const normPhone1 = normalizePhoneE164(payload.phone1);
  const normPhone2 = payload.phone2 ? normalizePhoneE164(payload.phone2) : null;

  if (normPhone2 && phonesAreEqual(normPhone1, normPhone2)) {
    throw new Error('Phone 1 and Phone 2 are the same number');
  }

  if (normPhone1 && payload.branchId) {
    const { data: existing } = await (supabase as any)
      .from('users_followup')
      .select('id, full_name, phone_1')
      .eq('branch_id', payload.branchId)
      .or(`phone_1.eq.${normPhone1},phone_2.eq.${normPhone1}${normPhone2 ? `,phone_1.eq.${normPhone2},phone_2.eq.${normPhone2}` : ''}`);

    if (existing && existing.length > 0) {
      throw new Error(`Phone already exists in this branch: "${existing[0].full_name}"`);
    }
  }

  const { error } = await (supabase as any).from('users_followup').insert({
    full_name: payload.fullName.trim(),
    phone_1: normPhone1 || payload.phone1.trim(),
    phone_2: normPhone2,
    branch_id: payload.branchId || null,
    status: 'approved',
  });
  if (error) throw error;
}

export async function editFollowUp(payload: EditFollowUpPayload): Promise<void> {
  const normPhone1 = normalizePhoneE164(payload.phone1);
  const normPhone2 = payload.phone2 ? normalizePhoneE164(payload.phone2) : null;

  if (normPhone2 && phonesAreEqual(normPhone1, normPhone2)) {
    throw new Error('Phone 1 and Phone 2 are the same number');
  }

  if (normPhone1 && payload.branchId) {
    const { data: existing } = await (supabase as any)
      .from('users_followup')
      .select('id, full_name, phone_1')
      .eq('branch_id', payload.branchId)
      .or(`phone_1.eq.${normPhone1},phone_2.eq.${normPhone1}${normPhone2 ? `,phone_1.eq.${normPhone2},phone_2.eq.${normPhone2}` : ''}`);

    const conflicts = (existing || []).filter((r: any) => r.id !== payload.id);
    if (conflicts.length > 0) {
      throw new Error(`Phone already exists: "${conflicts[0].full_name}"`);
    }
  }

  const { error } = await (supabase as any).from('users_followup').update({
    full_name: payload.fullName.trim(),
    phone_1: normPhone1 || payload.phone1.trim(),
    phone_2: normPhone2,
    branch_id: payload.branchId || null,
  }).eq('id', payload.id);
  if (error) throw error;
}

export async function approveFollowUp(id: number): Promise<void> {
  const { data: pendingRec, error: fetchErr } = await (supabase as any)
    .from('users_followup')
    .select('phone_1, branch_id')
    .eq('id', id)
    .single();

  if (fetchErr) throw fetchErr;

  if (pendingRec?.phone_1) {
    let dupQuery = (supabase as any)
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

  const { error } = await (supabase as any).from('users_followup').update({ status: 'approved' }).eq('id', id);
  if (error) throw error;
}

export async function rejectFollowUp(id: number): Promise<void> {
  const { error } = await (supabase as any).from('users_followup').update({ status: 'rejected' }).eq('id', id);
  if (error) throw error;
}

export async function syncFollowUp(opts: SyncFollowUpOptions): Promise<{ newCount: number; cleanedCount: number }> {
  const normalizePhone = (raw: string | null | undefined): string => normalizePhoneE164(raw);
  const batchSize = 1000;

  // Fetch submissions
  let submissions: any[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    let q = (supabase as any).from('activity_submissions')
      .select('id, guest_name, guest_phone, volunteer_id, trainer_id, branch_id, location')
      .range(offset, offset + batchSize - 1);
    if (!opts.canViewAllBranches && opts.branchId) q = q.eq('branch_id', opts.branchId);
    const { data: batch, error } = await q;
    if (error) throw error;
    if (!batch || batch.length === 0) { hasMore = false; } else {
      submissions = [...submissions, ...batch];
      offset += batchSize;
      if (batch.length < batchSize) hasMore = false;
    }
  }

  const { data: trainers } = await (supabase as any).from('trainers').select('id, user_id, name_en, name_ar, phone');
  const { data: profiles } = await (supabase as any).from('profiles').select('id, full_name, full_name_ar, phone');
  if (submissions.length === 0) return { newCount: 0, cleanedCount: 0 };

  const profilesMap = new Map();
  profiles?.forEach((p: any) => profilesMap.set(p.id, p));

  // Existing users
  let allExisting: any[] = [];
  let userOffset = 0;
  let moreUsers = true;
  while (moreUsers) {
    const { data: batch, error } = await (supabase as any).from('users_followup')
      .select('id, phone_1, phone_2, full_name, status').range(userOffset, userOffset + batchSize - 1);
    if (error) throw error;
    if (!batch || batch.length === 0) { moreUsers = false; } else {
      allExisting = [...allExisting, ...batch];
      userOffset += batchSize;
      if (batch.length < batchSize) moreUsers = false;
    }
  }

  const phoneToUser = new Map<string, string>();
  const approvedPhones = new Set<string>();
  const pendingToClean: any[] = [];
  const approvedPhoneToId = new Map<string, number>();

  allExisting.forEach((u: any) => {
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
      return (supabase as any).from('users_followup').update({
        status: 'rejected', ...(linkedToId && !d.linked_to ? { linked_to: linkedToId } : {}),
      }).eq('id', d.id).in('status', ['pending', 'duplicate']);
    }));
  }

  // Find new participants
  const newToInsert: any[] = [];
  submissions.forEach((s: any) => {
    let name = '';
    const phones: string[] = [];
    if (s.guest_name || s.guest_phone) { name = s.guest_name || ''; if (s.guest_phone) phones.push(s.guest_phone); }
    if (s.volunteer_id) {
      const p = profilesMap.get(s.volunteer_id);
      if (p) { if (!name) name = p.full_name_ar || p.full_name || ''; if (p.phone) phones.push(p.phone); }
    }
    if (s.trainer_id) {
      const tr = trainers?.find((t: any) => t.id === s.trainer_id);
      if (tr) { if (!name) name = tr.name_ar || tr.name_en; if (tr.phone) phones.push(tr.phone); }
    } else if (s.volunteer_id) {
      const tr = trainers?.find((t: any) => t.user_id === s.volunteer_id);
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
        const match = opts.branches.find(b => (b.code && b.code.toLowerCase() === loc) || b.name.toLowerCase() === loc || b.name_ar === s.location);
        if (match) branchId = match.id;
      }
      if (!branchId && !opts.canViewAllBranches && opts.branchId) branchId = opts.branchId;
      newToInsert.push({ full_name: name, phone_1: primary, phone_2: clean[1] || null, branch_id: branchId, status: 'pending' });
    }
  });

  let insertedCount = 0;
  if (newToInsert.length > 0) {
    const phonesToCheck = [...new Set(newToInsert.map(u => u.phone_1).filter(Boolean))];
    const existing = new Set<string>();
    const CHUNK = 100;
    for (let i = 0; i < phonesToCheck.length; i += CHUNK) {
      const chunk = phonesToCheck.slice(i, i + CHUNK);
      const { data: rows } = await (supabase as any).from('users_followup').select('phone_1').in('phone_1', chunk);
      (rows || []).forEach((r: any) => { if (r.phone_1) existing.add(r.phone_1); });
    }
    const trulyNew = newToInsert.filter(u => u.phone_1 && !existing.has(u.phone_1));
    if (trulyNew.length > 0) {
      const { error } = await (supabase as any).from('users_followup').insert(trulyNew);
      if (error) throw error;
      insertedCount = trulyNew.length;
    }
  }

  return { newCount: insertedCount, cleanedCount: dupsToClean.length };
}
