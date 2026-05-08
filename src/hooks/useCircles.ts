/**
 * useCircles — React Query hooks (thin layer over circles.service.ts).
 *
 * Architecture: Component → Hook → Service → Supabase
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as circlesService from '@/services/circles.service';
import { shouldRetry } from '@/services/api';

// Re-export all types from service
export type {
  Teacher, Volunteer, Organizer, ScheduleItem, QuranCircle,
  Beneficiary, Session, Attendance, Guest, QuranCircleMarketer,
  CircleAd, SaveCirclePayload, SaveAttendancePayload,
} from '@/services/circles.service';

// ─── Cache Timing ───────────────────────────────────────────────────

const CACHE = {
  circles:       { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  teachers:      { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 }, // Rarely changes
  volunteers:    { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  beneficiaries: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  detail:        { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
} as const;

// ─── Queries ────────────────────────────────────────────────────────

export function useCirclesList() {
  return useQuery({
    queryKey: queryKeys.circles.list(),
    queryFn: circlesService.getCircles,
    ...CACHE.circles,
    retry: shouldRetry,
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: queryKeys.teachers.list(),
    queryFn: circlesService.getTeachers,
    ...CACHE.teachers,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useVolunteers() {
  return useQuery({
    queryKey: queryKeys.volunteers.list(),
    queryFn: circlesService.getVolunteers,
    ...CACHE.volunteers,
    retry: shouldRetry,
  });
}

export function useAllBeneficiaries() {
  return useQuery({
    queryKey: queryKeys.beneficiaries.list(),
    queryFn: circlesService.getAllBeneficiaries,
    ...CACHE.beneficiaries,
    retry: shouldRetry,
  });
}

export function useCircleEnrollments(circleId: string | null) {
  return useQuery({
    queryKey: queryKeys.circles.enrollments(circleId || ''),
    queryFn: () => circlesService.getCircleEnrollments(circleId!),
    enabled: !!circleId,
    ...CACHE.detail,
    retry: shouldRetry,
  });
}

export function useCircleSessions(circleId: string | null) {
  return useQuery({
    queryKey: queryKeys.circles.sessions(circleId || ''),
    queryFn: () => circlesService.getCircleSessions(circleId!),
    enabled: !!circleId,
    ...CACHE.detail,
    retry: shouldRetry,
  });
}

export function useCircleAttendance(circleId: string | null, sessionIds: string[]) {
  return useQuery({
    queryKey: queryKeys.circles.attendance(circleId || ''),
    queryFn: () => circlesService.getCircleAttendance(sessionIds),
    enabled: !!circleId && sessionIds.length > 0,
    ...CACHE.detail,
    retry: shouldRetry,
  });
}

export function useCircleAds(circleId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.circles.ads(circleId || ''),
    queryFn: () => circlesService.getCircleAds(circleId!),
    enabled: !!circleId && enabled,
    ...CACHE.detail,
    retry: shouldRetry,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────

export function useSaveCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: circlesService.saveCircle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.circles.all }); },
  });
}

export function useDeleteCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: circlesService.deleteCircle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.circles.all }); },
  });
}

export function useEnrollBeneficiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ circleId, beneficiaryId }: { circleId: string; beneficiaryId: string }) =>
      circlesService.enrollBeneficiary(circleId, beneficiaryId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.circles.enrollments(v.circleId) });
      qc.invalidateQueries({ queryKey: queryKeys.circles.list() });
    },
  });
}

export function useUnenrollBeneficiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ circleId, beneficiaryId }: { circleId: string; beneficiaryId: string }) =>
      circlesService.unenrollBeneficiary(circleId, beneficiaryId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.circles.enrollments(v.circleId) });
      qc.invalidateQueries({ queryKey: queryKeys.circles.list() });
    },
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: circlesService.createSession,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.circles.sessions(v.circleId) });
      qc.invalidateQueries({ queryKey: queryKeys.circles.attendance(v.circleId) });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, circleId }: { sessionId: string; circleId: string }) =>
      circlesService.deleteSession(sessionId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.circles.sessions(v.circleId) });
      qc.invalidateQueries({ queryKey: queryKeys.circles.attendance(v.circleId) });
    },
  });
}

export function useSaveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: circlesService.saveAttendance,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.circles.sessions(v.circleId) });
      qc.invalidateQueries({ queryKey: queryKeys.circles.attendance(v.circleId) });
    },
  });
}

export function useAddOrganizerToCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ circleId, organizer }: { circleId: string; organizer: circlesService.Organizer }) => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.from('quran_circle_organizers').insert({
        circle_id: circleId, volunteer_id: organizer.volunteer_id, name: organizer.name, phone: organizer.phone,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.circles.all }); },
  });
}

export function useRemoveOrganizerFromCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ circleId, volunteerId }: { circleId: string; volunteerId: string }) => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.from('quran_circle_organizers').delete().eq('circle_id', circleId).eq('volunteer_id', volunteerId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.circles.all }); },
  });
}
