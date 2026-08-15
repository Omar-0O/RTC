export type VolunteerGrade = 'responsible' | 'project_responsible' | 'under_follow_up';

export interface RawVolunteerItem {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  avatar_url?: string | null;
  level: string | null;
  count: number;
}

export interface TopVolunteer {
  id: string;
  full_name: string;
  full_name_ar?: string;
  avatar_url?: string;
  level?: string;
  count: number;
}

export interface TopByLevel {
  grade: VolunteerGrade;
  label_ar: string;
  label_en: string;
  color: string;
  volunteers: TopVolunteer[];
}

export const GRADE_MAP: Record<VolunteerGrade, string[]> = {
  responsible: ['responsible', 'platinum', 'diamond'],
  project_responsible: ['project_responsible', 'gold'],
  under_follow_up: ['under_follow_up', 'silver', 'bronze', 'newbie', 'active'],
};

export const GRADE_METADATA: TopByLevel[] = [
  { grade: 'responsible', label_ar: 'مسئول', label_en: 'Responsible', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', volunteers: [] },
  { grade: 'project_responsible', label_ar: 'مشروع مسئول', label_en: 'Project Responsible', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', volunteers: [] },
  { grade: 'under_follow_up', label_ar: 'تحت المتابعة', label_en: 'Under Follow-up', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', volunteers: [] },
];

/**
 * Processes a raw list of volunteers with participation counts,
 * sorts them strictly in descending order of count, and groups the top 3 per grade tier.
 */
export function processTopVolunteersByGrade(rawList: RawVolunteerItem[]): TopByLevel[] {
  const sanitized: TopVolunteer[] = (rawList || []).map((item) => ({
    id: item.id,
    full_name: item.full_name || '',
    full_name_ar: item.full_name_ar || '',
    avatar_url: item.avatar_url || undefined,
    level: item.level || 'under_follow_up',
    count: Number(item.count) || 0,
  }));

  const grades: TopByLevel[] = GRADE_METADATA.map((g) => ({
    ...g,
    volunteers: [],
  }));

  grades.forEach((g) => {
    const validLevels = GRADE_MAP[g.grade].map((l) => l.toLowerCase());

    const matchingVolunteers = sanitized.filter((v) => {
      const vLevel = (v.level || 'under_follow_up').toLowerCase();
      return validLevels.includes(vLevel);
    });

    // Sort strictly by count DESC, tie-break by name
    matchingVolunteers.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      const nameA = a.full_name_ar || a.full_name || '';
      const nameB = b.full_name_ar || b.full_name || '';
      return nameA.localeCompare(nameB);
    });

    g.volunteers = matchingVolunteers.slice(0, 3);
  });

  return grades.filter((g) => g.volunteers.length > 0);
}
