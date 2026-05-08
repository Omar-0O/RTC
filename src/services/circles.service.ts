/**
 * Circles service — all Quran circle Supabase calls.
 *
 * Pure service: no React, no hooks, no toast.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// ─── Types ──────────────────────────────────────────────────────────

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
  organizers: Organizer[];
  marketers: QuranCircleMarketer[];
}

export interface SaveAttendancePayload {
  sessionId: string;
  circleId: string;
  attendance: Attendance[];
  guests: Guest[];
  circleGender?: string;
  circleTargetGroup?: string;
}

// ─── Queries ────────────────────────────────────────────────────────

export async function getCircles(): Promise<QuranCircle[]> {
  const { data, error } = await supabase
    .from('quran_circles')
    .select(`*, quran_circle_organizers(volunteer_id, name, phone)`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const circleIds = (data || []).map((c: any) => c.id);
  const { data: enrollments } = circleIds.length > 0
    ? await (supabase as any).from('quran_enrollments').select('circle_id').in('circle_id', circleIds).eq('status', 'active')
    : { data: [] };

  const enrollmentCounts: Record<string, number> = {};
  (enrollments || []).forEach((e: any) => {
    enrollmentCounts[e.circle_id] = (enrollmentCounts[e.circle_id] || 0) + 1;
  });

  const { data: teachersData } = await supabase.from('quran_teachers').select('id, name, target_gender, teaching_mode');
  const teachersMap = new Map(teachersData?.map((t: any) => [t.id, t]) || []);

  return (data || []).map((circle: any) => {
    const teacher = teachersMap.get(circle.teacher_id);
    return {
      id: circle.id,
      teacher_id: circle.teacher_id,
      teacher_name: teacher?.name,
      teacher_gender: teacher?.target_gender,
      teaching_mode: teacher?.teaching_mode,
      schedule: circle.schedule || [],
      is_active: circle.is_active ?? true,
      organizers: circle.quran_circle_organizers || [],
      enrolled_count: enrollmentCounts[circle.id] || 0,
      description: circle.description,
      target_group: circle.target_group,
      beneficiary_gender: circle.beneficiary_gender,
    };
  });
}

export async function getTeachers(): Promise<Teacher[]> {
  const { data, error } = await supabase.from('quran_teachers').select('*').order('name');
  if (error) throw error;
  return (data || []).map((t: any) => ({
    id: t.id, name: t.name, target_gender: t.target_gender, teaching_mode: t.teaching_mode,
  }));
}

export async function getVolunteers(): Promise<Volunteer[]> {
  const { data, error } = await (supabase
    .from('profiles')
    .select('id, full_name, full_name_ar, phone, avatar_url')
    .neq('full_name', 'RTC Admin') as any)
    .eq('is_active', true)
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function getAllBeneficiaries(): Promise<Beneficiary[]> {
  const { data, error } = await supabase.from('quran_beneficiaries')
    .select('id, name_ar, name_en, image_url, gender, beneficiary_type, phone')
    .order('name_ar');
  if (error) throw error;
  return (data as unknown as Beneficiary[]) || [];
}

export async function getCircleEnrollments(circleId: string): Promise<Beneficiary[]> {
  const { data, error } = await (supabase as any)
    .from('quran_enrollments')
    .select(`beneficiary_id, quran_beneficiaries!inner(id, name_ar, name_en, image_url, gender, beneficiary_type, phone)`)
    .eq('circle_id', circleId)
    .eq('status', 'active');
  if (error) throw error;
  return (data || []).map((e: any) => ({
    id: e.quran_beneficiaries.id,
    name_ar: e.quran_beneficiaries.name_ar,
    name_en: e.quran_beneficiaries.name_en,
    image_url: e.quran_beneficiaries.image_url,
    gender: e.quran_beneficiaries.gender,
    beneficiary_type: e.quran_beneficiaries.beneficiary_type,
    phone: e.quran_beneficiaries.phone,
  }));
}

export async function getCircleSessions(circleId: string): Promise<Session[]> {
  const { data } = await supabase.from('quran_circle_sessions')
    .select('*, quran_circle_beneficiaries(count), quran_circle_organizers(name)')
    .eq('circle_id', circleId)
    .order('session_date', { ascending: false })
    .limit(50);
  return (data || []).map((s: any) => ({
    ...s,
    attendees_count: s.quran_circle_beneficiaries?.[0]?.count || 0,
    organizer_name: s.quran_circle_organizers?.name || null,
  }));
}

export async function getCircleAttendance(sessionIds: string[]): Promise<Record<string, Attendance[]>> {
  if (sessionIds.length === 0) return {};
  const { data } = await supabase.from('quran_circle_beneficiaries')
    .select('session_id, beneficiary_id, attendance_type')
    .in('session_id', sessionIds);

  const attMap: Record<string, Attendance[]> = {};
  (data || []).forEach((a: any) => {
    if (!attMap[a.session_id]) attMap[a.session_id] = [];
    attMap[a.session_id].push({ beneficiary_id: a.beneficiary_id, attendance_type: a.attendance_type || 'memorization' });
  });
  return attMap;
}

export async function getCircleAds(circleId: string): Promise<CircleAd[]> {
  const { data } = await (supabase as any).from('quran_circle_ads').select('*').eq('circle_id', circleId).order('ad_number');
  return data || [];
}

// ─── Mutations ──────────────────────────────────────────────────────

export async function saveCircle(payload: SaveCirclePayload): Promise<string | undefined> {
  const dataToSave = {
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
    const { error } = await supabase.from('quran_circles').update(dataToSave as any).eq('id', circleId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('quran_circles').insert(dataToSave as any).select().single();
    if (error) throw error;
    circleId = (data as any).id;
  }

  if (circleId) {
    await supabase.from('quran_circle_organizers').delete().eq('circle_id', circleId);
    if (payload.organizers.length > 0) {
      await supabase.from('quran_circle_organizers').insert(
        payload.organizers.map(o => ({ circle_id: circleId, volunteer_id: o.volunteer_id || null, name: o.name, phone: o.phone }))
      );
    }
    await (supabase as any).from('quran_circle_marketers').delete().eq('circle_id', circleId);
    if (payload.marketers.length > 0) {
      await (supabase as any).from('quran_circle_marketers').insert(
        payload.marketers.map(m => ({ circle_id: circleId, volunteer_id: m.volunteer_id }))
      );
    }
  }

  return circleId;
}

export async function deleteCircle(circleId: string): Promise<void> {
  const { error } = await supabase.from('quran_circles').delete().eq('id', circleId);
  if (error) throw error;
}

export async function enrollBeneficiary(circleId: string, beneficiaryId: string): Promise<void> {
  const { error } = await (supabase as any).from('quran_enrollments')
    .insert({ circle_id: circleId, beneficiary_id: beneficiaryId, status: 'active' });
  if (error) throw error;
}

export async function unenrollBeneficiary(circleId: string, beneficiaryId: string): Promise<void> {
  const { error } = await (supabase as any).from('quran_enrollments').delete().eq('circle_id', circleId).eq('beneficiary_id', beneficiaryId);
  if (error) throw error;
}

export async function createSession(params: {
  circleId: string; sessionDate: string; notes: string | null; organizerVolunteerId?: string;
}): Promise<any> {
  let resolvedOrganizerId: string | null = null;
  if (params.organizerVolunteerId && params.organizerVolunteerId !== 'none') {
    const { data: orgRow } = await supabase.from('quran_circle_organizers')
      .select('id').eq('circle_id', params.circleId).eq('volunteer_id', params.organizerVolunteerId).single();
    resolvedOrganizerId = orgRow?.id ?? null;
  }
  const { data, error } = await supabase.from('quran_circle_sessions')
    .insert({ circle_id: params.circleId, session_date: params.sessionDate, notes: params.notes, organizer_id: resolvedOrganizerId })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await supabase.from('quran_circle_beneficiaries').delete().eq('session_id', sessionId);
  const { error } = await supabase.from('quran_circle_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

export async function saveAttendance(payload: SaveAttendancePayload): Promise<void> {
  await supabase.from('quran_circle_beneficiaries').delete().eq('session_id', payload.sessionId);

  const guestPhones = [...new Set(payload.guests.map(g => g.phone).filter(Boolean))];
  const guestMap = new Map<string, string>();

  if (guestPhones.length > 0) {
    const { data: existing } = await supabase.from('quran_beneficiaries').select('id, phone').in('phone', guestPhones);
    existing?.forEach((b: any) => guestMap.set(b.phone, b.id));

    const uniqueNew = new Map<string, Guest>();
    payload.guests.filter(g => g.phone && !guestMap.has(g.phone)).forEach(g => uniqueNew.set(g.phone, g));

    if (uniqueNew.size > 0) {
      const toInsert = Array.from(uniqueNew.values()).map(g => ({
        name_ar: g.name, phone: g.phone,
        gender: payload.circleGender === 'female' || payload.circleGender === 'women' ? 'female' : 'male',
        beneficiary_type: payload.circleTargetGroup === 'children' ? 'child' : 'adult',
      }));
      const { data: created, error } = await supabase.from('quran_beneficiaries').insert(toInsert).select('id, phone');
      if (error) throw error;
      created?.forEach((b: any) => guestMap.set(b.phone, b.id));
    }
  }

  const allRecords: any[] = [];
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
