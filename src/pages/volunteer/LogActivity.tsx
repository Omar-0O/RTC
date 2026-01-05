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
  category: string;
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
}

interface GuestParticipant {
  name: string;
  phone: string;
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
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('branch');
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
  const [guestsCount, setGuestsCount] = useState(0);
  const [guestParticipants, setGuestParticipants] = useState<GuestParticipant[]>([]);

  const isLeader = primaryRole === 'committee_leader' || primaryRole === 'head_hr' || primaryRole === 'admin' || primaryRole === 'supervisor';

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    // Reset guests array when count changes
    setGuestParticipants(prev => {
      const newGuests = [...prev];
      if (guestsCount > newGuests.length) {
        // Add empty slots
        for (let i = newGuests.length; i < guestsCount; i++) {
          newGuests.push({ name: '', phone: '' });
        }
      } else if (guestsCount < newGuests.length) {
        // Remove excess
        newGuests.splice(guestsCount);
      }
      return newGuests;
    });
  }, [guestsCount]);

  useEffect(() => {
    if (isGroupSubmission && committeeId) {
      fetchVolunteers();
    }
  }, [isGroupSubmission, committeeId]);

  const fetchVolunteers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('committee_id', committeeId)
        .neq('id', user?.id) // Exclude self (leader is auto-added or handled separately)
        .order('full_name');

      if (error) throw error;
      setVolunteers(data || []);
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

  const uploadExcel = async (excelBlob: Blob): Promise<string | null> => {
    if (!user) return null;
    try {
      const fileName = `${user.id}/group-reports/${Date.now()}.csv`;
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

  const handleGuestChange = (index: number, field: keyof GuestParticipant, value: string) => {
    const newGuests = [...guestParticipants];
    newGuests[index] = { ...newGuests[index], [field]: value };
    setGuestParticipants(newGuests);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedActivity) return;

    if (!committeeId || !activityId) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields');
      return;
    }

    if (isGroupSubmission) {
      if (selectedVolunteers.length === 0 && guestsCount === 0) {
        toast.error(isRTL ? 'يرجى اختيار مشاركين' : 'Please select participants');
        return;
      }
      // Check if including self
      // Actually "Include Self" is essentially selecting yourself or logging normally.
      // For simplicity, let's assume the Leader is submitting FOR the group.
      // If the leader wants credit, they should select themselves or we add a toggle "Include me".
      // Let's add the leader to the list implicitly or explicitly? 
      // The requirement says: "record group participations with or without his participation".
      // We will add a logic to handle "Include Me" later if needed, but for now let's assume he can select himself if he appeared in list (but I filtered him out).
      // Let's assume he needs a separate "Include me" checkbox or simple logic.
      // Wait, let's look at requirements again: "with or without his participation".
    }

    setIsSubmitting(true);

    try {
      let proofUrl: string | null = null;
      if (proofFile) {
        proofUrl = await uploadProof();
      }

      const submissionData = {
        activity_type_id: activityId,
        committee_id: committeeId,
        description: description.trim(),
        location: location,
        points_awarded: selectedActivity.points,
        status: 'approved', // Auto-approved? usually committee leader submissions are trustworthy? 
        // Or maybe pending if configured. Let's stick to 'approved' for now as per leader logic usually.
        // But wait, user role logic: 
        // If leader -> 'approved' (since they are leader)
        // If volunteer -> 'pending' (unless auto-approve rules)
        // Let's stick to default behavior or enforce 'approved' for leader.
        // We'll set it to 'approved' if user is leader.
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id, // Leader approves it effectively
        proof_url: proofUrl,
      };

      if (isGroupSubmission) {
        // Prepare participants list for Excel and DB
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
          }] : []),
          // Guests
          ...guestParticipants.filter(g => g.name).map(g => ({
            name: g.name,
            phone: g.phone,
            type: 'guest' as const,
            points: 0
          }))
        ];

        const excelBlob = generateGroupSubmissionCSV({
          leaderName: profile.full_name || 'Leader',
          activityName: isRTL ? selectedActivity.name_ar : selectedActivity.name,
          committeeName: committees.find(c => c.id === committeeId)?.name || '',
          date: new Date().toLocaleDateString(),
          participants: participantsForExcel
        });

        const excelUrl = await uploadExcel(excelBlob);

        // Create Group Submission Record
        const { data: groupSub, error: groupError } = await supabase
          .from('group_submissions')
          .insert({
            leader_id: user.id,
            activity_type_id: activityId,
            committee_id: committeeId,
            guest_participants: guestParticipants.filter(g => g.name) as any,
            excel_sheet_url: excelUrl,
            submitted_at: new Date().toISOString()
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
          volunteer_id: user.id,
          participants_count: selectedActivity.mode === 'group' ? parseInt(participantsCount) || 1 : 1,
          status: isLeader ? 'approved' : 'pending', // Auto-approve if leader
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
    setDescription('');
    setLocation('branch');
    setParticipantsCount('1');
    setProofFile(null);
    setProofPreview(null);
    setIsSubmitted(false);
    setSelectedVolunteers([]);
    setGuestsCount(0);
    setGuestParticipants([]);
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'تسجيل مشاركة جديدة' : 'Log New Participation'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Leader Group Toggle */}
              {isLeader && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-base">{isRTL ? 'مشاركة جماعية' : 'Group Submission'}</Label>
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? 'تسجيل مشاركة لمجموعة من المتطوعين' : 'Log participation for a group of volunteers'}
                    </p>
                  </div>
                  <Switch
                    checked={isGroupSubmission}
                    onCheckedChange={setIsGroupSubmission}
                  />
                </div>
              )}

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

              {/* Group Submission Fields */}
              {isGroupSubmission ? (
                <div className="space-y-6 border-t pt-4">
                  {/* Participate Self */}
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Switch id="include-me" checked={includeMe} onCheckedChange={setIncludeMe} />
                    <Label htmlFor="include-me">{isRTL ? 'مشاركتي ضمن المجموعة' : 'Include my participation'}</Label>
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
                          className="w-full justify-between"
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
                                  value={volunteer.full_name}
                                  onSelect={() => toggleVolunteer(volunteer.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedVolunteers.includes(volunteer.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {volunteer.full_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Guests */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? 'عدد المشاركين الغير متطوعين (ضيوف)' : 'Number of Guest Participants'}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={guestsCount}
                        onChange={(e) => setGuestsCount(parseInt(e.target.value) || 0)}
                      />
                    </div>

                    {guestParticipants.length > 0 && (
                      <div className="space-y-4 pl-4 border-l-2">
                        {guestParticipants.map((guest, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Input
                              placeholder={isRTL ? `اسم الضيف ${idx + 1}` : `Guest ${idx + 1} Name`}
                              value={guest.name}
                              onChange={(e) => handleGuestChange(idx, 'name', e.target.value)}
                            />
                            <Input
                              placeholder={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                              value={guest.phone}
                              onChange={(e) => handleGuestChange(idx, 'phone', e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Individual Fields */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Location Selection */}
                  <div className="space-y-3">
                    <Label>{t('activityLog.location')}</Label>
                    <RadioGroup value={location} onValueChange={setLocation} className="flex gap-4">
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
              )}

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
              {/* Proof Upload - Excluded for volunteers and HR roles */}
              {primaryRole !== 'volunteer' && primaryRole !== 'hr' && primaryRole !== 'head_hr' && (
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
              )}

              {/* Group Summary Preview */}
              {isGroupSubmission && selectedActivity && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">{isRTL ? 'ملخص المشاركة' : 'Submission Summary'}</h4>
                  <div className="text-sm space-y-1">
                    <p>{isRTL ? 'المتطوعين:' : 'Volunteers:'} {selectedVolunteers.length + (includeMe ? 1 : 0)}</p>
                    <p>{isRTL ? 'الضيوف:' : 'Guests:'} {guestsCount}</p>
                    <p>{isRTL ? 'إجمالي النقاط الموزعة:' : 'Total Points Distributed:'} {selectedActivity.points * (selectedVolunteers.length + (includeMe ? 1 : 0))}</p>
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

