/**
 * Users service — all user/profile Supabase calls.
 *
 * Clean separation: no React, no hooks, no toast — just data I/O.
 * Hooks call these functions; services throw ApiError on failure.
 */
import { supabase } from '@/integrations/supabase/client';
import { toFunctionApiError, unwrap } from './api';
import type { UserRole } from '@/types';
import type { Branch } from '@/contexts/BranchContext';
import type { Database } from '@/integrations/supabase/types';
import { getPrimaryRole } from '@/utils/roles';
import { getSafeImageExtension, isSafeImageFile } from '@/utils/safeImages';

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

export interface UserExportRow {
  fullName: string | null;
  fullNameAr: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
  level: string | null;
  attendedMiniCamp: boolean | null;
  attendedCamp: boolean | null;
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
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type LegacyProfileRow = ProfileRow & { role?: string | null };
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type ActivitySubmissionRow = Database['public']['Tables']['activity_submissions']['Row'];
type CommitteeRow = Database['public']['Tables']['committees']['Row'];
type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type UserRoleInsert = Database['public']['Tables']['user_roles']['Insert'];
type CreateUserResponse = { user?: { id: string }; error?: string };
type UpdatePasswordResponse = { error?: string };
type DeleteUserAccountResponse = { error?: string } | null;
type UserFeatureRow = Database['public']['Tables']['user_features']['Row'];
type UserFeatureInsert = Database['public']['Tables']['user_features']['Insert'];

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const USER_PROFILE_COLUMNS = 'id, email, full_name, full_name_ar, avatar_url, committee_id, branch_id, total_points, level, join_date, created_at, phone, attended_mini_camp, attended_camp, is_ashbal, birth_date, last_seen_at, is_active';
const LEGACY_USER_PROFILE_COLUMNS = 'id, email, full_name, full_name_ar, avatar_url, committee_id, total_points, level, join_date, created_at, phone';

const isMissingColumnError = (error: { code?: string } | null): boolean => error?.code === '42703';

// ─── Avatar upload ──────────────────────────────────────────────────

function validateAvatarFile(file: File) {
  if (!isSafeImageFile(file)) {
    throw new Error('Avatar must be a JPG, PNG, or WebP image');
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error('Avatar image must be 5MB or smaller');
  }
}

async function uploadAvatar(userId: string, file: File): Promise<void> {
  validateAvatarFile(file);

  const fileName = `${userId}/avatar.${getSafeImageExtension(file)}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(fileName, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', userId);

  if (profileError) throw profileError;
}

// ─── Queries ────────────────────────────────────────────────────────

export async function getUsers(opts: FetchUsersOptions): Promise<UsersResult> {
  const { branchId, canViewAllBranches, language, branches, page = 1, pageSize = 50 } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const fetchProfiles = (applyBranchFilter: boolean) => {
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('full_name')
      .range(from, to);

    if (applyBranchFilter && branchId) {
      query = canViewAllBranches
        ? query.or(`branch_id.eq.${branchId},branch_id.is.null`) as typeof query
        : query.eq('branch_id', branchId) as typeof query;
    }

    return query;
  };

  // Current schema first with select('*'). Old deployments can still list users.
  const profilesRes = await fetchProfiles(true);
  let profilesData: LegacyProfileRow[];
  let totalCount: number;

  if (profilesRes.error && isMissingColumnError(profilesRes.error)) {
    // Missing branch_id column in database
    if (branchId && !canViewAllBranches) {
      throw new Error('Your database needs the branch migration before this account can list volunteers.');
    }

    const legacyProfilesRes = await fetchProfiles(false);
    if (legacyProfilesRes.error) throw legacyProfilesRes.error;
    profilesData = (legacyProfilesRes.data ?? []) as unknown as LegacyProfileRow[];
    totalCount = legacyProfilesRes.count ?? 0;
  } else {
    if (profilesRes.error) throw profilesRes.error;
    profilesData = (profilesRes.data ?? []) as LegacyProfileRow[];
    totalCount = profilesRes.count ?? 0;
  }

  // Lightweight lookup table.
  const { data: committeesDataResult, error: committeesError } = await supabase
    .from('committees')
    .select('id, name, name_ar');

  if (committeesError) throw committeesError;
  const committeesData = (committeesDataResult ?? []) as Pick<CommitteeRow, 'id' | 'name' | 'name_ar'>[];

  // 3. Page-scoped roles and participation counts
  const userIds = profilesData.map(profile => profile.id);
  const participationMap = new Map<string, number>();
  let rolesData: Pick<UserRoleRow, 'user_id' | 'role'>[] = [];

  if (userIds.length > 0) {
    const [rolesRes, submissionsRes] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      supabase
        .from('activity_submissions')
        .select('volunteer_id, status')
        .in('volunteer_id', userIds)
        .neq('status', 'rejected'),
    ]);

    if (rolesRes.error) throw rolesRes.error;
    if (submissionsRes.error) throw submissionsRes.error;

    rolesData = (rolesRes.data ?? []) as Pick<UserRoleRow, 'user_id' | 'role'>[];
    const submissions = (submissionsRes.data ?? []) as Pick<ActivitySubmissionRow, 'volunteer_id' | 'status'>[];
    submissions.forEach(submission => {
      if (submission.volunteer_id) {
        participationMap.set(
          submission.volunteer_id,
          (participationMap.get(submission.volunteer_id) || 0) + 1
        );
      }
    });
  }

  // 4. Lookup maps
  const rolesMap = new Map<string, AppRole[]>();
  rolesData.forEach(roleRow => {
    if (roleRow.user_id) {
      const currentRoles = rolesMap.get(roleRow.user_id) || [];
      currentRoles.push(roleRow.role as AppRole);
      rolesMap.set(roleRow.user_id, currentRoles);
    }
  });

  const committeesMap = new Map(
    committeesData.map(committee => [committee.id, language === 'ar' ? committee.name_ar : committee.name])
  );
  const branchesMap = new Map(
    branches.map(b => [b.id, language === 'ar' ? b.name_ar : b.name])
  );

  // 5. Transform
  const users: UserWithDetails[] = profilesData.map(profile => {
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

export async function getUsersForExport({
  branchId,
  canViewAllBranches,
}: Pick<FetchUsersOptions, 'branchId' | 'canViewAllBranches'>): Promise<UserExportRow[]> {
  let query = supabase
    .from('profiles')
    .select('*')
    .order('full_name');

  if (branchId) {
    query = canViewAllBranches
      ? query.or(`branch_id.eq.${branchId},branch_id.is.null`) as typeof query
      : query.eq('branch_id', branchId) as typeof query;
  }

  const { data: profiles, error: profilesError } = await query;
  if (profilesError) throw profilesError;

  const rows = (profiles ?? []).filter((profile) => profile.full_name !== 'RTC Admin');
  const userIds = rows.map((profile) => profile.id);
  const roles = new Map<string, UserRole>();

  if (userIds.length > 0) {
    const { data: roleRows, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);
    if (rolesError) throw rolesError;
    (roleRows ?? []).forEach((roleRow) => {
      if (roleRow.user_id && roleRow.role) roles.set(roleRow.user_id, roleRow.role as UserRole);
    });
  }

  return rows.map((profile) => ({
    fullName: profile.full_name,
    fullNameAr: profile.full_name_ar,
    email: profile.email,
    phone: profile.phone,
    role: roles.get(profile.id) || 'volunteer',
    createdAt: profile.created_at,
    level: profile.level,
    attendedMiniCamp: profile.attended_mini_camp,
    attendedCamp: profile.attended_camp,
  }));
}

// ─── Mutations ──────────────────────────────────────────────────────

export async function createUser(payload: CreateUserPayload): Promise<{ userId: string }> {
  const { data, error } = await supabase.functions.invoke<CreateUserResponse>('create-user', {
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
      branchId: payload.branchId,
      birthDate: payload.birthDate,
      attendedMiniCamp: payload.attendedMiniCamp,
      attendedCamp: payload.attendedCamp,
      isAshbal: payload.isAshbal,
    },
  });

  if (error) throw await toFunctionApiError(error, 'Failed to create user');
  if (!data?.user) throw new Error(data?.error || 'Failed to create user');

  const userId = data.user.id;

  if (payload.avatarFile) {
    await uploadAvatar(userId, payload.avatarFile);
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
      level: payload.level as ProfileRow['level'],
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
    await uploadAvatar(payload.userId, payload.avatarFile);
  }

  if (payload.role !== payload.previousRole) {
    const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', payload.userId);
    if (deleteError) throw deleteError;

    if (payload.role !== 'volunteer') {
      const rolePayload: UserRoleInsert = { user_id: payload.userId, role: payload.role as any };
      const { error: insertError } = await supabase.from('user_roles').insert(rolePayload);
      if (insertError) throw insertError;
    }
  }

  if (payload.password?.trim()) {
    if (payload.password.length < 6) throw new Error('Password must be at least 6 characters');
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_user_password' as any, {
      target_user_id: payload.userId,
      new_password: payload.password.trim(),
    });

    if (!rpcError) {
      const result = rpcData as { success?: boolean; error?: string };
      if (result?.error) throw new Error(result.error);
    } else {
      const { data: pwData, error: pwError } = await supabase.functions.invoke<UpdatePasswordResponse>('update-user-password', {
        body: { userId: payload.userId, newPassword: payload.password.trim() },
      });
      if (pwError) throw await toFunctionApiError(pwError, 'Failed to update password');
      if (pwData?.error) throw new Error(pwData.error);
    }
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_user_account', {
    target_user_id: userId,
  });
  if (error) throw error;
  const rpcResult = data as DeleteUserAccountResponse;
  if (rpcResult?.error) throw new Error(rpcResult.error);
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateUserRole(userId: string, newRole: string): Promise<void> {
  const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;

  if (newRole !== 'volunteer') {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: newRole as any });
    if (error) throw error;
  }
}

export async function getUserFeatures(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_features')
    .select('feature')
    .eq('user_id', userId);

  if (error) throw error;
  return (data as Pick<UserFeatureRow, 'feature'>[]).map(({ feature }) => feature);
}

export async function saveUserFeatures(userId: string, features: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('user_features')
    .delete()
    .eq('user_id', userId);

  if (deleteError) throw deleteError;
  if (features.length === 0) return;

  const rows: UserFeatureInsert[] = features.map((feature) => ({ user_id: userId, feature }));
  const { error: insertError } = await supabase.from('user_features').insert(rows);
  if (insertError) throw insertError;
}
