/**
 * Activity Structure (هيكلة النشاط) — pure tree helpers.
 *
 * No React / Supabase imports so the logic is reusable and unit-testable.
 */

export const STRUCTURE_COLORS = ['primary', 'blue', 'green', 'amber', 'rose', 'violet', 'teal', 'slate'] as const;
export type StructureColor = (typeof STRUCTURE_COLORS)[number];

export const MAX_RESPONSIBILITIES = 30;
export const MAX_TITLE_LENGTH = 120;

export type StructureNodeType = 'volunteer' | 'section';

export interface SquadMemberOption {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  avatar_url: string | null;
}

export interface StructureNode {
  id: string;
  branch_id: string;
  parent_id: string | null;
  volunteer_id: string | null;
  title: string;
  responsibilities: string[];
  color: StructureColor;
  sort_order: number;
  node_type?: StructureNodeType;
  section_id?: string | null;
  board_owner_id?: string | null;
  section_title?: string | null;
  description?: string | null;
  team_image_url?: string | null;
  custom_avatar_url?: string | null;
  squad_volunteer_ids?: string[];
  squad_members?: SquadMemberOption[];
  deputy_id?: string | null;
  deputy_title?: string | null;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
  volunteer_name: string | null;
  volunteer_name_ar: string | null;
  volunteer_avatar: string | null;
  deputy_name?: string | null;
  deputy_name_ar?: string | null;
  deputy_avatar?: string | null;
  committee_name: string | null;
  committee_name_ar: string | null;
}

export interface RootBoardMeta {
  branch_id: string;
  title: string | null;
  description: string | null;
  team_image_url: string | null;
}

export interface StructureEdge {
  id: string;
  branch_id: string;
  source_id: string;
  target_id: string;
  label?: string | null;
}

export interface StructureTreeNode {
  node: StructureNode;
  children: StructureTreeNode[];
}

export function isStructureColor(value: unknown): value is StructureColor {
  return typeof value === 'string' && (STRUCTURE_COLORS as readonly string[]).includes(value);
}

const compareNodes = (a: StructureNode, b: StructureNode): number =>
  a.sort_order - b.sort_order || a.title.localeCompare(b.title);

/** Group nodes by parent id. Nodes whose parent is missing are treated as roots. */
function groupByParent(nodes: readonly StructureNode[]): Map<string | null, StructureNode[]> {
  const ids = new Set(nodes.map((n) => n.id));
  const groups = new Map<string | null, StructureNode[]>();
  for (const node of nodes) {
    const key = node.parent_id && ids.has(node.parent_id) && node.parent_id !== node.id ? node.parent_id : null;
    const list = groups.get(key);
    if (list) list.push(node);
    else groups.set(key, [node]);
  }
  for (const list of groups.values()) list.sort(compareNodes);
  return groups;
}

/**
 * Build a forest from a flat list. Cycle-safe: a node is placed at most once;
 * nodes trapped in a cycle (unreachable from any root) are promoted to roots.
 */
export function buildStructureTree(nodes: readonly StructureNode[]): StructureTreeNode[] {
  const groups = groupByParent(nodes);
  const placed = new Set<string>();

  const build = (node: StructureNode): StructureTreeNode => {
    placed.add(node.id);
    const children = (groups.get(node.id) ?? [])
      .filter((child) => !placed.has(child.id))
      .map(build);
    return { node, children };
  };

  const roots = (groups.get(null) ?? []).map(build);

  for (const node of [...nodes].sort(compareNodes)) {
    if (!placed.has(node.id)) roots.push(build(node));
  }
  return roots;
}

