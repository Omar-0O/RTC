import { supabase } from '@/integrations/supabase/client';

type CourseTrainerReference = {
  trainer_id: string;
};

export type TrainerParticipationCourse = {
  id: string;
  name: string;
  trainer_id: string | null;
  trainer_name: string;
  trainer_phone: string | null;
  committee_id: string | null;
  course_trainers?: CourseTrainerReference[];
};

type TrainerEntry = {
  name: string;
  phone: string | null;
  volunteerId: string | null;
  hasTrainerId: boolean;
};

type TrainerLookupRow = {
  id: string;
  user_id: string | null;
  phone: string | null;
  name_ar: string | null;
  name_en: string | null;
};

type ProfilePhoneRow = {
  id: string;
  phone: string | null;
};

const normalizePhone = (phone: string) => phone.replace(/[\s-]/g, '');

const getCourseTrainerIds = (course: TrainerParticipationCourse) => {
  const trainerIds = new Set<string>();
  if (course.trainer_id) trainerIds.add(course.trainer_id);
  course.course_trainers?.forEach(({ trainer_id }) => trainerIds.add(trainer_id));
  return [...trainerIds];
};

const getExternalTrainerEntries = (course: TrainerParticipationCourse): TrainerEntry[] => {
  if (course.trainer_id || !course.trainer_name) return [];

  const phones = course.trainer_phone
    ? course.trainer_phone.split(/[-,]/).map(phone => phone.trim()).filter(Boolean)
    : [null];

  return phones.map(phone => ({
    name: course.trainer_name,
    phone: phone || course.trainer_phone,
    volunteerId: null,
    hasTrainerId: false,
  }));
};

async function getInternalTrainerEntries(trainerIds: string[]): Promise<TrainerEntry[]> {
  if (trainerIds.length === 0) return [];

  const { data, error } = await supabase
    .from('trainers')
    .select('id, user_id, phone, name_ar, name_en')
    .in('id', trainerIds);

  if (error) throw error;

  return ((data ?? []) as TrainerLookupRow[]).map(trainer => ({
    name: trainer.name_ar || trainer.name_en || 'مدرب',
    phone: trainer.phone,
    volunteerId: trainer.user_id,
    hasTrainerId: true,
  }));
}

async function attachProfileIds(trainers: TrainerEntry[]): Promise<TrainerEntry[]> {
  const phoneCandidates = [...new Set(
    trainers
      .map(trainer => trainer.phone)
      .filter((phone): phone is string => Boolean(phone))
      .flatMap(phone => [phone, normalizePhone(phone)]),
  )];

  if (phoneCandidates.length === 0) return trainers;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, phone')
    .in('phone', phoneCandidates);

  if (error) throw error;

  const profileIdByPhone = new Map(
    ((data ?? []) as ProfilePhoneRow[])
      .filter((profile): profile is ProfilePhoneRow & { phone: string } => Boolean(profile.phone))
      .map(profile => [normalizePhone(profile.phone), profile.id]),
  );

  return trainers.map(trainer => ({
    ...trainer,
    volunteerId: trainer.volunteerId || (trainer.phone ? profileIdByPhone.get(normalizePhone(trainer.phone)) || null : null),
  }));
}

async function getTrainerActivityMetadata(course: TrainerParticipationCourse) {
  const [{ data: committees }, { data: activityTypes }] = await Promise.all([
    supabase.from('committees').select('id, name'),
    supabase.from('activity_types').select('id, points, name'),
  ]);

  const committee = committees?.find(item => (
    item.name.toLowerCase().includes('trainer')
    || item.name.toLowerCase().includes('course')
    || item.name.includes('تدريب')
    || item.name.includes('كورس')
  ));

  const activityType = activityTypes?.find(item => item.name === 'Trainer Lecture')
    || activityTypes?.find(item => (
      item.name.toLowerCase().includes('trainer')
      || item.name.toLowerCase().includes('lecture')
      || item.name.includes('محاضر')
      || item.name.includes('مدرب')
    ));

  return {
    committeeId: committee?.id || course.committee_id || committees?.[0]?.id || null,
    activityTypeId: activityType?.id || null,
    activityPoints: activityType?.points || 0,
  };
}

export async function createCourseTrainerParticipation({
  course,
  lectureId,
  lectureNumber,
  lectureDate,
}: {
  course: TrainerParticipationCourse;
  lectureId: string;
  lectureNumber: number | string;
  lectureDate?: string;
}): Promise<void> {
  const externalTrainers = getExternalTrainerEntries(course);
  const internalTrainers = await getInternalTrainerEntries(getCourseTrainerIds(course));
  const trainers = await attachProfileIds([...internalTrainers, ...externalTrainers]);

  if (trainers.length === 0) return;

  const externalProfileTrainers = trainers.filter(trainer => !trainer.hasTrainerId && trainer.volunteerId);
  const metadata = externalProfileTrainers.length > 0
    ? await getTrainerActivityMetadata(course)
    : null;

  const recordRequest = supabase.from('trainer_lecture_records').insert(
    trainers.map(trainer => ({
      course_id: course.id,
      lecture_id: lectureId,
      trainer_name: trainer.name,
      trainer_phone: trainer.phone,
      volunteer_id: trainer.volunteerId,
    })),
  );

  const activityRows = metadata?.committeeId && metadata.activityTypeId
    ? externalProfileTrainers.map(trainer => ({
      volunteer_id: trainer.volunteerId!,
      activity_type_id: metadata.activityTypeId,
      committee_id: metadata.committeeId,
      description: `محاضرة ${lectureNumber} في كورس: ${course.name}`,
      points_awarded: metadata.activityPoints,
      status: 'approved',
      location: 'branch',
      proof_url: null,
      submitted_at: lectureDate
        ? new Date(`${lectureDate}T12:00:00`).toISOString()
        : new Date().toISOString(),
    }))
    : [];

  const [recordResult, activityResult] = await Promise.all([
    recordRequest,
    activityRows.length > 0
      ? supabase.from('activity_submissions').insert(activityRows)
      : Promise.resolve({ error: null }),
  ]);

  if (recordResult.error) throw recordResult.error;
  if (activityResult.error) throw activityResult.error;
}
