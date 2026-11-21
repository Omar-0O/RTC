/**
 * Activity Structure (هيكلة النشاط) — pure local draft, Undo/Redo history & diff helpers.
 *
 * Keeps all board edits strictly in local memory until the user explicitly clicks Save,
 * and produces an FK-safe idempotent diff when committing to Supabase.
 */
import type { SaveStructureNodeInput, StructureVolunteerOption } from '@/services/activityStructure.service';
import {
  MAX_TITLE_LENGTH,
  isStructureColor,
  type RootBoardMeta,
  type SquadMemberOption,
  type StructureEdge,
  type StructureNode,
  type StructureNodeType,
} from './activityStructureTree';

export const MAX_DRAFT_HISTORY = 50;

export interface BoardSnapshot {
  nodes: StructureNode[];
  edges: StructureEdge[];
  rootMeta: RootBoardMeta | null;
}

export interface DraftHistoryState {
  branchId: string;
  base: BoardSnapshot;
  present: BoardSnapshot;
  past: BoardSnapshot[];
  future: BoardSnapshot[];
}

export interface BoardDraftDiff {
  deletedEdgeIds: string[];
  createdNodes: StructureNode[];
  updatedNodes: StructureNode[];
  positionUpdates: Array<{ id: string; pos_x: number; pos_y: number }>;
  deletedNodeIds: string[];
  createdEdges: StructureEdge[];
  updatedEdges: StructureEdge[];
  rootMetaChanged: boolean;
  rootMeta: { title: string | null; description: string | null; team_image_url: string | null } | null;
}

const cloneNode = (node: StructureNode): StructureNode => ({
  ...node,
  responsibilities: [...node.responsibilities],
  squad_volunteer_ids: node.squad_volunteer_ids ? [...node.squad_volunteer_ids] : [],
  squad_members: node.squad_members ? node.squad_members.map((m) => ({ ...m })) : [],
});

const cloneEdge = (edge: StructureEdge): StructureEdge => ({ ...edge });

const cloneRootMeta = (meta: RootBoardMeta | null): RootBoardMeta | null => (meta ? { ...meta } : null);

export function cloneBoardSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    nodes: snapshot.nodes.map(cloneNode),
    edges: snapshot.edges.map(cloneEdge),
    rootMeta: cloneRootMeta(snapshot.rootMeta),
  };
}

export function createDraftHistory(branchId: string, board: BoardSnapshot): DraftHistoryState {
  return {
    branchId,
    base: cloneBoardSnapshot(board),
    present: cloneBoardSnapshot(board),
    past: [],
    future: [],
  };
}

export function applyDraftTransform(
  state: DraftHistoryState,
  transform: (snapshot: BoardSnapshot) => BoardSnapshot
): DraftHistoryState {
  const next = transform(state.present);
  if (next === state.present) return state;
  return {
    ...state,
    present: next,
    past: [...state.past, state.present].slice(-MAX_DRAFT_HISTORY),
    future: [],
  };
}

export function undoDraft(state: DraftHistoryState): DraftHistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return {
    ...state,
    present: previous,
    past: state.past.slice(0, -1),
    future: [state.present, ...state.future].slice(0, MAX_DRAFT_HISTORY),
  };
}

export function redoDraft(state: DraftHistoryState): DraftHistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return {
    ...state,
    present: next,
    past: [...state.past, state.present].slice(-MAX_DRAFT_HISTORY),
    future: state.future.slice(1),
  };
}

export function discardDraft(state: DraftHistoryState): DraftHistoryState {
  if (isDraftDiffEmpty(computeBoardDraftDiff(state.base, state.present))) {
    return state;
  }
  return {
    ...state,
    present: cloneBoardSnapshot(state.base),
    past: [...state.past, state.present].slice(-MAX_DRAFT_HISTORY),
    future: [],
  };
}

export function markDraftSaved(state: DraftHistoryState): DraftHistoryState {
  return {
    ...state,
    base: cloneBoardSnapshot(state.present),
    present: cloneBoardSnapshot(state.present),
    past: [],
    future: [],
  };
}

