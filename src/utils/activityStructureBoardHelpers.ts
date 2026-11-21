/**
 * Activity Structure Board Helpers — pure utilities for:
 * 1) Cross-layer search with breadcrumb context
 * 2) Figma/Miro-style smart snap alignment guides & marquee/group alignment
 * 3) Multi-layer hierarchy builder & search filter for Tree List View
 */
import {
  getBoardBreadcrumb,
  matchesStructureSearch,
  type StructureEdge,
  type StructureNode,
} from './activityStructureTree';

export interface CrossLayerSearchResult {
  node: StructureNode;
  layerOwnerId: string | null;
  layerPath: StructureNode[];
}

export interface BoardCameraView {
  zoom: number;
  pan: { x: number; y: number };
}

export interface SnapRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

export interface LayerTreeEntry {
  node: StructureNode;
  deputies: StructureNode[];
  children: LayerTreeEntry[];
  subBoard: LayerHierarchy | null;
}

export interface LayerHierarchy {
  ownerId: string | null;
  roots: LayerTreeEntry[];
  jokers: StructureNode[];
  totalCount: number;
}

const compareOrder = (a: StructureNode, b: StructureNode): number =>
  a.sort_order - b.sort_order || a.title.localeCompare(b.title);

const hasPrefixMatch = (node: StructureNode, q: string): boolean =>
  [node.volunteer_name, node.volunteer_name_ar, node.title, node.section_title].some(
    (v) => typeof v === 'string' && v.trim().toLowerCase().startsWith(q)
  );

/**
 * Search volunteers, roles, sections, and jokers across all board layers,
 * ranking prefix matches and shallower layers first.
 */
export function searchStructureAcrossLayers(
  nodes: readonly StructureNode[],
  query: string,
  limit = 12
): CrossLayerSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: CrossLayerSearchResult[] = [];
  for (const node of nodes) {
    if (node.node_type === 'section') continue;
    if (!matchesStructureSearch(node, q)) continue;
    const layerOwnerId = node.board_owner_id ?? null;
    const layerPath = getBoardBreadcrumb(nodes, layerOwnerId);
    matches.push({ node, layerOwnerId, layerPath });
  }

  matches.sort((a, b) => {
    const ap = hasPrefixMatch(a.node, q) ? 0 : 1;
    const bp = hasPrefixMatch(b.node, q) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    if (a.layerPath.length !== b.layerPath.length) return a.layerPath.length - b.layerPath.length;
    return compareOrder(a.node, b.node);
  });

  return matches.slice(0, Math.max(0, limit));
}

/**
 * Compute magnetic alignment deltas (`dx`, `dy`) and visual guide segments
 * when dragging a single card or bounding box near sibling cards.
 */
