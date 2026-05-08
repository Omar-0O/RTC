/**
 * Centralized query key factory for React Query.
 *
 * Ensures consistent cache keys across the entire application so that
 * mutations can reliably invalidate the correct queries.
 *
 * Pattern: entity.scope(…params) → readonly tuple
 */
export const queryKeys = {
  // ── Users / Profiles ──────────────────────────────────────────────
  users: {
    all: ['users'] as const,
    list: (filters?: { branchId?: string; page?: number; pageSize?: number }) =>
      ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  // ── Committees ────────────────────────────────────────────────────
  committees: {
    all: ['committees'] as const,
    list: () => ['committees', 'list'] as const,
  },

  // ── User Roles ────────────────────────────────────────────────────
  userRoles: {
    all: ['userRoles'] as const,
    byUser: (userId: string) => ['userRoles', userId] as const,
  },

  // ── Quran Circles ─────────────────────────────────────────────────
  circles: {
    all: ['circles'] as const,
    list: () => ['circles', 'list'] as const,
    detail: (id: string) => ['circles', 'detail', id] as const,
    sessions: (circleId: string) => ['circles', 'sessions', circleId] as const,
    enrollments: (circleId: string) => ['circles', 'enrollments', circleId] as const,
    attendance: (circleId: string) => ['circles', 'attendance', circleId] as const,
    ads: (circleId: string) => ['circles', 'ads', circleId] as const,
    marketers: (circleId: string) => ['circles', 'marketers', circleId] as const,
  },

  // ── Quran Teachers ────────────────────────────────────────────────
  teachers: {
    all: ['teachers'] as const,
    list: () => ['teachers', 'list'] as const,
  },

  // ── Beneficiaries ─────────────────────────────────────────────────
  beneficiaries: {
    all: ['beneficiaries'] as const,
    list: () => ['beneficiaries', 'list'] as const,
  },

  // ── Volunteers (profiles subset) ──────────────────────────────────
  volunteers: {
    all: ['volunteers'] as const,
    list: () => ['volunteers', 'list'] as const,
  },

  // ── Follow-Up Management ──────────────────────────────────────────
  followUp: {
    all: ['followUp'] as const,
    list: (filters?: { branchId?: string; canViewAll?: boolean }) =>
      ['followUp', 'list', filters] as const,
  },

  // ── Activity Submissions ──────────────────────────────────────────
  activities: {
    all: ['activities'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['activities', 'list', filters] as const,
    participationCounts: () => ['activities', 'participationCounts'] as const,
  },

  // ── Badges ────────────────────────────────────────────────────────
  badges: {
    all: ['badges'] as const,
    list: () => ['badges', 'list'] as const,
  },

  // ── Events ────────────────────────────────────────────────────────
  events: {
    all: ['events'] as const,
    list: () => ['events', 'list'] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
  },

  // ── Courses ───────────────────────────────────────────────────────
  courses: {
    all: ['courses'] as const,
    list: () => ['courses', 'list'] as const,
    detail: (id: string) => ['courses', 'detail', id] as const,
  },

  // ── Caravans ──────────────────────────────────────────────────────
  caravans: {
    all: ['caravans'] as const,
    list: () => ['caravans', 'list'] as const,
    detail: (id: string) => ['caravans', 'detail', id] as const,
  },

  // ── Branches ──────────────────────────────────────────────────────
  branches: {
    all: ['branches'] as const,
    list: () => ['branches', 'list'] as const,
  },

  // ── Fines ─────────────────────────────────────────────────────────
  fines: {
    all: ['fines'] as const,
    list: () => ['fines', 'list'] as const,
  },

  // ── Trainers ──────────────────────────────────────────────────────
  trainers: {
    all: ['trainers'] as const,
    list: () => ['trainers', 'list'] as const,
  },
} as const;
