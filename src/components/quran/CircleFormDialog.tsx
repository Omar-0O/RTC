import { useState } from 'react';
import { Calendar, Check, Clock, Megaphone, Plus, User, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Organizer, QuranCircleMarketer, Teacher, Volunteer } from '@/services/circles.service';

export interface CircleFormData {
  teacher_id: string;
  schedule_days: number[];
  schedule_time: string;
  is_active: boolean;
  description: string;
  target_group: string;
  beneficiary_gender: 'male' | 'female';
}

const DAYS = [
  { value: 6, en: 'Saturday', ar: 'السبت' },
  { value: 0, en: 'Sunday', ar: 'الأحد' },
  { value: 1, en: 'Monday', ar: 'الإثنين' },
  { value: 2, en: 'Tuesday', ar: 'الثلاثاء' },
  { value: 3, en: 'Wednesday', ar: 'الأربعاء' },
  { value: 4, en: 'Thursday', ar: 'الخميس' },
  { value: 5, en: 'Friday', ar: 'الجمعة' },
];

interface CircleFormDialogProps {
  open: boolean;
  isEditMode: boolean;
  isRTL: boolean;
  form: CircleFormData;
  teachers: Teacher[];
  volunteers: Volunteer[];
  organizers: Organizer[];
  marketers: QuranCircleMarketer[];
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: CircleFormData) => void;
  onToggleDay: (day: number) => void;
  onAddOrganizer: (volunteer: Volunteer) => void;
  onRemoveOrganizer: (index: number) => void;
  onAddMarketer: (volunteer: Volunteer) => void;
  onRemoveMarketer: (index: number) => void;
  onSave: () => void;
}

