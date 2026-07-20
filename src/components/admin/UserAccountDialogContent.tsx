import type { ReactNode } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar as CalendarIcon, Eye, EyeOff, Pencil, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { Committee } from '@/hooks/useUsers';
import type { Branch } from '@/contexts/BranchContext';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

export interface UserAccountForm {
  name: string; nameAr: string; email: string; phone: string; password: string; role: UserRole; level: string;
  committeeId: string; branchId: string; attendedMiniCamp: boolean; attendedCamp: boolean; isAshbal: boolean; joinDate: string; birthDate: string;
}

interface UserAccountDialogContentProps {
  mode: 'add' | 'edit'; isRTL: boolean; primaryRole: UserRole; canViewAllBranches: boolean; form: UserAccountForm;
  committees: Committee[]; branches: Branch[]; avatarPreview: string | null; avatarInput: ReactNode; cropPanel: ReactNode;
  submitting: boolean; showPassword: boolean; onFormChange: (patch: Partial<UserAccountForm>) => void; onShowPasswordChange: (show: boolean) => void;
  onSubmit: (event: React.FormEvent) => void; onCancel: () => void;
}

const canManageRoles = (role: UserRole) => ['admin', 'head_hr', 'branch_admin'].includes(role);
const canManageLevel = (role: UserRole) => ['admin', 'head_hr', 'supervisor', 'branch_admin'].includes(role);

interface UserDatePickerProps {
  label: string;
  value: string;
  isRTL: boolean;
  onChange: (value: string) => void;
}