export function computeSnapAlignment(
  movingRect: { x: number; y: number; w: number; h: number },
  targets: readonly SnapRect[],
  threshold = 8
): SnapResult {
  if (targets.length === 0) return { dx: 0, dy: 0, guides: [] };

  const mXPoints = [movingRect.x, movingRect.x + movingRect.w / 2, movingRect.x + movingRect.w];
  const mYPoints = [movingRect.y, movingRect.y + movingRect.h / 2, movingRect.y + movingRect.h];

  let bestDx = 0;
  let bestDistX = threshold + 0.001;
  let bestDy = 0;
  let bestDistY = threshold + 0.001;

  for (const t of targets) {
    const tXPoints = [t.x, t.x + t.w / 2, t.x + t.w];
    for (const mx of mXPoints) {
      for (const tx of tXPoints) {
        const delta = tx - mx;
        const dist = Math.abs(delta);
        if (dist <= threshold && dist < bestDistX) {
          bestDistX = dist;
          bestDx = delta;
        }
      }
    }

    const tYPoints = [t.y, t.y + t.h / 2, t.y + t.h];
    for (const my of mYPoints) {
      for (const ty of tYPoints) {
        const delta = ty - my;
        const dist = Math.abs(delta);
        if (dist <= threshold && dist < bestDistY) {
          bestDistY = dist;
          bestDy = delta;
        }
      }
    }
  }

  const dx = bestDistX <= threshold ? Math.round(bestDx) : 0;
  const dy = bestDistY <= threshold ? Math.round(bestDy) : 0;

  const snappedTop = movingRect.y + dy;
  const snappedBottom = snappedTop + movingRect.h;
  const snappedLeft = movingRect.x + dx;
  const snappedRight = snappedLeft + movingRect.w;

  const guides: SnapGuide[] = [];

  if (bestDistX <= threshold) {
    const shiftedXPoints = [snappedLeft, snappedLeft + movingRect.w / 2, snappedRight];
    const verticalByPos = new Map<number, { start: number; end: number }>();

    for (const t of targets) {
      const tXPoints = [t.x, t.x + t.w / 2, t.x + t.w];
      for (const sx of shiftedXPoints) {
        for (const tx of tXPoints) {
          if (Math.abs(tx - sx) <= 1) {
            const key = Math.round(tx);
            const segStart = Math.min(snappedTop, t.y) - 24;
            const segEnd = Math.max(snappedBottom, t.y + t.h) + 24;
            const prev = verticalByPos.get(key);
            verticalByPos.set(key, {
              start: prev ? Math.min(prev.start, segStart) : segStart,
              end: prev ? Math.max(prev.end, segEnd) : segEnd,
            });
          }
        }
      }
    }

    for (const [position, span] of verticalByPos.entries()) {
      guides.push({ orientation: 'vertical', position, start: span.start, end: span.end });
    }
  }

  if (bestDistY <= threshold) {
    const shiftedYPoints = [snappedTop, snappedTop + movingRect.h / 2, snappedBottom];
    const horizontalByPos = new Map<number, { start: number; end: number }>();

    for (const t of targets) {
      const tYPoints = [t.y, t.y + t.h / 2, t.y + t.h];
      for (const sy of shiftedYPoints) {
        for (const ty of tYPoints) {
          if (Math.abs(ty - sy) <= 1) {
            const key = Math.round(ty);
            const segStart = Math.min(snappedLeft, t.x) - 24;
            const segEnd = Math.max(snappedRight, t.x + t.w) + 24;
            const prev = horizontalByPos.get(key);
            horizontalByPos.set(key, {
              start: prev ? Math.min(prev.start, segStart) : segStart,
              end: prev ? Math.max(prev.end, segEnd) : segEnd,
            });
          }
        }
      }
    }

    for (const [position, span] of horizontalByPos.entries()) {
      guides.push({ orientation: 'horizontal', position, start: span.start, end: span.end });
    }
  }

  return { dx, dy, guides };
}

/** Return IDs of all boxes intersecting the normalized marquee rectangle. */
export function getNodesInMarquee(
  marquee: { x1: number; y1: number; x2: number; y2: number },
  boxes: readonly SnapRect[]
): string[] {
  const minX = Math.min(marquee.x1, marquee.x2);
  const maxX = Math.max(marquee.x1, marquee.x2);
  const minY = Math.min(marquee.y1, marquee.y2);
  const maxY = Math.max(marquee.y1, marquee.y2);

  return boxes
    .filter((b) => b.x <= maxX && b.x + b.w >= minX && b.y <= maxY && b.y + b.h >= minY)
    .map((b) => b.id);
}

export function computeAlignRowUpdates(boxes: readonly SnapRect[]): Array<{ id: string; pos_x: number; pos_y: number }> {
  if (boxes.length < 2) return [];
  const avgY = Math.round(boxes.reduce((sum, b) => sum + b.y, 0) / boxes.length);
  return boxes.map((b) => ({ id: b.id, pos_x: Math.round(b.x), pos_y: avgY }));
}

export function computeAlignColumnUpdates(
  boxes: readonly SnapRect[]
): Array<{ id: string; pos_x: number; pos_y: number }> {
  if (boxes.length < 2) return [];
  const avgX = Math.round(boxes.reduce((sum, b) => sum + b.x, 0) / boxes.length);
  return boxes.map((b) => ({ id: b.id, pos_x: avgX, pos_y: Math.round(b.y) }));
}

export function computeDistributeHorizontalUpdates(
  boxes: readonly SnapRect[],
  minGap = 220
): Array<{ id: string; pos_x: number; pos_y: number }> {
  if (boxes.length < 2) return [];
  const sorted = [...boxes].sort((a, b) => a.x - b.x || a.y - b.y);
  const startX = Math.round(sorted[0].x);
  const endX = Math.round(sorted[sorted.length - 1].x);
  const totalSpan = Math.max(endX - startX, (sorted.length - 1) * minGap);
  const step = totalSpan / (sorted.length - 1);
  return sorted.map((b, idx) => ({
    id: b.id,
    pos_x: Math.round(startX + idx * step),
    pos_y: Math.round(b.y),
  }));
}

