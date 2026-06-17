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

export async function getCommittees(branchId?: string): Promise<Committee[]> {
  let query: any = supabase
    .from('committees')
    .select('id, name, name_ar');

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const data = unwrap(
    await query.order('name')
  );
  return (data || []) as Committee[];
}
