import { Pencil, Plus, Search, UserMinus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TabsContent } from '@/components/ui/tabs';
import type { Beneficiary } from '@/services/circles.service';

export interface BeneficiaryFormData {
  name_ar: string;
  name_en: string;
  phone: string;
  gender: 'male' | 'female';
  beneficiary_type: 'adult' | 'child';
}

interface StudentStats { attended: number; missed: number; rate: number; }

interface CircleBeneficiariesTabProps {
  isRTL: boolean;
  beneficiaries: Beneficiary[];
  sessionsCount: number;
  search: string;
  adding: boolean;
  form: BeneficiaryFormData;
  onSearchChange: (value: string) => void;
  onAddingChange: (adding: boolean) => void;
  onFormChange: (form: BeneficiaryFormData) => void;
  onAdd: () => void;
  onEdit: (beneficiary: Beneficiary) => void;
  onUnenroll: (beneficiary: Beneficiary) => void;
  getStats: (beneficiaryId: string) => StudentStats;
}

const rateClass = (rate: number) => rate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : rate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

export function CircleBeneficiariesTab({
  isRTL, beneficiaries, sessionsCount, search, adding, form, onSearchChange, onAddingChange,
  onFormChange, onAdd, onEdit, onUnenroll, getStats,
}: CircleBeneficiariesTabProps) {
  const updateForm = (patch: Partial<BeneficiaryFormData>) => onFormChange({ ...form, ...patch });
  const emptyMessage = isRTL ? 'لا يوجد مستفيدين مطابقين للبحث' : 'No matching beneficiaries found';

  return (
    <TabsContent value="beneficiaries" className="space-y-4 py-0 outline-none">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1"><Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={isRTL ? 'بحث باسم الطالب أو الهاتف...' : 'Search student by name or phone...'} value={search} onChange={(event) => onSearchChange(event.target.value)} className="rtl:pr-9 ltr:pl-9 h-9" /></div>
        <Button onClick={() => onAddingChange(!adding)} size="sm" className="gap-1.5 h-9 shrink-0"><Plus className="h-4 w-4" />{isRTL ? 'إضافة مستفيد' : 'Add Beneficiary'}</Button>
      </div>

      {adding && <Card className="border border-primary/20 bg-primary/5 dark:bg-primary/10"><CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-semibold">{isRTL ? 'بيانات المستفيد الجديد' : 'New Beneficiary Details'}</CardTitle></CardHeader><CardContent className="p-4 pt-0 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"><div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground">{isRTL ? 'الاسم (بالعربية) *' : 'Name (Arabic) *'}</label><Input value={form.name_ar} onChange={(event) => updateForm({ name_ar: event.target.value })} className="h-9 bg-background" /></div><div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground">{isRTL ? 'رقم الهاتف' : 'Phone Number'}</label><Input value={form.phone} onChange={(event) => updateForm({ phone: event.target.value })} className="h-9 bg-background" /></div><div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground">{isRTL ? 'الجنس' : 'Gender'}</label><Select value={form.gender} onValueChange={(gender) => updateForm({ gender: gender as BeneficiaryFormData['gender'] })}><SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">{isRTL ? 'ذكر' : 'Male'}</SelectItem><SelectItem value="female">{isRTL ? 'أنثى' : 'Female'}</SelectItem></SelectContent></Select></div><div className="space-y-1"><label className="text-[10px] font-medium text-muted-foreground">{isRTL ? 'الفئة العمرية' : 'Age Group'}</label><Select value={form.beneficiary_type} onValueChange={(beneficiary_type) => updateForm({ beneficiary_type: beneficiary_type as BeneficiaryFormData['beneficiary_type'] })}><SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adult">{isRTL ? 'بالغ' : 'Adult'}</SelectItem><SelectItem value="child">{isRTL ? 'طفل' : 'Child'}</SelectItem></SelectContent></Select></div></div><div className="flex justify-end gap-2 pt-2"><Button size="sm" variant="ghost" onClick={() => onAddingChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button><Button size="sm" onClick={onAdd}>{isRTL ? 'إضافة الطالب' : 'Add Student'}</Button></div></CardContent></Card>}

      <div className="hidden sm:block border rounded-xl overflow-hidden bg-card"><Table><TableHeader><TableRow><TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead><TableHead>{isRTL ? 'رقم الهاتف' : 'Phone'}</TableHead><TableHead>{isRTL ? 'النوع' : 'Gender'}</TableHead><TableHead>{isRTL ? 'الفئة' : 'Type'}</TableHead><TableHead className="text-center">{isRTL ? 'نسبة الحضور' : 'Attendance Rate'}</TableHead><TableHead /></TableRow></TableHeader><TableBody>{beneficiaries.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{emptyMessage}</TableCell></TableRow> : beneficiaries.map((beneficiary) => { const stats = getStats(beneficiary.id); return <TableRow key={beneficiary.id}><TableCell className="font-medium"><div className="font-semibold">{beneficiary.name_ar}</div>{beneficiary.name_en && <div className="text-xs text-muted-foreground">{beneficiary.name_en}</div>}</TableCell><TableCell>{beneficiary.phone || '-'}</TableCell><TableCell><span className={beneficiary.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}>{beneficiary.gender === 'male' ? (isRTL ? 'ذكر' : 'Male') : (isRTL ? 'أنثى' : 'Female')}</span></TableCell><TableCell><Badge variant="outline">{beneficiary.beneficiary_type === 'adult' ? (isRTL ? 'بالغ' : 'Adult') : (isRTL ? 'طفل' : 'Child')}</Badge></TableCell><TableCell className="text-center"><Badge variant="secondary" className={`font-semibold ${rateClass(stats.rate)}`}>{stats.rate}% ({stats.attended}/{sessionsCount})</Badge></TableCell><TableCell><div className="flex gap-1 justify-end"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(beneficiary)}><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onUnenroll(beneficiary)}><UserMinus className="w-4 h-4" /></Button></div></TableCell></TableRow>; })}</TableBody></Table></div>

      <div className="block sm:hidden space-y-3">{beneficiaries.length === 0 ? <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl">{emptyMessage}</div> : beneficiaries.map((beneficiary) => { const stats = getStats(beneficiary.id); return <Card key={beneficiary.id} className="p-4 border bg-card"><div className="flex justify-between items-start"><div><h4 className="font-semibold text-sm">{beneficiary.name_ar}</h4><p className="text-xs text-muted-foreground mt-0.5">{beneficiary.phone || (isRTL ? 'لا يوجد هاتف' : 'No phone')}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(beneficiary)}><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onUnenroll(beneficiary)}><UserMinus className="w-4 h-4" /></Button></div></div><div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t text-xs"><span className={beneficiary.gender === 'male' ? 'px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700' : 'px-2 py-0.5 rounded text-[10px] bg-pink-50 text-pink-700'}>{beneficiary.gender === 'male' ? (isRTL ? 'ذكر' : 'Male') : (isRTL ? 'أنثى' : 'Female')}</span><span className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{beneficiary.beneficiary_type === 'adult' ? (isRTL ? 'بالغ' : 'Adult') : (isRTL ? 'طفل' : 'Child')}</span><Badge variant="secondary" className={`text-[10px] ltr:ml-auto rtl:mr-auto ${rateClass(stats.rate)}`}>{isRTL ? 'الحضور: ' : 'Attended: '}{stats.rate}%</Badge></div></Card>; })}</div>
      <div className="text-xs text-muted-foreground pt-1">{isRTL ? `إجمالي المستفيدين: ${beneficiaries.length}` : `Total beneficiaries: ${beneficiaries.length}`}</div>
    </TabsContent>
  );
}
