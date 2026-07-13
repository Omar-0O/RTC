import { supabase } from '@/integrations/supabase/client';

export type CourseLectureDetail = {
  id: string;
  course_id: string;
  lecture_number: number;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
};

export type CourseAdDetail = {
  id: string;
  course_id: string;
  ad_number: number;
  ad_date: string;
  poster_url: string | null;
  content: string | null;
  poster_done: boolean;
  content_done: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  updater: { full_name: string; full_name_ar: string } | null;
};

export type CourseBeneficiaryDetail = {
  id: string;
  course_id: string;
  name: string;
  phone: string;
  national_id: string | null;
};

export type CourseOrganizerDetail = {
  id: string;
  course_id: string;
  volunteer_id: string | null;
  name: string;
  phone: string;
};

export type CourseMarketerDetail = {
  id: string;
  course_id: string;
  volunteer_id: string | null;
  profiles: {
    full_name: string | null;
    full_name_ar: string | null;
    phone: string | null;
  } | null;
};

export type CourseAttendanceDetail = {
  id: string;
  lecture_id: string;
  student_name: string;
  student_phone: string;
  status: 'present' | 'absent' | 'excused';
};

export type CourseEditRelations = {
  organizers: CourseOrganizerDetail[];
  marketers: CourseMarketerDetail[];
  trainerIds: string[];
};

const asLectureStatus = (value: string | null): CourseLectureDetail['status'] => (
  value === 'completed' || value === 'cancelled' ? value : 'scheduled'
);

const asAttendanceStatus = (value: string | null): CourseAttendanceDetail['status'] => (
  value === 'absent' || value === 'excused' ? value : 'present'
);

export async function getCourseDetails(courseId: string) {
  const [lecturesResult, adsResult, beneficiariesResult, organizersResult, marketersResult] = await Promise.all([
    supabase
      .from('course_lectures')
      .select('id, course_id, lecture_number, date, status')
      .eq('course_id', courseId)
      .order('lecture_number'),
    supabase
      .from('course_ads')
      .select(`
        id,
        course_id,
        ad_number,
        ad_date,
        poster_url,
        content,
        poster_done,
        content_done,
        created_by,
        updated_by,
        created_at,
        updated_at,
        updater:updated_by(full_name, full_name_ar)
      `)
      .eq('course_id', courseId)
      .order('ad_number'),
    supabase
      .from('course_beneficiaries')
      .select('id, course_id, name, phone, national_id')
      .eq('course_id', courseId)
      .order('name'),
    supabase
      .from('course_organizers')
      .select('id, course_id, volunteer_id, name, phone')
      .eq('course_id', courseId),
    supabase
      .from('course_marketers')
      .select(`
        id,
        course_id,
        volunteer_id,
        profiles:volunteer_id(full_name, full_name_ar, phone)
      `)
      .eq('course_id', courseId),
  ]);

  for (const result of [lecturesResult, adsResult, beneficiariesResult, organizersResult, marketersResult]) {
    if (result.error) throw result.error;
  }

  const lectures: CourseLectureDetail[] = (lecturesResult.data ?? []).map((lecture) => ({
    id: lecture.id,
    course_id: lecture.course_id ?? courseId,
    lecture_number: lecture.lecture_number,
    date: lecture.date,
    status: asLectureStatus(lecture.status),
  }));
  const lectureIds = lectures.map((lecture) => lecture.id);
  const attendanceResult = lectureIds.length > 0
    ? await supabase
      .from('course_attendance')
      .select('id, lecture_id, student_name, student_phone, status')
      .in('lecture_id', lectureIds)
    : { data: [], error: null };

  if (attendanceResult.error) throw attendanceResult.error;

  const attendanceByLecture = (attendanceResult.data ?? []).reduce<Record<string, CourseAttendanceDetail[]>>(
    (grouped, attendance) => {
      const lectureId = attendance.lecture_id;
      if (!lectureId) return grouped;

      (grouped[lectureId] ??= []).push({
        id: attendance.id,
        lecture_id: lectureId,
        student_name: attendance.student_name,
        student_phone: attendance.student_phone,
        status: asAttendanceStatus(attendance.status),
      });
      return grouped;
    },
    {},
  );

  return {
    lectures,
    ads: adsResult.data ?? [],
    beneficiaries: (beneficiariesResult.data ?? []).map((beneficiary) => ({
      ...beneficiary,
      course_id: beneficiary.course_id ?? courseId,
    })),
    organizers: (organizersResult.data ?? []).map((organizer) => ({
      ...organizer,
      course_id: organizer.course_id ?? courseId,
      phone: organizer.phone ?? '',
    })),
    marketers: marketersResult.data ?? [],
    attendanceByLecture,
  };
}

export async function getCourseEditRelations(courseId: string): Promise<CourseEditRelations> {
  const [organizersResult, marketersResult, trainersResult] = await Promise.all([
    supabase
      .from('course_organizers')
      .select('id, course_id, volunteer_id, name, phone')
      .eq('course_id', courseId),
    supabase
      .from('course_marketers')
      .select(`
        id,
        course_id,
        volunteer_id,
        profiles:volunteer_id(full_name, full_name_ar, phone)
      `)
      .eq('course_id', courseId),
    supabase
      .from('course_trainers')
      .select('trainer_id')
      .eq('course_id', courseId),
  ]);

  for (const result of [organizersResult, marketersResult, trainersResult]) {
    if (result.error) throw result.error;
  }

  return {
    organizers: (organizersResult.data ?? []).map((organizer) => ({
      ...organizer,
      course_id: organizer.course_id ?? courseId,
      phone: organizer.phone ?? '',
    })),
    marketers: marketersResult.data ?? [],
    trainerIds: (trainersResult.data ?? []).map(({ trainer_id }) => trainer_id),
  };
}
