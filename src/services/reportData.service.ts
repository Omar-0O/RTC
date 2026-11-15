import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export const REPORT_PROFILE_COLUMNS = 'id, full_name, full_name_ar, email, phone, total_points, level, committee_id, attended_mini_camp, attended_camp';
export const REPORT_COMMITTEE_COLUMNS = 'id, name, name_ar';
export const REPORT_ACTIVITY_TYPE_COLUMNS = 'id, name, name_ar, points';
export const REPORT_USER_ROLE_COLUMNS = 'user_id, role';
export const REPORT_TRAINER_COLUMNS = 'id, user_id, name_en, name_ar, phone';
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

export async function fetchAllReportActivitySubmissions(pageSize = 1000) {
  const firstPageRes = await supabase
    .from('activity_submissions')
    .select(REPORT_ACTIVITY_SUBMISSION_COLUMNS, { count: 'exact' })
    .range(0, pageSize - 1);

  if (firstPageRes.error) {
    return {
      data: [] as ReportActivitySubmission[],
      error: firstPageRes.error,
    };
  }

  const firstBatch = (firstPageRes.data || []) as ReportActivitySubmission[];
  const totalCount = firstPageRes.count;

  if (totalCount === null || totalCount <= firstBatch.length) {
    return { data: firstBatch, error: null };
  }

  const pagePromises = [];
  for (let from = firstBatch.length; from < totalCount; from += pageSize) {
    const to = Math.min(from + pageSize - 1, totalCount - 1);
    pagePromises.push(
      supabase
        .from('activity_submissions')
        .select(REPORT_ACTIVITY_SUBMISSION_COLUMNS)
        .range(from, to),
    );
  }

  const results = await Promise.all(pagePromises);
  const submissions: ReportActivitySubmission[] = [...firstBatch];

  for (const res of results) {
    if (res.error) return { data: submissions, error: res.error };
    if (res.data) submissions.push(...(res.data as ReportActivitySubmission[]));
  }

  return { data: submissions, error: null };
}

