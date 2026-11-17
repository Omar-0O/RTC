import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Check, ChevronsUpDown, ImagePlus, Layers, Loader2, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  MAX_RESPONSIBILITIES,
  MAX_TITLE_LENGTH,
  STRUCTURE_COLORS,
  getInitials,
  parseResponsibilities,
  type StructureColor,
  type StructureNode,
} from '@/utils/activityStructureTree';
import {
  uploadNodeCustomAvatar,
  uploadSectionTeamImage,
  type SaveStructureNodeInput,
  type StructureVolunteerOption,
} from '@/services/activityStructure.service';
import { STRUCTURE_COLOR_TOKENS } from './structureColors';

interface StructureNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  isRTL: boolean;
  volunteers: StructureVolunteerOption[];
  editing: StructureNode | null;
  activeBoardOwnerId: string | null;
  saving: boolean;
  onSubmit: (input: SaveStructureNodeInput) => void;
}

const volunteerLabel = (v: StructureVolunteerOption, isRTL: boolean): string =>
  (isRTL ? v.full_name_ar || v.full_name : v.full_name || v.full_name_ar) || '—';

interface VolunteerPickerProps {
  value: string | null;
  fallbackOption: StructureVolunteerOption | null;
  volunteers: StructureVolunteerOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  clearLabel: string;
  isRTL: boolean;
  onChange: (id: string | null) => void;
}

