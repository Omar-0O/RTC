import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  AlertCircle,
  Building2,
  GitFork,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useActivityStructureBoard,
  useActivityStructureMutations,
  useCanManageActivityStructure,
  useStructureVolunteers,
} from '@/hooks/useActivityStructure';
import { StructureBoard, type StructureBoardEditHandlers } from '@/components/activityStructure/StructureBoard';
import { StructureNodeDialog } from '@/components/activityStructure/StructureNodeDialog';
import { RootBoardMetaDialog } from '@/components/activityStructure/RootBoardMetaDialog';
import { nextSortOrder, type StructureNode } from '@/utils/activityStructureTree';
import type { SaveStructureNodeInput } from '@/services/activityStructure.service';

export default function ActivityStructure(): React.ReactElement {
  const { language, isRTL } = useLanguage();
  const label = useCallback((ar: string, en: string): string => (isRTL ? ar : en), [isRTL]);

  const { primaryRole } = useAuth();
  const { branches, activeBranch, setActiveBranch, canViewAllBranches, userBranchId } = useBranch();

  const effectiveBranchId = useMemo(() => {
    if (canViewAllBranches) {
      return activeBranch?.id || branches[0]?.id || null;
    }
    return userBranchId || activeBranch?.id || null;
  }, [activeBranch?.id, branches, canViewAllBranches, userBranchId]);

  const effectiveBranch = useMemo(
    () => branches.find((b) => b.id === effectiveBranchId) || activeBranch || null,
    [branches, effectiveBranchId, activeBranch]
  );

  // Queries & permissions
  const {
    data: board = { nodes: [], edges: [], rootMeta: null },
    isLoading: boardLoading,
    error: boardError,
  } = useActivityStructureBoard(effectiveBranchId);

  const { nodes, edges, rootMeta } = board;
  const { data: canManageServer = false } = useCanManageActivityStructure(effectiveBranchId);

  const canManage = useMemo(() => {
    if (canManageServer) return true;
    if (primaryRole === 'admin') return true;
    if (['branch_admin', 'supervisor', 'head_hr'].includes(primaryRole)) {
      return Boolean(userBranchId && effectiveBranchId && userBranchId === effectiveBranchId);
    }
    return false;
  }, [canManageServer, primaryRole, userBranchId, effectiveBranchId]);

  // Multi-layer navigation state (null = Root Branch Board; <nodeId> = Sub-board owned by that node)
  const [activeBoardOwnerId, setActiveBoardOwnerId] = useState<string | null>(null);

  // UI state
  const [editMode, setEditMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rootMetaOpen, setRootMetaOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<StructureNode | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [pendingPositions, setPendingPositions] = useState<Record<string, { pos_x: number; pos_y: number }>>({});
  const [positionHistory, setPositionHistory] = useState<Array<Record<string, { pos_x: number; pos_y: number }>>>([]);
  const viewportCenterRef = useRef<{ pos_x: number; pos_y: number }>({ pos_x: 320, pos_y: 220 });

  const hasUnsavedChanges = Object.keys(pendingPositions).length > 0;

  const { data: volunteers = [] } = useStructureVolunteers(effectiveBranchId, dialogOpen || editMode);

  // Mutations
  const {
    createNode,
    updateNode,
    batchMovePositions,
    deleteNode,
    createEdge,
    deleteEdge,
    upsertRootMeta,
  } = useActivityStructureMutations(effectiveBranchId);

  const isSaving = createNode.isPending || updateNode.isPending || deleteNode.isPending;

  const editHandlers: StructureBoardEditHandlers | undefined = useMemo(() => {
    if (!canManage || !editMode) return undefined;

    return {
      onEdit: (id: string) => {
        const found = nodes.find((n) => n.id === id);
        if (found) {
          setEditingNode(found);
          setDialogOpen(true);
        }
      },
      onEditRootMeta: () => {
        setRootMetaOpen(true);
      },
      onDelete: (id: string) => {
        setDeleteTargetId(id);
      },
      onMovePosition: (id: string, pos_x: number, pos_y: number) => {
        setPendingPositions((prev) => {
          setPositionHistory((hist) => [...hist, prev]);
          return { ...prev, [id]: { pos_x, pos_y } };
        });
      },
      onBatchMovePositions: (updates) => {
        setPendingPositions((prev) => {
          setPositionHistory((hist) => [...hist, prev]);
          const next = { ...prev };
          for (const u of updates) next[u.id] = { pos_x: u.pos_x, pos_y: u.pos_y };
          return next;
        });
      },
      onCreateEdge: (sourceId: string, targetId: string) => {
        createEdge.mutate(
          { sourceId, targetId },
          {
            onSuccess: () => toast.success(label('تم إنشاء التوصيل', 'Connection added')),
            onError: (err) => toast.error(err instanceof Error ? err.message : label('تعذر التوصيل', 'Failed to connect')),
          }
        );
      },
      onDeleteEdge: (edgeId: string) => {
        deleteEdge.mutate(edgeId, {
          onSuccess: () => toast.success(label('تم حذف التوصيل', 'Connection removed')),
          onError: (err) => toast.error(err instanceof Error ? err.message : label('تعذر الحذف', 'Failed to remove')),
        });
      },
    };
  }, [canManage, editMode, nodes, createEdge, deleteEdge, label]);

  const handleSaveChanges = async () => {
    const updates = Object.entries(pendingPositions).map(([id, pos]) => ({ id, ...pos }));
    if (updates.length === 0) return;
    try {
      await batchMovePositions.mutateAsync(updates);
      setPendingPositions({});
      setPositionHistory([]);
      toast.success(label('تم حفظ التعديلات بنجاح', 'Changes saved successfully'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : label('تعذر حفظ التعديلات', 'Failed to save changes'));
    }
  };

  const handleRevertStep = () => {
    if (positionHistory.length === 0) return;
    const previous = positionHistory[positionHistory.length - 1];
    setPositionHistory((hist) => hist.slice(0, -1));
    setPendingPositions(previous);
  };

  const handleOpenCreate = () => {
    setEditingNode(null);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (input: SaveStructureNodeInput) => {
    try {
      if (editingNode) {
        await updateNode.mutateAsync({ id: editingNode.id, input });
        toast.success(label('تم التحديث بنجاح', 'Updated successfully'));
      } else {
        const { pos_x, pos_y } = viewportCenterRef.current;
        const sortOrder = nextSortOrder(nodes, null);
        await createNode.mutateAsync({
          input: { ...input, board_owner_id: activeBoardOwnerId, pos_x, pos_y },
          sortOrder,
        });
        toast.success(label('تم إضافة المتطوع بنجاح', 'Volunteer added successfully'));
      }
      setDialogOpen(false);
      setEditingNode(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : label('فشل في الحفظ', 'Failed to save'));
    }
  };

  const handleSaveRootMeta = async (meta: { title: string | null; description: string | null; team_image_url: string | null }) => {
    try {
      await upsertRootMeta.mutateAsync(meta);
      toast.success(label('تم حفظ بيانات الفرع', 'Branch info saved'));
      setRootMetaOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : label('فشل الحفظ', 'Failed to save'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteNode.mutateAsync(deleteTargetId);
      if (activeBoardOwnerId === deleteTargetId) {
        setActiveBoardOwnerId(null);
      }
      toast.success(label('تم الحذف بنجاح', 'Deleted successfully'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : label('تعذر الحذف', 'Failed to delete'));
    } finally {
      setDeleteTargetId(null);
    }
  };

  const deleteTargetNode = nodes.find((n) => n.id === deleteTargetId);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header Card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GitFork className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight sm:text-2xl">
                {label('هيكلة النشاط', 'Activity Structure')}
              </CardTitle>
              {effectiveBranch && (
                <Badge variant="outline" className="gap-1 px-2.5 py-0.5 text-xs font-semibold">
                  <Building2 className="h-3 w-3" />
                  {language === 'ar' ? effectiveBranch.name_ar : effectiveBranch.name}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canViewAllBranches && branches.length > 1 && (
              <Select
                value={effectiveBranchId || ''}
                onValueChange={(val) => {
                  const b = branches.find((branch) => branch.id === val);
                  if (b) {
                    setActiveBranch(b);
                    setActiveBoardOwnerId(null);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder={label('اختر الفرع', 'Select Branch')} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {language === 'ar' ? branch.name_ar : branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {canManage ? (
              <div className="flex flex-wrap items-center gap-2.5 rounded-lg border bg-muted/40 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Switch id="edit-mode-toggle" checked={editMode} onCheckedChange={setEditMode} />
                  <label htmlFor="edit-mode-toggle" className="cursor-pointer select-none text-xs font-medium">
                    {label('وضع التعديل', 'Edit Mode')}
                  </label>
                </div>

                {editMode && (
                  <>
                    <Button size="sm" onClick={handleOpenCreate} className="h-8 gap-1.5 font-medium">
                      <UserPlus className="h-3.5 w-3.5" />
                      {label('إضافة متطوع', 'Add Volunteer')}
                    </Button>
                    {(hasUnsavedChanges || positionHistory.length > 0) && (
                      <>
                        {positionHistory.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRevertStep}
                            disabled={batchMovePositions.isPending}
                            className="h-8 gap-1.5 px-2.5 text-xs font-medium"
                            title={label('رجوع خطوة للخلف', 'Revert last step')}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{label('تراجع', 'Revert')}</span>
                          </Button>
                        )}
                        {hasUnsavedChanges && (
                          <Button
                            size="sm"
                            onClick={handleSaveChanges}
                            disabled={batchMovePositions.isPending}
                            className="h-8 gap-1.5 bg-emerald-600 font-medium text-white hover:bg-emerald-700"
                          >
                            {batchMovePositions.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            {label('حفظ', 'Save')}
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <Badge variant="secondary" className="gap-1 py-1 text-xs">
                <Lock className="h-3 w-3" />
                {label('عرض فقط', 'Read only')}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Main Board Area */}
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          {boardLoading ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{label('جاري تحميل هيكلة النشاط...', 'Loading activity structure...')}</p>
            </div>
          ) : boardError ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center text-destructive">
              <AlertCircle className="h-10 w-10 opacity-70" />
              <p className="font-semibold">{label('تعذر تحميل هيكل النشاط', 'Failed to load activity structure')}</p>
              <p className="max-w-md text-xs text-muted-foreground">
                {boardError instanceof Error ? boardError.message : String(boardError)}
              </p>
            </div>
          ) : (
            <StructureBoard
              nodes={nodes}
              edges={edges}
              rootMeta={rootMeta}
              activeBoardOwnerId={activeBoardOwnerId}
              onChangeBoardOwner={setActiveBoardOwnerId}
              isRTL={isRTL}
              editable={Boolean(editHandlers)}
              pendingPositions={pendingPositions}
              onViewportCenterChange={(center) => {
                viewportCenterRef.current = center;
              }}
              editHandlers={editHandlers}
            />
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Volunteer & Section Dialog */}
      <StructureNodeDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingNode(null);
        }}
        branchId={effectiveBranchId}
        isRTL={isRTL}
        volunteers={volunteers}
        editing={editingNode}
        activeBoardOwnerId={activeBoardOwnerId}
        saving={isSaving}
        onSubmit={handleFormSubmit}
      />

      {/* Root Branch Group Photo & Info Dialog */}
      <RootBoardMetaDialog
        open={rootMetaOpen}
        onOpenChange={setRootMetaOpen}
        branchId={effectiveBranchId}
        isRTL={isRTL}
        meta={rootMeta}
        saving={upsertRootMeta.isPending}
        onSubmit={handleSaveRootMeta}
      />

      {/* Confirm Delete Dialog */}
      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{label('تأكيد الحذف', 'Confirm Deletion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {label(
                `هل أنت متأكد من حذف "${deleteTargetNode?.title || ''}"؟ (سيتم حذف أي بورد فرعي تابع له أيضاً)`,
                `Are you sure you want to delete "${deleteTargetNode?.title || ''}"? (Any nested sub-board under it will also be removed)`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>{label('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {label('تأكيد الحذف', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
