import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  AlertCircle,
  Building2,
  GitFork,
  Loader2,
  Lock,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
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
import {
  StructureBoard,
  type StructureBoardDraftControls,
  type StructureBoardEditHandlers,
} from '@/components/activityStructure/StructureBoard';
import { StructureNodeDialog } from '@/components/activityStructure/StructureNodeDialog';
import { RootBoardMetaDialog } from '@/components/activityStructure/RootBoardMetaDialog';
import {
  applyDraftTransform,
  batchMoveDraftNodes,
  computeBoardDraftDiff,
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
  undoDraft,
  updateDraftNode,
  updateDraftRootMeta,
  type BoardSnapshot,
  type DraftHistoryState,
} from '@/utils/activityStructureDraft';
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

  // UI & local draft state
  type PendingExitIntent =
    | { type: 'exitEditMode' }
    | { type: 'switchBranch'; branch: (typeof branches)[number] };

  const [editMode, setEditMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rootMetaOpen, setRootMetaOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<StructureNode | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<DraftHistoryState | null>(null);
  const [pendingExitIntent, setPendingExitIntent] = useState<PendingExitIntent | null>(null);
  const viewportCenterRef = useRef<{ pos_x: number; pos_y: number }>({ pos_x: 320, pos_y: 220 });

  const activeBoard: BoardSnapshot =
    editMode && draftState && draftState.branchId === effectiveBranchId ? draftState.present : board;

  const draftDiff = useMemo(
    () => (draftState ? computeBoardDraftDiff(draftState.base, draftState.present) : null),
    [draftState]
  );

  const hasUnsavedChanges = Boolean(draftDiff && !isDraftDiffEmpty(draftDiff));
  const canUndo = Boolean(draftState && draftState.past.length > 0);
  const canRedo = Boolean(draftState && draftState.future.length > 0);

  const { data: volunteers = [] } = useStructureVolunteers(effectiveBranchId, dialogOpen || editMode);

  // Mutations (committed only when user explicitly clicks Save)
  const { saveDraft } = useActivityStructureMutations(effectiveBranchId);
  const isSaving = saveDraft.isPending;

  const applyDraftChange = useCallback((transform: (snapshot: BoardSnapshot) => BoardSnapshot) => {
    setDraftState((prev) => (prev ? applyDraftTransform(prev, transform) : prev));
  }, []);

  const handleUndo = useCallback(() => {
    setDraftState((prev) => (prev ? undoDraft(prev) : prev));
  }, []);

  const handleRedo = useCallback(() => {
    setDraftState((prev) => (prev ? redoDraft(prev) : prev));
  }, []);

  const handleDiscardChanges = useCallback(() => {
    setDraftState((prev) => (prev ? discardDraft(prev) : prev));
  }, []);

  const handleSaveChanges = useCallback(async (): Promise<boolean> => {
    if (!effectiveBranchId || !draftState || !draftDiff) return false;
    if (isDraftDiffEmpty(draftDiff)) return true;
    try {
      await saveDraft.mutateAsync({ diff: draftDiff, nextSnapshot: draftState.present });
      setDraftState((prev) => (prev ? markDraftSaved(prev) : prev));
      toast.success(label('تم حفظ التعديلات بنجاح', 'Changes saved successfully'));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : label('تعذر حفظ التعديلات', 'Failed to save changes'));
      return false;
    }
  }, [draftDiff, draftState, effectiveBranchId, label, saveDraft]);

  // Reset active sub-board or delete prompt if an Undo/Discard removes the referenced node
  useEffect(() => {
    if (activeBoardOwnerId && !activeBoard.nodes.some((n) => n.id === activeBoardOwnerId)) {
      setActiveBoardOwnerId(null);
    }
  }, [activeBoard.nodes, activeBoardOwnerId]);

  useEffect(() => {
    if (deleteTargetId && !activeBoard.nodes.some((n) => n.id === deleteTargetId)) {
      setDeleteTargetId(null);
    }
  }, [activeBoard.nodes, deleteTargetId]);

  // Warn before closing/reloading tab if draft has unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y / Ctrl+Shift+Z, Ctrl/Cmd+S) in Edit Mode
  useEffect(() => {
    if (!editMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (dialogOpen || rootMetaOpen || Boolean(deleteTargetId) || Boolean(pendingExitIntent)) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      } else if (key === 's') {
        e.preventDefault();
        void handleSaveChanges();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTargetId, dialogOpen, editMode, handleRedo, handleSaveChanges, handleUndo, pendingExitIntent, rootMetaOpen]);

  const editHandlers: StructureBoardEditHandlers | undefined = useMemo(() => {
    if (!canManage || !editMode || !effectiveBranchId) return undefined;

    return {
      onEdit: (id: string) => {
        const found = activeBoard.nodes.find((n) => n.id === id);
        if (found) {
          setEditingNode(found);
          setDialogOpen(true);
        }
      },
      onQuickCreate: (pos: { pos_x: number; pos_y: number }) => {
        viewportCenterRef.current = pos;
        setEditingNode(null);
        setDialogOpen(true);
      },
      onCreateInLayer: (ownerId: string | null) => {
        setActiveBoardOwnerId(ownerId);
        setEditingNode(null);
        setDialogOpen(true);
      },
      onEditRootMeta: () => {
        setRootMetaOpen(true);
      },
      onDelete: (id: string) => {
        setDeleteTargetId(id);
      },
      onMovePosition: (id: string, pos_x: number, pos_y: number) => {
        applyDraftChange((s) => moveDraftNode(s, id, pos_x, pos_y));
      },
      onBatchMovePositions: (updates) => {
        applyDraftChange((s) => batchMoveDraftNodes(s, updates));
      },
      onCreateEdge: (sourceId: string, targetId: string, edgeLabel?: string | null) => {
        applyDraftChange((s) =>
          createDraftEdge(s, {
            id: crypto.randomUUID(),
            branchId: effectiveBranchId,
            sourceId,
            targetId,
            label: edgeLabel,
          })
        );
      },
      onDeleteEdge: (edgeId: string) => {
        applyDraftChange((s) => deleteDraftEdge(s, edgeId));
      },
    };
  }, [activeBoard.nodes, applyDraftChange, canManage, editMode, effectiveBranchId]);

  const draftControls: StructureBoardDraftControls | undefined = useMemo(() => {
    if (!canManage || !editMode) return undefined;
    return {
      canUndo,
      canRedo,
      hasUnsavedChanges,
      isSaving,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onDiscard: handleDiscardChanges,
      onSave: () => {
        void handleSaveChanges();
      },
    };
  }, [
    canManage,
    canRedo,
    canUndo,
    editMode,
    handleDiscardChanges,
    handleRedo,
    handleSaveChanges,
    handleUndo,
    hasUnsavedChanges,
    isSaving,
  ]);

  const handleToggleEditMode = (checked: boolean) => {
    if (checked) {
      if (!effectiveBranchId || boardLoading) return;
      setDraftState(createDraftHistory(effectiveBranchId, board));
      setEditMode(true);
      return;
    }
    if (hasUnsavedChanges) {
      setPendingExitIntent({ type: 'exitEditMode' });
      return;
    }
    setEditMode(false);
    setDraftState(null);
  };

  const executeExitIntent = (intent: PendingExitIntent) => {
    setPendingExitIntent(null);
    setEditMode(false);
    setDraftState(null);
    if (intent.type === 'switchBranch') {
      setActiveBranch(intent.branch);
      setActiveBoardOwnerId(null);
    }
  };

  const handleOpenCreate = () => {
    setEditingNode(null);
    setDialogOpen(true);
  };

  const handleFormSubmit = (input: SaveStructureNodeInput) => {
    if (!effectiveBranchId) return;
    if (editingNode) {
      applyDraftChange((s) => updateDraftNode(s, editingNode.id, input, volunteers));
    } else {
      const { pos_x, pos_y } = viewportCenterRef.current;
      const newId = crypto.randomUUID();
      const autoEdgeId = crypto.randomUUID();
      applyDraftChange((s) =>
        createDraftNode(s, {
          id: newId,
          branchId: effectiveBranchId,
          input: { ...input, board_owner_id: activeBoardOwnerId, pos_x, pos_y },
          sortOrder: nextSortOrder(s.nodes, null),
          volunteers,
          activeBoardOwnerId,
          autoEdgeId,
        })
      );
    }
    setDialogOpen(false);
    setEditingNode(null);
  };

  const handleSaveRootMeta = (meta: { title: string | null; description: string | null; team_image_url: string | null }) => {
    if (!effectiveBranchId) return;
    applyDraftChange((s) => updateDraftRootMeta(s, effectiveBranchId, meta));
    setRootMetaOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    applyDraftChange((s) => deleteDraftNode(s, deleteTargetId));
    if (activeBoardOwnerId === deleteTargetId) {
      setActiveBoardOwnerId(null);
    }
    setDeleteTargetId(null);
  };

  const deleteTargetNode = activeBoard.nodes.find((n) => n.id === deleteTargetId);

  return (
    <div className="space-y-4 p-2.5 sm:space-y-6 sm:p-6 lg:p-8" dir={isRTL ? 'rtl' : 'ltr'}>
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

          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:gap-3">
            {canViewAllBranches && branches.length > 1 && (
              <Select
                value={effectiveBranchId || ''}
                onValueChange={(val) => {
                  const b = branches.find((branch) => branch.id === val);
                  if (!b || b.id === effectiveBranchId) return;
                  if (editMode && hasUnsavedChanges) {
                    setPendingExitIntent({ type: 'switchBranch', branch: b });
                    return;
                  }
                  setEditMode(false);
                  setDraftState(null);
                  setActiveBranch(b);
                  setActiveBoardOwnerId(null);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-[180px]">
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
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5 sm:w-auto sm:gap-2.5 sm:px-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-mode-toggle"
                    checked={editMode}
                    onCheckedChange={handleToggleEditMode}
                    disabled={boardLoading || isSaving}
                  />
                  <label htmlFor="edit-mode-toggle" className="cursor-pointer select-none text-xs font-medium">
                    {label('وضع التعديل', 'Edit Mode')}
                  </label>
                </div>

                {editMode && (
                  <>
                    <Button size="sm" onClick={handleOpenCreate} disabled={isSaving} className="h-8 gap-1.5 font-medium">
                      <UserPlus className="h-3.5 w-3.5" />
                      {label('إضافة متطوع', 'Add Volunteer')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUndo}
                      disabled={!canUndo || isSaving}
                      className="h-8 gap-1.5 px-2.5 text-xs font-medium"
                      title={label('تراجع عن آخر خطوة (Ctrl+Z)', 'Undo last step (Ctrl+Z)')}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      <span>{label('تراجع', 'Undo')}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRedo}
                      disabled={!canRedo || isSaving}
                      className="h-8 gap-1.5 px-2.5 text-xs font-medium"
                      title={label('إعادة الخطوة (Ctrl+Y)', 'Redo step (Ctrl+Y)')}
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                      <span>{label('إعادة', 'Redo')}</span>
                    </Button>
                    {hasUnsavedChanges && (
                      <>
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                        >
                          {label('تعديلات غير محفوظة', 'Unsaved')}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleDiscardChanges}
                          disabled={isSaving}
                          className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-destructive"
                          title={label('تجاهل كل التعديلات غير المحفوظة', 'Discard unsaved changes')}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{label('تجاهل', 'Discard')}</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleSaveChanges()}
                          disabled={isSaving}
                          className="h-8 gap-1.5 bg-emerald-600 font-medium text-white hover:bg-emerald-700"
                        >
                          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          {label('حفظ', 'Save')}
                        </Button>
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
        <CardContent className="p-2.5 sm:p-6">
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
              nodes={activeBoard.nodes}
              edges={activeBoard.edges}
              rootMeta={activeBoard.rootMeta}
              activeBoardOwnerId={activeBoardOwnerId}
              onChangeBoardOwner={setActiveBoardOwnerId}
              isRTL={isRTL}
              editable={Boolean(editHandlers)}
              draftControls={draftControls}
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
        saving={false}
        onSubmit={handleFormSubmit}
      />

      {/* Root Branch Group Photo & Info Dialog */}
      <RootBoardMetaDialog
        open={rootMetaOpen}
        onOpenChange={setRootMetaOpen}
        branchId={effectiveBranchId}
        isRTL={isRTL}
        meta={activeBoard.rootMeta}
        saving={false}
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
                `هل أنت متأكد من حذف "${deleteTargetNode?.title || ''}"؟ (سيتم حذف أي بورد فرعي تابع له أيضاً — ويمكنك التراجع قبل الحفظ)`,
                `Are you sure you want to delete "${deleteTargetNode?.title || ''}"? (Any nested sub-board will also be removed — you can still undo before saving)`
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

      {/* Unsaved Changes Guard Dialog */}
      <AlertDialog
        open={Boolean(pendingExitIntent)}
        onOpenChange={(open) => {
          if (!open && !isSaving) setPendingExitIntent(null);
        }}
      >
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{label('تعديلات غير محفوظة', 'Unsaved Changes')}</AlertDialogTitle>
            <AlertDialogDescription>
              {label(
                'لديك تعديلات على البورد لم يتم حفظها بعد. هل تريد حفظها أم تجاهلها قبل المتابعة؟',
                'You have unsaved changes on the board. Would you like to save or discard them before continuing?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel disabled={isSaving}>
              {label('الاستمرار في التعديل', 'Keep Editing')}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              onClick={() => pendingExitIntent && executeExitIntent(pendingExitIntent)}
            >
              {label('تجاهل التعديلات', 'Discard Changes')}
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={async () => {
                const ok = await handleSaveChanges();
                if (ok && pendingExitIntent) executeExitIntent(pendingExitIntent);
              }}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {label('حفظ التعديلات', 'Save Changes')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
