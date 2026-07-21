/**
 * Circles service — all Quran circle Supabase calls.
 *
 * Pure service: no React, no hooks, no toast.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';

// ─── Types ──────────────────────────────────────────────────────────

type Tables = Database['public']['Tables'];
type QuranBeneficiaryRow = Tables['quran_beneficiaries']['Row'];
type QuranBeneficiaryInsert = Tables['quran_beneficiaries']['Insert'];
type QuranCircleRow = Tables['quran_circles']['Row'];
type QuranCircleInsert = Tables['quran_circles']['Insert'];
type QuranCircleOrganizerRow = Tables['quran_circle_organizers']['Row'];
type QuranCircleOrganizerInsert = Tables['quran_circle_organizers']['Insert'];
type QuranCircleMarketerInsert = Tables['quran_circle_marketers']['Insert'];
type QuranCircleSessionRow = Tables['quran_circle_sessions']['Row'];
type QuranCircleSessionInsert = Tables['quran_circle_sessions']['Insert'];
type QuranCircleBeneficiaryRow = Tables['quran_circle_beneficiaries']['Row'];
type QuranCircleBeneficiaryInsert = Tables['quran_circle_beneficiaries']['Insert'];
type QuranEnrollmentRow = Tables['quran_enrollments']['Row'];
type QuranEnrollmentInsert = Tables['quran_enrollments']['Insert'];
type QuranTeacherRow = Tables['quran_teachers']['Row'];
type QuranCircleAdRow = Tables['quran_circle_ads']['Row'];
type ProfileVolunteerRow = Pick<Tables['profiles']['Row'], 'id' | 'full_name' | 'full_name_ar' | 'phone' | 'avatar_url'>;

type TeacherGender = 'men' | 'women';
type TeachingMode = 'online' | 'offline' | 'both';
type BeneficiaryGender = 'male' | 'female';
type BeneficiaryType = 'child' | 'adult';
type AttendanceType = 'memorization' | 'revision';

interface CircleWithOrganizers extends QuranCircleRow {
  quran_circle_organizers?: Pick<QuranCircleOrganizerRow, 'volunteer_id' | 'name' | 'phone'>[] | null;
}

interface EnrollmentWithBeneficiary {
  beneficiary_id: string;
  quran_beneficiaries: QuranBeneficiaryRow;
}

interface SessionWithCounts extends QuranCircleSessionRow {
  quran_circle_beneficiaries?: { count: number }[] | null;
  quran_circle_organizers?: Pick<QuranCircleOrganizerRow, 'name'> | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asTeacherGender = (value: string | null | undefined): TeacherGender =>
  value === 'women' ? 'women' : 'men';

const asTeachingMode = (value: string | null | undefined): TeachingMode => {
  if (value === 'online' || value === 'offline' || value === 'both') return value;
  return 'both';
};

const asBeneficiaryGender = (value: string | null | undefined): BeneficiaryGender | null => {
  if (value === 'male' || value === 'female') return value;
  return null;
};

const asBeneficiaryType = (value: string | null | undefined): BeneficiaryType => {
  return value === 'child' ? 'child' : 'adult';
};

const asAttendanceType = (value: string | null | undefined): AttendanceType => {
  return value === 'revision' ? 'revision' : 'memorization';
};

const toSchedule = (value: Json | null): ScheduleItem[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const day = item.day;
    const time = item.time;
    return typeof day === 'number' && typeof time === 'string' ? [{ day, time }] : [];
  });
};

const toBeneficiary = (row: QuranBeneficiaryRow): Beneficiary => ({
  id: row.id,
  name_ar: row.name_ar,
  name_en: row.name_en,
  image_url: row.image_url,
  gender: asBeneficiaryGender(row.gender),
  beneficiary_type: asBeneficiaryType(row.beneficiary_type),
  phone: row.phone,
});

export interface Teacher {
  id: string;
  name: string;
  target_gender: 'men' | 'women';
  teaching_mode: 'online' | 'offline' | 'both';
}

export interface Volunteer {
  id: string;
  full_name: string;
  full_name_ar: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface Organizer {
  volunteer_id?: string;
  name: string;
  phone: string;
}

export interface ScheduleItem {
  day: number;
  time: string;
}

export interface QuranCircle {
  id: string;
  teacher_id: string | null;
  teacher_name?: string;
  teacher_gender?: 'men' | 'women';
  teaching_mode?: 'online' | 'offline' | 'both';
  schedule: ScheduleItem[];
  is_active: boolean;
  organizers?: Organizer[];
  enrolled_count?: number;
  description?: string;
  target_group?: string;
  beneficiary_gender?: 'male' | 'female';
  sessions_count?: number;
}

export interface Beneficiary {
  id: string;
  name_ar: string;
  name_en: string | null;
  image_url: string | null;
  gender: 'male' | 'female' | null;
  beneficiary_type: 'child' | 'adult';
  phone: string | null;
}

export interface Session {
  id: string;
  circle_id: string;
  session_date: string;
  notes: string | null;
  organizer_id?: string | null;
  organizer_name?: string | null;
  attendees_count?: number;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

export interface Attendance {
  beneficiary_id: string;
  attendance_type: 'memorization' | 'revision';
}

export interface Guest {
  name: string;
  phone: string;
}

export interface QuranCircleMarketer {
  id?: string;
  circle_id?: string;
  volunteer_id?: string;
  name: string;
  phone: string;
}

export interface CircleAd {
  id: string;
  circle_id: string;
  ad_number: number;
  ad_date: string;
  poster_done: boolean;
  content_done: boolean;
  updater?: {
    full_name: string;
    full_name_ar: string | null;
  } | null;
}

export interface SaveCirclePayload {
  isEditMode: boolean;
  circleId?: string;
  teacherId: string;
  schedule: ScheduleItem[];
  isActive: boolean;
  description: string;
  targetGroup: string;
  beneficiaryGender: 'male' | 'female';
  branchId?: string;
  organizers: Organizer[];
  marketers: QuranCircleMarketer[];
}

const CIRCLE_COLUMNS = 'id, teacher_id, schedule, is_active, description, target_group, beneficiary_gender, quran_circle_organizers(volunteer_id, name, phone)';

export interface SaveAttendancePayload {
  sessionId: string;
  circleId: string;
  attendance: Attendance[];
  guests: Guest[];
  circleGender?: string;
  circleTargetGroup?: string;
}

export interface SaveCircleBeneficiaryPayload {
  circleId: string;
  beneficiaryId?: string;
  nameAr: string;
  nameEn?: string;
  phone?: string;
  gender: 'male' | 'female';
  beneficiaryType: 'child' | 'adult';
  branchId?: string;
}

// ─── Queries ────────────────────────────────────────────────────────

export async function getCircles(branchId?: string): Promise<QuranCircle[]> {
  let query = supabase
    .from('quran_circles')
    .select(CIRCLE_COLUMNS);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  const circleRows = (data ?? []) as unknown as CircleWithOrganizers[];
  const circleIds = circleRows.map((circle) => circle.id);
  const enrollmentResult = circleIds.length > 0
    ? await supabase.from('quran_enrollments').select('circle_id').in('circle_id', circleIds).eq('status', 'active')
    : { data: [], error: null };
  if (enrollmentResult.error) throw enrollmentResult.error;

  const enrollmentCounts: Record<string, number> = {};
  ((enrollmentResult.data ?? []) as Pick<QuranEnrollmentRow, 'circle_id'>[]).forEach((enrollment) => {
    enrollmentCounts[enrollment.circle_id] = (enrollmentCounts[enrollment.circle_id] || 0) + 1;
  });

  let teachersQuery = supabase.from('quran_teachers').select('id, name, target_gender, teaching_mode');
  if (branchId) teachersQuery = teachersQuery.eq('branch_id', branchId);
  const { data: teachersData, error: teachersError } = await teachersQuery;
  if (teachersError) throw teachersError;
  const teachersMap = new Map((teachersData ?? []).map((teacher) => [teacher.id, teacher]));

  return circleRows.map((circle) => {
    const teacher = teachersMap.get(circle.teacher_id);
    return {
      id: circle.id,
      teacher_id: circle.teacher_id,
      teacher_name: teacher?.name,
      teacher_gender: teacher ? asTeacherGender(teacher.target_gender) : undefined,
      teaching_mode: teacher ? asTeachingMode(teacher.teaching_mode) : undefined,
      schedule: toSchedule(circle.schedule),
      is_active: circle.is_active ?? true,
      organizers: (circle.quran_circle_organizers ?? []).map((organizer) => ({
        volunteer_id: organizer.volunteer_id ?? undefined,
        name: organizer.name,
        phone: organizer.phone ?? '',
      })),
      enrolled_count: enrollmentCounts[circle.id] || 0,
      description: circle.description ?? undefined,
      target_group: circle.target_group ?? undefined,
      beneficiary_gender: asBeneficiaryGender(circle.beneficiary_gender) ?? undefined,
    };
  });
}

export async function getTeachers(branchId?: string): Promise<Teacher[]> {
  let query = supabase
    .from('quran_teachers')
    .select('id, name, target_gender, teaching_mode');

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.order('name');
  if (error) throw error;
  return ((data ?? []) as QuranTeacherRow[]).map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    target_gender: asTeacherGender(teacher.target_gender),
    teaching_mode: asTeachingMode(teacher.teaching_mode),
  }));
}

export async function getVolunteers(branchId?: string): Promise<Volunteer[]> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, full_name_ar, phone, avatar_url')
    .neq('full_name', 'RTC Admin');

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.order('full_name');
  if (error) throw error;
  return ((data ?? []) as ProfileVolunteerRow[]).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    full_name_ar: profile.full_name_ar,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
  }));
}

export async function getAllBeneficiaries(branchId?: string): Promise<Beneficiary[]> {
  let query = supabase.from('quran_beneficiaries')
    .select('id, name_ar, name_en, image_url, gender, beneficiary_type, phone');

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.order('name_ar');
  if (error) throw error;
  return ((data ?? []) as QuranBeneficiaryRow[]).map(toBeneficiary);
}

export async function getCircleEnrollments(circleId: string): Promise<Beneficiary[]> {
  const { data, error } = await supabase
    .from('quran_enrollments')
    .select(`beneficiary_id, quran_beneficiaries!inner(id, name_ar, name_en, image_url, gender, beneficiary_type, phone)`)
    .eq('circle_id', circleId)
    .eq('status', 'active');
  if (error) throw error;
  return ((data ?? []) as unknown as EnrollmentWithBeneficiary[]).map((enrollment) =>
    toBeneficiary(enrollment.quran_beneficiaries)
  );
}

export async function getCircleSessions(circleId: string): Promise<Session[]> {
  const { data, error } = await supabase.from('quran_circle_sessions')
    .select('id, circle_id, session_date, notes, organizer_id, quran_circle_beneficiaries(count), quran_circle_organizers(name)')
    .eq('circle_id', circleId)
    .order('session_date', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as SessionWithCounts[]).map((session) => ({
    id: session.id,
    circle_id: session.circle_id,
    session_date: session.session_date,
    notes: session.notes,
    organizer_id: session.organizer_id,
    attendees_count: session.quran_circle_beneficiaries?.[0]?.count || 0,
    organizer_name: session.quran_circle_organizers?.name || null,
  }));
}

export async function getCircleAttendance(sessionIds: string[]): Promise<Record<string, Attendance[]>> {
  if (sessionIds.length === 0) return {};
  const { data, error } = await supabase.from('quran_circle_beneficiaries')
    .select('session_id, beneficiary_id, attendance_type')
    .in('session_id', sessionIds);
  if (error) throw error;

  const attMap: Record<string, Attendance[]> = {};
  ((data ?? []) as Pick<QuranCircleBeneficiaryRow, 'session_id' | 'beneficiary_id' | 'attendance_type'>[]).forEach((attendance) => {
    if (!attMap[attendance.session_id]) attMap[attendance.session_id] = [];
    attMap[attendance.session_id].push({
      beneficiary_id: attendance.beneficiary_id,
      attendance_type: asAttendanceType(attendance.attendance_type),
    });
  });
  return attMap;
}

export async function getCircleAds(circleId: string): Promise<CircleAd[]> {
  const { data, error } = await supabase
    .from('quran_circle_ads')
    .select('id, circle_id, ad_number, ad_date, poster_done, content_done')
    .eq('circle_id', circleId)
    .order('ad_number');
  if (error) throw error;
  return ((data ?? []) as QuranCircleAdRow[]).map((ad) => ({
    id: ad.id,
    circle_id: ad.circle_id,
    ad_number: ad.ad_number,
    ad_date: ad.ad_date,
    poster_done: ad.poster_done,
    content_done: ad.content_done,
  }));
}

export async function createCircleAd(circleId: string, adNumber: number): Promise<CircleAd> {
  const { data, error } = await supabase
    .from('quran_circle_ads')
    .insert({
      circle_id: circleId,
      ad_number: adNumber,
      ad_date: new Date().toISOString().split('T')[0],
      poster_done: false,
      content_done: false,
    })
    .select('id, circle_id, ad_number, ad_date, poster_done, content_done')
    .single();
  if (error) throw error;
  return data as CircleAd;
}

export async function updateCircleAd(
  adId: string,
  updates: Pick<Database['public']['Tables']['quran_circle_ads']['Update'], 'ad_date' | 'poster_done' | 'content_done'>,
): Promise<void> {
  const { error } = await supabase
    .from('quran_circle_ads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', adId);
  if (error) throw error;
}

export async function deleteCircleAd(adId: string): Promise<void> {
  const { error } = await supabase.from('quran_circle_ads').delete().eq('id', adId);
  if (error) throw error;
}

export async function addCircleOrganizer(circleId: string, organizer: Organizer): Promise<void> {
  if (!organizer.volunteer_id) throw new Error('Organizer volunteer ID is required');
  const { error } = await supabase.from('quran_circle_organizers').insert({
    circle_id: circleId,
    volunteer_id: organizer.volunteer_id,
    name: organizer.name,
    phone: organizer.phone,
  });
  if (error) throw error;
}

export async function removeCircleOrganizer(circleId: string, volunteerId: string): Promise<void> {
  const { error } = await supabase
    .from('quran_circle_organizers')
    .delete()
    .eq('circle_id', circleId)
    .eq('volunteer_id', volunteerId);
  if (error) throw error;
}

export async function addCircleMarketer(circleId: string, volunteerId: string): Promise<string> {
  const { data, error } = await supabase
    .from('quran_circle_marketers')
    .insert({ circle_id: circleId, volunteer_id: volunteerId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function removeCircleMarketer(marketerId: string): Promise<void> {
  const { error } = await supabase.from('quran_circle_marketers').delete().eq('id', marketerId);
  if (error) throw error;
}

export async function setCircleAttendance(
  sessionId: string,
  circleId: string,
  beneficiaryId: string,
  present: boolean,
): Promise<void> {
  if (present) {
    const { error } = await supabase.from('quran_circle_beneficiaries').insert({
      session_id: sessionId,
      circle_id: circleId,
      beneficiary_id: beneficiaryId,
      attendance_type: 'memorization',
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('quran_circle_beneficiaries')
    .delete()
    .eq('session_id', sessionId)
    .eq('beneficiary_id', beneficiaryId);
  if (error) throw error;
}

export async function updateCircleAttendanceType(
  sessionId: string,
  beneficiaryId: string,
  attendanceType: AttendanceType,
): Promise<void> {
  const { error } = await supabase
    .from('quran_circle_beneficiaries')
    .update({ attendance_type: attendanceType })
    .eq('session_id', sessionId)
    .eq('beneficiary_id', beneficiaryId);
  if (error) throw error;
}

// ─── Mutations ──────────────────────────────────────────────────────

export async function saveCircle(payload: SaveCirclePayload): Promise<string> {
  const dataToSave: QuranCircleInsert = {
    teacher_id: payload.teacherId,
    schedule: payload.schedule as unknown as Json,
    is_active: payload.isActive,
    name: 'auto',
    date: new Date().toISOString().split('T')[0],
    description: payload.description,
    target_group: payload.targetGroup,
    beneficiary_gender: payload.beneficiaryGender,
  };

  let circleId = payload.circleId;

  if (payload.isEditMode && circleId) {
    const { error } = await supabase.from('quran_circles').update(dataToSave).eq('id', circleId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('quran_circles')
      .insert({ ...dataToSave, branch_id: payload.branchId ?? null })
      .select('id')
      .single();
    if (error) throw error;
    circleId = data.id;
  }

  if (!circleId) throw new Error('Circle save returned no ID');

  {
    const { error: organizerDeleteError } = await supabase.from('quran_circle_organizers').delete().eq('circle_id', circleId);
    if (organizerDeleteError) throw organizerDeleteError;
    if (payload.organizers.length > 0) {
      const organizerRows: QuranCircleOrganizerInsert[] = payload.organizers.map((organizer) => ({
        circle_id: circleId,
        volunteer_id: organizer.volunteer_id || null,
        name: organizer.name,
        phone: organizer.phone,
      }));
      const { error } = await supabase.from('quran_circle_organizers').insert(organizerRows);
      if (error) throw error;
    }
    const { error: marketerDeleteError } = await supabase.from('quran_circle_marketers').delete().eq('circle_id', circleId);
    if (marketerDeleteError) throw marketerDeleteError;
    if (payload.marketers.length > 0) {
      const marketerRows: QuranCircleMarketerInsert[] = payload.marketers.flatMap((marketer) =>
        marketer.volunteer_id ? [{ circle_id: circleId, volunteer_id: marketer.volunteer_id }] : []
      );
      if (marketerRows.length > 0) {
        const { error } = await supabase.from('quran_circle_marketers').insert(marketerRows);
        if (error) throw error;
      }
    }
  }

  return circleId;
}

export async function deleteCircle(circleId: string): Promise<void> {
  // Clean up enrollments first (orphaned rows won't be auto-deleted by FK unless CASCADE is set)
  const { error: enrollmentError } = await supabase
    .from('quran_enrollments')
    .delete()
    .eq('circle_id', circleId);
  if (enrollmentError) throw enrollmentError;

  const { error } = await supabase.from('quran_circles').delete().eq('id', circleId);
  if (error) throw error;
}

export async function enrollBeneficiary(circleId: string, beneficiaryId: string): Promise<void> {
  // Check if an enrollment record already exists (possibly inactive)
  const { data: existing, error: lookupError } = await supabase
    .from('quran_enrollments')
    .select('id, status')
    .eq('circle_id', circleId)
    .eq('beneficiary_id', beneficiaryId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    // Re-activate the existing record instead of inserting a duplicate
    if (existing.status === 'active') return; // Already enrolled, nothing to do
    const { error } = await supabase
      .from('quran_enrollments')
      .update({ status: 'active' })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const enrollment: QuranEnrollmentInsert = { circle_id: circleId, beneficiary_id: beneficiaryId, status: 'active' };
    const { error } = await supabase.from('quran_enrollments').insert(enrollment);
    if (error) throw error;
  }
}

export async function unenrollBeneficiary(circleId: string, beneficiaryId: string): Promise<void> {
  const { error } = await supabase.from('quran_enrollments').delete().eq('circle_id', circleId).eq('beneficiary_id', beneficiaryId);
  if (error) throw error;
}

export async function deactivateCircleEnrollment(circleId: string, beneficiaryId: string): Promise<void> {
  const { error } = await supabase
    .from('quran_enrollments')
    .update({ status: 'inactive' })
    .eq('circle_id', circleId)
    .eq('beneficiary_id', beneficiaryId);
  if (error) throw error;
}

export async function saveCircleBeneficiary(payload: SaveCircleBeneficiaryPayload): Promise<{ beneficiaryId: string; alreadyEnrolled: boolean }> {
  const details = {
    name_ar: payload.nameAr,
    name_en: payload.nameEn || null,
    phone: payload.phone || null,
    gender: payload.gender,
    beneficiary_type: payload.beneficiaryType,
  } as const;

  let beneficiaryId = payload.beneficiaryId;
  if (beneficiaryId) {
    const { error } = await supabase.from('quran_beneficiaries').update(details).eq('id', beneficiaryId);
    if (error) throw error;
    return { beneficiaryId, alreadyEnrolled: false };
  }

  if (payload.phone) {
    const { data, error } = await supabase.from('quran_beneficiaries').select('id').eq('phone', payload.phone).maybeSingle();
    if (error) throw error;
    beneficiaryId = data?.id;
  }

  if (!beneficiaryId) {
    const { data, error } = await supabase
      .from('quran_beneficiaries')
      .insert({ ...details, branch_id: payload.branchId ?? null })
      .select('id')
      .single();
    if (error) throw error;
    beneficiaryId = data.id;
  }

  const { data: enrollment, error: enrollmentLookupError } = await supabase
    .from('quran_enrollments')
    .select('id, status')
    .eq('circle_id', payload.circleId)
    .eq('beneficiary_id', beneficiaryId)
    .maybeSingle();
  if (enrollmentLookupError) throw enrollmentLookupError;

  if (enrollment?.status === 'active') return { beneficiaryId, alreadyEnrolled: true };
  if (enrollment) {
    const { error } = await supabase.from('quran_enrollments').update({ status: 'active' }).eq('id', enrollment.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('quran_enrollments').insert({ circle_id: payload.circleId, beneficiary_id: beneficiaryId, status: 'active' });
    if (error) throw error;
  }

  return { beneficiaryId, alreadyEnrolled: false };
}

export async function createSession(params: {
  circleId: string; sessionDate: string; notes: string | null; organizerVolunteerId?: string;
}): Promise<Session> {
  let resolvedOrganizerId: string | null = null;
  if (params.organizerVolunteerId && params.organizerVolunteerId !== 'none') {
    const { data: orgRow, error } = await supabase.from('quran_circle_organizers')
      .select('id').eq('circle_id', params.circleId).eq('volunteer_id', params.organizerVolunteerId).maybeSingle();
    if (error) throw error;
    resolvedOrganizerId = orgRow?.id ?? null;
  }
  const sessionToCreate: QuranCircleSessionInsert = {
    circle_id: params.circleId,
    session_date: params.sessionDate,
    notes: params.notes,
    organizer_id: resolvedOrganizerId,
  };
  const { data, error } = await supabase.from('quran_circle_sessions')
    .insert(sessionToCreate)
    .select('id, circle_id, session_date, notes, organizer_id')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    circle_id: data.circle_id,
    session_date: data.session_date,
    notes: data.notes,
    organizer_id: data.organizer_id,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error: attendanceError } = await supabase.from('quran_circle_beneficiaries').delete().eq('session_id', sessionId);
  if (attendanceError) throw attendanceError;
  const { error } = await supabase.from('quran_circle_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

export async function saveAttendance(payload: SaveAttendancePayload): Promise<void> {
  const { error: clearAttendanceError } = await supabase.from('quran_circle_beneficiaries').delete().eq('session_id', payload.sessionId);
  if (clearAttendanceError) throw clearAttendanceError;

  const guestPhones = [...new Set(payload.guests.map(g => g.phone).filter(Boolean))];
  const guestMap = new Map<string, string>();

  if (guestPhones.length > 0) {
    const { data: existing } = await supabase.from('quran_beneficiaries').select('id, phone').in('phone', guestPhones);
    existing?.forEach((beneficiary) => guestMap.set(beneficiary.phone, beneficiary.id));

    const uniqueNew = new Map<string, Guest>();
    payload.guests.filter(g => g.phone && !guestMap.has(g.phone)).forEach(g => uniqueNew.set(g.phone, g));

    if (uniqueNew.size > 0) {
      const toInsert: QuranBeneficiaryInsert[] = Array.from(uniqueNew.values()).map(g => ({
        name_ar: g.name,
        phone: g.phone,
        gender: payload.circleGender === 'female' || payload.circleGender === 'women' ? 'female' : 'male',
        beneficiary_type: payload.circleTargetGroup === 'children' ? 'child' : 'adult',
      }));
      const { data: created, error } = await supabase.from('quran_beneficiaries').insert(toInsert).select('id, phone');
      if (error) throw error;
      created?.forEach((beneficiary) => guestMap.set(beneficiary.phone, beneficiary.id));
    }
  }

  const allRecords: QuranCircleBeneficiaryInsert[] = [];
  payload.attendance.forEach(a => {
    allRecords.push({ session_id: payload.sessionId, circle_id: payload.circleId, beneficiary_id: a.beneficiary_id, attendance_type: a.attendance_type });
  });
  payload.guests.forEach(g => {
    const benId = guestMap.get(g.phone);
    if (benId) allRecords.push({ session_id: payload.sessionId, circle_id: payload.circleId, beneficiary_id: benId, attendance_type: 'memorization' });
  });

  if (allRecords.length > 0) {
    const unique = Array.from(new Map(allRecords.map(r => [r.beneficiary_id, r])).values());
    const { error } = await supabase.from('quran_circle_beneficiaries').insert(unique);
    if (error) throw error;
  }
}
