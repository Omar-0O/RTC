import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, History, Upload, X, Image as ImageIcon } from 'lucide-react';

interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

interface ActivityType {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  description_ar: string | null;
  points: number;
  mode: 'individual' | 'group';
  committee_id: string | null;
}

interface Submission {
  id: string;
  activity_name: string;
  committee_name: string;
  points: number;
  status: string;
  submitted_at: string;
  proof_url: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function LogActivity() {
  const { user, profile, refreshProfile } = useAuth();
  const { t, isRTL } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [committeeId, setCommitteeId] = useState(profile?.committee_id || '');
  const [activityId, setActivityId] = useState('');
  const [description, setDescription] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [participantsCount, setParticipantsCount] = useState('1');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [committeesRes, activitiesRes, submissionsRes] = await Promise.all([
        supabase.from('committees').select('id, name, name_ar').order('name'),
        supabase.from('activity_types').select('*').order('name'),
        user?.id
          ? supabase
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
            .eq('volunteer_id', user.id)
            .order('submitted_at', { ascending: false })
            .limit(10)
          : Promise.resolve({ data: [] }),
      ]);

      if (committeesRes.data) setCommittees(committeesRes.data);
      if (activitiesRes.data) setActivityTypes(activitiesRes.data);
      if (submissionsRes.data) {
        setSubmissions(submissionsRes.data.map((s: any) => ({
          id: s.id,
          activity_name: isRTL ? (s.activity?.name_ar || s.activity?.name) : s.activity?.name,
          committee_name: isRTL ? (s.committee?.name_ar || s.committee?.name) : s.committee?.name,
          points: s.points_awarded || 0,
          status: s.status,
          submitted_at: s.submitted_at,
          proof_url: s.proof_url,
        })));
      }

      if (profile?.committee_id && !committeeId) {
        setCommitteeId(profile.committee_id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activityTypes.filter(
    a => !a.committee_id || a.committee_id === committeeId
  );
  const selectedActivity = activityTypes.find(a => a.id === activityId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image must be less than 5MB');
      return;
    }

    setProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile || !user) return null;

    setIsUploading(true);
    try {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('activity-proofs')
        .upload(fileName, proofFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('activity-proofs')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(isRTL ? 'فشل في رفع الصورة' : 'Failed to upload image');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedActivity) return;

    if (!committeeId || !activityId) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload proof if exists
      let proofUrl: string | null = null;
      if (proofFile) {
        proofUrl = await uploadProof();
      }

      const { error } = await supabase.from('activity_submissions').insert({
        volunteer_id: user.id,
        activity_type_id: activityId,
        committee_id: committeeId,
        description: description.trim(),
        hours_spent: hoursSpent ? parseFloat(hoursSpent) : null,
        participants_count: selectedActivity.mode === 'group' ? parseInt(participantsCount) || 1 : 1,
        points_awarded: selectedActivity.points,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        proof_url: proofUrl,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success(isRTL ? 'تم تسجيل المشاركة بنجاح!' : 'Participation logged successfully!');
      await refreshProfile();
      fetchData();
    } catch (error: any) {
      console.error('Error logging participation:', error);
      toast.error(isRTL ? 'فشل في تسجيل المشاركة' : 'Failed to log participation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setActivityId('');
    setDescription('');
    setHoursSpent('');
    setParticipantsCount('1');
    setProofFile(null);
    setProofPreview(null);
    setIsSubmitted(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto animate-slide-up">
        <Card className="overflow-hidden border-2 border-primary/20">
          <div className="bg-gradient-to-br from-primary/10 via-success/10 to-accent/10 pt-8 pb-4">
            <CardContent>
              <div className="text-center">
                {/* Success Icon with Animation */}
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-success to-success/80 mb-4 animate-bounce shadow-lg">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>

                {/* Main Success Message */}
                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary via-success to-accent bg-clip-text text-transparent">
                  {isRTL ? '🎉 رائع! تم التسجيل بنجاح! 🎉' : '🎉 Awesome! Successfully Logged! 🎉'}
                </h2>

                {/* Thank You Message */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-6 mb-6 shadow-md">
                  <p className="text-xl font-semibold text-primary mb-2">
                    {isRTL ? '✨ شكراً لأنك عضو فعال في RTC ✨' : '✨ Thank You for Being an Active RTC Member ✨'}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {isRTL ? '🌟 مساهمتك تصنع الفرق في المجتمع 🌟' : '🌟 Your contribution makes a difference in our community 🌟'}
                  </p>
                </div>

                {/* Participation Details */}
                <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-lg p-5 mb-6 text-left border border-primary/20 shadow-sm">
                  <h3 className="font-bold mb-4 text-lg flex items-center gap-2">
                    <span>📋</span>
                    <span>{isRTL ? 'تفاصيل المشاركة' : 'Participation Details'}</span>
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center p-2 rounded bg-primary/5">
                      <dt className="text-muted-foreground flex items-center gap-2">
                        <span>🎯</span>
                        <span>{isRTL ? 'النشاط:' : 'Activity:'}</span>
                      </dt>
                      <dd className="font-medium">{isRTL ? selectedActivity?.name_ar : selectedActivity?.name}</dd>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-success/5">
                      <dt className="text-muted-foreground flex items-center gap-2">
                        <span>⭐</span>
                        <span>{isRTL ? 'النقاط المكتسبة:' : 'Points Earned:'}</span>
                      </dt>
                      <dd className="font-bold text-xl text-success">
                        +{selectedActivity?.points} {isRTL ? 'نقطة' : 'pts'} 🎊
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Motivational Quote */}
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
                  <p className="text-sm italic text-accent-foreground">
                    {isRTL
                      ? '💪 "استمر في العطاء، فكل مساهمة تبني مستقبلاً أفضل"'
                      : '💪 "Keep giving, every contribution builds a better future"'}
                  </p>
                </div>

                {/* Action Button */}
                <Button
                  onClick={handleReset}
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg"
                >
                  <span className="text-lg">
                    {isRTL ? '➕ تسجيل مشاركة جديدة' : '➕ Log Another Participation'}
                  </span>
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold">{t('activityLog.title')}</h1>
        <p className="text-muted-foreground">{t('activityLog.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Form */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'تسجيل مشاركة جديدة' : 'Log New Participation'}</CardTitle>
            <CardDescription>{isRTL ? 'سجل مشاركتك التطوعية واحصل على النقاط مباشرة' : 'Log your volunteer participation and earn points instantly'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Committee Selection */}
              <div className="space-y-2">
                <Label>{t('activityLog.selectCommittee')} *</Label>
                <Select value={committeeId} onValueChange={(value) => {
                  setCommitteeId(value);
                  setActivityId('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('activityLog.selectCommittee')} />
                  </SelectTrigger>
                  <SelectContent>
                    {committees.map((committee) => (
                      <SelectItem key={committee.id} value={committee.id}>
                        {isRTL ? committee.name_ar : committee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Activity Type */}
              <div className="space-y-2">
                <Label>{t('activityLog.selectActivity')} *</Label>
                <Select value={activityId} onValueChange={setActivityId} disabled={!committeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={committeeId ? t('activityLog.selectActivity') : t('activityLog.selectCommittee')} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredActivities.map((activity) => (
                      <SelectItem key={activity.id} value={activity.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{isRTL ? activity.name_ar : activity.name}</span>
                          <span className="text-xs text-muted-foreground">
                            +{activity.points} {isRTL ? 'نقطة' : 'pts'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedActivity?.description && (
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? selectedActivity.description_ar : selectedActivity.description}
                  </p>
                )}
              </div>

              {/* Hours and Participants */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'عدد الساعات' : 'Hours Spent'}</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={hoursSpent}
                    onChange={(e) => setHoursSpent(e.target.value)}
                    placeholder={isRTL ? 'اختياري' : 'Optional'}
                  />
                </div>
                {selectedActivity?.mode === 'group' && (
                  <div className="space-y-2">
                    <Label>{isRTL ? 'عدد المشاركين' : 'Participants'}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={participantsCount}
                      onChange={(e) => setParticipantsCount(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>{t('activityLog.notes')}</Label>
                <Textarea
                  placeholder={t('activityLog.notesPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {description.length}/1000
                </p>
              </div>

              {/* Proof Upload */}
              <div className="space-y-2">
                <Label>{isRTL ? 'صورة الإثبات (اختياري)' : 'Proof Image (Optional)'}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {proofPreview ? (
                  <div className="relative">
                    <img
                      src={proofPreview}
                      alt="Proof preview"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={removeFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-32 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {isRTL ? 'اضغط لرفع صورة (حد أقصى 5 ميجابايت)' : 'Click to upload image (max 5MB)'}
                      </span>
                    </div>
                  </Button>
                )}
              </div>

              {/* Points Preview */}
              {selectedActivity && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{isRTL ? 'النقاط التي ستحصل عليها:' : 'Points you\'ll earn:'}</span>
                    <span className="text-xl font-bold text-primary">
                      +{selectedActivity.points} {isRTL ? 'نقطة' : 'pts'}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!activityId || isSubmitting || isUploading}
              >
                {(isSubmitting || isUploading) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploading
                      ? (isRTL ? 'جاري رفع الصورة...' : 'Uploading image...')
                      : (isRTL ? 'جاري التسجيل...' : 'Logging...')
                    }
                  </>
                ) : (
                  t('activityLog.submitActivity')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Submission History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('activityLog.submissionHistory')}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'آخر 10 مشاركات' : 'Your last 10 participations'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isRTL ? 'لا توجد مشاركات سابقة' : 'No previous participations'}
              </p>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {submission.proof_url && (
                        <img
                          src={submission.proof_url}
                          alt="Proof"
                          className="w-10 h-10 rounded object-cover shrink-0"
                        />
                      )}
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{submission.activity_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {submission.committee_name} • {formatDate(submission.submitted_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium">+{submission.points}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(submission.status)}`}>
                        {getStatusText(submission.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