export function CircleFormDialog({
  open, isEditMode, isRTL, form, teachers, volunteers, organizers, marketers,
  onOpenChange, onFormChange, onToggleDay, onAddOrganizer, onRemoveOrganizer,
  onAddMarketer, onRemoveMarketer, onSave,
}: CircleFormDialogProps) {
  const [organizerPickerOpen, setOrganizerPickerOpen] = useState(false);
  const [marketerPickerOpen, setMarketerPickerOpen] = useState(false);
  const update = (patch: Partial<CircleFormData>) => onFormChange({ ...form, ...patch });

  const volunteerPicker = (
    selectedIds: Set<string>,
    onSelect: (volunteer: Volunteer) => void,
    placeholder: string,
  ) => (
    <Command>
      <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
      <CommandList>
        <CommandEmpty>{isRTL ? 'لم يتم العثور على نتائج' : 'No results found'}</CommandEmpty>
        <CommandGroup>
          {volunteers.map((volunteer) => (
            <CommandItem key={volunteer.id} onSelect={() => onSelect(volunteer)} className="flex items-center gap-2 cursor-pointer">
              <Avatar className="h-8 w-8"><AvatarImage src={volunteer.avatar_url || undefined} /><AvatarFallback>{volunteer.full_name.slice(0, 2)}</AvatarFallback></Avatar>
              <div className="flex-1"><p className="font-medium">{isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name}</p><p className="text-xs text-muted-foreground">{volunteer.phone}</p></div>
              {selectedIds.has(volunteer.id) && <Check className="h-4 w-4 text-primary" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />{isRTL ? 'إضافة حلقة' : 'Add Circle'}</Button></DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditMode ? (isRTL ? 'تعديل الحلقة' : 'Edit Circle') : (isRTL ? 'إضافة حلقة جديدة' : 'Add New Circle')}</DialogTitle><DialogDescription>{isRTL ? 'أدخل بيانات الحلقة ومواعيدها' : 'Enter circle details and schedule'}</DialogDescription></DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid gap-2"><Label className="flex items-center gap-2"><User className="h-4 w-4" />{isRTL ? 'المحفظ' : 'Teacher'} <span className="text-destructive">*</span></Label><Select value={form.teacher_id} onValueChange={(teacher_id) => update({ teacher_id })}><SelectTrigger className="h-12"><SelectValue placeholder={isRTL ? 'اختر المحفظ...' : 'Select teacher...'} /></SelectTrigger><SelectContent>{teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{isRTL ? 'اسم الحلقة سيكون "حلقة المحفظ [الاسم]" تلقائياً' : 'Circle name will be auto-generated from teacher name'}</p></div>
          <div className="grid gap-2"><Label>{isRTL ? 'الفئة المستهدفة' : 'Target Group'}</Label><Select value={form.target_group} onValueChange={(target_group) => update({ target_group })}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adults">{isRTL ? 'بالغين' : 'Adults'}</SelectItem><SelectItem value="children">{isRTL ? 'أطفال' : 'Children'}</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label className="flex items-center gap-2"><Users className="h-4 w-4" />{isRTL ? 'نوع المستفيدين' : 'Beneficiary Gender'}</Label><Select value={form.beneficiary_gender} onValueChange={(beneficiary_gender) => update({ beneficiary_gender: beneficiary_gender as CircleFormData['beneficiary_gender'] })}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">{isRTL ? 'رجال' : 'Men'}</SelectItem><SelectItem value="female">{isRTL ? 'نساء' : 'Women'}</SelectItem></SelectContent></Select></div>
          <div className="grid gap-3"><Label className="flex items-center gap-2"><Calendar className="h-4 w-4" />{isRTL ? 'أيام الحلقة' : 'Circle Days'} <span className="text-destructive">*</span></Label><div className="flex flex-wrap gap-2">{DAYS.map((day) => <button type="button" key={day.value} onClick={() => onToggleDay(day.value)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${form.schedule_days.includes(day.value) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-input'}`}><Checkbox checked={form.schedule_days.includes(day.value)} className="pointer-events-none" /><span className="font-medium">{isRTL ? day.ar : day.en}</span></button>)}</div></div>
          <div className="grid gap-2"><Label className="flex items-center gap-2"><Clock className="h-4 w-4" />{isRTL ? 'وقت الحلقة' : 'Circle Time'}</Label><Input type="time" value={form.schedule_time} onChange={(event) => update({ schedule_time: event.target.value })} className="h-12 w-48" /></div>
          <div className="grid gap-2"><Label>{isRTL ? 'وصف الحلقة' : 'Description'}</Label><Textarea value={form.description} onChange={(event) => update({ description: event.target.value })} placeholder={isRTL ? 'اكتب وصفاً للحلقة...' : 'Enter circle description...'} className="min-h-[80px]" /></div>
          <div className="grid gap-3"><Label className="flex items-center gap-2"><Users className="h-4 w-4" />{isRTL ? 'المنظمين' : 'Organizers'}</Label><Popover open={organizerPickerOpen} onOpenChange={setOrganizerPickerOpen}><PopoverTrigger asChild><Button variant="outline" className="h-12 justify-start gap-2"><Plus className="h-4 w-4" />{isRTL ? 'إضافة منظم' : 'Add Organizer'}</Button></PopoverTrigger><PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-80 p-0" align="start">{volunteerPicker(new Set(organizers.flatMap((organizer) => organizer.volunteer_id ? [organizer.volunteer_id] : [])), (volunteer) => { onAddOrganizer(volunteer); setOrganizerPickerOpen(false); }, '')}</PopoverContent></Popover>{organizers.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{organizers.map((organizer, index) => <Badge key={organizer.volunteer_id || index} variant="secondary" className="px-3 py-2 gap-2"><span>{organizer.name}</span><button type="button" onClick={() => onRemoveOrganizer(index)} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>)}</div>}</div>
          <div className="grid gap-3"><Label className="flex items-center gap-2"><Megaphone className="h-4 w-4" />{isRTL ? 'فريق التسويق' : 'Marketing Team'}</Label><Popover open={marketerPickerOpen} onOpenChange={setMarketerPickerOpen}><PopoverTrigger asChild><Button variant="outline" className="h-12 justify-start gap-2"><Plus className="h-4 w-4" />{isRTL ? 'إضافة مسوق' : 'Add Marketer'}</Button></PopoverTrigger><PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-80 p-0" align="start">{volunteerPicker(new Set(marketers.flatMap((marketer) => marketer.volunteer_id ? [marketer.volunteer_id] : [])), (volunteer) => { onAddMarketer(volunteer); setMarketerPickerOpen(false); }, '')}</PopoverContent></Popover>{marketers.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{marketers.map((marketer, index) => <Badge key={marketer.volunteer_id || index} variant="secondary" className="px-3 py-2 gap-2"><span>{marketer.name}</span><button type="button" onClick={() => onRemoveMarketer(index)} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>)}</div>}</div>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"><div><Label>{isRTL ? 'الحلقة نشطة' : 'Circle Active'}</Label><p className="text-xs text-muted-foreground">{isRTL ? 'إيقاف الحلقة مؤقتاً بدون حذفها' : 'Temporarily disable without deleting'}</p></div><Switch checked={form.is_active} onCheckedChange={(is_active) => update({ is_active })} /></div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button><Button onClick={onSave} className="px-6">{isRTL ? 'حفظ' : 'Save'}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
