import { Mail, MoreHorizontal, Pencil, Settings, Shield, Trash2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LevelBadge } from '@/components/ui/level-badge';
import type { UserWithDetails } from '@/hooks/useUsers';
import type { UserRole } from '@/types';

interface UserCardsGridProps {
  users: UserWithDetails[];
  primaryRole: UserRole;
  isRTL: boolean;
  language: string;
  getRoleText: (role: string) => string;
  getRoleBadgeClass: (role: string) => string;
  getLastSeen: (lastSeen: string | null | undefined) => { text: string; dot: string };
  onEdit: (user: UserWithDetails) => void;
  onView: (user: UserWithDetails) => void;
  onCustomize: (user: UserWithDetails) => void;
  onMessage: (user: UserWithDetails) => void;
  onToggleActive: (user: UserWithDetails) => void;
  onDelete: (user: UserWithDetails) => void;
}

const canEdit = (role: UserRole) => ['admin', 'head_hr', 'branch_admin'].includes(role);
const canCustomize = (role: UserRole) => ['admin', 'branch_admin'].includes(role);

export function UserCardsGrid({ users, primaryRole, isRTL, language, getRoleText, getRoleBadgeClass, getLastSeen, onEdit, onView, onCustomize, onMessage, onToggleActive, onDelete }: UserCardsGridProps) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{users.map((user) => { const lastSeen = getLastSeen(user.last_seen_at); const displayName = (isRTL ? user.full_name_ar : user.full_name) || user.full_name || 'No name'; return <Card key={user.id} className={`overflow-hidden transition-all hover:shadow-md ${!user.is_active ? 'opacity-70 grayscale-[0.5]' : ''}`}><div className="p-4 sm:p-5"><div className="flex justify-between items-start mb-4"><div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1"><div className="relative shrink-0"><Avatar className="h-12 w-12 sm:h-14 sm:w-14 border shadow-sm"><AvatarImage src={user.avatar_url || undefined} alt={displayName} /><AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">{displayName.split(' ').map((name) => name[0]).join('').toUpperCase() || 'U'}</AvatarFallback></Avatar><span className={`absolute bottom-0 right-0 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full border-2 border-background ${lastSeen.dot}`} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 mb-1"><h3 className="font-bold text-base sm:text-lg truncate">{displayName}</h3>{!user.is_active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 shrink-0">{isRTL ? 'معطّل' : 'Inactive'}</span>}</div><p className="text-xs sm:text-sm text-muted-foreground truncate" dir="ltr">{user.email}</p><div className="flex flex-wrap items-center gap-1.5 mt-2"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${getRoleBadgeClass(user.role)}`}>{user.role === 'admin' && <Shield className="h-3 w-3 ltr:mr-1 rtl:ml-1" />}{getRoleText(user.role)}</span><LevelBadge level={user.level} size="sm" /></div></div></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 -mr-2 rtl:-ml-2 mt-1"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{isRTL ? 'الإجراءات' : 'Actions'}</DropdownMenuLabel><DropdownMenuSeparator />{canEdit(primaryRole) && <DropdownMenuItem onClick={() => onEdit(user)}><Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'تعديل' : 'Edit'}</DropdownMenuItem>}<DropdownMenuItem onClick={() => onView(user)}><User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'عرض الملف' : 'View Profile'}</DropdownMenuItem>{canCustomize(primaryRole) && <DropdownMenuItem onClick={() => onCustomize(user)}><Settings className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'تخصيص المميزات' : 'Customize Features'}</DropdownMenuItem>}<DropdownMenuItem onClick={() => onMessage(user)}><Mail className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'واتساب' : 'WhatsApp'}</DropdownMenuItem>{canEdit(primaryRole) && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => onToggleActive(user)} className={user.is_active ? 'text-orange-600' : 'text-emerald-600'}>{user.is_active ? (isRTL ? 'تعطيل المتطوع' : 'Deactivate') : (isRTL ? 'تفعيل المتطوع' : 'Activate')}</DropdownMenuItem></>}{canCustomize(primaryRole) && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => onDelete(user)}><Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'حذف' : 'Delete'}</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div><div className="bg-muted/30 rounded-xl p-3 space-y-2 text-sm border border-border/50"><div className="flex justify-between items-center py-1"><span className="text-muted-foreground text-xs font-medium">{isRTL ? 'اللجنة' : 'Committee'}</span><span className="font-semibold text-xs text-foreground bg-background px-2 py-1 rounded-md border shadow-sm">{user.committee_name || '—'}</span></div><div className="flex justify-between items-center py-1"><span className="text-muted-foreground text-xs font-medium">{isRTL ? 'عدد المشاركات' : 'Participations'}</span><span className="font-semibold text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">{user.participation_count || 0}</span></div><div className="flex justify-between items-center py-1"><span className="text-muted-foreground text-xs font-medium">{isRTL ? 'آخر ظهور' : 'Last Seen'}</span><span className="font-medium text-xs">{lastSeen.text}</span></div>{user.phone && <div className="flex justify-between items-center py-1 border-t border-border/50 pt-2 mt-1"><span className="text-muted-foreground text-xs font-medium">{isRTL ? 'الهاتف' : 'Phone'}</span><span className="font-medium text-xs font-mono" dir="ltr">{user.phone}</span></div>}</div></div></Card>; })}</div>;
}