/**
 * Compute camera zoom + pan so all visible nodes fit comfortably in the viewport
 * and the top-most person starts near the top edge (with subordinates beneath),
 * or preserve `fixedZoom` if the user manually adjusted zoom.
 */
export function computeBoardFitView(
  boxes: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
  viewport: { w: number; h: number },
  options?: {
    fixedZoom?: number;
    minZoom?: number;
    maxAutoZoom?: number;
    padX?: number;
    padTop?: number;
    padBottom?: number;
  }
): BoardCameraView {
  const minZoom = options?.minZoom ?? 0.25;
  const maxAutoZoom = options?.maxAutoZoom ?? 1;
  const padX = options?.padX ?? 72;
  const padTop = options?.padTop ?? 64;
  const padBottom = options?.padBottom ?? 48;

  if (boxes.length === 0) {
    return {
      zoom: options?.fixedZoom ?? 1,
      pan: { x: 40, y: 32 },
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y + b.h);
  }

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);

  let zoom: number;
  if (options?.fixedZoom !== undefined) {
    zoom = options.fixedZoom;
  } else {
    const availW = Math.max(120, viewport.w - padX * 2);
    const availH = Math.max(120, viewport.h - padTop - padBottom);
    const fitZoom = Math.min(availW / contentW, availH / contentH);
    zoom = Number(Math.min(maxAutoZoom, Math.max(minZoom, fitZoom)).toFixed(3));
  }

  const midX = (minX + maxX) / 2;
  return {
    zoom,
    pan: {
      x: Math.round(viewport.w / 2 - midX * zoom),
      y: Math.round(padTop - minY * zoom),
    },
  };
}

/**
 * Recursively construct the complete multi-layer hierarchy (root board + nested sub-boards,
 * paired deputies, and unconnected jokers) for the Tree List View. Cycle-safe.
 */
