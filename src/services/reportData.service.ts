import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export const REPORT_PROFILE_COLUMNS = 'id, full_name, full_name_ar, email, phone, total_points, level, committee_id, attended_mini_camp, attended_camp';
export const REPORT_COMMITTEE_COLUMNS = 'id, name, name_ar';
export const REPORT_ACTIVITY_TYPE_COLUMNS = 'id, name, name_ar, points';
export const REPORT_USER_ROLE_COLUMNS = 'user_id, role';
export const REPORT_ACTIVITY_SUBMISSION_COLUMNS = 'id, volunteer_id, status, points_awarded, submitted_at, activity_type_id, location, wore_vest, committee_id, description, proof_url, participants_count, reviewed_by, reviewed_at, rejection_reason, created_at, participant_type, guest_name, guest_phone, trainer_id';

export type ReportActivitySubmission = Pick<
  Database['public']['Tables']['activity_submissions']['Row'],
  | 'id'
  | 'volunteer_id'
  | 'status'
  | 'points_awarded'
  | 'submitted_at'
  | 'activity_type_id'
  | 'location'
  | 'wore_vest'
  | 'committee_id'
  | 'description'
  | 'proof_url'
  | 'participants_count'
  | 'reviewed_by'
  | 'reviewed_at'
  | 'rejection_reason'
  | 'created_at'
  | 'participant_type'
  | 'guest_name'
  | 'guest_phone'
  | 'trainer_id'
>;

export async function fetchAllReportActivitySubmissions(pageSize = 500) {
  const { count, error: countError } = await supabase
    .from('activity_submissions')
    .select('id', { count: 'exact', head: true });

  if (countError || count === null) {
    const fallback = await supabase
      .from('activity_submissions')
      .select(REPORT_ACTIVITY_SUBMISSION_COLUMNS);

    return {
      data: (fallback.data || []) as ReportActivitySubmission[],
      error: fallback.error,
    };
  }

  const submissions: ReportActivitySubmission[] = [];

  for (let from = 0; from < count; from += pageSize) {
    const to = Math.min(from + pageSize - 1, count - 1);
    const { data, error } = await supabase
      .from('activity_submissions')
      .select(REPORT_ACTIVITY_SUBMISSION_COLUMNS)
      .range(from, to);

    if (error) return { data: submissions, error };
    if (data) submissions.push(...(data as ReportActivitySubmission[]));
  }

  return { data: submissions, error: null };
}
