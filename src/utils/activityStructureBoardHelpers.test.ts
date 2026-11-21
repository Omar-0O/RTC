import { describe, expect, it } from 'vitest';
import type { StructureEdge, StructureNode } from './activityStructureTree';
import {
  buildFullStructureHierarchy,
  computeAlignColumnUpdates,
  computeAlignRowUpdates,
  computeBoardFitView,
  computeDistributeHorizontalUpdates,
  computeSnapAlignment,
  filterLayerHierarchy,
  getNodesInMarquee,
  searchStructureAcrossLayers,
  type SnapRect,
} from './activityStructureBoardHelpers';

const BRANCH_ID = 'b1';

const makeNode = (id: string, extra: Partial<StructureNode> = {}): StructureNode => ({
  id,
  branch_id: BRANCH_ID,
  parent_id: null,
  volunteer_id: null,
  title: id,
  responsibilities: [],
  color: 'primary',
  sort_order: 0,
  node_type: 'volunteer',
  section_id: null,
  board_owner_id: null,
  section_title: null,
  description: null,
  team_image_url: null,
  custom_avatar_url: null,
  squad_volunteer_ids: [],
  squad_members: [],
  deputy_id: null,
  deputy_title: null,
  pos_x: 0,
  pos_y: 0,
  width: 320,
  height: 220,
  volunteer_name: null,
  volunteer_name_ar: null,
  volunteer_avatar: null,
  deputy_name: null,
  deputy_name_ar: null,
  deputy_avatar: null,
  committee_name: null,
  committee_name_ar: null,
  ...extra,
});

const makeEdge = (
  id: string,
  source_id: string,
  target_id: string,
  label: string | null = null
): StructureEdge => ({
  id,
  branch_id: BRANCH_ID,
  source_id,
  target_id,
  label,
});

describe('searchStructureAcrossLayers', () => {
  it('finds matches across root and nested sub-boards with full breadcrumb path and ranks prefix/shallow first', () => {
    const nodes: StructureNode[] = [
      makeNode('head', { title: 'Head', volunteer_name_ar: 'أحمد حسام', section_title: 'الإدارة' }),
      makeNode('events-lead', { title: 'Events Lead', section_title: 'لجنة الإيفينتات', board_owner_id: null }),
      makeNode('deep-joker', {
        title: 'دعم',
        node_type: 'joker',
        board_owner_id: 'events-lead',
        volunteer_name_ar: 'سيف الدين',
      }),
      makeNode('deep-member', {
        title: 'منسق',
        board_owner_id: 'events-lead',
        volunteer_name_ar: 'طارق أحمد',
      }),
      makeNode('legacy-section', { title: 'Hidden Legacy Section', node_type: 'section' }),
    ];

    const ahmedHits = searchStructureAcrossLayers(nodes, 'أحمد');
    expect(ahmedHits.map((r) => r.node.id)).toEqual(['head', 'deep-member']);
    expect(ahmedHits[0].layerOwnerId).toBeNull();
    expect(ahmedHits[0].layerPath).toEqual([]);
    expect(ahmedHits[1].layerOwnerId).toBe('events-lead');
    expect(ahmedHits[1].layerPath.map((c) => c.id)).toEqual(['events-lead']);

    const jokerHits = searchStructureAcrossLayers(nodes, 'جوكر');
    expect(jokerHits.map((r) => r.node.id)).toEqual(['deep-joker']);
    expect(jokerHits[0].layerPath.map((c) => c.id)).toEqual(['events-lead']);

    expect(searchStructureAcrossLayers(nodes, 'Legacy')).toEqual([]);
  });
});

