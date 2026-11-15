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

const KIOSK_EMAILS = new Set([
  'medaniparticipations@rtc.org',
  'kiosk@rtc.internal',
]);

export function isKioskAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return KIOSK_EMAILS.has(email.trim().toLowerCase());
}

export function isDeactivatedUser(
  profile: { is_active?: boolean | null; email?: string | null } | null | undefined,
  authEmail?: string | null
): boolean {
  if (!profile) return false;
  if (isKioskAccount(authEmail ?? profile.email)) return false;
  return profile.is_active === false;
}

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

export async function ensureMonthlyAutoDismissal(profileData?: Record<string, unknown> | null): Promise<void> {
  try {
    // Only invoke the RPC if the database migration has been applied (auto_dismissal_enabled column exists)
    if (!profileData || !('auto_dismissal_enabled' in profileData)) {
      return;
    }
    const currentYm = new Date().toISOString().slice(0, 7);
    const storageKey = `rtc_auto_dismissal_${currentYm}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(storageKey) === '1') {
      return;
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(storageKey, '1');
    }
    const rpcClient = supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
    await rpcClient.rpc('run_monthly_auto_dismissal', { p_force: false });
  } catch {
    // Best-effort background check; never block auth flow.
  }
}

export async function getAuthData(userId: string): Promise<AuthData> {
  const [profileResult, rolesResult, features] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId),
    getUserFeatures(userId),
  ]);

  if (profileResult.error) throw profileResult.error;

  void ensureMonthlyAutoDismissal(profileResult.data as Record<string, unknown> | null);

  const roles = rolesResult.error || !rolesResult.data?.length
    ? DEFAULT_ROLES
    : rolesResult.data.map(({ role }) => role as UserRole);

  return {
    profile: profileResult.data as AuthProfile | null,
    roles,
    features,
    rolesError: rolesResult.error,
  };
}
