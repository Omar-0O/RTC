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
import { CheckCircle2, Loader2, History, Upload, X, Image as ImageIcon, Check, ChevronsUpDown, Users } from 'lucide-react';
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
  committee_id: string | null;
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

  const isLeader = primaryRole === 'committee_leader' || primaryRole === 'head_hr' || primaryRole === 'admin' || primaryRole === 'supervisor' || primaryRole === 'head_caravans' || primaryRole === 'head_events';

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
    a => {
      const matchesCommittee = !a.committee_id || a.committee_id === committeeId;
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

  // Logic to include leader
  const [includeMe, setIncludeMe] = useState(false);

  // Effect to add/remove leader from selection if 'Include Me' is toggled (special handling)
  // Actually easier to just handle it in submit logic, but let's visualize it.
  // Or just add "Me" to the list? No, "Me" is the logged in user.
  // Let's handle it in submit logic as a separate insert or add to batch.

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
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-success to-success/80 mb-4 animate-bounce shadow-lg">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary via-success to-accent bg-clip-text text-transparent">
                  {isRTL ? 'شكرا لأنك عضو فعال في RTC ❤️' : 'Thank you for being an active member in RTC ❤️'}
                </h2>

                {isGroupSubmission && (
                  <p className="text-muted-foreground mb-4">
                    {isRTL ? 'تم إنشاء تقرير المجموعة بنجاح' : 'Group report generated successfully'}
                  </p>
                )}

                <Button
                  onClick={handleReset}
                  size="lg"
                  className="w-full sm:w-auto mt-6"
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
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl">{isRTL ? 'تسجيل مشاركة جديدة' : 'Log New Participation'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <form onSubmit={handleSubmit} className="space-y-8">

              {/* Leader Group Toggle */}
              {isLeader && (
                <div className="flex items-center justify-between p-6 border rounded-xl bg-accent/5 hover:bg-accent/10 transition-colors">
                  <div className="space-y-1">
                    <Label htmlFor="group-toggle" className="text-lg font-medium cursor-pointer">{isRTL ? 'مشاركة جماعية' : 'Group Submission'}</Label>
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? 'تسجيل مشاركة لمجموعة من المتطوعين' : 'Log participation for a group of volunteers'}
                    </p>
                  </div>
                  <Switch
                    id="group-toggle"
                    checked={isGroupSubmission}
                    onCheckedChange={setIsGroupSubmission}
                    className="scale-125"
                  />
                </div>
              )}

              {/* Committee Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">{t('activityLog.selectCommittee')} <span className="text-destructive">*</span></Label>
                <Select value={committeeId} onValueChange={(value) => {
                  setCommitteeId(value);
                  setActivityId('');
                }}>
                  <SelectTrigger className="h-12 text-base px-4">
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
              <div className="space-y-3">
                <Label className="text-base font-medium">{isRTL ? 'تاريخ النشاط' : 'Activity Date'} <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="h-12 text-base px-4"
                />
              </div>



              {/* Activity Type */}
              <div className="space-y-3">
                <Label className="text-base font-medium">{t('activityLog.selectActivity')} <span className="text-destructive">*</span></Label>
                <Select value={activityId} onValueChange={setActivityId} disabled={!committeeId}>
                  <SelectTrigger className="h-12 text-base px-4">
                    <SelectValue placeholder={committeeId ? t('activityLog.selectActivity') : t('activityLog.selectCommittee')} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredActivities.map((activity) => (
                      <SelectItem key={activity.id} value={activity.id} className="py-3">
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="text-base font-medium">{isRTL ? activity.name_ar : activity.name}</span>
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            +{activity.points} {isRTL ? 'نقطة' : 'pts'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedActivity?.description && (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border border-dashed">
                    {isRTL ? selectedActivity.description_ar : selectedActivity.description}
                  </p>
                )}
              </div>

              {/* Group Submission Fields */}
              {isGroupSubmission ? (
                <div className="space-y-6 border-t pt-4">
                  {/* Participate Self */}
                  <div className="flex items-center space-x-2 space-x-reverse bg-accent/5 p-4 rounded-lg border">
                    <Switch id="include-me" checked={includeMe} onCheckedChange={setIncludeMe} className="scale-110" />
                    <Label htmlFor="include-me" className="text-base font-medium cursor-pointer flex-1">{isRTL ? 'مشاركتي ضمن المجموعة' : 'Include my participation'}</Label>
                  </div>

                  {/* Select Volunteers */}
                  <div className="space-y-2">
                    <Label>{isRTL ? 'اختر المتطوعين' : 'Select Volunteers'}</Label>
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCombobox}
                          className="w-full justify-between h-12 text-base px-4"
                        >
                          {selectedVolunteers.length > 0
                            ? isRTL
                              ? `تم اختيار ${selectedVolunteers.length} متطوع`
                              : `${selectedVolunteers.length} volunteers selected`
                            : isRTL ? 'اختر المتطوعين...' : 'Select volunteers...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder={isRTL ? 'بحث عن متطوع...' : 'Search volunteer...'} />
                          <CommandList>
                            <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No volunteer found.'}</CommandEmpty>
                            <CommandGroup>
                              {volunteers.map((volunteer) => (
                                <CommandItem
                                  key={volunteer.id}
                                  value={`${volunteer.full_name}-${volunteer.id}`} // Ensure unique value
                                  onSelect={() => toggleVolunteer(volunteer.id)}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedVolunteers.includes(volunteer.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={volunteer.avatar_url || undefined} />
                                      <AvatarFallback className="text-[10px]">
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
                  </div>
                </div>
              ) : (
                /* Individual Fields */
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Location Selection */}
                    <div className="space-y-3">
                      <Label>{t('activityLog.location')}</Label>
                      <RadioGroup value={location} onValueChange={(val) => {
                        setLocation(val);
                        if (val !== 'branch') setWoreVest(false); // Reset vest if not branch
                      }} className="flex gap-4">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <RadioGroupItem value="branch" id="branch" />
                          <Label htmlFor="branch" className="cursor-pointer">{t('activityLog.branch')}</Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <RadioGroupItem value="home" id="home" />
                          <Label htmlFor="home" className="cursor-pointer">{t('activityLog.home')}</Label>
                        </div>
                      </RadioGroup>
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

                  {/* Vest Checkbox - Only for branch activities */}
                  {location === 'branch' && (
                    <div className="space-y-3 p-4 border rounded-lg bg-warning/5 border-warning/20">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Switch
                          id="wore-vest"
                          checked={woreVest}
                          onCheckedChange={setWoreVest}
                          className="scale-110"
                        />
                        <Label htmlFor="wore-vest" className="text-base font-medium cursor-pointer flex-1">
                          {isRTL ? 'كنت أرتدي الـ Vest' : 'I wore the vest'}
                        </Label>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                        <span className="text-lg">⚠️</span>
                        <p className="text-sm text-foreground">
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
              <div className="space-y-3">
                <Label className="text-base font-medium">{t('activityLog.notes')}</Label>
                <Textarea
                  placeholder={t('activityLog.notesPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="resize-none text-base p-4 min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {description.length}/1000
                </p>
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
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">{isRTL ? 'ملخص المشاركة' : 'Submission Summary'}</h4>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-background rounded-lg p-3 text-center border">
                      <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'المتطوعين' : 'Volunteers'}</p>
                      <p className="font-bold text-lg">{selectedVolunteers.length + (includeMe ? 1 : 0)}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3 text-center border border-primary/20 bg-primary/5">
                      <p className="text-xs text-primary mb-1">{isRTL ? 'إجمالي النقاط' : 'Total Points'}</p>
                      <p className="font-bold text-lg text-primary">{selectedActivity.points * (selectedVolunteers.length + (includeMe ? 1 : 0))}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
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

        {/* Group Submissions History for Leaders */}
        {
          isLeader && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {isRTL ? 'سجل المشاركات الجماعية' : 'Group Submissions History'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'تقارير المشاركات الجماعية التي قمت بتسجيلها' : 'Group submissions reports you have logged'}
                </CardDescription>
              </CardHeader>
              <CardContent>
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

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;

  if (submissions.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        {isRTL ? 'لا توجد مشاركات جماعية' : 'No group submissions found'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((sub) => (
        <div key={sub.id} className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <p className="font-medium">
              {isRTL ? sub.activity?.name_ar : sub.activity?.name}
            </p>
            <div className="text-sm text-muted-foreground flex gap-2">
              <span>{new Date(sub.submitted_at).toLocaleDateString()}</span>
              <span>•</span>
              <span>{isRTL ? sub.committee?.name_ar : sub.committee?.name}</span>
              {Array.isArray(sub.guest_participants) && sub.guest_participants.length > 0 && (
                <>
                  <span>•</span>
                  <span>{sub.guest_participants.length} {isRTL ? 'ضيوف' : 'Guests'}</span>
                </>
              )}
            </div>
          </div>

          {sub.excel_sheet_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={sub.excel_sheet_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <Upload className="h-4 w-4 rotate-180" /> {/* Download icon proxy */}
                {isRTL ? 'تحميل التقرير' : 'Download Report'}
              </a>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

