import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type CourseRelationInput = {
  volunteer_id: string | null;
  name: string;
  phone: string | null;
};

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
  const c = course as Record<string, any>;

  const coursePayload = {
    name: c.name,
    trainer_id: c.trainer_id || null,
    trainer_name: c.trainer_name || '',
    trainer_phone: c.trainer_phone || null,
    room: c.room,
    schedule_days: c.schedule_days || [],
    schedule_time: c.schedule_time,
    schedule_end_time: c.schedule_end_time || null,
    has_interview: !!c.has_interview,
    interview_date: c.interview_date || null,
    total_lectures: Number(c.total_lectures) || 8,
    start_date: c.start_date,
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
    const { error: updateError } = await supabase
      .from('courses')
      .update({
        ...coursePayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetCourseId);

    if (updateError) throw updateError;
  }

  // Update organizers
  await supabase.from('course_organizers').delete().eq('course_id', targetCourseId);
  if (organizers.length > 0) {
    const organizerRows = organizers.map((org) => ({
      course_id: targetCourseId!,
      volunteer_id: org.volunteer_id || null,
      name: org.name,
      phone: org.phone || null,
    }));
    await supabase.from('course_organizers').insert(organizerRows);
  }

  // Update marketers
  await supabase.from('course_marketers').delete().eq('course_id', targetCourseId);
  if (marketers.length > 0) {
    const marketerRows = marketers.map((mkt) => ({
      course_id: targetCourseId!,
      volunteer_id: mkt.volunteer_id || null,
      name: mkt.name,
      phone: mkt.phone || null,
    }));
    await supabase.from('course_marketers').insert(marketerRows);
  }

  // Update trainers
  await supabase.from('course_trainers').delete().eq('course_id', targetCourseId);
  if (trainerIds.length > 0) {
    const trainerRows = trainerIds.map((tId) => ({
      course_id: targetCourseId!,
      trainer_id: tId,
    }));
    await supabase.from('course_trainers').insert(trainerRows);
  }

  // Manage lectures
  if (lectureDates.length > 0) {
    const { data: existingLectures } = await supabase
      .from('course_lectures')
      .select('id, lecture_number')
      .eq('course_id', targetCourseId)
      .order('lecture_number', { ascending: true });

    const existingMap = new Map((existingLectures || []).map((l) => [l.lecture_number, l.id]));
    const keptIds: string[] = [];

    for (let i = 0; i < lectureDates.length; i++) {
      const lectureNum = i + 1;
      const date = lectureDates[i];
      const existingId = existingMap.get(lectureNum);

      if (existingId) {
        await supabase
          .from('course_lectures')
          .update({ date, lecture_number: lectureNum })
          .eq('id', existingId);
        keptIds.push(existingId);
      } else {
        const { data: insertedLecture } = await supabase
          .from('course_lectures')
          .insert({
            course_id: targetCourseId!,
            lecture_number: lectureNum,
            date,
            status: 'scheduled',
          })
          .select('id')
          .single();

        if (insertedLecture) {
          keptIds.push(insertedLecture.id);
        }
      }
    }

    if (existingLectures && existingLectures.length > 0) {
      const idsToDelete = existingLectures
        .map((l) => l.id)
        .filter((id) => !keptIds.includes(id));

      if (idsToDelete.length > 0) {
        await supabase.from('course_lectures').delete().in('id', idsToDelete);
      }
    }
  }

  // Create course_ads if new course and adDates specified
  if (!courseId && adDates.length > 0) {
    const adRows = adDates.map((d, idx) => ({
      course_id: targetCourseId!,
      ad_number: idx + 1,
      ad_date: d,
      created_by: c.created_by || null,
    }));
    await supabase.from('course_ads').insert(adRows);
  }

  return targetCourseId;
}