function VolunteerPicker({
  value,
  fallbackOption,
  volunteers,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel,
  isRTL,
  onChange,
}: VolunteerPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    const found = volunteers.find((v) => v.id === value);
    if (found) return found;
    return value && fallbackOption?.id === value ? fallbackOption : null;
  }, [volunteers, value, fallbackOption]);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-11 flex-1 justify-between">
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={selected.avatar_url ?? undefined} className="object-cover" />
                  <AvatarFallback className="text-[10px]">{getInitials(volunteerLabel(selected, isRTL))}</AvatarFallback>
                </Avatar>
                <span className="truncate">{volunteerLabel(selected, isRTL)}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground">
                <UserRound className="h-4 w-4" />
                {placeholder}
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {volunteers.map((v) => {
                  const name = volunteerLabel(v, isRTL);
                  return (
                    <CommandItem
                      key={v.id}
                      value={`${v.full_name ?? ''} ${v.full_name_ar ?? ''} ${v.id}`}
                      onSelect={() => {
                        onChange(v.id);
                        setOpen(false);
                      }}
                      className="gap-2"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={v.avatar_url ?? undefined} className="object-cover" />
                        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{name}</span>
                      <Check className={cn('h-4 w-4', value === v.id ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => onChange(null)} aria-label={clearLabel}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function StructureNodeDialog({
  open,
  onOpenChange,
  branchId,
  isRTL,
  volunteers,
  editing,
  activeBoardOwnerId,
  saving,
  onSubmit,
}: StructureNodeDialogProps): React.ReactElement {
  const label = (ar: string, en: string): string => (isRTL ? ar : en);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [color, setColor] = useState<StructureColor>('primary');
  const [responsibilitiesText, setResponsibilitiesText] = useState('');

  // Owned section state (the section/sub-board this volunteer leads)
  const [hasSection, setHasSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamImageUrl, setTeamImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setVolunteerId(editing?.volunteer_id ?? null);
    setCustomAvatarUrl(editing?.custom_avatar_url ?? null);
    setColor(editing?.color ?? 'primary');
    setResponsibilitiesText((editing?.responsibilities ?? []).join('\n'));
    const owned = Boolean(editing?.section_title?.trim() || editing?.description?.trim() || editing?.team_image_url);
    setHasSection(owned);
    setSectionTitle(editing?.section_title ?? '');
    setDescription(editing?.description ?? '');
    setTeamImageUrl(editing?.team_image_url ?? null);
  }, [open, editing]);

  const fallbackVolunteer = useMemo<StructureVolunteerOption | null>(() => {
    if (!editing?.volunteer_id) return null;
    return {
      id: editing.volunteer_id,
      full_name: editing.volunteer_name,
      full_name_ar: editing.volunteer_name_ar,
      avatar_url: editing.volunteer_avatar,
    };
  }, [editing]);

  const responsibilities = useMemo(() => parseResponsibilities(responsibilitiesText), [responsibilitiesText]);
  const trimmedTitle = title.trim();
  const canSave = trimmedTitle.length > 0 && !saving && !uploadingImage && !uploadingAvatar;

  const selectedVolunteer = useMemo(() => {
    if (!volunteerId) return null;
    return volunteers.find((v) => v.id === volunteerId) ?? fallbackVolunteer;
  }, [fallbackVolunteer, volunteerId, volunteers]);

  const validateAndUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    uploader: (bId: string, file: File) => Promise<string>,
    setBusy: (v: boolean) => void,
    onDone: (url: string) => void,
    successMsg: string,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !branchId) return;
    if (!file.type.startsWith('image/')) {
      toast.error(label('يرجى اختيار ملف صورة صالح', 'Please select a valid image file'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(label('الحد الأقصى لحجم الصورة 5 ميجابايت', 'Maximum image size is 5MB'));
      return;
    }
    try {
      setBusy(true);
      const url = await uploader(branchId, file);
      onDone(url);
      toast.success(successMsg);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : label('فشل رفع الصورة', 'Failed to upload image'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    validateAndUpload(
      event,
      uploadSectionTeamImage,
      setUploadingImage,
      setTeamImageUrl,
      label('تم رفع صورة السكشن', 'Section photo uploaded'),
      fileInputRef
    );

  const handleCustomAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    validateAndUpload(
      event,
      uploadNodeCustomAvatar,
      setUploadingAvatar,
      setCustomAvatarUrl,
      label('تم رفع الصورة المخصصة للبورد', 'Custom board photo uploaded'),
      avatarInputRef
    );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    onSubmit({
      title: trimmedTitle,
      volunteer_id: volunteerId,
      custom_avatar_url: customAvatarUrl,
      deputy_id: null,
      deputy_title: null,
      parent_id: editing?.parent_id ?? null,
      responsibilities,
      color,
      node_type: 'volunteer',
      board_owner_id: editing ? (editing.board_owner_id ?? null) : activeBoardOwnerId,
      section_title: hasSection ? sectionTitle.trim() || trimmedTitle : null,
      description: hasSection ? description.trim() || null : null,
      team_image_url: hasSection ? teamImageUrl : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>
              {editing ? label('تعديل المتطوع والسكشن', 'Edit volunteer & section') : label('إضافة متطوع للبورد', 'Add volunteer to board')}
            </DialogTitle>
            <DialogDescription>
              {label('اختر المتطوع ومسئوليته، ويمكنك ربطه بسكشن له بورد خاصة.', 'Pick the volunteer and role, and optionally attach a section sub-board.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="structure-title">{label('المسئولية / الوظيفة', 'Role / Position')} *</Label>
            <Input
              id="structure-title"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={label('مثال: مسئول لجنة الإيفينتات', 'e.g. Events committee lead')}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{label('المتطوع', 'Volunteer')}</Label>
            <VolunteerPicker
              value={volunteerId}
              fallbackOption={fallbackVolunteer}
              volunteers={volunteers}
              placeholder={label('اختر متطوع (أو اتركه شاغر)', 'Pick a volunteer (or leave vacant)')}
              searchPlaceholder={label('ابحث بالاسم...', 'Search by name...')}
              emptyText={label('لا يوجد نتائج', 'No results')}
              clearLabel={label('إزالة المتطوع', 'Clear volunteer')}
              isRTL={isRTL}
              onChange={setVolunteerId}
            />

            {/* Board Photo Source: App Avatar vs Custom Uploaded Photo */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/15 px-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-9 w-9 border shadow-sm shrink-0">
                  <AvatarImage src={customAvatarUrl ?? selectedVolunteer?.avatar_url ?? undefined} className="object-cover" />
                  <AvatarFallback className="text-xs font-bold">
                    <UserRound className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {customAvatarUrl
                      ? label('صورة مخصصة للبورد', 'Custom board photo')
                      : label('صورة التطبيق الشخصية', 'App profile photo')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {customAvatarUrl
                      ? label('تظهر هذه الصورة على البورد فقط', 'Shown on the board only')
                      : label('تعتمد على صورة المتطوع في التطبيق', 'Uses volunteer profile photo')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCustomAvatarChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={uploadingAvatar || !branchId}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  {customAvatarUrl ? label('تغيير', 'Change') : label('رفع صورة', 'Upload photo')}
                </Button>
                {customAvatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setCustomAvatarUrl(null)}
                    title={label('الرجوع لصورة التطبيق', 'Use app photo')}
                  >
                    <X className="h-3.5 w-3.5" />
                    {label('صورة التطبيق', 'App photo')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="structure-responsibilities">{label('الوصف الوظيفي (يظهر عند الـ Hover)', 'Job description (shown on hover)')}</Label>
              <span className="text-xs text-muted-foreground">
                {responsibilities.length}/{MAX_RESPONSIBILITIES}
              </span>
            </div>
            <Textarea
              id="structure-responsibilities"
              rows={4}
              value={responsibilitiesText}
              onChange={(e) => setResponsibilitiesText(e.target.value)}
              placeholder={label('كل مسئولية في سطر\nمثال: متابعة أعضاء اللجنة\nرفع تقرير أسبوعي', 'One responsibility per line')}
            />
          </div>

          {/* Section Sub-Board Configuration */}
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <div>
                  <Label htmlFor="has-section-toggle" className="cursor-pointer font-semibold">
                    {label('هذا المتطوع ماسك سكشن؟', 'Leads a dedicated section?')}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {label('عند الضغط على السكشن تفتح بورد جديدة لفريقه.', 'Clicking the section opens its own sub-board.')}
                  </p>
                </div>
              </div>
              <Switch id="has-section-toggle" checked={hasSection} onCheckedChange={setHasSection} />
            </div>

            {hasSection && (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="section-title-input">{label('اسم السكشن', 'Section name')}</Label>
                  <Input
                    id="section-title-input"
                    value={sectionTitle}
                    onChange={(e) => setSectionTitle(e.target.value)}
                    placeholder={label('مثال: سكشن الإيفينتات', 'e.g. Events Section')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="section-desc-input">{label('ديسكربشن السكشن', 'Section description')}</Label>
                  <Textarea
                    id="section-desc-input"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={label('وصف مختصر للسكشن وفريقه...', 'Short description of this section...')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{label('صورة السكشن / الفريق', 'Section / Team photo')}</Label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {teamImageUrl ? (
                    <div className="relative overflow-hidden rounded-xl border bg-muted/30">
                      <img src={teamImageUrl} alt={sectionTitle || 'Section'} className="h-32 w-full object-cover" />
                      <div className="absolute end-2 top-2 flex gap-1.5">
                        <Button type="button" size="sm" variant="secondary" className="h-7 text-xs shadow" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                          {label('تغيير', 'Change')}
                        </Button>
                        <Button type="button" size="icon" variant="destructive" className="h-7 w-7 shadow" onClick={() => setTeamImageUrl(null)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/80 bg-background/60 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>{label('جاري الرفع...', 'Uploading...')}</span>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-5 w-5" />
                          <span>{label('رفع صورة السكشن (حد أقصى 5MB)', 'Upload section photo (max 5MB)')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{label('اللون', 'Accent color')}</Label>
            <div className="flex flex-wrap gap-2">
              {STRUCTURE_COLORS.map((c) => {
                const tokens = STRUCTURE_COLOR_TOKENS[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    title={isRTL ? tokens.labelAr : tokens.labelEn}
                    aria-label={isRTL ? tokens.labelAr : tokens.labelEn}
                    aria-pressed={color === c}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 border-background shadow transition-transform hover:scale-110',
                      tokens.swatch,
                      color === c && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                    )}
                  />
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {label('إلغاء', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!canSave}>
              {saving ? label('جاري الحفظ...', 'Saving...') : label('حفظ', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