export function moveDraftNode(snapshot: BoardSnapshot, id: string, pos_x: number, pos_y: number): BoardSnapshot {
  const nextX = Math.round(pos_x);
  const nextY = Math.round(pos_y);
  const idx = snapshot.nodes.findIndex((n) => n.id === id);
  if (idx === -1) return snapshot;
  const current = snapshot.nodes[idx];
  if (Math.round(current.pos_x ?? 0) === nextX && Math.round(current.pos_y ?? 0) === nextY) {
    return snapshot;
  }
  const nodes = snapshot.nodes.map((n, i) => (i === idx ? { ...n, pos_x: nextX, pos_y: nextY } : n));
  return { ...snapshot, nodes };
}

export function batchMoveDraftNodes(
  snapshot: BoardSnapshot,
  updates: ReadonlyArray<{ id: string; pos_x: number; pos_y: number }>
): BoardSnapshot {
  if (updates.length === 0) return snapshot;
  const byId = new Map<string, { pos_x: number; pos_y: number }>();
  for (const u of updates) {
    byId.set(u.id, { pos_x: Math.round(u.pos_x), pos_y: Math.round(u.pos_y) });
  }
  let changed = false;
  const nodes = snapshot.nodes.map((n) => {
    const u = byId.get(n.id);
    if (!u) return n;
    if (Math.round(n.pos_x ?? 0) === u.pos_x && Math.round(n.pos_y ?? 0) === u.pos_y) {
      return n;
    }
    changed = true;
    return { ...n, pos_x: u.pos_x, pos_y: u.pos_y };
  });
  return changed ? { ...snapshot, nodes } : snapshot;
}

function resolveSquadMembers(
  squadIds: readonly string[],
  volunteers: readonly StructureVolunteerOption[],
  existingMembers?: readonly SquadMemberOption[]
): SquadMemberOption[] {
  if (squadIds.length === 0) return [];
  const volunteerMap = new Map(volunteers.map((v) => [v.id, v]));
  const existingMap = new Map((existingMembers ?? []).map((m) => [m.id, m]));
  return squadIds.map((id) => {
    const v = volunteerMap.get(id);
    if (v) {
      return { id: v.id, full_name: v.full_name, full_name_ar: v.full_name_ar, avatar_url: v.avatar_url };
    }
    const prev = existingMap.get(id);
    if (prev) return { ...prev };
    return { id, full_name: null, full_name_ar: null, avatar_url: null };
  });
}

const normalizeNodeType = (value?: StructureNodeType): StructureNodeType =>
  value === 'section' ? 'section' : value === 'joker' ? 'joker' : 'volunteer';

export function createDraftNode(
  snapshot: BoardSnapshot,
  params: {
    id: string;
    branchId: string;
    input: SaveStructureNodeInput;
    sortOrder: number;
    volunteers: readonly StructureVolunteerOption[];
    activeBoardOwnerId: string | null;
    autoEdgeId?: string;
  }
): BoardSnapshot {
  const title = params.input.title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!title) return snapshot;

  const nodeType = normalizeNodeType(params.input.node_type);
  const volunteerId = nodeType === 'section' ? null : (params.input.volunteer_id || null);
  const matchedVol = volunteerId ? params.volunteers.find((v) => v.id === volunteerId) ?? null : null;
  const customAvatarUrl = nodeType === 'section' ? null : (params.input.custom_avatar_url?.trim() || null);
  const squadIds =
    nodeType === 'section' ? [] : Array.from(new Set((params.input.squad_volunteer_ids ?? []).filter(Boolean)));
  const boardOwnerId =
    params.input.board_owner_id !== undefined ? (params.input.board_owner_id || null) : params.activeBoardOwnerId;

  const newNode: StructureNode = {
    id: params.id,
    branch_id: params.branchId,
    parent_id: params.input.parent_id || null,
    volunteer_id: volunteerId,
    title,
    responsibilities: params.input.responsibilities.map((r) => r.trim()).filter(Boolean),
    color: isStructureColor(params.input.color) ? params.input.color : 'primary',
    sort_order: params.sortOrder,
    node_type: nodeType,
    section_id: nodeType === 'section' ? null : (params.input.section_id || null),
    board_owner_id: boardOwnerId,
    section_title: params.input.section_title?.trim() || null,
    description: params.input.description?.trim() || null,
    team_image_url: params.input.team_image_url?.trim() || null,
    custom_avatar_url: customAvatarUrl,
    squad_volunteer_ids: squadIds,
    squad_members: resolveSquadMembers(squadIds, params.volunteers),
    deputy_id: nodeType === 'section' ? null : (params.input.deputy_id || null),
    deputy_title: nodeType === 'section' ? null : (params.input.deputy_title?.trim() || null),
    pos_x: typeof params.input.pos_x === 'number' ? Math.round(params.input.pos_x) : 0,
    pos_y: typeof params.input.pos_y === 'number' ? Math.round(params.input.pos_y) : 0,
    width: typeof params.input.width === 'number' ? Math.round(params.input.width) : 320,
    height: typeof params.input.height === 'number' ? Math.round(params.input.height) : 220,
    volunteer_name: matchedVol?.full_name ?? null,
    volunteer_name_ar: matchedVol?.full_name_ar ?? null,
    volunteer_avatar: customAvatarUrl || matchedVol?.avatar_url || null,
    deputy_name: null,
    deputy_name_ar: null,
    deputy_avatar: null,
    committee_name: null,
    committee_name_ar: null,
  };

  const nextEdges = [...snapshot.edges];
  if (params.activeBoardOwnerId && params.activeBoardOwnerId !== params.id && nodeType !== 'joker') {
    nextEdges.push({
      id: params.autoEdgeId ?? crypto.randomUUID(),
      branch_id: params.branchId,
      source_id: params.activeBoardOwnerId,
      target_id: params.id,
      label: null,
    });
  }

  return {
    ...snapshot,
    nodes: [...snapshot.nodes, newNode],
    edges: nextEdges,
  };
}

