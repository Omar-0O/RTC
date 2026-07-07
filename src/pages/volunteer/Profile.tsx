import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ProofImagePreview } from '@/components/ProofImagePreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { LevelBadge } from '@/components/ui/level-badge';
import { getLevelProgress } from '@/components/ui/level-progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Mail, Award, Loader2, Camera, Upload, Check, X, MessageSquare, Plus, AlertCircle, Pencil, Trash2, Star, Trophy, Medal, Crown, Heart, Zap, Target, Copy, Phone, MapPin, Users, Cake, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useVolunteerProfile,
  type VolunteerFeedback,
  type VolunteerProfileView,
} from './hooks/useVolunteerProfile';
import { COVER_IMAGES } from '@/constants/profileCovers';

const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  award: Award,
  star: Star,
  trophy: Trophy,
  medal: Medal,
  crown: Crown,
  heart: Heart,
  zap: Zap,
  target: Target,
};

const getBadgeIcon = (iconName: string) => {
  const IconComponent = BADGE_ICONS[iconName] || Award;
  return <IconComponent className="h-8 w-8" />;
};

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MAX_DIMENSION = 1200;
const AVATAR_CONTENT_TYPE = 'image/jpeg';
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LEGACY_AVATAR_PATHS = ['avatar.jpeg', 'avatar.png', 'avatar.webp', 'avatar.gif'];

interface ProfileProps {
  userId?: string;
  onEdit?: () => void;
}

