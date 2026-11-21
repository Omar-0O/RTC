import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalSpaceBetween,
  ArrowRight,
  BoxSelect,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Hand,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  ListTree,
  Loader2,
  Maximize2,
  Minimize2,
  Network,
  Pencil,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  computeAlignColumnUpdates,
  computeAlignRowUpdates,
  computeBoardFitView,
  computeDistributeHorizontalUpdates,
  computeSnapAlignment,
  getNodesInMarquee,
  searchStructureAcrossLayers,
  type SnapGuide,
  type SnapRect,
} from '@/utils/activityStructureBoardHelpers';
import {
  computeAutoLayoutPositions,
  computePyramidLayoutPositions,
  getBoardBreadcrumb,
  getInitials,
  getPathHighlightSet,
  getRecursiveSectionMembers,
  getVolunteerName,
  matchesStructureSearch,
  type RootBoardMeta,
  type SectionMemberThumb,
  type StructureEdge,
  type StructureNode,
} from '@/utils/activityStructureTree';
import { exportStructureBoardPng } from '@/utils/exportStructureBoardPng';
import { STRUCTURE_COLOR_TOKENS } from './structureColors';
import { StructureMiniMap } from './StructureMiniMap';
import { StructureNodeCard, type NodeHighlight } from './StructureNodeCard';
import { StructureTreeListView } from './StructureTreeListView';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.15;
const EMPTY_ID_SET = new Set<string>();

