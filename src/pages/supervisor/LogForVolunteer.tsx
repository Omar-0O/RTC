import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';
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
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface TargetVolunteer {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  avatar_url: string | null;
  committee_id: string | null;
  branch_id: string | null;
}

export default function LogForVolunteer() {
  const { volunteerId } = useParams<{ volunteerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();

  const [targetVolunteer, setTargetVolunteer] = useState<TargetVolunteer | null>(null);
  const [loadingVolunteer, setLoadingVolunteer] = useState(true);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [committeeId, setCommitteeId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('branch');
  const [woreVest, setWoreVest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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

  useEffect(() => {
    if (volunteerId) {
      fetchVolunteer();
      fetchFormData();
    }
  }, [volunteerId]);

  const fetchVolunteer = async () => {
    setLoadingVolunteer(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, full_name_ar, avatar_url, committee_id, branch_id')
        .eq('id', volunteerId!)
        .single();
      if (error) throw error;
      setTargetVolunteer(data);
      if (data.committee_id) setCommitteeId(data.committee_id);
    } catch {
      toast.error(isRTL ? 'المتطوع غير موجود' : 'Volunteer not found');
      navigate('/supervisor/under-follow-up');
    } finally {
      setLoadingVolunteer(false);
    }
  };

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const [cr, ar, acr] = await Promise.all([
        supabase.from('committees').select('id, name, name_ar').order('name'),
        supabase.from('activity_types').select('*').order('name'),
        supabase.from('activity_type_committees').select('activity_type_id, committee_id'),
      ]);
      if (cr.data) setCommittees(cr.data);
      const map = new Map<string, string[]>();
      acr.data?.forEach((ac: any) => {
        if (!map.has(ac.activity_type_id)) map.set(ac.activity_type_id, []);
        map.get(ac.activity_type_id)!.push(ac.committee_id);
      });
      if (ar.data)
        setActivityTypes(ar.data.map((a: any) => ({ ...a, committee_ids: map.get(a.id) || [] })));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activityTypes.filter(
    a =>
      (a.committee_ids.length === 0 || (committeeId && a.committee_ids.includes(committeeId))) &&
      a.mode === 'individual'
  );

  const selectedActivity = activityTypes.find(a => a.id === activityId);

  const computePoints = () => {
    if (!selectedActivity) return 0;
    if (location === 'branch' && woreVest) return selectedActivity.points_with_vest ?? selectedActivity.points;
    if (location === 'branch' && !woreVest) return selectedActivity.points_without_vest ?? selectedActivity.points;
    return selectedActivity.points;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedActivity || !volunteerId || !committeeId || !activityId) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      const [yr, mo, dy] = activityDate.split('-').map(Number);
      const { error } = await supabase.from('activity_submissions').insert({
        volunteer_id: volunteerId,
        activity_type_id: activityId,
        committee_id: committeeId,
        description: description.trim(),
        location,
        wore_vest: location === 'branch' ? woreVest : false,
        points_awarded: computePoints(),
        participant_type: 'volunteer',
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        proof_url: null,
        submitted_at: new Date(yr, mo - 1, dy, 12, 0, 0).toISOString(),
        participants_count: 1,
        branch_id: targetVolunteer?.branch_id || null,
      });
      if (error) throw error;
      setIsSubmitted(true);
      toast.success(isRTL ? 'تم تسجيل المشاركة بنجاح!' : 'Participation logged successfully!');
    } catch {
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
  };

  const volName = targetVolunteer
    ? (isRTL ? targetVolunteer.full_name_ar || targetVolunteer.full_name : targetVolunteer.full_name) || '—'
    : '...';

  if (loadingVolunteer || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto animate-slide-up py-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-secondary/5 border border-primary/20 shadow-2xl">
          <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

          <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-success/20 blur-xl p-4 animate-pulse" />
              <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-success to-emerald-600 flex items-center justify-center shadow-lg float-start ring-8 ring-success/10">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
            </div>

            <div className="space-y-4 max-w-lg">
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-success to-emerald-600">
                {isRTL ? 'تم التسجيل بنجاح' : 'Logged Successfully'}
              </h2>
              <p className="text-lg text-muted-foreground font-medium">
                {isRTL ? `تم تسجيل المشاركة للمتطوع ${volName} نيابة عنه.` : `Participation logged on behalf of ${volName}.`}
              </p>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              <Button
                onClick={handleReset}
                className="flex-1 rounded-full h-12 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all bg-gradient-to-r from-primary to-emerald-600"
              >
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  {isRTL ? 'مشاركة أخرى' : 'Log Another'}
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/supervisor/under-follow-up')}
                className="flex-1 rounded-full h-12 font-semibold"
              >
                <span className="flex items-center gap-2">
                  {isRTL ? <><ArrowRight className="h-4 w-4" /> رجوع</> : <><ArrowLeft className="h-4 w-4" /> Back</>}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-3xl mx-auto">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-success/10 p-6 border border-primary/10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-success/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shrink-0">
              <ClipboardList className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                {isRTL ? 'إدخال نيابي للمتطوع' : 'Proxy logging for'}
              </p>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {volName}
                <Avatar className="h-8 w-8 ml-2 hidden sm:block">
                  <AvatarImage src={targetVolunteer?.avatar_url || ''} />
                  <AvatarFallback className="text-xs">{volName.charAt(0)}</AvatarFallback>
                </Avatar>
              </h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/supervisor/under-follow-up')}
            className="md:self-start gap-2 bg-background/50 hover:bg-background"
          >
            {isRTL ? <><ArrowRight className="h-4 w-4" /> رجوع للمتابعة</> : <><ArrowLeft className="h-4 w-4" /> Back to Follow-Up</>}
          </Button>
        </div>
      </div>

      <div className="grid gap-8">
        <Card className="border-0 shadow-xl bg-gradient-to-b from-card to-card/95 overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{isRTL ? 'تسجيل مشاركة جديدة' : 'Log New Participation'}</CardTitle>
                <CardDescription className="text-sm">
                  {isRTL ? 'سيتم تسجيل هذا النشاط في حساب المتطوع وتقييمه.' : 'This participation will be registered under the volunteer\'s account.'}
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

              {/* Location Selection */}
              <div className="space-y-2.5 pt-4 border-t">
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

              {/* Vest Checkbox */}
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
                  placeholder={t('activityLog.notesPlaceholder') || (isRTL ? 'أضف أي ملاحظات هنا...' : 'Add any notes here...')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none min-h-[100px] border-2 hover:border-primary/50 transition-colors"
                />
              </div>

              {/* Submit Button */}
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
      </div>
    </div>
  );
}
