import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { uploadSectionTeamImage, type RootBoardMeta } from '@/services/activityStructure.service';

interface RootBoardMetaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  isRTL: boolean;
  meta: RootBoardMeta | null;
  saving: boolean;
  onSubmit: (meta: { title: string | null; description: string | null; team_image_url: string | null }) => void;
}

export function RootBoardMetaDialog({
  open,
  onOpenChange,
  branchId,
  isRTL,
  meta,
  saving,
  onSubmit,
}: RootBoardMetaDialogProps): React.ReactElement {
  const label = (ar: string, en: string): string => (isRTL ? ar : en);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamImageUrl, setTeamImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(meta?.title ?? '');
    setDescription(meta?.description ?? '');
    setTeamImageUrl(meta?.team_image_url ?? null);
  }, [open, meta]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setUploading(true);
      const url = await uploadSectionTeamImage(branchId, file);
      setTeamImageUrl(url);
      toast.success(label('تم رفع الصورة الجماعية', 'Group photo uploaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : label('فشل رفع الصورة', 'Failed to upload image'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploading) return;
    onSubmit({
      title: title.trim() || null,
      description: description.trim() || null,
      team_image_url: teamImageUrl,
    });
  };

  const hasExisting = Boolean(meta?.title || meta?.description || meta?.team_image_url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{label('إعدادات البورد الرئيسي للفرع', 'Main Branch Board Settings')}</DialogTitle>
            <DialogDescription>
              {label('أضف صورة جماعية للفرع، عنواناً، ووصفاً يظهر في الطبقة الرئيسية.', 'Set a branch group photo, title, and description for the root layer.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="root-board-title">{label('عنوان البورد (اختياري)', 'Board Title (optional)')}</Label>
            <Input
              id="root-board-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={label('مثال: هيكل قيادة فرع مدينة نصر', 'e.g. Branch Leadership Structure')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="root-board-desc">{label('وصف الفرع / الرسالة', 'Description')}</Label>
            <Textarea
              id="root-board-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={label('نبذة عن فريق عمل الفرع...', 'Overview of the branch team...')}
            />
          </div>

          <div className="space-y-2">
            <Label>{label('الصورة الجماعية للفرع', 'Branch Group Photo')}</Label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            {teamImageUrl ? (
              <div className="relative overflow-hidden rounded-xl border bg-muted/30">
                <img src={teamImageUrl} alt={title || 'Branch Team'} className="h-44 w-full object-cover" />
                <div className="absolute end-2 top-2 flex gap-1.5">
                  <Button type="button" size="sm" variant="secondary" className="h-8 text-xs shadow" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {label('تغيير', 'Change')}
                  </Button>
                  <Button type="button" size="icon" variant="destructive" className="h-8 w-8 shadow" onClick={() => setTeamImageUrl(null)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>{label('جاري رفع الصورة...', 'Uploading photo...')}</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6" />
                    <span>{label('اضغط لرفع صورة جماعية للفرع (حد أقصى 5MB)', 'Click to upload branch group photo (max 5MB)')}</span>
                  </>
                )}
              </button>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            {hasExisting ? (
              <Button
                type="button"
                variant="destructive"
                disabled={saving || uploading}
                onClick={() => onSubmit({ title: null, description: null, team_image_url: null })}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {label('حذف البيانات', 'Clear Info')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {label('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving ? label('جاري الحفظ...', 'Saving...') : label('حفظ', 'Save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