export function updateDraftNode(
  snapshot: BoardSnapshot,
  id: string,
  input: SaveStructureNodeInput,
  volunteers: readonly StructureVolunteerOption[]
): BoardSnapshot {
  const idx = snapshot.nodes.findIndex((n) => n.id === id);
  if (idx === -1) return snapshot;

  const existing = snapshot.nodes[idx];
  const title = input.title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!title) return snapshot;

  const nodeType = normalizeNodeType(input.node_type);
  const volunteerId = nodeType === 'section' ? null : (input.volunteer_id || null);
  const matchedVol = volunteerId ? volunteers.find((v) => v.id === volunteerId) ?? null : null;
  const customAvatarUrl = nodeType === 'section' ? null : (input.custom_avatar_url?.trim() || null);
  const squadIds =
    nodeType === 'section'
      ? []
      : input.squad_volunteer_ids !== undefined
        ? Array.from(new Set(input.squad_volunteer_ids.filter(Boolean)))
        : (existing.squad_volunteer_ids ?? []);

  let volunteerName: string | null = null;
  let volunteerNameAr: string | null = null;
  let volunteerAvatar: string | null = customAvatarUrl;

  if (volunteerId) {
    if (matchedVol) {
      volunteerName = matchedVol.full_name;
      volunteerNameAr = matchedVol.full_name_ar;
      volunteerAvatar = customAvatarUrl || matchedVol.avatar_url || null;
    } else if (volunteerId === existing.volunteer_id) {
      volunteerName = existing.volunteer_name;
      volunteerNameAr = existing.volunteer_name_ar;
      volunteerAvatar =
        customAvatarUrl ||
        (existing.custom_avatar_url && existing.volunteer_avatar === existing.custom_avatar_url
          ? null
          : existing.volunteer_avatar);
    }
  }

  const nextNode: StructureNode = {
    ...existing,
    title,
    volunteer_id: volunteerId,
    parent_id: input.parent_id || null,
    responsibilities: input.responsibilities.map((r) => r.trim()).filter(Boolean),
    color: isStructureColor(input.color) ? input.color : 'primary',
    node_type: nodeType,
    section_id: nodeType === 'section' ? null : (input.section_id || null),
    board_owner_id: input.board_owner_id !== undefined ? (input.board_owner_id || null) : (existing.board_owner_id ?? null),
    section_title: input.section_title?.trim() || null,
    description: input.description?.trim() || null,
    team_image_url: input.team_image_url?.trim() || null,
    custom_avatar_url: customAvatarUrl,
    squad_volunteer_ids: squadIds,
    squad_members: resolveSquadMembers(squadIds, volunteers, existing.squad_members),
    deputy_id: nodeType === 'section' ? null : (input.deputy_id || null),
    deputy_title: nodeType === 'section' ? null : (input.deputy_title?.trim() || null),
    pos_x: typeof input.pos_x === 'number' ? Math.round(input.pos_x) : existing.pos_x,
    pos_y: typeof input.pos_y === 'number' ? Math.round(input.pos_y) : existing.pos_y,
    width: typeof input.width === 'number' ? Math.round(input.width) : existing.width,
    height: typeof input.height === 'number' ? Math.round(input.height) : existing.height,
    volunteer_name: volunteerName,
    volunteer_name_ar: volunteerNameAr,
    volunteer_avatar: volunteerAvatar,
  };

  if (
    !hasNodeNonPositionChanged(existing, nextNode) &&
    Math.round(existing.pos_x ?? 0) === Math.round(nextNode.pos_x ?? 0) &&
    Math.round(existing.pos_y ?? 0) === Math.round(nextNode.pos_y ?? 0)
  ) {
    return snapshot;
  }

  const switchedToJokerInSection =
    existing.node_type !== 'joker' && nextNode.node_type === 'joker' && Boolean(existing.board_owner_id);

  const nextEdges = switchedToJokerInSection
    ? snapshot.edges.filter((e) => !(e.source_id === existing.board_owner_id && e.target_id === existing.id))
    : snapshot.edges;

  const nodes = snapshot.nodes.map((n, i) => (i === idx ? nextNode : n));
  return { ...snapshot, nodes, edges: nextEdges };
}