describe('computeSnapAlignment', () => {
  const targets: SnapRect[] = [
    { id: 't1', x: 200, y: 100, w: 176, h: 156 },
    { id: 't2', x: 500, y: 100, w: 176, h: 156 },
  ];

  it('snaps moving rect edges/centers within threshold and emits deduplicated guide segments', () => {
    // Center X near t1 (200 + 88 = 288 -> moving x=204 has center 292 -> dx = -4), y=105 -> dy = -5
    const snap = computeSnapAlignment({ x: 204, y: 105, w: 176, h: 156 }, targets, 8);
    expect(snap.dx).toBe(-4);
    expect(snap.dy).toBe(-5);

    const vGuides = snap.guides.filter((g) => g.orientation === 'vertical');
    const hGuides = snap.guides.filter((g) => g.orientation === 'horizontal');
    expect(vGuides.length).toBeGreaterThanOrEqual(1);
    expect(vGuides.some((g) => g.position === 288)).toBe(true);
    expect(hGuides.some((g) => g.position === 100)).toBe(true);
  });

  it('returns zero delta and empty guides when outside threshold', () => {
    const snap = computeSnapAlignment({ x: 350, y: 400, w: 176, h: 156 }, targets, 8);
    expect(snap).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});

describe('marquee selection and multi-card align/distribute', () => {
  const boxes: SnapRect[] = [
    { id: 'a', x: 100, y: 200, w: 176, h: 150 },
    { id: 'b', x: 250, y: 240, w: 176, h: 150 },
    { id: 'c', x: 800, y: 600, w: 176, h: 150 },
  ];

  it('returns intersecting node IDs even for reversed drag coordinates', () => {
    expect(getNodesInMarquee({ x1: 300, y1: 300, x2: 120, y2: 180 }, boxes)).toEqual(['a', 'b']);
  });

  it('computes row, column, and evenly distributed positions', () => {
    expect(computeAlignRowUpdates(boxes.slice(0, 2))).toEqual([
      { id: 'a', pos_x: 100, pos_y: 220 },
      { id: 'b', pos_x: 250, pos_y: 220 },
    ]);

    expect(computeAlignColumnUpdates(boxes.slice(0, 2))).toEqual([
      { id: 'a', pos_x: 175, pos_y: 200 },
      { id: 'b', pos_x: 175, pos_y: 240 },
    ]);

    expect(computeDistributeHorizontalUpdates(boxes.slice(0, 2), 220)).toEqual([
      { id: 'a', pos_x: 100, pos_y: 200 },
      { id: 'b', pos_x: 320, pos_y: 240 },
    ]);

    expect(computeAlignRowUpdates([boxes[0]])).toEqual([]);
    expect(computeAlignColumnUpdates([])).toEqual([]);
    expect(computeDistributeHorizontalUpdates([boxes[0]])).toEqual([]);
  });
});

describe('buildFullStructureHierarchy & filterLayerHierarchy', () => {
  it('organizes nested sub-boards, inline deputies, and unconnected jokers and filters deep paths', () => {
    const nodes: StructureNode[] = [
      makeNode('head', { volunteer_name_ar: 'مصطفى' }),
      makeNode('dep', { volunteer_name_ar: 'نائب القائد' }),
      makeNode('lead-hr', { title: 'HR Lead', section_title: 'قسم HR', volunteer_name_ar: 'سارة' }),
      makeNode('root-joker', { node_type: 'joker', title: 'جوكر فرع', volunteer_name_ar: 'خالد' }),
      makeNode('hr-member', { board_owner_id: 'lead-hr', volunteer_name_ar: 'نور' }),
      makeNode('hr-joker', { board_owner_id: 'lead-hr', node_type: 'joker', volunteer_name_ar: 'يارا' }),
    ];
    const edges: StructureEdge[] = [
      makeEdge('e-dep', 'head', 'dep', 'deputy'),
      makeEdge('e-hr', 'head', 'lead-hr', null),
    ];

    const full = buildFullStructureHierarchy(nodes, edges);
    expect(full.totalCount).toBe(6);
    expect(full.jokers.map((j) => j.id)).toEqual(['root-joker']);
    expect(full.roots).toHaveLength(1);
    expect(full.roots[0].deputies.map((d) => d.id)).toEqual(['dep']);
    expect(full.roots[0].children).toHaveLength(1);

    const hrEntry = full.roots[0].children[0];
    expect(hrEntry.node.id).toBe('lead-hr');
    expect(hrEntry.subBoard).not.toBeNull();
    expect(hrEntry.subBoard?.roots.map((r) => r.node.id)).toEqual(['hr-member']);
    expect(hrEntry.subBoard?.jokers.map((j) => j.id)).toEqual(['hr-joker']);

    // Filter for deep sub-board joker "يارا" preserves ancestor chain Head -> HR Lead -> Sub-board
    const filtered = filterLayerHierarchy(full, 'يارا');
    expect(filtered.totalCount).toBe(3); // head + lead-hr + hr-joker
    expect(filtered.jokers).toEqual([]);
    expect(filtered.roots[0].children[0].subBoard?.jokers.map((j) => j.id)).toEqual(['hr-joker']);
  });
});

describe('computeBoardFitView', () => {
  it('zooms out to fit all boxes cleanly with top-most node anchored at padTop', () => {
    const view = computeBoardFitView(
      [
        { x: 400, y: 80, w: 176, h: 150 },
        { x: -200, y: 600, w: 176, h: 150 },
        { x: 1100, y: 600, w: 176, h: 150 },
      ],
      { w: 900, h: 620 }
    );

    // Content width = 1476, height = 670 -> fit ratio limited by width (756 / 1476 ~ 0.512)
    expect(view.zoom).toBeLessThan(1);
    expect(view.zoom).toBeGreaterThanOrEqual(0.25);
    // Top-most y (80) placed at padTop (64): pan.y = Math.round(64 - 80 * zoom)
    expect(view.pan.y).toBe(Math.round(64 - 80 * view.zoom));
    // Horizontally centered: midX = (-200 + 1276) / 2 = 538
    expect(view.pan.x).toBe(Math.round(450 - 538 * view.zoom));
  });

  it('caps auto-zoom at 1.0 for compact boards while keeping top anchoring', () => {
    const view = computeBoardFitView([{ x: 300, y: 100, w: 176, h: 150 }], { w: 900, h: 620 });
    expect(view.zoom).toBe(1);
    expect(view.pan.y).toBe(64 - 100);
    expect(view.pan.x).toBe(450 - 388);
  });

  it('preserves fixedZoom when user manually adjusted zoom and handles empty input', () => {
    const custom = computeBoardFitView(
      [
        { x: 100, y: 80, w: 176, h: 150 },
        { x: 500, y: 380, w: 176, h: 150 },
      ],
      { w: 900, h: 620 },
      { fixedZoom: 1.35 }
    );
    expect(custom.zoom).toBe(1.35);
    expect(custom.pan.y).toBe(Math.round(64 - 80 * 1.35));

    expect(computeBoardFitView([], { w: 900, h: 620 })).toEqual({ zoom: 1, pan: { x: 40, y: 32 } });
  });
});
