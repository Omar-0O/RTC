import { endOfMonth, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  level: string;
  avatar_url: string | null;
  phone: string | null;
}

export type TrainerSummary = {
  ar: string;
  en: string;
  phone: string | null;
  image_url: string | null;
};

type TrainerRow = {
  id: string | null;
  name_ar: string | null;
  name_en: string | null;
  phone: string | null;
  image_url: string | null;
};

export interface Submission {
  id: string;
  volunteer_id: string | null;
  activity_type_id: string;
  submitted_at: string;
  created_at: string;
  points_awarded: number;
  status: string;
  location?: string;
  wore_vest?: boolean;
  description?: string;
  proof_url?: string;
  participant_type?: 'volunteer' | 'guest' | 'trainer';
  guest_name?: string | null;
  guest_phone?: string | null;
  trainer_id?: string | null;
  profiles: Profile | null;
  activity_types: {
    name: string;
    name_ar: string;
  };
  committees: {
    name: string;
    name_ar: string;
  };
}

export interface GuestParticipation {
  id: string;
  name: string;
  phone: string | null;
  source: 'event' | 'caravan' | 'call';
  source_name: string;
  date: string;
  type: 'guest' | 'trainer';
}

type SourceRelation = {
  name: string | null;
  date: string | null;
  branch_id?: string | null;
};

type GuestParticipantRow<TSource extends string> = {
  id: string;
  name: string | null;
  phone: string | null;
} & Record<TSource, SourceRelation | SourceRelation[] | null>;

const getSourceRelation = <TSource extends string>(
  row: GuestParticipantRow<TSource>,
  sourceKey: TSource,
) => {
  const source = row[sourceKey];
  return Array.isArray(source) ? source[0] : source;
};

const getMonthRange = (selectedMonth: string) => {
  const [year, month] = selectedMonth.split('-');
  const monthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return {
    startDate: startOfMonth(monthDate),
    endDate: endOfMonth(monthDate),
  };
};

async function getAdminIds() {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');

  if (error) throw error;
  return new Set(data?.map(role => role.user_id) || []);
}

export async function getHrVolunteers(activeBranchId?: string): Promise<Profile[]> {
  const [adminIds, profilesResult] = await Promise.all([
    getAdminIds(),
    (() => {
      const profilesQuery = supabase
        .from('profiles')
        .select('id, full_name, full_name_ar, level, avatar_url, phone');

      return (activeBranchId ? profilesQuery.eq('branch_id', activeBranchId) : profilesQuery)
        .order('full_name', { ascending: true });
    })(),
  ]);

  if (profilesResult.error) throw profilesResult.error;

  return (profilesResult.data ?? []).filter(profile => !adminIds.has(profile.id));
}

export async function getTrainerSummaries(activeBranchId?: string): Promise<Record<string, TrainerSummary>> {
  const trainersQuery = supabase
    .from('trainers')
    .select('id, user_id, name_ar, name_en, phone, image_url');

  const { data, error } = await (
    activeBranchId
      ? trainersQuery.eq('branch_id', activeBranchId)
      : trainersQuery
  );

  if (error) throw error;

  const map: Record<string, TrainerSummary> = {};
  (data as TrainerRow[] | null)?.forEach((trainer) => {
    if (!trainer.id) return;
    map[trainer.id] = {
      ar: trainer.name_ar || '',
      en: trainer.name_en || '',
      phone: trainer.phone,
      image_url: trainer.image_url,
    };
  });

  return map;
}