/** All ids below `nodeId` (excluding itself). */
export function getDescendantIds(nodes: readonly StructureNode[], nodeId: string): Set<string> {
  const groups = groupByParent(nodes);
  const result = new Set<string>();
  const stack = [...(groups.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop() as StructureNode;
    if (result.has(current.id) || current.id === nodeId) continue;
    result.add(current.id);
    stack.push(...(groups.get(current.id) ?? []));
  }
  return result;
}

/** A node can report to `newParentId` only if that is not itself or one of its subordinates. */
export function canReparent(nodes: readonly StructureNode[], nodeId: string, newParentId: string | null): boolean {
  if (newParentId === null) return true;
  if (newParentId === nodeId) return false;
  if (!nodes.some((n) => n.id === newParentId)) return false;
  return !getDescendantIds(nodes, nodeId).has(newParentId);
}

/** Managers from the direct manager up to the top of the structure. Cycle-safe. */
export function getChainOfCommand(nodes: readonly StructureNode[], nodeId: string): StructureNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: StructureNode[] = [];
  const seen = new Set<string>([nodeId]);
  let parentId = byId.get(nodeId)?.parent_id ?? null;
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    chain.push(parent);
    seen.add(parentId);
    parentId = parent.parent_id;
  }
  return chain;
}

/** Direct reports of a node, ordered for display. */
export function getDirectReports(nodes: readonly StructureNode[], nodeId: string): StructureNode[] {
  return nodes.filter((n) => n.parent_id === nodeId && n.id !== nodeId).sort(compareNodes);
}

/** Case-insensitive match on title, volunteer names, committee and responsibilities. */
export function matchesStructureSearch(node: StructureNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return [
    node.title,
    node.section_title,
    node.volunteer_name,
    node.volunteer_name_ar,
    node.deputy_name,
    node.deputy_name_ar,
    node.deputy_title,
    node.committee_name,
    node.committee_name_ar,
    ...node.responsibilities,
  ].some((value) => typeof value === 'string' && value.toLowerCase().includes(q));
}

/** Ids of matching nodes plus all of their ancestors (so matches stay visible when collapsed). */
export function getSearchVisibleIds(nodes: readonly StructureNode[], query: string): Set<string> {
  const visible = new Set<string>();
  for (const node of nodes) {
    if (!matchesStructureSearch(node, query)) continue;
    visible.add(node.id);
    for (const ancestor of getChainOfCommand(nodes, node.id)) visible.add(ancestor.id);
  }
  return visible;
}

/** Parse a multi-line textarea into a clean, de-duplicated responsibilities list. */
export function parseResponsibilities(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const item = raw.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item.slice(0, 300));
    if (result.length >= MAX_RESPONSIBILITIES) break;
  }
  return result;
}

/** Next sort_order for a new child under `parentId`. */
export function nextSortOrder(nodes: readonly StructureNode[], parentId: string | null): number {
  const siblings = nodes.filter((n) => (n.parent_id ?? null) === parentId);
  return siblings.reduce((max, n) => Math.max(max, n.sort_order), -1) + 1;
}

export function getVolunteerName(node: StructureNode, isRTL: boolean): string | null {
  return (isRTL ? node.volunteer_name_ar || node.volunteer_name : node.volunteer_name || node.volunteer_name_ar) || null;
}

export function getDeputyName(node: StructureNode, isRTL: boolean): string | null {
  return (isRTL ? node.deputy_name_ar || node.deputy_name : node.deputy_name || node.deputy_name_ar) || null;
}

export function getCommitteeName(node: StructureNode, isRTL: boolean): string | null {
  return (isRTL ? node.committee_name_ar || node.committee_name : node.committee_name || node.committee_name_ar) || null;
}

