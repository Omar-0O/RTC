import { describe, expect, it } from 'vitest';
import {
  buildStructureTree,
  canReparent,
  computePyramidLayoutPositions,
  getChainOfCommand,
  getDescendantIds,
  getDirectReports,
  getRecursiveSectionMembers,
  getSearchVisibleIds,
  isStructureColor,
  matchesStructureSearch,
  nextSortOrder,
  parseResponsibilities,
  type StructureNode,
} from './activityStructureTree';

const node = (id: string, parent_id: string | null, extra: Partial<StructureNode> = {}): StructureNode => ({
  id,
  branch_id: 'b1',
  parent_id,
  volunteer_id: null,
  title: id,
  responsibilities: [],
  color: 'primary',
  sort_order: 0,
  volunteer_name: null,
  volunteer_name_ar: null,
  volunteer_avatar: null,
  committee_name: null,
  committee_name_ar: null,
  ...extra,
});

// head → (hr, events) ; events → (logistics) ; logistics → (driver)
const sample: StructureNode[] = [
  node('head', null, { volunteer_name_ar: 'أحمد علي' }),
  node('events', 'head', { sort_order: 1, responsibilities: ['تنظيم الإيفينتات'] }),
  node('hr', 'head', { sort_order: 0, committee_name: 'Human Resources' }),
  node('logistics', 'events'),
  node('driver', 'logistics'),
];

describe('buildStructureTree', () => {
  it('builds a nested tree ordered by sort_order', () => {
    const tree = buildStructureTree(sample);
    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe('head');
    expect(tree[0].children.map((c) => c.node.id)).toEqual(['hr', 'events']);
    expect(tree[0].children[1].children[0].children[0].node.id).toBe('driver');
  });

  it('treats nodes with a missing parent as roots', () => {
    const tree = buildStructureTree([node('a', 'ghost'), node('b', null)]);
    expect(tree.map((t) => t.node.id).sort()).toEqual(['a', 'b']);
  });

  it('never loops forever on cyclic data and places each node once', () => {
    const tree = buildStructureTree([node('x', 'y'), node('y', 'x')]);
    const ids: string[] = [];
    const walk = (items: typeof tree) => items.forEach((t) => { ids.push(t.node.id); walk(t.children); });
    walk(tree);
    expect(ids.sort()).toEqual(['x', 'y']);
  });

  it('returns an empty forest for empty input', () => {
    expect(buildStructureTree([])).toEqual([]);
  });
});

describe('reporting lines', () => {
  it('collects all descendants', () => {
    expect([...getDescendantIds(sample, 'events')].sort()).toEqual(['driver', 'logistics']);
    expect(getDescendantIds(sample, 'driver').size).toBe(0);
  });

  it('blocks reparenting under self or a subordinate', () => {
    expect(canReparent(sample, 'events', 'events')).toBe(false);
    expect(canReparent(sample, 'events', 'driver')).toBe(false);
    expect(canReparent(sample, 'events', 'hr')).toBe(true);
    expect(canReparent(sample, 'events', null)).toBe(true);
    expect(canReparent(sample, 'events', 'unknown')).toBe(false);
  });

  it('returns the chain of command from direct manager to top', () => {
    expect(getChainOfCommand(sample, 'driver').map((n) => n.id)).toEqual(['logistics', 'events', 'head']);
    expect(getChainOfCommand(sample, 'head')).toEqual([]);
  });

  it('is cycle-safe when computing the chain', () => {
    expect(getChainOfCommand([node('x', 'y'), node('y', 'x')], 'x').map((n) => n.id)).toEqual(['y']);
  });

  it('lists direct reports', () => {
    expect(getDirectReports(sample, 'head').map((n) => n.id)).toEqual(['hr', 'events']);
  });
});

describe('search', () => {
  it('matches title, names, committee and responsibilities', () => {
    expect(matchesStructureSearch(sample[0], 'أحمد')).toBe(true);
    expect(matchesStructureSearch(sample[2], 'human')).toBe(true);
    expect(matchesStructureSearch(sample[1], 'الإيفينتات')).toBe(true);
    expect(matchesStructureSearch(sample[1], '   ')).toBe(false);
  });

  it('keeps ancestors of matches visible', () => {
    expect([...getSearchVisibleIds(sample, 'driver')].sort()).toEqual(['driver', 'events', 'head', 'logistics']);
  });
});

describe('parseResponsibilities', () => {
  it('trims, strips bullets, removes blanks and duplicates', () => {
    expect(parseResponsibilities('- متابعة اللجنة\n\n• متابعة اللجنة\n1. رفع التقارير\r\n  3 اجتماعات  ')).toEqual([
      'متابعة اللجنة',
      'رفع التقارير',
      '3 اجتماعات',
    ]);
  });

  it('caps the list at 30 items', () => {
    const text = Array.from({ length: 40 }, (_, i) => `مهمة ${i}`).join('\n');
    expect(parseResponsibilities(text)).toHaveLength(30);
  });
});

describe('misc helpers', () => {
  it('computes next sort order among siblings', () => {
    expect(nextSortOrder(sample, 'head')).toBe(2);
    expect(nextSortOrder(sample, 'driver')).toBe(0);
  });

  it('validates colors', () => {
    expect(isStructureColor('blue')).toBe(true);
    expect(isStructureColor('javascript:alert(1)')).toBe(false);
  });
});

