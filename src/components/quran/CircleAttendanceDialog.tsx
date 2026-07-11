import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Check, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Attendance, Beneficiary, Session } from '@/services/circles.service';

interface CircleAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
  beneficiaries: Beneficiary[];
  attendance: Attendance[];
  search: string;
  isRTL: boolean;
  onSearchChange: (value: string) => void;
  onToggleBeneficiary: (beneficiaryId: string) => void;
  onUpdateAttendanceType: (beneficiaryId: string, type: Attendance['attendance_type']) => void;
  onMarkAll: () => void;
  onClearAll: () => void;
  onSave: () => void;
}

export function CircleAttendanceDialog({
  open,
  onOpenChange,
  session,
  beneficiaries,
  attendance,
  search,
  isRTL,
  onSearchChange,
  onToggleBeneficiary,
  onUpdateAttendanceType,
  onMarkAll,
  onClearAll,
  onSave,
}: CircleAttendanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isRTL ? 'تسجيل الحضور' : 'Record Attendance'}
            {session && (
              <Badge variant="outline" className="ml-2">
                {format(new Date(session.session_date), 'd MMM', { locale: isRTL ? ar : enUS })}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? 'حدد الحاضرين لهذه الجلسة' : 'Select attendees for this session'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onMarkAll}>
              <Check className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {isRTL ? 'تحديد الكل' : 'Mark All'}
            </Button>
            <Button variant="outline" size="sm" onClick={onClearAll}>
              <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {isRTL ? 'إلغاء الكل' : 'Clear All'}
            </Button>
          </div>

          <Input
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />

          <ScrollArea className="h-[300px] border rounded-md p-2">
            <div className="space-y-1">
              {beneficiaries.map((beneficiary) => {
                const record = attendance.find((item) => item.beneficiary_id === beneficiary.id);
                const isPresent = Boolean(record);

                return (
                  <div
                    key={beneficiary.id}
                    className={`flex items-center justify-between p-2 rounded-md ${isPresent
                      ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                      : 'hover:bg-muted'
                      }`}
                  >
                    <button
                      type="button"
                      className="flex items-center gap-2 flex-1 text-start"
                      onClick={() => onToggleBeneficiary(beneficiary.id)}
                    >
                      <Checkbox checked={isPresent} />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={beneficiary.image_url || undefined} />
                        <AvatarFallback>{beneficiary.name_ar.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{beneficiary.name_ar}</span>
                    </button>

                    {record && (
                      <div className="flex items-center gap-1 bg-background rounded-md border p-0.5">
                        <button
                          type="button"
                          onClick={() => onUpdateAttendanceType(beneficiary.id, 'memorization')}
                          className={`px-2 py-1 text-xs rounded-sm transition-all ${record.attendance_type === 'memorization'
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                            }`}
                        >
                          {isRTL ? 'حفظ' : 'Mem'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateAttendanceType(beneficiary.id, 'revision')}
                          className={`px-2 py-1 text-xs rounded-sm transition-all ${record.attendance_type === 'revision'
                            ? 'bg-amber-500 text-white'
                            : 'hover:bg-muted'
                            }`}
                        >
                          {isRTL ? 'مراجعة' : 'Rev'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span>{isRTL ? 'الحضور:' : 'Present:'}</span>
              <div className="flex items-center gap-2">
                <Badge className="text-lg px-3">{attendance.length}</Badge>
                <span className="text-muted-foreground text-sm">/ {beneficiaries.length}</span>
              </div>
            </div>
            {beneficiaries.length > 0 && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(attendance.length / beneficiaries.length) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={onSave}>{isRTL ? 'حفظ الحضور' : 'Save Attendance'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