export function getInitials(name: string | null): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Auto-layout positions for top-level board items (nodes without section_id). */
export function computeAutoLayoutPositions(
  nodes: readonly StructureNode[],
  edges: readonly StructureEdge[]
): Map<string, { pos_x: number; pos_y: number }> {
  const topLevel = nodes.filter((n) => !n.section_id);
  const topIds = new Set(topLevel.map((n) => n.id));
  const childrenMap = new Map<string, string[]>();
  const hasIncoming = new Set<string>();

  for (const e of edges) {
    if (!topIds.has(e.source_id) || !topIds.has(e.target_id) || e.source_id === e.target_id) continue;
    hasIncoming.add(e.target_id);
    const list = childrenMap.get(e.source_id);
    if (list) list.push(e.target_id);
    else childrenMap.set(e.source_id, [e.target_id]);
  }

  for (const n of topLevel) {
    if (n.parent_id && topIds.has(n.parent_id) && n.parent_id !== n.id && !hasIncoming.has(n.id)) {
      hasIncoming.add(n.id);
      const list = childrenMap.get(n.parent_id);
      if (list) list.push(n.id);
      else childrenMap.set(n.parent_id, [n.id]);
    }
  }

  const roots = topLevel.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
  if (roots.length === 0 && topLevel.length > 0) roots.push(topLevel[0].id);

  const levelOf = new Map<string, number>();
  const queue: string[] = [];
  for (const r of roots) {
    levelOf.set(r, 0);
    queue.push(r);
  }
  while (queue.length > 0) {
    const curr = queue.shift() as string;
    const lvl = levelOf.get(curr) ?? 0;
    for (const child of childrenMap.get(curr) ?? []) {
      if (!levelOf.has(child)) {
        levelOf.set(child, lvl + 1);
        queue.push(child);
      }
    }
  }
  for (const n of topLevel) {
    if (!levelOf.has(n.id)) levelOf.set(n.id, 0);
  }

  const byLevel = new Map<number, StructureNode[]>();
  for (const n of topLevel) {
    const lvl = levelOf.get(n.id) ?? 0;
    const list = byLevel.get(lvl);
    if (list) list.push(n);
    else byLevel.set(lvl, [n]);
  }

  const positions = new Map<string, { pos_x: number; pos_y: number }>();
  const ROW_GAP = 280;
  const COL_GAP = 260;

  for (const [lvl, items] of byLevel.entries()) {
    const totalWidth = items.reduce((acc, item) => acc + (item.node_type === 'section' ? (item.width ?? 340) + 60 : COL_GAP), 0);
    let cursorX = Math.max(80, 600 - totalWidth / 2);
    const y = 80 + lvl * ROW_GAP;
    for (const item of items) {
      positions.set(item.id, { pos_x: Math.round(cursorX), pos_y: Math.round(y) });
      cursorX += item.node_type === 'section' ? (item.width ?? 340) + 60 : COL_GAP;
    }
  }

  return positions;
}

/** Breadcrumb chain from root down to `activeBoardOwnerId`. Cycle-safe. */
export function getBoardBreadcrumb(
  nodes: readonly StructureNode[],
  activeBoardOwnerId: string | null
): StructureNode[] {
  if (!activeBoardOwnerId) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: StructureNode[] = [];
  const seen = new Set<string>();
  let currId: string | null = activeBoardOwnerId;
  while (currId && !seen.has(currId)) {
    const node = byId.get(currId);
    if (!node) break;
    chain.unshift(node);
    seen.add(currId);
    currId = node.board_owner_id ?? null;
  }
  return chain;
}

export interface SectionMemberThumb {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  color: StructureColor;
}

/**
 * Collect volunteers appearing around `ownerId`:
 * 1) Manually curated "الفرقة" (`squad_members`) — works even without a section.
 * 2) Direct members inside `ownerId`'s section board (`board_owner_id === ownerId`).
 * Sub-sections owned by those members belong strictly to their own owners.
 */
