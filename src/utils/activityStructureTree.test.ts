import { describe, expect, it } from 'vitest';
import {
  buildStructureTree,
  canReparent,
  getChainOfCommand,
  getDescendantIds,
  getDirectReports,
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
