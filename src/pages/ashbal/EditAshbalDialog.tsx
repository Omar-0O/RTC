import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Eye, EyeOff } from 'lucide-react';
import Cropper from 'react-easy-crop';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

// Helper functions for image cropping
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<File | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) return null

  const rotRad = getRadianAngle(rotation)
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation)

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height)

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.putImageData(data, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg')
  })
}

interface EditAshbalDialogProps {
  user: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAshbalDialog({ user, open, onOpenChange, onSuccess }: EditAshbalDialogProps) {
  const { t, language } = useLanguage();
  const { primaryRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLevel, setFormLevel] = useState<string>('under_follow_up');
  const [formJoinDate, setFormJoinDate] = useState<string>('');
  const [formBirthDate, setFormBirthDate] = useState<string>('');

  // Avatar states
  const [formAvatarFile, setFormAvatarFile] = useState<File | null>(null);
  const [formAvatarPreview, setFormAvatarPreview] = useState<string | null>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    if (user && open) {
      setFormName(user.full_name || '');
      setFormNameAr(user.full_name_ar || '');
      setFormPhone(user.phone || '');
      setFormLevel(user.level || 'under_follow_up');
      setFormJoinDate(user.created_at ? format(new Date(user.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setFormBirthDate(user.birth_date || '');
      setFormAvatarPreview(user.avatar_url);
      setFormAvatarFile(null);
      setTempImageSrc(null);
      setIsCropping(false);
    }
  }, [user, open]);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const showCroppedImage = async () => {
    try {
      if (!tempImageSrc || !croppedAreaPixels) return

      const croppedFile = await getCroppedImg(tempImageSrc, croppedAreaPixels)

      if (croppedFile) {
        setFormAvatarFile(croppedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(croppedFile);
        setIsCropping(false);
        setTempImageSrc(null);
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to crop image')
    }
  }

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!formAvatarFile) return null;

    try {
      const fileExt = formAvatarFile.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formAvatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formName.trim()) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update profile
      const updates: any = {
        full_name: formName.trim(),
        full_name_ar: formNameAr.trim() || null,
        phone: formPhone.trim() || null,
        level: formLevel,
        // created_at is system controlled usually, but we might want to update join_date if column exists
        // Checking types, profiles has join_date column separate from created_at
        // user object passed usually has created_at as join date in UI mapping.
        // Let's check if profiles has 'join_date' column.
        // Looking at AddUserForm, it sends joinDate to edge function.
        // types.ts says profiles has 'join_date'.
        join_date: formJoinDate,
        birth_date: formBirthDate || null,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Upload avatar if changed
      if (formAvatarFile) {
        try {
          const avatarUrl = await uploadAvatar(user.id);
          if (avatarUrl) {
            await supabase
              .from('profiles')
              .update({ avatar_url: avatarUrl })
              .eq('id', user.id);
          }
        } catch (avatarError) {
          console.error('Avatar upload failed:', avatarError);
          toast.error('Failed to upload new avatar');
        }
      }

      toast.success(language === 'ar' ? 'تم تحديث البيانات بنجاح' : 'User updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{language === 'ar' ? 'تعديل بيانات الشبل' : 'Edit Ashbal Details'}</DialogTitle>
          <DialogDescription>{language === 'ar' ? 'تعديل البيانات الأساسية للشبل' : 'Update Ashbal basic information'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-1">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">{language === 'ar' ? 'الاسم بالإنجليزي' : 'Full Name (English)'} *</Label>
                <Input
                  id="edit-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={language === 'ar' ? 'Omar Mohamed' : 'Full Name'}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name-ar">{language === 'ar' ? 'الاسم بالعربي' : 'Full Name (Arabic)'}</Label>
                <Input
                  id="edit-name-ar"
                  value={formNameAr}
                  onChange={(e) => setFormNameAr(e.target.value)}
                  placeholder={language === 'ar' ? 'عمر محمد' : 'Arabic Name'}
                  dir="rtl"
                />
              </div>
            </div>

            {/* Avatar Upload */}
            <div className="grid gap-2">
              <Label>{language === 'ar' ? 'الصورة الشخصية' : 'Profile Picture'}</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={formAvatarPreview || undefined} />
                  <AvatarFallback>{formName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleAvatarSelect}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'ar' ? 'الحد الأقصى 2 ميجابايت' : 'Max size 2MB'}
                  </p>
                </div>
              </div>

              {/* Crop UI */}
              {isCropping && tempImageSrc && (
                <div className="mt-4 border rounded-lg p-4 space-y-4">
                  <div className="relative h-64 w-full bg-black rounded-lg overflow-hidden">
                    <Cropper
                      image={tempImageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm min-w-[3rem]">{t('Zoom')}</span>
                    <Slider
                      value={[zoom]}
                      min={1}
                      max={3}
                      step={0.1}
                      onValueChange={(vals) => setZoom(vals[0])}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCropping(false);
                        setTempImageSrc(null);
                        setFormAvatarFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button type="button" onClick={showCroppedImage}>
                      {language === 'ar' ? 'قص وحفظ' : 'Crop & Save'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">{t('users.phoneNumber')}</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+20 123 456 7890"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-level">{t('users.level')}</Label>
                <Select value={formLevel} onValueChange={setFormLevel} disabled={!['admin', 'head_ashbal'].includes(primaryRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('users.level')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_follow_up">{t('level.under_follow_up')}</SelectItem>
                    <SelectItem value="project_responsible">{t('level.project_responsible')}</SelectItem>
                    <SelectItem value="responsible">{t('level.responsible')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="join-date">{language === 'ar' ? 'تاريخ الانضمام لعائلة RTC 😊' : 'Join Date to RTC Family 😊'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formJoinDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formJoinDate ? format(new Date(formJoinDate), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formJoinDate ? new Date(formJoinDate) : undefined}
                      onSelect={(date) => setFormJoinDate(date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                      captionLayout="dropdown-buttons"
                      fromYear={2000}
                      toYear={2030}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth-date">{language === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formBirthDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formBirthDate ? format(new Date(formBirthDate), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formBirthDate ? new Date(formBirthDate) : undefined}
                      onSelect={(date) => setFormBirthDate(date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                      captionLayout="dropdown-buttons"
                      fromYear={1960}
                      toYear={2030}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