export function getRecursiveSectionMembers(
  nodes: readonly StructureNode[],
  ownerId: string,
  isRTL: boolean
): SectionMemberThumb[] {
  let ownerNode: StructureNode | null = null;
  const directChildren: StructureNode[] = [];

  for (const n of nodes) {
    if (n.id === ownerId) ownerNode = n;
    if (n.board_owner_id === ownerId && n.node_type !== 'section') {
      directChildren.push(n);
    }
  }
  directChildren.sort(compareNodes);

  const result: SectionMemberThumb[] = [];
  const seenVolunteers = new Set<string>();
  if (ownerNode?.volunteer_id) seenVolunteers.add(ownerNode.volunteer_id);

  // 1. Curated "الفرقة" members (independent of having a section)
  for (const sq of ownerNode?.squad_members ?? []) {
    if (!sq.id || seenVolunteers.has(sq.id)) continue;
    seenVolunteers.add(sq.id);
    const sqName = (isRTL ? sq.full_name_ar || sq.full_name : sq.full_name || sq.full_name_ar) || null;
    result.push({
      id: sq.id,
      name: sqName,
      avatarUrl: sq.avatar_url,
      color: ownerNode?.color ?? 'primary',
    });
  }

  // 2. Direct section board members
  for (const child of directChildren) {
    if (child.volunteer_id && !seenVolunteers.has(child.volunteer_id)) {
      seenVolunteers.add(child.volunteer_id);
      result.push({
        id: child.volunteer_id,
        name: getVolunteerName(child, isRTL),
        avatarUrl: child.volunteer_avatar,
        color: child.color,
      });
    }
    if (child.deputy_id && !seenVolunteers.has(child.deputy_id)) {
      seenVolunteers.add(child.deputy_id);
      result.push({
        id: child.deputy_id,
        name: getDeputyName(child, isRTL),
        avatarUrl: child.deputy_avatar ?? null,
        color: child.color,
      });
    }
  }

  return result;
}

/**
 * Compute a clean, non-overlapping hierarchical pyramid layout based on
 * reporting edges (`label !== 'deputy'`) and side-by-side deputy edges (`label === 'deputy'`).
 * Every parent (or Head + Deputy pair) is centered over its subtree.
 */
