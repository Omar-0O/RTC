import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { saveCourseWithRelations } from './courseMutations.service';
import { getLeaderMembers } from './leaderMembers.service';
import { getFollowUpUsers, syncFollowUp } from './followup.service';
import { getCircles } from './circles.service';
import { getUsers } from './users.service';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Service layer database & query optimizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveCourseWithRelations batch-inserts new lectures in a single call and updates existing ones', async () => {
    const lectureInserts: unknown[] = [];
    const lectureUpdates: unknown[] = [];
    const lectureDeletes: unknown[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'courses') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: 'course-1' }, error: null }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        } as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'course_lectures') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'lec-1', lecture_number: 1 },
                  { id: 'lec-old', lecture_number: 99 },
                ],
                error: null,
              }),
            })),
          })),
          update: vi.fn((payload: unknown) => {
            lectureUpdates.push(payload);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
          insert: vi.fn((payload: unknown) => {
            lectureInserts.push(payload);
            return Promise.resolve({ error: null });
          }),
          delete: vi.fn(() => ({
            in: vi.fn((_col: string, ids: unknown) => {
              lectureDeletes.push(ids);
              return Promise.resolve({ error: null });
            }),
          })),
        } as unknown as ReturnType<typeof supabase.from>;
      }

      return {
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const resultId = await saveCourseWithRelations({
      courseId: 'course-1',
      course: { name: 'React Course', room: 'lab_1', schedule_time: '10:00' },
      organizers: [],
      marketers: [],
      trainerIds: [],
      lectureDates: ['2026-11-20', '2026-11-22', '2026-11-24', '2026-11-26'],
    });

    expect(resultId).toBe('course-1');
    // Lecture 1 updated, Lectures 2..4 inserted in ONE batch call, old lecture 99 deleted
    expect(lectureUpdates).toHaveLength(1);
    expect(lectureInserts).toHaveLength(1);
    expect(lectureInserts[0]).toHaveLength(3);
    expect(lectureDeletes).toEqual([['lec-old']]);
  });

  it('getLeaderMembers filters activity_submissions by approved status and fetches profiles concurrently', async () => {
    const submissionEqCalls: Array<[string, unknown]> = [];
    let membersQueryStarted = false;
    let volunteersQueryStarted = false;
    let bothStartedBeforeResolve = false;

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        const filters: Array<[string, unknown]> = [];
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn((col: string, val: unknown) => {
            filters.push([col, val]);
            if (col === 'committee_id') membersQueryStarted = true;
            return builder;
          }),
          neq: vi.fn(() => builder),
          is: vi.fn((col: string, val: unknown) => {
            filters.push([col, val]);
            if (col === 'committee_id' && val === null) volunteersQueryStarted = true;
            return builder;
          }),
          order: vi.fn(async () => {
            if (membersQueryStarted && volunteersQueryStarted) {
              bothStartedBeforeResolve = true;
            }
            const isCommitteeQuery = filters.some(([c, v]) => c === 'committee_id' && v === 'comm-1');
            return {
              data: isCommitteeQuery
                ? [{ id: 'm1', email: 'm1@rtc.org', full_name: 'M1', full_name_ar: 'م1', avatar_url: null, phone: null, level: 'active', join_date: '2026-01-01', created_at: '2026-01-01', committee_id: 'comm-1', total_points: 0, activities_count: 0 }]
                : [{ id: 'v1', email: 'v1@rtc.org', full_name: 'V1', full_name_ar: 'م2', avatar_url: null, phone: null, level: 'active', join_date: '2026-01-01', created_at: '2026-01-01', committee_id: null, total_points: 0, activities_count: 0 }],
              error: null,
            };
          }),
        };
        return builder as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'activity_submissions') {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn((col: string, val: unknown) => {
            submissionEqCalls.push([col, val]);
            return builder;
          }),
          in: vi.fn().mockResolvedValue({
            data: [{ volunteer_id: 'm1', points_awarded: 25 }],
            error: null,
          }),
        };
        return builder as unknown as ReturnType<typeof supabase.from>;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await getLeaderMembers('comm-1');
    expect(bothStartedBeforeResolve).toBe(true);
    expect(submissionEqCalls).toContainEqual(['committee_id', 'comm-1']);
    expect(submissionEqCalls).toContainEqual(['status', 'approved']);
    expect(res.members[0]).toMatchObject({ id: 'm1', total_points: 25, activities_count: 1 });
    expect(res.availableVolunteers).toHaveLength(1);
  });

  it('getFollowUpUsers fetches approved and pending records concurrently', async () => {
    const startedStatuses: string[] = [];
    let bothStartedBeforeResolve = false;

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table !== 'users_followup') throw new Error(`Unexpected table: ${table}`);

      let currentStatus = '';
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: unknown) => {
          if (col === 'status') {
            currentStatus = String(val);
            startedStatuses.push(currentStatus);
          }
          return builder;
        }),
        order: vi.fn(() => builder),
        range: vi.fn(() => builder),
        or: vi.fn(() => builder),
        then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
          queueMicrotask(() => {
            if (startedStatuses.includes('approved') && startedStatuses.includes('pending')) {
              bothStartedBeforeResolve = true;
            }
            resolve({
              data: [{ id: currentStatus === 'approved' ? 1 : 2, full_name: currentStatus, phone_1: '01000000000', phone_2: null, branch: null, branch_id: 'b1', created_at: '2026-01-01', status: currentStatus, linked_to: null }],
              error: null,
            });
          });
        },
      };
      return builder as unknown as ReturnType<typeof supabase.from>;
    });

    const users = await getFollowUpUsers({ branchId: 'b1', canViewAllBranches: false });
    expect(bothStartedBeforeResolve).toBe(true);
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.status)).toEqual(['approved', 'pending']);
  });

  it('getCircles fetches quran_circles and quran_teachers concurrently before enrollments', async () => {
    const callOrder: string[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      callOrder.push(table);

      if (table === 'quran_circles') {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'circle-1',
                teacher_id: 'teacher-1',
                schedule: [{ day: 0, time: '18:00' }],
                is_active: true,
                description: null,
                target_group: 'adults',
                beneficiary_gender: 'male',
                quran_circle_organizers: [],
              },
            ],
            error: null,
          }),
        };
        return builder as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'quran_teachers') {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
            resolve({
              data: [{ id: 'teacher-1', name: 'Sheikh Omar', target_gender: 'men', teaching_mode: 'both' }],
              error: null,
            });
          },
        };
        return builder as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'quran_enrollments') {
        const builder = {
          select: vi.fn(() => builder),
          in: vi.fn(() => builder),
          eq: vi.fn().mockResolvedValue({
            data: [{ circle_id: 'circle-1' }, { circle_id: 'circle-1' }],
            error: null,
          }),
        };
        return builder as unknown as ReturnType<typeof supabase.from>;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const circles = await getCircles('branch-1');
    expect(callOrder.slice(0, 2)).toEqual(['quran_circles', 'quran_teachers']);
    expect(callOrder[2]).toBe('quran_enrollments');
    expect(circles).toHaveLength(1);
    expect(circles[0]).toMatchObject({
      id: 'circle-1',
      teacher_name: 'Sheikh Omar',
      enrolled_count: 2,
    });
  });

  it('syncFollowUp orders paginated queries by id, fetches initial tables concurrently, and inserts deduplicated records', async () => {
    const orderCalls: Array<[string, string, unknown]> = [];
    const startedTables: string[] = [];
    let initialFetchesConcurrent = false;
    const insertedFollowUps: unknown[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      startedTables.push(table);

      if (table === 'activity_submissions') {
        const builder = {
          select: vi.fn(() => builder),
          order: vi.fn((col: string, opts: unknown) => {
            orderCalls.push([table, col, opts]);
            return builder;
          }),
          range: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
            queueMicrotask(() => {
              if (
                startedTables.includes('activity_submissions') &&
                startedTables.includes('trainers') &&
                startedTables.includes('profiles') &&
                startedTables.includes('users_followup')
              ) {
                initialFetchesConcurrent = true;
              }
              resolve({
                data: [
                  {
                    id: 'sub-1',
                    guest_name: 'Guest One',
                    guest_phone: '01012345678',
                    volunteer_id: null,
                    trainer_id: null,
                    branch_id: 'b1',
                    location: null,
                  },
                ],
                error: null,
              });
            });
          },
        };
        return builder as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'trainers' || table === 'profiles') {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'users_followup') {
        let mode: 'paginated' | 'dedup' | 'insert' = 'paginated';
        const builder = {
          select: vi.fn(() => builder),
          order: vi.fn((col: string, opts: unknown) => {
            orderCalls.push([table, col, opts]);
            return builder;
          }),
          range: vi.fn(() => builder),
          in: vi.fn(() => {
            mode = 'dedup';
            return builder;
          }),
          insert: vi.fn((rows: unknown) => {
            mode = 'insert';
            insertedFollowUps.push(rows);
            return builder;
          }),
          then: (resolve: (val: { data: unknown[] | null; error: null }) => void) => {
            queueMicrotask(() => {
              if (mode === 'insert') {
                resolve({ data: null, error: null });
                return;
              }
              resolve({ data: [], error: null });
            });
          },
        };
        return builder as unknown as ReturnType<typeof supabase.from>;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await syncFollowUp({
      canViewAllBranches: false,
      branchId: 'b1',
      branches: [],
    });

    expect(initialFetchesConcurrent).toBe(true);
    expect(orderCalls).toContainEqual(['activity_submissions', 'id', { ascending: true }]);
    expect(orderCalls).toContainEqual(['users_followup', 'id', { ascending: true }]);
    expect(result).toEqual({ newCount: 1, cleanedCount: 0 });
    expect(insertedFollowUps).toHaveLength(1);
    expect(insertedFollowUps[0]).toEqual([
      {
        full_name: 'Guest One',
        phone_1: '+201012345678',
        phone_2: null,
        branch_id: 'b1',
        status: 'pending',
      },
    ]);
  });

  it('getUsers fetches profiles and committees concurrently in the first stage', async () => {
    let profilesStarted = false;
    let committeesStarted = false;
    let firstStageConcurrent = false;

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        profilesStarted = true;
        const builder = {
          select: vi.fn(() => builder),
          neq: vi.fn(() => builder),
          order: vi.fn(() => builder),
          range: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          or: vi.fn(() => builder),
          then: (resolve: (val: { data: unknown[]; count: number; error: null }) => void) => {
            queueMicrotask(() => {
              if (profilesStarted && committeesStarted) {
                firstStageConcurrent = true;
              }
              resolve({
                data: [
                  {
                    id: 'u1',
                    email: 'u1@rtc.org',
                    full_name: 'User One',
                    full_name_ar: 'مستخدم 1',
                    avatar_url: null,
                    committee_id: 'c1',
                    branch_id: 'b1',
                    total_points: 10,
                    level: 'under_follow_up',
                    join_date: '2026-01-01',
                    created_at: '2026-01-01',
                    phone: '01000000001',
                    attended_mini_camp: false,
                    attended_camp: false,
                    is_ashbal: false,
                    birth_date: null,
                    last_seen_at: null,
                    is_active: true,
                    auto_dismissal_enabled: true,
                    dismissal_reason: null,
                  },
                ],
                count: 1,
                error: null,
              });
            });
          },
        };
        return builder as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'committees') {
        committeesStarted = true;
        return {
          select: vi.fn(() =>
            new Promise((resolve) => {
              queueMicrotask(() => {
                resolve({
                  data: [{ id: 'c1', name: 'Media', name_ar: 'الميديا' }],
                  error: null,
                });
              });
            }),
          ),
        } as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'user_roles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [{ user_id: 'u1', role: 'volunteer' }], error: null }),
          })),
        } as unknown as ReturnType<typeof supabase.from>;
      }

      if (table === 'activity_submissions') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              neq: vi.fn().mockResolvedValue({ data: [{ volunteer_id: 'u1', status: 'approved' }], error: null }),
            })),
          })),
        } as unknown as ReturnType<typeof supabase.from>;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await getUsers({
      branchId: 'b1',
      canViewAllBranches: false,
      language: 'ar',
      branches: [{ id: 'b1', name: 'Main', name_ar: 'الرئيسي', code: 'main', is_default: true }],
      page: 1,
      pageSize: 50,
    });

    expect(firstStageConcurrent).toBe(true);
    expect(res.totalCount).toBe(1);
    expect(res.users[0]).toMatchObject({
      id: 'u1',
      committee_name: 'الميديا',
      branch_name: 'الرئيسي',
      participation_count: 1,
    });
  });
});
