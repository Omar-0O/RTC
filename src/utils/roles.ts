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

const ROLE_LABELS: Record<UserRole, { ar: string; en: string }> = {
  volunteer: { ar: 'متطوع', en: 'Volunteer' },
  committee_leader: { ar: 'هيد اللجنة', en: 'Committee Head' },
  supervisor: { ar: 'هيد الفرع', en: 'Head of Branch' },
  admin: { ar: 'مسؤول', en: 'Admin' },
  executive: { ar: 'تنفيذي', en: 'Executive' },
  branch_admin: { ar: 'مسؤول الفرع', en: 'Branch Admin' },
  hr: { ar: 'الموارد البشرية', en: 'HR' },
  head_hr: { ar: 'هيد الموارد البشرية', en: 'Head HR' },
  head_caravans: { ar: 'هيد لجنة القوافل', en: 'Head of Caravans' },
  head_events: { ar: 'هيد لجنة الفعاليات', en: 'Head of Events' },
  head_production: { ar: 'هيد لجان الإنتاج', en: 'Production Head' },
  head_fourth_year: { ar: 'هيد لجان سنة رابعة', en: 'Fourth Year Head' },
  head_ethics: { ar: 'هيد نشر الأخلاقيات', en: 'Ethics Publishing Head' },
  head_quran: { ar: 'هيد لجنة القرآن', en: 'Head of Quran Committee' },
  head_marketing: { ar: 'هيد لجنة التسويق', en: 'Head of Marketing Committee' },
  head_ashbal: { ar: 'هيد لجنة الأشبال', en: 'Head of Ashbal Committee' },
  marketing_member: { ar: 'عضو لجنة التسويق', en: 'Marketing Team Member' },
};

export function getRoleLabel(role: string | null | undefined, isRTL: boolean): string {
  if (!role) return isRTL ? 'متطوع' : 'Volunteer';
  const match = ROLE_LABELS[role as UserRole];
  if (match) {
    return isRTL ? match.ar : match.en;
  }
  return role.replace(/_/g, ' ');
}
