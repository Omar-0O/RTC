import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Expand,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Network,
  Pencil,
  Search,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  computeAutoLayoutPositions,
  computePyramidLayoutPositions,
  getBoardBreadcrumb,
  getInitials,
  getRecursiveSectionMembers,
  getVolunteerName,
  matchesStructureSearch,
  type RootBoardMeta,
  type SectionMemberThumb,
  type StructureEdge,
  type StructureNode,
} from '@/utils/activityStructureTree';
import { STRUCTURE_COLOR_TOKENS } from './structureColors';
import { StructureNodeCard, type NodeHighlight } from './StructureNodeCard';

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.15;

export interface StructureBoardEditHandlers {
  onEdit: (id: string) => void;
  onEditRootMeta: () => void;
  onDelete: (id: string) => void;
  onMovePosition: (id: string, pos_x: number, pos_y: number) => void;
  onBatchMovePositions: (updates: Array<{ id: string; pos_x: number; pos_y: number }>) => void;
  onCreateEdge: (sourceId: string, targetId: string, label?: string | null) => void;
  onDeleteEdge: (edgeId: string) => void;
}

interface StructureBoardProps {
  nodes: StructureNode[];
  edges: StructureEdge[];
  rootMeta: RootBoardMeta | null;
  activeBoardOwnerId: string | null;
  onChangeBoardOwner: (ownerId: string | null) => void;
  isRTL: boolean;
  editable: boolean;
  pendingPositions?: Record<string, { pos_x: number; pos_y: number }>;
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
  | { kind: 'node'; id: string; startClientX: number; startClientY: number; startX: number; startY: number; moved: boolean }
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
  pendingPositions,
  onViewportCenterChange,
  editHandlers,
}: StructureBoardProps): React.ReactElement {
  const label = (ar: string, en: string): string => (isRTL ? ar : en);

  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const justDraggedRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 32 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rootSidebarOpen, setRootSidebarOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [livePos, setLivePos] = useState<Record<string, { pos_x: number; pos_y: number }>>({});
  const [nodeSizes, setNodeSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

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
  // shown connected with an arrow under the pinned section owner.
  const effectiveLayerEdges = useMemo(() => {
    if (!ownerNode) return layerEdges;
    const hasIncoming = new Set<string>();
    for (const e of layerEdges) hasIncoming.add(e.target_id);
    const autoEdges: StructureEdge[] = [];
    for (const n of layerNodes) {
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
      if (pendingPositions?.[node.id]) return pendingPositions[node.id];
      const x = node.pos_x ?? 0;
      const y = node.pos_y ?? 0;
      if (x === 0 && y === 0) {
        const auto = autoFallback.get(node.id) ?? { pos_x: 120, pos_y: 260 };
        return ownerNode ? { pos_x: auto.pos_x, pos_y: Math.max(240, auto.pos_y + 180) } : auto;
      }
      return { pos_x: x, pos_y: y };
    },
    [autoFallback, livePos, ownerNode, pendingPositions]
  );

  const getCenterPan = useCallback(
    (targetZoom = zoom): { x: number; y: number } => {
      const viewportW = viewportRef.current?.clientWidth || 900;
      const viewportH = viewportRef.current?.clientHeight || 620;
      if (visibleNodes.length === 0) return { x: 40, y: 32 };

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const n of visibleNodes) {
        const pos = getPosition(n);
        const w = nodeSizes[n.id]?.w ?? 160;
        const h = nodeSizes[n.id]?.h ?? 140;
        minX = Math.min(minX, pos.pos_x);
        maxX = Math.max(maxX, pos.pos_x + w);
        minY = Math.min(minY, pos.pos_y);
        maxY = Math.max(maxY, pos.pos_y + h);
      }

      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      return {
        x: Math.round(viewportW / 2 - midX * targetZoom),
        y: Math.round(viewportH / 2 - midY * targetZoom),
      };
    },
    [getPosition, nodeSizes, visibleNodes, zoom]
  );

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

  // Center on layer change
  useEffect(() => {
    setZoom(1);
    setPan(getCenterPan(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardOwnerId]);

  // Auto-recenter back to the head/top after 4 seconds of idle pan
  useEffect(() => {
    if (dragState !== null) return;
    const target = getCenterPan();
    if (Math.abs(pan.x - target.x) < 4 && Math.abs(pan.y - target.y) < 4) return;

    const timer = window.setTimeout(() => {
      setPan(getCenterPan());
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [dragState, getCenterPan, pan.x, pan.y]);

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
      setPan(getCenterPan(zoom));
    }, 60);
  }, [editHandlers, editable, getCenterPan, isRTL, layerEdges, layerNodes, ownerNode, zoom]);

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
  const connectedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>();
    for (const e of effectiveLayerEdges) {
      if (e.source_id === selectedId) set.add(e.target_id);
      if (e.target_id === selectedId) set.add(e.source_id);
    }
    return set;
  }, [effectiveLayerEdges, selectedId]);

  const highlightFor = useCallback(
    (node: StructureNode): NodeHighlight => {
      if (node.id === selectedId) return 'selected';
      if (connectedIds.has(node.id)) return 'chain';
      if (searching && !matchesStructureSearch(node, query)) return 'dimmed';
      return 'none';
    },
    [connectedIds, query, searching, selectedId]
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
      e.stopPropagation();
      const node = byId.get(id);
      if (!node) return;
      const pos = getPosition(node);
      setDragState({
        kind: 'node',
        id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: pos.pos_x,
        startY: pos.pos_y,
        moved: false,
      });
    },
    [byId, editable, getPosition]
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
      setZoom(nextZoom);
    } else if (dragState.kind === 'node') {
      const dx = (e.clientX - dragState.startClientX) / zoom;
      const dy = (e.clientY - dragState.startClientY) / zoom;
      const moved = dragState.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3;
      if (moved !== dragState.moved) setDragState({ ...dragState, moved });
      setLivePos((prev) => ({
        ...prev,
        [dragState.id]: {
          pos_x: Math.round(dragState.startX + dx),
          pos_y: Math.round(dragState.startY + dy),
        },
      }));
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

  const handlePointerUp = () => {
    if (!dragState) return;
    if (dragState.kind === 'node' && dragState.moved && editHandlers) {
      justDraggedRef.current = true;
      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
      const finalPos = livePos[dragState.id];
      if (finalPos) {
        editHandlers.onMovePosition(dragState.id, finalPos.pos_x, finalPos.pos_y);
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
          return { edge, path, midX, midY, isDeputy: true };
        }

        const x1 = from.x + from.w / 2;
        const y1 = from.y + from.h;
        const x2 = to.x + to.w / 2;
        const y2 = to.y;
        const dy = Math.max(50, Math.abs(y2 - y1) * 0.5);
        const path = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        return { edge, path, midX, midY, isDeputy: false };
      })
      .filter(Boolean) as Array<{ edge: StructureEdge; path: string; midX: number; midY: number; isDeputy: boolean }>;
  }, [effectiveLayerEdges, getNodeBox]);

  const hasRootInfo = Boolean(rootMeta?.title?.trim() || rootMeta?.description?.trim() || rootMeta?.team_image_url);

  return (
    <div className="space-y-3">
      {/* Layer Breadcrumb Navigation */}
      {activeBoardOwnerId && (
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
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={label('ابحث عن متطوع، سكشن، أو مسئولية...', 'Search volunteer, section, or role...')}
            className="ps-9"
          />
        </div>

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

        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
            aria-label={label('تصغير', 'Zoom out')}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
            aria-label={label('تكبير', 'Zoom in')}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              setZoom(1);
              setPan(getCenterPan(1));
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
      </div>

      {/* Board + Docked Right Section Sidebar */}
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
        {/* Ceramic Matte Interactive Board */}
        <div
          ref={viewportRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            'relative flex-1 overflow-hidden',
            isFullscreen ? 'h-full' : 'h-[620px]',
            'bg-[linear-gradient(145deg,#eef2f1_0%,#e6ebe9_52%,#dde4e2_100%)] dark:bg-[linear-gradient(145deg,#161a1d_0%,#111518_55%,#0d1012_100%)]',
            dragState?.kind === 'pan'
              ? 'cursor-grabbing'
              : dragState?.kind === 'zoom'
                ? 'cursor-ns-resize'
                : 'cursor-grab'
          )}
        >
        {/* Soft soothing ambient light */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.45),transparent_60%),radial-gradient(circle_at_80%_75%,rgba(203,213,225,0.28),transparent_55%)] dark:bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.03),transparent_60%)]" />

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
                <marker id="board-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" className="fill-destructive" />
                </marker>
              </defs>
              <g transform="translate(4000, 4000)">
                {renderedEdges.map(({ edge, path, midX, midY, isDeputy }) => {
                  const isAutoEdge = edge.id.startsWith('auto-');
                  const isHovered = editable && !isAutoEdge && hoveredEdgeId === edge.id;
                  return (
                    <g
                      key={edge.id}
                      className={editable && !isAutoEdge ? 'pointer-events-auto cursor-pointer' : undefined}
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
                        strokeWidth={isHovered ? 3 : 2}
                        strokeDasharray={isDeputy ? '6 5' : undefined}
                        markerEnd={isDeputy ? undefined : isHovered ? 'url(#board-arrow-active)' : 'url(#board-arrow)'}
                        className={cn(
                          'transition-colors duration-200',
                          isHovered
                            ? 'stroke-destructive'
                            : isDeputy
                              ? 'stroke-amber-500/65'
                              : 'stroke-primary/45'
                        )}
                      />
                      {isHovered && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <circle r={11} className="fill-destructive shadow" />
                          <Trash2 x={-6} y={-6} width={12} height={12} className="text-destructive-foreground" />
                        </g>
                      )}
                    </g>
                  );
                })}

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
              const isDraggingThis = dragState?.kind === 'node' && dragState.id === item.id;
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
                    isConnectionTarget={isTarget}
                    isPinnedHead={isPinnedHead}
                    onOpenSectionBoard={(id) => {
                      if (justDraggedRef.current) return;
                      onChangeBoardOwner(id);
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
        </div>

        {/* Docked Right Section Sidebar (takes from board's right space) */}
        {ownerNode && (
          <aside
            dir={isRTL ? 'rtl' : 'ltr'}
            className={cn(
              'w-full shrink-0 space-y-4 overflow-y-auto border-t bg-card/85 p-4 backdrop-blur-md lg:w-72 lg:border-l lg:border-t-0',
              isFullscreen ? 'lg:h-full' : 'lg:h-[620px]'
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
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {memberName ?? label('منصب شاغر', 'Vacant')}
                          </p>
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
