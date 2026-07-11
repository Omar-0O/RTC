import { format } from 'date-fns';
import { Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Organizer } from '@/services/circles.service';

interface CircleSessionDialogProps {
  open: boolean;
  date: string;
  notes: string;
  organizerId: string;
  organizers: Organizer[];
  isRTL: boolean;
  onOpenChange: (open: boolean) => void;
  onDateChange: (date: string) => void;
  onNotesChange: (notes: string) => void;
  onOrganizerChange: (organizerId: string) => void;
  onCreate: () => void;
}

const getLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function CircleSessionDialog({
  open, date, notes, organizerId, organizers, isRTL, onOpenChange,
  onDateChange, onNotesChange, onOrganizerChange, onCreate,
}: CircleSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isRTL ? 'جلسة جديدة' : 'New Session'}</DialogTitle><DialogDescription>{isRTL ? 'إنشاء جلسة جديدة للحلقة' : 'Create a new session for this circle'}</DialogDescription></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2 flex flex-col">
            <label className="text-sm font-medium">{isRTL ? 'التاريخ' : 'Date'}</label>
            <Popover>
              <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-between text-start font-normal h-10"><span>{date ? format(getLocalDate(date), 'yyyy/MM/dd') : (isRTL ? 'اختر التاريخ' : 'Pick a date')}</span><Calendar className="h-4 w-4 text-muted-foreground shrink-0" /></Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={date ? getLocalDate(date) : undefined} onSelect={(selectedDate) => selectedDate && onDateChange(format(selectedDate, 'yyyy-MM-dd'))} disabled={(selectedDate) => selectedDate > new Date()} initialFocus /></PopoverContent>
            </Popover>
          </div>
          {organizers.length > 0 && <div className="space-y-2"><label className="text-sm font-medium flex items-center gap-1"><User className="h-4 w-4" />{isRTL ? 'المحفظ القائم على الجلسة' : 'Session Supervisor'}</label><Select value={organizerId} onValueChange={onOrganizerChange}><SelectTrigger><SelectValue placeholder={isRTL ? 'اختر المحفظ...' : 'Select supervisor...'} /></SelectTrigger><SelectContent><SelectItem value="none">{isRTL ? 'غير محدد' : 'Not specified'}</SelectItem>{organizers.map((organizer, index) => <SelectItem key={organizer.volunteer_id || index} value={organizer.volunteer_id || `idx-${index}`}>{organizer.name}</SelectItem>)}</SelectContent></Select></div>}
          <div className="space-y-2"><label className="text-sm font-medium">{isRTL ? 'ملاحظات' : 'Notes'}</label><Textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder={isRTL ? 'ملاحظات اختيارية...' : 'Optional notes...'} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button><Button onClick={onCreate}>{isRTL ? 'إنشاء وتسجيل الحضور' : 'Create & Record Attendance'}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