const createAvatarJpeg = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > AVATAR_MAX_DIMENSION) {
            height *= AVATAR_MAX_DIMENSION / width;
            width = AVATAR_MAX_DIMENSION;
          }
        } else {
          if (height > AVATAR_MAX_DIMENSION) {
            width *= AVATAR_MAX_DIMENSION / height;
            height = AVATAR_MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }
            const compressedFile = new File([blob], 'avatar.jpg', {
              type: AVATAR_CONTENT_TYPE,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          AVATAR_CONTENT_TYPE,
          0.82
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const getDefaultCover = (uid: string) => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COVER_IMAGES.length;
  return COVER_IMAGES[index];
};

type CreatedByRelation = { created_by?: unknown } | { created_by?: unknown }[] | null | undefined;

const toOptionalString = (value: unknown) => (
  typeof value === 'string' && value.trim().length > 0 ? value : null
);

const toOptionalImageUrl = toOptionalString;

const getCreatedByFromRelation = (relation: CreatedByRelation) => {
  if (Array.isArray(relation)) {
    return toOptionalString(relation[0]?.created_by);
  }
  return toOptionalString(relation?.created_by);
};

export default function Profile({ userId: propUserId }: ProfileProps) {
  const { id: paramUserId } = useParams();
  const userId = propUserId || paramUserId;

  const { user, profile: authProfile, refreshProfile, hasRole } = useAuth();

  const { t, isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isFineDialogOpen, setIsFineDialogOpen] = useState(false);
  const [newFeedback, setNewFeedback] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [selectedFineType, setSelectedFineType] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [fineComment, setFineComment] = useState('');
  const [submittingFine, setSubmittingFine] = useState(false);
  const [editFeedbackId, setEditFeedbackId] = useState<string | null>(null);
  const [editFeedbackContent, setEditFeedbackContent] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{ type: 'fine' | 'feedback', id: string, fineSourceType?: string } | null>(null);

  const [showUnauthorizedDialog, setShowUnauthorizedDialog] = useState(false);

  // New state for avatar preview
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // If userId is provided and different from current user, we are in view-only mode
  const isViewOnly = userId && userId !== user?.id;
  const targetUserId = userId || user?.id;

  const {
    loading,
    profile: viewedProfile,
    avatarUrl: viewedAvatarUrl,
    badges,
    activities,
    feedbacks,
    fines,
    fineTypes,
    refetch: fetchData,
    setAvatarUrl: setViewedAvatarUrl,
    setFeedbacks,
  } = useVolunteerProfile(targetUserId, isRTL);

  const authProfileView = authProfile as VolunteerProfileView | null | undefined;

  // Use the fetched profile if available. If viewing another user, do not fallback to authProfile (logged-in user)
  const displayProfile = isViewOnly ? viewedProfile : (viewedProfile || authProfileView);
  const displayAvatar = toOptionalImageUrl(
    isViewOnly ? viewedAvatarUrl : (viewedAvatarUrl || authProfile?.avatar_url),
  );
  const displayCover = toOptionalImageUrl(
    isViewOnly ? viewedProfile?.cover_url : (viewedProfile?.cover_url || authProfile?.cover_url),
  );
  const isAshbal = displayProfile?.is_ashbal;



  const handleRandomCover = async () => {
    if (!user) return;

    // Get a random image that's different from the current one
    let randomImage = COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)];
    while (randomImage === displayCover && COVER_IMAGES.length > 1) {
      randomImage = COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)];
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cover_url: randomImage })
        .eq('id', targetUserId);

      if (error) throw error;

      toast.success(isRTL ? 'تم تحديث صورة الغلاف' : 'Cover image updated');

      if (!isViewOnly) {
        refreshProfile();
      } else {
        fetchData();
      }
    } catch (error) {
      console.error('Error updating cover:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء تحديث الغلاف' : 'Error updating cover');
    }
  };

  const currentMonthActivities = useMemo(() => activities.filter(a => {
    const activityDate = new Date(a.submitted_at);
    const now = new Date();
    return activityDate.getMonth() === now.getMonth() && activityDate.getFullYear() === now.getFullYear();
  }), [activities]);

  const monthlyImpactCalculated = useMemo(
    () => currentMonthActivities.reduce((sum, a) => sum + Math.max(0, a.points), 0),
    [currentMonthActivities]
  );

  // Show monthly points consistently
  const points = monthlyImpactCalculated;

  // Level progress is now manual, so we don't calculate it from points
  const userLevel = displayProfile?.level;
  const userInitials = displayProfile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  useEffect(() => {
    if (!isViewOnly) {
      setViewedAvatarUrl(authProfile?.avatar_url || null);
      refreshProfile();
    }
  }, [authProfile?.avatar_url, isViewOnly, refreshProfile, setViewedAvatarUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error(isRTL ? 'يرجى اختيار صورة JPG أو PNG أو WebP' : 'Please select a JPG, PNG, or WebP image');
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setSelectedFile(file);

    // Reset input value so same file can be selected again if needed
    e.target.value = '';
  };

  const handleSaveAvatar = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);

    try {
      if (selectedFile.size > AVATAR_MAX_BYTES) {
        toast.info(isRTL ? 'جاري ضغط الصورة لتناسب الحجم المسموح...' : 'Compressing image to fit size limit...');
      }

      const avatarFile = await createAvatarJpeg(selectedFile);

      if (avatarFile.size > AVATAR_MAX_BYTES) {
        throw new Error('Avatar image is still too large after compression');
      }

      const fileName = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(fileName, avatarFile, {
          upsert: true,
          cacheControl: '3600',
          contentType: AVATAR_CONTENT_TYPE,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setViewedAvatarUrl(avatarUrl);
      await refreshProfile();

      const staleAvatarPaths = LEGACY_AVATAR_PATHS.map(path => `${user.id}/${path}`);
      const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove(staleAvatarPaths);
      if (cleanupError) {
        console.warn('Avatar cleanup skipped:', cleanupError.message);
      }

      toast.success(isRTL ? 'تم تحديث الصورة الشخصية' : 'Profile picture updated');

      setAvatarPreview(null);
      setSelectedFile(null);
    } catch (error: unknown) {
      console.error('Error uploading avatar:', error);
      toast.error(isRTL ? 'فشل في تحميل الصورة' : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCancelAvatar = () => {
    setAvatarPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyEmail = () => {
    if (displayProfile?.email) {
      navigator.clipboard.writeText(displayProfile.email);
      setCopiedEmail(true);
      toast.success(isRTL ? 'تم نسخ البريد الإلكتروني' : 'Email copied to clipboard');
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };


  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return isRTL ? 'مقبول' : 'Approved';
      case 'rejected': return isRTL ? 'مرفوض' : 'Rejected';
      default: return isRTL ? 'قيد المراجعة' : 'Pending';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-warning/10 text-warning';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleAddFine = async () => {
    if (!targetUserId || !user || !selectedFineType) return;

    setSubmittingFine(true);
    try {
      const selectedFine = fineTypes.find(f => f.id === selectedFineType);
      if (!selectedFine) throw new Error('Invalid fine type');

      // Insert into the NEW volunteer_fines table (not activity_submissions)
      const { error } = await supabase
        .from('volunteer_fines')
        .insert({
          volunteer_id: targetUserId,
          fine_type_id: selectedFineType,
          amount: selectedFine.amount,
          is_paid: false,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success(isRTL ? 'تم إضافة الغرامة بنجاح' : 'Fine added successfully');
      setIsFineDialogOpen(false);
      setFineAmount('');
      setFineComment('');
      setSelectedFineType('');
      fetchData();
    } catch (error) {
      console.error('Error adding fine:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء إضافة الغرامة' : 'Error adding fine');
    } finally {
      setSubmittingFine(false);
    }
  };



  const handleDeleteFine = async (fineId: string, sourceType: string) => {
    if (!user) return;

    try {
      let creatorId: string | null = null;

      if (sourceType === 'manual') {
        const { data } = await supabase
          .from('volunteer_fines')
          .select('created_by')
          .eq('id', fineId)
          .single();
        creatorId = toOptionalString(data?.created_by);
      } else if (sourceType === 'activity') {
        const { data } = await supabase
          .from('activity_submissions')
          .select('reviewed_by')
          .eq('id', fineId)
          .single();
        creatorId = toOptionalString(data?.reviewed_by);
      } else if (sourceType === 'caravan') {
        const { data } = await supabase
          .from('caravan_participants')
          .select('caravans(created_by)')
          .eq('id', fineId)
          .single();
        creatorId = getCreatedByFromRelation(data?.caravans);
      } else if (sourceType === 'event') {
        const { data } = await supabase
          .from('event_participants')
          .select('events(created_by)')
          .eq('id', fineId)
          .single();
        creatorId = getCreatedByFromRelation(data?.events);
      } else if (sourceType === 'ethics_call') {
        const { data } = await supabase
          .from('ethics_calls_participants')
          .select('ethics_calls(created_by)')
          .eq('id', fineId)
          .single();
        creatorId = getCreatedByFromRelation(data?.ethics_calls);
      }

      // If we identified a creator and it's not the current user
      if (creatorId && creatorId !== user.id) {
        setShowUnauthorizedDialog(true);
        return;
      }

      setItemToDelete({ type: 'fine', id: fineId, fineSourceType: sourceType });
    } catch (error) {
      console.error('Error checking fine ownership:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء التحقق من الصلاحية' : 'Error checking permissions');
    }
  };

  const handleDeleteFeedback = (id: string) => {
    setItemToDelete({ type: 'feedback', id });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'fine') {
        const sourceType = itemToDelete.fineSourceType;

        if (sourceType === 'manual') {
          // Delete manual fine from volunteer_fines table
          const { error } = await supabase.from('volunteer_fines').delete().eq('id', itemToDelete.id);
          if (error) throw error;
        } else if (sourceType === 'activity') {
          // For activity fines, set wore_vest to true
          const { error } = await supabase
            .from('activity_submissions')
            .update({ wore_vest: true })
            .eq('id', itemToDelete.id);
          if (error) throw error;
        } else if (sourceType === 'caravan') {
          // For caravan fines, set wore_vest to true
          const { error } = await supabase
            .from('caravan_participants')
            .update({ wore_vest: true })
            .eq('id', itemToDelete.id);
          if (error) throw error;
        } else if (sourceType === 'event') {
          // For event fines, set wore_vest to true
          const { error } = await supabase
            .from('event_participants')
            .update({ wore_vest: true })
            .eq('id', itemToDelete.id);
          if (error) throw error;
        } else if (sourceType === 'ethics_call') {
          // For ethics call fines, set wore_vest to true
          const { error } = await supabase
            .from('ethics_calls_participants')
            .update({ wore_vest: true })
            .eq('id', itemToDelete.id);
          if (error) throw error;
        }

        toast.success(isRTL ? 'تم حذف الغرامة' : 'Fine removed');
      } else {
        const { error } = await supabase.from('volunteer_feedbacks').delete().eq('id', itemToDelete.id);
        if (error) throw error;
        toast.success(isRTL ? 'تم حذف الرأي' : 'Feedback deleted');
        setFeedbacks(feedbacks.filter(f => f.id !== itemToDelete.id)); // Optimistic update for feedbacks
      }
      fetchData(); // Refresh all data to be sure
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(isRTL ? 'فشل الحذف' : 'Failed to delete');
    } finally {
      setItemToDelete(null);
    }
  };

  const handleSaveFeedback = async (id: string) => {
    if (!editFeedbackContent.trim()) return;
    try {
      const { error } = await supabase
        .from('volunteer_feedbacks')
        .update({ content: editFeedbackContent.trim() })
        .eq('id', id);

      if (error) throw error;

      toast.success(isRTL ? 'تم تحديث الرأي' : 'Feedback updated');
      setFeedbacks(feedbacks.map(f => f.id === id ? { ...f, content: editFeedbackContent.trim() } : f));
      setEditFeedbackId(null);
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast.error(isRTL ? 'فشل تحديث الرأي' : 'Failed to update feedback');
    }
  };



  if (loading && isViewOnly && !viewedProfile) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-pulse overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Profile Header Skeleton */}
        <Card className="overflow-hidden border-none shadow-md rounded-2xl">
          {/* Cover Skeleton */}
          <Skeleton className="h-44 sm:h-64 w-full rounded-none" />
          <CardContent className="relative pt-0 px-4 sm:px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6">
              {/* Avatar Circle Skeleton */}
              <Skeleton className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-background shadow-xl shrink-0 -mt-16 sm:-mt-20 bg-muted/80" />

              {/* Profile Details Skeleton */}
              <div className="flex-1 text-center sm:text-start space-y-3 mb-2 pt-2 sm:pt-4 min-w-0 flex flex-col items-center sm:items-start">
                {/* Name Skeleton */}
                <Skeleton className="h-8 w-48 sm:w-64" />
                
                {/* Badges Skeleton */}
                <div className="flex gap-2 justify-center sm:justify-start">
                  <Skeleton className="h-6 w-20 rounded-lg" />
                  <Skeleton className="h-6 w-24 rounded-lg" />
                </div>

                {/* Email / Phone Stack Skeleton */}
                <div className="flex flex-col items-center sm:items-start gap-2 pt-1 w-full max-w-[280px] sm:max-w-none">
                  <Skeleton className="h-4 w-52 sm:w-60" />
                  <Skeleton className="h-4 w-40 sm:w-48" />
                </div>

                {/* Dates Row Skeleton */}
                <div className="flex gap-2 justify-center sm:justify-start w-full pt-1">
                  <Skeleton className="h-7 w-28 rounded-xl" />
                  <Skeleton className="h-7 w-32 rounded-xl" />
                </div>
              </div>

              {/* Stats Block Skeleton */}
              <div className="flex gap-2 sm:gap-3 items-center shrink-0 w-full sm:w-auto justify-center sm:justify-end mt-2 sm:mt-0 pt-2 sm:pt-4">
                <Skeleton className="h-16 w-20 sm:w-24 rounded-xl" />
                <Skeleton className="h-16 w-20 sm:w-24 rounded-xl" />
                <Skeleton className="h-16 w-20 sm:w-24 rounded-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Buttons Skeleton */}
        <div className="flex gap-2 border-b pb-2 px-3 sm:px-0">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        {/* Content Area Skeleton */}
        <Card className="p-6 rounded-2xl">
          <div className="space-y-4">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Get cover image - use saved cover or default based on user ID
  const coverImage = displayCover || getDefaultCover(targetUserId || 'default');

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-up overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Profile Header */}
      <Card className="overflow-hidden border-none shadow-md rounded-2xl">
        <div className="h-44 sm:h-64 relative group/cover">
          {/* Cover Image */}
          <img
            src={coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

          {/* Random Cover Button */}
          {(!isViewOnly || (hasRole('admin') || hasRole('head_hr') || hasRole('hr'))) && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-4 ltr:left-4 rtl:right-4 opacity-0 group-hover/cover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/10 shadow-lg"
              onClick={handleRandomCover}
            >
              <Camera className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {isRTL ? 'تغيير الغلاف' : 'Randomize Cover'}
            </Button>
          )}
        </div>
        <CardContent className="relative pt-0 px-4 sm:px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-6">
            <div className="relative group shrink-0 -mt-16 sm:-mt-20">
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background shadow-xl">
                <AvatarImage src={avatarPreview || displayAvatar || undefined} alt={displayProfile?.full_name || ''} className="object-cover" />
                <AvatarFallback className="bg-primary/20 text-primary text-3xl sm:text-4xl font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>

              {!isViewOnly && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {avatarPreview ? (
                    <div className="absolute -bottom-2 ltr:-right-2 rtl:-left-2 flex gap-1 z-10">
                      <Button
                        size="icon"
                        className="h-8 w-8 rounded-full shadow-lg bg-green-500 hover:bg-green-600 text-white"
                        onClick={handleSaveAvatar}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8 rounded-full shadow-lg"
                        onClick={handleCancelAvatar}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-1 ltr:right-1 rtl:left-1 h-9 w-9 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      title={isRTL ? "تغيير الصورة" : "Change Picture"}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 text-center sm:text-start space-y-3 mb-2 pt-2 sm:pt-4 min-w-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-2 sm:gap-3 justify-center sm:justify-start">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {isRTL ? (displayProfile?.full_name_ar || displayProfile?.full_name) : displayProfile?.full_name}
                </h1>
                <div className="flex items-center gap-2 sm:mb-1">
                  <LevelBadge level={userLevel || 'under_follow_up'} />
                  {isAshbal && (
                    <span className="inline-flex items-center rounded-full border border-blue-200 px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700">
                      {isRTL ? 'شبل' : 'Ashbal'}
                    </span>
                  )}
                </div>
              </div>

              {/* Subtitle with Committee & Branch badges */}
              {(displayProfile?.committee || displayProfile?.branch) && (
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start text-xs font-medium">
                  {displayProfile.committee && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                      <Users className="h-3.5 w-3.5" />
                      {isRTL 
                        ? (displayProfile.committee.name_ar || displayProfile.committee.name) 
                        : displayProfile.committee.name}
                    </span>
                  )}
                  {displayProfile.branch && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground border border-muted">
                      <MapPin className="h-3.5 w-3.5" />
                      {isRTL 
                        ? (displayProfile.branch.name_ar || displayProfile.branch.name) 
                        : displayProfile.branch.name}
                    </span>
                  )}
                </div>
              )}

              {/* Personal Info Grid */}
              <div className="flex flex-col items-start gap-y-2 text-sm text-muted-foreground pt-1 w-fit mx-auto sm:mx-0 rtl:-translate-x-3 sm:rtl:translate-x-0">
                {/* Email */}
                <span className="flex items-center gap-2 justify-start transition-colors hover:text-foreground group/email">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                  <span className="truncate">{displayProfile?.email}</span>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover/email:opacity-100 focus:opacity-100"
                    title={isRTL ? 'نسخ' : 'Copy'}
                  >
                    {copiedEmail ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </span>

                {/* Phone */}
                {displayProfile?.phone && (
                  <div className="flex items-center gap-2 justify-start transition-colors hover:text-foreground group/phone whitespace-nowrap min-w-0 max-w-full">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                    <span dir="ltr" className="select-all font-mono text-sm tracking-wide whitespace-nowrap">
                      {displayProfile.phone}
                    </span>
                    <div className="flex items-center gap-1 opacity-60 group-hover/phone:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => {
                          if (displayProfile?.phone) {
                            navigator.clipboard.writeText(displayProfile.phone);
                            toast.success(isRTL ? 'تم نسخ رقم الهاتف' : 'Phone number copied');
                          }
                        }}
                        className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title={isRTL ? 'نسخ الرقم' : 'Copy number'}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={(() => {
                          const clean = displayProfile.phone.replace(/[^0-9]/g, '');
                          const num = clean.startsWith('0') ? '2' + clean : clean;
                          return `https://wa.me/${num}`;
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-md hover:bg-green-500/10 hover:text-green-500 transition-colors text-muted-foreground hover:text-green-500"
                        title={isRTL ? 'إرسال واتساب' : 'Send WhatsApp'}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Dates Row (Join Date & Birth Date) */}
              <div className="flex flex-row gap-1.5 justify-center sm:justify-start w-full pt-1.5 flex-nowrap overflow-x-auto no-scrollbar">
                {/* Join Date */}
                <div className="bg-muted/40 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-muted-foreground/10 flex items-center gap-1.5 text-xs text-muted-foreground shadow-sm shrink-0 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                  <span>
                    {isRTL ? 'انضم:' : 'Joined:'} {formatDate(displayProfile?.join_date || new Date().toISOString())}
                  </span>
                </div>

                {/* Birth Date */}
                {displayProfile?.birth_date && (
                  <div className="bg-muted/40 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-muted-foreground/10 flex items-center gap-1.5 text-xs text-muted-foreground shadow-sm shrink-0 whitespace-nowrap">
                    <Cake className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                    <span>
                      {isRTL ? 'ميلاد:' : 'Born:'} {formatDate(displayProfile.birth_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 3-Card Stats Block */}
            <div className="flex gap-2 sm:gap-3 items-center shrink-0 w-full sm:w-auto justify-center sm:justify-end mt-2 sm:mt-0 pt-2 sm:pt-4 flex-wrap sm:flex-nowrap">
              {/* Monthly Impact */}
              <div className="flex flex-col items-center bg-muted/30 p-2 sm:p-2.5 rounded-xl min-w-[85px] sm:min-w-[95px] border">
                <span className="text-lg sm:text-xl font-bold text-primary">{points}</span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center leading-tight">
                  {isRTL ? 'أثر هذا الشهر' : 'Monthly Impact'}
                </span>
              </div>
              {/* Total Impact */}
              <div className="flex flex-col items-center bg-primary/5 p-2 sm:p-2.5 rounded-xl min-w-[85px] sm:min-w-[95px] border border-primary/10">
                <span className="text-lg sm:text-xl font-bold text-primary">{displayProfile?.total_points || 0}</span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center leading-tight">
                  {isRTL ? 'الأثر الكلي' : 'Total Impact'}
                </span>
              </div>
              {/* Monthly Participations */}
              <div className="flex flex-col items-center bg-muted/30 p-2 sm:p-2.5 rounded-xl min-w-[85px] sm:min-w-[95px] border">
                <span className="text-lg sm:text-xl font-bold text-primary">{currentMonthActivities.length}</span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center leading-tight">
                  {isRTL ? 'مشاركات الشهر' : 'Monthly Participations'}
                </span>
              </div>
            </div>
          </div>

          {/* Camp Attendance Badges */}
          {(() => {
            const level = displayProfile?.level || 'under_follow_up';
            const showMiniCamp = level === 'under_follow_up';
            const showCamp = displayProfile?.role === 'committee_leader';

            if (!showMiniCamp && !showCamp) return null;

            const attended = showMiniCamp ? displayProfile?.attended_mini_camp : displayProfile?.attended_camp;
            const label = isRTL
              ? (showMiniCamp ? 'الميني كامب' : 'الكامب')
              : (showMiniCamp ? 'Mini Camp' : 'Camp');

            return (
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-4 border-t mt-2">
                <div className="text-sm font-medium text-muted-foreground">{isRTL ? 'حالة الحضور:' : 'Attendance Status:'}</div>
                {attended ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                    <Check className="h-4 w-4" />
                    {isRTL ? `حضر ${label}` : `Attended ${label}`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-secondary text-secondary-foreground">
                    <X className="h-4 w-4 text-muted-foreground" />
                    {isRTL ? `لم يحضر ${label}` : `Did Not Attend ${label}`}
                  </span>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>



      <Tabs defaultValue="activities" className="space-y-4 px-3 sm:px-0" dir={isRTL ? 'rtl' : 'ltr'}>
        <TabsList className="w-full flex overflow-x-auto no-scrollbar rounded-xl">
          <TabsTrigger value="activities" className="flex-1 min-w-fit text-xs sm:text-sm">{t('profile.activityHistory')}</TabsTrigger>
          <TabsTrigger value="badges" className="flex-1 min-w-fit text-xs sm:text-sm">
            {t('profile.badges')} ({badges.length})
          </TabsTrigger>
          <TabsTrigger value="feedbacks" className="flex-1 min-w-fit text-xs sm:text-sm">
            {isRTL ? 'الآراء' : 'Feedbacks'} ({feedbacks.length})
          </TabsTrigger>
          <TabsTrigger value="fines" className="flex-1 min-w-fit text-xs sm:text-sm">
            {isRTL ? 'الغرامات' : 'Fines'} ({fines.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className={cn(isRTL && "text-right")}>{t('profile.activityHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : activities.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {isRTL ? 'لا توجد أنشطة بعد. ابدأ بتسجيل مساهماتك!' : 'No activities yet. Start logging your contributions!'}
                </p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between rounded-xl border bg-card p-3 sm:p-4 transition-all hover:bg-muted/30 hover:shadow-sm gap-3"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        {activity.proof_url && (
                          <ProofImagePreview
                            proofUrl={activity.proof_url}
                            alt="Proof"
                            className="shrink-0 group relative overflow-hidden rounded-md border"
                            imgClassName="w-12 h-12 sm:w-16 sm:h-16 object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        )}
                        <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                          <p className="font-semibold truncate text-sm sm:text-base">{activity.activity_name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-muted-foreground">
                            <span className="inline-flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded text-[11px] sm:text-xs">
                              {activity.committee_name}
                            </span>
                            <span className="text-[11px] sm:text-xs">•</span>
                            <span className="text-[11px] sm:text-xs">{formatDate(activity.submitted_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ltr:pl-3 ltr:border-l ltr:ml-1 rtl:pr-3 rtl:border-r rtl:mr-1 sm:ltr:pl-4 sm:rtl:pr-4">
                        <div className={cn("flex flex-col", isRTL ? "items-start" : "items-end")}>
                          <span className="text-base sm:text-lg font-bold text-success">+{activity.points}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{isRTL ? 'أثر' : 'Impact'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{t('profile.badges')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : badges.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {isRTL ? 'لم تحصل على شارات بعد. استمر في التطوع!' : 'No badges yet. Keep volunteering!'}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {badges.map((userBadge) => {
                    return (
                      <div
                        key={userBadge.id}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card transition-all hover:bg-muted/50 text-center gap-3"
                      >
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: userBadge.badge.color + '20', color: userBadge.badge.color }}
                        >
                          {getBadgeIcon(userBadge.badge.icon)}
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-sm">{isRTL ? userBadge.badge.name_ar : userBadge.badge.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(userBadge.earned_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedbacks">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex flex-col space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {isRTL ? 'آراء القادة' : 'Leaders Feedback'}
                </CardTitle>
                <CardDescription>
                </CardDescription>
              </div>

              {isViewOnly && (hasRole('admin') || hasRole('head_hr') || hasRole('hr') || hasRole('committee_leader') || hasRole('supervisor') || hasRole('head_caravans') || hasRole('head_events') || hasRole('head_ethics') || hasRole('head_quran') || hasRole('head_production') || hasRole('head_fourth_year')) && (
                <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1">
                      <Plus className="h-4 w-4" />
                      {isRTL ? 'إضافة Feedback' : 'Add Feedback'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{isRTL ? 'إضافة رأي جديد' : 'Add New Feedback'}</DialogTitle>
                      <DialogDescription>
                        {isRTL ? 'أكتب رأيك أو تقييمك لهذا المتطوع. سيظهر هذا في ملفه الشخصي.' : 'Write your feedback or evaluation for this volunteer. This will appear on their profile.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Textarea
                        value={newFeedback}
                        onChange={(e) => setNewFeedback(e.target.value)}
                        placeholder={isRTL ? 'اكتب تعليقك هنا...' : 'Write your feedback here...'}
                        className="min-h-[100px]"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)} disabled={submittingFeedback}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!newFeedback.trim() || !targetUserId || !user) return;
                          setSubmittingFeedback(true);
                          try {
                            const { error } = await supabase
                              .from('volunteer_feedbacks')
                              .insert({
                                volunteer_id: targetUserId,
                                author_id: user.id,
                                content: newFeedback.trim()
                              });

                            if (error) throw error;

                            toast.success(isRTL ? 'تم إضافة الرأ بنجاح' : 'Feedback added successfully');
                            setNewFeedback('');
                            setIsFeedbackDialogOpen(false);
                            fetchData();
                          } catch (error) {
                            console.error('Error adding feedback:', error);
                            toast.error(isRTL ? 'حدث خطأ أثناء إضافة الرأي' : 'Error adding feedback');
                          } finally {
                            setSubmittingFeedback(false);
                          }
                        }}
                        disabled={!newFeedback.trim() || submittingFeedback}
                      >
                        {submittingFeedback && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                        {isRTL ? 'نشر' : 'Post'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : feedbacks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {isRTL ? 'لا توجد آراء بعد.' : 'No feedback yet.'}
                </p>
              ) : (
                <div className="space-y-4 pt-4">
                  {feedbacks.map((feedback) => (
                    <div
                      key={feedback.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={feedback.author?.avatar_url || undefined} />
                          <AvatarFallback>
                            {feedback.author?.full_name?.substring(0, 2).toUpperCase() || '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{feedback.author?.full_name || (isRTL ? 'مستخدم غير معروف' : 'Unknown User')}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(feedback.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        {editFeedbackId === feedback.id ? (
                          <div className="space-y-2 mt-1">
                            <Textarea
                              value={editFeedbackContent}
                              onChange={(e) => setEditFeedbackContent(e.target.value)}
                              className="min-h-[80px]"
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditFeedbackId(null)}>
                                {isRTL ? 'إلغاء' : 'Cancel'}
                              </Button>
                              <Button size="sm" onClick={() => handleSaveFeedback(feedback.id)}>
                                {isRTL ? 'حفظ' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="group/feedback relative">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {feedback.content}
                            </p>
                            {user?.id === feedback.author_id && (
                              <div className="absolute top-0 ltr:right-0 rtl:left-0 opacity-0 group-hover/feedback:opacity-100 transition-opacity flex gap-1 -mt-8 ltr:mr-2 rtl:ml-2 bg-background/80 rounded-md shadow-sm border p-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditFeedbackId(feedback.id);
                                    setEditFeedbackContent(feedback.content);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteFeedback(feedback.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fines">
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    {isRTL ? 'سجل الغرامات' : 'Fines History'}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-destructive">
                    {fines.length} {isRTL ? 'غرامة' : 'Fines'}
                  </div>

                  {isViewOnly && (
                    hasRole('admin') ||
                    hasRole('head_hr') ||
                    hasRole('hr') ||
                    (hasRole('committee_leader') && authProfile?.committee_id === displayProfile?.committee_id)
                  ) && (
                      <Dialog open={isFineDialogOpen} onOpenChange={setIsFineDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="gap-1">
                            <Plus className="h-4 w-4" />
                            {isRTL ? 'إضافة غرامة' : 'Add Fine'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{isRTL ? 'إضافة غرامة يدوية' : 'Add Manual Fine'}</DialogTitle>
                            <DialogDescription>
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>{isRTL ? 'نوع الغرامة/المخالفة' : 'Violation Type'}</Label>
                              <Select value={selectedFineType} onValueChange={(val) => {
                                setSelectedFineType(val);
                              }}>
                                <SelectTrigger>
                                  <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {fineTypes.map(type => (
                                    <SelectItem key={type.id} value={type.id}>
                                      {isRTL ? type.name_ar : type.name} ({type.amount} {isRTL ? 'ج.م' : 'EGP'})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Removed manual amount input, it's determined by type now */}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsFineDialogOpen(false)} disabled={submittingFine}>
                              {isRTL ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleAddFine}
                              disabled={!selectedFineType || submittingFine}
                            >
                              {submittingFine && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                              {isRTL ? 'إضافة الغرامة' : 'Add Fine'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : fines.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {isRTL ? 'سجل نظيف! لا توجد غرامات.' : 'Clean record! No fines.'}
                </p>
              ) : (
                <div className="space-y-4 pt-4">
                  {/* All Fines from View */}
                  {fines.map((fine, index) => (
                    <div
                      key={`fine-${fine.source_id || index}`}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-4 transition-colors",
                        fine.is_paid
                          ? "bg-muted/20 border-muted opacity-75"
                          : "bg-destructive/5 border-destructive/20"
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <span className={cn("font-semibold", fine.is_paid && "line-through text-muted-foreground")}>
                          {fine.source_type === 'manual'
                            ? (isRTL ? (fine.source_name_ar || fine.source_name) : fine.source_name)
                            : (isRTL ? 'عدم ارتداء الـ Vest' : 'No Vest Penalty')
                          }
                        </span>
                        {fine.source_type !== 'manual' && (
                          <span className="text-sm text-muted-foreground">
                            {isRTL
                              ? `في: ${fine.source_name_ar || fine.source_name}`
                              : `At: ${fine.source_name}`}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(fine.created_at)}
                        </span>
                        {/* Show who added the fine for manual fines */}
                        {fine.source_type === 'manual' && (fine.reviewed_by_name || fine.reviewed_by_name_ar) && (
                          <span className="text-xs text-muted-foreground">
                            {isRTL
                              ? `أضافها: ${fine.reviewed_by_name_ar || fine.reviewed_by_name}`
                              : `Added by: ${fine.reviewed_by_name}`}
                          </span>
                        )}
                        {fine.is_paid && (
                          <span className="inline-flex w-fit items-center text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 mt-1">
                            <Check className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                            {isRTL ? 'معفي / مدفوع' : 'Waived / Paid'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-destructive">
                          -{fine.amount} {isRTL ? 'ج.م' : 'EGP'}
                        </div>


                        {/* Delete Fine Button - for all fine types */}
                        {(
                          hasRole('admin') ||
                          hasRole('supervisor') ||
                          hasRole('head_hr') ||
                          hasRole('hr') ||
                          (hasRole('committee_leader') && authProfile?.committee_id === displayProfile?.committee_id) ||
                          hasRole('head_caravans') ||
                          hasRole('head_events') ||
                          hasRole('head_ethics') ||
                          hasRole('head_quran') ||
                          hasRole('head_ashbal') ||
                          hasRole('head_production') ||
                          hasRole('head_fourth_year')
                        ) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteFine(fine.source_id, fine.source_type)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'هل أنت متأكد؟' : 'Are you sure?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'fine'
                ? (isRTL ? 'هل أنت متأكد من حذف هذه الغرامة؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this fine? This action cannot be undone.')
                : (isRTL ? 'هل أنت متأكد من حذف هذا الرأي؟' : 'Are you sure you want to delete this feedback?')
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showUnauthorizedDialog} onOpenChange={setShowUnauthorizedDialog}>
        <DialogContent className="sm:max-w-md flex flex-col items-center justify-center gap-6 py-12 px-6 border-2 border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl md:text-3xl font-bold text-center text-primary leading-relaxed">
              الي حط الغرامة هو الي يشيلها
            </DialogTitle>
            <DialogDescription className="sr-only">
              Unauthorized deletion attempt
            </DialogDescription>
          </DialogHeader>
          <div className="text-[10rem] leading-none select-none animate-bounce">
            😝
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
