import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { UserRole } from '@/types';

export type AuthProfile = Database['public']['Tables']['profiles']['Row'];

type UserFeatureRow = {
  feature: string;
};

type UserFeatureClient = {
  from(table: 'user_features'): {
    select(columns: 'feature'): {
      eq(column: 'user_id', value: string): Promise<{
        data: UserFeatureRow[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export interface AuthData {
  profile: AuthProfile | null;
  roles: UserRole[];
  features: string[];
  rolesError: unknown | null;
}

const PROFILE_COLUMNS = `
  activities_count,
  ashbal_status,
  attended_camp,
  attended_mini_camp,
  avatar_url,
  birth_date,
  branch_id,
  committee_id,
  cover_url,
  created_at,
  email,
  full_name,
  full_name_ar,
  id,
  is_active,
  is_ashbal,
  join_date,
  last_seen_at,
  level,
  phone,
  total_points,
  updated_at
`;

const DEFAULT_ROLES: UserRole[] = ['volunteer'];

async function getUserFeatures(userId: string): Promise<string[]> {
  try {
    const userFeatureClient = supabase as unknown as UserFeatureClient;
    const { data, error } = await userFeatureClient
      .from('user_features')
      .select('feature')
      .eq('user_id', userId);

    return error ? [] : (data ?? []).map(({ feature }) => feature);
  } catch {
    return [];
  }
}

export async function getAuthData(userId: string): Promise<AuthData> {
  const [profileResult, rolesResult, features] = await Promise.all([
    supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId),
    getUserFeatures(userId),
  ]);

  if (profileResult.error) throw profileResult.error;

  const roles = rolesResult.error || !rolesResult.data?.length
    ? DEFAULT_ROLES
    : rolesResult.data.map(({ role }) => role as UserRole);

  return {
    profile: profileResult.data,
    roles,
    features,
    rolesError: rolesResult.error,
  };
}
