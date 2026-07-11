import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Calendar, Download, Percent, Plus, Trash2, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import type { Session } from '@/services/circles.service';

interface CircleSessionsTabProps {
  isRTL: boolean;
  sessions: Session[];
  beneficiaryCount: number;
  onExport: () => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  getAttendanceRate: (session: Session) => number | null;
}

export function CircleSessionsTab({ isRTL, sessions, beneficiaryCount, onExport, onCreateSession, onDeleteSession, getAttendanceRate }: CircleSessionsTabProps) {
  return (
    <TabsContent value="sessions" className="space-y-4 py-0 outline-none">
      <div className="flex justify-between items-center bg-card p-3 rounded-xl border"><div><h3 className="font-semibold text-xs sm:text-sm">{isRTL ? 'الجلسات' : 'Sessions'}</h3><p className="text-[10px] sm:text-xs text-muted-foreground">{sessions.length} {isRTL ? 'جلسة' : 'sessions'}</p></div><div className="flex gap-2"><Button onClick={onExport} variant="outline" size="sm" className="h-8 text-xs"><Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'تصدير' : 'Export'}</Button><Button onClick={onCreateSession} size="sm" className="h-8 text-xs"><Plus className="w-4 h-4 ltr:mr-1 rtl:ml-1" />{isRTL ? 'جلسة جديدة' : 'New Session'}</Button></div></div>
      {beneficiaryCount === 0 && <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2"><Users className="h-4 w-4" />{isRTL ? 'يمكنك إضافة مستفيدين جديد من تبويب المستفيدين.' : 'You can add new beneficiaries from the Beneficiaries tab.'}</div>}
      <div className="space-y-2">{sessions.map((session, index) => { const rate = getAttendanceRate(session); const hasAttendance = Boolean(session.attendees_count); return <div key={session.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm ${hasAttendance ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10 hover:bg-green-50 dark:hover:bg-green-950/20' : 'hover:bg-muted/50'}`}><div className="flex items-center gap-3"><div className={`p-2 rounded-full ${hasAttendance ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary/10'}`}><Calendar className={`h-4 w-4 ${hasAttendance ? 'text-green-600 dark:text-green-400' : 'text-primary'}`} /></div><div><div className="flex items-center gap-2"><Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono">#{sessions.length - index}</Badge><p className="font-medium text-xs sm:text-sm">{format(new Date(session.session_date), 'EEEE, d MMMM', { locale: isRTL ? ar : enUS })}</p></div><p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{isRTL ? 'الحضور:' : 'Attendance:'} <span className={hasAttendance ? 'font-bold text-green-600 dark:text-green-400' : ''}>{session.attendees_count || 0}</span> / {beneficiaryCount}</p>{session.organizer_name && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 flex items-center gap-1"><User className="h-3 w-3" />{session.organizer_name}</p>}{session.notes && <div className="flex items-start gap-1 mt-2 text-[10px] sm:text-xs text-muted-foreground bg-muted/50 p-1.5 rounded"><span className="break-words line-clamp-2">{session.notes}</span></div>}</div></div><div className="flex items-center gap-2">{rate !== null && hasAttendance && <Badge variant="secondary" className={`text-xs ${rate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : rate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}><Percent className="h-3 w-3 ltr:mr-0.5 rtl:ml-0.5" />{rate}</Badge>}<Badge variant={hasAttendance ? 'default' : 'outline'} className="text-[10px] sm:text-xs"><Users className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{session.attendees_count || 0}</Badge><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDeleteSession(session.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>; })}{sessions.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><div className="p-3 rounded-full bg-muted/50 mb-3"><Calendar className="h-8 w-8 opacity-30" /></div><p className="font-medium">{isRTL ? 'لا توجد جلسات بعد' : 'No sessions yet'}</p><p className="text-sm mt-1">{isRTL ? 'أنشئ أول جلسة للبدء' : 'Create the first session to get started'}</p></div>}</div>
    </TabsContent>
  );
}
