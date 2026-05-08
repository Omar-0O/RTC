/**
 * Users service — all user/profile Supabase calls.
 *
 * Clean separation: no React, no hooks, no toast — just data I/O.
 * Hooks call these functions; services throw ApiError on failure.
 */
import { supabase } from '@/integrations/supabase/client';
import { unwrap } from './api';
import type { UserRole } from '@/types';
import type { Branch } from '@/contexts/BranchContext';

// ─── Types ──────────────────────────────────────────────────────────

export interface UserWithDetails {
  id: string;
  email: string;
  full_name: string | null;
  full_name_ar?: string | null;
  avatar_url: string | null;
  role: UserRole;
  committee_id: string | null;
  committee_name?: string;
  branch_id?: string | null;
  branch_name?: string;
  total_points: number;
  participation_count: number;
  level: string;
  join_date: string;
  phone?: string;
  attended_mini_camp?: boolean;
  attended_camp?: boolean;
  is_ashbal?: boolean;
  birth_date?: string | null;
  last_seen_at?: string | null;
  is_active: boolean;
}

export interface FetchUsersOptions {
  branchId?: string;
  canViewAllBranches: boolean;
  language: string;
  branches: Branch[];
  page?: number;
  pageSize?: number;
}

export interface UsersResult {
  users: UserWithDetails[];
  totalCount: number;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  fullNameAr: string;
  role: UserRole;
  committeeId: string | null;
  phone: string | null;
  level: string;
  joinDate: string;
  branchId: string | null;
  birthDate: string | null;
  attendedMiniCamp: boolean;
  attendedCamp: boolean;
  isAshbal: boolean;
  avatarFile: File | null;
}

export interface UpdateUserPayload {
  userId: string;
  fullName: string;
  fullNameAr: string | null;
  email: string;
  phone: string | null;
  committeeId: string | null;
  branchId: string | null;
  level: string;
  attendedMiniCamp: boolean;
  attendedCamp: boolean;
  isAshbal: boolean;
  joinDate: string;
  birthDate: string | null;
  role: UserRole;
  previousRole: UserRole;
  password?: string;
  avatarFile: File | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

type AppRole = UserRole;

const getPrimaryRole = (roles: AppRole[]): AppRole => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('head_hr')) return 'head_hr';
  if (roles.includes('hr')) return 'hr';
  if (roles.includes('supervisor')) return 'supervisor';
  if (roles.includes('committee_leader')) return 'committee_leader';
  if (roles.includes('head_caravans')) return 'head_caravans';
  if (roles.includes('head_events')) return 'head_events';
  if (roles.includes('head_ethics')) return 'head_ethics';
  if (roles.includes('head_quran')) return 'head_quran';
  if (roles.includes('marketing_member')) return 'marketing_member';
  return 'volunteer';
};

// ─── Queries ────────────────────────────────────────────────────────

