import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { LevelBadge, getLevelProgress } from '@/components/ui/level-badge';
import { Calendar, Mail, Award, Loader2, Camera, Upload } from 'lucide-react';
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

interface ProfileProps {
  userId?: string;
  onEdit?: () => void;
}

export default function Profile({ userId }: ProfileProps) {
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const { t, isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [activities, setActivities] = useState<ActivitySubmission[]>([]);

  // If userId is provided and different from current user, we are in view-only mode
  const isViewOnly = userId && userId !== user?.id;
  const targetUserId = userId || user?.id;

  const [viewedProfile, setViewedProfile] = useState<any>(null);
  const [viewedAvatarUrl, setViewedAvatarUrl] = useState<string | null>(null);

  // Use either the fetched profile (for view mode) or auth profile (for own profile)
  const displayProfile = isViewOnly ? viewedProfile : authProfile;
  const displayAvatar = isViewOnly ? viewedAvatarUrl : (authProfile?.avatar_url || null);

  const points = displayProfile?.total_points || 0;
  const { progress, nextThreshold } = getLevelProgress(points);
  const userInitials = displayProfile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  useEffect(() => {
    if (targetUserId) {
      fetchData();
    }
  }, [targetUserId]);

  useEffect(() => {
    if (!isViewOnly) {
      setViewedAvatarUrl(authProfile?.avatar_url || null);
    }
  }, [authProfile?.avatar_url, isViewOnly]);

  const fetchData = async () => {
    if (!targetUserId) return;
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

      const [badgesRes, activitiesRes] = await Promise.all([
        supabase
          .from('user_badges')
          .select(`
            id,
            earned_at,
            badge:badges(id, name, name_ar, description, description_ar, icon, color)
          `)
          .eq('user_id', targetUserId)
          .order('earned_at', { ascending: false }),
        supabase
          .from('activity_submissions')
          .select(`
            id,
            points_awarded,
            status,
            submitted_at,
            proof_url,
            activity:activity_types(name, name_ar),
            committee:committees(name, name_ar)
          `)
          .eq('volunteer_id', targetUserId)
          .order('submitted_at', { ascending: false }),
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
    if (file.size > 2 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت' : 'Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`]);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(data.publicUrl + '?t=' + Date.now()); // Add cache buster
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
                <LevelBadge level={displayProfile?.level || 'bronze'} />
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
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{points}</div>
              <div className="text-sm text-muted-foreground">{t('dashboard.totalPoints')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level Progress */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.pointsProgress')}</CardTitle>
          <CardDescription>
            {isRTL
              ? `${nextThreshold - points} نقطة للوصول للمستوى التالي`
              : `${nextThreshold - points} more points to reach the next level`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{points} {t('common.points')}</span>
              <span>{nextThreshold} {t('common.points')}</span>
            </div>
            <Progress value={progress} className="h-4" />
          </div>
          <div className="grid grid-cols-5 gap-2 mt-6">
            {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const).map((level) => (
              <div
                key={level}
                className={`text-center p-3 rounded-lg ${displayProfile?.level === level ? "bg-primary/10 border-2 border-primary" : "bg-muted/50"
                  }`}
              >
                <LevelBadge level={level} size="sm" showLabel={false} />
                <p className="text-xs font-medium mt-1">{t(`level.${level}`)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activities">{t('profile.activityHistory')}</TabsTrigger>
          <TabsTrigger value="badges">
            {t('profile.badges')} ({badges.length})
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
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(activity.status)}`}>
                          {getStatusText(activity.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                {t('profile.badges')}
              </CardTitle>
              <CardDescription>
                {isRTL ? 'الإنجازات التي حصلت عليها من خلال مساهماتك' : 'Achievements you\'ve earned through your contributions'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : badges.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {isRTL ? 'أكمل الأنشطة للحصول على الشارات!' : 'Complete activities to earn badges!'}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {badges.map((userBadge) => (
                    <div
                      key={userBadge.id}
                      className="flex flex-col items-center text-center p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                        style={{ backgroundColor: userBadge.badge.color + '20', color: userBadge.badge.color }}
                      >
                        <Award className="h-8 w-8" />
                      </div>
                      <h4 className="font-medium text-sm">
                        {isRTL ? userBadge.badge.name_ar : userBadge.badge.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRTL ? userBadge.badge.description_ar : userBadge.badge.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(userBadge.earned_at)}
                      </p>
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
