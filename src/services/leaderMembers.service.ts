import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ActivitySubmissionRow = Database['public']['Tables']['activity_submissions']['Row'];

export type LeaderMember = Pick<
  ProfileRow,
  'id' | 'email' | 'full_name' | 'full_name_ar' | 'avatar_url' | 'phone'
  | 'level' | 'join_date' | 'created_at' | 'committee_id' | 'total_points' | 'activities_count'
>;

type CommitteeSubmission = Pick<ActivitySubmissionRow, 'volunteer_id' | 'points_awarded'>;

const PROFILE_COLUMNS = [
  'id',
  'email',
  'full_name',
  'full_name_ar',
  'avatar_url',
  'phone',
  'level',
  'join_date',
  'created_at',
  'committee_id',
  'total_points',
  'activities_count',
].join(', ');

export type LeaderMembersData = {
  members: LeaderMember[];
  availableVolunteers: LeaderMember[];
};

export async function getLeaderMembers(committeeId: string): Promise<LeaderMembersData> {
  const membersResult = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('committee_id', committeeId)
    .order('full_name');

  if (membersResult.error) throw membersResult.error;

  const members = (membersResult.data ?? []) as LeaderMember[];
  const memberIds = members.map(({ id }) => id);

  const [submissionsResult, volunteersResult] = await Promise.all([
    memberIds.length > 0
      ? supabase
        .from('activity_submissions')
        .select('volunteer_id, points_awarded')
        .eq('committee_id', committeeId)
        .in('volunteer_id', memberIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .neq('full_name', 'RTC Admin')
      .is('committee_id', null)
      .order('full_name'),
  ]);

  if (submissionsResult.error) throw submissionsResult.error;
  if (volunteersResult.error) throw volunteersResult.error;

  const statsByVolunteer = new Map<string, { points: number; activities: number }>();
  (submissionsResult.data as CommitteeSubmission[] ?? []).forEach((submission) => {
    if (!submission.volunteer_id) return;

    const stats = statsByVolunteer.get(submission.volunteer_id) ?? { points: 0, activities: 0 };
    stats.points += submission.points_awarded ?? 0;
    stats.activities += 1;
    statsByVolunteer.set(submission.volunteer_id, stats);
  });

  return {
    members: members.map((member) => {
      const stats = statsByVolunteer.get(member.id) ?? { points: 0, activities: 0 };
      return { ...member, total_points: stats.points, activities_count: stats.activities };
    }),
    availableVolunteers: (volunteersResult.data ?? []) as LeaderMember[],
  };
}

export async function addMembersToCommittee(committeeId: string, memberIds: string[]): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ committee_id: committeeId })
    .in('id', memberIds)
    .is('committee_id', null)
    .select('id');

  if (error) throw error;
  if ((data?.length ?? 0) !== memberIds.length) {
    throw new Error('One or more volunteers were assigned to another committee. Refresh and try again.');
  }
}

export async function removeMemberFromCommittee(committeeId: string, memberId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ committee_id: null })
    .eq('id', memberId)
    .eq('committee_id', committeeId)
    .select('id');

  if (error) throw error;
  if (!data?.length) throw new Error('Member is no longer assigned to this committee. Refresh and try again.');
}
