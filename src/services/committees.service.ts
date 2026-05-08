/**
 * Committees service — all committee-related Supabase calls.
 *
 * Reusable outside React (no hooks, no React imports).
 */
import { supabase } from '@/integrations/supabase/client';
import { unwrap } from './api';

export interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

export async function getCommittees(): Promise<Committee[]> {
  const data = unwrap(
    await supabase
      .from('committees')
      .select('id, name, name_ar')
      .order('name')
  );
  return (data || []) as Committee[];
}