export async function getUsers(opts: FetchUsersOptions): Promise<UsersResult> {
  const { branchId, canViewAllBranches, language, branches, page = 1, pageSize = 50 } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 1. Paginated profiles
  let profilesQuery = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('full_name')
    .range(from, to);

  if (branchId) {
    profilesQuery = profilesQuery.eq('branch_id', branchId) as typeof profilesQuery;
  }

  // 2. Lightweight lookup tables in parallel
  const [profilesRes, rolesRes, committeesRes] = await Promise.all([
    profilesQuery,
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('committees').select('id, name, name_ar'),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const profilesData = profilesRes.data || [];
  const rolesData = rolesRes.data || [];
  const committeesData = committeesRes.data || [];
  const totalCount = profilesRes.count ?? 0;

  // 3. Participation counts — scoped to current page only
  const userIds = profilesData.map((p: any) => p.id);
  const participationMap = new Map<string, number>();

  if (userIds.length > 0) {
    const { data: actData } = await supabase
      .from('activity_submissions')
      .select('volunteer_id, status')
      .in('volunteer_id', userIds)
      .neq('status', 'rejected');

    (actData || []).forEach((a: any) => {
      if (a.volunteer_id) {
        participationMap.set(a.volunteer_id, (participationMap.get(a.volunteer_id) || 0) + 1);
      }
    });
  }

  // 4. Lookup maps
  const rolesMap = new Map<string, AppRole[]>();
  rolesData.forEach((r: any) => {
    if (r.user_id) {
      const cur = rolesMap.get(r.user_id) || [];
      cur.push(r.role as AppRole);
      rolesMap.set(r.user_id, cur);
    }
  });

  const committeesMap = new Map(
    committeesData.map((c: any) => [c.id, language === 'ar' ? c.name_ar : c.name])
  );
  const branchesMap = new Map(
    branches.map(b => [b.id, language === 'ar' ? b.name_ar : b.name])
  );

  // 5. Transform
  const users: UserWithDetails[] = profilesData.map((profile: any) => {
    const userRoles = rolesMap.get(profile.id) || [];
    if (profile.role) {
      const normalized = profile.role.toLowerCase().trim().replace(/ /g, '_') as AppRole;
      if (!userRoles.includes(normalized)) userRoles.push(normalized);
    }
    if (userRoles.length === 0) userRoles.push('volunteer');
    const uniqueRoles = Array.from(new Set(userRoles));

    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      full_name_ar: profile.full_name_ar,
      avatar_url: profile.avatar_url,
      role: getPrimaryRole(uniqueRoles as AppRole[]),
      committee_id: profile.committee_id,
      committee_name: profile.committee_id ? committeesMap.get(profile.committee_id) : undefined,
      branch_id: profile.branch_id,
      branch_name: profile.branch_id ? branchesMap.get(profile.branch_id) : undefined,
      total_points: profile.total_points || 0,
      participation_count: participationMap.get(profile.id) || 0,
      level: profile.level || 'under_follow_up',
      join_date: profile.join_date || profile.created_at,
      phone: profile.phone,
      attended_mini_camp: profile.attended_mini_camp,
      attended_camp: profile.attended_camp,
      is_ashbal: profile.is_ashbal,
      birth_date: profile.birth_date,
      last_seen_at: profile.last_seen_at || null,
      is_active: profile.is_active !== false,
    };
  });

  return { users, totalCount };
}

// ─── Mutations ──────────────────────────────────────────────────────

export async function createUser(payload: CreateUserPayload): Promise<{ userId: string }> {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      email: payload.email,
      password: payload.password,
      fullName: payload.fullName,
      fullNameAr: payload.fullNameAr,
      role: payload.role,
      committeeId: payload.committeeId,
      phone: payload.phone,
      level: payload.level,
      joinDate: payload.joinDate,
    },
  });

  if (error) throw error;
  if (!data?.user) throw new Error(data?.error || 'Failed to create user');

  const userId = data.user.id;

  if (payload.avatarFile) {
    const ext = payload.avatarFile.name.split('.').pop();
    const fileName = `${userId}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(fileName, payload.avatarFile, { upsert: true });
    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId);
    }
  }

  const updates: Record<string, any> = {};
  if (payload.level === 'under_follow_up') updates.attended_mini_camp = payload.attendedMiniCamp;
  if (payload.level === 'project_responsible') updates.attended_camp = payload.attendedCamp;
  if (payload.isAshbal) updates.is_ashbal = true;
  if (payload.birthDate) updates.birth_date = payload.birthDate;
  if (payload.branchId) updates.branch_id = payload.branchId;

  if (Object.keys(updates).length > 0) {
    updates.level = payload.level;
    await supabase.from('profiles').update(updates).eq('id', userId);
  }

  return { userId };
}

export async function updateUser(payload: UpdateUserPayload): Promise<void> {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: payload.fullName,
      full_name_ar: payload.fullNameAr || null,
      email: payload.email,
      phone: payload.phone || null,
      committee_id: payload.committeeId || null,
      branch_id: payload.branchId || null,
      level: payload.level as any,
      attended_mini_camp: payload.level === 'under_follow_up' ? payload.attendedMiniCamp : null,
      attended_camp: payload.level === 'project_responsible' ? payload.attendedCamp : null,
      is_ashbal: payload.isAshbal,
      join_date: payload.joinDate,
      birth_date: payload.birthDate || null,
    })
    .eq('id', payload.userId)
    .select();

  if (profileError) throw profileError;
  if (!profileData || profileData.length === 0) {
    throw new Error('Update failed — no changes applied (check permissions)');
  }

  if (payload.avatarFile) {
    const ext = payload.avatarFile.name.split('.').pop();
    const fileName = `${payload.userId}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(fileName, payload.avatarFile, { upsert: true });
    if (!uploadErr) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', payload.userId);
    }
  }

  if (payload.role !== payload.previousRole) {
    await supabase.from('user_roles').delete().eq('user_id', payload.userId);
    if (payload.role !== 'volunteer') {
      await supabase.from('user_roles').insert({ user_id: payload.userId, role: payload.role } as any);
    }
  }

  if (payload.password?.trim()) {
    if (payload.password.length < 6) throw new Error('Password must be at least 6 characters');
    const { data: pwData, error: pwError } = await supabase.functions.invoke('update-user-password', {
      body: { userId: payload.userId, newPassword: payload.password.trim() },
    });
    if (pwError) throw pwError;
    if (pwData?.error) throw new Error(pwData.error);
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_user_account', {
    target_user_id: userId,
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive } as any)
    .eq('id', userId);
  if (error) throw error;
}

export async function updateUserRole(userId: string, newRole: string): Promise<void> {
  await supabase.from('user_roles').delete().eq('user_id', userId);
  if (newRole !== 'volunteer') {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: newRole } as any);
    if (error) throw error;
  }
}
