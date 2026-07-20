import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { normalizePhoneE164 } from '@/utils/phoneUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
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
  FileText,
  Languages,
  Sun,
  Moon,
  Laptop,
  Upload,
  MapPin,
  Shirt,
  Image as ImageIcon,
  Users,
  ChevronsUpDown
} from 'lucide-react';
import { getSafeImageExtension, isSafeImageFile, SAFE_IMAGE_ACCEPT } from '@/utils/safeImages';
import { generateGroupSubmissionCSV } from '@/utils/excel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import logo from '@/assets/logo.webp';
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

type KioskSubmissionRow = {
  id: string;
  points_awarded: number | null;
  status: string;
  submitted_at: string;
  activity: { name: string; name_ar: string } | null;
  committee: { name: string; name_ar: string } | null;
};

type ApiError = {
  status?: number;
  code?: string;
  message?: string;
};

const isApiError = (value: unknown): value is ApiError =>
  typeof value === 'object' && value !== null;

export default function Kiosk() {
  const { isRTL, language, t, setLanguage } = useLanguage();
  const { setTheme } = useTheme();
  const { activeBranch, branches, canViewAllBranches } = useBranch();

  const [activeTab, setActiveTab] = useState<'schedule' | 'participation'>('schedule');
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

  const [location, setLocation] = useState<'branch' | 'home'>('branch');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  // Leader & Group Submission states
  const [isLeader, setIsLeader] = useState<boolean>(false);
  const [isGroupSubmission, setIsGroupSubmission] = useState<boolean>(false);
  const [volunteersList, setVolunteersList] = useState<VolunteerProfile[]>([]);
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([]);
  const [includeMe, setIncludeMe] = useState<boolean>(true);
  const [guests, setGuests] = useState<{ name: string; phone?: string }[]>([]);
  const [guestNameInput, setGuestNameInput] = useState<string>('');
  const [guestPhoneInput, setGuestPhoneInput] = useState<string>('');
  const [openCombobox, setOpenCombobox] = useState<boolean>(false);

  const fetchVolunteersList = useCallback(async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, full_name_ar, phone, avatar_url');

      if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data: profilesData, error: profilesError } = await query.order('full_name');
      if (profilesError) throw profilesError;

      const sanitized = (profilesData || []).map(v => ({
        ...v,
        full_name: v.full_name_ar || v.full_name || 'Unknown Volunteer'
      }));

      setVolunteersList(sanitized as VolunteerProfile[]);
    } catch (error) {
      console.error('Error fetching volunteers list:', error);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (isGroupSubmission) {
      fetchVolunteersList();
    }
  }, [isGroupSubmission, fetchVolunteersList]);

  const toggleVolunteer = (id: string) => {
    setSelectedVolunteers(prev =>
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    );
  };

  const addGuestItem = () => {
    if (!guestNameInput.trim()) return;
    setGuests(prev => [...prev, { name: guestNameInput.trim(), phone: guestPhoneInput.trim() || undefined }]);
    setGuestNameInput('');
    setGuestPhoneInput('');
  };

  const removeGuestItem = (index: number) => {
    setGuests(prev => prev.filter((_, i) => i !== index));
  };

  const uploadExcel = async (excelBlob: Blob, activityName: string, date: string, volunteerId: string): Promise<string | null> => {
    try {
      let sanitizedName = activityName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      if (!sanitizedName || sanitizedName.length < 3) sanitizedName = 'activity_report';
      const timestamp = new Date().getTime();
      const fileName = `${volunteerId}/group-reports/${sanitizedName}_${date}_${timestamp}.xlsx`;

      const { error: uploadError } = await supabase.storage
        .from('activity-proofs')
        .upload(fileName, excelBlob, {
          upsert: true,
          cacheControl: '3600',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

      if (uploadError) throw uploadError;
      return fileName;
    } catch (error) {
      console.error('Error uploading excel:', error);
      return null;
    }
  };

  // Submissions list
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);

  // Top 5 Volunteers list
  interface TopVolunteer {
    id: string;
    full_name: string;
    full_name_ar?: string;
    avatar_url?: string;
    count: number;
  }
  const [topVolunteers, setTopVolunteers] = useState<TopVolunteer[]>([]);
  const [loadingTopVolunteers, setLoadingTopVolunteers] = useState<boolean>(false);

  const loadTopVolunteers = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoadingTopVolunteers(true);
    try {
      const { data, error } = await supabase
        .from('activity_submissions')
        .select('volunteer_id, profiles:volunteer_id(id, full_name, full_name_ar, avatar_url)')
        .eq('branch_id', selectedBranchId)
        .eq('status', 'approved')
        .not('volunteer_id', 'is', null);

      if (error) throw error;

      const counts: Record<string, { profile: any; count: number }> = {};
      (data || []).forEach(sub => {
        if (!sub.volunteer_id || !sub.profiles) return;
        const prof = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
        if (!prof) return;
        if (!counts[sub.volunteer_id]) {
          counts[sub.volunteer_id] = { profile: prof, count: 0 };
        }
        counts[sub.volunteer_id].count += 1;
      });

      const sorted = Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(item => ({
          id: item.profile.id,
          full_name: item.profile.full_name || '',
          full_name_ar: item.profile.full_name_ar || '',
          avatar_url: item.profile.avatar_url,
          count: item.count
        }));

      setTopVolunteers(sorted);
    } catch (err) {
      console.error('Error fetching top volunteers for branch:', err);
    } finally {
      setLoadingTopVolunteers(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadTopVolunteers();
  }, [selectedBranchId, loadTopVolunteers]);

  // Calendar state
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);

  // Submission states
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSafeImageFile(file)) {
      toast.error(isRTL ? 'يرجى اختيار صورة بصيغة JPG أو PNG أو WebP' : 'Please select a JPG, PNG, or WebP image');
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

  const uploadProof = async (volunteerId?: string | null): Promise<string | null> => {
    if (!proofFile) return null;
    try {
      const fileExt = getSafeImageExtension(proofFile);
      const fileName = `${volunteerId || 'kiosk'}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('activity-proofs')
        .upload(fileName, proofFile, {
          cacheControl: '3600',
          contentType: proofFile.type,
        });

      if (uploadError) {
        console.error('Error uploading proof:', uploadError);
        return null;
      }
      return fileName;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  // Kiosks operate in the staff operator's branch. Only global roles can switch it.
  useEffect(() => {
    async function loadConfig() {
      try {
        const { data: committeeData } = await supabase.from('committees').select('*').order('name');
        setCommittees(committeeData || []);
      } catch (err) {
        console.error('Error loading kiosk config:', err);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    const savedBranchId = localStorage.getItem('rtc_kiosk_branch_id');
    if (savedBranchId) {
      setSelectedBranchId(savedBranchId);
      return;
    }

    if (!canViewAllBranches) {
      if (activeBranch?.id) {
        setSelectedBranchId(activeBranch.id);
      }
      return;
    }

    const defaultBranchId = activeBranch?.id || branches.find((branch) => branch.is_default)?.id || branches[0]?.id || '';
    setSelectedBranchId(defaultBranchId);
  }, [activeBranch?.id, branches, canViewAllBranches]);

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
          mappingData.forEach((item) => {
            if (!mappingMap.has(item.activity_type_id)) {
              mappingMap.set(item.activity_type_id, []);
            }
            mappingMap.get(item.activity_type_id)!.push(item.committee_id);
          });
        }

        if (activityData) {
          setActivityTypes(
            activityData.map((act) => ({
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
    if (!canViewAllBranches) return;
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

        // Check user_roles for leader permissions
        const LEADER_ROLES = [
          'committee_leader', 'head_hr', 'admin', 'supervisor', 'head_caravans',
          'head_events', 'head_ethics', 'head_quran', 'head_ashbal', 'head_marketing',
          'head_production', 'head_fourth_year', 'hr', 'head_media'
        ];
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.id);

        const userRoles = rolesData?.map((r: { role: string }) => r.role) || [];
        const hasLeaderRole = userRoles.some((r: string) => LEADER_ROLES.includes(r));
        setIsLeader(hasLeaderRole);

        const volunteerName = isRTL
          ? (data.full_name_ar || data.full_name)
          : (data.full_name || data.full_name_ar);

        toast.success(
          isRTL
            ? `مرحباً بك، ${volunteerName}`
            : `Welcome back, ${volunteerName}`
        );
        // Load recent submissions
        loadSubmissions(data.id, null);
      } else {
        setIsLeader(false);
        setIsGroupSubmission(false);
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
    } catch (err: unknown) {
      console.error('Error querying volunteer profile:', err);
      // Detect network/server errors specifically
      const isServerError = isApiError(err) && (
        (err.status ?? 0) >= 500 ||
        err.code === 'PGRST301' ||
        err.message?.includes('503') ||
        err.message?.includes('fetch')
      );
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
        const mapped = (data as unknown as KioskSubmissionRow[]).map((submission) => ({
          id: submission.id,
          activity_name: submission.activity?.name_ar || submission.activity?.name || '—',
          committee_name: submission.committee?.name_ar || submission.committee?.name || (isRTL ? 'عامة' : 'General'),
          points: submission.points_awarded || 0,
          status: submission.status,
          submitted_at: submission.submitted_at
        }));
        setSubmissions(mapped);
      }
    } catch (err) {
      console.error('Error loading submissions history:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Filter activities based on the selected committee and mode
  const filteredActivities = activityTypes.filter(act => {
    const matchesMode = isGroupSubmission ? act.mode === 'group' : act.mode === 'individual';

    // If 'general' or empty is selected, show only activities with no committee restrictions
    const matchesCommittee = act.committee_ids.length === 0 ||
      (selectedCommitteeId && selectedCommitteeId !== 'general' && act.committee_ids.includes(selectedCommitteeId));

    return matchesMode && matchesCommittee;
  });

  const selectedActivity = activityTypes.find(a => a.id === selectedActivityId);

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
      // Parse activity date to local noon to avoid time-zone mismatches
      const [year, month, day] = activityDate.split('-').map(Number);
      const submissionTimestamp = new Date(year, month - 1, day, 12, 0, 0).toISOString();

      const selectedActivity = activityTypes.find(a => a.id === selectedActivityId);
      let proofUrl: string | null = null;
      if (proofFile) {
        proofUrl = await uploadProof(volunteer?.id);
      }

      const pointsAwarded = selectedActivity ? (
        location === 'branch' && woreVest
          ? (selectedActivity.points_with_vest ?? selectedActivity.points)
          : location === 'branch' && !woreVest
            ? (selectedActivity.points_without_vest ?? selectedActivity.points)
            : selectedActivity.points
      ) : 0;

      if (isGroupSubmission) {
        if (selectedVolunteers.length === 0 && guests.length === 0) {
          toast.error(isRTL ? 'يرجى اختيار مشاركين أو إضافة ضيوف' : 'Please select participants or add guests');
          setSubmitting(false);
          return;
        }

        const participantsForExcel = [
          ...selectedVolunteers.map(id => {
            const v = volunteersList.find(vol => vol.id === id);
            return {
              name: v?.full_name_ar || v?.full_name || 'Unknown',
              phone: v?.phone || '',
              type: 'volunteer' as const,
              points: pointsAwarded
            };
          }),
          ...(includeMe && volunteer ? [{
            name: volunteer.full_name_ar || volunteer.full_name || 'Leader',
            phone: volunteer.phone || '',
            type: 'volunteer' as const,
            points: pointsAwarded,
            role: 'Leader'
          }] : []),
          ...guests.map(g => ({
            name: g.name,
            phone: g.phone || '',
            type: 'guest' as const,
            points: pointsAwarded,
            role: 'Guest'
          }))
        ];

        const excelBlob = await generateGroupSubmissionCSV({
          leaderName: volunteer?.full_name_ar || volunteer?.full_name || 'Leader',
          activityName: isRTL ? selectedActivity?.name_ar || selectedActivity?.name || '' : selectedActivity?.name || '',
          committeeName: committees.find(c => c.id === selectedCommitteeId)?.name || '',
          date: new Date().toLocaleDateString(),
          participants: participantsForExcel
        });

        const excelUrl = await uploadExcel(
          excelBlob,
          isRTL ? selectedActivity?.name_ar || selectedActivity?.name || '' : selectedActivity?.name || '',
          new Date().toLocaleDateString('en-CA'),
          volunteer?.id || 'kiosk'
        );

        // Create Group Submission Record
        const { data: groupSub, error: groupError } = await supabase
          .from('group_submissions')
          .insert({
            leader_id: volunteer?.id || null,
            activity_type_id: selectedActivityId,
            committee_id: selectedCommitteeId === 'general' ? null : selectedCommitteeId,
            guest_participants: guests.length > 0 ? guests : null,
            excel_sheet_url: excelUrl,
            submitted_at: submissionTimestamp,
            branch_id: selectedBranchId || null
          })
          .select()
          .single();

        if (groupError) throw groupError;

        // Prepare list of volunteer IDs to insert submissions for
        const volunteerIdsToSubmit = [...selectedVolunteers];
        if (includeMe && volunteer?.id) {
          volunteerIdsToSubmit.push(volunteer.id);
        }

        if (volunteerIdsToSubmit.length > 0) {
          const submissionsToInsert = volunteerIdsToSubmit.map(volId => ({
            volunteer_id: volId,
            activity_type_id: selectedActivityId,
            committee_id: selectedCommitteeId === 'general' ? null : selectedCommitteeId,
            description: description.trim(),
            location: location,
            wore_vest: location === 'branch' ? woreVest : false,
            points_awarded: pointsAwarded,
            participant_type: 'volunteer' as const,
            status: 'approved' as const,
            reviewed_at: new Date().toISOString(),
            reviewed_by: volunteer?.id || null,
            proof_url: proofUrl,
            submitted_at: submissionTimestamp,
            branch_id: selectedBranchId || null,
            group_submission_id: groupSub.id,
            participants_count: 1
          }));

          const { error: batchError } = await supabase
            .from('activity_submissions')
            .insert(submissionsToInsert);

          if (batchError) throw batchError;
        }

        if (guests.length > 0) {
          const guestSubmissions = guests.map(g => ({
            volunteer_id: null,
            guest_name: g.name,
            guest_phone: g.phone,
            activity_type_id: selectedActivityId,
            committee_id: selectedCommitteeId === 'general' ? null : selectedCommitteeId,
            description: description.trim(),
            location: location,
            wore_vest: location === 'branch' ? woreVest : false,
            points_awarded: pointsAwarded,
            participant_type: 'guest' as const,
            status: 'approved' as const,
            reviewed_at: new Date().toISOString(),
            reviewed_by: volunteer?.id || null,
            proof_url: proofUrl,
            submitted_at: submissionTimestamp,
            branch_id: selectedBranchId || null,
            group_submission_id: groupSub.id,
            participants_count: 1
          }));

          const { error: guestBatchError } = await supabase
            .from('activity_submissions')
            .insert(guestSubmissions);

          if (guestBatchError) throw guestBatchError;
        }

        loadTopVolunteers();
        setSuccess(true);
        return;
      }

      if (volunteer) {
        // Individual volunteer submission
        const { error } = await supabase.from('activity_submissions').insert({
          volunteer_id: volunteer.id,
          activity_type_id: selectedActivityId,
          committee_id: selectedCommitteeId === 'general' ? null : selectedCommitteeId,
          description: description.trim(),
          location: location,
          wore_vest: location === 'branch' ? woreVest : false,
          proof_url: proofUrl,
          points_awarded: pointsAwarded,
          participant_type: 'volunteer' as const,
          status: 'pending' as const,
          submitted_at: submissionTimestamp,
          branch_id: selectedBranchId || null,
          participants_count: 1
        });

        if (error) throw error;
      } else {
        // Guest submission
        const { error } = await supabase.from('activity_submissions').insert({
          volunteer_id: null,
          guest_name: guestName.trim(),
          guest_phone: normalizePhoneE164(phone),
          activity_type_id: selectedActivityId,
          committee_id: selectedCommitteeId === 'general' ? null : selectedCommitteeId,
          description: description.trim(),
          location: location,
          wore_vest: location === 'branch' ? woreVest : false,
          proof_url: proofUrl,
          points_awarded: pointsAwarded,
          participant_type: 'guest' as const,
          status: 'pending' as const,
          submitted_at: submissionTimestamp,
          branch_id: selectedBranchId || null,
          participants_count: 1
        });

        if (error) throw error;
      }

      loadTopVolunteers();
      setSuccess(true);
    } catch (err: unknown) {
      console.error('Kiosk submission failed:', err);
      toast.error(isRTL ? 'فشل في تسجيل المشاركة' : 'Failed to register participation');
    } finally {
      setSubmitting(false);
    }
  };

  // Success countdown trigger
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
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
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [success]);

  const handleReset = () => {
    setPhone('');
    setVolunteer(null);
    setGuestName('');
    setHasSearched(false);
    setSelectedCommitteeId('general');
    setSelectedActivityId('');
    setDescription('');
    setLocation('branch');
    setWoreVest(false);
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      className="min-h-screen bg-background text-foreground p-4 sm:p-8 space-y-6 flex flex-col justify-start pb-24"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-success/10 p-6 border border-primary/10 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-success/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shrink-0">
            {activeTab === 'schedule' ? (
              <CalendarIcon className="h-7 w-7 text-white" />
            ) : (
              <ClipboardList className="h-7 w-7 text-white" />
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-baseline gap-2 flex-wrap select-none">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {activeTab === 'schedule'
                ? (isRTL ? 'جدول الكورسات والفعاليات' : 'Course & Event Schedule')
                : (isRTL ? 'تسجيل مشاركات الميداني' : 'Field Participation Logging')}
            </h1>
            <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              {isRTL ? `فرع ${currentBranchName || 'المهندسين'}` : `${currentBranchName || 'Mohandseen'} Branch`}
            </span>
          </div>
        </div>

        {/* Opposite side view-switch button */}
        <div className="flex items-center gap-3 relative z-10">
          {activeTab === 'schedule' ? (
            <Button
              onClick={() => setActiveTab('participation')}
              size="lg"
              className="rounded-xl h-12 px-6 font-bold shadow-md bg-gradient-to-r from-primary to-primary/90 text-white hover:from-primary/90 hover:to-primary transition-all flex items-center gap-2 text-base"
            >
              <ClipboardList className="h-5 w-5" />
              <span>{isRTL ? 'تسجيل المشاركات' : 'Log Participation'}</span>
            </Button>
          ) : (
            <Button
              onClick={() => setActiveTab('schedule')}
              size="lg"
              className="rounded-xl h-12 px-6 font-bold shadow-md bg-gradient-to-r from-primary to-primary/90 text-white hover:from-primary/90 hover:to-primary transition-all flex items-center gap-2 text-base"
            >
              <CalendarIcon className="h-5 w-5" />
              <span>{isRTL ? 'جدول الكورسات' : 'Course Schedule'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {activeTab === 'schedule' ? (
        <div className="w-full flex-1 animate-fade-in">
          <CourseSchedule isKiosk={true} branchId={selectedBranchId} />
        </div>
      ) : (
        <div className="w-full grid gap-8 lg:grid-cols-2 flex-1 animate-fade-in">

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
                            {isRTL ? (volunteer.full_name_ar || volunteer.full_name) : (volunteer.full_name || volunteer.full_name_ar)}
                          </p>
                        </div>
                        <Avatar className="h-14 w-14 border-2 border-success/30 shadow-sm shrink-0">
                          <AvatarImage src={volunteer.avatar_url || undefined} />
                          <AvatarFallback className="text-lg bg-success/10 text-success font-bold">
                            {((isRTL ? (volunteer.full_name_ar || volunteer.full_name) : (volunteer.full_name || volunteer.full_name_ar)) || 'V').charAt(0).toUpperCase()}
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

                    {/* Group Submission Toggle & Controls for Leaders */}
                    {isLeader && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4 p-4 border-2 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/5 hover:border-primary/40 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <Label htmlFor="group-submission-toggle" className="text-base font-bold cursor-pointer">
                                {isRTL ? 'مشاركة جماعية 👥' : 'Group Participation 👥'}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {isRTL ? 'تسجيل مشاركة لمجموعة من المتطوعين معاً' : 'Log participation for a group of volunteers'}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id="group-submission-toggle"
                            checked={isGroupSubmission}
                            onCheckedChange={(checked) => {
                              setIsGroupSubmission(checked);
                              setSelectedActivityId('');
                            }}
                            className="scale-110"
                            disabled={submitting}
                          />
                        </div>

                        {isGroupSubmission && (
                          <div className="space-y-4 p-4 rounded-2xl border-2 border-primary/20 bg-muted/20">
                            {/* Include Leader Switch */}
                            <div className="flex items-center justify-between pb-3 border-b border-border/50">
                              <Label htmlFor="include-me" className="text-sm font-semibold cursor-pointer">
                                {isRTL ? 'مشاركتي ضمن المجموعة' : 'Include my participation'}
                              </Label>
                              <Switch
                                id="include-me"
                                checked={includeMe}
                                onCheckedChange={setIncludeMe}
                                disabled={submitting}
                              />
                            </div>

                            {/* Volunteer Select Combobox */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                {isRTL ? 'اختر المتطوعين' : 'Select Volunteers'}
                              </Label>
                              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between h-12 text-base px-4 border-2 bg-background hover:border-primary/50"
                                  >
                                    <span className="truncate">
                                      {selectedVolunteers.length > 0
                                        ? (isRTL ? `تم تحديد ${selectedVolunteers.length} متطوع` : `${selectedVolunteers.length} selected`)
                                        : (isRTL ? 'بحث بالاسم وتحديد المتطوعين...' : 'Search & select volunteers...')}
                                    </span>
                                    <ChevronsUpDown className="ltr:ml-2 rtl:mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder={isRTL ? 'بحث بالاسم...' : 'Search volunteer...'} />
                                    <CommandList className="max-h-60 overflow-y-auto">
                                      <CommandEmpty>{isRTL ? 'لم يتم العثور على متطوعين' : 'No volunteers found'}</CommandEmpty>
                                      <CommandGroup>
                                        {volunteersList
                                          .filter(v => v.id !== volunteer?.id)
                                          .map(v => {
                                            const isSelected = selectedVolunteers.includes(v.id);
                                            const vName = isRTL ? (v.full_name_ar || v.full_name) : (v.full_name || v.full_name_ar);
                                            return (
                                              <CommandItem
                                                key={v.id}
                                                value={vName || ''}
                                                onSelect={() => toggleVolunteer(v.id)}
                                                className="cursor-pointer"
                                              >
                                                <div className="flex items-center gap-3 w-full">
                                                  <Avatar className="h-7 w-7 shrink-0">
                                                    <AvatarImage src={v.avatar_url || undefined} />
                                                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                                      {vName?.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                  </Avatar>
                                                  <span className="flex-1 truncate text-sm">{vName}</span>
                                                  <Check className={cn("h-4 w-4 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                                                </div>
                                              </CommandItem>
                                            );
                                          })}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>

                              {/* Selected Volunteers Chips */}
                              {selectedVolunteers.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {selectedVolunteers.slice(0, 5).map(id => {
                                    const v = volunteersList.find(vol => vol.id === id);
                                    const vName = v ? (isRTL ? (v.full_name_ar || v.full_name) : (v.full_name || v.full_name_ar)) : '';
                                    return v ? (
                                      <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-xs font-semibold text-primary border border-primary/20">
                                        {vName?.split(' ')[0]}
                                        <button type="button" onClick={() => toggleVolunteer(id)} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ) : null;
                                  })}
                                  {selectedVolunteers.length > 5 && (
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted text-xs font-semibold">
                                      +{selectedVolunteers.length - 5} {isRTL ? 'آخرين' : 'more'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Guests Section */}
                            <div className="space-y-3 pt-3 border-t border-dashed border-primary/20">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                {isRTL ? 'إضافة ضيوف (اختياري)' : 'Add Guests (Optional)'}
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder={isRTL ? 'اسم الضيف' : 'Guest Name'}
                                  value={guestNameInput}
                                  onChange={(e) => setGuestNameInput(e.target.value)}
                                  className="flex-1 h-10 text-sm"
                                />
                                <Input
                                  placeholder={isRTL ? 'الهاتف' : 'Phone'}
                                  value={guestPhoneInput}
                                  onChange={(e) => setGuestPhoneInput(e.target.value)}
                                  className="w-1/3 h-10 text-sm"
                                  dir="ltr"
                                />
                                <Button type="button" onClick={addGuestItem} variant="secondary" size="icon" className="h-10 w-10 shrink-0">
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>

                              {guests.length > 0 && (
                                <div className="space-y-2 bg-background/60 rounded-xl p-3 border">
                                  <p className="text-xs text-muted-foreground font-semibold">
                                    {isRTL ? 'قائمة الضيوف:' : 'Guests List:'}
                                  </p>
                                  {guests.map((g, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 hover:bg-muted/50 rounded-lg transition-colors">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-xs">{g.name}</span>
                                        {g.phone && <span className="text-muted-foreground text-xs">({g.phone})</span>}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => removeGuestItem(idx)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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

                    {/* Location Selection - as cards */}
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {isRTL ? 'مكان المشاركة' : 'Location'}
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
                            {isRTL ? 'بالفرع' : 'Branch'}
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
                            {isRTL ? 'من البيت' : 'Home'}
                          </span>
                          {location === 'home' && (
                            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Vest Checkbox - Only for branch activities */}
                    {location === 'branch' && (
                      <div className="space-y-3 p-4 rounded-xl border-2 border-warning/30 bg-gradient-to-br from-warning/5 to-orange-500/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                              <Shirt className="h-5 w-5 text-warning" />
                            </div>
                            <Label htmlFor="wore-vest" className="text-sm font-semibold cursor-pointer">
                              {isRTL ? 'كنت أرتدي الـ Vest 🦺' : 'I wore the vest 🦺'}
                            </Label>
                          </div>
                          <Switch
                            id="wore-vest"
                            checked={woreVest}
                            onCheckedChange={setWoreVest}
                            disabled={submitting}
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

                    {/* Description / Notes */}
                    <div className="space-y-2.5">
                      <Label htmlFor="desc-input" className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {isRTL ? 'عملت ايه النهاردة؟ (اختياري)' : 'Description (Optional)'}
                      </Label>
                      <Textarea
                        id="desc-input"
                        placeholder={isRTL ? 'مثال: نظمت كورس الانجليزي، نظمت انترفيو...' : 'e.g. sorted clothes, calls outreach, food packing...'}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        className="bg-background border-2 hover:border-primary/50 focus:border-primary/50 transition-colors rounded-xl min-h-[90px] resize-none text-sm p-4"
                        disabled={submitting}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{isRTL ? 'أضف أي ملاحظات إضافية عن مشاركتك' : 'Add any additional notes about your participation'}</span>
                        <span>{description.length}/1000</span>
                      </div>
                    </div>

                    {/* Proof Upload */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        {isRTL ? 'صورة الإثبات (اختياري)' : 'Proof Image (Optional)'}
                      </Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={SAFE_IMAGE_ACCEPT}
                        onChange={handleFileSelect}
                        className="hidden"
                      />

                      {proofPreview ? (
                        <div className="relative group rounded-xl overflow-hidden border-2 border-primary/20">
                          <img
                            src={proofPreview}
                            alt="Proof preview"
                            className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="w-12 h-12 rounded-full shadow-lg"
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
                        <button
                          type="button"
                          className="w-full h-36 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-accent/5 hover:border-primary/50 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {isRTL ? 'اضغط لرفع صورة الإثبات' : 'Click to upload proof image'}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1">
                            {isRTL ? 'الحد الأقصى 5 ميجابايت (JPG, PNG, WebP)' : 'Max size 5MB (JPG, PNG, WebP)'}
                          </span>
                        </button>
                      )}
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

          {/* Right Column: Top 5 Volunteers & History panel */}
          <div className="space-y-6">
            {/* Top 5 Field Participations Card */}
            <Card className="border-0 shadow-xl bg-gradient-to-b from-card to-card/95 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-amber-500/10 via-primary/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <span>{isRTL ? 'أعلى 5 مشاركات ميداني بالفرع' : 'Top 5 Field Volunteers'}</span>
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {isRTL ? 'أكثر المتطوعين تفاعلاً في المشاركات الميدانية المقبولة بالفرع' : 'Most active field volunteers with approved check-ins'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {loadingTopVolunteers ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : topVolunteers.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    {isRTL ? 'لا توجد مشاركات ميدانية مسجلة حتى الآن' : 'No field participations logged yet'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topVolunteers.map((vol, idx) => {
                      const displayName = isRTL
                        ? (vol.full_name_ar || vol.full_name)
                        : (vol.full_name || vol.full_name_ar);

                      return (
                        <div
                          key={vol.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40 hover:bg-muted/70 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                              idx === 0 ? "bg-amber-500 text-white shadow-md" :
                              idx === 1 ? "bg-slate-400 text-white shadow-sm" :
                              idx === 2 ? "bg-amber-700 text-white shadow-sm" :
                              "bg-muted-foreground/20 text-muted-foreground"
                            )}>
                              {idx + 1}
                            </div>
                            <Avatar className="h-9 w-9 border border-primary/20 shrink-0">
                              <AvatarImage src={vol.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                {displayName?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-sm line-clamp-1">{displayName}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold shrink-0" dir="ltr">
                            <span>+{vol.count}</span>
                            <span className="rtl:mr-1 ltr:ml-1">{isRTL ? 'مشاركة' : 'participations'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History panel */}
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

        </div>
      )}

      {/* Fixed Bottom Controls (Language & Theme toggle - matching Auth page style) */}
      <div className="fixed bottom-4 right-4 flex gap-2 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-black hover:text-black shadow-md border border-gray-200 dark:bg-black/80 dark:hover:bg-black dark:text-white dark:hover:text-white dark:border-gray-800 h-11 w-11"
              title={t('theme.toggle')}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.light')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.dark')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Laptop className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.system')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-black hover:text-black shadow-md border border-gray-200 dark:bg-black/80 dark:hover:bg-black dark:text-white dark:hover:text-white dark:border-gray-800 h-11 w-11"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          title={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        >
          <Languages className="h-5 w-5" />
        </Button>
      </div>

    </div>
  );
}
