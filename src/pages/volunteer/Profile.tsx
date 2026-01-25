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
import { Calendar, Mail, Award, Loader2, Camera, Upload, Check, X, MessageSquare, Plus, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  source_name: string;
  source_name_ar: string;
  created_at: string;
  amount: number;
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
  const [feedbacks, setFeedbacks] = useState<VolunteerFeedback[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [newFeedback, setNewFeedback] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [monthlyPoints, setMonthlyPoints] = useState(0);

  // If userId is provided and different from current user, we are in view-only mode
  const isViewOnly = userId && userId !== user?.id;
  const targetUserId = userId || user?.id;

  const [viewedProfile, setViewedProfile] = useState<any>(null);
  const [viewedAvatarUrl, setViewedAvatarUrl] = useState<string | null>(null);

  // Use either the fetched profile (for view mode) or auth profile (for own profile)
  const displayProfile = isViewOnly ? viewedProfile : authProfile;
  const displayAvatar = isViewOnly ? viewedAvatarUrl : (authProfile?.avatar_url || null);

  // Show monthly points if viewing own profile, otherwise total
  const points = (!isViewOnly) ? monthlyPoints : (displayProfile?.total_points || 0);

  // Level progress is now manual, so we don't calculate it from points
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

        const { data: monthlyData } = await supabase
          .from('activity_submissions')
          .select('points_awarded')
          .eq('volunteer_id', targetUserId)
          .eq('status', 'approved')
          .gte('submitted_at', startOfMonth);

        const mPoints = monthlyData?.reduce((sum, item) => sum + (item.points_awarded || 0), 0) || 0;
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
        .select('id, points_awarded, status, submitted_at, proof_url, activity:activity_types(name, name_ar), committee:committees(name, name_ar)')
        .eq('volunteer_id', targetUserId)
        .order('submitted_at', { ascending: false });

      const feedbacksQuery = supabase
        .from('volunteer_feedbacks')
        .select('id, content, created_at, author:profiles!volunteer_feedbacks_author_id_fkey(full_name, avatar_url)')
        .eq('volunteer_id', targetUserId)
        .order('created_at', { ascending: false });

      const finesQuery = supabase
        .from('volunteer_fines_view')
        .select('*')
        .eq('volunteer_id', targetUserId)
        .order('created_at', { ascending: false });

      const [badgesRes, activitiesRes, feedbacksRes, finesRes]: [any, any, any, any] = await Promise.all([
        badgesQuery,
        activitiesQuery,
        feedbacksQuery,
        finesQuery,
      ]);

      if (badgesRes.data) {
        setBadges(badgesRes.data.map((b: any) => ({
          id: b.id,
          earned_at: b.earned_at,
          badge: b.badge,
        })));
      }

      if (activitiesRes.data) {
        setActivities(activitiesRes.data.map((a: any) => ({
          id: a.id,
          activity_name: isRTL ? (a.activity?.name_ar || a.activity?.name) : a.activity?.name,
          committee_name: isRTL ? (a.committee?.name_ar || a.committee?.name) : a.committee?.name,
          points: a.points_awarded || 0,
          status: a.status,
          submitted_at: a.submitted_at,
          proof_url: a.proof_url,
        })));
      }

      if (feedbacksRes.data) {
        setFeedbacks(feedbacksRes.data.map((f: any) => ({
          id: f.id,
          content: f.content,
          created_at: f.created_at,
          author: f.author,
        })));
      }

      if (finesRes.data) {
        setFines(finesRes.data.map((f: any) => ({
          source_type: f.source_type,
          source_name: f.source_name,
          source_name_ar: f.source_name_ar,
          created_at: f.created_at,
          amount: f.amount,
        })));
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    let processedFile = file;
    if (file.size > 2 * 1024 * 1024) {
      toast.info(isRTL ? 'جاري ضغط الصورة لتناسب الحجم المسموح...' : 'Compressing image to fit size limit...');
      try {
        processedFile = await compressImage(file);
      } catch (error) {
        console.error('Compression error:', error);
        toast.error(isRTL ? 'فشل ضغط الصورة' : 'Failed to compress image');
        return;
      }
    }

    setUploading(true);
    try {
      const fileExt = processedFile.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`]);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, processedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success(isRTL ? 'تم تحديث الصورة الشخصية' : 'Profile picture updated');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(isRTL ? 'فشل في تحميل الصورة' : 'Failed to upload image');
    } finally {
      setUploading(false);
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

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24">
                <AvatarImage src={displayAvatar || undefined} alt={displayProfile?.full_name || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!isViewOnly && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                <h1 className="text-2xl font-bold">
                  {isRTL ? (displayProfile?.full_name_ar || displayProfile?.full_name) : displayProfile?.full_name}
                </h1>
                <LevelBadge level={displayProfile?.level || 'under_follow_up'} />
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {displayProfile?.email}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t('profile.memberSince')} {formatDate(displayProfile?.join_date || new Date().toISOString())}
                </span>
              </div>
            </div>

            {/* Camp Attendance Section */}
            {(() => {
              const level = displayProfile?.level || 'under_follow_up';
              const showMiniCamp = level === 'under_follow_up';
              // Check role from profiles table (which includes role fallback logic via fetch if needed, 
              // but here displayProfile comes from profiles table directly). 
              // displayProfile.role is a string (e.g. 'committee_leader').
              const showCamp = displayProfile?.role === 'committee_leader';

              if (!showMiniCamp && !showCamp) return null;

              return (
                <div className="flex flex-col items-center justify-center gap-2 py-2 border-t border-b w-full my-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
                      (showMiniCamp ? displayProfile?.attended_mini_camp : displayProfile?.attended_camp)
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {(showMiniCamp ? displayProfile?.attended_mini_camp : displayProfile?.attended_camp) ? (
                        <>
                          <Check className="h-4 w-4" />
                          {isRTL ? (showMiniCamp ? 'حضر الميني كامب' : 'حضر الكامب') : (showMiniCamp ? 'Attended Mini Camp' : 'Attended Camp')}
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          {isRTL ? (showMiniCamp ? 'لم يحضر الميني كامب' : 'لم يحضر الكامب') : (showMiniCamp ? 'Did not attend Mini Camp' : 'Did not attend Camp')}
                        </>
                      )
                      }
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-6 text-center">
              <div>
                <div className="text-4xl font-bold text-primary">{points}</div>
                <div className="text-sm text-muted-foreground">{!isViewOnly ? (isRTL ? 'أثر هذا الشهر' : 'Monthly Impact') : (isRTL ? 'إجمالي الأثر' : 'Total Impact')}</div>
              </div>
              <div className="border-r"></div>
              <div>
                <div className="text-4xl font-bold text-primary">{activities.filter(a => a.status === 'approved').length}</div>
                <div className="text-sm text-muted-foreground">{isRTL ? 'عدد المشاركات' : 'Participations'}</div>
              </div>
            </div>
          </div>
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
            {isRTL ? 'الغرامات' : 'Fines'} ({fines.reduce((sum, f) => sum + f.amount, 0)})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.activityHistory')}</CardTitle>
              <CardDescription>
                {isRTL ? 'جميع الأنشطة المقدمة وحالتها' : 'All your submitted activities and their status'}
              </CardDescription>
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
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {activity.proof_url && (
                          <a href={activity.proof_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={activity.proof_url}
                              alt="Proof"
                              className="w-12 h-12 rounded object-cover shrink-0 hover:opacity-80 transition-opacity"
                            />
                          </a>
                        )}
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-medium truncate">{activity.activity_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.committee_name} • {formatDate(activity.submitted_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium">+{activity.points}</span>
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
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {feedback.content}
                      </p>
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
                  <CardDescription>
                    {isRTL ? 'سجل الغرامات التلقائية لعدم ارتداء الـ Vest' : 'Automatic fines history for not wearing Vest'}
                  </CardDescription>
                </div>
                <div className="text-2xl font-bold text-destructive">
                  {fines.reduce((sum, f) => sum + f.amount, 0)} {isRTL ? 'ج.م' : 'EGP'}
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
                  {fines.map((fine, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-4 bg-destructive/5 border-destructive/20"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">
                          {isRTL ? 'عدم ارتداء الـ Vest' : 'No Vest Penalty'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {isRTL
                            ? `في: ${fine.source_name_ar || fine.source_name}`
                            : `In: ${fine.source_name}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(fine.created_at)}
                        </span>
                      </div>
                      <div className="font-bold text-destructive">
                        -{fine.amount} {isRTL ? 'ج.م' : 'EGP'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