export function deleteDraftNode(snapshot: BoardSnapshot, id: string): BoardSnapshot {
  if (!snapshot.nodes.some((n) => n.id === id)) return snapshot;

  // Cascade sub-boards (board_owner_id) just like Postgres ON DELETE CASCADE
  const toRemove = new Set<string>([id]);
  const queue: string[] = [id];
  while (queue.length > 0) {
    const curr = queue.shift() as string;
    for (const n of snapshot.nodes) {
      if (n.board_owner_id === curr && !toRemove.has(n.id)) {
        toRemove.add(n.id);
        queue.push(n.id);
      }
    }
  }

  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const nodes: StructureNode[] = [];

  for (const n of snapshot.nodes) {
    if (toRemove.has(n.id)) continue;

    // Mimic trg_activity_structure_reattach: walk upward past deleted ancestors
    let nextParentId = n.parent_id;
    const seen = new Set<string>();
    while (nextParentId && toRemove.has(nextParentId) && !seen.has(nextParentId)) {
      seen.add(nextParentId);
      nextParentId = byId.get(nextParentId)?.parent_id ?? null;
    }
    if (nextParentId && toRemove.has(nextParentId)) nextParentId = null;

    const nextSectionId = n.section_id && toRemove.has(n.section_id) ? null : (n.section_id ?? null);
    if (nextParentId !== n.parent_id || nextSectionId !== (n.section_id ?? null)) {
      nodes.push({ ...n, parent_id: nextParentId, section_id: nextSectionId });
    } else {
      nodes.push(n);
    }
  }

  const edges = snapshot.edges.filter((e) => !toRemove.has(e.source_id) && !toRemove.has(e.target_id));
  return { ...snapshot, nodes, edges };
}

export function createDraftEdge(
  snapshot: BoardSnapshot,
  params: { id: string; branchId: string; sourceId: string; targetId: string; label?: string | null }
): BoardSnapshot {
  if (params.sourceId === params.targetId) return snapshot;
  const hasSource = snapshot.nodes.some((n) => n.id === params.sourceId);
  const hasTarget = snapshot.nodes.some((n) => n.id === params.targetId);
  if (!hasSource || !hasTarget) return snapshot;

  const normalizedLabel = params.label?.trim() || null;
  if (normalizedLabel === 'deputy') {
    const deputyExists = snapshot.edges.some(
      (e) =>
        (e.label ?? null) === 'deputy' &&
        ((e.source_id === params.sourceId && e.target_id === params.targetId) ||
          (e.source_id === params.targetId && e.target_id === params.sourceId))
    );
    if (deputyExists) return snapshot;
  }

  const existingIdx = snapshot.edges.findIndex(
    (e) => e.source_id === params.sourceId && e.target_id === params.targetId
  );
  if (existingIdx !== -1) {
    const existing = snapshot.edges[existingIdx];
    if ((existing.label ?? null) === normalizedLabel) return snapshot;
    const edges = snapshot.edges.map((e, i) => (i === existingIdx ? { ...e, label: normalizedLabel } : e));
    return { ...snapshot, edges };
  }

  const newEdge: StructureEdge = {
    id: params.id,
    branch_id: params.branchId,
    source_id: params.sourceId,
    target_id: params.targetId,
    label: normalizedLabel,
  };
  return { ...snapshot, edges: [...snapshot.edges, newEdge] };
}

