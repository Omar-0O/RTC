import { STRUCTURE_COLOR_HEX } from '@/components/activityStructure/structureColors';
import {
  getInitials,
  getVolunteerName,
  type SectionMemberThumb,
  type StructureEdge,
  type StructureNode,
} from './activityStructureTree';

export interface ExportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ExportStructureBoardOptions {
  nodes: readonly StructureNode[];
  edges: readonly StructureEdge[];
  positions: ReadonlyMap<string, { pos_x: number; pos_y: number }>;
  sizes: ReadonlyMap<string, { w: number; h: number }>;
  subBoardCounts: ReadonlyMap<string, number>;
  sectionMembersMap: ReadonlyMap<string, SectionMemberThumb[]>;
  pinnedHeadId: string | null;
  boardTitle: string;
  isRTL: boolean;
  isDark: boolean;
}

const DEFAULT_NODE_SIZE = { w: 176, h: 156 };

const NODE_CANVAS_METRICS = {
  diameter: 80,
  centerY: 44,
  innerRadius: 58,
  outerRadius: 82,
  avatarOffsetY: 48,
} as const;

/** Compute padded bounding box covering all exported nodes so orbiting avatars never clip. */
export function computeExportBounds(
  nodes: readonly StructureNode[],
  positions: ReadonlyMap<string, { pos_x: number; pos_y: number }>,
  sizes: ReadonlyMap<string, { w: number; h: number }>,
  padding = 120
): ExportBounds | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    const pos = positions.get(n.id) ?? { pos_x: n.pos_x ?? 0, pos_y: n.pos_y ?? 0 };
    const size = sizes.get(n.id) ?? DEFAULT_NODE_SIZE;
    minX = Math.min(minX, pos.pos_x);
    minY = Math.min(minY, pos.pos_y);
    maxX = Math.max(maxX, pos.pos_x + size.w);
    maxY = Math.max(maxY, pos.pos_y + size.h);
  }

  const paddedMinX = minX - padding;
  const paddedMinY = minY - padding;
  const paddedMaxX = maxX + padding;
  const paddedMaxY = maxY + padding;

  return {
    minX: paddedMinX,
    minY: paddedMinY,
    maxX: paddedMaxX,
    maxY: paddedMaxY,
    width: Math.max(320, paddedMaxX - paddedMinX),
    height: Math.max(240, paddedMaxY - paddedMinY),
  };
}

function loadCorsImage(url: string, timeoutMs = 3500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let settled = false;
    const done = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = url;
  });
}

function drawCoverCircleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number
): void {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (sw <= 0 || sh <= 0) return;

  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = Math.max(0, (sh - side) * 0.25);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, sx, sy, side, side, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

function computeOrbitAngles(count: number, maxSpan: number, fixedStep: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [-90];
  const span = Math.min(maxSpan, (count - 1) * fixedStep);
  const step = span / (count - 1);
  const start = -90 - span / 2;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
    const remaining = words.slice(consumedWords).join(' ');
    let finalLine = remaining || current;
    if (ctx.measureText(finalLine).width > maxWidth) {
      while (finalLine.length > 1 && ctx.measureText(`${finalLine}…`).width > maxWidth) {
        finalLine = finalLine.slice(0, -1);
      }
      finalLine = `${finalLine}…`;
    }
    lines.push(finalLine);
  }

  lines.forEach((line, idx) => {
    ctx.fillText(line, cx, startY + idx * lineHeight);
  });
  return lines.length;
}

function sanitizeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 64) || 'activity-structure'
  );
}

