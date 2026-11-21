import { memo, useRef, useState } from 'react';
import type React from 'react';
import { Check, Layers, Pencil, Sparkles, Trash2, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import type { SectionMemberThumb, StructureColor, StructureNode } from '@/utils/activityStructureTree';
import { getInitials, getVolunteerName } from '@/utils/activityStructureTree';
import { STRUCTURE_COLOR_TOKENS } from './structureColors';

export type NodeHighlight = 'selected' | 'chain' | 'dimmed' | 'none';

interface StructureNodeCardProps {
  node: StructureNode;
  subBoardCount?: number;
  sectionMembers?: SectionMemberThumb[];
  isRTL: boolean;
  editable: boolean;
  highlight: NodeHighlight;
  isDragging?: boolean;
  isMultiSelected?: boolean;
  isConnectionTarget?: boolean;
  isPinnedHead?: boolean;
  onOpenSectionBoard?: (id: string) => void;
  onHoverChange?: (id: string | null) => void;
  onSelect?: (id: string, event?: React.MouseEvent) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStartDrag?: (id: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onStartConnect?: (id: string, event: React.PointerEvent<HTMLButtonElement>, kind?: 'hierarchy' | 'deputy') => void;
}

interface PersonHoverCardProps {
  name: string | null;
  roleTitle: string;
  avatarUrl: string | null;
  responsibilities: string[];
  color: StructureColor;
  isRTL: boolean;
  children: React.ReactNode;
}

function PersonHoverCard({
  name,
  roleTitle,
  avatarUrl,
  responsibilities,
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
        className="pointer-events-none z-[100] w-[460px] max-w-[92vw] overflow-hidden rounded-2xl border bg-popover p-0 shadow-2xl"
        dir="ltr"
      >
        <div className={cn('h-1.5 w-full', tokens.bar)} />
        <div className="relative flex min-h-[240px]">
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

          {/* Right Side: Name, Role & Job Description */}
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-4 p-5"
          >
            <div className="space-y-3.5">
              <div className="border-b border-border/60 pb-2.5">
                <p className="line-clamp-2 text-lg font-bold leading-snug text-foreground">
                  {name ?? label('منصب شاغر', 'Vacant position')}
                </p>
                <p className="mt-0.5 text-sm font-medium text-muted-foreground">{roleTitle}</p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label('الوصف الوظيفي', 'Job description')}
                </p>
                {responsibilities.length > 0 ? (
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto text-[13px]">
                    {responsibilities.map((item, index) => (
                      <li key={`${index}-${item}`} className="flex gap-2">
                        <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', tokens.bar)} />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] italic text-muted-foreground">
                    {label('لم تُحدد مسئوليات بعد', 'No responsibilities defined yet')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

const INNER_RING_CAPACITY = 11;
const OUTER_RING_CAPACITY = 16;

function computeRingAngles(count: number, maxSpan: number, fixedStep: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [-90];
  const span = Math.min(maxSpan, (count - 1) * fixedStep);
  const step = span / (count - 1);
  const start = -90 - span / 2;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function SectionMemberOrbit({ members }: { members: SectionMemberThumb[] }): React.ReactElement | null {
  if (members.length === 0) return null;

  const innerCount = Math.min(members.length, INNER_RING_CAPACITY);
  const innerMembers = members.slice(0, innerCount);
  const innerAngles = computeRingAngles(innerCount, 244, 34);

  const remaining = members.slice(INNER_RING_CAPACITY);
  const hasOverflow = remaining.length > OUTER_RING_CAPACITY;
  const outerDisplayCount = hasOverflow ? OUTER_RING_CAPACITY - 1 : remaining.length;
  const outerMembers = remaining.slice(0, outerDisplayCount);
  const outerSlotsTotal = outerDisplayCount + (hasOverflow ? 1 : 0);
  const outerAngles = computeRingAngles(outerSlotsTotal, 256, 22);
  const overflowCount = remaining.length - outerDisplayCount;

  const renderBubble = (member: SectionMemberThumb, radius: number, angleDeg: number, sizeClass: string) => {
    const rad = (angleDeg * Math.PI) / 180;
    const x = Math.round(radius * Math.cos(rad));
    const y = Math.round(radius * Math.sin(rad));
    const tokens = STRUCTURE_COLOR_TOKENS[member.color];

    return (
      <div
        key={member.id}
        title={member.name ?? undefined}
        style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
        className={cn(
          'pointer-events-auto absolute left-0 top-0 rounded-full bg-background ring-2 ring-white/95 shadow-md transition-transform duration-200 hover:z-30 hover:scale-125 dark:ring-zinc-900',
          sizeClass
        )}
      >
        <Avatar className="h-full w-full">
          <AvatarImage
            src={member.avatarUrl ?? undefined}
            alt={member.name ?? ''}
            draggable={false}
            className="pointer-events-none select-none object-cover"
          />
          <AvatarFallback className={cn('text-[9px] font-bold', tokens.chip)}>
            {member.name ? getInitials(member.name) : <UserRound className="h-3 w-3" />}
          </AvatarFallback>
        </Avatar>
      </div>
    );
  };

  return (
    <div className="pointer-events-none absolute left-1/2 top-[44px] z-10 h-0 w-0" aria-hidden="true">
      {innerMembers.map((member, idx) => renderBubble(member, 58, innerAngles[idx], 'h-6 w-6'))}
      {outerMembers.map((member, idx) => renderBubble(member, 82, outerAngles[idx], 'h-5 w-5'))}
      {hasOverflow &&
        (() => {
          const angleDeg = outerAngles[outerAngles.length - 1];
          const rad = (angleDeg * Math.PI) / 180;
          const x = Math.round(82 * Math.cos(rad));
          const y = Math.round(82 * Math.sin(rad));
          return (
            <div
              title={`+${overflowCount}`}
              style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
              className="pointer-events-auto absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-white/95 shadow-md dark:ring-zinc-900"
            >
              +{overflowCount}
            </div>
          );
        })()}
    </div>
  );
}

function StructureNodeCardComponent({
  node,
  subBoardCount = 0,
  sectionMembers = [],
  isRTL,
  editable,
  highlight,
  isDragging = false,
  isMultiSelected = false,
  isConnectionTarget = false,
  isPinnedHead = false,
  onOpenSectionBoard,
  onHoverChange,
  onSelect,
  onEdit,
  onDelete,
  onStartDrag,
  onStartConnect,
}: StructureNodeCardProps): React.ReactElement {
  const tokens = STRUCTURE_COLOR_TOKENS[node.color];
  const name = getVolunteerName(node, isRTL);
  const isJoker = node.node_type === 'joker';
  const hasOwnSectionIndicator = Boolean(
    !isPinnedHead &&
      (node.section_title?.trim() || node.team_image_url || node.description?.trim() || subBoardCount > 0)
  );
  const label = (ar: string, en: string): string => (isRTL ? ar : en);
  const lastTapRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  const hasSection = Boolean(
    !isPinnedHead &&
      (node.section_title?.trim() ||
        node.team_image_url ||
        node.description?.trim() ||
        subBoardCount > 0 ||
        sectionMembers.length > 0 ||
        (node.squad_volunteer_ids?.length ?? 0) > 0)
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
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') {
          touchStartRef.current = { x: e.clientX, y: e.clientY };
        }
        if (editable && onStartDrag && !isPinnedHead && e.button === 0) {
          onStartDrag(node.id, e);
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== 'touch' || !touchStartRef.current) return;
        const dx = Math.abs(e.clientX - touchStartRef.current.x);
        const dy = Math.abs(e.clientY - touchStartRef.current.y);
        touchStartRef.current = null;
        if (dx > 8 || dy > 8) return;
        const now = Date.now();
        if (now - lastTapRef.current < 320) {
          lastTapRef.current = 0;
          if (hasSection && onOpenSectionBoard) {
            onOpenSectionBoard(node.id);
          }
          return;
        }
        lastTapRef.current = now;
        if (!editable) {
          setMobileDetailsOpen(true);
        }
      }}
      onMouseEnter={() => onHoverChange?.(node.id)}
      onMouseLeave={() => onHoverChange?.(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(node.id, e);
      }}
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
        'group relative flex w-44 select-none touch-none flex-col items-center gap-2 p-1.5 text-center',
        'animate-in fade-in-0 zoom-in-95 duration-300 transition-all ease-out',
        editable && !isPinnedHead
          ? 'cursor-grab active:cursor-grabbing'
          : hasSection
            ? 'cursor-pointer'
            : 'cursor-default',
        isDragging && 'z-30 scale-105 opacity-95',
        isMultiSelected && 'rounded-2xl bg-primary/8 ring-2 ring-primary/65 shadow-sm',
        highlight === 'dimmed' && 'opacity-40 scale-[0.97]',
        isConnectionTarget && 'scale-105'
      )}
    >
      {isMultiSelected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -start-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
        >
          <Check className="h-3 w-3" />
        </span>
      )}
      {/* Main Volunteer + Orbiting Section Member Thumbnails */}
      <div className="relative flex flex-col items-center">
          {!isPinnedHead && sectionMembers.length > 0 && <SectionMemberOrbit members={sectionMembers} />}
          <PersonHoverCard
            name={name}
            roleTitle={node.title}
            avatarUrl={node.volunteer_avatar}
            responsibilities={node.responsibilities}
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
              {hasOwnSectionIndicator && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-[5px] rounded-full border-[1.5px] border-dashed border-primary/45 transition-all duration-300 group-hover/person:scale-105 group-hover/person:border-primary/80"
                />
              )}
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
                <>
                  {/* Bottom handle: normal hierarchy/reporting link */}
                  <button
                    type="button"
                    title={label('اسحب للتوصيل تحت الهيد', 'Drag to connect under lead')}
                    aria-label={label('اسحب للتوصيل تحت الهيد', 'Drag to connect under lead')}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onStartConnect(node.id, e, 'hierarchy');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'absolute -bottom-2 left-1/2 z-30 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-background shadow-md md:-bottom-1.5 md:h-4 md:w-4',
                      'opacity-100 transition-all duration-200 hover:scale-125 cursor-crosshair md:opacity-0 md:group-hover:opacity-100',
                      tokens.bar
                    )}
                  />
                  {/* Side handles (left & right): link a Deputy side-by-side */}
                  <button
                    type="button"
                    title={label('اسحب من هنا لتوصيل نائب', 'Drag from side to link a deputy')}
                    aria-label={label('اسحب من هنا لتوصيل نائب', 'Drag from side to link a deputy')}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onStartConnect(node.id, e, 'deputy');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -left-2.5 top-1/2 z-30 h-5 w-5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-background bg-amber-500 opacity-100 shadow-md transition-all duration-200 hover:scale-125 md:-left-2 md:h-4 md:w-4 md:opacity-0 md:group-hover:opacity-100"
                  />
                  <button
                    type="button"
                    title={label('اسحب من هنا لتوصيل نائب', 'Drag from side to link a deputy')}
                    aria-label={label('اسحب من هنا لتوصيل نائب', 'Drag from side to link a deputy')}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onStartConnect(node.id, e, 'deputy');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -right-2.5 top-1/2 z-30 h-5 w-5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-background bg-amber-500 opacity-100 shadow-md transition-all duration-200 hover:scale-125 md:-right-2 md:h-4 md:w-4 md:opacity-0 md:group-hover:opacity-100"
                  />
                </>
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
              <p className="inline-flex max-w-full items-center justify-center gap-1 text-xs font-medium leading-snug text-muted-foreground">
                {hasOwnSectionIndicator && <Layers className="h-3 w-3 shrink-0 text-primary/70" aria-hidden="true" />}
                <span className="line-clamp-2 min-w-0">{node.title}</span>
              </p>
              {isJoker && (
                <div className="pt-0.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    <Sparkles className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    {label('جوكر', 'Joker')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </PersonHoverCard>
      </div>

      {/* Floating Edit / Delete actions on hover (always visible on mobile/touch) */}
      {editable && !isPinnedHead && (
        <div className="absolute -end-1 -top-1 z-20 flex gap-1 opacity-100 transition-all duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 rounded-full shadow-md backdrop-blur-md transition-transform hover:scale-110 md:h-6 md:w-6"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={stop(onEdit)}
            aria-label={label('تعديل', 'Edit')}
            title={label('تعديل المتطوع والسكشن', 'Edit volunteer & section')}
          >
            <Pencil className="h-3.5 w-3.5 md:h-3 md:w-3" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 rounded-full text-destructive shadow-md backdrop-blur-md transition-transform hover:scale-110 md:h-6 md:w-6"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={stop(onDelete)}
            aria-label={label('حذف', 'Delete')}
          >
            <Trash2 className="h-3.5 w-3.5 md:h-3 md:w-3" />
          </Button>
        </div>
      )}

      {/* Mobile Tap Details Dialog */}
      <Dialog open={mobileDetailsOpen} onOpenChange={setMobileDetailsOpen}>
        <DialogContent className="w-[92vw] max-w-sm rounded-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader className="flex flex-row items-center gap-3 text-start">
            <Avatar className="h-14 w-14 shrink-0 border shadow-sm">
              <AvatarImage src={node.volunteer_avatar ?? undefined} className="object-cover" />
              <AvatarFallback className={cn('text-base font-bold', tokens.chip)}>
                {name ? getInitials(name) : <UserRound className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <DialogTitle className="text-base font-bold">{name ?? label('منصب شاغر', 'Vacant position')}</DialogTitle>
                {isJoker && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    <Sparkles className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    {label('جوكر', 'Joker')}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground">{node.title}</p>
            </div>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                {label('الوصف الوظيفي', 'Job description')}
              </p>
              {node.responsibilities.length > 0 ? (
                <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
                  {node.responsibilities.map((item, idx) => (
                    <li key={`${idx}-${item}`} className="flex gap-2">
                      <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', tokens.bar)} />
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
            {hasSection && onOpenSectionBoard && (
              <Button
                type="button"
                className="w-full gap-2"
                onClick={() => {
                  setMobileDetailsOpen(false);
                  onOpenSectionBoard(node.id);
                }}
              >
                <Layers className="h-4 w-4" />
                {label('فتح فريق / سكشن المتطوع', 'Open volunteer team / section')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const StructureNodeCard = memo(StructureNodeCardComponent);
