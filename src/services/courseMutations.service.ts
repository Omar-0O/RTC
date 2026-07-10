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
  const { data, error } = await supabase.rpc('save_course_with_relations', {
    p_course_id: courseId,
    p_course: course,
    p_organizers: organizers as unknown as Json,
    p_marketers: marketers as unknown as Json,
    p_trainer_ids: trainerIds,
    p_lecture_dates: lectureDates,
    p_ad_dates: adDates,
  });

  if (error) throw error;
  if (!data) throw new Error('Course save returned no course ID');
  return data;
}
