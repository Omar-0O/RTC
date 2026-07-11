import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Committee } from '@/hooks/useUsers';

interface UserFiltersProps {
  isRTL: boolean;
  search: string;
  level: string;
  committeeId: string;
  committees: Committee[];
  onSearchChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onCommitteeChange: (value: string) => void;
}

export function UserFilters({ isRTL, search, level, committeeId, committees, onSearchChange, onLevelChange, onCommitteeChange }: UserFiltersProps) {
  return <Card><CardHeader><CardTitle>{isRTL ? 'الفلاتر' : 'Filters'}</CardTitle></CardHeader><CardContent><div className="flex flex-col gap-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" /><Input placeholder={isRTL ? 'بحث بالاسم أو البريد' : 'Search by name or email'} value={search} onChange={(event) => onSearchChange(event.target.value)} className="ltr:pl-9 rtl:pr-9" /></div><Select value={level} onValueChange={onLevelChange}><SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{isRTL ? 'كل الدرجات' : 'All Levels'}</SelectItem><SelectItem value="under_follow_up">{isRTL ? 'تحت المتابعة' : 'Under Follow Up'}</SelectItem><SelectItem value="project_responsible">{isRTL ? 'مسؤول مشروع' : 'Project Responsible'}</SelectItem><SelectItem value="responsible">{isRTL ? 'مسؤول' : 'Responsible'}</SelectItem></SelectContent></Select><Select value={committeeId} onValueChange={onCommitteeChange}><SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder={isRTL ? 'حسب اللجنة' : 'Filter by committee'} /></SelectTrigger><SelectContent><SelectItem value="all">{isRTL ? 'كل اللجان' : 'All Committees'}</SelectItem>{committees.map((committee) => <SelectItem key={committee.id} value={committee.id}>{isRTL ? committee.name_ar : committee.name}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>;
}
