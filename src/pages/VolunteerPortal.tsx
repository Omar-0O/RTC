import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ImagePreview } from '@/components/ui/image-preview';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast, Toaster } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  CheckCircle2,
  Loader2,
  ClipboardList,
  Building2,
  Calendar as CalendarIcon,
  Activity,
  FileText,
  MapPin,
  Shirt,
  Sparkles,
  History,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
  points_with_vest: number | null;
  points_without_vest: number | null;
  mode: 'individual' | 'group';
  committee_ids: string[];
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

interface VolunteerProfile {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  avatar_url: string | null;
  committee_id: string | null;
  total_points: number;
}

export default function VolunteerPortal() {
  const { volunteerId } = useParams<{ volunteerId: string }>();
  // For standard messages use a dummy lang config since we might not have Auth, but LanguageContext is global
  const { isRTL, t } = useLanguage();

  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [committeeId, setCommitteeId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('branch');
  const [woreVest, setWoreVest] = useState(false);

  const [loadingPage, setLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    if (volunteerId) loadAll();
  }, [volunteerId]);

  const loadAll = async () => {
    setLoadingPage(true);
    try {
      const [profileRes, committeesRes, activitiesRes, activityCommitteesRes, submissionsRes] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, full_name_ar, avatar_url, committee_id, total_points')
            .eq('id', volunteerId!)
            .maybeSingle(),
          supabase.from('committees').select('id, name, name_ar').order('name'),
          supabase.from('activity_types').select('*').order('name'),
          supabase.from('activity_type_committees').select('activity_type_id, committee_id'),
          supabase
            .from('activity_submissions')
            .select(
              `id, points_awarded, status, submitted_at, proof_url,
               activity:activity_types(name, name_ar),
               committee:committees(name, name_ar)`
            )
            .eq('volunteer_id', volunteerId!)
            .order('submitted_at', { ascending: false })
            .limit(10),
        ]);

      if (!profileRes.data) {
        setNotFound(true);
        return;
      }

      const profile = profileRes.data;
      setVolunteer(profile);
      if (profile.committee_id) setCommitteeId(profile.committee_id);

      if (committeesRes.data) setCommittees(committeesRes.data);

      const activityCommitteeMap = new Map<string, string[]>();
      if (activityCommitteesRes.data) {
        activityCommitteesRes.data.forEach((ac: any) => {
          if (!activityCommitteeMap.has(ac.activity_type_id)) {
            activityCommitteeMap.set(ac.activity_type_id, []);
          }
          activityCommitteeMap.get(ac.activity_type_id)!.push(ac.committee_id);
        });
      }

      if (activitiesRes.data) {
        setActivityTypes(
          activitiesRes.data.map((a: any) => ({
            ...a,
            committee_ids: activityCommitteeMap.get(a.id) || [],
          }))
        );
      }

      if (submissionsRes.data) {
        const mapped = submissionsRes.data.map((s: any) => ({
          id: s.id,
          activity_name: s.activity?.name_ar || s.activity?.name || '—',
          committee_name: s.committee?.name_ar || s.committee?.name || '—',
          points: s.points_awarded || 0,
          status: s.status,
          submitted_at: s.submitted_at,
          proof_url: s.proof_url
        }));
        setSubmissions(mapped);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoadingPage(false);
    }
  };

  const filteredActivities = activityTypes.filter(a => {
    const matchesCommittee =
      a.committee_ids.length === 0 || (committeeId && a.committee_ids.includes(committeeId));
    return matchesCommittee && a.mode === 'individual';
  });

  const selectedActivity = activityTypes.find(a => a.id === activityId);

  const computePoints = () => {
    if (!selectedActivity) return 0;
    if (location === 'branch' && woreVest) return selectedActivity.points_with_vest ?? selectedActivity.points;
    if (location === 'branch' && !woreVest) return selectedActivity.points_without_vest ?? selectedActivity.points;
    return selectedActivity.points;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volunteer || !selectedActivity) return;
    if (!committeeId || !activityId) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const [year, month, day] = activityDate.split('-').map(Number);
      const submissionTimestamp = new Date(year, month - 1, day, 12, 0, 0).toISOString();

      const { error } = await supabase.from('activity_submissions').insert({
        volunteer_id: volunteerId,
        activity_type_id: activityId,
        committee_id: committeeId,
        description: description.trim(),
        location,
        wore_vest: location === 'branch' ? woreVest : false,
        points_awarded: computePoints(),
        participant_type: 'volunteer',
        status: 'pending',
        proof_url: null,
        submitted_at: submissionTimestamp,
        participants_count: 1,
      });

      if (error) throw error;

      setIsSubmitted(true);
    } catch (err: any) {
      toast.error(isRTL ? 'فشل في تسجيل المشاركة' : 'Failed to log participation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setActivityId('');
    setActivityDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setLocation('branch');
    setWoreVest(false);
    setIsSubmitted(false);
    loadAll();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return '-';
    }
  };

  if (loadingPage) {
    return (
      <div className="flex items-center justify-center h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 mx-auto bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
            <X className="h-8 w-8" />
          </div>
          <p className="font-semibold text-xl">{isRTL ? 'رابط غير صالح' : 'Invalid Link'}</p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background py-16 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto animate-slide-up">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-secondary/5 border border-primary/20 shadow-2xl">
            <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

            <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-success/20 blur-xl p-4 animate-pulse" />
                <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-success to-emerald-600 flex items-center justify-center shadow-lg float-start ring-8 ring-success/10">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
              </div>

              <div className="space-y-2 max-w-lg">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-success to-emerald-600">
                  {isRTL ? 'شكرا لأنك عضو فعال في شباب المحمدية ❤️' : 'Thank you for being an active member ❤️'}
                </h2>
                <p className="text-muted-foreground">{isRTL ? 'تم استلام مشاركتك وتنتظر المراجعة.' : 'Your participation was received and is pending review.'}</p>
              </div>

              <div className="pt-8">
                <Button
                  onClick={handleReset}
                  size="lg"
                  className="rounded-full px-8 h-14 text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all bg-gradient-to-r from-primary to-emerald-600"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    {isRTL ? 'تسجيل مشاركة جديدة' : 'Log Another Participation'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const volName = isRTL ? volunteer?.full_name_ar || volunteer?.full_name : volunteer?.full_name;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <Toaster position="top-center" />
      <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
        
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-success/10 p-6 border border-primary/10 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-success/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shrink-0">
              <ClipboardList className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {t('activityLog.title')}
              </h1>
            </div>
          </div>

          {/* User badge */}
          <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/10 relative z-10">
            <div className="text-end">
              <p className="text-sm font-bold truncate max-w-[150px] sm:max-w-xs">{volName}</p>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={volunteer?.avatar_url || ''} />
              <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">{volName?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Side */}
          <Card className="border-0 shadow-xl bg-gradient-to-b from-card to-card/95 overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{isRTL ? 'تسجيل مشاركة جديدة' : 'Log New Participation'}</CardTitle>
                  <CardDescription className="text-sm">
                    {isRTL ? 'املأ البيانات التالية لتسجيل مشاركتك' : 'Fill in the details to log your participation'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Committee Selection */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {t('activityLog.selectCommittee')} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={committeeId} onValueChange={(value) => {
                    setCommitteeId(value);
                    setActivityId('');
                  }}>
                    <SelectTrigger className="h-12 text-base px-4 border-2 hover:border-primary/50 transition-colors">
                      <SelectValue placeholder={t('activityLog.selectCommittee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {committees.map((committee) => (
                        <SelectItem key={committee.id} value={committee.id} className="text-base py-3">
                          {isRTL ? committee.name_ar : committee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Activity Date */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {isRTL ? 'تاريخ المشاركة' : 'Participation Date'} <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-start font-normal h-12 text-base px-4 border-2 hover:border-primary/50 transition-colors bg-background"
                      >
                        <CalendarIcon className="ltr:mr-2 rtl:ml-2 h-4 w-4 text-muted-foreground shrink-0" />
                        {activityDate ? (
                          formatDate(activityDate)
                        ) : (
                          <span className="text-muted-foreground">{isRTL ? 'اختر التاريخ' : 'Pick a date'}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={activityDate ? new Date(activityDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setActivityDate(`${year}-${month}-${day}`);
                            setIsCalendarOpen(false);
                          }
                        }}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={2020}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Activity Type */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    {t('activityLog.selectActivity')} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={activityId} onValueChange={setActivityId} disabled={!committeeId}>
                    <SelectTrigger className={cn(
                      "h-12 text-base px-4 border-2 transition-colors",
                      !committeeId ? "opacity-50" : "hover:border-primary/50"
                    )}>
                      <SelectValue placeholder={committeeId ? t('activityLog.selectActivity') : t('activityLog.selectCommittee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredActivities.map((activity) => (
                        <SelectItem key={activity.id} value={activity.id} className="py-3">
                          <div className="flex items-center justify-between w-full gap-4">
                            <span className="text-base font-medium">{isRTL ? activity.name_ar : activity.name}</span>
                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-primary/20 to-success/20 px-3 py-1 text-xs font-bold text-primary">
                              <span dir="ltr">+{activity.points}</span> {isRTL ? 'أثر' : 'pts'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedActivity?.description && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-dashed">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? selectedActivity.description_ar : selectedActivity.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-2.5 border-t pt-4">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {t('activityLog.location')}
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setLocation('branch'); }}
                      className={cn(
                        "relative p-4 rounded-xl border-2 text-center transition-all",
                        location === 'branch'
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      )}
                    >
                      <Building2 className={cn(
                        "h-6 w-6 mx-auto mb-2",
                        location === 'branch' ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className={cn(
                        "text-sm font-medium",
                        location === 'branch' ? "text-primary" : "text-foreground"
                      )}>
                        {t('activityLog.branch')}
                      </span>
                      {location === 'branch' && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLocation('home'); setWoreVest(false); }}
                      className={cn(
                        "relative p-4 rounded-xl border-2 text-center transition-all",
                        location === 'home'
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      )}
                    >
                      <svg className={cn(
                        "h-6 w-6 mx-auto mb-2",
                        location === 'home' ? "text-primary" : "text-muted-foreground"
                      )} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className={cn(
                        "text-sm font-medium",
                        location === 'home' ? "text-primary" : "text-foreground"
                      )}>
                        {t('activityLog.home')}
                      </span>
                      {location === 'home' && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Vest Toggle */}
                {location === 'branch' && (
                  <div className="space-y-3 p-4 rounded-xl border-2 border-warning/30 bg-gradient-to-br from-warning/5 to-orange-500/5 mt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                          <Shirt className="h-5 w-5 text-warning" />
                        </div>
                        <Label htmlFor="wore-vest" className="text-sm font-semibold cursor-pointer">
                          {isRTL ? 'ارتداء الـ Vest (أو الزي الرسمي)' : 'Vest Worn (or Official Uniform)'}
                        </Label>
                      </div>
                      <Switch
                        id="wore-vest"
                        checked={woreVest}
                        onCheckedChange={setWoreVest}
                      />
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2.5 pt-4 border-t mt-4">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {t('activityLog.notes')}
                    <span className="text-xs text-muted-foreground font-normal">({isRTL ? 'اختياري' : 'optional'})</span>
                  </Label>
                  <Textarea
                    placeholder={isRTL ? 'أضف أي ملاحظات هنا...' : 'Add any notes here...'}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none min-h-[100px] border-2 hover:border-primary/50 transition-colors"
                  />
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary mt-6"
                  disabled={!activityId || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {isRTL ? 'جاري التسجيل...' : 'Logging...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      {t('activityLog.submitActivity')}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* History Side */}
          <Card className="border-0 shadow-xl bg-gradient-to-b from-card to-card/95 overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('activityLog.submissionHistory')}</CardTitle>
                  <CardDescription className="text-sm">
                    {isRTL ? 'سجل مشاركاتك السابقة وحالاتها' : 'Your past participations and their status'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <History className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground">{isRTL ? 'لا توجد مشاركات سابقة' : 'No previous participations'}</p>
                    <p className="text-xs text-muted-foreground/70 max-w-[200px] mx-auto">
                      {isRTL ? 'ابدأ بتسجيل مشاركتك الأولى اليوم!' : 'Start logging your first participation today!'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {submission.proof_url ? (
                          <ImagePreview src={submission.proof_url} alt="Proof" className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/50">
                            <img
                              src={submission.proof_url}
                              alt="Proof"
                              className="h-full w-full object-cover transition-transform group-hover:scale-110"
                            />
                          </ImagePreview>
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                            <Activity className="h-6 w-6 text-primary/40" />
                          </div>
                        )}
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                            {submission.activity_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {submission.committee_name}
                            </span>
                            <span>•</span>
                            <span>{formatDate(submission.submitted_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0 pl-2">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary" dir="ltr">
                          +{submission.points}
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
    </div>
  );
}
