/**
 * useActivityStructure — React Query hooks (thin layer over activityStructure.service.ts).
 *
 * Architecture: Component → Hook → Service → Supabase (RLS enforced)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { shouldRetry } from '@/services/api';
import * as structureService from '@/services/activityStructure.service';
import type { ActivityStructureBoardData, SaveStructureNodeInput } from '@/services/activityStructure.service';
import type { BoardDraftDiff } from '@/utils/activityStructureDraft';

export type {
  ActivityStructureBoardData,
  RootBoardMeta,
  StructureNode,
  StructureEdge,
  StructureColor,
  StructureNodeType,
  StructureVolunteerOption,
  SaveStructureNodeInput,
} from '@/services/activityStructure.service';

const CACHE = { staleTime: 60 * 1000, gcTime: 10 * 60 * 1000 } as const;

export function useActivityStructureBoard(branchId: string | null) {
  return useQuery({
    queryKey: queryKeys.activityStructure.nodes(branchId ?? ''),
    queryFn: () => structureService.getActivityStructureBoard(branchId as string),
    enabled: Boolean(branchId),
    retry: shouldRetry,
    ...CACHE,
  });
}

export function useCanManageActivityStructure(branchId: string | null) {
  return useQuery({
    queryKey: queryKeys.activityStructure.canManage(branchId ?? ''),
    queryFn: () => structureService.canManageActivityStructure(branchId as string),
    enabled: Boolean(branchId),
    retry: shouldRetry,
    ...CACHE,
  });
}

export function useStructureVolunteers(branchId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.activityStructure.volunteers(branchId ?? ''),
    queryFn: () => structureService.getStructureVolunteers(branchId as string),
    enabled: Boolean(branchId) && enabled,
    retry: shouldRetry,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useActivityStructureMutations(branchId: string | null) {
  const queryClient = useQueryClient();
  const boardKey = queryKeys.activityStructure.nodes(branchId ?? '');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: boardKey });

  const createNode = useMutation({
    mutationFn: ({ input, sortOrder }: { input: SaveStructureNodeInput; sortOrder: number }) =>
      structureService.createStructureNode(branchId as string, input, sortOrder),
    onSuccess: invalidate,
  });

  const updateNode = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SaveStructureNodeInput }) =>
      structureService.updateStructureNode(id, input),
    onSuccess: invalidate,
  });

  const moveNodePosition = useMutation({
    mutationFn: ({ id, pos_x, pos_y }: { id: string; pos_x: number; pos_y: number }) =>
      structureService.updateNodePosition(id, pos_x, pos_y),
    onMutate: async ({ id, pos_x, pos_y }) => {
      await queryClient.cancelQueries({ queryKey: boardKey });
      const prev = queryClient.getQueryData<ActivityStructureBoardData>(boardKey);
      if (prev) {
        queryClient.setQueryData<ActivityStructureBoardData>(boardKey, {
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === id ? { ...n, pos_x: Math.round(pos_x), pos_y: Math.round(pos_y) } : n)),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(boardKey, ctx.prev);
    },
    onSettled: invalidate,
  });

  const batchMovePositions = useMutation({
    mutationFn: (updates: Array<{ id: string; pos_x: number; pos_y: number }>) =>
      structureService.updateNodePositionsBatch(updates),
    onSuccess: invalidate,
  });

  const assignSection = useMutation({
    mutationFn: ({ id, sectionId }: { id: string; sectionId: string | null }) =>
      structureService.assignNodeToSection(id, sectionId),
    onSuccess: invalidate,
  });

  const deleteNode = useMutation({
    mutationFn: (id: string) => structureService.deleteStructureNode(id),
    onSuccess: invalidate,
  });

  const createEdge = useMutation({
    mutationFn: ({ sourceId, targetId, label }: { sourceId: string; targetId: string; label?: string | null }) =>
      structureService.createStructureEdge(branchId as string, sourceId, targetId, label),
    onSuccess: invalidate,
  });

  const deleteEdge = useMutation({
    mutationFn: (id: string) => structureService.deleteStructureEdge(id),
    onSuccess: invalidate,
  });

  const upsertRootMeta = useMutation({
    mutationFn: (meta: { title: string | null; description: string | null; team_image_url: string | null }) =>
      structureService.upsertRootBoardMeta(branchId as string, meta),
    onSuccess: invalidate,
  });

  const saveDraft = useMutation({
    mutationFn: ({ diff }: { diff: BoardDraftDiff; nextSnapshot: ActivityStructureBoardData }) =>
      structureService.commitBoardDraftDiff(branchId as string, diff),
    onSuccess: (_data, { nextSnapshot }) => {
      queryClient.setQueryData<ActivityStructureBoardData>(boardKey, nextSnapshot);
      void invalidate();
    },
  });

  return {
    createNode,
    updateNode,
    moveNodePosition,
    batchMovePositions,
    assignSection,
    deleteNode,
    createEdge,
    deleteEdge,
    upsertRootMeta,
    saveDraft,
  };
}
