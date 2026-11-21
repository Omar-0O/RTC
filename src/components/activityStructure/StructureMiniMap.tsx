import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Map as MapIcon, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StructureEdge, StructureNode } from '@/utils/activityStructureTree';
import { STRUCTURE_COLOR_HEX } from './structureColors';

const MAP_W = 184;
const MAP_H = 116;

interface StructureMiniMapProps {
  nodes: readonly StructureNode[];
  edges: readonly StructureEdge[];
  getNodeBox: (id: string) => { x: number; y: number; w: number; h: number } | null;
  focusNodeIds: ReadonlySet<string>;
  pan: { x: number; y: number };
  zoom: number;
  viewportSize: { w: number; h: number };
  isRTL: boolean;
  onNavigate: (canvasX: number, canvasY: number) => void;
}

function StructureMiniMapComponent({
  nodes,
  edges,
  getNodeBox,
  focusNodeIds,
  pan,
  zoom,
  viewportSize,
  isRTL,
  onNavigate,
}: StructureMiniMapProps): React.ReactElement | null {
  const [collapsed, setCollapsed] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);

  const label = (ar: string, en: string): string => (isRTL ? ar : en);

  const layout = useMemo(() => {
    const viewX = -pan.x / zoom;
    const viewY = -pan.y / zoom;
    const viewW = viewportSize.w / zoom;
    const viewH = viewportSize.h / zoom;

    let minX = viewX;
    let minY = viewY;
    let maxX = viewX + viewW;
    let maxY = viewY + viewH;

    const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const n of nodes) {
      const box = getNodeBox(n.id);
      if (!box) continue;
      boxes.set(n.id, box);
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.w);
      maxY = Math.max(maxY, box.y + box.h);
    }

    const PAD = 120;
    minX -= PAD;
    minY -= PAD;
    maxX += PAD;
    maxY += PAD;

    const worldW = Math.max(200, maxX - minX);
    const worldH = Math.max(150, maxY - minY);
    const scale = Math.min(MAP_W / worldW, MAP_H / worldH);
    const offsetX = (MAP_W - worldW * scale) / 2;
    const offsetY = (MAP_H - worldH * scale) / 2;

    const toMini = (wx: number, wy: number) => ({
      x: offsetX + (wx - minX) * scale,
      y: offsetY + (wy - minY) * scale,
    });

    return { boxes, minX, minY, scale, offsetX, offsetY, toMini, viewX, viewY, viewW, viewH };
  }, [getNodeBox, nodes, pan.x, pan.y, viewportSize.h, viewportSize.w, zoom]);

  const navigateFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const canvasX = layout.minX + (mx - layout.offsetX) / layout.scale;
      const canvasY = layout.minY + (my - layout.offsetY) / layout.scale;
      onNavigate(canvasX, canvasY);
    },
    [layout, onNavigate]
  );

  if (nodes.length === 0) return null;

  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const viewTopLeft = layout.toMini(layout.viewX, layout.viewY);
  const miniViewW = Math.max(12, layout.viewW * layout.scale);
  const miniViewH = Math.max(10, layout.viewH * layout.scale);

  return (
    <div
      onPointerDown={stopAll}
      onPointerMove={stopAll}
      onPointerUp={stopAll}
      onClick={stopAll}
      onDoubleClick={stopAll}
      className="absolute bottom-3 left-3 z-20 hidden flex-col items-start gap-1.5 sm:flex"
    >
      {collapsed ? (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={() => setCollapsed(false)}
          className="h-8 w-8 rounded-xl border bg-background/85 shadow-md backdrop-blur-md"
          title={label('إظهار الخريطة المصغرة', 'Show mini-map')}
          aria-label={label('إظهار الخريطة المصغرة', 'Show mini-map')}
        >
          <MapIcon className="h-4 w-4" />
        </Button>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
          <div className="mb-1 flex items-center justify-between gap-2 px-1" dir={isRTL ? 'rtl' : 'ltr'}>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <MapIcon className="h-3 w-3" />
              {label('خريطة البورد', 'Mini-Map')}
            </span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={label('تصغير الخريطة', 'Collapse mini-map')}
              title={label('تصغير الخريطة', 'Collapse mini-map')}
            >
              <Minus className="h-3 w-3" />
            </button>
          </div>

          <svg
            ref={svgRef}
            width={MAP_W}
            height={MAP_H}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.button !== 0) return;
              draggingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              navigateFromClient(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              if (!draggingRef.current) return;
              navigateFromClient(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              draggingRef.current = false;
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              draggingRef.current = false;
            }}
            className="cursor-crosshair rounded-lg bg-muted/40"
          >
            {/* Edges */}
            {edges.map((edge) => {
              const from = layout.boxes.get(edge.source_id);
              const to = layout.boxes.get(edge.target_id);
              if (!from || !to) return null;
              const p1 = layout.toMini(from.x + from.w / 2, from.y + from.h / 2);
              const p2 = layout.toMini(to.x + to.w / 2, to.y + to.h / 2);
              const dimmed =
                focusNodeIds.size > 0 && !(focusNodeIds.has(edge.source_id) && focusNodeIds.has(edge.target_id));
              return (
                <line
                  key={edge.id}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={edge.label === 'deputy' ? '#f59e0b' : 'currentColor'}
                  strokeWidth={1}
                  strokeDasharray={edge.label === 'deputy' ? '2 2' : undefined}
                  className={cn(
                    edge.label !== 'deputy' && 'text-slate-400 dark:text-slate-500',
                    dimmed ? 'opacity-20' : 'opacity-70'
                  )}
                />
              );
            })}

            {/* Node dots */}
            {nodes.map((node) => {
              const box = layout.boxes.get(node.id);
              if (!box) return null;
              const pt = layout.toMini(box.x + box.w / 2, box.y + box.h / 2);
              const dimmed = focusNodeIds.size > 0 && !focusNodeIds.has(node.id);
              const hex = STRUCTURE_COLOR_HEX[node.color].solid;
              return (
                <circle
                  key={node.id}
                  cx={pt.x}
                  cy={pt.y}
                  r={3.5}
                  fill={hex}
                  opacity={dimmed ? 0.25 : 0.95}
                />
              );
            })}

            {/* Current viewport rectangle */}
            <rect
              x={viewTopLeft.x}
              y={viewTopLeft.y}
              width={miniViewW}
              height={miniViewH}
              rx={3}
              className="fill-primary/15 stroke-primary"
              strokeWidth={1.25}
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export const StructureMiniMap = memo(StructureMiniMapComponent);
