import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateUserPayload } from './users.service';

const { mockSelect, mockEq, mockUpdate, mockFrom } = vi.hoisted(() => {
  const select = vi.fn();
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return {
    mockSelect: select,
    mockEq: eq,
    mockUpdate: update,
    mockFrom: from,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

const basePayload: UpdateUserPayload = {
  userId: 'u1',
  fullName: 'Test Volunteer',
  fullNameAr: 'متطوع تجريبي',
  email: 'volunteer@rtc.org',
  phone: '01000000000',
  committeeId: 'c2',
  branchId: 'b1',
  level: 'under_follow_up',
  attendedMiniCamp: true,
  attendedCamp: false,
  isAshbal: false,
  autoDismissalEnabled: false,
  joinDate: '2026-01-01',
  birthDate: '2000-01-01',
  role: 'volunteer',
  previousRole: 'volunteer',
  avatarFile: null,
};

describe('users.service schema-cache fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFrom.mockClear();
    mockUpdate.mockClear();
    mockEq.mockReset();
    mockSelect.mockReset();

    mockEq.mockImplementation(() => ({
      select: mockSelect,
    }));
  });

  it('retries updateUser without auto_dismissal_enabled on PGRST204 schema cache error and caches fallback for session', async () => {
    const { updateUser } = await import('./users.service');

    // First call fails with PostgREST PGRST204 schema cache error
    mockSelect
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'auto_dismissal_enabled' column of 'profiles' in the schema cache",
        },
      })
      // Fallback retry without auto_dismissal_enabled succeeds
      .mockResolvedValueOnce({
        data: [{ id: 'u1', committee_id: 'c2' }],
        error: null,
      })
      // Second updateUser call in same module instance succeeds on first attempt
      .mockResolvedValueOnce({
        data: [{ id: 'u1', committee_id: 'c3' }],
        error: null,
      });

    await expect(updateUser(basePayload)).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[0][0]).toHaveProperty('auto_dismissal_enabled', false);
    expect(mockUpdate.mock.calls[0][0]).toHaveProperty('committee_id', 'c2');
    expect(mockUpdate.mock.calls[1][0]).not.toHaveProperty('auto_dismissal_enabled');
    expect(mockUpdate.mock.calls[1][0]).toHaveProperty('committee_id', 'c2');

    // Subsequent call in same session skips auto_dismissal_enabled from the start
    await expect(
      updateUser({ ...basePayload, committeeId: 'c3', autoDismissalEnabled: true })
    ).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockUpdate.mock.calls[2][0]).not.toHaveProperty('auto_dismissal_enabled');
    expect(mockUpdate.mock.calls[2][0]).toHaveProperty('committee_id', 'c3');
  });

  it('throws non-missing-column errors from updateUser instead of retrying silently', async () => {
    const { updateUser } = await import('./users.service');

    mockSelect.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy',
      },
    });

    await expect(updateUser(basePayload)).rejects.toMatchObject({
      code: '42501',
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('falls back cleanly in toggleUserActive on PGRST204 / 42703 and skips dismissal columns afterward', async () => {
    const { toggleUserActive } = await import('./users.service');

    mockEq
      // First attempt includes dismissal_reason & dismissed_at -> fails with 42703
      .mockResolvedValueOnce({
        error: {
          code: '42703',
          message: 'column profiles.dismissal_reason does not exist',
        },
      })
      // Fallback attempt updates only is_active -> succeeds
      .mockResolvedValueOnce({
        error: null,
      })
      // Subsequent call in same session directly updates only is_active
      .mockResolvedValueOnce({
        error: null,
      });

    await expect(toggleUserActive('u1', false)).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({
      is_active: false,
      dismissal_reason: 'manual',
    });
    expect(mockUpdate.mock.calls[0][0]).toHaveProperty('dismissed_at');
    expect(mockUpdate.mock.calls[1][0]).toEqual({ is_active: false });

    await expect(toggleUserActive('u1', true)).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockUpdate.mock.calls[2][0]).toEqual({ is_active: true });
  });
});
