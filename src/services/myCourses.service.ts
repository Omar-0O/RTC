import { supabase } from '@/integrations/supabase/client';

const MY_COURSE_COLUMNS = 'id, name, trainer_id, trainer_name, trainer_phone, room, schedule_days, schedule_time, schedule_end_time, has_interview, interview_date, total_lectures, start_date, end_date, committee_id, course_lectures(status)';

export async function getMyCourseOverview(userId: string) {
  const [organizers, marketers, trainerResult] = await Promise.all([
    supabase.from('course_organizers').select('course_id').eq('volunteer_id', userId),
    supabase.from('course_marketers').select('course_id').eq('volunteer_id', userId),
    supabase.from('trainers').select('id').eq('user_id', userId).maybeSingle(),
  ]);
  if (organizers.error) throw organizers.error;
  if (marketers.error) throw marketers.error;
  if (trainerResult.error) throw trainerResult.error;

  let trainerCourseIds: string[] = [];
  if (trainerResult.data?.id) {
    const [assigned, primary] = await Promise.all([
      supabase.from('course_trainers').select('course_id').eq('trainer_id', trainerResult.data.id),
      supabase.from('courses').select('id').eq('trainer_id', trainerResult.data.id),
    ]);
    if (assigned.error) throw assigned.error;
    if (primary.error) throw primary.error;
    trainerCourseIds = [...new Set([...(assigned.data ?? []).map(({ course_id }) => course_id), ...(primary.data ?? []).map(({ id }) => id)])];
  }

  const organizerCourseIds = [...new Set([...(organizers.data ?? []).map(({ course_id }) => course_id), ...trainerCourseIds])];
  const marketerCourseIds = [...new Set((marketers.data ?? []).map(({ course_id }) => course_id))];
  const courseIds = [...new Set([...organizerCourseIds, ...marketerCourseIds])];
  if (courseIds.length === 0) return { courses: [], organizerCourseIds, marketerCourseIds };

  const { data, error } = await supabase.from('courses').select(MY_COURSE_COLUMNS).in('id', courseIds).order('start_date', { ascending: false });
  if (error) throw error;
  return { courses: data ?? [], organizerCourseIds, marketerCourseIds };
}

export async function getCourseRooms() {
  const { data, error } = await supabase.from('rooms').select('id, name, name_ar');
  if (error) throw error;
  return data ?? [];
}

export type CourseAdMutation = {
  ad_date?: string;
  poster_url?: string | null;
  content?: string | null;
  poster_done?: boolean;
  content_done?: boolean;
};

export async function createCourseAd(courseId: string, adNumber: number, userId: string | undefined) {
  const { data, error } = await supabase
    .from('course_ads')
    .insert({
      course_id: courseId,
      ad_number: adNumber,
      ad_date: new Date().toISOString().slice(0, 10),
      created_by: userId,
      poster_done: false,
      content_done: false,
    })
    .select('id, course_id, ad_number, ad_date, poster_url, content, poster_done, content_done, created_by, updated_by, created_at, updated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourseAd(adId: string, updates: CourseAdMutation, userId: string | undefined) {
  const { error } = await supabase
    .from('course_ads')
    .update({ ...updates, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', adId);
  if (error) throw error;
}

export async function deleteCourseAd(adId: string) {
  const { error } = await supabase.from('course_ads').delete().eq('id', adId);
  if (error) throw error;
}

export async function leaveCourseRole(courseId: string, userId: string, type: 'organizer' | 'marketer') {
  const table = type === 'organizer' ? 'course_organizers' : 'course_marketers';
  const { error } = await supabase.from(table).delete().match({ course_id: courseId, volunteer_id: userId });
  if (error) throw error;
}

export async function updateCourseLectureStatus(lectureId: string, status: 'scheduled' | 'completed' | 'cancelled') {
  const { error } = await supabase.from('course_lectures').update({ status }).eq('id', lectureId);
  if (error) throw error;
}

export async function toggleCourseAttendance({
  lectureId,
  existingAttendanceId,
  beneficiary,
  userId,
}: {
  lectureId: string;
  existingAttendanceId?: string;
  beneficiary: { name: string; phone: string };
  userId?: string;
}) {
  if (existingAttendanceId) {
    const { error } = await supabase.from('course_attendance').delete().eq('id', existingAttendanceId);
    if (error) throw error;
    return null;
  }

  const { data, error } = await supabase
    .from('course_attendance')
    .insert({ lecture_id: lectureId, student_name: beneficiary.name, student_phone: beneficiary.phone, status: 'present', created_by: userId })
    .select('id, lecture_id, student_name, student_phone, status')
    .single();
  if (error) throw error;
  return data;
}

export async function addCourseBeneficiary(courseId: string, userId: string | undefined, beneficiary: { name: string; phone: string; national_id?: string | null }) {
  const { data, error } = await supabase
    .from('course_beneficiaries')
    .insert({ course_id: courseId, name: beneficiary.name, phone: beneficiary.phone, national_id: beneficiary.national_id || null, created_by: userId })
    .select('id, course_id, name, phone, national_id')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourseBeneficiary(beneficiary: { id: string; name: string; phone: string; national_id?: string | null }) {
  const { error } = await supabase
    .from('course_beneficiaries')
    .update({ name: beneficiary.name, phone: beneficiary.phone, national_id: beneficiary.national_id || null })
    .eq('id', beneficiary.id);
  if (error) throw error;
}

export async function deleteCourseBeneficiary(beneficiaryId: string) {
  const { error } = await supabase.from('course_beneficiaries').delete().eq('id', beneficiaryId);
  if (error) throw error;
}