export function buildFullStructureHierarchy(
  nodes: readonly StructureNode[],
  edges: readonly StructureEdge[]
): LayerHierarchy {
  const byOwner = new Map<string | null, StructureNode[]>();
  const ownersWithChildren = new Set<string>();

  for (const n of nodes) {
    const owner = n.board_owner_id ?? null;
    if (owner === null && n.node_type === 'section') continue;
    if (owner) ownersWithChildren.add(owner);
    const list = byOwner.get(owner);
    if (list) list.push(n);
    else byOwner.set(owner, [n]);
  }

  const nodeHasSubBoard = (node: StructureNode): boolean =>
    ownersWithChildren.has(node.id) ||
    Boolean(node.section_title?.trim() || node.team_image_url || node.description?.trim());

  const buildLayer = (ownerId: string | null, visitedOwners: Set<string>): LayerHierarchy => {
    const layerNodes = [...(byOwner.get(ownerId) ?? [])].sort(compareOrder);
    const layerById = new Map(layerNodes.map((n) => [n.id, n]));
    const layerEdges = edges.filter(
      (e) => layerById.has(e.source_id) && layerById.has(e.target_id) && e.source_id !== e.target_id
    );

    const edgeParticipants = new Set<string>();
    const hasHierarchyParent = new Set<string>();
    const childrenIdsMap = new Map<string, string[]>();
    const deputyTargetIds = new Set<string>();
    const deputyIdsOf = new Map<string, string[]>();

    for (const e of layerEdges) {
      edgeParticipants.add(e.source_id);
      edgeParticipants.add(e.target_id);
      if (e.label === 'deputy') {
        const list = deputyIdsOf.get(e.source_id);
        if (list) list.push(e.target_id);
        else deputyIdsOf.set(e.source_id, [e.target_id]);
        deputyTargetIds.add(e.target_id);
      } else {
        hasHierarchyParent.add(e.target_id);
        const list = childrenIdsMap.get(e.source_id);
        if (list) list.push(e.target_id);
        else childrenIdsMap.set(e.source_id, [e.target_id]);
      }
    }

    const jokers: StructureNode[] = [];
    for (const n of layerNodes) {
      if (n.node_type === 'joker' && !edgeParticipants.has(n.id)) {
        jokers.push(n);
      }
    }
    const jokerSet = new Set(jokers.map((j) => j.id));

    // Only keep pure leaf deputies (without own hierarchy children or sub-board) inline beside their lead;
    // deputies leading a subtree appear as full entries so nested members/sections stay visible.
    const inlineDeputySet = new Set<string>();
    for (const targetId of deputyTargetIds) {
      const targetNode = layerById.get(targetId);
      if (!targetNode || jokerSet.has(targetId)) continue;
      const hasChildren = (childrenIdsMap.get(targetId)?.length ?? 0) > 0;
      if (!hasChildren && !nodeHasSubBoard(targetNode)) {
        inlineDeputySet.add(targetId);
      }
    }

    const placed = new Set<string>();

    const buildEntry = (node: StructureNode): LayerTreeEntry => {
      placed.add(node.id);

      const deputies: StructureNode[] = [];
      for (const depId of deputyIdsOf.get(node.id) ?? []) {
        const dep = layerById.get(depId);
        if (!dep || !inlineDeputySet.has(depId) || placed.has(depId)) continue;
        placed.add(depId);
        deputies.push(dep);
      }
      deputies.sort(compareOrder);

      const childNodes = (childrenIdsMap.get(node.id) ?? [])
        .map((id) => layerById.get(id))
        .filter((child): child is StructureNode => Boolean(child) && !placed.has(child.id) && !inlineDeputySet.has(child.id))
        .sort(compareOrder);

      const children: LayerTreeEntry[] = [];
      for (const child of childNodes) {
        if (!placed.has(child.id)) {
          children.push(buildEntry(child));
        }
      }

      let subBoard: LayerHierarchy | null = null;
      if (nodeHasSubBoard(node) && !visitedOwners.has(node.id)) {
        const nextVisited = new Set(visitedOwners);
        nextVisited.add(node.id);
        subBoard = buildLayer(node.id, nextVisited);
      }

      return { node, deputies, children, subBoard };
    };

    const roots: LayerTreeEntry[] = [];
    for (const n of layerNodes) {
      if (jokerSet.has(n.id) || inlineDeputySet.has(n.id)) continue;
      if (!hasHierarchyParent.has(n.id) && !deputyTargetIds.has(n.id) && !placed.has(n.id)) {
        roots.push(buildEntry(n));
      }
    }

    // Cycle or promoted-deputy fallback so every non-joker node in this layer renders cleanly
    for (const n of layerNodes) {
      if (jokerSet.has(n.id) || inlineDeputySet.has(n.id) || placed.has(n.id)) continue;
      roots.push(buildEntry(n));
    }

    const countEntry = (entry: LayerTreeEntry): number =>
      1 +
      entry.deputies.length +
      entry.children.reduce((sum, c) => sum + countEntry(c), 0) +
      (entry.subBoard?.totalCount ?? 0);

    const totalCount = roots.reduce((sum, r) => sum + countEntry(r), 0) + jokers.length;
    return { ownerId, roots, jokers, totalCount };
  };

  return buildLayer(null, new Set());
}

/**
 * Filter a full multi-layer hierarchy by query, keeping matching nodes
 * alongside ancestor entries and section frames leading down to deep matches.
 */
export function filterLayerHierarchy(hierarchy: LayerHierarchy, query: string): LayerHierarchy {
  const q = query.trim();
  if (!q) return hierarchy;

  const filterEntry = (entry: LayerTreeEntry): LayerTreeEntry | null => {
    const nodeMatched = matchesStructureSearch(entry.node, q);
    const deputies = entry.deputies.filter((d) => matchesStructureSearch(d, q));
    const children = entry.children
      .map(filterEntry)
      .filter((c): c is LayerTreeEntry => c !== null);
    const subBoard = entry.subBoard ? filterLayerHierarchy(entry.subBoard, q) : null;
    const hasSubMatches = Boolean(subBoard && subBoard.totalCount > 0);

    if (!nodeMatched && deputies.length === 0 && children.length === 0 && !hasSubMatches) {
      return null;
    }

    return {
      node: entry.node,
      deputies,
      children,
      subBoard: hasSubMatches ? subBoard : null,
    };
  };

  const roots = hierarchy.roots.map(filterEntry).filter((e): e is LayerTreeEntry => e !== null);
  const jokers = hierarchy.jokers.filter((j) => matchesStructureSearch(j, q));

  const countEntry = (entry: LayerTreeEntry): number =>
    1 +
    entry.deputies.length +
    entry.children.reduce((sum, c) => sum + countEntry(c), 0) +
    (entry.subBoard?.totalCount ?? 0);

  const totalCount = roots.reduce((sum, r) => sum + countEntry(r), 0) + jokers.length;
  return { ownerId: hierarchy.ownerId, roots, jokers, totalCount };
}
