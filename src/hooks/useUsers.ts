/**
 * useUsers — React Query hooks (thin layer over users.service.ts).
 *
 * Architecture: Component → Hook → Service → Supabase
 *
 * Hooks handle:  query keys, caching config, cache invalidation
 * Services handle: Supabase calls, data transformation, error handling
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as usersService from '@/services/users.service';
import * as committeesService from '@/services/committees.service';
import { shouldRetry } from '@/services/api';

// Re-export types so consumers don't need to import from services directly
export type { UserWithDetails, FetchUsersOptions, UsersResult, CreateUserPayload, UpdateUserPayload } from '@/services/users.service';
export type { Committee } from '@/services/committees.service';

// ─── Cache Timing Constants ─────────────────────────────────────────

const CACHE = {
  users: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  committees: { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }, // Static data — long cache
} as const;

// ─── Queries ────────────────────────────────────────────────────────

export function useUsers(opts: usersService.FetchUsersOptions) {
  return useQuery({
    queryKey: queryKeys.users.list({
      branchId: opts.branchId,
      page: opts.page,
      pageSize: opts.pageSize,
    }),
    queryFn: () => usersService.getUsers(opts),
    staleTime: CACHE.users.staleTime,
    gcTime: CACHE.users.gcTime,
    retry: shouldRetry,
  });
}

export function useCommittees() {
  return useQuery({
    queryKey: queryKeys.committees.list(),
    queryFn: committeesService.getCommittees,
    staleTime: CACHE.committees.staleTime,
    gcTime: CACHE.committees.gcTime,
    refetchOnWindowFocus: false,  // Static data — never refetch on focus
    retry: shouldRetry,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersService.createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersService.updateUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersService.deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      usersService.toggleUserActive(userId, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      usersService.updateUserRole(userId, newRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
