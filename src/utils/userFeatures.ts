import type { UserRole } from '@/types';

export interface UserFeatureItem {
  id: string;
  label: string;
  labelEn: string;
}

export const ALL_FEATURES: readonly UserFeatureItem[] = [
  { id: 'user_management', label: 'إدارة الأعضاء', labelEn: 'User Management' },
  { id: 'courses_management', label: 'إدارة الكورسات والمدربين', labelEn: 'Courses & Trainers Management' },
  { id: 'quran_circles_management', label: 'إدارة حلقات القرآن والمحفظين', labelEn: 'Quran Circles & Teachers Management' },
  { id: 'caravans_management', label: 'إدارة القوافل', labelEn: 'Caravans Management' },
  { id: 'events_management', label: 'إدارة الايفنتات', labelEn: 'Events Management' },
  { id: 'ashbal_management', label: 'إدارة الأشبال', labelEn: 'Ashbal Management' },
  { id: 'ethics_management', label: 'إدارة الأخلاقيات والمكالمات', labelEn: 'Ethics & Calls Management' },
  { id: 'fines_management', label: 'إدارة الغرامات', labelEn: 'Fines Management' },
  { id: 'hr_management', label: 'إدارة المشاركات (HR)', labelEn: 'Submission Management (HR)' },
  { id: 'reports_view', label: 'عرض التقارير', labelEn: 'Reports View' },
  { id: 'followup_management', label: 'شيت المتابعة', labelEn: 'Follow-Up Sheet' },
  { id: 'rooms_management', label: 'إدارة القاعات', labelEn: 'Rooms Management' },
  { id: 'group_submission', label: 'المشاركة الجماعية', labelEn: 'Group Submission' },
] as const;

export const GROUP_SUBMISSION_LEADER_ROLES: readonly string[] = [
  'admin',
  'branch_admin',
  'executive',
  'supervisor',
  'committee_leader',
  'head_hr',
  'hr',
  'head_caravans',
  'head_events',
  'head_ethics',
  'head_quran',
  'head_ashbal',
  'head_marketing',
  'head_production',
  'head_fourth_year',
  'head_media',
] as const;

export const getRoleDefaultFeatures = (role: UserRole): string[] => {
  switch (role) {
    case 'admin':
    case 'branch_admin':
      return [
        'courses_management',
        'quran_circles_management',
        'caravans_management',
        'events_management',
        'ashbal_management',
        'ethics_management',
        'fines_management',
        'hr_management',
        'user_management',
        'reports_view',
        'followup_management',
        'rooms_management',
        'group_submission',
      ];
    case 'supervisor':
      return ['user_management', 'reports_view', 'courses_management', 'followup_management', 'group_submission'];
    case 'committee_leader':
      return ['courses_management', 'events_management', 'group_submission'];
    case 'hr':
      return ['hr_management', 'user_management', 'reports_view', 'group_submission'];
    case 'head_hr':
      return ['hr_management', 'user_management', 'reports_view', 'followup_management', 'group_submission'];
    case 'head_caravans':
      return ['caravans_management', 'events_management', 'group_submission'];
    case 'head_events':
      return ['events_management', 'reports_view', 'group_submission'];
    case 'head_production':
    case 'head_fourth_year':
      return ['events_management', 'reports_view', 'group_submission'];
    case 'head_ethics':
      return ['ethics_management', 'events_management', 'group_submission'];
    case 'head_quran':
      return ['quran_circles_management', 'events_management', 'group_submission'];
    case 'head_ashbal':
      return ['ashbal_management', 'events_management', 'group_submission'];
    case 'head_marketing':
      return ['courses_management', 'events_management', 'quran_circles_management', 'group_submission'];
    default:
      return [];
  }
};

export function canSubmitGroupActivity(
  roleOrRoles?: string | readonly string[] | null,
  features?: readonly string[] | null
): boolean {
  if (features && features.includes('group_submission')) {
    return true;
  }

  if (!roleOrRoles) {
    return false;
  }

  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.some((r) => GROUP_SUBMISSION_LEADER_ROLES.includes(r));
  }

  return GROUP_SUBMISSION_LEADER_ROLES.includes(roleOrRoles);
}