function UserDatePicker({ label, value, isRTL, onChange }: UserDatePickerProps) {
  const parsedValue = value ? parseISO(value) : undefined;
  const selectedDate = parsedValue && isValid(parsedValue) ? parsedValue : undefined;
  const currentYear = new Date().getFullYear();

  return (
    <div className="grid gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn('w-full justify-start text-start font-normal', !selectedDate && 'text-muted-foreground')}
          >
            <CalendarIcon className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
            {selectedDate
              ? format(selectedDate, 'PPP', { locale: isRTL ? ar : undefined })
              : isRTL ? 'اختر التاريخ' : 'Pick a date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
            disabled={(date) => date > new Date()}
            initialFocus
            captionLayout="dropdown-buttons"
            fromYear={1900}
            toYear={currentYear}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function UserAccountDialogContent({ mode, isRTL, primaryRole, canViewAllBranches, form, committees, branches, avatarPreview, avatarInput, cropPanel, submitting, showPassword, onFormChange, onShowPasswordChange, onSubmit, onCancel }: UserAccountDialogContentProps) {
  const add = mode === 'add';
  const label = (ar: string, en: string) => isRTL ? ar : en;
  const roleLabel = (role: UserRole) => {
    const labels: Record<UserRole, [string, string]> = {
      volunteer: ['متطوع', 'Volunteer'],
      committee_leader: ['هيد اللجنة', 'Committee Head'],
      supervisor: ['هيد الفرع', 'Head of Branch'],
      admin: ['مسؤول', 'Admin'],
      executive: ['تنفيذي', 'Executive'],
      branch_admin: ['مسؤول الفرع', 'Branch Admin'],
      hr: ['الموارد البشرية', 'HR'],
      head_hr: ['هيد الموارد البشرية', 'Head HR'],
      head_caravans: ['هيد لجنة القوافل', 'Head of Caravans'],
      head_events: ['هيد لجنة الفعاليات', 'Head of Events'],
      head_production: ['هيد لجان الإنتاج', 'Production Head'],
      head_fourth_year: ['هيد لجان سنة رابعة', 'Fourth Year Head'],
      head_ethics: ['هيد نشر الأخلاقيات', 'Ethics Publishing Head'],
      head_quran: ['هيد لجنة القرآن', 'Head of Quran Committee'],
      head_marketing: ['هيد لجنة التسويق', 'Head of Marketing Committee'],
      head_ashbal: ['هيد لجنة الأشبال', 'Head of Ashbal Committee'],
      marketing_member: ['عضو لجنة التسويق', 'Marketing Team Member'],
    };

    return label(...labels[role]);
  };
  return <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl" dir={isRTL ? 'rtl' : 'ltr'}><DialogHeader className="px-4 sm:px-6 py-5 border-b-2 border-border/50 shrink-0 bg-muted/30 flex flex-col items-center text-center"><DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">{add ? <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> : <Pencil className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />}{add ? label('إضافة مستخدم', 'Add User') : label('تعديل المستخدم', 'Edit User')}</DialogTitle><DialogDescription>{add ? label('أدخل تفاصيل الحساب لإنشاء متطوع جديد', 'Enter account details to create a new volunteer') : label('تعديل بيانات الحساب للمتطوع', 'Update volunteer account information')}</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"><div className="grid gap-4 py-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="grid gap-2"><Label>{label('الاسم بالإنجليزي', 'Full Name (English)')} *</Label><Input value={form.name} onChange={(event) => onFormChange({ name: event.target.value })} required /></div><div className="grid gap-2"><Label>{label('الاسم بالعربي', 'Full Name (Arabic)')}{add && ' *'}</Label><Input value={form.nameAr} onChange={(event) => onFormChange({ nameAr: event.target.value })} required={add} dir="rtl" /></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="grid gap-2"><Label>{label('البريد الإلكتروني', 'Email')} *</Label><Input type="email" value={form.email} onChange={(event) => onFormChange({ email: event.target.value })} required /></div><div className="grid gap-2"><Label>{label('رقم الهاتف', 'Phone Number')}</Label><Input type="tel" value={form.phone} onChange={(event) => onFormChange({ phone: event.target.value })} /></div></div><div className="grid gap-2"><Label>{label('كلمة المرور', 'Password')}{add ? ' *' : ` (${label('اختياري', 'Optional')})`}</Label><div className="relative"><Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => onFormChange({ password: event.target.value })} required={add} minLength={6} autoComplete="new-password" className="ltr:pr-10 rtl:pl-10" /><button type="button" onClick={() => onShowPasswordChange(!showPassword)} className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{!add && <p className="text-xs text-muted-foreground">{label('أدخل كلمة مرور جديدة فقط إذا كنت تريد تغييرها', 'Enter a new password only if you want to change it')}</p>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="grid gap-2"><Label>{label('الدور', 'Role')}</Label><Select value={form.role} onValueChange={(role) => onFormChange({ role: role as UserRole })} disabled={!canManageRoles(primaryRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['volunteer','committee_leader','supervisor','branch_admin','hr','head_hr','head_caravans','head_events','head_ethics','head_quran','head_marketing','head_ashbal','head_production','head_fourth_year','marketing_member'] as UserRole[]).map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>{label('الدرجة', 'Level')}</Label><Select value={form.level} onValueChange={(level) => onFormChange({ level })} disabled={!canManageLevel(primaryRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="under_follow_up">{label('تحت المتابعة', 'Under Follow Up')}</SelectItem><SelectItem value="project_responsible">{label('مسؤول مشروع', 'Project Responsible')}</SelectItem><SelectItem value="responsible">{label('مسؤول', 'Responsible')}</SelectItem></SelectContent></Select></div></div><div className="grid gap-2"><Label>{label('اللجنة', 'Committee')}</Label><Select value={form.committeeId || 'none'} onValueChange={(committeeId) => onFormChange({ committeeId: committeeId === 'none' ? '' : committeeId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{label('بدون لجنة', 'No Committee')}</SelectItem>{committees.map((committee) => <SelectItem key={committee.id} value={committee.id}>{isRTL ? committee.name_ar : committee.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>{label('الفرع', 'Branch')}</Label><Select value={form.branchId || 'none'} onValueChange={(branchId) => onFormChange({ branchId: branchId === 'none' ? '' : branchId })} disabled={!canViewAllBranches}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{isRTL ? branch.name_ar : branch.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>{label('الصورة الشخصية', 'Profile Picture')}</Label><div className="flex items-center gap-4"><Avatar className="h-16 w-16"><AvatarImage src={avatarPreview || undefined} /><AvatarFallback>{form.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback></Avatar><div className="flex-1">{avatarInput}<p className="text-xs text-muted-foreground mt-1">{label('الحد الأقصى 5 ميجابايت', 'Max size 5MB')}</p></div></div>{cropPanel}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><UserDatePicker label={label('تاريخ الانضمام', 'Join Date')} value={form.joinDate} isRTL={isRTL} onChange={(joinDate) => onFormChange({ joinDate })} /><UserDatePicker label={label('تاريخ الميلاد', 'Date of Birth')} value={form.birthDate} isRTL={isRTL} onChange={(birthDate) => onFormChange({ birthDate })} /></div><div className="flex items-center justify-between rounded-lg border p-3"><Label>{label('من الأشبال؟', 'Is Ashbal?')}</Label><Switch checked={form.isAshbal} onCheckedChange={(isAshbal) => onFormChange({ isAshbal })} /></div>{form.level === 'under_follow_up' && <div className="flex items-center justify-between rounded-lg border p-3"><Label>{label('حضور الميني كامب', 'Mini Camp Attendance')}</Label><Switch checked={form.attendedMiniCamp} onCheckedChange={(attendedMiniCamp) => onFormChange({ attendedMiniCamp })} /></div>}{form.level === 'project_responsible' && <div className="flex items-center justify-between rounded-lg border p-3"><Label>{label('حضور الكامب', 'Camp Attendance')}</Label><Switch checked={form.attendedCamp} onCheckedChange={(attendedCamp) => onFormChange({ attendedCamp })} /></div>}</div><div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t-2 border-border/50 bg-muted/10 shrink-0"><Button type="button" variant="outline" onClick={onCancel}>{label('إلغاء', 'Cancel')}</Button><Button type="submit" disabled={submitting}>{submitting ? label('جاري الحفظ...', 'Saving...') : add ? label('إضافة', 'Add') : label('حفظ', 'Save')}</Button></div></form></DialogContent>;
}
