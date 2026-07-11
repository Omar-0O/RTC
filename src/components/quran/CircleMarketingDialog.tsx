import { Check, Loader2, Megaphone, Plus, Search, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CircleAd, QuranCircle, Volunteer } from '@/services/circles.service';

interface Marketer {
  id?: string;
  volunteer_id?: string;
  name?: string;
  phone?: string;
}

interface CircleMarketingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circle: QuranCircle | null;
  circleName: string;
  marketers: Marketer[];
  volunteers: Volunteer[];
  ads: CircleAd[];
  loading: boolean;
  isRTL: boolean;
  onAddMarketer: (volunteer: Volunteer) => void;
  onRemoveMarketer: (marketerId: string) => void;
  onAddAd: () => void;
  onUpdateAd: (adId: string, update: Partial<Pick<CircleAd, 'ad_date' | 'poster_done' | 'content_done'>>) => void;
  onDeleteAd: (adId: string) => void;
}

export function CircleMarketingDialog({
  open,
  onOpenChange,
  circle,
  circleName,
  marketers,
  volunteers,
  ads,
  loading,
  isRTL,
  onAddMarketer,
  onRemoveMarketer,
  onAddAd,
  onUpdateAd,
  onDeleteAd,
}: CircleMarketingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRTL ? 'إدارة التسويق - ' : 'Marketing Management - '}
            {circle && circleName}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? 'متابعة خطة النشر والإعلانات للحلقة' : 'Manage circle publication plan and ads'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          <section className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="w-4 h-4 text-primary" />
              <h3 className="text-base font-semibold">{isRTL ? 'فريق التسويق' : 'Marketing Team'}</h3>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-sm h-10">
                  <Search className="w-4 h-4 ltr:mr-2 rtl:ml-2 shrink-0" />
                  <span className="truncate">{isRTL ? 'إضافة مسوق...' : 'Add marketer...'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-4rem)] sm:w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
                  <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                    <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results found'}</CommandEmpty>
                    <CommandGroup>
                      {volunteers.slice(0, 50).map((volunteer) => (
                        <CommandItem
                          key={volunteer.id}
                          value={`${volunteer.full_name} ${volunteer.full_name_ar || ''}`}
                          onSelect={() => onAddMarketer(volunteer)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={volunteer.avatar_url || undefined} />
                              <AvatarFallback>{(volunteer.full_name[0] || '?').toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span>{isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name}</span>
                              <span className="text-xs text-muted-foreground">{volunteer.phone}</span>
                            </div>
                          </div>
                          {marketers.some((marketer) => marketer.volunteer_id === volunteer.id) && <Check className="w-4 h-4 ml-auto" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead><TableHead>{isRTL ? 'الرقم' : 'Phone'}</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {marketers.map((marketer) => (
                    <TableRow key={marketer.id}>
                      <TableCell>{marketer.name}</TableCell><TableCell>{marketer.phone || '-'}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => marketer.id && onRemoveMarketer(marketer.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {marketers.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">{isRTL ? 'لا يوجد فريق تسويق' : 'No marketing team assigned'}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{isRTL ? 'الإعلانات المخططة' : 'Planned Ads'}</h3>
              <Button size="sm" className="gap-2" onClick={onAddAd}><Plus className="h-4 w-4" />{isRTL ? 'إضافة إعلان' : 'Add Ad'}</Button>
            </div>
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              : ads.length === 0 ? <div className="text-center py-8 border rounded-lg border-dashed text-muted-foreground">{isRTL ? 'لا توجد إعلانات مخططة' : 'No planned ads'}</div>
                : <div className="border rounded-md overflow-x-auto"><Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{isRTL ? 'تاريخ النشر' : 'Date'}</TableHead><TableHead>{isRTL ? 'البوستر' : 'Poster'}</TableHead><TableHead>{isRTL ? 'المحتوى' : 'Content'}</TableHead><TableHead>{isRTL ? 'آخر تحديث' : 'Updated By'}</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>{ads.map((ad) => <TableRow key={ad.id}>
                    <TableCell className="text-center font-bold">{ad.ad_number}</TableCell>
                    <TableCell><Input type="date" value={ad.ad_date || ''} onChange={(event) => onUpdateAd(ad.id, { ad_date: event.target.value })} className="w-[150px]" /></TableCell>
                    <TableCell><Button variant={ad.poster_done ? 'default' : 'outline'} size="sm" className={ad.poster_done ? 'bg-green-600 hover:bg-green-700' : ''} onClick={() => onUpdateAd(ad.id, { poster_done: !ad.poster_done })}>{ad.poster_done ? <><Check className="h-4 w-4 rtl:ml-1 ltr:mr-1" />{isRTL ? 'جاهز' : 'Done'}</> : (isRTL ? 'غير جاهز' : 'Pending')}</Button></TableCell>
                    <TableCell><Button variant={ad.content_done ? 'default' : 'outline'} size="sm" className={ad.content_done ? 'bg-green-600 hover:bg-green-700' : ''} onClick={() => onUpdateAd(ad.id, { content_done: !ad.content_done })}>{ad.content_done ? <><Check className="h-4 w-4 rtl:ml-1 ltr:mr-1" />{isRTL ? 'جاهز' : 'Done'}</> : (isRTL ? 'غير جاهز' : 'Pending')}</Button></TableCell>
                    <TableCell>{ad.updater && <span className="text-xs text-muted-foreground">{isRTL && ad.updater.full_name_ar ? ad.updater.full_name_ar : ad.updater.full_name}</span>}</TableCell>
                    <TableCell><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{isRTL ? 'حذف الإعلان' : 'Delete Ad'}</AlertDialogTitle><AlertDialogDescription>{isRTL ? `هل أنت متأكد من حذف الإعلان رقم ${ad.ad_number}؟` : `Are you sure you want to delete ad #${ad.ad_number}?`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteAd(ad.id)} className="bg-destructive hover:bg-destructive/90">{isRTL ? 'حذف' : 'Delete'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell>
                  </TableRow>)}</TableBody>
                </Table></div>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
