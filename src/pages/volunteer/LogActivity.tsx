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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, History, Upload, X, Image as ImageIcon, Check, ChevronsUpDown, Users, Building2, Calendar, Activity, FileText, MapPin, Shirt, Sparkles, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateGroupSubmissionCSV } from '@/utils/excel';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

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
  points_with_vest: number | null; // Points if wore vest
  points_without_vest: number | null; // Points if didn't wear vest
  mode: 'individual' | 'group';
  committee_id: string | null; // Deprecated, use committee_ids
  committee_ids: string[]; // Committee IDs from activity_type_committees
  created_at: string;
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

interface Volunteer {
  id: string;
  full_name: string;
  phone?: string;
  avatar_url?: string | null;
}





const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function LogActivity() {
  const { user, profile, refreshProfile, primaryRole } = useAuth();
  const { t, isRTL, language } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [committeeId, setCommitteeId] = useState(profile?.committee_id || '');
  const [activityId, setActivityId] = useState('');
  const [activityDate, setActivityDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('branch');
  const [woreVest, setWoreVest] = useState(false); // Track if volunteer wore vest
  const [participantsCount, setParticipantsCount] = useState('1');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);



  // Group Submission State
  const [isGroupSubmission, setIsGroupSubmission] = useState(false);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [includeMe, setIncludeMe] = useState(false);

  const isLeader = primaryRole === 'committee_leader' || primaryRole === 'head_hr' || primaryRole === 'admin' || primaryRole === 'supervisor' || primaryRole === 'head_caravans' || primaryRole === 'head_events' || primaryRole === 'head_ethics' || primaryRole === 'head_quran' || primaryRole === 'head_ashbal';

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    if (profile?.committee_id && !committeeId) {
      setCommitteeId(profile.committee_id);
    }
  }, [profile?.committee_id, committeeId]);



  useEffect(() => {
    if (isGroupSubmission) {
      fetchVolunteers();
    }
  }, [isGroupSubmission]);

  const fetchVolunteers = async () => {
    try {
      // First, get all volunteers
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Then, get admin user IDs
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      // Filter out admins
      const adminIds = new Set((adminRoles || []).map(r => r.user_id));
      const filteredProfiles = (profilesData || []).filter(v => !adminIds.has(v.id));

      // Sanitize data to prevent crashes if full_name is null
      const sanitizedData = filteredProfiles.map(v => ({
        id: v.id,
        full_name: v.full_name || 'Unknown Volunteer', // Fallback for null names
        phone: v.phone || undefined,
        avatar_url: v.avatar_url
      }));

      setVolunteers(sanitizedData);
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [committeesRes, activitiesRes, activityCommitteesRes, submissionsRes] = await Promise.all([
        supabase.from('committees').select('id, name, name_ar').order('name'),
        supabase.from('activity_types').select('*').order('name'),
        supabase.from('activity_type_committees').select('activity_type_id, committee_id'),
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

      // Build activity_type_id -> committee_ids map
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
        const activitiesWithCommittees = activitiesRes.data.map((a: any) => ({
          ...a,
          committee_ids: activityCommitteeMap.get(a.id) || []
        }));
        setActivityTypes(activitiesWithCommittees);
      }
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
    a => {
      // If 'general' is selected, show only activities without committee restrictions
      // If a specific committee is selected, show activities with no restrictions OR that include this committee
      const matchesCommittee = committeeId === 'general'
        ? a.committee_ids.length === 0  // Only general activities
        : a.committee_ids.length === 0 || a.committee_ids.includes(committeeId);  // General + committee-specific
      const matchesMode = isGroupSubmission ? a.mode === 'group' : a.mode === 'individual';
      return matchesCommittee && matchesMode;
    }
  );
  const selectedActivity = activityTypes.find(a => a.id === activityId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
      return;
    }

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

  const uploadProof = async (pathPrefix: string = 'activity-proofs'): Promise<string | null> => {
    if (!proofFile || !user) return null;

    setIsUploading(true);
    try {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(pathPrefix)
        .upload(fileName, proofFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(pathPrefix)
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

  const uploadExcel = async (excelBlob: Blob, activityName: string, date: string): Promise<string | null> => {
    if (!user) return null;
    try {
      // Sanitize activity name for filename (remove special characters)
      const sanitizedName = activityName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').replace(/\s+/g, '_');
      const fileName = `${user.id}/group-reports/${sanitizedName}_${date}.xlsx`;

      const { error: uploadError } = await supabase.storage
        .from('activity-proofs') // Reusing same bucket or create new one
        .upload(fileName, excelBlob);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('activity-proofs')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading excel:', error);
      return null;
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedActivity) return;

    if (!committeeId || !activityId) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields');
      return;
    }

    if (isGroupSubmission) {
      if (selectedVolunteers.length === 0) {
        toast.error(isRTL ? 'يرجى اختيار مشاركين' : 'Please select participants');
        return;
      }
    }



    setIsSubmitting(true);

    try {
      let proofUrl: string | null = null;
      if (proofFile) {
        proofUrl = await uploadProof();
      }

      // Calculate points based on vest wearing
      const pointsAwarded = location === 'branch' && woreVest
        ? (selectedActivity.points_with_vest ?? selectedActivity.points)
        : location === 'branch' && !woreVest
          ? (selectedActivity.points_without_vest ?? selectedActivity.points)
          : selectedActivity.points; // Home activities get default points

      const submissionData = {
        activity_type_id: activityId,
        committee_id: committeeId,
        description: description.trim(),
        location: location,
        wore_vest: location === 'branch' ? woreVest : false, // Only track vest for branch activities
        points_awarded: pointsAwarded,
        participant_type: 'volunteer' as const, // Default to volunteer
        volunteer_id: user.id, // Explicitly set volunteer_id again
        status: (isLeader ? 'approved' : 'pending') as "pending" | "approved" | "rejected",
        reviewed_at: (isLeader ? new Date().toISOString() : null),
        reviewed_by: (isLeader ? user.id : null),
        proof_url: proofUrl,
        submitted_at: new Date(activityDate).toISOString(),
      };

      if (isGroupSubmission) {
        const participantsForExcel = [
          // Selected Volunteers
          ...selectedVolunteers.map(id => {
            const v = volunteers.find(v => v.id === id);
            return {
              name: v?.full_name || 'Unknown',
              phone: v?.phone || '',
              type: 'volunteer' as const,
              points: selectedActivity.points
            };
          }),
          // Leader (if included)
          ...(includeMe ? [{
            name: profile.full_name || 'Leader',
            phone: profile.phone || '',
            type: 'volunteer' as const,
            points: selectedActivity.points,
            role: 'Leader'
          }] : [])
        ];

        const excelBlob = generateGroupSubmissionCSV({
          leaderName: profile.full_name || 'Leader',
          activityName: isRTL ? selectedActivity.name_ar : selectedActivity.name,
          committeeName: committees.find(c => c.id === committeeId)?.name || '',
          date: new Date().toLocaleDateString(),
          participants: participantsForExcel
        });

        const excelUrl = await uploadExcel(
          excelBlob,
          isRTL ? selectedActivity.name_ar : selectedActivity.name,
          new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
        );

        // Create Group Submission Record
        const { data: groupSub, error: groupError } = await supabase
          .from('group_submissions')
          .insert({
            leader_id: user.id,
            activity_type_id: activityId,
            committee_id: committeeId,
            guest_participants: null,
            excel_sheet_url: excelUrl,
            submitted_at: new Date(activityDate).toISOString()
          })
          .select()
          .single();

        if (groupError) throw groupError;

        // Prepare list of volunteer IDs to insert submissions for
        const volunteerIdsToSubmit = [...selectedVolunteers];
        if (includeMe) {
          volunteerIdsToSubmit.push(user.id);
        }

        // Insert Submissions for Volunteers (and Leader if included)
        if (volunteerIdsToSubmit.length > 0) {
          const submissionsToInsert = volunteerIdsToSubmit.map(volId => ({
            volunteer_id: volId,
            group_submission_id: groupSub.id,
            participants_count: 1, // Individual within group
            ...submissionData
          }));

          const { error: batchError } = await supabase
            .from('activity_submissions')
            .insert(submissionsToInsert);

          if (batchError) throw batchError;
        }

      } else {
        // Individual Submission
        const { error } = await supabase.from('activity_submissions').insert({
          volunteer_id: user.id, // Ensure volunteer_id is set
          participants_count: selectedActivity.mode === 'group' ? parseInt(participantsCount) || 1 : 1,
          status: (isLeader ? 'approved' : 'pending') as "pending" | "approved" | "rejected",
          ...submissionData
        });

        if (error) throw error;
      }

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
    setActivityDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setLocation('branch');
    setWoreVest(false);
    setParticipantsCount('1');
    setProofFile(null);
    setProofPreview(null);
    setIsSubmitted(false);
    setSelectedVolunteers([]);
    setIsGroupSubmission(false);
    setIsGroupSubmission(false);
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

  // Helper to toggle selection
  const toggleVolunteer = (id: string) => {
    setSelectedVolunteers(current =>
      current.includes(id)
        ? current.filter(i => i !== id)
        : [...current, id]
    );
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

            <div className="space-y-2 max-w-lg">
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-success to-emerald-600">
                {isRTL ? 'شكرا لأنك عضو فعال في RTC ❤️' : 'Thank you for being an active member in RTC ❤️'}
              </h2>
              <p className="text-muted-foreground text-lg">
                {isRTL ? 'تم تسجيل مشاركتك بنجاح! جميع جهودك مقدرة.' : 'Participation logged successfully! Your efforts are appreciated.'}
              </p>
            </div>

            {isGroupSubmission && (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 w-full flex items-center justify-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <p className="font-medium text-primary">
                  {isRTL ? 'تم إنشاء تقرير المجموعة بنجاح' : 'Group report generated successfully'}
                </p>
              </div>
            )}

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
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-success/10 p-6 border border-primary/10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-success/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
            <ClipboardList className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('activityLog.title')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isRTL ? 'سجّل مشاركتك واحصل على نقاطك!' : 'Log your participation and earn points!'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
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

              {/* Leader Group Toggle */}
              {isLeader && (
                <div className="relative flex items-center justify-between p-5 border-2 rounded-xl bg-gradient-to-r from-accent/5 to-primary/5 hover:border-primary/30 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-0.5">
                      <Label htmlFor="group-toggle" className="text-base font-semibold cursor-pointer">{isRTL ? 'مشاركة جماعية' : 'Group Submission'}</Label>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'تسجيل مشاركة لمجموعة من المتطوعين' : 'Log participation for a group of volunteers'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="group-toggle"
                    checked={isGroupSubmission}
                    onCheckedChange={setIsGroupSubmission}
                    className="scale-110"
                  />
                </div>
              )}

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
                    <SelectItem key="general" value="general" className="text-base py-3 font-medium">
                      {isRTL ? 'عام (بدون لجنة)' : 'General (No Committee)'}
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
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {isRTL ? 'تاريخ النشاط' : 'Activity Date'} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="h-12 text-base px-4 border-2 hover:border-primary/50 transition-colors"
                />
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
                            +{activity.points} {isRTL ? 'أثر' : 'pts'}
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

              {/* Group Submission Fields */}
              {isGroupSubmission ? (
                <div className="space-y-4 p-4 rounded-xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <h3 className="font-semibold flex items-center gap-2 text-primary">
                    <Users className="h-4 w-4" />
                    {isRTL ? 'إعدادات المجموعة' : 'Group Settings'}
                  </h3>

                  {/* Participate Self */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background border hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                        <Check className="h-4 w-4 text-success" />
                      </div>
                      <Label htmlFor="include-me" className="text-sm font-medium cursor-pointer">{isRTL ? 'مشاركتي ضمن المجموعة' : 'Include my participation'}</Label>
                    </div>
                    <Switch id="include-me" checked={includeMe} onCheckedChange={setIncludeMe} />
                  </div>

                  {/* Select Volunteers */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {isRTL ? 'اختر المتطوعين' : 'Select Volunteers'} <span className="text-destructive">*</span>
                    </Label>
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCombobox}
                          className="w-full justify-between h-12 text-base px-4 border-2 hover:border-primary/50 transition-colors"
                        >
                          {selectedVolunteers.length > 0
                            ? isRTL
                              ? `تم اختيار ${selectedVolunteers.length} متطوع`
                              : `${selectedVolunteers.length} volunteers selected`
                            : isRTL ? 'اختر المتطوعين...' : 'Select volunteers...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
                          <CommandList>
                            <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No volunteer found.'}</CommandEmpty>
                            <CommandGroup>
                              {volunteers.map((volunteer) => (
                                <CommandItem
                                  key={volunteer.id}
                                  value={`${volunteer.full_name}-${volunteer.id}`}
                                  onSelect={() => toggleVolunteer(volunteer.id)}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedVolunteers.includes(volunteer.id) ? "opacity-100 text-success" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7 border">
                                      <AvatarImage src={volunteer.avatar_url || undefined} />
                                      <AvatarFallback className="text-xs bg-primary/10">
                                        {(volunteer.full_name && volunteer.full_name.length > 0)
                                          ? volunteer.full_name.charAt(0).toUpperCase()
                                          : '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{volunteer.full_name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Selected volunteers chips */}
                    {selectedVolunteers.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedVolunteers.slice(0, 5).map(id => {
                          const v = volunteers.find(v => v.id === id);
                          return v ? (
                            <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">
                              {v.full_name?.split(' ')[0]}
                              <button type="button" onClick={() => toggleVolunteer(id)} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ) : null;
                        })}
                        {selectedVolunteers.length > 5 && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                            +{selectedVolunteers.length - 5} {isRTL ? 'آخرين' : 'more'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Individual Fields */
                <div className="space-y-4">
                  {/* Location Selection - as cards */}
                  <div className="space-y-2.5">
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

                  {selectedActivity?.mode === 'group' && (
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {isRTL ? 'عدد المشاركين' : 'Participants'}
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={participantsCount}
                        onChange={(e) => setParticipantsCount(e.target.value)}
                        className="h-12 border-2 hover:border-primary/50 transition-colors"
                      />
                    </div>
                  )}

                  {/* Vest Checkbox - Only for branch activities */}
                  {location === 'branch' && (
                    <div className="space-y-3 p-4 rounded-xl border-2 border-warning/30 bg-gradient-to-br from-warning/5 to-orange-500/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                            <Shirt className="h-5 w-5 text-warning" />
                          </div>
                          <Label htmlFor="wore-vest" className="text-sm font-semibold cursor-pointer">
                            {isRTL ? 'كنت أرتدي الـ Vest' : 'I wore the vest'}
                          </Label>
                        </div>
                        <Switch
                          id="wore-vest"
                          checked={woreVest}
                          onCheckedChange={setWoreVest}
                        />
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                        <span className="text-lg">⚠️</span>
                        <p className="text-xs text-foreground">
                          {isRTL
                            ? 'يجب إرسال صورتك بالـ Vest للـ HR المسؤول وإلا ستكون المشاركة غير مقبولة!'
                            : 'You must send your photo wearing the vest to the responsible HR, otherwise your participation will be rejected!'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {t('activityLog.notes')}
                  <span className="text-xs text-muted-foreground font-normal">({isRTL ? 'اختياري' : 'optional'})</span>
                </Label>
                <Textarea
                  placeholder={t('activityLog.notesPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="resize-none text-sm p-4 min-h-[100px] border-2 hover:border-primary/50 focus:border-primary transition-colors"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'أضف أي ملاحظات إضافية عن مشاركتك' : 'Add any additional notes about your participation'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {description.length}/1000
                  </p>
                </div>
              </div>

              {/* Proof Upload */}
              {/* Proof Upload - Excluded for volunteers and HR roles */}
              {primaryRole !== 'volunteer' && primaryRole !== 'hr' && primaryRole !== 'head_hr' && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">{isRTL ? 'صورة الإثبات (اختياري)' : 'Proof Image (Optional)'}</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {proofPreview ? (
                    <div className="relative group rounded-xl overflow-hidden border-2 border-primary/20">
                      <img
                        src={proofPreview}
                        alt="Proof preview"
                        className="w-full h-64 object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="w-12 h-12 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile();
                          }}
                        >
                          <X className="h-6 w-6" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-full h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-accent/5 hover:border-primary/50 transition-all group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <span className="text-base font-medium text-foreground">
                        {isRTL ? 'اضغط لرفع صورة' : 'Click to upload image'}
                      </span>
                      <span className="text-sm text-muted-foreground mt-1">
                        {isRTL ? 'الحد الأقصى 5 ميجابايت' : 'Max size 5MB'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Group Summary Preview */}
              {isGroupSubmission && selectedActivity && (
                <div className="rounded-xl overflow-hidden border-2 border-primary/20">
                  <div className="bg-gradient-to-r from-primary/10 to-success/10 px-4 py-3 border-b border-primary/20">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {isRTL ? 'ملخص المشاركة' : 'Submission Summary'}
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-primary/10">
                    <div className="p-4 text-center">
                      <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'المتطوعين' : 'Volunteers'}</p>
                      <p className="font-bold text-2xl">{selectedVolunteers.length + (includeMe ? 1 : 0)}</p>
                    </div>
                    <div className="p-4 text-center bg-gradient-to-br from-primary/5 to-transparent">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-xs text-primary mb-1">{isRTL ? 'إجمالي الأثر' : 'Total Points'}</p>
                      <p className="font-bold text-2xl text-primary">{selectedActivity.points * (selectedVolunteers.length + (includeMe ? 1 : 0))}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                disabled={!activityId || isSubmitting || isUploading}
              >
                {(isSubmitting || isUploading) ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isUploading
                      ? (isRTL ? 'جاري رفع الصورة...' : 'Uploading image...')
                      : (isRTL ? 'جاري التسجيل...' : 'Logging...')
                    }
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

        {/* Submission History */}
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
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/50">
                          <img
                            src={submission.proof_url}
                            alt="Proof"
                            className="h-full w-full object-cover transition-transform group-hover:scale-110"
                          />
                        </div>
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
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        +{submission.points}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Group Submissions History for Leaders */}
        {
          isLeader && (
            <Card className="lg:col-span-2 border-0 shadow-xl bg-gradient-to-b from-card to-card/95 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{isRTL ? 'سجل المشاركات الجماعية' : 'Group Submissions History'}</CardTitle>
                    <CardDescription className="text-sm">
                      {isRTL ? 'تقارير وشيتات المشاركات الجماعية التي أرسلتها' : 'Group submissions reports & sheets you have sent'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <GroupSubmissionsList leaderId={user?.id} />
              </CardContent>
            </Card>
          )
        }
      </div >
    </div >
  );
}

function GroupSubmissionsList({ leaderId }: { leaderId?: string }) {
  const { isRTL } = useLanguage();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (leaderId) fetchGroupSubmissions();
  }, [leaderId]);

  const fetchGroupSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('group_submissions')
        .select(`
          id,
          submitted_at,
          excel_sheet_url,
          activity:activity_types(name, name_ar),
          committee:committees(name, name_ar),
          guest_participants
        `)
        .eq('leader_id', leaderId)
        .order('submitted_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching group submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Users className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-muted-foreground">{isRTL ? 'لا توجد مشاركات جماعية' : 'No group submissions found'}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {submissions.map((sub) => (
        <div key={sub.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
              <ClipboardList className="h-5 w-5 text-accent" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm text-foreground">
                {isRTL ? sub.activity?.name_ar : sub.activity?.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(sub.submitted_at).toLocaleDateString()}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {isRTL ? sub.committee?.name_ar : sub.committee?.name}
                </span>
                {Array.isArray(sub.guest_participants) && sub.guest_participants.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {sub.guest_participants.length} {isRTL ? 'ضيوف' : 'Guests'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {sub.excel_sheet_url && (
            <Button variant="outline" size="sm" asChild className="ml-4 hover:bg-primary hover:text-white transition-colors">
              <a href={sub.excel_sheet_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <Upload className="h-4 w-4 rotate-180" />
                {isRTL ? 'تحميل التقرير' : 'Download Report'}
              </a>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

