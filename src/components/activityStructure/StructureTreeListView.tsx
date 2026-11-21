import { useMemo, useState } from 'react';
import type React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  LocateFixed,
  Network,
  Pencil,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  buildFullStructureHierarchy,
  filterLayerHierarchy,
  type LayerHierarchy,
  type LayerTreeEntry,
} from '@/utils/activityStructureBoardHelpers';
import {
  getInitials,
  getVolunteerName,
  type RootBoardMeta,
  type StructureEdge,
  type StructureNode,
} from '@/utils/activityStructureTree';
import { STRUCTURE_COLOR_TOKENS } from './structureColors';

interface StructureTreeListViewProps {
  nodes: StructureNode[];
  edges: StructureEdge[];
  rootMeta: RootBoardMeta | null;
  query: string;
  isRTL: boolean;
  editable: boolean;
  onJumpToNode: (nodeId: string, layerOwnerId: string | null) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddInLayer?: (ownerId: string | null) => void;
}

function collectHierarchyStats(hierarchy: LayerHierarchy): {
  sectionIds: string[];
  sectionCount: number;
  jokerCount: number;
} {
  const sectionIds: string[] = [];
  let sectionCount = 0;
  let jokerCount = 0;

  const walkLayer = (layer: LayerHierarchy) => {
    jokerCount += layer.jokers.length;
    const walkEntry = (entry: LayerTreeEntry) => {
      if (entry.node.node_type === 'joker') jokerCount += 1;
      for (const dep of entry.deputies) {
        if (dep.node_type === 'joker') jokerCount += 1;
      }
      if (entry.subBoard) {
        sectionCount += 1;
        sectionIds.push(entry.node.id);
        walkLayer(entry.subBoard);
      }
      for (const child of entry.children) walkEntry(child);
    };
    for (const root of layer.roots) walkEntry(root);
  };

  walkLayer(hierarchy);
  return { sectionIds, sectionCount, jokerCount };
}

