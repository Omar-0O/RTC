import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { LevelBadge, getLevelProgress } from '@/components/ui/level-badge';
import { Calendar, Mail, Award, Loader2, Camera, Upload, Check, X, MessageSquare, Plus, AlertCircle, Pencil, Trash2 } from 'lucide-react';
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

type UserBadge = {
  id: string;
  earned_at: string;
  badge: {
    id: string;
    name: string;
    name_ar: string;
    description: string | null;
    description_ar: string | null;
    icon: string;
    color: string;
  };
};

type ActivitySubmission = {
  id: string;
  activity_name: string;
  committee_name: string;
  points: number;
  status: string;
  submitted_at: string;
  proof_url: string | null;
  is_paid?: boolean; // Added is_paid
};


type VolunteerFeedback = {
  id: string;
  content: string;
  created_at: string;
  author: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

type Fine = {
  source_type: string;
  source_id: string;
  source_name: string;
  source_name_ar: string;
  created_at: string;
  amount: number;
  is_paid: boolean;
  reviewed_by_name: string | null;
  reviewed_by_name_ar: string | null;
};

interface ProfileProps {
  userId?: string;
  onEdit?: () => void;
}

const compressImage = async (file: File): Promise<File> => {
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

        // Max dimension 1200px (good for avatars)
        const MAX_DIMENSION = 1200;
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
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
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.7
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

import { COVER_IMAGES } from '@/constants/profileCovers';

const getDefaultCover = (uid: string) => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COVER_IMAGES.length;
  return COVER_IMAGES[index];
};

export default function Profile({ userId: propUserId }: ProfileProps) {
  const { id: paramUserId } = useParams();
  const userId = propUserId || paramUserId;

  const { user, profile: authProfile, refreshProfile, hasRole } = useAuth();

  const { t, isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [activities, setActivities] = useState<ActivitySubmission[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [manualFines, setManualFines] = useState<ActivitySubmission[]>([]);
  const [activityTypes, setActivityTypes] = useState<{ id: string; name: string; name_ar: string }[]>([]);
  const [fineTypes, setFineTypes] = useState<{ id: string; name: string; name_ar: string; amount: number }[]>([]);

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

  const [monthlyPoints, setMonthlyPoints] = useState(0);

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

  const [viewedProfile, setViewedProfile] = useState<any>(null);
  const [viewedAvatarUrl, setViewedAvatarUrl] = useState<string | null>(null);

  // Use either the fetched profile (for view mode) or auth profile (for own profile)
  const displayProfile = isViewOnly ? viewedProfile : authProfile;
  const displayAvatar = isViewOnly ? viewedAvatarUrl : (authProfile?.avatar_url || null);
  const displayCover = isViewOnly ? viewedProfile?.cover_url : authProfile?.cover_url;
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

  // Calculate total impact (positive points only) from activities if available, falling back to profile total_points (which might be net)
  // Ideally, we should recalculate this from all activities to be accurate "Impact"
  const totalImpact = activities.reduce((sum, a) => sum + Math.max(0, a.points), 0);

  // Show monthly points if viewing own profile, otherwise total impact
  const points = (!isViewOnly) ? monthlyPoints : totalImpact;

  // Level progress is now manual, so we don't calculate it from points
  const userLevel = displayProfile?.level;
  const userInitials = displayProfile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  useEffect(() => {
    if (targetUserId) {
      fetchData();
    }
  }, [targetUserId]);

  useEffect(() => {
    if (!isViewOnly) {
      setViewedAvatarUrl(authProfile?.avatar_url || null);
      refreshProfile();
    }
  }, [authProfile?.avatar_url, isViewOnly, refreshProfile]);

  const fetchData = async () => {
    if (!targetUserId) return;
    setLoading(true);
    setLoading(true);
    try {
      // If viewing another user, fetch their profile first
      if (isViewOnly) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .single();

        if (profileData) {
          setViewedProfile(profileData);
          setViewedAvatarUrl(profileData.avatar_url);
        }
      }

      // If viewing own profile, calculate monthly points
      if (!isViewOnly) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data: monthlyData, error: monthlyError } = await supabase
          .from('activity_submissions')
          .select('points_awarded')
          .eq('volunteer_id', targetUserId)
          .is('fine_type_id', null) // Exclude fines
          .gte('submitted_at', startOfMonth);

        if (monthlyError) {
          console.error('Error fetching monthly points:', monthlyError);
        }

        const mPoints = monthlyData?.reduce((sum, item) => sum + Math.max(0, item.points_awarded || 0), 0) || 0;
        console.log('Monthly points calculated:', mPoints, 'from', monthlyData?.length, 'activities');
        setMonthlyPoints(mPoints);
      }

      // Fetch badges and activities in parallel
      // Explicitly type to avoid deep type instantiation errors
      const badgesQuery = supabase
        .from('user_badges')
        .select('id, earned_at, badge:badges(id, name, name_ar, description, description_ar, icon, color)')
        .eq('user_id', targetUserId)
        .order('earned_at', { ascending: false });

      const activitiesQuery = supabase
        .from('activity_submissions')
        .select('id, points_awarded, status, submitted_at, proof_url, is_paid, fine_type_id, activity:activity_types(name, name_ar), committee:committees(name, name_ar)')
        .eq('volunteer_id', targetUserId)
        .is('fine_type_id', null) // Exclude fines from activities
        .order('submitted_at', { ascending: false });

      const feedbacksQuery = supabase
        .from('volunteer_feedbacks')
        .select('id, content, created_at, author_id, author:profiles!volunteer_feedbacks_author_id_fkey(full_name, avatar_url)')
        .eq('volunteer_id', targetUserId)
        .order('created_at', { ascending: false });

      const finesQuery = supabase
        .from('volunteer_fines_view')
        .select('*')
        .eq('volunteer_id', targetUserId)
        .eq('source_type', 'manual')
        .order('created_at', { ascending: false });

      const [badgesRes, activitiesRes, feedbacksRes, finesRes, typesRes, fineTypesRes]: [any, any, any, any, any, any] = await Promise.all([
        badgesQuery,
        activitiesQuery,
        feedbacksQuery,
        finesQuery,
        supabase.from('activity_types').select('id, name, name_ar').order('name'),
        supabase.from('fine_types').select('id, name, name_ar, amount').order('name'),
      ]);

      if (badgesRes.data) {
        setBadges(badgesRes.data.map((b: any) => ({
          id: b.id,
          earned_at: b.earned_at,
          badge: b.badge,
        })));
      }

      if (activitiesRes.data) {
        console.log('Activities fetched:', activitiesRes.data.length, 'Total points:', activitiesRes.data.reduce((sum: number, a: any) => sum + (a.points_awarded || 0), 0));
        // Since the query already filters out fines, we can directly set activities
        setActivities(activitiesRes.data.map((a: any) => ({
          id: a.id,
          activity_name: isRTL ? (a.activity?.name_ar || a.activity?.name) : a.activity?.name,
          committee_name: isRTL ? (a.committee?.name_ar || a.committee?.name) : a.committee?.name,
          points: a.points_awarded || 0,
          status: a.status,
          submitted_at: a.submitted_at,
          proof_url: a.proof_url,
          is_paid: a.is_paid,
        })));
        // Note: manualFines is no longer used - all fines come from the View
      } else if (activitiesRes.error) {
        console.error('Error fetching activities:', activitiesRes.error);
      }

      if (typesRes.data) {
        setActivityTypes(typesRes.data);
      }

      // The 6th element in Promise.all result is fineTypes (index 5)
      if (fineTypesRes.data) {
        setFineTypes(fineTypesRes.data);
      }


      if (feedbacksRes.data) {
        setFeedbacks(feedbacksRes.data.map((f: any) => ({
          id: f.id,
          content: f.content,
          created_at: f.created_at,
          author: f.author,
          author_id: f.author_id,
        })));
      }

      if (finesRes.data) {
        setFines(finesRes.data.map((f: any) => ({
          source_type: f.source_type,
          source_id: f.source_id,
          source_name: f.source_name,
          source_name_ar: f.source_name_ar,
          created_at: f.created_at,
          amount: f.amount,
          is_paid: f.is_paid || false,
          reviewed_by_name: f.reviewed_by_name,
          reviewed_by_name_ar: f.reviewed_by_name_ar,
        })));
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
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
    let processedFile = selectedFile;

    // Validate file size (max 2MB)
    if (selectedFile.size > 2 * 1024 * 1024) {
      toast.info(isRTL ? 'جاري ضغط الصورة لتناسب الحجم المسموح...' : 'Compressing image to fit size limit...');
      try {
        processedFile = await compressImage(selectedFile);
      } catch (error) {
        console.error('Compression error:', error);
        toast.error(isRTL ? 'فشل ضغط الصورة' : 'Failed to compress image');
        setUploading(false);
        return;
      }
    }

    try {
      let fileExt = processedFile.name.split('.').pop()?.toLowerCase();
      if (!fileExt || (processedFile.type === 'image/jpeg' && fileExt !== 'jpg' && fileExt !== 'jpeg')) {
        fileExt = 'jpg';
      }

      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists - comprehensive list
      const extensionsToRemove = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      const filesToRemove = extensionsToRemove.map(ext => `${user.id}/avatar.${ext}`);

      await supabase.storage.from('avatars').remove(filesToRemove);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, processedFile, { upsert: true, cacheControl: '3600' });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${data.publicUrl}?t=${new Date().getTime()}` })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Add a small delay to ensure DB propagation before refreshing
      setTimeout(async () => {
        await refreshProfile();
      }, 500);

      toast.success(isRTL ? 'تم تحديث الصورة الشخصية' : 'Profile picture updated');

      // Cleanup
      setAvatarPreview(null);
      setSelectedFile(null);
    } catch (error: any) {
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
        creatorId = data?.created_by || null;
      } else if (sourceType === 'activity') {
        const { data } = await supabase
          .from('activity_submissions')
          .select('reviewed_by')
          .eq('id', fineId)
          .single();
        creatorId = data?.reviewed_by || null;
      } else if (sourceType === 'caravan') {
        const { data } = await supabase
          .from('caravan_participants')
          .select('caravans(created_by)')
          .eq('id', fineId)
          .single();
        // @ts-ignore
        creatorId = data?.caravans?.created_by;
      } else if (sourceType === 'event') {
        const { data } = await supabase
          .from('event_participants')
          .select('events(created_by)')
          .eq('id', fineId)
          .single();
        // @ts-ignore
        creatorId = data?.events?.created_by;
      } else if (sourceType === 'ethics_call') {
        const { data } = await supabase
          .from('ethics_calls_participants')
          .select('ethics_calls(created_by)')
          .eq('id', fineId)
          .single();
        // @ts-ignore
        creatorId = data?.ethics_calls?.created_by;
      }

      // If we identified a creator and it's not the current user
      if (creatorId && creatorId !== user.id) {
        toast.error("الي حط الغرامة هو الي يشيلها 😝");
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



  // Get cover image - use saved cover or default based on user ID
  const coverImage = displayCover || getDefaultCover(targetUserId || 'default');

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Profile Header */}
      <Card className="overflow-hidden border-none shadow-md">
        <div className="h-48 relative group/cover">
          {/* Cover Image */}
          <img
            src={coverImage}
            alt="Cover"
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

          {/* Random Cover Button */}
          {(!isViewOnly || (hasRole('admin') || hasRole('head_hr') || hasRole('hr'))) && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-4 right-4 opacity-0 group-hover/cover:opacity-100 transition-opacity backdrop-blur-sm bg-secondary/80"
              onClick={handleRandomCover}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isRTL ? 'تغيير الغلاف' : 'Randomize Cover'}
            </Button>
          )}
        </div>
        <CardContent className="relative pt-0 px-6 pb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
            <div className="relative group shrink-0 -mt-20">
              <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                <AvatarImage src={avatarPreview || displayAvatar || undefined} alt={displayProfile?.full_name || ''} className="object-cover" />
                <AvatarFallback className="bg-primary/20 text-primary text-4xl font-bold">
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
                    <div className="absolute -bottom-2 -right-2 flex gap-1 z-10">
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
                      className="absolute bottom-1 right-1 h-9 w-9 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
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

            <div className="flex-1 text-center md:text-start space-y-2 mb-2 pt-4">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-3 justify-center md:justify-start">
                <h1 className="text-3xl font-bold tracking-tight">
                  {isRTL ? (displayProfile?.full_name_ar || displayProfile?.full_name) : displayProfile?.full_name}
                </h1>
                <div className="flex items-center gap-2 mb-1">
                  <LevelBadge level={userLevel || 'under_follow_up'} />
                  {isAshbal && (
                    <span className="inline-flex items-center rounded-full border border-blue-200 px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700">
                      {isRTL ? 'شبل' : 'Ashbal'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <Mail className="h-4 w-4" />
                  {displayProfile?.email}
                </span>
                <span className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <Calendar className="h-4 w-4" />
                  {isRTL ? 'ضمن العائلة من' : 'Family Member Since'} {formatDate(displayProfile?.join_date || new Date().toISOString())} 🤍😇
                </span>
              </div>
            </div>

            <div className="flex gap-4 items-center shrink-0 w-full md:w-auto justify-center md:justify-end mt-4 md:mt-0 pt-4">
              <div className="flex flex-col items-center bg-muted/30 p-3 rounded-xl min-w-[100px] border">
                <span className="text-2xl font-bold text-primary">{points}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {!isViewOnly ? (isRTL ? 'أثر هذا الشهر' : 'Monthly Impact') : (isRTL ? 'إجمالي الأثر' : 'Total Impact')}
                </span>
              </div>
              <div className="flex flex-col items-center bg-muted/30 p-3 rounded-xl min-w-[100px] border">
                <span className="text-2xl font-bold text-primary">{activities.length}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {isRTL ? 'مشاركات' : 'Participations'}
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
              <div className="flex items-center gap-4 pt-4 border-t mt-2">
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



      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activities">{t('profile.activityHistory')}</TabsTrigger>
          <TabsTrigger value="badges">
            {t('profile.badges')} ({badges.length})
          </TabsTrigger>
          <TabsTrigger value="feedbacks">
            {isRTL ? 'الآراء والتقييمات' : 'Feedbacks'} ({feedbacks.length})
          </TabsTrigger>
          <TabsTrigger value="fines">
            {isRTL ? 'الغرامات' : 'Fines'} ({fines.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.activityHistory')}</CardTitle>
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
                      className="flex items-center justify-between rounded-xl border bg-card p-4 transition-all hover:bg-muted/30 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {activity.proof_url && (
                          <a href={activity.proof_url} target="_blank" rel="noopener noreferrer" className="shrink-0 group relative overflow-hidden rounded-md border">
                            <img
                              src={activity.proof_url}
                              alt="Proof"
                              className="w-16 h-16 object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-xs font-medium">View</span>
                            </div>
                          </a>
                        )}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate text-base">{activity.activity_name}</p>
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded text-xs">
                              {activity.committee_name}
                            </span>
                            <span>•</span>
                            <span>{formatDate(activity.submitted_at)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 pl-4 border-l ml-2">
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-bold text-success">+{activity.points}</span>
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

        <TabsContent value="feedbacks">
          <Card>
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
                        {submittingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                              <div className="absolute top-0 right-0 opacity-0 group-hover/feedback:opacity-100 transition-opacity flex gap-1 -mt-8 mr-2 bg-background/80 rounded-md shadow-sm border p-1">
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
          <Card>
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
                              {submittingFine && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                            <Check className="h-3 w-3 mr-1" />
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
    </div >
  );
}
