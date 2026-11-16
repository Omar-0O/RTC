import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type CourseRelationInput = {
  volunteer_id: string | null;
  name: string;
  phone: string | null;
};

type CoursePayload = {
  name?: string;
  trainer_id?: string | null;
  trainer_name?: string | null;
  trainer_phone?: string | null;
  room?: string;
  schedule_days?: string[];
  schedule_time?: string | null;
  schedule_end_time?: string | null;
  has_interview?: boolean;
  interview_date?: string | null;
  total_lectures?: number;
  start_date?: string | null;
  end_date?: string | null;
  has_certificates?: boolean;
  certificate_status?: string | null;
  created_by?: string | null;
  committee_id?: string | null;
  branch_id?: string | null;
};

async function replaceRelation(
  remove: () => PromiseLike<{ error: unknown }>,
  insert?: () => PromiseLike<{ error: unknown }>,
): Promise<void> {
  const { error: deleteError } = await remove();
  if (deleteError) throw deleteError;
  if (insert) {
    const { error: insertError } = await insert();
    if (insertError) throw insertError;
  }
}

async function syncCourseLectures(courseId: string, lectureDates: string[]): Promise<void> {
  if (lectureDates.length === 0) return;

  const { data: existingLectures, error: existingLecturesError } = await supabase
    .from('course_lectures')
    .select('id, lecture_number')
    .eq('course_id', courseId)
    .order('lecture_number', { ascending: true });

  if (existingLecturesError) throw existingLecturesError;

  const existingMap = new Map((existingLectures || []).map((l) => [l.lecture_number, l.id]));
  const keptExistingIds = new Set<string>();
  const updatePromises: Array<PromiseLike<{ error: unknown }>> = [];
  const newLectureRows: Array<{
    course_id: string;
    lecture_number: number;
    date: string;
    status: string;
  }> = [];

  for (let i = 0; i < lectureDates.length; i++) {
    const lectureNum = i + 1;
    const date = lectureDates[i];
    const existingId = existingMap.get(lectureNum);

    if (existingId) {
      keptExistingIds.add(existingId);
      updatePromises.push(
        supabase
          .from('course_lectures')
          .update({ date, lecture_number: lectureNum })
          .eq('id', existingId),
      );
    } else {
      newLectureRows.push({
        course_id: courseId,
        lecture_number: lectureNum,
        date,
        status: 'scheduled',
      });
    }
  }

  const idsToDelete = (existingLectures || [])
    .map((l) => l.id)
    .filter((id) => !keptExistingIds.has(id));

  const lectureOps: Array<PromiseLike<{ error: unknown }>> = [
    ...updatePromises,
    ...(newLectureRows.length > 0
      ? [supabase.from('course_lectures').insert(newLectureRows)]
      : []),
    ...(idsToDelete.length > 0
      ? [supabase.from('course_lectures').delete().in('id', idsToDelete)]
      : []),
  ];

  const lectureResults = await Promise.all(lectureOps);
  for (const res of lectureResults) {
    if (res.error) throw res.error;
  }
}

export async function saveCourseWithRelations({
  courseId,
  course,
  organizers,
  marketers,
  trainerIds,
  lectureDates,
  adDates = [],
}: {
  courseId: string | null;
  course: Json;
  organizers: CourseRelationInput[];
  marketers: CourseRelationInput[];
  trainerIds: string[];
  lectureDates: string[];
  adDates?: string[];
}): Promise<string> {
  const c = course as CoursePayload;

  const coursePayload = {
    name: c.name || '',
    trainer_id: c.trainer_id || null,
    trainer_name: c.trainer_name || '',
    trainer_phone: c.trainer_phone || null,
    room: c.room || '',
    schedule_days: c.schedule_days || [],
    schedule_time: c.schedule_time,
    schedule_end_time: c.schedule_end_time || null,
    has_interview: !!c.has_interview,
    interview_date: c.interview_date || null,
    total_lectures: Number(c.total_lectures) || 8,
    start_date: c.start_date || null,
    end_date: c.end_date || null,
    has_certificates: !!c.has_certificates,
    certificate_status: c.certificate_status || 'pending',
    created_by: c.created_by || null,
    committee_id: c.committee_id || null,
    branch_id: c.branch_id || null,
  };

  let targetCourseId = courseId;

  if (!targetCourseId) {
    const { data: inserted, error: insertError } = await supabase
      .from('courses')
      .insert(coursePayload)
      .select('id')
      .single();

    if (insertError) throw insertError;
    targetCourseId = inserted.id;
  } else {
    const updatePayload = {
      name: c.name || '',
      trainer_id: c.trainer_id || null,
      trainer_name: c.trainer_name || '',
      trainer_phone: c.trainer_phone || null,
      room: c.room || '',
      schedule_days: c.schedule_days || [],
      schedule_time: c.schedule_time,
      schedule_end_time: c.schedule_end_time || null,
      has_interview: !!c.has_interview,
      interview_date: c.interview_date || null,
      total_lectures: Number(c.total_lectures) || 8,
      start_date: c.start_date || null,
      end_date: c.end_date || null,
      has_certificates: !!c.has_certificates,
      certificate_status: c.certificate_status || 'pending',
      committee_id: c.committee_id || null,
      updated_at: new Date().toISOString(),
    };

    if (c.created_by) updatePayload.created_by = c.created_by;
    if (c.branch_id) updatePayload.branch_id = c.branch_id;

    const { error: updateError } = await supabase
      .from('courses')
      .update(updatePayload)
      .eq('id', targetCourseId);

    if (updateError) throw updateError;
  }

  const organizerRows = organizers.map((org) => ({
    course_id: targetCourseId!,
    volunteer_id: org.volunteer_id || null,
    name: org.name,
    phone: org.phone || null,
  }));

  const marketerRows = marketers.map((mkt) => ({
    course_id: targetCourseId!,
    volunteer_id: mkt.volunteer_id || null,
    name: mkt.name,
    phone: mkt.phone || null,
  }));

  const trainerRows = trainerIds.map((tId) => ({
    course_id: targetCourseId!,
    trainer_id: tId,
  }));

  const adRows = !courseId && adDates.length > 0
    ? adDates.map((d, idx) => ({
      course_id: targetCourseId!,
      ad_number: idx + 1,
      ad_date: d,
      created_by: c.created_by || null,
    }))
    : [];

  await Promise.all([
    replaceRelation(
      () => supabase.from('course_organizers').delete().eq('course_id', targetCourseId!),
      organizerRows.length > 0 ? () => supabase.from('course_organizers').insert(organizerRows) : undefined,
    ),
    replaceRelation(
      () => supabase.from('course_marketers').delete().eq('course_id', targetCourseId!),
      marketerRows.length > 0 ? () => supabase.from('course_marketers').insert(marketerRows) : undefined,
    ),
    replaceRelation(
      () => supabase.from('course_trainers').delete().eq('course_id', targetCourseId!),
      trainerRows.length > 0 ? () => supabase.from('course_trainers').insert(trainerRows) : undefined,
    ),
    syncCourseLectures(targetCourseId!, lectureDates),
    ...(adRows.length > 0
      ? [
        (async () => {
          const { error } = await supabase.from('course_ads').insert(adRows);
          if (error) throw error;
        })(),
      ]
      : []),
  ]);

  return targetCourseId;
}

