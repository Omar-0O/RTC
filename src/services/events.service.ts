import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];

export interface EventCommittee {
  id: string;
  name: string;
  name_ar: string;
}

export interface EventSummary {
  id: string;
  name: string;
  type: string;
  location: string;
  date: string;
  time: string | null;
  description: string | null;
  created_by: string;
  committee_id: string | null;
  committee_name?: string;
  participants_count?: number;
}

export interface EventParticipant {
  id?: string;
  volunteer_id?: string;
  name: string;
  phone: string;
  is_volunteer: boolean;
}

export interface EventVolunteer {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url?: string | null;
}

type EventWithCounts = Tables['events']['Row'] & {
  committees?: { name: string; name_ar: string } | null;
  event_participants?: { count: number }[] | null;
};

type EventParticipantRow = Tables['event_participants']['Row'];

type BranchScopedQueryParams = {
  activeBranchId?: string;
  canViewAllBranches: boolean;
};

export async function getEventsCommitteeId() {
  const { data, error } = await supabase
    .from('committees')
    .select('id')
    .ilike('name', 'Events')
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function getEventCommittees(): Promise<EventCommittee[]> {
  const { data, error } = await supabase
    .from('committees')
    .select('id, name, name_ar')
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function getEventVolunteers({
  activeBranchId,
  canViewAllBranches,
}: BranchScopedQueryParams): Promise<EventVolunteer[]> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url')
    .order('full_name');

  if (canViewAllBranches && activeBranchId) {
    query = query.eq('branch_id', activeBranchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name || 'Unknown',
    phone: profile.phone,
    avatar_url: profile.avatar_url,
  }));
}

export async function getEventSummaries({
  activeBranchId,
  canViewAllBranches,
  committeeId,
}: BranchScopedQueryParams & {
  committeeId?: string;
}): Promise<EventSummary[]> {
  let query = supabase
    .from('events')
    .select(`
      *,
      committees(name, name_ar),
      event_participants (count)
    `)
    .order('date', { ascending: false });

  if (canViewAllBranches && activeBranchId) {
    query = query.eq('branch_id', activeBranchId);
  }

  if (committeeId) {
    query = query.eq('committee_id', committeeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as EventWithCounts[]).map((event) => ({
    ...event,
    committee_name: event.committees?.name_ar || event.committees?.name || '',
    participants_count: event.event_participants?.[0]?.count || 0,
  }));
}

export async function getEventParticipants(eventId: string): Promise<EventParticipant[]> {
  const { data, error } = await supabase
    .from('event_participants')
    .select('*')
    .eq('event_id', eventId);

  if (error) throw error;

  return ((data ?? []) as EventParticipantRow[]).map((participant) => ({
    id: participant.id,
    volunteer_id: participant.volunteer_id ?? undefined,
    name: participant.name,
    phone: participant.phone || '',
    is_volunteer: Boolean(participant.is_volunteer),
  }));
}
