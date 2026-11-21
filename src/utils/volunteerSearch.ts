import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export interface SearchableVolunteer {
  id: string;
  full_name: string | null;
  full_name_ar?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  branch_id?: string | null;
}

export type VolunteerProfilesClient = Pick<SupabaseClient<Database>, 'from'>;

export interface FetchAllVolunteerProfilesOptions {
  branchId?: string | null;
  fallbackClient?: VolunteerProfilesClient;
  pageSize?: number;
}

interface RawVolunteerProfileRow {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  phone: string | null;
  avatar_url: string | null;
  email: string | null;
  branch_id: string | null;
}

export const KIOSK_SERVICE_EMAILS = new Set([
  'medaniparticipations@rtc.org',
  'kiosk@rtc.internal',
]);

export function isKioskEmail(email?: string | null): boolean {
  if (!email) return false;
  return KIOSK_SERVICE_EMAILS.has(email.trim().toLowerCase());
}

export function isSystemPlaceholderVolunteer(
  volunteer: Pick<SearchableVolunteer, 'email' | 'full_name' | 'full_name_ar'>
): boolean {
  if (isKioskEmail(volunteer.email)) return true;
  const nameEn = volunteer.full_name?.trim().toLowerCase() ?? '';
  const nameAr = volunteer.full_name_ar?.trim().toLowerCase() ?? '';
  return nameEn === 'rtc admin' || nameAr === 'rtc admin';
}