export function computePyramidLayoutPositions(
  nodes: readonly StructureNode[],
  edges: readonly StructureEdge[],
  isRTL = true,
  baseY = 80
): Map<string, { pos_x: number; pos_y: number }> {
  const positions = new Map<string, { pos_x: number; pos_y: number }>();
  if (nodes.length === 0) return positions;

  const CARD_W = 176;
  const H_GAP = 56;
  const DEPUTY_GAP = 192;
  const ROW_GAP = 270;

  const sortedNodes = [...nodes].sort(compareNodes);
  const byId = new Map(sortedNodes.map((n) => [n.id, n]));

  // 1. Pair deputies with their Head (each deputy attached to at most one head)
  const deputyHeadOf = new Map<string, string>();
  const deputiesOf = new Map<string, StructureNode[]>();
  for (const e of edges) {
    if (e.label !== 'deputy') continue;
    if (!byId.has(e.source_id) || !byId.has(e.target_id) || e.source_id === e.target_id) continue;
    if (deputyHeadOf.has(e.target_id)) continue;
    deputyHeadOf.set(e.target_id, e.source_id);
    const depNode = byId.get(e.target_id) as StructureNode;
    const list = deputiesOf.get(e.source_id);
    if (list) list.push(depNode);
    else deputiesOf.set(e.source_id, [depNode]);
  }
  for (const list of deputiesOf.values()) list.sort(compareNodes);

  // 2. Build strict hierarchy forest (each non-deputy node has at most one parent)
  const hasParent = new Set<string>();
  const rawChildren = new Map<string, StructureNode[]>();
  for (const e of edges) {
    if (e.label === 'deputy') continue;
    if (!byId.has(e.source_id) || !byId.has(e.target_id) || e.source_id === e.target_id) continue;
    if (deputyHeadOf.has(e.target_id) || hasParent.has(e.target_id)) continue;
    hasParent.add(e.target_id);
    const child = byId.get(e.target_id) as StructureNode;
    const list = rawChildren.get(e.source_id);
    if (list) list.push(child);
    else rawChildren.set(e.source_id, [child]);
  }
  for (const list of rawChildren.values()) list.sort(compareNodes);

  // Collect cycle-safe tree children (including any children attached to a unit's deputies)
  const treeChildren = new Map<string, StructureNode[]>();
  const visited = new Set<string>();

  const buildTree = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const deps = deputiesOf.get(nodeId) ?? [];
    for (const d of deps) visited.add(d.id);

    const direct = [...(rawChildren.get(nodeId) ?? []), ...deps.flatMap((d) => rawChildren.get(d.id) ?? [])];
    const uniqueChildren: StructureNode[] = [];
    for (const c of direct) {
      if (!visited.has(c.id)) {
        uniqueChildren.push(c);
        buildTree(c.id);
      }
    }
    uniqueChildren.sort(compareNodes);
    treeChildren.set(nodeId, uniqueChildren);
  };

  const roots: StructureNode[] = [];
  for (const n of sortedNodes) {
    if (!hasParent.has(n.id) && !deputyHeadOf.has(n.id) && !visited.has(n.id)) {
      roots.push(n);
      buildTree(n.id);
    }
  }
  // Promote any remaining nodes (e.g. trapped in a cycle) to roots
  for (const n of sortedNodes) {
    if (!visited.has(n.id) && !deputyHeadOf.has(n.id)) {
      roots.push(n);
      buildTree(n.id);
    }
  }

  // 3. Bottom-up subtree widths
  const unitWidth = (id: string): number => CARD_W + (deputiesOf.get(id)?.length ?? 0) * DEPUTY_GAP;
  const subtreeW = new Map<string, number>();

  const calcWidth = (id: string): number => {
    const children = treeChildren.get(id) ?? [];
    if (children.length === 0) {
      const w = unitWidth(id);
      subtreeW.set(id, w);
      return w;
    }
    const childrenSum = children.reduce((acc, c) => acc + calcWidth(c.id), 0) + H_GAP * (children.length - 1);
    const w = Math.max(unitWidth(id), childrenSum);
    subtreeW.set(id, w);
    return w;
  };
  for (const r of roots) calcWidth(r.id);

  // 4. Top-down placement centered around x = 500
  const place = (id: string, leftX: number, level: number) => {
    const y = baseY + level * ROW_GAP;
    const w = subtreeW.get(id) ?? CARD_W;
    const uW = unitWidth(id);
    const unitLeft = leftX + (w - uW) / 2;
    const deps = deputiesOf.get(id) ?? [];

    const headX = isRTL ? unitLeft + uW - CARD_W : unitLeft;
    positions.set(id, { pos_x: Math.round(headX), pos_y: Math.round(y) });

    deps.forEach((dep, idx) => {
      const depX = isRTL ? headX - (idx + 1) * DEPUTY_GAP : headX + (idx + 1) * DEPUTY_GAP;
      positions.set(dep.id, { pos_x: Math.round(depX), pos_y: Math.round(y + 8) });
    });

    const children = treeChildren.get(id) ?? [];
    if (children.length > 0) {
      const childrenSum =
        children.reduce((acc, c) => acc + (subtreeW.get(c.id) ?? CARD_W), 0) + H_GAP * (children.length - 1);
      let cursor = leftX + (w - childrenSum) / 2;
      for (const child of children) {
        const cw = subtreeW.get(child.id) ?? CARD_W;
        place(child.id, cursor, level + 1);
        cursor += cw + H_GAP;
      }
    }
  };

  const ROOT_GAP = Math.round(H_GAP * 1.4);
  const totalRootsW =
    roots.reduce((acc, r) => acc + (subtreeW.get(r.id) ?? CARD_W), 0) + ROOT_GAP * Math.max(0, roots.length - 1);
  let rootCursor = 500 - totalRootsW / 2;
  for (const r of roots) {
    const rw = subtreeW.get(r.id) ?? CARD_W;
    place(r.id, rootCursor, 0);
    rootCursor += rw + ROOT_GAP;
  }

  return positions;
}
