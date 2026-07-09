import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizePhoneE164 } from '@/utils/phoneUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Loader2, 
  Phone, 
  User, 
  CheckCircle2, 
  Building2, 
  Calendar as CalendarIcon, 
  Trophy, 
  Settings,
  RefreshCw,
  Sparkles,
  ClipboardList,
  History,
  Activity,
  UserPlus,
  Plus,
  X,
  Check,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import logo from '@/assets/logo.png';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import CourseSchedule from '@/components/courses/CourseSchedule';

interface VolunteerProfile {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  phone: string | null;
  total_points: number;
  level: string;
  committee_id: string | null;
  avatar_url: string | null;
}

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
  mode: string;
  committee_ids: string[];
}

interface SubmissionItem {
  id: string;
  activity_name: string;
  committee_name: string;
  points: number;
  status: string;
  submitted_at: string;
}

export default function Kiosk() {
  const { isRTL, language, t, setLanguage } = useLanguage();

  // Kiosk settings
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');


  // Form states
  const [phone, setPhone] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(null);
  const [guestName, setGuestName] = useState<string>('');

  // Dropdown states
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>('general');
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [activityDate, setActivityDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [woreVest, setWoreVest] = useState<boolean>(false);

  // Submissions list
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);

  // Calendar state
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);

  // Submission states
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);

  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Load basic configurations
  useEffect(() => {
    async function loadConfig() {
      try {
        // Fetch branches
        const { data: branchData } = await supabase.from('branches').select('*').order('name');
        setBranches(branchData || []);

        // Retrieve branch ID from local storage
        const savedBranchId = localStorage.getItem('rtc_kiosk_branch_id');
        if (savedBranchId) {
          setSelectedBranchId(savedBranchId);
        } else if (branchData && branchData.length > 0) {
          // Default to first branch if none saved
          const defaultBranch = branchData.find(b => b.is_default) || branchData[0];
          setSelectedBranchId(defaultBranch.id);
          localStorage.setItem('rtc_kiosk_branch_id', defaultBranch.id);
        }

        // Fetch committees
        const { data: committeeData } = await supabase.from('committees').select('*').order('name');
        setCommittees(committeeData || []);
      } catch (err) {
        console.error('Error loading kiosk config:', err);
      }
    }
    loadConfig();
  }, []);

  // Fetch activity types when branch changes
  useEffect(() => {
    async function fetchBranchActivityTypes() {
      try {
        let query = supabase.from('activity_types').select('*').order('name');
        
        if (selectedBranchId) {
          query = query.or(`branch_id.eq.${selectedBranchId},branch_id.is.null`);
        }

        const { data: activityData, error } = await query;
        if (error) throw error;

        // Fetch activity type-committee mapping
        const { data: mappingData } = await supabase.from('activity_type_committees').select('*');
        const mappingMap = new Map<string, string[]>();
        if (mappingData) {
          mappingData.forEach((item: any) => {
            if (!mappingMap.has(item.activity_type_id)) {
              mappingMap.set(item.activity_type_id, []);
            }
            mappingMap.get(item.activity_type_id)!.push(item.committee_id);
          });
        }

        if (activityData) {
          setActivityTypes(
            activityData.map((act: any) => ({
              ...act,
              committee_ids: mappingMap.get(act.id) || [],
            }))
          );
        }
      } catch (err) {
        console.error('Error fetching activity types:', err);
      }
    }

    fetchBranchActivityTypes();
  }, [selectedBranchId]);

  // Save selected branch to local storage
  const handleBranchChange = (id: string) => {
    setSelectedBranchId(id);
    localStorage.setItem('rtc_kiosk_branch_id', id);
    toast.success(
      isRTL 
        ? 'تم تحديث فرع التابلت بنجاح' 
        : 'Tablet branch updated successfully'
    );
  };

  // Perform volunteer lookup by phone number
  const lookupVolunteer = async (overridePhone?: string) => {
    const targetPhone = overridePhone !== undefined ? overridePhone : phone;
    if (!targetPhone.trim()) {
      toast.error(isRTL ? 'يرجى إدخال رقم الموبايل أولاً' : 'Please enter the mobile number first');
      return;
    }

    setSearchLoading(true);
    setHasSearched(false);
    setVolunteer(null);
    setGuestName('');
    setSubmissions([]);

    try {
      const normalized = normalizePhoneE164(targetPhone);
      if (!normalized) {
        toast.error(isRTL ? 'رقم الهاتف غير صالح' : 'Invalid phone number format');
        setSearchLoading(false);
        return;
      }

      // Build all possible formats the number could be stored as in the DB
      const allFormats: string[] = [];

      // 1. E.164 canonical form: +201XXXXXXXXX
      if (normalized) allFormats.push(normalized);

      // 2. Without + prefix: 201XXXXXXXXX
      if (normalized.startsWith('+')) {
        allFormats.push(normalized.slice(1));
      }

      // 3. Local Egyptian format: 01XXXXXXXXX (strip country code 20)
      if (normalized.startsWith('+20')) {
        allFormats.push('0' + normalized.slice(3));
      }

      // 4. Strip all non-digits as a last fallback (pure digit string)
      const digitsOnly = normalized.replace(/\D/g, '');
      if (digitsOnly && !allFormats.includes(digitsOnly)) {
        allFormats.push(digitsOnly);
      }

      // Query profiles matching ANY of the possible phone formats
      // NOTE: Using .in() instead of .or() because .or() doesn't properly
      // URL-encode the '+' sign in E.164 numbers in production environments,
      // causing '+201...' to be interpreted as ' 201...' (space instead of plus).
      // Also filtering by selectedBranchId or null to find the volunteer in the correct branch or if unassigned.
      let dbQuery = supabase
        .from('profiles')
        .select('id, full_name, full_name_ar, phone, total_points, level, committee_id, avatar_url, branch_id')
        .in('phone', allFormats);

      if (selectedBranchId) {
        dbQuery = dbQuery.or(`branch_id.eq.${selectedBranchId},branch_id.is.null`);
      }

      const { data, error, status } = await dbQuery.maybeSingle();

      // Detect server-side errors (503, 500, etc.) even when Supabase client
      // silently returns null data instead of populating the error field
      if (error) throw error;
      if (status >= 500) {
        toast.error(
          isRTL
            ? 'تعذّر الاتصال بالخادم، يرجى المحاولة مرة أخرى بعد قليل'
            : 'Server unavailable, please try again in a moment'
        );
        setSearchLoading(false);
        return;
      }

      if (data) {
        setVolunteer(data as VolunteerProfile);
        if (data.committee_id) {
          setSelectedCommitteeId(data.committee_id);
        } else {
          setSelectedCommitteeId('general');
        }
        toast.success(
          isRTL 
            ? `مرحباً بك، ${data.full_name_ar || data.full_name}` 
            : `Welcome back, ${data.full_name}`
        );
        // Load recent submissions
        loadSubmissions(data.id, null);
      } else {
        toast.info(
          isRTL 
            ? 'الرقم غير مسجل. يرجى إدخال اسمك للتسجيل كزائر.' 
            : 'Phone number not registered. Please enter your name to log as a guest.'
        );
        setSelectedCommitteeId('general');
        // Load recent guest submissions by phone
        loadSubmissions(null, normalized);
      }
      setHasSearched(true);
    } catch (err: any) {
      console.error('Error querying volunteer profile:', err);
      // Detect network/server errors specifically
      const isServerError = err?.status >= 500 || err?.code === 'PGRST301' || err?.message?.includes('503') || err?.message?.includes('fetch');
      toast.error(
        isServerError
          ? (isRTL ? 'تعذّر الاتصال بالخادم، يرجى المحاولة مرة أخرى بعد قليل' : 'Server unavailable, please try again in a moment')
          : (isRTL ? 'خطأ أثناء البحث عن الحساب' : 'Error searching for profile')
      );
    } finally {
      setSearchLoading(false);
    }
  };

  // Load submissions history
  const loadSubmissions = async (volunteerId: string | null, guestPhone: string | null) => {
    setLoadingSubmissions(true);
    try {
      let query = supabase
        .from('activity_submissions')
        .select(`
          id,
          points_awarded,
          status,
          submitted_at,
          activity:activity_types(name, name_ar),
          committee:committees(name, name_ar)
        `)
        .order('submitted_at', { ascending: false })
        .limit(5);

      if (volunteerId) {
        query = query.eq('volunteer_id', volunteerId);
      } else if (guestPhone) {
        query = query.eq('guest_phone', guestPhone);
      } else {
        setLoadingSubmissions(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const mapped = data.map((s: any) => ({
          id: s.id,
          activity_name: s.activity?.name_ar || s.activity?.name || '—',
          committee_name: s.committee?.name_ar || s.committee?.name || (isRTL ? 'عامة' : 'General'),
          points: s.points_awarded || 0,
          status: s.status,
          submitted_at: s.submitted_at
        }));
        setSubmissions(mapped);
      }
    } catch (err) {
      console.error('Error loading submissions history:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Filter activities based on the selected committee
  const filteredActivities = activityTypes.filter(act => {
    if (act.mode !== 'individual') return false;
    
    // If 'general' or empty is selected, show only activities with no committee restrictions
    const matchesCommittee = act.committee_ids.length === 0 || 
      (selectedCommitteeId && selectedCommitteeId !== 'general' && act.committee_ids.includes(selectedCommitteeId));
      
    return matchesCommittee;
  });

  const selectedActivity = activityTypes.find(a => a.id === selectedActivityId);

  // Auto points calculation based on vest wearing
  const computePoints = () => {
    if (!selectedActivity) return 0;
    if (woreVest) {
      return selectedActivity.points_with_vest ?? selectedActivity.points;
    } else {
      return selectedActivity.points_without_vest ?? selectedActivity.points;
    }
  };

  // Handle volunteer logging submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedActivityId) {
      toast.error(isRTL ? 'يرجى اختيار نوع المهمة' : 'Please select the activity type');
      return;
    }

    if (!hasSearched) {
      toast.error(isRTL ? 'يرجى التحقق من رقم الهاتف أولاً' : 'Please search the phone number first');
      return;
    }

    // For unregistered users, guestName is required
    if (!volunteer && !guestName.trim()) {
      toast.error(isRTL ? 'يرجى إدخال اسمك' : 'Please enter your name');
      return;
    }

    setSubmitting(true);
    try {
      const points = computePoints();
      
      // Parse activity date to local noon to avoid time-zone mismatches
      const [year, month, day] = activityDate.split('-').map(Number);
      const submissionTimestamp = new Date(year, month - 1, day, 12, 0, 0).toISOString();

      if (volunteer) {
        // Individual volunteer submission
        const { error } = await supabase.from('activity_submissions').insert({
          volunteer_id: volunteer.id,
          activity_type_id: selectedActivityId,
          committee_id: selectedCommitteeId || null,
          description: description.trim(),
          location: 'branch',
          wore_vest: woreVest,
          points_awarded: points,
          participant_type: 'volunteer',
          status: 'approved', // Auto-approved in branch kiosk
          submitted_at: submissionTimestamp,
          branch_id: selectedBranchId || null,
          participants_count: 1
        });

        if (error) throw error;
      } else {
        // Guest submission
        const { error } = await supabase.from('activity_submissions').insert({
          volunteer_id: null as any, // Cast to bypass ts non-nullable check if needed
          guest_name: guestName.trim(),
          guest_phone: normalizePhoneE164(phone),
          activity_type_id: selectedActivityId,
          committee_id: selectedCommitteeId || null,
          description: description.trim(),
          location: 'branch',
          wore_vest: woreVest,
          points_awarded: points,
          participant_type: 'guest',
          status: 'approved', // Auto-approved
          submitted_at: submissionTimestamp,
          branch_id: selectedBranchId || null,
          participants_count: 1
        } as any);

        if (error) throw error;
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Kiosk submission failed:', err);
      toast.error(isRTL ? 'فشل في تسجيل المشاركة' : 'Failed to register participation');
    } finally {
      setSubmitting(false);
    }
  };

  // Success countdown trigger
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (success) {
      setCountdown(5);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleReset();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [success]);

  const handleReset = () => {
    setPhone('');
    setVolunteer(null);
    setGuestName('');
    setHasSearched(false);
    setSelectedCommitteeId('general');
    setSelectedActivityId('');
    setDescription('');
    setWoreVest(false);
    setSuccess(false);
    setSubmissions([]);
    setActivityDate(new Date().toISOString().split('T')[0]);
    if (phoneInputRef.current) {
      phoneInputRef.current.focus();
    }
  };

  // Helper to format level in Arabic
  const formatLevel = (level: string) => {
    switch (level) {
      case 'under_follow_up':
      case 'newbie':
      case 'active':
        return isRTL ? 'تحت المتابعة' : 'Under Follow-up';
      case 'project_responsible':
        return isRTL ? 'مسئول مشروع' : 'Project Responsible';
      case 'responsible':
        return isRTL ? 'مسئول' : 'Responsible';
      default:
        return level;
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
      case 'approved': return 'bg-success/10 text-success border-success/20';
      case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-warning/10 text-warning border-warning/20';
    }
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

  // Trigger search on typing 11 digits for easy Egyptian kiosk flow
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhone(val);
    
    // Egyptian numbers standard length 11 digits (e.g. 01012345678)
    const cleaned = val.replace(/[^\d]/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('01')) {
      lookupVolunteer(cleaned);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto animate-slide-up py-10" dir={isRTL ? 'rtl' : 'ltr'}>
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
                {isRTL ? 'شكرا لأنك عضو فعال في RTC ❤️' : 'Thank you for being an active member in RTC ❤️'}
              </h2>
            </div>

            <div className="pt-6 border-t border-dashed w-full flex flex-col items-center justify-center gap-4">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span>
                  {isRTL
                    ? `ستتم إعادة التهيئة للعملية القادمة تلقائياً خلال ${countdown} ثوان...`
                    : `Resetting for the next volunteer in ${countdown}s...`}
                </span>
              </div>
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
    );
  }

  const currentBranchName = branches.find(b => b.id === selectedBranchId)?.[isRTL ? 'name_ar' : 'name'] || '';

  return (
    <div 
      className="min-h-screen bg-background text-foreground p-4 sm:p-8 space-y-6 flex flex-col justify-start" 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-success/10 p-6 border border-primary/10 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-success/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shrink-0">
            <ClipboardList className="h-7 w-7 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row items-baseline gap-2 flex-wrap select-none">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {isRTL ? 'تسجيل مشاركات الميداني' : 'Field Participation Logging'}
            </h1>
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  type="button" 
                  className="text-base font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-4 decoration-dashed transition-all focus:outline-none"
                >
                  {isRTL ? `(فرع ${currentBranchName || 'المهندسين'})` : `(${currentBranchName || 'Mohandseen'} Branch)`}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 bg-popover text-popover-foreground border border-border shadow-lg rounded-xl">
                <p className="text-xs text-muted-foreground px-2 py-1.5 font-medium border-b mb-1">
                  {isRTL ? 'تغيير الفرع الحالي:' : 'Change Current Branch:'}
                </p>
                <div className="space-y-1">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBranchChange(b.id)}
                      className={cn(
                        "w-full text-start px-2 py-1.5 text-sm rounded-md transition-colors font-medium flex items-center justify-between",
                        b.id === selectedBranchId 
                          ? "bg-primary/10 text-primary" 
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <span>{isRTL ? b.name_ar : b.name}</span>
                      {b.id === selectedBranchId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-3 relative z-10">
          <Button 
            variant="outline" 
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} 
            className="rounded-full h-10 border-2 hover:border-primary/50 transition-colors px-4 font-semibold text-sm"
          >
            {language === 'en' ? 'العربية' : 'English'}
          </Button>
        </div>
      </div>



      {/* Main Grid Section */}
      <div className="max-w-6xl mx-auto w-full grid gap-8 lg:grid-cols-2 flex-1">
        
        {/* Left Column: Logging Form */}
        <Card className="border-0 shadow-xl bg-gradient-to-b from-card to-card/95 overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{isRTL ? 'تسجيل مشاركة جديدة بالميداني' : 'Log New Field Participation'}</CardTitle>
                <CardDescription className="text-sm">
                  {isRTL ? 'تحقق من رقم هاتفك لتسجيل مشاركتك' : 'Verify your phone number to log your participation'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Phone Lookup Field */}
              <div className="space-y-2.5">
                <Label htmlFor="phone-input" className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {isRTL ? 'رقم الموبايل' : 'Mobile Number'} <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="phone-input"
                      ref={phoneInputRef}
                      type="tel"
                      placeholder={isRTL ? 'مثال: 01012345678' : 'e.g. 01012345678'}
                      value={phone}
                      onChange={handlePhoneChange}
                      className="h-12 text-base px-4 border-2 hover:border-primary/50 transition-colors bg-background"
                      disabled={searchLoading || submitting}
                      dir="ltr"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => lookupVolunteer()}
                    disabled={searchLoading || submitting || !phone.trim()}
                    className="bg-primary hover:bg-primary/90 text-white rounded-lg h-12 px-6 font-bold flex items-center gap-2 shrink-0 shadow-md"
                  >
                    {searchLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span>{isRTL ? 'تحقق' : 'Verify'}</span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Conditional fields displayed once phone check is done */}
              {hasSearched && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Account Found Details */}
                  {volunteer ? (
                    <div className="bg-success/5 border border-success/20 p-5 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-foreground leading-none">
                          {volunteer.full_name_ar || volunteer.full_name}
                        </p>
                      </div>
                      <Avatar className="h-14 w-14 border-2 border-success/30 shadow-sm shrink-0">
                        <AvatarImage src={volunteer.avatar_url || undefined} />
                        <AvatarFallback className="text-lg bg-success/10 text-success font-bold">
                          {(volunteer.full_name_ar || volunteer.full_name)?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ) : (
                    <div className="bg-warning/5 border border-warning/20 p-5 rounded-2xl space-y-4">
                      <div>
                        <h4 className="text-base font-bold text-warning">
                          {isRTL ? 'الرقم غير مسجل كمتطوع' : 'Phone not registered as volunteer'}
                        </h4>
                      </div>
                      
                      <div className="space-y-2.5">
                        <Label htmlFor="guest-name-input" className="text-sm font-medium flex items-center gap-2">
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                          {isRTL ? 'الاسم بالكامل' : 'Full Name'} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="guest-name-input"
                          type="text"
                          placeholder={isRTL ? 'اكتب اسمك الثلاثي/الرباعي' : 'Enter your full name'}
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="h-12 text-base px-4 border-2 hover:border-primary/50 transition-colors bg-background"
                          disabled={submitting}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Committee Selection */}
                  <div className="space-y-2.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {isRTL ? 'اللجنة' : 'Select Committee'}
                    </Label>
                    <Select value={selectedCommitteeId} onValueChange={(value) => {
                      setSelectedCommitteeId(value);
                      setSelectedActivityId('');
                    }}>
                      <SelectTrigger className="h-12 text-base px-4 border-2 hover:border-primary/50 transition-colors bg-background">
                        <SelectValue placeholder={isRTL ? 'بدون لجنة' : 'No Committee'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general" className="text-base py-3 text-primary font-semibold">
                          {isRTL ? 'بدون لجنة' : 'No Committee'}
                        </SelectItem>
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
                    <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
                      <SelectTrigger className="h-12 text-base px-4 border-2 hover:border-primary/50 transition-colors bg-background">
                        <SelectValue placeholder={isRTL ? 'اختر نوع المهمة' : 'Select Activity Type'} />
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
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-dashed text-xs">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-muted-foreground leading-normal">
                          {isRTL ? selectedActivity.description_ar : selectedActivity.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Wore Vest Switch */}
                  <div className="relative flex items-center justify-between gap-6 p-5 border-2 rounded-xl bg-gradient-to-r from-accent/5 to-primary/5 hover:border-primary/30 transition-all group">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                        <Sparkles className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="vest-switch" className="text-base font-semibold cursor-pointer">
                          {isRTL ? 'كنت لابس الـ Vest 🦺' : 'Wore Activity Vest 🦺'}
                        </Label>
                        {!isRTL && (
                          <p className="text-xs text-muted-foreground">
                            Earn extra impact points by wearing the official activity vest
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      id="vest-switch"
                      checked={woreVest}
                      onCheckedChange={setWoreVest}
                      className="scale-110 shrink-0"
                      disabled={submitting}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2.5">
                    <Label htmlFor="desc-input" className="text-sm font-medium">{isRTL ? 'عملت ايه النهاردة؟ (اختياري)' : 'Description (Optional)'}</Label>
                    <Textarea
                      id="desc-input"
                      placeholder={isRTL ? 'مثال: نظمت كورس الانجليزي، نظمت انترفيو...' : 'e.g. sorted clothes, calls outreach, food packing...'}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-background border-2 hover:border-primary/50 focus:border-primary/50 transition-colors rounded-xl min-h-[90px]"
                      disabled={submitting}
                    />
                  </div>



                  {/* Submit Button Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-bold text-lg h-14 rounded-xl flex-1 shadow-lg hover:shadow-xl transition-all"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {isRTL ? 'جاري التسجيل...' : 'Logging...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                          {isRTL ? 'تأكيد تسجيل المشاركة' : 'Confirm Participation'}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      disabled={submitting}
                      className="border-2 hover:bg-muted/50 rounded-xl h-14 px-6 text-base"
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>

                </div>
              )}

            </form>
          </CardContent>
        </Card>

        {/* Right Column: History panel / welcoming state */}
        <Card className="border-0 shadow-xl bg-gradient-to-b from-card to-card/95 overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{isRTL ? 'سجل المشاركات الأخيرة للميداني' : 'Recent Field Participations'}</CardTitle>
                <CardDescription className="text-sm">
                  {isRTL ? 'آخر المشاركات التي قمت بتسجيلها مؤخراً' : 'Your past registered check-ins on this mobile number'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            {!hasSearched ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center shadow-inner animate-pulse">
                  <Phone className="h-10 w-10 text-muted-foreground/30" />
                </div>
              </div>
            ) : loadingSubmissions ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{isRTL ? 'جاري تحميل السجل...' : 'Loading history...'}</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <History className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-muted-foreground">{isRTL ? 'لا توجد مشاركات مسجلة' : 'No logged participations'}</p>
                  <p className="text-xs text-muted-foreground/70 max-w-[200px] mx-auto">
                    {isRTL ? 'سجل مشاركتك الأولى بالميداني اليوم!' : 'Be the first to log your field visit today!'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="relative overflow-hidden rounded-xl border border-border bg-card hover:bg-muted/10 p-4 transition-all duration-300 hover:shadow-md hover:border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    {/* Status accent bar */}
                    <div className={cn(
                      "absolute top-0 bottom-0 start-0 w-1.5",
                      sub.status === 'approved' ? 'bg-success' :
                      sub.status === 'rejected' ? 'bg-destructive' : 'bg-warning'
                    )} />

                    <div className="flex items-start gap-3 flex-1 min-w-0 ps-3">
                      <div className="h-11 w-11 shrink-0 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10 shadow-sm">
                        <Activity className="h-5.5 w-5.5 text-primary/60" />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-snug break-words">
                          {sub.activity_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 shrink-0 bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-md font-medium">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span>{sub.committee_name}</span>
                          </span>
                          <span className="text-muted-foreground/30">•</span>
                          <span className="shrink-0">{formatDate(sub.submitted_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col sm:items-end justify-between sm:justify-center items-center gap-2 pt-2.5 sm:pt-0 border-t sm:border-0 border-border/40 min-w-[90px] ps-3 sm:ps-0">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary shadow-sm border border-primary/5" dir="ltr">
                        +{sub.points}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Monthly Course Schedule Section */}
      <div className="max-w-6xl mx-auto w-full">
        <CourseSchedule isKiosk={true} branchId={selectedBranchId} />
      </div>

    </div>
  );
}