export interface StructureBoardEditHandlers {
  onEdit: (id: string) => void;
  onQuickCreate?: (pos: { pos_x: number; pos_y: number }) => void;
  onCreateInLayer?: (ownerId: string | null) => void;
  onEditRootMeta: () => void;
  onDelete: (id: string) => void;
  onMovePosition: (id: string, pos_x: number, pos_y: number) => void;
  onBatchMovePositions: (updates: Array<{ id: string; pos_x: number; pos_y: number }>) => void;
  onCreateEdge: (sourceId: string, targetId: string, label?: string | null) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export interface StructureBoardDraftControls {
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

interface StructureBoardProps {
  nodes: StructureNode[];
  edges: StructureEdge[];
  rootMeta: RootBoardMeta | null;
  activeBoardOwnerId: string | null;
  onChangeBoardOwner: (ownerId: string | null) => void;
  isRTL: boolean;
  editable: boolean;
  draftControls?: StructureBoardDraftControls;
  onViewportCenterChange?: (center: { pos_x: number; pos_y: number }) => void;
  editHandlers?: StructureBoardEditHandlers;
}

interface NodeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragState =
  | { kind: 'pan'; startClientX: number; startClientY: number; startPanX: number; startPanY: number }
  | { kind: 'zoom'; startClientX: number; startClientY: number; startZoom: number; startPanX: number; startPanY: number }
  | {
      kind: 'node';
      anchorId: string;
      ids: string[];
      startClientX: number;
      startClientY: number;
      startPositions: Record<string, { pos_x: number; pos_y: number }>;
      moved: boolean;
    }
  | {
      kind: 'marquee';
      startCanvasX: number;
      startCanvasY: number;
      currCanvasX: number;
      currCanvasY: number;
      additive: boolean;
    }
  | {
      kind: 'connect';
      connectKind: 'hierarchy' | 'deputy';
      sourceId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      targetId: string | null;
    };

export function StructureBoard({
  nodes,
  edges,
  rootMeta,
  activeBoardOwnerId,
  onChangeBoardOwner,
  isRTL,
  editable,
  draftControls,
  onViewportCenterChange,
  editHandlers,
}: StructureBoardProps): React.ReactElement {
  const label = (ar: string, en: string): string => (isRTL ? ar : en);

  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const justDraggedRef = useRef(false);
  const pendingFocusNodeIdRef = useRef<string | null>(null);
  const userAdjustedZoomRef = useRef(false);
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; zoom: number; panX: number; panY: number; midX: number; midY: number } | null>(null);
  const canvasLastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'tree'>('board');
  const [toolMode, setToolMode] = useState<'pan' | 'select'>('pan');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIdx, setActiveSearchIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 32 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [rootSidebarOpen, setRootSidebarOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [livePos, setLivePos] = useState<Record<string, { pos_x: number; pos_y: number }>>({});
  const [nodeSizes, setNodeSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [viewportSize, setViewportSize] = useState({ w: 900, h: 620 });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || viewMode !== 'board') return;
    const measure = () => {
      setViewportSize({
        w: el.clientWidth || 900,
        h: el.clientHeight || 620,
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen, viewMode]);

  useEffect(() => {
    if (!editable) {
      setToolMode('pan');
      setSelectedIds(new Set());
    }
  }, [editable]);

  useEffect(() => {
    setActiveSearchIdx(0);
  }, [query]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (searchContainerRef.current && e.target instanceof Node && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [searchOpen]);

  useEffect(() => {
    if (dragState !== null) setHoveredNodeId(null);
  }, [dragState]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const ownerNode = activeBoardOwnerId ? byId.get(activeBoardOwnerId) ?? null : null;
  const breadcrumb = useMemo(() => getBoardBreadcrumb(nodes, activeBoardOwnerId), [nodes, activeBoardOwnerId]);

  // Nodes belonging to the current layer
  const layerNodes = useMemo(
    () =>
      nodes.filter((n) =>
        activeBoardOwnerId === null
          ? !n.board_owner_id && n.node_type !== 'section'
          : n.board_owner_id === activeBoardOwnerId
      ),
    [nodes, activeBoardOwnerId]
  );

  // On a sub-board, include the Section Head (ownerNode) at the top-center as default head
  const visibleNodes = useMemo(() => {
    if (!ownerNode) return layerNodes;
    return [ownerNode, ...layerNodes.filter((n) => n.id !== ownerNode.id)];
  }, [layerNodes, ownerNode]);

  const visibleIdSet = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  // Edges belonging to the current layer
  const layerEdges = useMemo(
    () => edges.filter((e) => visibleIdSet.has(e.source_id) && visibleIdSet.has(e.target_id)),
    [edges, visibleIdSet]
  );

  // Inside a sub-board, any member without an explicit incoming edge is automatically
  // shown connected with an arrow under the pinned section owner — except 'joker' nodes,
  // which remain intentionally unattached inside the section.
  const effectiveLayerEdges = useMemo(() => {
    if (!ownerNode) return layerEdges;
    const hasIncoming = new Set<string>();
    for (const e of layerEdges) hasIncoming.add(e.target_id);
    const autoEdges: StructureEdge[] = [];
    for (const n of layerNodes) {
      if (n.node_type === 'joker') continue;
      if (!hasIncoming.has(n.id)) {
        autoEdges.push({
          id: `auto-${ownerNode.id}-${n.id}`,
          branch_id: ownerNode.branch_id,
          source_id: ownerNode.id,
          target_id: n.id,
          label: null,
        });
      }
    }
    return [...layerEdges, ...autoEdges];
  }, [layerEdges, layerNodes, ownerNode]);

  // Count how many members exist inside each node's sub-board
  const subBoardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) {
      if (n.board_owner_id) {
        counts.set(n.board_owner_id, (counts.get(n.board_owner_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [nodes]);

  // Recursive volunteer thumbnails inside each visible node's section & nested sub-sections
  const sectionMembersMap = useMemo(() => {
    const map = new Map<string, SectionMemberThumb[]>();
    for (const item of visibleNodes) {
      if (ownerNode && item.id === ownerNode.id) continue;
      const members = getRecursiveSectionMembers(nodes, item.id, isRTL);
      if (members.length > 0) map.set(item.id, members);
    }
    return map;
  }, [isRTL, nodes, ownerNode, visibleNodes]);

  // Fallback layout for any node without saved coordinates
  const autoFallback = useMemo(() => computeAutoLayoutPositions(layerNodes, layerEdges), [layerNodes, layerEdges]);

  const getPosition = useCallback(
    (node: StructureNode): { pos_x: number; pos_y: number } => {
      if (ownerNode && node.id === ownerNode.id) {
        // Default pinned position at top-center of the sub-board
        return { pos_x: 420, pos_y: 36 };
      }
      if (livePos[node.id]) return livePos[node.id];
      const x = node.pos_x ?? 0;
      const y = node.pos_y ?? 0;
      if (x === 0 && y === 0) {
        const auto = autoFallback.get(node.id) ?? { pos_x: 120, pos_y: 260 };
        return ownerNode ? { pos_x: auto.pos_x, pos_y: Math.max(240, auto.pos_y + 180) } : auto;
      }
      return { pos_x: x, pos_y: y };
    },
    [autoFallback, livePos, ownerNode]
  );

  const getDefaultView = useCallback(
    (preserveZoom = false) => {
      const vw = viewportRef.current?.clientWidth || viewportSize.w;
      const vh = viewportRef.current?.clientHeight || viewportSize.h;
      const boxes = visibleNodes.map((n) => {
        const pos = getPosition(n);
        const w = nodeSizes[n.id]?.w ?? 176;
        const h = nodeSizes[n.id]?.h ?? 156;
        return { x: pos.pos_x, y: pos.pos_y, w, h };
      });
      return computeBoardFitView(
        boxes,
        { w: vw, h: vh },
        {
          fixedZoom: preserveZoom ? zoom : undefined,
          minZoom: ZOOM_MIN,
          maxAutoZoom: 1,
        }
      );
    },
    [getPosition, nodeSizes, viewportSize.h, viewportSize.w, visibleNodes, zoom]
  );

  const getDefaultViewRef = useRef(getDefaultView);
  getDefaultViewRef.current = getDefaultView;

  // Report the current visible center in canvas coordinates so new nodes spawn right where the user is looking
  useEffect(() => {
    if (!onViewportCenterChange) return;
    const viewportW = viewportRef.current?.clientWidth || 900;
    const viewportH = viewportRef.current?.clientHeight || 620;
    onViewportCenterChange({
      pos_x: Math.round((viewportW / 2 - pan.x) / zoom - 72),
      pos_y: Math.round((viewportH / 2 - pan.y) / zoom - 70),
    });
  }, [onViewportCenterChange, pan.x, pan.y, zoom]);

  // Fit board to top-anchored view on layer change (unless jumping to a cross-layer search target)
  useEffect(() => {
    setHoveredNodeId(null);
    setSelectedIds(new Set());
    userAdjustedZoomRef.current = false;
    if (pendingFocusNodeIdRef.current) return;
    setSelectedId(null);
    const view = getDefaultView(false);
    setZoom(view.zoom);
    setPan(view.pan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardOwnerId]);

  const hasVisibleNodes = visibleNodes.length > 0;
  // Auto-fit zoom & top-anchor when board loads, switches back from Tree view, or viewport resizes/fullscreen changes
  useEffect(() => {
    if (viewMode !== 'board' || !hasVisibleNodes) return;
    if (userAdjustedZoomRef.current || dragState !== null || selectedId !== null || selectedIds.size > 0) return;
    if (pendingFocusNodeIdRef.current) return;
    const view = getDefaultViewRef.current(false);
    setZoom(view.zoom);
    setPan(view.pan);
    // Intentionally omit drag/selection state so clearing selection waits for idle recenter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardOwnerId, hasVisibleNodes, viewportSize.w, viewportSize.h, viewMode]);

  const centerOnNode = useCallback(
    (nodeId: string) => {
      const target = byId.get(nodeId);
      if (!target) return;
      const pos = getPosition(target);
      const size = nodeSizes[nodeId] ?? { w: 176, h: 156 };
      const vw = viewportRef.current?.clientWidth || viewportSize.w;
      const vh = viewportRef.current?.clientHeight || viewportSize.h;
      const nextZoom = 1.05;
      setZoom(nextZoom);
      setPan({
        x: Math.round(vw / 2 - (pos.pos_x + size.w / 2) * nextZoom),
        y: Math.round(vh / 2 - (pos.pos_y + size.h / 2) * nextZoom),
      });
      setSelectedId(nodeId);
      setSelectedIds(new Set());
    },
    [byId, getPosition, nodeSizes, viewportSize.h, viewportSize.w]
  );

  const jumpToNode = useCallback(
    (nodeId: string, targetOwnerId: string | null) => {
      setViewMode('board');
      setSearchOpen(false);
      setQuery('');
      setSelectedIds(new Set());
      if (targetOwnerId === activeBoardOwnerId && viewMode === 'board') {
        centerOnNode(nodeId);
        return;
      }
      pendingFocusNodeIdRef.current = nodeId;
      if (targetOwnerId !== activeBoardOwnerId) {
        onChangeBoardOwner(targetOwnerId);
      }
    },
    [activeBoardOwnerId, centerOnNode, onChangeBoardOwner, viewMode]
  );

  useEffect(() => {
    const targetId = pendingFocusNodeIdRef.current;
    if (!targetId || viewMode !== 'board') return;
    if (!visibleNodes.some((n) => n.id === targetId)) return;
    const raf = window.requestAnimationFrame(() => {
      pendingFocusNodeIdRef.current = null;
      centerOnNode(targetId);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeBoardOwnerId, centerOnNode, viewMode, visibleNodes]);

  // Auto-recenter after 4 seconds of idle: keep top-most lead at top, subordinates below, and fit zoom unless manually adjusted
  useEffect(() => {
    if (dragState !== null || selectedId !== null || selectedIds.size > 0 || viewMode !== 'board') return;
    const target = getDefaultView(userAdjustedZoomRef.current);
    if (
      Math.abs(pan.x - target.pan.x) < 4 &&
      Math.abs(pan.y - target.pan.y) < 4 &&
      Math.abs(zoom - target.zoom) < 0.01
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!userAdjustedZoomRef.current) setZoom(target.zoom);
      setPan(target.pan);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [dragState, getDefaultView, pan.x, pan.y, selectedId, selectedIds.size, viewMode, zoom]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const handleArrangePyramid = useCallback(() => {
    if (!editable || !editHandlers || layerNodes.length === 0) return;
    const positions = computePyramidLayoutPositions(layerNodes, layerEdges, isRTL, ownerNode ? 260 : 80);
    const updates = Array.from(positions.entries()).map(([id, pos]) => ({
      id,
      pos_x: pos.pos_x,
      pos_y: pos.pos_y,
    }));
    if (updates.length === 0) return;
    setLivePos({});
    editHandlers.onBatchMovePositions(updates);
    window.setTimeout(() => {
      const view = getDefaultViewRef.current(userAdjustedZoomRef.current);
      if (!userAdjustedZoomRef.current) setZoom(view.zoom);
      setPan(view.pan);
    }, 60);
  }, [editHandlers, editable, isRTL, layerEdges, layerNodes, ownerNode]);

  // Measure rendered node sizes for crisp SVG Bezier connections
  useLayoutEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    const nextSizes: Record<string, { w: number; h: number }> = {};
    for (const n of visibleNodes) {
      const el = container.querySelector<HTMLElement>(`[data-board-item="${n.id}"]`);
      if (el) {
        nextSizes[n.id] = { w: el.offsetWidth, h: el.offsetHeight };
      }
    }
    setNodeSizes((prev) => {
      const keys = Object.keys(nextSizes);
      if (
        keys.length === Object.keys(prev).length &&
        keys.every((k) => prev[k]?.w === nextSizes[k].w && prev[k]?.h === nextSizes[k].h)
      ) {
        return prev;
      }
      return nextSizes;
    });
  }, [visibleNodes, livePos]);

  useEffect(() => {
    setLivePos({});
  }, [nodes]);

  const getNodeBox = useCallback(
    (id: string): NodeBox | null => {
      const node = byId.get(id);
      if (!node || !visibleIdSet.has(id)) return null;
      const pos = getPosition(node);
      const size = nodeSizes[id] ?? { w: 176, h: 148 };
      return { x: pos.pos_x, y: pos.pos_y, w: size.w, h: size.h };
    },
    [byId, getPosition, nodeSizes, visibleIdSet]
  );

  const searching = query.trim().length > 0;
  const globalSearchResults = useMemo(() => searchStructureAcrossLayers(nodes, query, 12), [nodes, query]);
  const focusId = dragState === null ? hoveredNodeId ?? selectedId : null;
  const focusPath = useMemo(
    () => (focusId ? getPathHighlightSet(focusId, effectiveLayerEdges) : null),
    [effectiveLayerEdges, focusId]
  );
  const minimapFocusIds = useMemo(() => {
    if (selectedIds.size > 0) return selectedIds;
    if (!focusId || !focusPath) return EMPTY_ID_SET;
    const set = new Set(focusPath.nodeIds);
    set.add(focusId);
    return set;
  }, [focusId, focusPath, selectedIds]);

  const effectiveFocusId = selectedIds.size <= 1 ? focusId : null;
  const highlightFor = useCallback(
    (node: StructureNode): NodeHighlight => {
      if (selectedIds.has(node.id)) return 'selected';
      if (searching && !matchesStructureSearch(node, query)) return 'dimmed';
      if (effectiveFocusId && focusPath) {
        if (node.id === effectiveFocusId) return 'selected';
        if (focusPath.nodeIds.has(node.id)) return 'chain';
        return 'dimmed';
      }
      return 'none';
    },
    [effectiveFocusId, focusPath, query, searching, selectedIds]
  );

  const selectedSnapRects = useMemo<SnapRect[]>(() => {
    const out: SnapRect[] = [];
    for (const id of selectedIds) {
      if (ownerNode && id === ownerNode.id) continue;
      const box = getNodeBox(id);
      if (box) out.push({ id, x: box.x, y: box.y, w: box.w, h: box.h });
    }
    return out;
  }, [getNodeBox, ownerNode, selectedIds]);

  const handleAlignRow = useCallback(() => {
    const updates = computeAlignRowUpdates(selectedSnapRects);
    if (updates.length >= 2) editHandlers?.onBatchMovePositions(updates);
  }, [editHandlers, selectedSnapRects]);

  const handleAlignColumn = useCallback(() => {
    const updates = computeAlignColumnUpdates(selectedSnapRects);
    if (updates.length >= 2) editHandlers?.onBatchMovePositions(updates);
  }, [editHandlers, selectedSnapRects]);

  const handleDistributeHorizontal = useCallback(() => {
    const updates = computeDistributeHorizontalUpdates(selectedSnapRects, 220);
    if (updates.length >= 2) editHandlers?.onBatchMovePositions(updates);
  }, [editHandlers, selectedSnapRects]);

  const handleMiniMapNavigate = useCallback(
    (canvasX: number, canvasY: number) => {
      setPan({
        x: Math.round(viewportSize.w / 2 - canvasX * zoom),
        y: Math.round(viewportSize.h / 2 - canvasY * zoom),
      });
    },
    [viewportSize.h, viewportSize.w, zoom]
  );

  const clientToCanvas = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom]
  );

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPointsRef.current.size === 2) {
        const pts = Array.from(touchPointsRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const rect = viewportRef.current?.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0);
        const midY = (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0);
        pinchStartRef.current = { dist: Math.max(dist, 1), zoom, panX: pan.x, panY: pan.y, midX, midY };
        setDragState(null);
        return;
      }
    }
    if (e.button === 2) {
      e.preventDefault();
      setDragState({
        kind: 'zoom',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startZoom: zoom,
        startPanX: pan.x,
        startPanY: pan.y,
      });
      return;
    }
    if (e.button !== 0) return;
    if (editable && (toolMode === 'select' || e.shiftKey)) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      setDragState({
        kind: 'marquee',
        startCanvasX: pt.x,
        startCanvasY: pt.y,
        currCanvasX: pt.x,
        currCanvasY: pt.y,
        additive: e.shiftKey,
      });
      return;
    }
    setDragState({
      kind: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    });
  };

  const handleStartNodeDrag = useCallback(
    (id: string, e: React.PointerEvent<HTMLDivElement>) => {
      if (!editable) return;
      if (ownerNode && id === ownerNode.id) return;
      e.stopPropagation();

      const useGroup = selectedIds.has(id) && selectedIds.size > 1;
      const ids = useGroup
        ? Array.from(selectedIds).filter((sid) => visibleIdSet.has(sid) && (!ownerNode || sid !== ownerNode.id))
        : [id];

      const startPositions: Record<string, { pos_x: number; pos_y: number }> = {};
      for (const nid of ids) {
        const node = byId.get(nid);
        if (node) startPositions[nid] = getPosition(node);
      }
      if (Object.keys(startPositions).length === 0) return;

      setDragState({
        kind: 'node',
        anchorId: id,
        ids: Object.keys(startPositions),
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPositions,
        moved: false,
      });
    },
    [byId, editable, getPosition, ownerNode, selectedIds, visibleIdSet]
  );

  const handleStartConnect = useCallback(
    (sourceId: string, e: React.PointerEvent<HTMLButtonElement>, connectKind: 'hierarchy' | 'deputy' = 'hierarchy') => {
      if (!editable) return;
      e.stopPropagation();
      const box = getNodeBox(sourceId);
      const startPt =
        connectKind === 'deputy' || !box
          ? clientToCanvas(e.clientX, e.clientY)
          : { x: box.x + box.w / 2, y: box.y + box.h };
      const endPt = clientToCanvas(e.clientX, e.clientY);
      setDragState({
        kind: 'connect',
        connectKind,
        sourceId,
        x1: startPt.x,
        y1: startPt.y,
        x2: endPt.x,
        y2: endPt.y,
        targetId: null,
      });
    },
    [clientToCanvas, editable, getNodeBox]
  );

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' && touchPointsRef.current.has(e.pointerId)) {
      touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPointsRef.current.size === 2 && pinchStartRef.current) {
        const pts = Array.from(touchPointsRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const start = pinchStartRef.current;
        const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(start.zoom * (dist / start.dist)).toFixed(3)));
        const scaleRatio = nextZoom / start.zoom;
        userAdjustedZoomRef.current = true;
        setZoom(nextZoom);
        setPan({
          x: Math.round(start.midX - (start.midX - start.panX) * scaleRatio),
          y: Math.round(start.midY - (start.midY - start.panY) * scaleRatio),
        });
        return;
      }
    }
    if (!dragState) return;
    if (dragState.kind === 'pan') {
      const dx = e.clientX - dragState.startClientX;
      const dy = e.clientY - dragState.startClientY;
      setPan({ x: dragState.startPanX + dx, y: dragState.startPanY + dy });
    } else if (dragState.kind === 'zoom') {
      const dy = e.clientY - dragState.startClientY;
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(dragState.startZoom * Math.exp(-dy * 0.005)).toFixed(3)));
      const rect = viewportRef.current?.getBoundingClientRect();
      if (rect) {
        const anchorX = dragState.startClientX - rect.left;
        const anchorY = dragState.startClientY - rect.top;
        const scaleRatio = nextZoom / dragState.startZoom;
        setPan({
          x: Math.round(anchorX - (anchorX - dragState.startPanX) * scaleRatio),
          y: Math.round(anchorY - (anchorY - dragState.startPanY) * scaleRatio),
        });
      }
      userAdjustedZoomRef.current = true;
      setZoom(nextZoom);
    } else if (dragState.kind === 'node') {
      const rawDx = (e.clientX - dragState.startClientX) / zoom;
      const rawDy = (e.clientY - dragState.startClientY) / zoom;
      const moved = dragState.moved || Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3;
      if (moved !== dragState.moved) setDragState({ ...dragState, moved });

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const nid of dragState.ids) {
        const sp = dragState.startPositions[nid];
        if (!sp) continue;
        const sz = nodeSizes[nid] ?? { w: 176, h: 156 };
        const cx = sp.pos_x + rawDx;
        const cy = sp.pos_y + rawDy;
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx + sz.w);
        maxY = Math.max(maxY, cy + sz.h);
      }

      let snapDx = 0;
      let snapDy = 0;
      if (!e.altKey && minX !== Infinity) {
        const draggedSet = new Set(dragState.ids);
        const targets: SnapRect[] = [];
        for (const n of visibleNodes) {
          if (draggedSet.has(n.id)) continue;
          const pos = getPosition(n);
          const sz = nodeSizes[n.id] ?? { w: 176, h: 156 };
          targets.push({ id: n.id, x: pos.pos_x, y: pos.pos_y, w: sz.w, h: sz.h });
        }
        const snap = computeSnapAlignment(
          { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          targets,
          8
        );
        snapDx = snap.dx;
        snapDy = snap.dy;
        setSnapGuides(snap.guides);
      } else {
        setSnapGuides([]);
      }

      setLivePos((prev) => {
        const next = { ...prev };
        for (const nid of dragState.ids) {
          const sp = dragState.startPositions[nid];
          if (!sp) continue;
          next[nid] = {
            pos_x: Math.round(sp.pos_x + rawDx + snapDx),
            pos_y: Math.round(sp.pos_y + rawDy + snapDy),
          };
        }
        return next;
      });
    } else if (dragState.kind === 'marquee') {
      const pt = clientToCanvas(e.clientX, e.clientY);
      setDragState({
        ...dragState,
        currCanvasX: pt.x,
        currCanvasY: pt.y,
      });
    } else if (dragState.kind === 'connect') {
      const pt = clientToCanvas(e.clientX, e.clientY);
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const targetEl = els.find(
        (el) => el instanceof HTMLElement && el.dataset.nodeId && el.dataset.nodeId !== dragState.sourceId
      ) as HTMLElement | undefined;
      setDragState({
        ...dragState,
        x2: pt.x,
        y2: pt.y,
        targetId: targetEl?.dataset.nodeId ?? null,
      });
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    setSnapGuides([]);
    if (e && e.pointerType === 'touch') {
      touchPointsRef.current.delete(e.pointerId);
      if (touchPointsRef.current.size < 2) {
        pinchStartRef.current = null;
      }
      if (
        editable &&
        editHandlers?.onQuickCreate &&
        dragState?.kind === 'pan' &&
        Math.hypot(e.clientX - dragState.startClientX, e.clientY - dragState.startClientY) < 8 &&
        !(e.target instanceof HTMLElement && (e.target.closest('[data-node-id]') || e.target.closest('button')))
      ) {
        const now = Date.now();
        const prevTap = canvasLastTapRef.current;
        if (prevTap && now - prevTap.time < 320 && Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 24) {
          canvasLastTapRef.current = null;
          const pt = clientToCanvas(e.clientX, e.clientY);
          editHandlers.onQuickCreate({ pos_x: Math.round(pt.x - 88), pos_y: Math.round(pt.y - 50) });
        } else {
          canvasLastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        }
      }
    }
    if (!dragState) return;
    if (
      e &&
      dragState.kind === 'pan' &&
      Math.hypot(e.clientX - dragState.startClientX, e.clientY - dragState.startClientY) < 6 &&
      !(e.target instanceof HTMLElement && (e.target.closest('[data-node-id]') || e.target.closest('button')))
    ) {
      setSelectedId(null);
      setSelectedIds(new Set());
    }
    if (dragState.kind === 'node') {
      if (dragState.moved && editHandlers) {
        justDraggedRef.current = true;
        window.setTimeout(() => {
          justDraggedRef.current = false;
        }, 0);
        if (dragState.ids.length > 1) {
          const updates = dragState.ids
            .map((nid) => {
              const finalPos = livePos[nid];
              return finalPos ? { id: nid, pos_x: finalPos.pos_x, pos_y: finalPos.pos_y } : null;
            })
            .filter((u): u is { id: string; pos_x: number; pos_y: number } => u !== null);
          if (updates.length > 0) editHandlers.onBatchMovePositions(updates);
        } else if (dragState.ids.length === 1) {
          const onlyId = dragState.ids[0];
          const finalPos = livePos[onlyId];
          if (finalPos) {
            editHandlers.onMovePosition(onlyId, finalPos.pos_x, finalPos.pos_y);
          }
        }
      }
      // Always clear live drag coordinates so Undo/Redo reads cleanly from nodes
      setLivePos({});
    } else if (dragState.kind === 'marquee') {
      const movedEnough =
        Math.hypot(dragState.currCanvasX - dragState.startCanvasX, dragState.currCanvasY - dragState.startCanvasY) >= 4;
      if (!movedEnough) {
        if (!dragState.additive) {
          setSelectedIds(new Set());
          setSelectedId(null);
        }
      } else {
        justDraggedRef.current = true;
        window.setTimeout(() => {
          justDraggedRef.current = false;
        }, 0);
        const candidateBoxes: SnapRect[] = visibleNodes
          .filter((n) => !ownerNode || n.id !== ownerNode.id)
          .map((n) => {
            const box = getNodeBox(n.id);
            return box ? { id: n.id, x: box.x, y: box.y, w: box.w, h: box.h } : null;
          })
          .filter((b): b is SnapRect => b !== null);
        const hitIds = getNodesInMarquee(
          {
            x1: dragState.startCanvasX,
            y1: dragState.startCanvasY,
            x2: dragState.currCanvasX,
            y2: dragState.currCanvasY,
          },
          candidateBoxes
        );
        setSelectedIds((prev) => {
          const next = dragState.additive ? new Set(prev) : new Set<string>();
          for (const hitId of hitIds) next.add(hitId);
          setSelectedId(next.size === 1 ? Array.from(next)[0] : null);
          return next;
        });
      }
    } else if (dragState.kind === 'connect' && dragState.targetId && editHandlers) {
      editHandlers.onCreateEdge(dragState.sourceId, dragState.targetId, dragState.connectKind === 'deputy' ? 'deputy' : null);
    }
    setDragState(null);
  };

  const renderedEdges = useMemo(() => {
    return effectiveLayerEdges
      .map((edge) => {
        const from = getNodeBox(edge.source_id);
        const to = getNodeBox(edge.target_id);
        if (!from || !to) return null;

        const isDeputy = edge.label === 'deputy';
        if (isDeputy) {
          const toIsLeft = to.x + to.w / 2 < from.x + from.w / 2;
          const x1 = toIsLeft ? from.x + 14 : from.x + from.w - 14;
          const x2 = toIsLeft ? to.x + to.w - 14 : to.x + 14;
          const y1 = from.y + 48;
          const y2 = to.y + 48;
          const dx = Math.max(30, Math.abs(x2 - x1) * 0.45);
          const cx1 = toIsLeft ? x1 - dx : x1 + dx;
          const cx2 = toIsLeft ? x2 + dx : x2 - dx;
          const path = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          return { edge, path, midX, midY, x1, y1, x2, y2, isDeputy: true };
        }

        const x1 = from.x + from.w / 2;
        const y1 = from.y + from.h;
        const x2 = to.x + to.w / 2;
        const y2 = to.y;
        const dy = Math.max(50, Math.abs(y2 - y1) * 0.5);
        const path = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        return { edge, path, midX, midY, x1, y1, x2, y2, isDeputy: false };
      })
      .filter(Boolean) as Array<{
      edge: StructureEdge;
      path: string;
      midX: number;
      midY: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isDeputy: boolean;
    }>;
  }, [effectiveLayerEdges, getNodeBox]);

  const handleExportPng = async () => {
    if (visibleNodes.length === 0 || exporting) return;
    setExporting(true);
    try {
      const positions = new Map<string, { pos_x: number; pos_y: number }>();
      const sizes = new Map<string, { w: number; h: number }>();
      for (const n of visibleNodes) {
        positions.set(n.id, getPosition(n));
        sizes.set(n.id, nodeSizes[n.id] ?? { w: 176, h: 156 });
      }
      const boardTitle =
        ownerNode?.section_title?.trim() ||
        (ownerNode ? getVolunteerName(ownerNode, isRTL) || ownerNode.title : '') ||
        rootMeta?.title?.trim() ||
        (isRTL ? 'هيكلة النشاط' : 'Activity Structure');
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      await exportStructureBoardPng({
        nodes: visibleNodes,
        edges: effectiveLayerEdges,
        positions,
        sizes,
        subBoardCounts,
        sectionMembersMap,
        pinnedHeadId: ownerNode?.id ?? null,
        boardTitle,
        isRTL,
        isDark,
      });
      toast.success(isRTL ? 'تم تصدير البورد كصورة' : 'Board exported as PNG');
    } catch {
      toast.error(isRTL ? 'تعذر تصدير الصورة' : 'Failed to export image');
    } finally {
      setExporting(false);
    }
  };

  const hasRootInfo = Boolean(rootMeta?.title?.trim() || rootMeta?.description?.trim() || rootMeta?.team_image_url);

  return (
    <div className="space-y-3">
      {/* Layer Breadcrumb Navigation */}
      {viewMode === 'board' && activeBoardOwnerId && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/30 px-3 py-2 text-xs">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs font-semibold"
            onClick={() => onChangeBoardOwner(null)}
          >
            <ArrowRight className={cn('h-3.5 w-3.5', !isRTL && 'rotate-180')} />
            {label('الهيكلة الرئيسية', 'Main Structure')}
          </Button>
          {breadcrumb.map((crumb, idx) => {
            const isLast = idx === breadcrumb.length - 1;
            const crumbLabel = crumb.section_title?.trim() || getVolunteerName(crumb, isRTL) || crumb.title;
            return (
              <div key={crumb.id} className="flex items-center gap-1">
                {isRTL ? <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <Button
                  variant={isLast ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium"
                  onClick={() => !isLast && onChangeBoardOwner(crumb.id)}
                >
                  {crumbLabel}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div ref={searchContainerRef} className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (viewMode !== 'board' || globalSearchResults.length === 0) {
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                  setQuery('');
                }
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSearchOpen(true);
                setActiveSearchIdx((prev) => (prev + 1) % globalSearchResults.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSearchOpen(true);
                setActiveSearchIdx((prev) => (prev - 1 + globalSearchResults.length) % globalSearchResults.length);
              } else if (e.key === 'Enter' && searchOpen) {
                e.preventDefault();
                const hit = globalSearchResults[activeSearchIdx] ?? globalSearchResults[0];
                if (hit) jumpToNode(hit.node.id, hit.layerOwnerId);
              } else if (e.key === 'Escape') {
                setSearchOpen(false);
              }
            }}
            placeholder={label('ابحث في كل الطبقات عن متطوع، سكشن، أو جوكر...', 'Search across all layers (volunteer, section, joker)...')}
            className="pe-8 ps-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchOpen(false);
              }}
              aria-label={label('مسح البحث', 'Clear search')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {viewMode === 'board' && searchOpen && query.trim().length > 0 && (
            <div
              dir={isRTL ? 'rtl' : 'ltr'}
              className="absolute start-0 top-full z-40 mt-1.5 max-h-80 w-full min-w-[260px] overflow-y-auto rounded-xl border bg-popover/95 p-1.5 shadow-xl backdrop-blur-md"
            >
              {globalSearchResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {label('لا توجد نتائج مطابقة في أي طبقة', 'No matches found in any layer')}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {globalSearchResults.map((res, idx) => {
                    const hitName = getVolunteerName(res.node, isRTL);
                    const tokens = STRUCTURE_COLOR_TOKENS[res.node.color];
                    const pathText =
                      res.layerPath.length === 0
                        ? label('الهيكلة الرئيسية', 'Main Structure')
                        : res.layerPath
                            .map((c) => c.section_title?.trim() || getVolunteerName(c, isRTL) || c.title)
                            .join(' › ');
                    const isJoker = res.node.node_type === 'joker';
                    return (
                      <button
                        key={res.node.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveSearchIdx(idx)}
                        onClick={() => jumpToNode(res.node.id, res.layerOwnerId)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors',
                          idx === activeSearchIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                        )}
                      >
                        <Avatar className={cn('h-8 w-8 shrink-0 ring-1', tokens.ring)}>
                          <AvatarImage src={res.node.volunteer_avatar ?? undefined} className="object-cover" />
                          <AvatarFallback className={cn('text-[10px] font-bold', tokens.chip)}>
                            {hitName ? getInitials(hitName) : <UserRound className="h-3.5 w-3.5" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-foreground">
                              {hitName ?? label('منصب شاغر', 'Vacant')}
                            </span>
                            {isJoker && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/35 bg-amber-500/12 px-1.5 py-0 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                {label('جوكر', 'Joker')}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">{res.node.title}</p>
                        </div>
                        <Badge variant="outline" className="max-w-[140px] shrink-0 gap-1 truncate px-1.5 py-0.5 text-[10px]">
                          <Layers className="h-2.5 w-2.5 shrink-0 text-primary" />
                          <span className="truncate">{pathText}</span>
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* View Mode Switcher: Board / Tree List */}
        <div className="flex items-center rounded-lg border bg-card p-0.5">
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'board' ? 'secondary' : 'ghost'}
            className="h-7 gap-1.5 px-2.5 text-xs font-medium"
            onClick={() => setViewMode('board')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {label('بورد', 'Board')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
            className="h-7 gap-1.5 px-2.5 text-xs font-medium"
            onClick={() => {
              setViewMode('tree');
              setSearchOpen(false);
            }}
          >
            <ListTree className="h-3.5 w-3.5" />
            {label('قائمة شجرية', 'Tree List')}
          </Button>
        </div>

        {viewMode === 'board' && (
          <>
            {(hasRootInfo || (editable && !ownerNode)) && !activeBoardOwnerId && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (editable && !hasRootInfo && editHandlers) {
                    editHandlers.onEditRootMeta();
                  } else {
                    setRootSidebarOpen(true);
                  }
                }}
              >
                <ImageIcon className="h-4 w-4" />
                {editable && !hasRootInfo
                  ? label('صورة ووصف الفرع', 'Branch Photo & Info')
                  : rootMeta?.title?.trim() || label('عن الفرع', 'Branch Info')}
              </Button>
            )}

            {ownerNode && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onChangeBoardOwner(ownerNode.board_owner_id ?? null)}
              >
                <ArrowRight className={cn('h-4 w-4', !isRTL && 'rotate-180')} />
                {label('رجوع', 'Back')}
              </Button>
            )}

            {editable && (
              <div className="flex items-center rounded-lg border bg-card p-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant={toolMode === 'pan' ? 'secondary' : 'ghost'}
                  className="h-7 w-7"
                  onClick={() => setToolMode('pan')}
                  title={label('وضع التحريك (اضغط Shift للسحب والتحديد)', 'Pan tool (hold Shift to marquee select)')}
                  aria-label={label('وضع التحريك', 'Pan tool')}
                >
                  <Hand className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={toolMode === 'select' ? 'secondary' : 'ghost'}
                  className="h-7 w-7"
                  onClick={() => setToolMode('select')}
                  title={label('تحديد مجموعة كروت بالسحب', 'Box select multiple cards')}
                  aria-label={label('تحديد مجموعة', 'Select tool')}
                >
                  <BoxSelect className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  userAdjustedZoomRef.current = true;
                  setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
                }}
                aria-label={label('تصغير', 'Zoom out')}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  userAdjustedZoomRef.current = true;
                  setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
                }}
                aria-label={label('تكبير', 'Zoom in')}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  userAdjustedZoomRef.current = false;
                  const view = getDefaultView(false);
                  setZoom(view.zoom);
                  setPan(view.pan);
                }}
                aria-label={label('إعادة ضبط العرض', 'Reset view')}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {editable && editHandlers && layerNodes.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleArrangePyramid}
                className="gap-1.5"
                title={label('ترتيب المتطوعين في شكل هرمي حسب الروابط', 'Arrange volunteers into a pyramid based on connections')}
              >
                <Network className="h-4 w-4" />
                {label('ترتيب هرمي', 'Pyramid Layout')}
              </Button>
            )}

            {visibleNodes.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportPng}
                disabled={exporting}
                className="gap-1.5"
                aria-label={label('تصدير كصورة', 'Export PNG')}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {label('تصدير كصورة', 'Export PNG')}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="gap-1.5"
              aria-label={isFullscreen ? label('إنهاء ملء الشاشة', 'Exit Fullscreen') : label('ملء الشاشة', 'Fullscreen')}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
              {isFullscreen ? label('تصغير الشاشة', 'Exit Fullscreen') : label('ملء الشاشة', 'Fullscreen')}
            </Button>
          </>
        )}
      </div>

      {viewMode === 'tree' ? (
        <StructureTreeListView
          nodes={nodes}
          edges={edges}
          rootMeta={rootMeta}
          query={query}
          isRTL={isRTL}
          editable={editable}
          onJumpToNode={jumpToNode}
          onEdit={editHandlers?.onEdit}
          onDelete={editHandlers?.onDelete}
          onAddInLayer={editHandlers?.onCreateInLayer}
        />
      ) : (
      /* Board + Docked Right Section Sidebar */
      <div
        ref={boardContainerRef}
        dir="ltr"
        className={cn(
          'relative flex flex-col overflow-hidden border border-slate-200/80 shadow-inner dark:border-zinc-800/80 lg:flex-row',
          isFullscreen ? 'fixed inset-0 z-40 h-screen w-screen rounded-none border-0 bg-background' : 'rounded-3xl'
        )}
      >
        {isFullscreen && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={toggleFullscreen}
            className="absolute left-4 top-4 z-30 gap-1.5 rounded-full shadow-md backdrop-blur-md"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            {label('تصغير الشاشة', 'Exit Fullscreen')}
          </Button>
        )}
        {isFullscreen && editable && draftControls && (
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/90 px-2 py-1 shadow-lg backdrop-blur-md sm:bottom-auto sm:top-4"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!draftControls.canUndo || draftControls.isSaving}
              onClick={draftControls.onUndo}
              title={label('تراجع (Ctrl+Z)', 'Undo (Ctrl+Z)')}
              aria-label={label('تراجع', 'Undo')}
              className="h-7 gap-1 rounded-full px-2 text-xs"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label('تراجع', 'Undo')}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!draftControls.canRedo || draftControls.isSaving}
              onClick={draftControls.onRedo}
              title={label('إعادة (Ctrl+Y)', 'Redo (Ctrl+Y)')}
              aria-label={label('إعادة', 'Redo')}
              className="h-7 gap-1 rounded-full px-2 text-xs"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label('إعادة', 'Redo')}</span>
            </Button>
            {draftControls.hasUnsavedChanges && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={draftControls.isSaving}
                  onClick={draftControls.onDiscard}
                  title={label('تجاهل التعديلات', 'Discard changes')}
                  aria-label={label('تجاهل التعديلات', 'Discard changes')}
                  className="h-7 gap-1 rounded-full px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label('تجاهل', 'Discard')}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={draftControls.isSaving}
                  onClick={draftControls.onSave}
                  className="h-7 gap-1 rounded-full bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  {draftControls.isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {label('حفظ', 'Save')}
                </Button>
              </>
            )}
          </div>
        )}
        {isFullscreen && activeBoardOwnerId && (
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            className="absolute right-4 top-4 z-30 flex max-w-[calc(100vw-180px)] items-center gap-1 overflow-x-auto rounded-full border bg-background/85 px-2.5 py-1 text-xs shadow-md backdrop-blur-md"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 rounded-full px-2 text-xs font-semibold"
              onClick={() => onChangeBoardOwner(ownerNode?.board_owner_id ?? null)}
            >
              <ArrowRight className={cn('h-3.5 w-3.5', !isRTL && 'rotate-180')} />
              {label('رجوع', 'Back')}
            </Button>
            {breadcrumb.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 rounded-full px-2 text-xs text-muted-foreground"
                onClick={() => onChangeBoardOwner(null)}
              >
                {label('الرئيسية', 'Main')}
              </Button>
            )}
            {breadcrumb.map((crumb, idx) => {
              const isLast = idx === breadcrumb.length - 1;
              const crumbLabel = crumb.section_title?.trim() || getVolunteerName(crumb, isRTL) || crumb.title;
              return (
                <div key={crumb.id} className="flex shrink-0 items-center gap-1">
                  {isRTL ? (
                    <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Button
                    type="button"
                    variant={isLast ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 rounded-full px-2 text-xs font-medium"
                    onClick={() => !isLast && onChangeBoardOwner(crumb.id)}
                  >
                    {crumbLabel}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {/* Ceramic Matte Interactive Board */}
        <div
          ref={viewportRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={(e) => {
            if (!editable || !editHandlers?.onQuickCreate) return;
            if (e.target instanceof HTMLElement && (e.target.closest('[data-node-id]') || e.target.closest('button'))) {
              return;
            }
            const pt = clientToCanvas(e.clientX, e.clientY);
            editHandlers.onQuickCreate({ pos_x: Math.round(pt.x - 88), pos_y: Math.round(pt.y - 50) });
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            'relative flex-1 touch-none overflow-hidden',
            isFullscreen ? 'h-full' : 'h-[65dvh] min-h-[420px] max-h-[620px] sm:h-[620px]',
            'bg-[linear-gradient(145deg,#eef2f1_0%,#e6ebe9_52%,#dde4e2_100%)] dark:bg-[linear-gradient(145deg,#161a1d_0%,#111518_55%,#0d1012_100%)]',
            dragState?.kind === 'pan'
              ? 'cursor-grabbing'
              : dragState?.kind === 'zoom'
                ? 'cursor-ns-resize'
                : editable && toolMode === 'select'
                  ? 'cursor-crosshair'
                  : 'cursor-grab'
          )}
        >
        {/* Soft soothing ambient light */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.45),transparent_60%),radial-gradient(circle_at_80%_75%,rgba(203,213,225,0.28),transparent_55%)] dark:bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.03),transparent_60%)]" />
        {/* Subtle dynamic dot grid synced with pan & zoom */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0',
            'bg-[radial-gradient(rgba(15,23,42,0.14)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.11)_1px,transparent_1px)]',
            dragState === null && 'transition-[background-position,background-size] duration-700 ease-out'
          )}
          style={{
            backgroundSize: `${Math.max(12, 24 * zoom)}px ${Math.max(12, 24 * zoom)}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {visibleNodes.length === 0 ? (
          <div className="relative flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
            <Network className="h-12 w-12 opacity-40" />
            <p className="font-medium">{label('البورد فارغ حالياً', 'The board is empty')}</p>
            {editable && (
              <p className="text-sm">
                {label('اضغط على "إضافة متطوع" لإضافة أعضاء هذه الطبقة.', 'Click "Add Volunteer" to add members to this layer.')}
              </p>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'absolute inset-0 origin-top-left',
              dragState === null && 'transition-transform duration-700 ease-out'
            )}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {/* SVG Connections Layer */}
            <svg className="pointer-events-none absolute -left-[4000px] -top-[4000px] h-[8000px] w-[8000px] overflow-visible">
              <defs>
                <marker id="board-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" className="fill-primary/65" />
                </marker>
                <marker id="board-arrow-focus" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" className="fill-primary" />
                </marker>
                <marker id="board-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" className="fill-destructive" />
                </marker>
              </defs>
              <g transform="translate(4000, 4000)">
                {renderedEdges.map(({ edge, path, midX, midY, x1, y1, x2, y2, isDeputy }) => {
                  const isAutoEdge = edge.id.startsWith('auto-');
                  const isHovered = editable && !isAutoEdge && hoveredEdgeId === edge.id;
                  const isFocusedEdge = Boolean(focusPath && focusPath.edgeIds.has(edge.id));
                  const isDimmedEdge = Boolean(focusPath && !focusPath.edgeIds.has(edge.id)) && !isHovered;
                  return (
                    <g
                      key={edge.id}
                      className={cn(
                        'transition-opacity duration-200',
                        editable && !isAutoEdge && 'pointer-events-auto cursor-pointer',
                        isDimmedEdge && 'opacity-20'
                      )}
                      onMouseEnter={() => editable && !isAutoEdge && setHoveredEdgeId(edge.id)}
                      onMouseLeave={() => editable && !isAutoEdge && setHoveredEdgeId(null)}
                      onClick={(e) => {
                        if (!editable || isAutoEdge || !editHandlers) return;
                        e.stopPropagation();
                        editHandlers.onDeleteEdge(edge.id);
                      }}
                    >
                      <path d={path} fill="none" stroke="transparent" strokeWidth={18} />
                      <path
                        d={path}
                        fill="none"
                        strokeWidth={isHovered ? 3 : isFocusedEdge ? 2.75 : 2}
                        strokeDasharray={isDeputy ? '6 5' : undefined}
                        markerEnd={
                          isDeputy
                            ? undefined
                            : isHovered
                              ? 'url(#board-arrow-active)'
                              : isFocusedEdge
                                ? 'url(#board-arrow-focus)'
                                : 'url(#board-arrow)'
                        }
                        className={cn(
                          'transition-colors duration-200',
                          isHovered
                            ? 'stroke-destructive'
                            : isDeputy
                              ? isFocusedEdge
                                ? 'stroke-amber-500'
                                : 'stroke-amber-500/65'
                              : isFocusedEdge
                                ? 'stroke-primary'
                                : 'stroke-primary/45'
                        )}
                      />
                      {isFocusedEdge && !isHovered && (
                        <>
                          <circle cx={x1} cy={y1} r={3} className={isDeputy ? 'fill-amber-500' : 'fill-primary'} />
                          <circle cx={x2} cy={y2} r={3} className={isDeputy ? 'fill-amber-500' : 'fill-primary'} />
                        </>
                      )}
                      {isHovered && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <circle r={11} className="fill-destructive shadow" />
                          <Trash2 x={-6} y={-6} width={12} height={12} className="text-destructive-foreground" />
                        </g>
                      )}
                    </g>
                  );
                })}

                {snapGuides.map((g, i) =>
                  g.orientation === 'vertical' ? (
                    <line
                      key={`snap-v-${i}-${g.position}`}
                      x1={g.position}
                      y1={g.start}
                      x2={g.position}
                      y2={g.end}
                      strokeWidth={1.5 / Math.max(0.5, zoom)}
                      strokeDasharray="5 4"
                      className="stroke-rose-500/85"
                    />
                  ) : (
                    <line
                      key={`snap-h-${i}-${g.position}`}
                      x1={g.start}
                      y1={g.position}
                      x2={g.end}
                      y2={g.position}
                      strokeWidth={1.5 / Math.max(0.5, zoom)}
                      strokeDasharray="5 4"
                      className="stroke-rose-500/85"
                    />
                  )
                )}

                {dragState?.kind === 'marquee' && (
                  <rect
                    x={Math.min(dragState.startCanvasX, dragState.currCanvasX)}
                    y={Math.min(dragState.startCanvasY, dragState.currCanvasY)}
                    width={Math.abs(dragState.currCanvasX - dragState.startCanvasX)}
                    height={Math.abs(dragState.currCanvasY - dragState.startCanvasY)}
                    rx={6}
                    strokeWidth={1.5 / Math.max(0.5, zoom)}
                    strokeDasharray="5 3"
                    className="fill-primary/10 stroke-primary"
                  />
                )}

                {dragState?.kind === 'connect' && (
                  <path
                    d={
                      dragState.connectKind === 'deputy'
                        ? `M ${dragState.x1} ${dragState.y1} C ${(dragState.x1 + dragState.x2) / 2} ${dragState.y1}, ${(dragState.x1 + dragState.x2) / 2} ${dragState.y2}, ${dragState.x2} ${dragState.y2}`
                        : `M ${dragState.x1} ${dragState.y1} C ${dragState.x1} ${dragState.y1 + 60}, ${dragState.x2} ${dragState.y2 - 60}, ${dragState.x2} ${dragState.y2}`
                    }
                    fill="none"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    markerEnd={dragState.connectKind === 'deputy' ? undefined : 'url(#board-arrow)'}
                    className={dragState.connectKind === 'deputy' ? 'stroke-amber-500' : 'stroke-primary'}
                  />
                )}
              </g>
            </svg>

            {/* Frameless Volunteers on the Ceramic Canvas */}
            {visibleNodes.map((item) => {
              const pos = getPosition(item);
              const isPinnedHead = Boolean(ownerNode && item.id === ownerNode.id);
              const isDraggingThis = dragState?.kind === 'node' && dragState.ids.includes(item.id);
              const isTarget = dragState?.kind === 'connect' && dragState.targetId === item.id;

              return (
                <div
                  key={item.id}
                  data-board-item={item.id}
                  style={{ transform: `translate(${pos.pos_x}px, ${pos.pos_y}px)` }}
                  className={cn('absolute left-0 top-0', isDraggingThis && 'z-30')}
                >
                  <StructureNodeCard
                    node={item}
                    subBoardCount={subBoardCounts.get(item.id) ?? 0}
                    sectionMembers={isPinnedHead ? undefined : sectionMembersMap.get(item.id)}
                    isRTL={isRTL}
                    editable={editable}
                    highlight={highlightFor(item)}
                    isDragging={isDraggingThis}
                    isMultiSelected={selectedIds.has(item.id)}
                    isConnectionTarget={isTarget}
                    isPinnedHead={isPinnedHead}
                    onOpenSectionBoard={(id) => {
                      if (justDraggedRef.current) return;
                      onChangeBoardOwner(id);
                    }}
                    onHoverChange={setHoveredNodeId}
                    onSelect={(id, event) => {
                      if (justDraggedRef.current) return;
                      if (editable && event?.shiftKey && !isPinnedHead) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (selectedId && selectedId !== id && (!ownerNode || selectedId !== ownerNode.id)) {
                            next.add(selectedId);
                          }
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          setSelectedId(next.size === 1 ? Array.from(next)[0] : null);
                          return next;
                        });
                        return;
                      }
                      setSelectedIds(new Set());
                      setSelectedId((prev) => (prev === id ? null : id));
                    }}
                    onEdit={(id) => editHandlers?.onEdit(id)}
                    onDelete={(id) => editHandlers?.onDelete(id)}
                    onStartDrag={handleStartNodeDrag}
                    onStartConnect={handleStartConnect}
                  />
                </div>
              );
            })}
          </div>
        )}
        {editable && selectedIds.size >= 2 && (
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center gap-1 rounded-full border bg-background/95 px-2.5 py-1 shadow-xl backdrop-blur-md"
          >
            <Badge variant="secondary" className="px-2 py-0.5 text-[11px] font-bold">
              {selectedIds.size} {label('محدد', 'selected')}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleAlignRow}
              className="h-7 gap-1 rounded-full px-2 text-xs"
              title={label('محاذاة في صف أفقي', 'Align in horizontal row')}
            >
              <AlignCenterHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label('صف', 'Row')}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleAlignColumn}
              className="h-7 gap-1 rounded-full px-2 text-xs"
              title={label('محاذاة في عمود رأسي', 'Align in vertical column')}
            >
              <AlignCenterVertical className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label('عمود', 'Col')}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDistributeHorizontal}
              className="h-7 gap-1 rounded-full px-2 text-xs"
              title={label('توزيع المسافات بالتساوي', 'Distribute horizontally')}
            >
              <AlignHorizontalSpaceBetween className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label('توزيع', 'Distribute')}</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                setSelectedIds(new Set());
                setSelectedId(null);
              }}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={label('إلغاء التحديد', 'Clear selection')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {visibleNodes.length > 0 && (
          <StructureMiniMap
            nodes={visibleNodes}
            edges={effectiveLayerEdges}
            getNodeBox={getNodeBox}
            focusNodeIds={minimapFocusIds}
            pan={pan}
            zoom={zoom}
            viewportSize={viewportSize}
            isRTL={isRTL}
            onNavigate={handleMiniMapNavigate}
          />
        )}
        </div>

        {/* Docked Right Section Sidebar (takes from board's right space) */}
        {ownerNode && (
          <aside
            dir={isRTL ? 'rtl' : 'ltr'}
            className={cn(
              'w-full shrink-0 space-y-4 overflow-y-auto border-t bg-card/85 p-4 backdrop-blur-md lg:w-72 lg:border-l lg:border-t-0',
              isFullscreen ? 'max-h-[40dvh] lg:h-full lg:max-h-none' : 'lg:h-[620px]'
            )}
          >
            {ownerNode.team_image_url && (
              <div className="overflow-hidden rounded-2xl border bg-muted/30 shadow-sm">
                <img
                  src={ownerNode.team_image_url}
                  alt={ownerNode.section_title ?? ownerNode.title}
                  className="h-44 w-full object-cover"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">
                {ownerNode.section_title?.trim() || ownerNode.title}
              </h2>
              {ownerNode.description ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{ownerNode.description}</p>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  {label('لا يوجد وصف للسكشن بعد', 'No section description yet')}
                </p>
              )}
            </div>

            <div className="space-y-2 border-t pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label('مسئول السكشن / اللجنة', 'Section / Committee Lead')}
              </p>
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 border shadow-sm">
                  <AvatarImage src={ownerNode.volunteer_avatar ?? undefined} className="object-cover" />
                  <AvatarFallback className={cn('text-xs font-bold', STRUCTURE_COLOR_TOKENS[ownerNode.color].chip)}>
                    {getInitials(getVolunteerName(ownerNode, isRTL) ?? ownerNode.title)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">
                    {getVolunteerName(ownerNode, isRTL) ?? label('منصب شاغر', 'Vacant')}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{ownerNode.title}</p>
                </div>
              </div>
              {ownerNode.deputy_id && (
                <div className="flex items-center gap-2.5 pt-1">
                  <Avatar className="h-8 w-8 border shadow-sm">
                    <AvatarImage src={ownerNode.deputy_avatar ?? undefined} className="object-cover" />
                    <AvatarFallback className="text-[11px] font-bold">
                      {getInitials((isRTL ? ownerNode.deputy_name_ar || ownerNode.deputy_name : ownerNode.deputy_name || ownerNode.deputy_name_ar) ?? 'D')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {(isRTL ? ownerNode.deputy_name_ar || ownerNode.deputy_name : ownerNode.deputy_name || ownerNode.deputy_name_ar) ?? label('نائب', 'Deputy')}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {ownerNode.deputy_title?.trim() || label('نائب', 'Deputy')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Section Team Members List */}
            <div className="space-y-2 border-t pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label(
                  `عيلة ${ownerNode.section_title?.trim() || ownerNode.title}`,
                  `${ownerNode.section_title?.trim() || ownerNode.title} Family`
                )}{' '}
                ({layerNodes.length})
              </p>
              {layerNodes.length > 0 ? (
                <div className="space-y-2">
                  {layerNodes.map((member) => {
                    const memberName = getVolunteerName(member, isRTL);
                    return (
                      <div key={member.id} className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 border shadow-sm">
                          <AvatarImage src={member.volunteer_avatar ?? undefined} className="object-cover" />
                          <AvatarFallback className={cn('text-[11px] font-bold', STRUCTURE_COLOR_TOKENS[member.color].chip)}>
                            {getInitials(memberName ?? member.title)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {memberName ?? label('منصب شاغر', 'Vacant')}
                            </p>
                            {member.node_type === 'joker' && (
                              <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/12 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                                {label('جوكر', 'Joker')}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">{member.title}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  {label('لم يُضف أعضاء للسكشن بعد', 'No team members added yet')}
                </p>
              )}
            </div>

            {editable && editHandlers && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={() => editHandlers.onEdit(ownerNode.id)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {label('تعديل السكشن', 'Edit Section')}
              </Button>
            )}
          </aside>
        )}
      </div>
      )}

      {/* Root Branch Info Sidebar Sheet */}
      <Sheet open={rootSidebarOpen} onOpenChange={setRootSidebarOpen}>
        <SheetContent side={isRTL ? 'left' : 'right'} className="w-full overflow-y-auto sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="space-y-5 pt-4">
            <SheetHeader>
              <SheetTitle>{rootMeta?.title?.trim() || label('فريق عمل الفرع', 'Branch Team')}</SheetTitle>
            </SheetHeader>
            {rootMeta?.team_image_url && (
              <div className="overflow-hidden rounded-2xl border shadow-sm">
                <img src={rootMeta.team_image_url} alt={rootMeta.title ?? 'Branch Team'} className="h-52 w-full object-cover" />
              </div>
            )}
            {rootMeta?.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">{rootMeta.description}</p>
            )}
            {editable && editHandlers && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setRootSidebarOpen(false);
                  editHandlers.onEditRootMeta();
                }}
              >
                <Pencil className="h-4 w-4" />
                {label('تعديل صورة ووصف الفرع', 'Edit Branch Photo & Info')}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
