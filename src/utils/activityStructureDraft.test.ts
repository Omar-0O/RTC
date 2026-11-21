import { describe, expect, it } from 'vitest';
import type { SaveStructureNodeInput, StructureVolunteerOption } from '@/services/activityStructure.service';
import type { RootBoardMeta, StructureEdge, StructureNode } from './activityStructureTree';
import {
  MAX_DRAFT_HISTORY,
  applyDraftTransform,
  batchMoveDraftNodes,
  computeBoardDraftDiff,
  countDraftChanges,
  createDraftEdge,
  createDraftHistory,
  createDraftNode,
  deleteDraftEdge,
  deleteDraftNode,
  discardDraft,
  isDraftDiffEmpty,
  markDraftSaved,
  moveDraftNode,
  redoDraft,
  topologicallySortNodes,
  undoDraft,
  updateDraftNode,
  updateDraftRootMeta,
  type BoardSnapshot,
} from './activityStructureDraft';

const BRANCH_ID = 'branch-1';

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
  pos_x: 100,
  pos_y: 120,
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

const sampleVolunteers: StructureVolunteerOption[] = [
  { id: 'v1', full_name: 'Ahmed Ali', full_name_ar: 'أحمد علي', avatar_url: 'https://img/v1.jpg' },
  { id: 'v2', full_name: 'Sara Mahmoud', full_name_ar: 'سارة محمود', avatar_url: 'https://img/v2.jpg' },
  { id: 'v3', full_name: 'Omar Tarek', full_name_ar: 'عمر طارق', avatar_url: null },
];

const makeSaveInput = (overrides: Partial<SaveStructureNodeInput> = {}): SaveStructureNodeInput => ({
  title: 'Role Title',
  volunteer_id: null,
  parent_id: null,
  responsibilities: ['Task A'],
  color: 'blue',
  ...overrides,
});