function toAsciiDigits(str: string): string {
  return str
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizeVolunteerText(str?: string | null): string {
  if (!str) return '';
  return toAsciiDigits(str)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ء/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACTIVITY_STRUCTURE_TRIGGERS = new Set([
  'هيكله',
  'الهيكله',
  'هيكله النشاط',
]);

/**
 * Matches secret Arabic keyword inputs (e.g. "هيكلة") used to open the
 * Activity Structure board directly from Field Logging volunteer search inputs.
 */
export function isActivityStructureTrigger(query?: string | null): boolean {
  const normalized = normalizeVolunteerText(query);
  return normalized.length > 0 && ACTIVITY_STRUCTURE_TRIGGERS.has(normalized);
}

export function normalizePhoneDigits(str?: string | null): string {
  if (!str) return '';
  return toAsciiDigits(str).replace(/\D/g, '');
}

export function getCoreEgyptianPhoneDigits(digits: string): string {
  if (!digits) return '';
  if (digits.startsWith('0020')) return digits.slice(4);
  if (digits.startsWith('20') && digits.length >= 3) return digits.slice(2);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function getVolunteerDisplayName(
  volunteer: SearchableVolunteer,
  locale: 'ar' | 'en' = 'ar'
): string {
  if (locale === 'en') {
    return (volunteer.full_name || volunteer.full_name_ar || '').trim() || 'Unknown Volunteer';
  }
  return (volunteer.full_name_ar || volunteer.full_name || '').trim() || 'Unknown Volunteer';
}

export interface FilterAndRankVolunteersOptions {
  locale?: 'ar' | 'en';
}

function scoreVolunteerMatch(
  volunteer: SearchableVolunteer,
  qNorm: string,
  qCollapsed: string,
  qTokens: string[],
  qDigits: string,
  qCore: string,
  allowPhoneMatch: boolean
): number | null {
  const nameAr = normalizeVolunteerText(volunteer.full_name_ar);
  const nameEn = normalizeVolunteerText(volunteer.full_name);

  if (qNorm) {
    const nameArCollapsed = nameAr.replace(/\s+/g, '');
    const nameEnCollapsed = nameEn.replace(/\s+/g, '');

    if (
      nameAr.startsWith(qNorm) ||
      nameEn.startsWith(qNorm) ||
      (qCollapsed.length > 0 &&
        (nameArCollapsed.startsWith(qCollapsed) || nameEnCollapsed.startsWith(qCollapsed)))
    ) {
      return 0;
    }

    if (
      nameAr.includes(qNorm) ||
      nameEn.includes(qNorm) ||
      (qCollapsed.length > 0 &&
        (nameArCollapsed.includes(qCollapsed) || nameEnCollapsed.includes(qCollapsed)))
    ) {
      return 1;
    }

    if (qTokens.length > 1) {
      const combinedNames = `${nameAr} ${nameEn}`.trim();
      if (qTokens.every((token) => combinedNames.includes(token))) {
        return 2;
      }
    }
  }

  if (allowPhoneMatch && qDigits.length > 0) {
    const phoneDigits = normalizePhoneDigits(volunteer.phone);
    if (phoneDigits) {
      const phoneCore = getCoreEgyptianPhoneDigits(phoneDigits);
      if (
        phoneDigits.startsWith(qDigits) ||
        (qCore.length > 0 && phoneCore.startsWith(qCore))
      ) {
        return 2;
      }
      if (phoneDigits.includes(qDigits)) {
        return 3;
      }
    }
  }

  return null;
}

export function filterAndRankVolunteers<T extends SearchableVolunteer>(
  volunteers: T[],
  query: string,
  excludeId?: string | null,
  options: FilterAndRankVolunteersOptions = {}
): T[] {
  const locale = options.locale ?? 'ar';
  const eligible = volunteers.filter(
    (v) => (!excludeId || v.id !== excludeId) && !isSystemPlaceholderVolunteer(v)
  );

  const trimmedQuery = query.trim();
  const qNorm = normalizeVolunteerText(trimmedQuery);
  const qDigits = normalizePhoneDigits(trimmedQuery);

  if (!qNorm && !qDigits) {
    return [...eligible].sort((a, b) =>
      getVolunteerDisplayName(a, locale).localeCompare(getVolunteerDisplayName(b, locale), locale)
    );
  }

  const qTokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
  const qCollapsed = qNorm.replace(/\s+/g, '');
  const isPhoneOnlyQuery = !/[^\d\s+\-()\u0660-\u0669\u06F0-\u06F9]/.test(trimmedQuery);
  const allowPhoneMatch = qDigits.length > 0 && (isPhoneOnlyQuery || qDigits.length >= 4);
  const qCore = getCoreEgyptianPhoneDigits(qDigits);

  const scored: { volunteer: T; rank: number }[] = [];

  for (const volunteer of eligible) {
    const rank = scoreVolunteerMatch(
      volunteer,
      qNorm,
      qCollapsed,
      qTokens,
      qDigits,
      qCore,
      allowPhoneMatch
    );
    if (rank !== null) {
      scored.push({ volunteer, rank });
    }
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return getVolunteerDisplayName(a.volunteer, locale).localeCompare(
      getVolunteerDisplayName(b.volunteer, locale),
      locale
    );
  });

  return scored.map((entry) => entry.volunteer);
}

async function fetchPagedProfiles(
  client: VolunteerProfilesClient,
  branchId: string | null | undefined,
  pageSize: number
): Promise<SearchableVolunteer[]> {
  const allRows: RawVolunteerProfileRow[] = [];
  let offset = 0;

  while (true) {
    let query = client
      .from('profiles')
      .select('id, full_name, full_name_ar, phone, avatar_url, email, branch_id');

    if (branchId) {
      const queryWithOr = query as typeof query & {
        or?: (filters: string) => typeof query;
      };
      if (typeof queryWithOr.or === 'function') {
        query = queryWithOr.or(`branch_id.eq.${branchId},branch_id.is.null`);
      } else {
        query = query.eq('branch_id', branchId);
      }
    }

    const { data, error } = await query
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const batch = (data ?? []) as RawVolunteerProfileRow[];
    allRows.push(...batch);

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows
    .filter((row) => !isSystemPlaceholderVolunteer(row))
    .map((row) => ({
      id: row.id,
      full_name: row.full_name?.trim() || row.full_name_ar?.trim() || 'Unknown Volunteer',
      full_name_ar: row.full_name_ar?.trim() || null,
      phone: row.phone ?? null,
      avatar_url: row.avatar_url ?? null,
      email: row.email ?? null,
      branch_id: row.branch_id ?? null,
    }));
}

export async function fetchAllVolunteerProfiles(
  client: VolunteerProfilesClient,
  options: FetchAllVolunteerProfilesOptions = {}
): Promise<SearchableVolunteer[]> {
  const pageSize = options.pageSize ?? 1000;

  try {
    const primary = await fetchPagedProfiles(client, options.branchId, pageSize);
    if (primary.length === 0 && options.fallbackClient) {
      return await fetchPagedProfiles(options.fallbackClient, options.branchId, pageSize);
    }
    return primary;
  } catch (error) {
    if (options.fallbackClient) {
      return await fetchPagedProfiles(options.fallbackClient, options.branchId, pageSize);
    }
    throw error;
  }
}