describe('getRecursiveSectionMembers', () => {
  it('collects only direct section volunteers + deputies without pulling nested sub-section members into parent', () => {
    const nodes: StructureNode[] = [
      node('head', null, { volunteer_id: 'v-head', volunteer_name_ar: 'القائد' }),
      node('lead-1', null, {
        board_owner_id: 'head',
        volunteer_id: 'v-1',
        volunteer_name_ar: 'مسئول ١',
        volunteer_avatar: 'https://img/1.jpg',
        deputy_id: 'v-dep1',
        deputy_name_ar: 'نائب ١',
        deputy_avatar: 'https://img/dep1.jpg',
        sort_order: 1,
      }),
      node('vacant', null, { board_owner_id: 'head', volunteer_id: null, sort_order: 2 }),
      node('sub-member', null, {
        board_owner_id: 'lead-1',
        volunteer_id: 'v-2',
        volunteer_name_ar: 'عضو فرعي',
        volunteer_avatar: 'https://img/2.jpg',
        sort_order: 1,
      }),
      node('self-ref', null, {
        board_owner_id: 'head',
        volunteer_id: 'v-head',
        volunteer_name_ar: 'القائد',
      }),
    ];

    const headMembers = getRecursiveSectionMembers(nodes, 'head', true);
    expect(headMembers.map((m) => m.id)).toEqual(['v-1', 'v-dep1']);
    expect(headMembers[0].avatarUrl).toBe('https://img/1.jpg');
    expect(headMembers[1].name).toBe('نائب ١');

    const leadMembers = getRecursiveSectionMembers(nodes, 'lead-1', true);
    expect(leadMembers.map((m) => m.id)).toEqual(['v-2']);
  });

  it('includes manually curated "الفرقة" (squad_members) even without a section and deduplicates', () => {
    const nodes: StructureNode[] = [
      node('solo', null, {
        volunteer_id: 'v-solo',
        squad_members: [
          { id: 'v-sq1', full_name: 'Squad 1', full_name_ar: 'فرقة ١', avatar_url: 'https://img/sq1.jpg' },
          { id: 'v-sq2', full_name: 'Squad 2', full_name_ar: 'فرقة ٢', avatar_url: null },
        ],
      }),
      node('section-dup', null, {
        board_owner_id: 'solo',
        volunteer_id: 'v-sq1',
        volunteer_name_ar: 'فرقة ١',
      }),
    ];

    const members = getRecursiveSectionMembers(nodes, 'solo', true);
    expect(members.map((m) => m.id)).toEqual(['v-sq1', 'v-sq2']);
    expect(members[0].name).toBe('فرقة ١');
  });
});

describe('computePyramidLayoutPositions', () => {
  it('arranges hierarchy levels into a centered non-overlapping pyramid with deputies beside their head', () => {
    const nodes: StructureNode[] = [
      node('head', null, { sort_order: 0 }),
      node('deputy', null, { sort_order: 1 }),
      node('lead-a', null, { sort_order: 1 }),
      node('lead-b', null, { sort_order: 2 }),
      node('mem-1', null, { sort_order: 1 }),
      node('mem-2', null, { sort_order: 2 }),
    ];
    const edges = [
      { id: 'e-dep', branch_id: 'b1', source_id: 'head', target_id: 'deputy', label: 'deputy' },
      { id: 'e-1', branch_id: 'b1', source_id: 'head', target_id: 'lead-a', label: null },
      { id: 'e-2', branch_id: 'b1', source_id: 'head', target_id: 'lead-b', label: null },
      { id: 'e-3', branch_id: 'b1', source_id: 'lead-a', target_id: 'mem-1', label: null },
      { id: 'e-4', branch_id: 'b1', source_id: 'lead-a', target_id: 'mem-2', label: null },
    ];

    const pos = computePyramidLayoutPositions(nodes, edges, true, 80);
    expect(pos.size).toBe(6);

    // Level 0: Head + Deputy side-by-side at y=80 / y=88
    expect(pos.get('head')?.pos_y).toBe(80);
    expect(pos.get('deputy')?.pos_y).toBe(88);
    expect((pos.get('head')?.pos_x ?? 0) - (pos.get('deputy')?.pos_x ?? 0)).toBe(192);

    // Level 1: lead-a and lead-b at y=350, non-overlapping
    expect(pos.get('lead-a')?.pos_y).toBe(350);
    expect(pos.get('lead-b')?.pos_y).toBe(350);
    expect(Math.abs((pos.get('lead-a')?.pos_x ?? 0) - (pos.get('lead-b')?.pos_x ?? 0))).toBeGreaterThanOrEqual(176);

    // Level 2: mem-1 and mem-2 at y=620, centered under lead-a
    expect(pos.get('mem-1')?.pos_y).toBe(620);
    expect(pos.get('mem-2')?.pos_y).toBe(620);
    const memMid = ((pos.get('mem-1')?.pos_x ?? 0) + (pos.get('mem-2')?.pos_x ?? 0)) / 2;
    expect(Math.abs((pos.get('lead-a')?.pos_x ?? 0) - memMid)).toBeLessThanOrEqual(1);
  });
});
