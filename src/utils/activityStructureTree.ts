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
