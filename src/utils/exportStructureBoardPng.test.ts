import { describe, expect, it } from 'vitest';
import type { StructureNode } from './activityStructureTree';
import { computeExportBounds } from './exportStructureBoardPng';

const makeNode = (id: string, pos_x = 0, pos_y = 0): StructureNode => ({
  id,
  branch_id: 'b1',
  parent_id: null,
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
  pos_x,
  pos_y,
});

describe('computeExportBounds', () => {
  it('returns null when there are no nodes to export', () => {
    expect(computeExportBounds([], new Map(), new Map())).toBeNull();
  });

  it('calculates padded bounds across all node positions and sizes', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const positions = new Map([
      ['a', { pos_x: 100, pos_y: 80 }],
      ['b', { pos_x: 420, pos_y: 260 }],
    ]);
    const sizes = new Map([
      ['a', { w: 176, h: 160 }],
      ['b', { w: 200, h: 150 }],
    ]);

    const bounds = computeExportBounds(nodes, positions, sizes, 100);
    expect(bounds).toEqual({
      minX: 0,
      minY: -20,
      maxX: 720,
      maxY: 510,
      width: 720,
      height: 530,
    });
  });

  it('uses fallback dimensions when measured sizes are absent', () => {
    const nodes = [makeNode('solo')];
    const positions = new Map([['solo', { pos_x: 50, pos_y: 40 }]]);
    const bounds = computeExportBounds(nodes, positions, new Map(), 50);

    expect(bounds).not.toBeNull();
    expect(bounds?.minX).toBe(0);
    expect(bounds?.minY).toBe(-10);
    expect(bounds?.width).toBeGreaterThan(176);
    expect(bounds?.height).toBeGreaterThan(140);
  });
});