export function StructureTreeListView({
  nodes,
  edges,
  rootMeta,
  query,
  isRTL,
  editable,
  onJumpToNode,
  onEdit,
  onDelete,
  onAddInLayer,
}: StructureTreeListViewProps): React.ReactElement {
  const label = (ar: string, en: string): string => (isRTL ? ar : en);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());

  const fullHierarchy = useMemo(() => buildFullStructureHierarchy(nodes, edges), [nodes, edges]);
  const isSearching = query.trim().length > 0;
  const visibleHierarchy = useMemo(
    () => (isSearching ? filterLayerHierarchy(fullHierarchy, query) : fullHierarchy),
    [fullHierarchy, isSearching, query]
  );

  const stats = useMemo(() => collectHierarchyStats(visibleHierarchy), [visibleHierarchy]);

  const toggleSection = (sectionOwnerId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionOwnerId)) next.delete(sectionOwnerId);
      else next.add(sectionOwnerId);
      return next;
    });
  };

  const renderNodeRow = (
    node: StructureNode,
    options?: { isDeputyChip?: boolean; deputies?: StructureNode[]; extraBadge?: React.ReactNode }
  ) => {
    const tokens = STRUCTURE_COLOR_TOKENS[node.color];
    const name = getVolunteerName(node, isRTL);
    const isJoker = node.node_type === 'joker';
    const squadCount = node.squad_members?.length ?? node.squad_volunteer_ids?.length ?? 0;

    return (
      <div
        className={cn(
          'group/row flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card/90 px-3 py-2.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-card',
          isJoker && 'border-amber-500/35 bg-amber-500/[0.04]',
          options?.isDeputyChip && 'border-amber-500/30 bg-muted/30 py-2'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className={cn('h-10 w-10 shrink-0 ring-2', tokens.ring)}>
            <AvatarImage src={node.volunteer_avatar ?? undefined} alt={name ?? node.title} className="object-cover" />
            <AvatarFallback className={cn('text-xs font-bold', tokens.chip)}>
              {name ? getInitials(name) : <UserRound className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className={cn('truncate text-sm font-bold text-foreground', !name && 'italic text-muted-foreground')}>
                {name ?? label('منصب شاغر', 'Vacant')}
              </p>
              {isJoker && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                  {label('جوكر', 'Joker')}
                </span>
              )}
              {options?.extraBadge}
              {squadCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  title={label('أعضاء الفرقة', 'Squad members')}
                >
                  <Users className="h-2.5 w-2.5" />
                  {squadCount}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{node.title}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onJumpToNode(node.id, node.board_owner_id ?? null)}
            className="h-7 gap-1 px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
            title={label('عرض وموضع الكارت على البورد', 'Locate on board')}
          >
            <LocateFixed className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label('على البورد', 'Locate')}</span>
          </Button>
          {editable && onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEdit(node.id)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label={label('تعديل', 'Edit')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {editable && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete(node.id)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label={label('حذف', 'Delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderJokersGroup = (jokers: StructureNode[], sectionLabel: string) => {
    if (jokers.length === 0) return null;
    return (
      <div className="space-y-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.04] p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{sectionLabel}</span>
          <Badge variant="outline" className="border-amber-500/40 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-300">
            {jokers.length}
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {jokers.map((jk) => (
            <div key={jk.id}>{renderNodeRow(jk)}</div>
          ))}
        </div>
      </div>
    );
  };

  const renderEntry = (entry: LayerTreeEntry): React.ReactNode => {
    const sub = entry.subBoard;
    const isExpanded = isSearching || !collapsedSections.has(entry.node.id);
    const sectionTitle = entry.node.section_title?.trim() || entry.node.title;

    return (
      <div key={entry.node.id} className="space-y-2">
        {renderNodeRow(entry.node, { deputies: entry.deputies })}

        {entry.deputies.length > 0 && (
          <div className="ms-5 space-y-1.5 border-s-2 border-amber-500/40 ps-3.5 sm:ms-7">
            {entry.deputies.map((dep) => (
              <div key={dep.id}>
                {renderNodeRow(dep, {
                  isDeputyChip: true,
                  extraBadge: (
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                    >
                      {label('نائب', 'Deputy')}
                    </Badge>
                  ),
                })}
              </div>
            ))}
          </div>
        )}

        {sub && (
          <div className="ms-4 rounded-xl border border-dashed border-primary/30 bg-muted/20 p-2.5 sm:ms-6 sm:p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => !isSearching && toggleSection(entry.node.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-start"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                ) : isRTL ? (
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate text-xs font-bold text-foreground">{sectionTitle}</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {sub.totalCount}
                </Badge>
              </button>

              {editable && onAddInLayer && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddInLayer(entry.node.id)}
                  className="h-7 gap-1 px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                >
                  <UserPlus className="h-3 w-3" />
                  {label('إضافة متطوع', 'Add Volunteer')}
                </Button>
              )}
            </div>

            {entry.node.description && isExpanded && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{entry.node.description}</p>
            )}

            {isExpanded && (
              <div className="mt-2.5 space-y-2.5">
                {sub.roots.length > 0 && <div className="space-y-2">{sub.roots.map(renderEntry)}</div>}
                {renderJokersGroup(sub.jokers, label('جوكرز السكشن', 'Section Jokers'))}
                {sub.roots.length === 0 && sub.jokers.length === 0 && (
                  <p className="px-1 py-1 text-[11px] italic text-muted-foreground">
                    {label('لا يوجد أعضاء داخل هذا السكشن بعد', 'No members added inside this section yet')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {entry.children.length > 0 && (
          <div className="ms-4 space-y-2 border-s-2 border-primary/20 ps-3.5 sm:ms-6 sm:ps-5">
            {entry.children.map(renderEntry)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="space-y-4 rounded-3xl border border-slate-200/80 bg-muted/15 p-3.5 shadow-inner dark:border-zinc-800/80 sm:p-5"
    >
      {/* Header Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {rootMeta?.title?.trim() && (
            <span className="text-sm font-bold text-foreground">{rootMeta.title.trim()}</span>
          )}
          <Badge variant="secondary" className="gap-1 text-xs">
            <Users className="h-3 w-3" />
            {visibleHierarchy.totalCount} {label('متطوع', 'members')}
          </Badge>
          {stats.sectionCount > 0 && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Layers className="h-3 w-3 text-primary" />
              {stats.sectionCount} {label('سكشن', 'sections')}
            </Badge>
          )}
          {stats.jokerCount > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
            >
              <Sparkles className="h-3 w-3" />
              {stats.jokerCount} {label('جوكر', 'jokers')}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {stats.sectionIds.length > 0 && !isSearching && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setCollapsedSections(new Set())}
              >
                {label('توسيع الكل', 'Expand All')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setCollapsedSections(new Set(stats.sectionIds))}
              >
                {label('طي الكل', 'Collapse All')}
              </Button>
            </>
          )}
          {editable && onAddInLayer && (
            <Button type="button" size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={() => onAddInLayer(null)}>
              <UserPlus className="h-3.5 w-3.5" />
              {label('إضافة متطوع', 'Add Volunteer')}
            </Button>
          )}
        </div>
      </div>

      {visibleHierarchy.totalCount === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Network className="h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">
            {isSearching
              ? label('لا توجد نتائج مطابقة لبحثك في أي طبقة', 'No matching results found across any layer')
              : label('البورد فارغ حالياً', 'The board is empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleHierarchy.roots.length > 0 && (
            <div className="space-y-2.5">{visibleHierarchy.roots.map(renderEntry)}</div>
          )}
          {renderJokersGroup(visibleHierarchy.jokers, label('جوكرز الطبقة الرئيسية', 'Root Layer Jokers'))}
        </div>
      )}
    </div>
  );
}
