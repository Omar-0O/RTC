import { useState } from 'react';
import { Trash2, User, UserPlus, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TabsContent } from '@/components/ui/tabs';
import type { Organizer, Volunteer } from '@/services/circles.service';

interface CircleOrganizersTabProps {
  isRTL: boolean;
  organizers: Organizer[];
  volunteers: Volunteer[];
  onAdd: (organizer: Organizer) => void;
  onRemove: (organizer: Organizer) => void;
}

export function CircleOrganizersTab({ isRTL, organizers, volunteers, onAdd, onRemove }: CircleOrganizersTabProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <TabsContent value="organizers" className="space-y-4 py-0 outline-none">
      <div className="flex justify-between items-center bg-card p-3 rounded-xl border"><div><h3 className="font-semibold text-xs sm:text-sm">{isRTL ? 'المنظمين' : 'Organizers'}</h3><p className="text-[10px] sm:text-xs text-muted-foreground">{organizers.length} {isRTL ? 'منظم' : 'organizer'}</p></div><Popover open={pickerOpen} onOpenChange={setPickerOpen}><PopoverTrigger asChild><Button size="sm" className="h-8 text-xs"><UserPlus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'إضافة منظم' : 'Add Organizer'}</Button></PopoverTrigger><PopoverContent className="p-0" align={isRTL ? 'end' : 'start'}><Command><CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} /><CommandList className="max-h-[300px]"><CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results found.'}</CommandEmpty><CommandGroup>{volunteers.map((volunteer) => <CommandItem key={volunteer.id} onSelect={() => { onAdd({ volunteer_id: volunteer.id, name: isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name, phone: volunteer.phone || '' }); setPickerOpen(false); }}><div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={volunteer.avatar_url || undefined} /><AvatarFallback>{volunteer.full_name.charAt(0)}</AvatarFallback></Avatar><div className="flex flex-col"><span>{isRTL && volunteer.full_name_ar ? volunteer.full_name_ar : volunteer.full_name}</span>{volunteer.phone && <span className="text-xs text-muted-foreground">{volunteer.phone}</span>}</div></div></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
      <div className="space-y-2">{organizers.map((organizer, index) => <div key={organizer.volunteer_id || index} className="flex items-center justify-between p-3 rounded-lg border bg-card"><div className="flex items-center gap-3"><div className="p-2 rounded-full bg-primary/10 text-primary"><User className="h-4 w-4" /></div><div><p className="font-medium text-xs sm:text-sm">{organizer.name}</p>{organizer.phone && <p className="text-[10px] sm:text-xs text-muted-foreground">{organizer.phone}</p>}</div></div><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => onRemove(organizer)}><Trash2 className="h-4 w-4" /></Button></div>)}{organizers.length === 0 && <div className="text-center py-8 text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-20" /><p className="text-sm">{isRTL ? 'لا يوجد منظمين لهذه الحلقة' : 'No organizers for this circle'}</p></div>}</div>
    </TabsContent>
  );
}
