/**
 * Activity Structure service (هيكلة النشاط) — all Supabase calls.
 *
 * Reads go through the SECURITY DEFINER RPC `get_activity_structure_board` which
 * returns nodes (volunteers & sections) and free-form edges. Writes go to the
 * tables and are authorized by RLS (`can_manage_activity_structure`).
 *
 * Reusable outside React (no hooks, no React imports).
 */
import { supabase } from '@/integrations/supabase/client';
import { unwrap } from './api';
import {
  MAX_TITLE_LENGTH,
  isStructureColor,
  type RootBoardMeta,
  type StructureColor,
  type StructureEdge,
  type StructureNode,
  type StructureNodeType,
} from '@/utils/activityStructureTree';

export type { RootBoardMeta, StructureNode, StructureEdge, StructureColor, StructureNodeType } from '@/utils/activityStructureTree';

export interface ActivityStructureBoardData {
  nodes: StructureNode[];
  edges: StructureEdge[];
  rootMeta: RootBoardMeta | null;
}

export interface StructureVolunteerOption {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  avatar_url: string | null;
}

export interface SaveStructureNodeInput {
  title: string;
  volunteer_id: string | null;
  parent_id: string | null;
  responsibilities: string[];
  color: StructureColor;
  node_type?: StructureNodeType;
  section_id?: string | null;
  board_owner_id?: string | null;
  section_title?: string | null;
  description?: string | null;
  team_image_url?: string | null;
  deputy_id?: string | null;
  deputy_title?: string | null;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
}

function sanitizeInput(input: SaveStructureNodeInput) {
  const title = input.title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!title) throw new Error('Title is required');
  const nodeType: StructureNodeType = input.node_type === 'section' ? 'section' : 'volunteer';
  return {
    title,
    volunteer_id: nodeType === 'section' ? null : (input.volunteer_id || null),
    parent_id: input.parent_id || null,
    responsibilities: input.responsibilities.map((r) => r.trim()).filter(Boolean),
    color: isStructureColor(input.color) ? input.color : 'primary',
    node_type: nodeType,
    section_id: nodeType === 'section' ? null : (input.section_id || null),
    ...(input.board_owner_id !== undefined ? { board_owner_id: input.board_owner_id || null } : {}),
    section_title: input.section_title?.trim() || null,
    description: input.description?.trim() || null,
    team_image_url: input.team_image_url?.trim() || null,
    deputy_id: nodeType === 'section' ? null : (input.deputy_id || null),
    deputy_title: nodeType === 'section' ? null : (input.deputy_title?.trim() || null),
    ...(typeof input.pos_x === 'number' ? { pos_x: Math.round(input.pos_x) } : {}),
    ...(typeof input.pos_y === 'number' ? { pos_y: Math.round(input.pos_y) } : {}),
    ...(typeof input.width === 'number' ? { width: Math.round(input.width) } : {}),
    ...(typeof input.height === 'number' ? { height: Math.round(input.height) } : {}),
  };
}

export async function getActivityStructureBoard(
  branchId: string,
  client: typeof supabase = supabase
): Promise<ActivityStructureBoardData> {
  const raw = unwrap(await client.rpc('get_activity_structure_board', { _branch_id: branchId })) as
    | { nodes?: unknown[]; edges?: unknown[]; root_meta?: Record<string, unknown> | null }
    | null;

  const rawNodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const rawEdges = Array.isArray(raw?.edges) ? raw.edges : [];

  const nodes: StructureNode[] = rawNodes.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id),
      branch_id: String(row.branch_id),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      volunteer_id: row.volunteer_id ? String(row.volunteer_id) : null,
      title: String(row.title ?? ''),
      responsibilities: Array.isArray(row.responsibilities) ? row.responsibilities.map(String) : [],
      color: isStructureColor(row.color) ? row.color : 'primary',
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
      node_type: row.node_type === 'section' ? 'section' : 'volunteer',
      section_id: row.section_id ? String(row.section_id) : null,
      board_owner_id: row.board_owner_id ? String(row.board_owner_id) : null,
      section_title: row.section_title ? String(row.section_title) : null,
      description: row.description ? String(row.description) : null,
      team_image_url: row.team_image_url ? String(row.team_image_url) : null,
      deputy_id: row.deputy_id ? String(row.deputy_id) : null,
      deputy_title: row.deputy_title ? String(row.deputy_title) : null,
      pos_x: typeof row.pos_x === 'number' ? row.pos_x : 0,
      pos_y: typeof row.pos_y === 'number' ? row.pos_y : 0,
      width: typeof row.width === 'number' ? row.width : 320,
      height: typeof row.height === 'number' ? row.height : 220,
      volunteer_name: row.volunteer_name ? String(row.volunteer_name) : null,
      volunteer_name_ar: row.volunteer_name_ar ? String(row.volunteer_name_ar) : null,
      volunteer_avatar: row.volunteer_avatar ? String(row.volunteer_avatar) : null,
      deputy_name: row.deputy_name ? String(row.deputy_name) : null,
      deputy_name_ar: row.deputy_name_ar ? String(row.deputy_name_ar) : null,
      deputy_avatar: row.deputy_avatar ? String(row.deputy_avatar) : null,
      committee_name: row.committee_name ? String(row.committee_name) : null,
      committee_name_ar: row.committee_name_ar ? String(row.committee_name_ar) : null,
    };
  });

  const edges: StructureEdge[] = rawEdges.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id),
      branch_id: String(row.branch_id),
      source_id: String(row.source_id),
      target_id: String(row.target_id),
      label: row.label ? String(row.label) : null,
    };
  });

  const rawMeta = raw?.root_meta;
  const rootMeta: RootBoardMeta | null = rawMeta
    ? {
        branch_id: String(rawMeta.branch_id ?? branchId),
        title: rawMeta.title ? String(rawMeta.title) : null,
        description: rawMeta.description ? String(rawMeta.description) : null,
        team_image_url: rawMeta.team_image_url ? String(rawMeta.team_image_url) : null,
      }
    : null;

  return { nodes, edges, rootMeta };
}

