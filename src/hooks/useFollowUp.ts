/**
 * useFollowUp — React Query hooks (thin layer over followup.service.ts).
 *
 * Architecture: Component → Hook → Service → Supabase
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as followupService from '@/services/followup.service';
import { shouldRetry } from '@/services/api';

// Re-export types
export type {
  FollowUpUser, FetchFollowUpOptions, AddFollowUpPayload,
  EditFollowUpPayload, SyncFollowUpOptions,
} from '@/services/followup.service';

// ─── Cache Timing ───────────────────────────────────────────────────

const CACHE = {
  followUp: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
} as const;

// ─── Queries ────────────────────────────────────────────────────────

export function useFollowUpUsers(opts: followupService.FetchFollowUpOptions) {
  return useQuery({
    queryKey: queryKeys.followUp.list({
      branchId: opts.branchId,
      canViewAll: opts.canViewAllBranches,
    }),
    queryFn: () => followupService.getFollowUpUsers(opts),
    ...CACHE.followUp,
    retry: shouldRetry,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────

export function useAddFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: followupService.addFollowUp,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.followUp.all }); },
  });
}

export function useEditFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: followupService.editFollowUp,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.followUp.all }); },
  });
}

export function useApproveFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: followupService.approveFollowUp,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.followUp.all }); },
  });
}

export function useRejectFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: followupService.rejectFollowUp,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.followUp.all }); },
  });
}

export function useSyncFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: followupService.syncFollowUp,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.followUp.all }); },
  });
}