export function deleteDraftEdge(snapshot: BoardSnapshot, edgeId: string): BoardSnapshot {
  if (!snapshot.edges.some((e) => e.id === edgeId)) return snapshot;
  return {
    ...snapshot,
    edges: snapshot.edges.filter((e) => e.id !== edgeId),
  };
}

export function updateDraftRootMeta(
  snapshot: BoardSnapshot,
  branchId: string,
  meta: { title: string | null; description: string | null; team_image_url: string | null }
): BoardSnapshot {
  const title = meta.title?.trim() || null;
  const description = meta.description?.trim() || null;
  const team_image_url = meta.team_image_url?.trim() || null;

  const prevTitle = snapshot.rootMeta?.title?.trim() || null;
  const prevDesc = snapshot.rootMeta?.description?.trim() || null;
  const prevImg = snapshot.rootMeta?.team_image_url?.trim() || null;

  if (prevTitle === title && prevDesc === description && prevImg === team_image_url) {
    return snapshot;
  }

  return {
    ...snapshot,
    rootMeta: {
      branch_id: branchId,
      title,
      description,
      team_image_url,
    },
  };
}

function stringArraysEqual(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i += 1) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

function hasNodeNonPositionChanged(a: StructureNode, b: StructureNode): boolean {
  return (
    a.title.trim() !== b.title.trim() ||
    (a.volunteer_id || null) !== (b.volunteer_id || null) ||
    (a.parent_id || null) !== (b.parent_id || null) ||
    !stringArraysEqual(a.responsibilities, b.responsibilities) ||
    a.color !== b.color ||
    a.sort_order !== b.sort_order ||
    (a.node_type ?? 'volunteer') !== (b.node_type ?? 'volunteer') ||
    (a.section_id || null) !== (b.section_id || null) ||
    (a.board_owner_id || null) !== (b.board_owner_id || null) ||
    (a.section_title?.trim() || null) !== (b.section_title?.trim() || null) ||
    (a.description?.trim() || null) !== (b.description?.trim() || null) ||
    (a.team_image_url?.trim() || null) !== (b.team_image_url?.trim() || null) ||
    (a.custom_avatar_url?.trim() || null) !== (b.custom_avatar_url?.trim() || null) ||
    !stringArraysEqual(a.squad_volunteer_ids, b.squad_volunteer_ids) ||
    (a.deputy_id || null) !== (b.deputy_id || null) ||
    (a.deputy_title?.trim() || null) !== (b.deputy_title?.trim() || null) ||
    Math.round(a.width ?? 320) !== Math.round(b.width ?? 320) ||
    Math.round(a.height ?? 220) !== Math.round(b.height ?? 220)
  );
}

/**
 * Topologically orders newly created nodes so referenced parents, section owners,
 * and section nodes are inserted before nodes that depend on them.
 */
export function topologicallySortNodes(
  nodes: readonly StructureNode[],
  existingIds: ReadonlySet<string> = new Set()
): StructureNode[] {
  if (nodes.length <= 1) return [...nodes];

  const pendingIds = new Set(nodes.map((n) => n.id));
  const resolvedIds = new Set(existingIds);
  const placedIds = new Set<string>();
  const result: StructureNode[] = [];
  let remaining = [...nodes];

  const isDepReady = (depId: string | null | undefined) => {
    if (!depId) return true;
    if (resolvedIds.has(depId)) return true;
    return !pendingIds.has(depId);
  };

  while (remaining.length > 0) {
    let progressed = false;
    const nextRemaining: StructureNode[] = [];

    for (const node of remaining) {
      if (isDepReady(node.parent_id) && isDepReady(node.board_owner_id) && isDepReady(node.section_id)) {
        result.push(node);
        resolvedIds.add(node.id);
        placedIds.add(node.id);
        progressed = true;
      } else {
        nextRemaining.push(node);
      }
    }

    remaining = nextRemaining;
    if (!progressed) {
      for (const node of remaining) {
        if (!placedIds.has(node.id)) result.push(node);
      }
      break;
    }
  }

  return result;
}

