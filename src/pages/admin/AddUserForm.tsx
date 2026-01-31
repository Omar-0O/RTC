import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Eye, EyeOff } from 'lucide-react';
import Cropper from 'react-easy-crop';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';

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

interface AddUserFormProps {
  onSuccess: () => void;
  defaultIsAshbal?: boolean;
}

export function AddUserForm({ onSuccess, defaultIsAshbal = false }: AddUserFormProps) {
  const { t, language } = useLanguage();
  const { primaryRole } = useAuth();

  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<string>('volunteer');
  const [formLevel, setFormLevel] = useState<string>('under_follow_up');
  const [formCommitteeId, setFormCommitteeId] = useState<string>('');
  const [formAvatarFile, setFormAvatarFile] = useState<File | null>(null);
  const [formAvatarPreview, setFormAvatarPreview] = useState<string | null>(null);
  const [formAttendedMiniCamp, setFormAttendedMiniCamp] = useState(false);
  const [formAttendedCamp, setFormAttendedCamp] = useState(false);
  const [formIsAshbal, setFormIsAshbal] = useState(defaultIsAshbal);
  const [formJoinDate, setFormJoinDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [committees, setCommittees] = useState<any[]>([]);

  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch committees
  useState(() => {
    const fetchCommittees = async () => {
      const { data } = await supabase
        .from('committees')
        .select('id, name, name_ar')
        .order('name');
      setCommittees(data || []);
    };
    fetchCommittees();
  });

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

    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formEmail.trim(),
          password: formPassword,
          fullName: formName.trim(),
          fullNameAr: formNameAr.trim(),
          role: formRole,
          committeeId: formCommitteeId || null,
          phone: formPhone.trim() || null,
          level: formLevel,
          joinDate: formJoinDate,
        },
      });

      if (error) {
        console.error('Edge function invocation error:', error);
        throw error;
      }

      if (!data?.user) {
        const errorMsg = data?.error || 'Failed to create user - no user returned';
        console.error('Create user failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Upload avatar
      if (formAvatarFile && data.user) {
        try {
          const avatarUrl = await uploadAvatar(data.user.id);
          if (avatarUrl) {
            await supabase
              .from('profiles')
              .update({ avatar_url: avatarUrl })
              .eq('id', data.user.id);
          }
        } catch (avatarError) {
          console.error('Avatar upload failed:', avatarError);
        }
      }

      // Update attendance & ashbal status
      if (data.user) {
        const updates: any = {};
        if (formLevel === 'under_follow_up') updates.attended_mini_camp = formAttendedMiniCamp;
        if (formLevel === 'project_responsible') updates.attended_camp = formAttendedCamp;
        if (formIsAshbal) updates.is_ashbal = true;

        if (Object.keys(updates).length > 0) {
          updates.level = formLevel;
          await supabase.from('profiles').update(updates).eq('id', data.user.id);
        }
      }

      toast.success('User added successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error adding user:', error);
      const message = error?.message || error?.error || 'Failed to add user';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-1">
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{language === 'ar' ? 'الاسم بالإنجليزي' : 'Full Name (English)'} *</Label>
            <Input
              id="name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={language === 'ar' ? 'Omar Mohamed' : 'Full Name'}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name-ar">{language === 'ar' ? 'الاسم بالعربي' : 'Full Name (Arabic)'} *</Label>
            <Input
              id="name-ar"
              value={formNameAr}
              onChange={(e) => setFormNameAr(e.target.value)}
              placeholder={language === 'ar' ? 'عمر محمد' : 'Arabic Name'}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">{t('auth.email')} *</Label>
            <Input
              id="email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder={t('auth.email')}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">{t('users.phoneNumber')}</Label>
            <Input
              id="phone"
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="+20 123 456 7890"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">{t('password')} *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              className="ltr:pr-10 rtl:pl-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="role">{t('users.role')}</Label>
            <Select value={formRole} onValueChange={setFormRole}>
              <SelectTrigger>
                <SelectValue placeholder={t('users.role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                <SelectItem value="hr">{t('common.hr')}</SelectItem>
                <SelectItem value="head_hr">{t('common.head_hr')}</SelectItem>
                <SelectItem value="head_caravans">{t('common.head_caravans')}</SelectItem>
                <SelectItem value="head_events">{t('common.head_events')}</SelectItem>
                <SelectItem value="head_ethics">{t('common.head_ethics')}</SelectItem>
                <SelectItem value="head_quran">{t('common.head_quran')}</SelectItem>
                <SelectItem value="head_marketing">{t('common.head_marketing')}</SelectItem>
                <SelectItem value="head_ashbal">{t('common.head_ashbal')}</SelectItem>
                <SelectItem value="marketing_member">{t('common.marketing_member')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="level">{t('users.level')}</Label>
            <Select value={formLevel} onValueChange={setFormLevel} disabled={!['admin', 'head_hr'].includes(primaryRole)}>
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
        <div className="grid gap-2">
          <Label htmlFor="committee">{t('users.committee')}</Label>
          <Select
            value={formCommitteeId || 'none'}
            onValueChange={(val) => setFormCommitteeId(val === 'none' ? '' : val)}
            disabled={!['admin', 'head_hr', 'hr'].includes(primaryRole)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('users.committee')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{language === 'ar' ? 'بدون لجنة' : 'No Committee'}</SelectItem>
              {committees.map((committee: any) => (
                <SelectItem key={committee.id} value={committee.id}>
                  {language === 'ar' ? committee.name_ar : committee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Avatar Upload */}
        <div className="grid gap-2">
          <Label>{language === 'ar' ? 'الصورة الشخصية' : 'Profile Picture'}</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={formAvatarPreview || undefined} />
              <AvatarFallback>{formName ? formName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
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
      </div>

      {(formLevel === 'under_follow_up' || formLevel === 'project_responsible') && (
        <div className="border-t pt-4 mt-4 pb-4">
          <h4 className="text-sm font-medium mb-4">
            {formLevel === 'under_follow_up'
              ? (language === 'ar' ? 'حضور الميني كامب' : 'Mini Camp Attendance')
              : (language === 'ar' ? 'حضور الكامب' : 'Camp Attendance')}
          </h4>
          <div className="grid gap-4">
            {formLevel === 'under_follow_up' && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="mini-camp-attendance">{language === 'ar' ? 'حضور الميني كامب' : 'Mini Camp Attendance'}</Label>
                </div>
                <Switch
                  id="mini-camp-attendance"
                  checked={formAttendedMiniCamp}
                  onCheckedChange={setFormAttendedMiniCamp}
                />
              </div>
            )}
            {formLevel === 'project_responsible' && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="camp-attendance">{language === 'ar' ? 'حضور الكامب' : 'Camp Attendance'}</Label>
                </div>
                <Switch
                  id="camp-attendance"
                  checked={formAttendedCamp}
                  onCheckedChange={setFormAttendedCamp}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="join-date">{language === 'ar' ? 'تاريخ الانضمام لعائلة RTC 😊' : 'Join Date to RTC Family 😊'}</Label>
          <Input
            id="join-date"
            type="date"
            value={formJoinDate}
            onChange={(e) => setFormJoinDate(e.target.value)}
          />
        </div>
        <div className="flex items-end pb-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="is-ashbal"
              checked={formIsAshbal}
              onCheckedChange={setFormIsAshbal}
            />
            <Label htmlFor="is-ashbal">
              {language === 'ar' ? 'من الأشبال؟' : 'Is Ashbal?'}
            </Label>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <Button type="button" variant="outline" onClick={() => onSuccess()} className="w-full sm:w-auto">
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Adding...' : t('common.add')}
        </Button>
      </div>
    </form>
  );
}
