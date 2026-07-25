import { format } from 'date-fns';
import { History, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export function CircleAttendanceSheetTab({
  isRTL,
  beneficiaries,
  sessions,
  attendanceData,
  onToggleAttendance,
  onUpdateType,
  onShowHistory,
  getStats,
}: CircleAttendanceSheetTabProps) {
  const displaySessions = [...sessions].reverse();

  return (
    <TabsContent value="sheet" className="space-y-4 py-0 outline-none">
      <div className="hidden sm:block border rounded-xl overflow-x-auto max-h-[600px] shadow-sm bg-card">
        <Table>
          <TableHeader className="bg-muted/40 sticky top-0 z-20">
            <TableRow>
              <TableHead className="min-w-[180px] whitespace-nowrap sticky ltr:left-0 rtl:right-0 z-30 bg-card border-b border-border shadow-sm">
                {isRTL ? 'الاسم' : 'Name'}
              </TableHead>
              <TableHead className="min-w-[120px] whitespace-nowrap">{isRTL ? 'رقم الهاتف' : 'Phone'}</TableHead>
              {displaySessions.map((session, index) => (
                <TableHead key={session.id} className="text-center min-w-[90px] whitespace-nowrap">
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xs text-primary font-bold">#{index + 1}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {format(new Date(session.session_date), 'd/M')}
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center min-w-[70px] whitespace-nowrap bg-emerald-500/5">{isRTL ? 'حضر' : 'Attended'}</TableHead>
              <TableHead className="text-center min-w-[70px] whitespace-nowrap bg-rose-500/5">{isRTL ? 'غاب' : 'Missed'}</TableHead>
              <TableHead className="text-center min-w-[80px] whitespace-nowrap bg-primary/5">{isRTL ? 'نسبة' : '%'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {beneficiaries.map((beneficiary) => {
              const records = displaySessions.map((session) => attendanceData[session.id]?.find((record) => record.beneficiary_id === beneficiary.id));
              const attended = records.filter(Boolean).length;
              const missed = displaySessions.length - attended;
              const rate = displaySessions.length ? Math.round((attended / displaySessions.length) * 100) : 0;

              return (
                <TableRow key={beneficiary.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium whitespace-nowrap sticky ltr:left-0 rtl:right-0 z-10 bg-card border-b border-border shadow-sm">
                    <div className="text-xs font-semibold text-foreground">{beneficiary.name_ar}</div>
                  </TableCell>
                  <TableCell className="text-xs text-foreground/80 font-mono whitespace-nowrap" dir="ltr">
                    {beneficiary.phone || '-'}
                  </TableCell>
                  {displaySessions.map((session) => {
                    const record = attendanceData[session.id]?.find((item) => item.beneficiary_id === beneficiary.id);
                    const isPresent = !!record;
                    const type = record?.attendance_type || 'memorization';

                    return (
                      <TableCell key={session.id} className="text-center p-1.5">
                        {!isPresent ? (
                          <button
                            onClick={() => onToggleAttendance(session.id, beneficiary.id)}
                            className="h-7 w-7 rounded-lg border border-dashed border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-muted-foreground/50 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-xs flex items-center justify-center mx-auto transition-all"
                            title={isRTL ? 'تسجيل حضور' : 'Mark Present'}
                          >
                            —
                          </button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`h-7 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 mx-auto shadow-sm transition-all hover:scale-105 active:scale-95 ${
                                  type === 'memorization'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>{type === 'memorization' ? (isRTL ? 'حفظ' : 'Mem') : (isRTL ? 'مراجعة' : 'Rev')}</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="min-w-[120px]">
                              <DropdownMenuItem
                                onClick={() => onUpdateType(session.id, beneficiary.id, 'memorization')}
                                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 gap-2"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isRTL ? 'حفظ' : 'Memorization'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onUpdateType(session.id, beneficiary.id, 'revision')}
                                className="text-xs font-semibold text-amber-600 dark:text-amber-400 gap-2"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isRTL ? 'مراجعة' : 'Revision'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onToggleAttendance(session.id, beneficiary.id)}
                                className="text-xs font-semibold text-destructive gap-2 border-t mt-1 pt-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                {isRTL ? 'تسجيل غياب' : 'Mark Absent'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">{attended}</TableCell>
                  <TableCell className="text-center font-bold text-rose-600 dark:text-rose-400 bg-rose-500/5">{missed}</TableCell>
                  <TableCell className="text-center font-bold bg-primary/5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rate >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : rate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'}`}>
                      {rate}%
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {beneficiaries.length === 0 && (
              <TableRow>
                <TableCell colSpan={displaySessions.length + 5} className="text-center py-8 text-muted-foreground">
                  {isRTL ? 'لا يوجد طلاب مسجلين' : 'No students enrolled'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="block sm:hidden space-y-3">
        {beneficiaries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl">
            {isRTL ? 'لا يوجد طلاب مسجلين' : 'No students enrolled'}
          </div>
        ) : (
          beneficiaries.map((beneficiary) => {
            const stats = getStats(beneficiary.id);
            return (
              <Card key={beneficiary.id} className="p-4 border bg-card">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-sm">{beneficiary.name_ar}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono" dir="ltr">{beneficiary.phone || '-'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onShowHistory(beneficiary)} className="text-xs gap-1 h-8">
                    <History className="h-3.5 w-3.5" />
                    {isRTL ? 'سجل الحضور' : 'History'}
                  </Button>
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t text-xs">
                  <div className="flex gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{isRTL ? `حضر: ${stats.attended}` : `Attended: ${stats.attended}`}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">{isRTL ? `غاب: ${stats.missed}` : `Missed: ${stats.missed}`}</span>
                  </div>
                  <Badge variant="secondary">{stats.rate}%</Badge>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </TabsContent>
  );
}