/** Render the visible structure board to an offscreen HTML5 Canvas and trigger PNG download. */
export async function exportStructureBoardPng(options: ExportStructureBoardOptions): Promise<void> {
  const {
    nodes,
    edges,
    positions,
    sizes,
    subBoardCounts,
    sectionMembersMap,
    pinnedHeadId,
    boardTitle,
    isRTL,
    isDark,
  } = options;

  const baseBounds = computeExportBounds(nodes, positions, sizes, 120);
  if (!baseBounds) throw new Error('Nothing to export');

  const headerOffset = boardTitle.trim() ? 56 : 0;
  const totalWidth = baseBounds.width;
  const totalHeight = baseBounds.height + headerOffset;

  const MAX_CANVAS_DIM = 4096;
  const desiredScale = 2;
  const scale = Math.min(desiredScale, MAX_CANVAS_DIM / totalWidth, MAX_CANVAS_DIM / totalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(totalWidth * scale));
  canvas.height = Math.max(1, Math.round(totalHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Preload all unique avatar URLs in parallel
  const urls = new Set<string>();
  for (const n of nodes) {
    if (n.volunteer_avatar) urls.add(n.volunteer_avatar);
    for (const m of sectionMembersMap.get(n.id) ?? []) {
      if (m.avatarUrl) urls.add(m.avatarUrl);
    }
  }
  const imageEntries = await Promise.all(
    Array.from(urls).map(async (url) => [url, await loadCorsImage(url)] as const)
  );
  const loadedImages = new Map<string, HTMLImageElement | null>(imageEntries);

  ctx.save();
  ctx.scale(scale, scale);

  // 1. Ceramic Matte Gradient Background
  const grad = ctx.createLinearGradient(0, 0, totalWidth, totalHeight);
  if (isDark) {
    grad.addColorStop(0, '#161a1d');
    grad.addColorStop(0.55, '#111518');
    grad.addColorStop(1, '#0d1012');
  } else {
    grad.addColorStop(0, '#eef2f1');
    grad.addColorStop(0.52, '#e6ebe9');
    grad.addColorStop(1, '#dde4e2');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // 2. Subtle Dot Grid
  ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.18)';
  const GRID_STEP = 28;
  for (let gx = GRID_STEP / 2; gx < totalWidth; gx += GRID_STEP) {
    for (let gy = GRID_STEP / 2; gy < totalHeight; gy += GRID_STEP) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. Optional Board Title Header
  if (headerOffset > 0) {
    ctx.save();
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ctx.font = '700 22px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = isRTL ? 'rtl' : 'ltr';
    ctx.fillText(boardTitle.trim(), totalWidth / 2, 34);
    ctx.restore();
  }

  // Translate to world coordinate space
  const offsetX = -baseBounds.minX;
  const offsetY = -baseBounds.minY + headerOffset;
  ctx.translate(offsetX, offsetY);

  // 4. Edges Layer
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    if (!nodeMap.has(edge.source_id) || !nodeMap.has(edge.target_id)) continue;
    const fromPos = positions.get(edge.source_id) ?? { pos_x: 0, pos_y: 0 };
    const toPos = positions.get(edge.target_id) ?? { pos_x: 0, pos_y: 0 };
    const fromSize = sizes.get(edge.source_id) ?? DEFAULT_NODE_SIZE;
    const toSize = sizes.get(edge.target_id) ?? DEFAULT_NODE_SIZE;

    if (edge.label === 'deputy') {
      const toIsLeft = toPos.pos_x + toSize.w / 2 < fromPos.pos_x + fromSize.w / 2;
      const x1 = toIsLeft ? fromPos.pos_x + 14 : fromPos.pos_x + fromSize.w - 14;
      const x2 = toIsLeft ? toPos.pos_x + toSize.w - 14 : toPos.pos_x + 14;
      const y1 = fromPos.pos_y + NODE_CANVAS_METRICS.avatarOffsetY;
      const y2 = toPos.pos_y + NODE_CANVAS_METRICS.avatarOffsetY;
      const dx = Math.max(30, Math.abs(x2 - x1) * 0.45);
      const cx1 = toIsLeft ? x1 - dx : x1 + dx;
      const cx2 = toIsLeft ? x2 + dx : x2 - dx;

      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(cx1, y1, cx2, y2, x2, y2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const x1 = fromPos.pos_x + fromSize.w / 2;
    const y1 = fromPos.pos_y + fromSize.h;
    const x2 = toPos.pos_x + toSize.w / 2;
    const y2 = toPos.pos_y;
    const dy = Math.max(50, Math.abs(y2 - y1) * 0.5);

    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.45)';
    ctx.fillStyle = isDark ? 'rgba(96, 165, 250, 0.7)' : 'rgba(37, 99, 235, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1, y1 + dy, x2, y2 - dy, x2, y2 - 4);
    ctx.stroke();

    // Arrowhead at (x2, y2) pointing along end tangent
    const angle = Math.atan2(dy, 0); // approaches downwards
    ctx.translate(x2, y2);
    ctx.rotate(angle - Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-5, -9);
    ctx.lineTo(5, -9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 5. Nodes Layer
  for (const node of nodes) {
    const pos = positions.get(node.id) ?? { pos_x: node.pos_x ?? 0, pos_y: node.pos_y ?? 0 };
    const size = sizes.get(node.id) ?? DEFAULT_NODE_SIZE;
    const metrics = NODE_CANVAS_METRICS;
    const radius = metrics.diameter / 2;
    const cx = pos.pos_x + size.w / 2;
    const cy = pos.pos_y + metrics.centerY;
    const palette = STRUCTURE_COLOR_HEX[node.color];
    const name = getVolunteerName(node, isRTL);
    const isPinnedHead = pinnedHeadId === node.id;

    // 5a. Orbiting Section/Squad thumbnails (non-pinned)
    const orbitMembers = isPinnedHead ? [] : (sectionMembersMap.get(node.id) ?? []);
    if (orbitMembers.length > 0) {
      const innerCount = Math.min(orbitMembers.length, 11);
      const innerAngles = computeOrbitAngles(innerCount, 244, 34);
      const remaining = orbitMembers.slice(11);
      const hasOverflow = remaining.length > 16;
      const outerDisplayCount = hasOverflow ? 15 : remaining.length;
      const outerAngles = computeOrbitAngles(outerDisplayCount + (hasOverflow ? 1 : 0), 256, 22);

      const drawThumb = (member: SectionMemberThumb, rOrbit: number, deg: number, bubbleR: number) => {
        const rad = (deg * Math.PI) / 180;
        const tx = cx + Math.round(rOrbit * Math.cos(rad));
        const ty = cy + Math.round(rOrbit * Math.sin(rad));
        const mPal = STRUCTURE_COLOR_HEX[member.color];
        const mImg = member.avatarUrl ? loadedImages.get(member.avatarUrl) : null;

        ctx.save();
        ctx.fillStyle = isDark ? '#18181b' : '#ffffff';
        ctx.beginPath();
        ctx.arc(tx, ty, bubbleR + 2, 0, Math.PI * 2);
        ctx.fill();

        if (mImg) {
          drawCoverCircleImage(ctx, mImg, tx, ty, bubbleR);
        } else {
          ctx.fillStyle = isDark ? mPal.softDark : mPal.soft;
          ctx.beginPath();
          ctx.arc(tx, ty, bubbleR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = isDark ? '#f8fafc' : mPal.text;
          ctx.font = '700 9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(member.name ? getInitials(member.name) : '?', tx, ty);
        }
        ctx.restore();
      };

      orbitMembers.slice(0, innerCount).forEach((m, idx) => drawThumb(m, metrics.innerRadius, innerAngles[idx], 12));
      remaining.slice(0, outerDisplayCount).forEach((m, idx) => drawThumb(m, metrics.outerRadius, outerAngles[idx], 10));
      if (hasOverflow) {
        const deg = outerAngles[outerAngles.length - 1];
        const rad = (deg * Math.PI) / 180;
        const tx = cx + Math.round(metrics.outerRadius * Math.cos(rad));
        const ty = cy + Math.round(metrics.outerRadius * Math.sin(rad));
        ctx.save();
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(tx, ty, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${remaining.length - outerDisplayCount}`, tx, ty);
        ctx.restore();
      }
    }

    // 5b. Concentric dashed ring if node owns a section
    const hasOwnSection = Boolean(
      !isPinnedHead &&
        (node.section_title?.trim() ||
          node.team_image_url ||
          node.description?.trim() ||
          (subBoardCounts.get(node.id) ?? 0) > 0)
    );
    if (hasOwnSection) {
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5c. Glass outer frame & avatar circle
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.88)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const avatarImg = node.volunteer_avatar ? loadedImages.get(node.volunteer_avatar) : null;
    if (avatarImg) {
      drawCoverCircleImage(ctx, avatarImg, cx, cy, radius);
    } else {
      ctx.save();
      ctx.fillStyle = isDark ? palette.softDark : palette.soft;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isDark ? '#f8fafc' : palette.text;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name ? getInitials(name) : '?', cx, cy);
      ctx.restore();
    }

    // Accent ring around avatar
    ctx.save();
    ctx.strokeStyle = isDark ? '#27272a' : 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 5d. Name & role title underneath
    const textTopY = cy + radius + 16;
    ctx.save();
    ctx.direction = isRTL ? 'rtl' : 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ctx.font = '700 14px system-ui, -apple-system, "Segoe UI", sans-serif';
    const displayName = name ?? (isRTL ? 'منصب شاغر' : 'Vacant');
    drawWrappedText(ctx, displayName, cx, textTopY, size.w - 12, 18, 1);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '500 12px system-ui, -apple-system, "Segoe UI", sans-serif';
    const titleLines = drawWrappedText(ctx, node.title, cx, textTopY + 20, size.w - 12, 15, 2);

    if (node.node_type === 'joker') {
      const jokerLabel = isRTL ? 'جوكر' : 'Joker';
      ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif';
      const textW = ctx.measureText(jokerLabel).width;
      const pillW = Math.ceil(textW + 18);
      const pillH = 16;
      const pillX = cx - pillW / 2;
      const pillY = textTopY + 20 + Math.max(1, titleLines) * 15 + 5;
      ctx.fillStyle = isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.14)';
      ctx.strokeStyle = isDark ? 'rgba(251, 191, 36, 0.4)' : 'rgba(217, 119, 6, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isDark ? '#fcd34d' : '#b45309';
      ctx.textBaseline = 'middle';
      ctx.fillText(jokerLabel, cx, pillY + pillH / 2);
    }
    ctx.restore();
  }

  ctx.restore();

  // Trigger browser PNG download
  const filename = `${sanitizeFilename(boardTitle)}.png`;
  const triggerDownload = (href: string, revokeAfter = false) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (revokeAfter) {
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
  };

  await new Promise<void>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          triggerDownload(URL.createObjectURL(blob), true);
          resolve();
          return;
        }
        try {
          triggerDownload(canvas.toDataURL('image/png'));
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}
