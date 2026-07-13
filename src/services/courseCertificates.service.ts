import { supabase } from '@/integrations/supabase/client';

const CERTIFICATE_ELIGIBILITY_PERCENTAGE = 75;

export type CertificateEligibilitySummary = {
  eligibleCount: number;
  beneficiaryCount: number;
  persisted: boolean;
};

type SupabaseError = {
  code?: string;
};

const isMissingCertificateColumnsError = (error: unknown): boolean => (
  typeof error === 'object'
  && error !== null
  && (error as SupabaseError).code === '42703'
);

export async function updateCourseCertificateEligibility(
  courseId: string,
): Promise<CertificateEligibilitySummary> {
  const [lecturesResult, beneficiariesResult] = await Promise.all([
    supabase
      .from('course_lectures')
      .select('id')
      .eq('course_id', courseId)
      .eq('status', 'completed'),
    supabase
      .from('course_beneficiaries')
      .select('id, name, phone')
      .eq('course_id', courseId),
  ]);

  if (lecturesResult.error) throw lecturesResult.error;
  if (beneficiariesResult.error) throw beneficiariesResult.error;

  const lectureIds = (lecturesResult.data ?? []).map(lecture => lecture.id);
  const beneficiaries = beneficiariesResult.data ?? [];

  if (beneficiaries.length === 0) {
    return { eligibleCount: 0, beneficiaryCount: 0, persisted: true };
  }

  const attendanceResult = lectureIds.length > 0
    ? await supabase
      .from('course_attendance')
      .select('student_phone')
      .in('lecture_id', lectureIds)
      .eq('status', 'present')
    : { data: [], error: null };

  if (attendanceResult.error) throw attendanceResult.error;

  const attendanceCountByPhone = new Map<string, number>();
  attendanceResult.data.forEach(({ student_phone }) => {
    attendanceCountByPhone.set(
      student_phone,
      (attendanceCountByPhone.get(student_phone) ?? 0) + 1,
    );
  });

  let eligibleCount = 0;
  const eligibilityUpdates = beneficiaries.map((beneficiary) => {
    const presentCount = attendanceCountByPhone.get(beneficiary.phone) ?? 0;
    const attendancePercentage = lectureIds.length > 0
      ? (presentCount / lectureIds.length) * 100
      : 100;
    const isEligible = attendancePercentage >= CERTIFICATE_ELIGIBILITY_PERCENTAGE;

    if (isEligible) eligibleCount++;

    return {
      id: beneficiary.id,
      name: beneficiary.name,
      phone: beneficiary.phone,
      attendance_percentage: Math.round(attendancePercentage * 100) / 100,
      certificate_eligible: isEligible,
    };
  });

  const { error: updateError } = await supabase
    .from('course_beneficiaries')
    .upsert(eligibilityUpdates, { onConflict: 'id' });

  // Older deployments may not have optional certificate columns yet.
  // Eligibility still calculates; persistence waits for that migration.
  if (updateError && !isMissingCertificateColumnsError(updateError)) throw updateError;

  return {
    eligibleCount,
    beneficiaryCount: beneficiaries.length,
    persisted: !updateError,
  };
}
