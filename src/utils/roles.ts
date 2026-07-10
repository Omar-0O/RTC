import type { UserRole } from '@/types';

const ROLE_PRIORITY: readonly UserRole[] = [
  'admin',
  'executive',
  'branch_admin',
  'head_hr',
  'hr',
  'supervisor',
  'committee_leader',
  'head_production',
  'head_fourth_year',
  'head_caravans',
  'head_events',
  'head_ethics',
  'head_quran',
  'head_marketing',
  'head_ashbal',
  'marketing_member',
  'volunteer',
];

export function getPrimaryRole(roles: readonly UserRole[]): UserRole {
  return ROLE_PRIORITY.find(role => roles.includes(role)) ?? 'volunteer';
}
