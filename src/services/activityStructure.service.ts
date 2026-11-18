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
  custom_avatar_url?: string | null;
  squad_volunteer_ids?: string[];
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
    custom_avatar_url: nodeType === 'section' ? null : (input.custom_avatar_url?.trim() || null),
    ...(input.squad_volunteer_ids !== undefined
      ? { squad_volunteer_ids: nodeType === 'section' ? [] : Array.from(new Set(input.squad_volunteer_ids.filter(Boolean))) }
      : {}),
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
      custom_avatar_url: row.custom_avatar_url ? String(row.custom_avatar_url) : null,
      squad_volunteer_ids: Array.isArray(row.squad_volunteer_ids) ? row.squad_volunteer_ids.map(String) : [],
      squad_members: Array.isArray(row.squad_members)
        ? row.squad_members.map((m) => {
            const sm = m as Record<string, unknown>;
            return {
              id: String(sm.id),
              full_name: sm.full_name ? String(sm.full_name) : null,
              full_name_ar: sm.full_name_ar ? String(sm.full_name_ar) : null,
              avatar_url: sm.avatar_url ? String(sm.avatar_url) : null,
            };
          })
        : [],
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
  const normalizedLabel = label?.trim() || null;
  const { error } = await supabase
    .from('activity_structure_edges')
    .insert({ branch_id: branchId, source_id: sourceId, target_id: targetId, label: normalizedLabel });
  if (error?.code === '23505') {
    unwrap(
      await supabase
        .from('activity_structure_edges')
        .update({ label: normalizedLabel })
        .eq('source_id', sourceId)
        .eq('target_id', targetId)
    );
    return;
  }
  if (error) {
    throw error;
  }
}

/**
 * Clone `childId` (along with its subordinates via edges and its nested sub-boards)
 * into `parentId`'s section (`board_owner_id = parentId`) as independent copies,
 * so deleting a copy inside `parentId`'s section never deletes the original outside.
 */
export async function cloneSubtreeIntoSection(
  branchId: string,
  parentId: string,
  childId: string,
  nodes: readonly StructureNode[],
  edges: readonly StructureEdge[]
): Promise<boolean> {
  if (parentId === childId) return false;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childNode = byId.get(childId);
  if (!byId.has(parentId) || !childNode) return false;

  const existingInParent = nodes.filter((n) => n.board_owner_id === parentId);
  const alreadyPresent = existingInParent.some(
    (n) => n.volunteer_id === childNode.volunteer_id && n.title === childNode.title
  );
  if (alreadyPresent) return false;

  const clonedIdMap = new Map<string, string>();
  const clonedOrigIds: string[] = [];

  const cloneOne = async (
    orig: StructureNode,
    targetBoardOwnerId: string,
    posX: number,
    posY: number,
    sortOrder: number
  ): Promise<string> => {
    const newId = await createStructureNode(
      branchId,
      {
        title: orig.title,
        volunteer_id: orig.volunteer_id,
        custom_avatar_url: orig.custom_avatar_url ?? null,
        parent_id: null,
        responsibilities: orig.responsibilities,
        color: orig.color,
        node_type: 'volunteer',
        board_owner_id: targetBoardOwnerId,
        section_title: orig.section_title ?? null,
        description: orig.description ?? null,
        team_image_url: orig.team_image_url ?? null,
        pos_x: posX,
        pos_y: posY,
      },
      sortOrder
    );
    clonedIdMap.set(orig.id, newId);
    clonedOrigIds.push(orig.id);
    return newId;
  };

  // 1. Clone the child itself into parent's sub-board
  const baseX = 220 + existingInParent.length * 210;
  const baseY = 260;
  await cloneOne(childNode, parentId, baseX, baseY, existingInParent.length);

  // 2. Clone same-board descendants connected under `childId` (BFS, cycle-safe)
  const sameBoardQueue: string[] = [childId];
  const sameBoardEdgesToCopy: StructureEdge[] = [];
  let offsetIdx = 1;

  while (sameBoardQueue.length > 0) {
    const currOrigId = sameBoardQueue.shift() as string;
    const outgoing = edges.filter((e) => e.source_id === currOrigId);
    for (const edge of outgoing) {
      const target = byId.get(edge.target_id);
      if (!target || target.board_owner_id !== childNode.board_owner_id) continue;
      sameBoardEdgesToCopy.push(edge);
      if (!clonedIdMap.has(target.id)) {
        const dx = (target.pos_x ?? 0) - (childNode.pos_x ?? 0);
        const dy = (target.pos_y ?? 0) - (childNode.pos_y ?? 0);
        const nextX = dx !== 0 || dy !== 0 ? baseX + dx : baseX + offsetIdx * 200;
        const nextY = dx !== 0 || dy !== 0 ? baseY + dy : baseY + 240;
        offsetIdx += 1;
        await cloneOne(target, parentId, nextX, nextY, existingInParent.length + offsetIdx);
        sameBoardQueue.push(target.id);
      }
    }
  }

  for (const edge of sameBoardEdgesToCopy) {
    const newSrc = clonedIdMap.get(edge.source_id);
    const newDst = clonedIdMap.get(edge.target_id);
    if (newSrc && newDst) {
      await createStructureEdge(branchId, newSrc, newDst, edge.label ?? null);
    }
  }

  // 3. Recursively clone nested sub-board members (`board_owner_id === origId`)
  const subBoardQueue = [...clonedOrigIds];
  while (subBoardQueue.length > 0) {
    const origOwnerId = subBoardQueue.shift() as string;
    const newOwnerId = clonedIdMap.get(origOwnerId);
    if (!newOwnerId) continue;

    const subMembers = nodes.filter((n) => n.board_owner_id === origOwnerId);
    for (const sub of subMembers) {
      if (clonedIdMap.has(sub.id)) continue;
      await cloneOne(sub, newOwnerId, sub.pos_x ?? 240, sub.pos_y ?? 260, sub.sort_order);
      subBoardQueue.push(sub.id);
    }

    const subIdSet = new Set(subMembers.map((m) => m.id));
    for (const edge of edges) {
      if (subIdSet.has(edge.source_id) && subIdSet.has(edge.target_id)) {
        const newSrc = clonedIdMap.get(edge.source_id);
        const newDst = clonedIdMap.get(edge.target_id);
        if (newSrc && newDst) {
          await createStructureEdge(branchId, newSrc, newDst, edge.label ?? null);
        }
      }
    }
  }

  return true;
}

export async function deleteStructureEdge(id: string): Promise<void> {
  unwrap(await supabase.from('activity_structure_edges').delete().eq('id', id));
}

async function uploadStructureImage(branchId: string, folder: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${folder}/${branchId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadSectionTeamImage(branchId: string, file: File): Promise<string> {
  return uploadStructureImage(branchId, 'structure-sections', file);
}

export async function uploadNodeCustomAvatar(branchId: string, file: File): Promise<string> {
  return uploadStructureImage(branchId, 'structure-avatars', file);
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
