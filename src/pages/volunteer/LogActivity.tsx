import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { CheckCircle2, Globe, Building, Loader2, History } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
}

export default function LogActivity() {
  const { user, profile } = useAuth();
  const { t, isRTL, language } = useLanguage();

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [committeeId, setCommitteeId] = useState(profile?.committee_id || '');
  const [activityId, setActivityId] = useState('');
  const [description, setDescription] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [participantsCount, setParticipantsCount] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        })));
      }

      // Set default committee from profile
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedActivity) return;

    // Validate inputs
    if (!committeeId || !activityId || !description.trim()) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields');
      return;
    }

    if (description.trim().length < 10) {
      toast.error(isRTL ? 'الوصف يجب أن يكون 10 أحرف على الأقل' : 'Description must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('activity_submissions').insert({
        volunteer_id: user.id,
        activity_type_id: activityId,
        committee_id: committeeId,
        description: description.trim(),
        hours_spent: hoursSpent ? parseFloat(hoursSpent) : null,
        participants_count: selectedActivity.mode === 'group' ? parseInt(participantsCount) || 1 : 1,
        points_awarded: selectedActivity.points,
        status: 'pending',
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success(isRTL ? 'تم تقديم النشاط بنجاح' : 'Activity submitted successfully');
      fetchData(); // Refresh submissions list
    } catch (error: any) {
      console.error('Error submitting activity:', error);
      toast.error(isRTL ? 'فشل في تقديم النشاط' : 'Failed to submit activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setActivityId('');
    setDescription('');
    setHoursSpent('');
    setParticipantsCount('1');
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{isRTL ? 'تم بنجاح!' : 'Success!'}</h2>
              <p className="text-muted-foreground mb-6">
                {isRTL ? 'طلبك قيد المراجعة الآن.' : 'Your submission is now pending review.'}
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-medium mb-2">{isRTL ? 'تفاصيل الطلب' : 'Submission Details'}</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{isRTL ? 'النشاط:' : 'Activity:'}</dt>
                    <dd>{isRTL ? selectedActivity?.name_ar : selectedActivity?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{isRTL ? 'النقاط:' : 'Points:'}</dt>
                    <dd className="font-semibold text-primary">+{selectedActivity?.points} {isRTL ? 'نقطة' : 'pts'}</dd>
                  </div>
                </dl>
              </div>
              <Button onClick={handleReset}>{isRTL ? 'تسجيل نشاط آخر' : 'Log Another Activity'}</Button>
            </div>
          </CardContent>
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
            <CardTitle>{isRTL ? 'تسجيل نشاط جديد' : 'Log New Activity'}</CardTitle>
            <CardDescription>{isRTL ? 'قدم نشاطك التطوعي للمراجعة' : 'Submit your volunteer activity for review'}</CardDescription>
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

              {/* Description */}
              <div className="space-y-2">
                <Label>{t('activityLog.description')} *</Label>
                <Textarea
                  placeholder={t('activityLog.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {description.length}/1000
                </p>
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
                disabled={!activityId || !description.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isRTL ? 'جاري الإرسال...' : 'Submitting...'}
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
              {isRTL ? 'آخر 10 طلبات' : 'Your last 10 submissions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isRTL ? 'لا توجد طلبات سابقة' : 'No previous submissions'}
              </p>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{submission.activity_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {submission.committee_name} • {formatDate(submission.submitted_at)}
                      </p>
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