export function computeBoardDraftDiff(base: BoardSnapshot, draft: BoardSnapshot): BoardDraftDiff {
  const baseNodeMap = new Map(base.nodes.map((n) => [n.id, n]));
  const draftNodeMap = new Map(draft.nodes.map((n) => [n.id, n]));
  const baseNodeIdSet = new Set(base.nodes.map((n) => n.id));

  const createdNodesRaw: StructureNode[] = [];
  const updatedNodes: StructureNode[] = [];
  const positionUpdates: Array<{ id: string; pos_x: number; pos_y: number }> = [];

  for (const draftNode of draft.nodes) {
    const baseNode = baseNodeMap.get(draftNode.id);
    if (!baseNode) {
      createdNodesRaw.push(draftNode);
      continue;
    }

    if (hasNodeNonPositionChanged(baseNode, draftNode)) {
      updatedNodes.push(draftNode);
      continue;
    }

    const bx = Math.round(baseNode.pos_x ?? 0);
    const by = Math.round(baseNode.pos_y ?? 0);
    const dx = Math.round(draftNode.pos_x ?? 0);
    const dy = Math.round(draftNode.pos_y ?? 0);
    if (bx !== dx || by !== dy) {
      positionUpdates.push({ id: draftNode.id, pos_x: dx, pos_y: dy });
    }
  }

  const createdNodes = topologicallySortNodes(createdNodesRaw, baseNodeIdSet);
  const deletedNodeIds = base.nodes.filter((n) => !draftNodeMap.has(n.id)).map((n) => n.id);

  const baseEdgeMap = new Map(base.edges.map((e) => [e.id, e]));
  const draftEdgeMap = new Map(draft.edges.map((e) => [e.id, e]));

  const deletedEdgeIds: string[] = [];
  const createdEdges: StructureEdge[] = [];
  const updatedEdges: StructureEdge[] = [];

  for (const baseEdge of base.edges) {
    const draftEdge = draftEdgeMap.get(baseEdge.id);
    if (!draftEdge || draftEdge.source_id !== baseEdge.source_id || draftEdge.target_id !== baseEdge.target_id) {
      deletedEdgeIds.push(baseEdge.id);
    }
  }

  for (const draftEdge of draft.edges) {
    const baseEdge = baseEdgeMap.get(draftEdge.id);
    if (!baseEdge || baseEdge.source_id !== draftEdge.source_id || baseEdge.target_id !== draftEdge.target_id) {
      createdEdges.push(draftEdge);
    } else if ((baseEdge.label?.trim() || null) !== (draftEdge.label?.trim() || null)) {
      updatedEdges.push(draftEdge);
    }
  }

  const baseMetaNorm = {
    title: base.rootMeta?.title?.trim() || null,
    description: base.rootMeta?.description?.trim() || null,
    team_image_url: base.rootMeta?.team_image_url?.trim() || null,
  };
  const draftMetaNorm = {
    title: draft.rootMeta?.title?.trim() || null,
    description: draft.rootMeta?.description?.trim() || null,
    team_image_url: draft.rootMeta?.team_image_url?.trim() || null,
  };
  const rootMetaChanged =
    baseMetaNorm.title !== draftMetaNorm.title ||
    baseMetaNorm.description !== draftMetaNorm.description ||
    baseMetaNorm.team_image_url !== draftMetaNorm.team_image_url;

  return {
    deletedEdgeIds,
    createdNodes,
    updatedNodes,
    positionUpdates,
    deletedNodeIds,
    createdEdges,
    updatedEdges,
    rootMetaChanged,
    rootMeta: rootMetaChanged ? draftMetaNorm : null,
  };
}

export function isDraftDiffEmpty(diff: BoardDraftDiff): boolean {
  return (
    diff.deletedEdgeIds.length === 0 &&
    diff.createdNodes.length === 0 &&
    diff.updatedNodes.length === 0 &&
    diff.positionUpdates.length === 0 &&
    diff.deletedNodeIds.length === 0 &&
    diff.createdEdges.length === 0 &&
    diff.updatedEdges.length === 0 &&
    !diff.rootMetaChanged
  );
}

export function countDraftChanges(diff: BoardDraftDiff): number {
  return (
    diff.deletedEdgeIds.length +
    diff.createdNodes.length +
    diff.updatedNodes.length +
    diff.positionUpdates.length +
    diff.deletedNodeIds.length +
    diff.createdEdges.length +
    diff.updatedEdges.length +
    (diff.rootMetaChanged ? 1 : 0)
  );
}