describe('activityStructureDraft', () => {
  it('records single and batch node moves and skips no-op moves in undo history', () => {
    const base: BoardSnapshot = {
      nodes: [makeNode('n1', { pos_x: 100, pos_y: 200 }), makeNode('n2', { pos_x: 300, pos_y: 200 })],
      edges: [],
      rootMeta: null,
    };
    let draft = createDraftHistory(BRANCH_ID, base);

    // No-op move (rounds to exact same position)
    draft = applyDraftTransform(draft, (s) => moveDraftNode(s, 'n1', 100.2, 199.7));
    expect(draft.past).toHaveLength(0);

    // Single move
    draft = applyDraftTransform(draft, (s) => moveDraftNode(s, 'n1', 250.6, 400.4));
    expect(draft.past).toHaveLength(1);
    expect(draft.present.nodes[0]).toMatchObject({ pos_x: 251, pos_y: 400 });

    // Pyramid batch move
    draft = applyDraftTransform(draft, (s) =>
      batchMoveDraftNodes(s, [
        { id: 'n1', pos_x: 400, pos_y: 80 },
        { id: 'n2', pos_x: 200, pos_y: 350 },
      ])
    );
    expect(draft.past).toHaveLength(2);
    expect(draft.present.nodes.map((n) => ({ pos_x: n.pos_x, pos_y: n.pos_y }))).toEqual([
      { pos_x: 400, pos_y: 80 },
      { pos_x: 200, pos_y: 350 },
    ]);

    // Undo batch move -> back to single move
    draft = undoDraft(draft);
    expect(draft.present.nodes[0]).toMatchObject({ pos_x: 251, pos_y: 400 });
    expect(draft.present.nodes[1]).toMatchObject({ pos_x: 300, pos_y: 200 });
    expect(draft.future).toHaveLength(1);

    // Undo single move -> back to base (empty diff)
    draft = undoDraft(draft);
    expect(isDraftDiffEmpty(computeBoardDraftDiff(draft.base, draft.present))).toBe(true);
    expect(draft.past).toHaveLength(0);
    expect(draft.future).toHaveLength(2);

    // Redo steps
    draft = redoDraft(draft);
    expect(draft.present.nodes[0]).toMatchObject({ pos_x: 251, pos_y: 400 });
    draft = redoDraft(draft);
    expect(draft.present.nodes[1]).toMatchObject({ pos_x: 200, pos_y: 350 });
  });

  it('creates nodes with resolved metadata and sub-board auto-edges removed together on 1 undo', () => {
    const owner = makeNode('head');
    const base: BoardSnapshot = { nodes: [owner], edges: [], rootMeta: null };
    let draft = createDraftHistory(BRANCH_ID, base);

    draft = applyDraftTransform(draft, (s) =>
      createDraftNode(s, {
        id: 'new-1',
        branchId: BRANCH_ID,
        input: makeSaveInput({
          title: 'Media Lead',
          volunteer_id: 'v1',
          custom_avatar_url: 'https://img/custom.jpg',
          squad_volunteer_ids: ['v2', 'v3'],
          pos_x: 240,
          pos_y: 280,
        }),
        sortOrder: 1,
        volunteers: sampleVolunteers,
        activeBoardOwnerId: 'head',
        autoEdgeId: 'auto-edge-1',
      })
    );

    expect(draft.present.nodes).toHaveLength(2);
    const created = draft.present.nodes[1];
    expect(created.volunteer_name_ar).toBe('أحمد علي');
    expect(created.volunteer_avatar).toBe('https://img/custom.jpg');
    expect(created.board_owner_id).toBe('head');
    expect(created.squad_members?.map((m) => m.id)).toEqual(['v2', 'v3']);
    expect(draft.present.edges).toEqual([makeEdge('auto-edge-1', 'head', 'new-1', null)]);

    // One undo removes both node and auto-edge cleanly
    draft = undoDraft(draft);
    expect(draft.present.nodes).toHaveLength(1);
    expect(draft.present.edges).toHaveLength(0);
    expect(isDraftDiffEmpty(computeBoardDraftDiff(draft.base, draft.present))).toBe(true);
  });

  it('updates nodes in draft preserving coordinates and skips identical edits', () => {
    const initial = makeNode('n1', {
      title: 'Lead',
      volunteer_id: 'v1',
      volunteer_name: 'Ahmed Ali',
      volunteer_name_ar: 'أحمد علي',
      volunteer_avatar: 'https://img/v1.jpg',
      responsibilities: ['Ops'],
      color: 'blue',
      pos_x: 333,
      pos_y: 444,
    });
    let draft = createDraftHistory(BRANCH_ID, { nodes: [initial], edges: [], rootMeta: null });

    // No-op edit with identical values
    draft = applyDraftTransform(draft, (s) =>
      updateDraftNode(
        s,
        'n1',
        makeSaveInput({
          title: 'Lead',
          volunteer_id: 'v1',
          responsibilities: ['Ops'],
          color: 'blue',
        }),
        sampleVolunteers
      )
    );
    expect(draft.past).toHaveLength(0);

    // Meaningful edit
    draft = applyDraftTransform(draft, (s) =>
      updateDraftNode(
        s,
        'n1',
        makeSaveInput({
          title: 'Senior Lead',
          volunteer_id: 'v2',
          responsibilities: ['Ops', 'Planning'],
          color: 'teal',
          squad_volunteer_ids: ['v3'],
          section_title: 'Events Section',
        }),
        sampleVolunteers
      )
    );
    expect(draft.past).toHaveLength(1);
    const updated = draft.present.nodes[0];
    expect(updated.title).toBe('Senior Lead');
    expect(updated.volunteer_name_ar).toBe('سارة محمود');
    expect(updated.volunteer_avatar).toBe('https://img/v2.jpg');
    expect(updated.pos_x).toBe(333);
    expect(updated.pos_y).toBe(444);
    expect(updated.section_title).toBe('Events Section');

    draft = undoDraft(draft);
    expect(draft.present.nodes[0].title).toBe('Lead');
    expect(draft.present.nodes[0].volunteer_id).toBe('v1');
  });

  it('cascades sub-boards and attached edges on delete and restores everything on undo', () => {
    const base: BoardSnapshot = {
      nodes: [
        makeNode('root'),
        makeNode('lead', { parent_id: 'root' }),
        makeNode('sub-1', { board_owner_id: 'lead' }),
        makeNode('sub-nested', { board_owner_id: 'sub-1' }),
        makeNode('child', { parent_id: 'lead', section_id: 'lead' }),
      ],
      edges: [
        makeEdge('e1', 'root', 'lead'),
        makeEdge('e2', 'sub-1', 'sub-nested'),
        makeEdge('e3', 'lead', 'child'),
      ],
      rootMeta: null,
    };
    let draft = createDraftHistory(BRANCH_ID, base);

    draft = applyDraftTransform(draft, (s) => deleteDraftNode(s, 'lead'));
    expect(draft.present.nodes.map((n) => n.id)).toEqual(['root', 'child']);
    // Surviving child reattached to surviving grandparent 'root' and section_id cleared
    expect(draft.present.nodes[1].parent_id).toBe('root');
    expect(draft.present.nodes[1].section_id).toBeNull();
    expect(draft.present.edges).toEqual([]);

    // Undo restores all deleted nodes, nested sub-board nodes, and edges intact
    draft = undoDraft(draft);
    expect(draft.present.nodes).toHaveLength(5);
    expect(draft.present.edges).toHaveLength(3);
    expect(isDraftDiffEmpty(computeBoardDraftDiff(draft.base, draft.present))).toBe(true);
  });

  it('handles edge creation, label upgrades, duplicate deputy prevention, and deletion', () => {
    const base: BoardSnapshot = {
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      edges: [makeEdge('e1', 'a', 'b', null)],
      rootMeta: null,
    };
    let draft = createDraftHistory(BRANCH_ID, base);

    // Upgrade existing (a -> b) label to deputy
    draft = applyDraftTransform(draft, (s) =>
      createDraftEdge(s, { id: 'ignored-new-id', branchId: BRANCH_ID, sourceId: 'a', targetId: 'b', label: 'deputy' })
    );
    expect(draft.past).toHaveLength(1);
    expect(draft.present.edges).toEqual([makeEdge('e1', 'a', 'b', 'deputy')]);

    // Prevent reverse duplicate deputy (b -> a)
    draft = applyDraftTransform(draft, (s) =>
      createDraftEdge(s, { id: 'e2', branchId: BRANCH_ID, sourceId: 'b', targetId: 'a', label: 'deputy' })
    );
    expect(draft.past).toHaveLength(1);
    expect(draft.present.edges).toHaveLength(1);

    // Prevent self edge
    draft = applyDraftTransform(draft, (s) =>
      createDraftEdge(s, { id: 'e3', branchId: BRANCH_ID, sourceId: 'c', targetId: 'c', label: null })
    );
    expect(draft.past).toHaveLength(1);

    // Diff detects updated label cleanly
    let diff = computeBoardDraftDiff(draft.base, draft.present);
    expect(diff.updatedEdges).toEqual([makeEdge('e1', 'a', 'b', 'deputy')]);
    expect(diff.createdEdges).toEqual([]);
    expect(diff.deletedEdgeIds).toEqual([]);

    // Delete e1 and recreate new edge on (a -> b)
    draft = applyDraftTransform(draft, (s) => deleteDraftEdge(s, 'e1'));
    draft = applyDraftTransform(draft, (s) =>
      createDraftEdge(s, { id: 'e-recreated', branchId: BRANCH_ID, sourceId: 'a', targetId: 'b', label: null })
    );
    diff = computeBoardDraftDiff(draft.base, draft.present);
    expect(diff.deletedEdgeIds).toEqual(['e1']);
    expect(diff.createdEdges).toEqual([makeEdge('e-recreated', 'a', 'b', null)]);
    expect(diff.updatedEdges).toEqual([]);
  });

  it('tracks root meta changes, discardDraft undoability, and markDraftSaved resets history', () => {
    const rootMeta: RootBoardMeta = {
      branch_id: BRANCH_ID,
      title: 'Branch Board',
      description: 'Initial',
      team_image_url: null,
    };
    let draft = createDraftHistory(BRANCH_ID, {
      nodes: [makeNode('a')],
      edges: [],
      rootMeta,
    });

    // No-op whitespace normalization
    draft = applyDraftTransform(draft, (s) =>
      updateDraftRootMeta(s, BRANCH_ID, { title: ' Branch Board ', description: 'Initial', team_image_url: '' })
    );
    expect(draft.past).toHaveLength(0);

    // Update root meta + move node
    draft = applyDraftTransform(draft, (s) =>
      updateDraftRootMeta(s, BRANCH_ID, { title: 'New Board Title', description: null, team_image_url: 'https://img/bg.png' })
    );
    draft = applyDraftTransform(draft, (s) => moveDraftNode(s, 'a', 500, 300));
    expect(countDraftChanges(computeBoardDraftDiff(draft.base, draft.present))).toBe(2);

    // Discard can be undone
    draft = discardDraft(draft);
    expect(isDraftDiffEmpty(computeBoardDraftDiff(draft.base, draft.present))).toBe(true);
    draft = undoDraft(draft);
    expect(draft.present.rootMeta?.title).toBe('New Board Title');
    expect(draft.present.nodes[0].pos_x).toBe(500);

    // Saving commits base and clears undo/redo history
    draft = markDraftSaved(draft);
    expect(draft.past).toHaveLength(0);
    expect(draft.future).toHaveLength(0);
    expect(isDraftDiffEmpty(computeBoardDraftDiff(draft.base, draft.present))).toBe(true);
  });

  it('produces minimal diffs distinguishing position-only updates and cancels create+delete', () => {
    const base: BoardSnapshot = {
      nodes: [
        makeNode('pos-only', { pos_x: 10, pos_y: 20 }),
        makeNode('field-and-pos', { title: 'Old', pos_x: 50, pos_y: 60 }),
      ],
      edges: [],
      rootMeta: null,
    };
    let draft = createDraftHistory(BRANCH_ID, base);

    // Create temp node then delete it before saving -> disappears completely from diff
    draft = applyDraftTransform(draft, (s) =>
      createDraftNode(s, {
        id: 'temp',
        branchId: BRANCH_ID,
        input: makeSaveInput({ title: 'Temp' }),
        sortOrder: 2,
        volunteers: [],
        activeBoardOwnerId: null,
      })
    );
    draft = applyDraftTransform(draft, (s) => deleteDraftNode(s, 'temp'));

    // Move pos-only node & edit field-and-pos node
    draft = applyDraftTransform(draft, (s) => moveDraftNode(s, 'pos-only', 90, 120));
    draft = applyDraftTransform(draft, (s) =>
      updateDraftNode(
        s,
        'field-and-pos',
        makeSaveInput({ title: 'Renamed', pos_x: 150, pos_y: 160 }),
        []
      )
    );

    const diff = computeBoardDraftDiff(draft.base, draft.present);
    expect(diff.createdNodes).toHaveLength(0);
    expect(diff.deletedNodeIds).toHaveLength(0);
    expect(diff.positionUpdates).toEqual([{ id: 'pos-only', pos_x: 90, pos_y: 120 }]);
    expect(diff.updatedNodes.map((n) => n.id)).toEqual(['field-and-pos']);
  });

  it('topologically sorts created nodes before dependents and handles cycles safely', () => {
    const grandChild = makeNode('sub-child', { board_owner_id: 'sub-owner', parent_id: 'child' });
    const child = makeNode('child', { parent_id: 'root-new' });
    const subOwner = makeNode('sub-owner', { section_id: 'child' });
    const rootNew = makeNode('root-new');

    const sorted = topologicallySortNodes([grandChild, subOwner, child, rootNew], new Set(['existing-node']));
    const indexOf = (id: string) => sorted.findIndex((n) => n.id === id);

    expect(sorted).toHaveLength(4);
    expect(indexOf('root-new')).toBeLessThan(indexOf('child'));
    expect(indexOf('child')).toBeLessThan(indexOf('sub-owner'));
    expect(indexOf('sub-owner')).toBeLessThan(indexOf('sub-child'));

    // Cycle fallback preserves all nodes without infinite loop
    const cycA = makeNode('cyc-a', { parent_id: 'cyc-b' });
    const cycB = makeNode('cyc-b', { parent_id: 'cyc-a' });
    const cycSorted = topologicallySortNodes([cycA, cycB]);
    expect(cycSorted.map((n) => n.id).sort()).toEqual(['cyc-a', 'cyc-b']);
  });

  it('caps history stack at MAX_DRAFT_HISTORY entries', () => {
    let draft = createDraftHistory(BRANCH_ID, {
      nodes: [makeNode('n1', { pos_x: 0, pos_y: 0 })],
      edges: [],
      rootMeta: null,
    });

    for (let i = 1; i <= MAX_DRAFT_HISTORY + 15; i += 1) {
      draft = applyDraftTransform(draft, (s) => moveDraftNode(s, 'n1', i * 10, 0));
    }

    expect(draft.past).toHaveLength(MAX_DRAFT_HISTORY);
    expect(draft.present.nodes[0].pos_x).toBe((MAX_DRAFT_HISTORY + 15) * 10);
  });

  it('creates joker nodes in a sub-board without auto-edges and disconnects head edge when toggled to joker', () => {
    const owner = makeNode('head');
    const linkedMember = makeNode('mem-1', { board_owner_id: 'head', node_type: 'volunteer', volunteer_id: 'v1' });
    const base: BoardSnapshot = {
      nodes: [owner, linkedMember],
      edges: [makeEdge('edge-head-mem', 'head', 'mem-1', null)],
      rootMeta: null,
    };
    let draft = createDraftHistory(BRANCH_ID, base);

    // 1. Creating a joker inside a section adds the node without any automatic edge
    draft = applyDraftTransform(draft, (s) =>
      createDraftNode(s, {
        id: 'joker-1',
        branchId: BRANCH_ID,
        input: makeSaveInput({ title: 'جوكر', node_type: 'joker', volunteer_id: 'v2' }),
        sortOrder: 1,
        volunteers: sampleVolunteers,
        activeBoardOwnerId: 'head',
        autoEdgeId: 'should-not-exist',
      })
    );
    expect(draft.present.nodes).toHaveLength(3);
    expect(draft.present.nodes[2].node_type).toBe('joker');
    expect(draft.present.edges).toEqual([makeEdge('edge-head-mem', 'head', 'mem-1', null)]);

    // 2. Converting an existing linked member inside a section into joker removes default section-head edge
    draft = applyDraftTransform(draft, (s) =>
      updateDraftNode(
        s,
        'mem-1',
        makeSaveInput({ title: 'Joker Support', node_type: 'joker', volunteer_id: 'v1' }),
        sampleVolunteers
      )
    );
    expect(draft.present.nodes[1].node_type).toBe('joker');
    expect(draft.present.edges).toEqual([]);

    // 3. One undo restores both volunteer node_type and the head edge
    draft = undoDraft(draft);
    expect(draft.present.nodes[1].node_type).toBe('volunteer');
    expect(draft.present.edges).toEqual([makeEdge('edge-head-mem', 'head', 'mem-1', null)]);
  });
});