export async function getStructureVolunteers(branchId: string): Promise<StructureVolunteerOption[]> {
  const data = unwrap(
    await supabase
      .from('profiles')
      .select('id, full_name, full_name_ar, avatar_url')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('full_name_ar', { ascending: true })
  );
  return (data ?? []) as StructureVolunteerOption[];
}

export async function canManageActivityStructure(branchId: string): Promise<boolean> {
  const data = unwrap(await supabase.rpc('can_manage_activity_structure', { _branch_id: branchId }));
  return data === true;
}

export async function createStructureNode(
  branchId: string,
  input: SaveStructureNodeInput,
  sortOrder: number
): Promise<string> {
  const data = unwrap(
    await supabase
      .from('activity_structure_nodes')
      .insert({ ...sanitizeInput(input), branch_id: branchId, sort_order: sortOrder })
      .select('id')
      .single()
  );
  return data.id;
}

export async function updateStructureNode(id: string, input: SaveStructureNodeInput): Promise<void> {
  unwrap(await supabase.from('activity_structure_nodes').update(sanitizeInput(input)).eq('id', id));
}

export async function updateNodePosition(id: string, pos_x: number, pos_y: number): Promise<void> {
  unwrap(
    await supabase
      .from('activity_structure_nodes')
      .update({ pos_x: Math.round(pos_x), pos_y: Math.round(pos_y) })
      .eq('id', id)
  );
}

export async function updateNodePositionsBatch(
  updates: Array<{ id: string; pos_x: number; pos_y: number }>
): Promise<void> {
  await Promise.all(updates.map((u) => updateNodePosition(u.id, u.pos_x, u.pos_y)));
}

export async function assignNodeToSection(id: string, sectionId: string | null): Promise<void> {
  unwrap(
    await supabase
      .from('activity_structure_nodes')
      .update({ section_id: sectionId })
      .eq('id', id)
  );
}

export async function deleteStructureNode(id: string): Promise<void> {
  unwrap(await supabase.from('activity_structure_nodes').delete().eq('id', id));
}

export async function createStructureEdge(
  branchId: string,
  sourceId: string,
  targetId: string,
  label?: string | null
): Promise<void> {
  if (sourceId === targetId) return;
  const { error } = await supabase
    .from('activity_structure_edges')
    .insert({ branch_id: branchId, source_id: sourceId, target_id: targetId, label: label?.trim() || null });
  // Ignore unique violation if edge already exists
  if (error && error.code !== '23505') {
    throw error;
  }
}

export async function deleteStructureEdge(id: string): Promise<void> {
  unwrap(await supabase.from('activity_structure_edges').delete().eq('id', id));
}

export async function uploadSectionTeamImage(branchId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `structure-sections/${branchId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function upsertRootBoardMeta(
  branchId: string,
  meta: { title: string | null; description: string | null; team_image_url: string | null }
): Promise<void> {
  unwrap(
    await supabase.from('activity_structure_root_meta').upsert(
      {
        branch_id: branchId,
        title: meta.title?.trim() || null,
        description: meta.description?.trim() || null,
        team_image_url: meta.team_image_url?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'branch_id' }
    )
  );
}
