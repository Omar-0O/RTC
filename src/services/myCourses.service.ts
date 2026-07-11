import { supabase } from '@/integrations/supabase/client';

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
