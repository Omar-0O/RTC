import { memo } from 'react';
import type React from 'react';
import { Pencil, Trash2, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import type { StructureColor, StructureNode } from '@/utils/activityStructureTree';
import { getCommitteeName, getDeputyName, getInitials, getVolunteerName } from '@/utils/activityStructureTree';
import { STRUCTURE_COLOR_TOKENS } from './structureColors';

export type NodeHighlight = 'selected' | 'chain' | 'dimmed' | 'none';

interface StructureNodeCardProps {
  node: StructureNode;
  managerName: string | null;
  directReports: number;
  subBoardCount?: number;
  isRTL: boolean;
  editable: boolean;
  highlight: NodeHighlight;
  isDragging?: boolean;
  isConnectionTarget?: boolean;
  isPinnedHead?: boolean;
  onOpenSectionBoard?: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStartDrag?: (id: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onStartConnect?: (id: string, event: React.PointerEvent<HTMLButtonElement>) => void;
}

interface PersonHoverCardProps {
  name: string | null;
  roleTitle: string;
  avatarUrl: string | null;
  committee: string | null;
  responsibilities: string[];
  managerName: string | null;
  directReports: number;
  color: StructureColor;
  isRTL: boolean;
  children: React.ReactNode;
}

function PersonHoverCard({
  name,
  roleTitle,
  avatarUrl,
  committee,
  responsibilities,
  managerName,
  directReports,
  color,
  isRTL,
  children,
}: PersonHoverCardProps): React.ReactElement {
  const tokens = STRUCTURE_COLOR_TOKENS[color];
  const label = (ar: string, en: string): string => (isRTL ? ar : en);

  return (
    <HoverCard openDelay={220} closeDelay={40}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={isRTL ? 'left' : 'right'}
        align="start"
        sideOffset={12}
        collisionPadding={16}
        className="pointer-events-none z-[100] w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border bg-popover p-0 shadow-2xl"
        dir="ltr"
      >
        <div className={cn('h-1.5 w-full', tokens.bar)} />
        <div className="relative flex min-h-[220px]">
          {/* Left Side: Full-Height Sharp Photo with subtle edge blur & fade only on the right seam */}
          <div className="relative w-[44%] shrink-0 overflow-hidden bg-muted/40">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name ?? roleTitle} className="h-full w-full object-cover object-top" />
            ) : (
              <div className={cn('flex h-full w-full items-center justify-center', tokens.chip)}>
                <span className="text-4xl font-bold opacity-80">
                  {name ? getInitials(name) : <UserRound className="h-12 w-12" />}
                </span>
              </div>
            )}

            {/* Subtle progressive blur ONLY on the right edge (last ~30%) */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-12 backdrop-blur-sm"
              style={{
                maskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
              }}
            />
            {/* Smooth fade into popover background ONLY on the right edge */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-popover via-popover/55 to-transparent" />
          </div>

          {/* Right Side: Name, Role, Job Description & Reporting Info */}
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            className="relative z-10 flex min-w-0 flex-1 flex-col justify-between gap-3 p-4"
          >
            <div className="space-y-2.5">
              <div>
                <p className="truncate text-sm font-bold text-foreground">{name ?? label('منصب شاغر', 'Vacant position')}</p>
                <p className="text-xs font-medium text-muted-foreground">{roleTitle}</p>
                {committee && (
                  <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', tokens.chip)}>
                    {committee}
                  </span>
                )}
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label('الوصف الوظيفي', 'Job description')}
                </p>
                {responsibilities.length > 0 ? (
                  <ul className="max-h-28 space-y-1 overflow-y-auto text-xs">
                    {responsibilities.map((item, index) => (
                      <li key={`${index}-${item}`} className="flex gap-1.5">
                        <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', tokens.bar)} />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs italic text-muted-foreground">
                    {label('لم تُحدد مسئوليات بعد', 'No responsibilities defined yet')}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-0.5 border-t pt-2 text-[11px] text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{label('مسئول من: ', 'Reports to: ')}</span>
                {managerName ?? label('أعلى الهيكل', 'Top of structure')}
              </p>
              <p>
                <span className="font-medium text-foreground">{label('المسئول عنهم: ', 'Direct reports: ')}</span>
                {directReports}
              </p>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function StructureNodeCardComponent({
  node,
  managerName,
  directReports,
  subBoardCount = 0,
  isRTL,
  editable,
  highlight,
  isDragging = false,
  isConnectionTarget = false,
  isPinnedHead = false,
  onOpenSectionBoard,
  onEdit,
  onDelete,
  onStartDrag,
  onStartConnect,
}: StructureNodeCardProps): React.ReactElement {
  const tokens = STRUCTURE_COLOR_TOKENS[node.color];
  const name = getVolunteerName(node, isRTL);
  const deputyName = getDeputyName(node, isRTL);
  const committee = getCommitteeName(node, isRTL);
  const label = (ar: string, en: string): string => (isRTL ? ar : en);

  const hasDeputy = Boolean(node.deputy_id);
  const hasSection = Boolean(
    !isPinnedHead && (node.section_title?.trim() || node.team_image_url || node.description?.trim() || subBoardCount > 0)
  );

  const stop = (fn: (id: string) => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn(node.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-node-id={node.id}
      dir={isRTL ? 'rtl' : 'ltr'}
      onPointerDown={
        editable && onStartDrag && !isPinnedHead
          ? (e) => {
              if (e.button !== 0) return;
              onStartDrag(node.id, e);
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (hasSection && onOpenSectionBoard) onOpenSectionBoard(node.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (hasSection && onOpenSectionBoard) onOpenSectionBoard(node.id);
        }
      }}
      className={cn(
        'group relative flex select-none touch-none flex-col items-center gap-2 p-1.5 text-center',
        hasDeputy ? 'w-auto' : 'w-44',
        'animate-in fade-in-0 zoom-in-95 duration-300 transition-all ease-out',
        editable && !isPinnedHead
          ? 'cursor-grab active:cursor-grabbing'
          : hasSection
            ? 'cursor-pointer'
            : 'cursor-default',
        isDragging && 'z-30 scale-105 opacity-95',
        highlight === 'dimmed' && 'opacity-30 scale-95',
        isConnectionTarget && 'scale-105'
      )}
    >
      {/* Main Volunteer + Optional Deputy Side-by-Side (each with independent HoverCard) */}
      <div className="flex items-start justify-center gap-3">
        {/* Primary Volunteer */}
        <PersonHoverCard
          name={name}
          roleTitle={node.title}
          avatarUrl={node.volunteer_avatar}
          committee={committee}
          responsibilities={node.responsibilities}
          managerName={managerName}
          directReports={directReports}
          color={node.color}
          isRTL={isRTL}
        >
          <div className="group/person flex w-36 flex-col items-center gap-2">
            <div className="relative">
              <div
                className={cn(
                  'pointer-events-none absolute -inset-2 rounded-full blur-xl opacity-25 transition-all duration-500',
                  'group-hover/person:opacity-55 group-hover/person:scale-110',
                  tokens.bar
                )}
              />
              <div className="relative rounded-full bg-white/60 p-1 shadow-[0_14px_34px_-8px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all duration-300 group-hover/person:shadow-[0_20px_42px_-8px_rgba(0,0,0,0.28)] dark:bg-zinc-900/60">
                <Avatar
                  className={cn(
                    'h-20 w-20 ring-2 ring-white/90 transition-all duration-300 dark:ring-zinc-800',
                    'group-hover/person:scale-105',
                    tokens.ring,
                    highlight === 'selected' && 'ring-4 ring-primary scale-105',
                    highlight === 'chain' && 'ring-3 ring-primary/50',
                    isConnectionTarget && 'ring-4 ring-primary ring-offset-2 ring-offset-background'
                  )}
                >
                  <AvatarImage
                    src={node.volunteer_avatar ?? undefined}
                    alt={name ?? node.title}
                    draggable={false}
                    className="pointer-events-none select-none object-cover"
                  />
                  <AvatarFallback className={cn('text-xl font-bold', tokens.chip)}>
                    {name ? getInitials(name) : <UserRound className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
              </div>

              {editable && onStartConnect && (
                <button
                  type="button"
                  title={label('اسحب للتوصيل', 'Drag to connect')}
                  aria-label={label('اسحب للتوصيل', 'Drag to connect')}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onStartConnect(node.id, e);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'absolute -bottom-1.5 left-1/2 z-20 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background shadow-md',
                    'opacity-0 transition-all duration-200 group-hover:opacity-100 hover:scale-125 cursor-crosshair',
                    tokens.bar
                  )}
                />
              )}
            </div>

            <div className="w-full min-w-0 space-y-0.5">
              <p
                className={cn(
                  'truncate text-sm font-bold tracking-tight text-foreground drop-shadow-sm',
                  !name && 'italic text-muted-foreground'
                )}
              >
                {name ?? label('منصب شاغر', 'Vacant')}
              </p>
              <p className="line-clamp-2 text-xs font-medium leading-snug text-muted-foreground">{node.title}</p>
            </div>
          </div>
        </PersonHoverCard>

        {/* Deputy Side-by-Side (standalone HoverCard as their own head/person) */}
        {hasDeputy && (
          <>
            <div className="mt-10 h-0.5 w-5 shrink-0 border-t-2 border-dashed border-primary/40" />
            <PersonHoverCard
              name={deputyName}
              roleTitle={node.deputy_title?.trim() || label('نائب', 'Deputy')}
              avatarUrl={node.deputy_avatar ?? null}
              committee={committee}
              responsibilities={node.responsibilities}
              managerName={name ?? node.title}
              directReports={directReports}
              color={node.color}
              isRTL={isRTL}
            >
              <div className="group/deputy flex w-32 flex-col items-center gap-1.5 pt-2">
                <div className="relative">
                  <div
                    className={cn(
                      'pointer-events-none absolute -inset-1.5 rounded-full blur-lg opacity-20 transition-all duration-500',
                      'group-hover/deputy:opacity-50',
                      tokens.bar
                    )}
                  />
                  <div className="relative rounded-full bg-white/60 p-1 shadow-[0_10px_26px_-6px_rgba(0,0,0,0.2)] backdrop-blur-md dark:bg-zinc-900/60">
                    <Avatar className="h-16 w-16 ring-2 ring-white/90 transition-transform duration-300 group-hover/deputy:scale-105 dark:ring-zinc-800">
                      <AvatarImage
                        src={node.deputy_avatar ?? undefined}
                        alt={deputyName ?? ''}
                        draggable={false}
                        className="pointer-events-none select-none object-cover"
                      />
                      <AvatarFallback className={cn('text-base font-bold', tokens.chip)}>
                        {deputyName ? getInitials(deputyName) : <UserRound className="h-6 w-6" />}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div className="w-full min-w-0 space-y-0.5">
                  <p className="truncate text-xs font-bold tracking-tight text-foreground">
                    {deputyName ?? label('نائب', 'Deputy')}
                  </p>
                  <p className="line-clamp-2 text-[11px] font-medium leading-snug text-muted-foreground">
                    {node.deputy_title?.trim() || label('نائب', 'Deputy')}
                  </p>
                </div>
              </div>
            </PersonHoverCard>
          </>
        )}
      </div>

      {/* Floating Edit / Delete actions on hover */}
      {editable && !isPinnedHead && (
        <div className="absolute -end-1 -top-1 z-20 flex gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            size="icon"
            variant="secondary"
            className="h-6 w-6 rounded-full shadow-md backdrop-blur-md transition-transform hover:scale-110"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={stop(onEdit)}
            aria-label={label('تعديل', 'Edit')}
            title={label('تعديل المتطوع / النائب / السكشن', 'Edit volunteer / deputy / section')}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-6 w-6 rounded-full text-destructive shadow-md backdrop-blur-md transition-transform hover:scale-110"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={stop(onDelete)}
            aria-label={label('حذف', 'Delete')}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export const StructureNodeCard = memo(StructureNodeCardComponent);