export async function getMonthlySubmissions({
  selectedMonth,
  activeBranchId,
}: {
  selectedMonth: string;
  activeBranchId?: string;
}): Promise<Submission[]> {
  const { startDate, endDate } = getMonthRange(selectedMonth);
  const query = supabase
    .from('activity_submissions')
    .select(`
      id,
      volunteer_id,
      activity_type_id,
      submitted_at,
      created_at,
      points_awarded,
      status,
      location,
      wore_vest,
      description,
      proof_url,
      participant_type,
      guest_name,
      guest_phone,
      trainer_id,
      profiles:profiles!activity_submissions_volunteer_id_fkey (id, full_name, full_name_ar, level, avatar_url, phone),
      activity_types (name, name_ar),
      committees (name, name_ar)
    `)
    .gte('submitted_at', startDate.toISOString())
    .lte('submitted_at', endDate.toISOString());

  const submissionsRequest = (activeBranchId ? query.eq('branch_id', activeBranchId) : query)
    .order('created_at', { ascending: false });

  const [{ data, error }, adminIds] = await Promise.all([
    submissionsRequest,
    getAdminIds(),
  ]);

  if (error) throw error;

  return ((data ?? []) as Submission[]).filter((submission) => (
    submission.volunteer_id ? !adminIds.has(submission.volunteer_id) : true
  ));
}

export async function getGuestParticipations({
  selectedMonth,
  activeBranchId,
}: {
  selectedMonth: string;
  activeBranchId?: string;
}): Promise<GuestParticipation[]> {
  const { startDate, endDate } = getMonthRange(selectedMonth);
  const startDay = startDate.toISOString().split('T')[0];
  const endDay = endDate.toISOString().split('T')[0];
  const guestData: GuestParticipation[] = [];

  const eventQuery = supabase
    .from('event_participants')
    .select(`
      id,
      name,
      phone,
      is_volunteer,
      events!inner (name, date, branch_id)
    `)
    .eq('is_volunteer', false)
    .gte('events.date', startDay)
    .lte('events.date', endDay);

  const caravanQuery = supabase
    .from('caravan_participants')
    .select(`
      id,
      name,
      phone,
      is_volunteer,
      caravans!inner (name, date, branch_id)
    `)
    .eq('is_volunteer', false)
    .gte('caravans.date', startDay)
    .lte('caravans.date', endDay);

  const callParticipantsRequest = !activeBranchId
    ? supabase
      .from('ethics_calls_participants')
      .select(`
        id,
        name,
        phone,
        is_volunteer,
        ethics_calls!inner (name, date)
      `)
      .eq('is_volunteer', false)
      .gte('ethics_calls.date', startDay)
      .lte('ethics_calls.date', endDay)
    : Promise.resolve({ data: null, error: null });

  const [
    { data: eventParticipants, error: eventError },
    { data: caravanParticipants, error: caravanError },
    { data: callParticipants, error: callError },
  ] = await Promise.all([
    activeBranchId ? eventQuery.eq('events.branch_id', activeBranchId) : eventQuery,
    activeBranchId ? caravanQuery.eq('caravans.branch_id', activeBranchId) : caravanQuery,
    callParticipantsRequest,
  ]);

  if (eventError) throw eventError;
  if (caravanError) throw caravanError;
  if (callError) throw callError;

  (eventParticipants as GuestParticipantRow<'events'>[] | null)?.forEach((participant) => {
    const event = getSourceRelation(participant, 'events');
    if (!event) return;
    guestData.push({
      id: participant.id,
      name: participant.name || '',
      phone: participant.phone,
      source: 'event',
      source_name: event.name || '',
      date: event.date || '',
      type: 'guest',
    });
  });

  (caravanParticipants as GuestParticipantRow<'caravans'>[] | null)?.forEach((participant) => {
    const caravan = getSourceRelation(participant, 'caravans');
    if (!caravan) return;
    guestData.push({
      id: participant.id,
      name: participant.name || '',
      phone: participant.phone,
      source: 'caravan',
      source_name: caravan.name || '',
      date: caravan.date || '',
      type: 'guest',
    });
  });

  (callParticipants as GuestParticipantRow<'ethics_calls'>[] | null)?.forEach((participant) => {
    const ethicsCall = getSourceRelation(participant, 'ethics_calls');
    if (!ethicsCall) return;
    guestData.push({
      id: participant.id,
      name: participant.name || '',
      phone: participant.phone,
      source: 'call',
      source_name: ethicsCall.name || '',
      date: ethicsCall.date || '',
      type: 'guest',
    });
  });

  return guestData;
}
