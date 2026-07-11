import { format } from 'date-fns';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TabsContent } from '@/components/ui/tabs';
import type { Attendance, Beneficiary, Session } from '@/services/circles.service';

interface StudentStats { attended: number; missed: number; rate: number; }

interface CircleAttendanceSheetTabProps {
  isRTL: boolean;
  beneficiaries: Beneficiary[];
  sessions: Session[];
  attendanceData: Record<string, Attendance[]>;
  onToggleAttendance: (sessionId: string, beneficiaryId: string) => void;
  onUpdateType: (sessionId: string, beneficiaryId: string, type: Attendance['attendance_type']) => void;
  onShowHistory: (beneficiary: Beneficiary) => void;
  getStats: (beneficiaryId: string) => StudentStats;
}

export function CircleAttendanceSheetTab({ isRTL, beneficiaries, sessions, attendanceData, onToggleAttendance, onUpdateType, onShowHistory, getStats }: CircleAttendanceSheetTabProps) {
  return (
    <TabsContent value="sheet" className="space-y-4 py-0 outline-none">
      <div className="hidden sm:block border rounded-xl overflow-x-auto max-h-[600px] bg-card"><Table><TableHeader><TableRow><TableHead className="min-w-[200px] sticky left-0 z-10 bg-background">{isRTL ? 'الاسم' : 'Name'}</TableHead><TableHead className="min-w-[120px]">{isRTL ? 'رقم الهاتف' : 'Phone'}</TableHead>{sessions.map((session, index) => <TableHead key={session.id} className="text-center min-w-[80px]"><div className="flex flex-col items-center"><span>{index + 1}</span><span className="text-[10px] font-normal text-muted-foreground">{format(new Date(session.session_date), 'd/M')}</span></div></TableHead>)}<TableHead className="text-center">{isRTL ? 'حضر' : 'Attended'}</TableHead><TableHead className="text-center">{isRTL ? 'غاب' : 'Missed'}</TableHead><TableHead className="text-center">{isRTL ? 'نسبة' : '%'}</TableHead></TableRow></TableHeader><TableBody>{beneficiaries.map((beneficiary) => { const records = sessions.map((session) => attendanceData[session.id]?.find((record) => record.beneficiary_id === beneficiary.id)); const attended = records.filter(Boolean).length; const missed = sessions.length - attended; const rate = sessions.length ? Math.round((attended / sessions.length) * 100) : 0; return <TableRow key={beneficiary.id}><TableCell className="font-medium sticky left-0 z-10 bg-background">{beneficiary.name_ar}</TableCell><TableCell className="text-sm text-muted-foreground">{beneficiary.phone || '-'}</TableCell>{sessions.map((session) => { const record = attendanceData[session.id]?.find((item) => item.beneficiary_id === beneficiary.id); return <TableCell key={session.id} className="text-center p-2"><div className="flex flex-col items-center gap-1"><Checkbox checked={Boolean(record)} onCheckedChange={() => onToggleAttendance(session.id, beneficiary.id)} />{record && <select className="text-[10px] border rounded bg-transparent p-0.5 w-[50px] text-center" value={record.attendance_type} onChange={(event) => onUpdateType(session.id, beneficiary.id, event.target.value as Attendance['attendance_type'])}><option value="memorization">{isRTL ? 'حفظ' : 'Mem'}</option><option value="revision">{isRTL ? 'مراجعة' : 'Rev'}</option></select>}</div></TableCell>; })}<TableCell className="text-center font-bold text-green-600">{attended}</TableCell><TableCell className="text-center font-bold text-red-600">{missed}</TableCell><TableCell className="text-center font-bold"><span className={rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}>{rate}%</span></TableCell></TableRow>; })}{beneficiaries.length === 0 && <TableRow><TableCell colSpan={sessions.length + 5} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا يوجد طلاب مسجلين' : 'No students enrolled'}</TableCell></TableRow>}</TableBody></Table></div>
      <div className="block sm:hidden space-y-3">{beneficiaries.length === 0 ? <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl">{isRTL ? 'لا يوجد طلاب مسجلين' : 'No students enrolled'}</div> : beneficiaries.map((beneficiary) => { const stats = getStats(beneficiary.id); return <Card key={beneficiary.id} className="p-4 border bg-card"><div className="flex justify-between items-center"><div><h4 className="font-semibold text-sm">{beneficiary.name_ar}</h4><p className="text-xs text-muted-foreground mt-0.5">{beneficiary.phone || '-'}</p></div><Button size="sm" variant="outline" onClick={() => onShowHistory(beneficiary)} className="text-xs gap-1 h-8"><History className="h-3.5 w-3.5" />{isRTL ? 'سجل الحضور' : 'History'}</Button></div><div className="flex justify-between items-center mt-3 pt-3 border-t text-xs"><div className="flex gap-2"><span className="text-green-600 font-semibold">{isRTL ? `حضر: ${stats.attended}` : `Attended: ${stats.attended}`}</span><span className="text-red-600 font-semibold">{isRTL ? `غاب: ${stats.missed}` : `Missed: ${stats.missed}`}</span></div><Badge variant="secondary">{stats.rate}%</Badge></div></Card>; })}</div>
    </TabsContent>
  );
}
