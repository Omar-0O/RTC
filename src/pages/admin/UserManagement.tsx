import { useState, useRef, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar as CalendarIcon, Search, Plus, MoreHorizontal, Mail, Shield, User, Trash2, Upload, Loader2, Pencil, Download, Eye, EyeOff, UserPlus, Settings } from 'lucide-react';

import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useUsers, useCommittees, useCreateUser, useUpdateUser, useDeleteUser, useToggleUserActive, useUpdateRole } from '@/hooks/useUsers';
import type { UserWithDetails, Committee } from '@/hooks/useUsers';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';

// Committee and UserWithDetails types imported from useUsers hook

import { UserRole } from '@/types';

// AppRole type — kept for local usage
type AppRole = UserRole;

// UserWithDetails interface imported from useUsers hook

import Profile from '@/pages/volunteer/Profile';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { waPhoneLink } from '@/utils/phoneUtils';

// Image utilities extracted to @/utils/imageCrop

import Cropper from 'react-easy-crop';
import { Slider } from '@/components/ui/slider';
import { getCroppedImg } from '@/utils/imageCrop';

const ALL_FEATURES = [
  { id: 'user_management', label: 'إدارة الأعضاء', labelEn: 'User Management' },
  { id: 'courses_management', label: 'إدارة الكورسات والمدربين', labelEn: 'Courses & Trainers Management' },
  { id: 'quran_circles_management', label: 'إدارة حلقات القرآن والمحفظين', labelEn: 'Quran Circles & Teachers Management' },
  { id: 'caravans_management', label: 'إدارة القوافل', labelEn: 'Caravans Management' },
  { id: 'events_management', label: 'إدارة الايفنتات', labelEn: 'Events Management' },
  { id: 'ashbal_management', label: 'إدارة الأشبال', labelEn: 'Ashbal Management' },
  { id: 'ethics_management', label: 'إدارة الأخلاقيات والمكالمات', labelEn: 'Ethics & Calls Management' },
  { id: 'fines_management', label: 'إدارة الغرامات', labelEn: 'Fines Management' },
  { id: 'hr_management', label: 'إدارة المشاركات (HR)', labelEn: 'Submission Management (HR)' },
  { id: 'reports_view', label: 'عرض التقارير', labelEn: 'Reports View' },
  { id: 'followup_management', label: 'شيت المتابعة', labelEn: 'Follow-Up Sheet' },
  { id: 'rooms_management', label: 'إدارة القاعات', labelEn: 'Rooms Management' },
];

const getRoleDefaultFeatures = (role: UserRole): string[] => {
  switch (role) {
    case 'admin':
    case 'branch_admin':
      return [
        'courses_management',
        'quran_circles_management',
        'caravans_management',
        'events_management',
        'ashbal_management',
        'ethics_management',
        'fines_management',
        'hr_management',
        'user_management',
        'reports_view',
        'followup_management',
        'rooms_management',
      ];
    case 'supervisor':
      return ['user_management', 'reports_view', 'courses_management', 'followup_management'];
    case 'committee_leader':
      return ['courses_management', 'events_management'];
    case 'hr':
      return ['hr_management', 'user_management', 'reports_view'];
    case 'head_hr':
      return ['hr_management', 'user_management', 'reports_view', 'followup_management'];
    case 'head_caravans':
      return ['caravans_management', 'events_management'];
    case 'head_events':
      return ['events_management', 'reports_view'];
    case 'head_production':
    case 'head_fourth_year':
      return ['events_management', 'reports_view'];
    case 'head_ethics':
      return ['ethics_management', 'events_management'];
    case 'head_quran':
      return ['quran_circles_management', 'events_management'];
    case 'head_ashbal':
      return ['ashbal_management', 'events_management'];
    case 'head_marketing':
      return ['courses_management', 'events_management', 'quran_circles_management'];
    default:
      return [];
  }
};

export default function UserManagement() {
  const { t, language, isRTL } = useLanguage();
  const { activeBranch, branches, canViewAllBranches } = useBranch();
  const { primaryRole } = useAuth();
  // ── Pagination state ──
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 300;

  // ── React Query: data fetching (replaces useEffect + fetchData) ──
  const { data: usersData, isLoading: isUsersLoading } = useUsers({
    branchId: activeBranch?.id,
    canViewAllBranches,
    language,
    branches,
    page: currentPage,
    pageSize,
  });
  const { data: committeesList } = useCommittees(activeBranch?.id);

  const users = usersData?.users ?? [];
  const totalUserCount = usersData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalUserCount / pageSize);
  const committees = committeesList ?? [];
  const isLoading = isUsersLoading;

  // ── React Query: mutations (replaces manual try/catch + fetchData()) ──
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const toggleActiveMutation = useToggleUserActive();
  const updateRoleMutation = useUpdateRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [viewProfileUser, setViewProfileUser] = useState<UserWithDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom features states
  const [isCustomizeFeaturesDialogOpen, setIsCustomizeFeaturesDialogOpen] = useState(false);
  const [featuresSelectedUser, setFeaturesSelectedUser] = useState<UserWithDetails | null>(null);
  const [selectedUserFeatures, setSelectedUserFeatures] = useState<string[]>([]);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('volunteer');
  const [formLevel, setFormLevel] = useState<string>('under_follow_up');
  const [formCommitteeId, setFormCommitteeId] = useState<string>('');
  const [formBranchId, setFormBranchId] = useState<string>('');
  const [formAvatarFile, setFormAvatarFile] = useState<File | null>(null);
  const [formAvatarPreview, setFormAvatarPreview] = useState<string | null>(null);
  const [formAttendedMiniCamp, setFormAttendedMiniCamp] = useState(false);
  const [formAttendedCamp, setFormAttendedCamp] = useState(false);
  const [formIsAshbal, setFormIsAshbal] = useState(false);
  const [formJoinDate, setFormJoinDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [formBirthDate, setFormBirthDate] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)

  // Data fetching is now handled by React Query hooks above.
  // No useEffect needed — useUsers() and useCommittees() handle
  // caching, deduplication, loading states, and re-fetching automatically.

  const handleToggleActive = async (user: UserWithDetails) => {
    const newStatus = !user.is_active;
    try {
      await toggleActiveMutation.mutateAsync({ userId: user.id, isActive: newStatus });
      toast.success(
        newStatus
          ? (isRTL ? `✅ تم تفعيل ${user.full_name_ar || user.full_name}` : `✅ ${user.full_name || user.full_name_ar} activated`)
          : (isRTL ? `🚫 تم تعطيل ${user.full_name_ar || user.full_name}` : `🚫 ${user.full_name || user.full_name_ar} deactivated`)
      );
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في تغيير الحالة' : 'Failed to change status'));
    }
  };

  const openCustomizeFeatures = async (user: UserWithDetails) => {
    setFeaturesSelectedUser(user);
    setIsCustomizeFeaturesDialogOpen(true);
    setSelectedUserFeatures([]);
    try {
      const { data, error } = await (supabase as any)
        .from('user_features')
        .select('feature')
        .eq('user_id', user.id);
      
      if (!error && data) {
        setSelectedUserFeatures(data.map((f: any) => f.feature));
      }
    } catch (err) {
      console.error('Error fetching user features:', err);
    }
  };

  const handleSaveFeatures = async () => {
    if (!featuresSelectedUser) return;
    setIsSavingFeatures(true);
    try {
      const { error: deleteErr } = await (supabase as any)
        .from('user_features')
        .delete()
        .eq('user_id', featuresSelectedUser.id);
      
      if (deleteErr) throw deleteErr;

      if (selectedUserFeatures.length > 0) {
        const rows = selectedUserFeatures.map(f => ({
          user_id: featuresSelectedUser.id,
          feature: f
        }));
        
        const { error: insertErr } = await (supabase as any)
          .from('user_features')
          .insert(rows);
          
        if (insertErr) throw insertErr;
      }

      toast.success(isRTL ? 'تم حفظ المميزات بنجاح' : 'Features saved successfully');
      setIsCustomizeFeaturesDialogOpen(false);
    } catch (err: any) {
      console.error('Error saving features:', err);
      toast.error(err.message || (isRTL ? 'فشل في حفظ المميزات' : 'Failed to save features'));
    } finally {
      setIsSavingFeatures(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.full_name_ar?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || user.level === levelFilter;
    const matchesCommittee = committeeFilter === 'all' || user.committee_id === committeeFilter;
    const isNotAdmin = user.role !== 'admin';
    return matchesSearch && matchesLevel && matchesCommittee && isNotAdmin;
  });

  const resetForm = () => {
    setFormName('');
    setFormNameAr('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setFormRole('volunteer');
    setFormLevel('under_follow_up');
    setFormCommitteeId('');
    setFormBranchId(activeBranch?.id || '');
    setFormAvatarFile(null);
    setFormAvatarPreview(null);
    setFormAttendedMiniCamp(false);
    setFormAttendedCamp(false);
    setFormIsAshbal(false);
    setFormJoinDate(format(new Date(), 'yyyy-MM-dd'));
    setFormBirthDate('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);

    // Reset inputs
    e.target.value = '';
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const showCroppedImage = async () => {
    try {
      if (!tempImageSrc || !croppedAreaPixels) return

      const croppedFile = await getCroppedImg(
        tempImageSrc,
        croppedAreaPixels
      )

      if (croppedFile) {
        setFormAvatarFile(croppedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(croppedFile);
        setIsCropping(false);
        setTempImageSrc(null);
      }
    } catch (e) {
      console.error(e)
      toast.error(isRTL ? 'فشل في قص الصورة' : 'Failed to crop image')
    }
  }

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!formAvatarFile) return null;

    try {
      const fileExt = formAvatarFile.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formAvatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return null;
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields');
      return;
    }

    if (formPassword.length < 6) {
      toast.error(isRTL ? 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the current session to pass the auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(isRTL ? 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' : 'Session expired. Please log in again.');
        return;
      }

      // Call create-user edge function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formEmail.trim(),
          password: formPassword,
          fullName: formName.trim(),
          fullNameAr: formNameAr.trim(),
          role: formRole,
          committeeId: formCommitteeId || null,
          phone: formPhone.trim() || null,
          level: formLevel,
          joinDate: formJoinDate,
        },
      });

      // Check for function invocation error (network issues, etc.)
      if (error) {
        console.error('Edge function invocation error:', error);
        // Extract status code if available
        if (error instanceof Error && 'status' in error) {
          console.error('Status Code:', (error as any).status);
        }
        throw error;
      }

      console.log('Create user response:', data);

      // Check for errors returned from the Edge Function
      if (!data?.user) {
        const errorMsg = data?.error || 'Failed to create user - no user returned';
        console.error('Create user failed:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('User created successfully:', data.user.id);

      // Upload avatar if provided
      if (formAvatarFile && data.user) {
        try {
          const avatarUrl = await uploadAvatar(data.user.id);
          if (avatarUrl) {
            await supabase
              .from('profiles')
              .update({ avatar_url: avatarUrl })
              .eq('id', data.user.id);
          }
        } catch (avatarError) {
          console.error('Avatar upload failed:', avatarError);
          // Don't throw - user was created successfully
        }
      }

      // Update attendance status if applicable
      if (data.user) {
        const updates: any = {};

        if (formLevel === 'under_follow_up') {
          updates.attended_mini_camp = formAttendedMiniCamp;
        }

        if (formLevel === 'project_responsible') {
          updates.attended_camp = formAttendedCamp;
        }

        if (formIsAshbal) {
          updates.is_ashbal = true;
        }

        if (formBirthDate) {
          updates.birth_date = formBirthDate;
        }

        if (formBranchId) {
          updates.branch_id = formBranchId;
        }

        if (Object.keys(updates).length > 0) {
          updates.level = formLevel;

          const { error: updateError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', data.user.id);

          if (updateError) {
            console.error('Failed to update attendance:', updateError);
            // Don't throw - user was created successfully
          }
        }
      }

      toast.success(language === 'ar' ? 'تم إضافة المستخدم بنجاح' : 'User added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      // React Query auto-invalidates via createUserMutation

    } catch (error: any) {
      console.error('Error adding user:', error);
      const message = error?.message || error?.error || (language === 'ar' ? 'فشل في إضافة المستخدم' : 'Failed to add user');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setFormName(user.full_name || '');
    setFormNameAr(user.full_name_ar || '');
    setFormPassword(''); // Reset password field for edit mode
    setFormEmail(user.email);
    setFormPhone(user.phone || '');
    setFormRole(user.role);
    setFormLevel(user.level || 'under_follow_up');
    setFormCommitteeId(user.committee_id || '');
    setFormBranchId(user.branch_id || activeBranch?.id || '');
    setFormAttendedMiniCamp(user.attended_mini_camp || false);
    setFormAttendedCamp(user.attended_camp || false);
    setFormIsAshbal(user.is_ashbal || false);
    setFormJoinDate(user.join_date ? format(new Date(user.join_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setFormBirthDate(user.birth_date || '');
    setIsCropping(false);
    setTempImageSrc(null);
    setFormAvatarFile(null);
    setFormAvatarPreview(user.avatar_url);
    setIsEditDialogOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!formName.trim() || !formEmail.trim()) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formName.trim(),
          full_name_ar: formNameAr.trim() || null,
          email: formEmail.trim(),
          phone: formPhone.trim() || null,
          committee_id: formCommitteeId || null,
          branch_id: formBranchId || null,

          level: formLevel as any,
          attended_mini_camp: formLevel === 'under_follow_up' ? formAttendedMiniCamp : null,
          attended_camp: formLevel === 'project_responsible' ? formAttendedCamp : null,
          is_ashbal: formIsAshbal,
          join_date: formJoinDate,
          birth_date: formBirthDate || null,
        })
        .eq('id', selectedUser.id)
        .select();

      if (profileError) throw profileError;

      console.log('Update response:', profileData);

      if (!profileData || profileData.length === 0) {
        throw new Error('Update failed - no changes applied (check permissions)');
      }

      // Upload avatar if changed
      if (formAvatarFile) {
        try {
          const avatarUrl = await uploadAvatar(selectedUser.id);
          if (avatarUrl) {
            await supabase
              .from('profiles')
              .update({ avatar_url: avatarUrl })
              .eq('id', selectedUser.id);
          }
        } catch (avatarError) {
          console.error('Avatar upload failed:', avatarError);
          toast.error(isRTL ? 'فشل في رفع الصورة الشخصية الجديدة' : 'Failed to upload new avatar');
        }
      }

      // Update role if changed
      if (formRole !== selectedUser.role) {
        // First, delete all existing roles for this user
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.id);

        if (deleteError) throw deleteError;

        // Then, insert the new role ONLY if it's not 'volunteer'
        if (formRole !== 'volunteer') {
          const { error: roleError } = await (supabase as any)
            .from('user_roles')
            .insert({ user_id: selectedUser.id, role: formRole });

          if (roleError) throw roleError;
        }
      }

      // Update password if provided
      if (formPassword.trim()) {
        if (formPassword.length < 6) {
          toast.error(isRTL ? 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' : 'Password must be at least 6 characters');
          return;
        }

        const { data: passwordData, error: passwordError } = await supabase.functions.invoke('update-user-password', {
          body: {
            userId: selectedUser.id,
            newPassword: formPassword.trim()
          }
        });

        if (passwordError) throw passwordError;
        if (passwordData?.error) throw new Error(passwordData.error);
      }

      toast.success(language === 'ar' ? 'تم تحديث بيانات المستخدم بنجاح' : 'User updated successfully');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      // React Query auto-invalidates via updateUserMutation
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في تحديث بيانات المستخدم' : 'Failed to update user'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      // Call RPC function to delete the user
      const { data, error } = await supabase.rpc('delete_user_account', {
        target_user_id: selectedUser.id,
      });

      if (error) {
        console.error('RPC function error:', error);
        throw error;
      }

      // Check if the RPC function returned an error
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }

      toast.success(language === 'ar' ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      // React Query auto-invalidates via deleteUserMutation
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل حذف المستخدم' : 'Failed to delete user'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      // First, delete all existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then, insert the new role ONLY if it's not 'volunteer'
      // 'volunteer' is the default state (no explicit role record)
      if (newRole !== 'volunteer') {
        const { error: insertError } = await (supabase as any)
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (insertError) throw insertError;
      }



      toast.success(language === 'ar' ? 'تم تحديث دور المستخدم بنجاح' : 'Role updated successfully');
      // React Query auto-invalidates via updateRoleMutation
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل في تحديث دور المستخدم' : 'Failed to update role'));
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive';
      case 'supervisor':
        return 'bg-primary/10 text-primary';
      case 'committee_leader':
        return 'bg-success/10 text-success';
      case 'hr':
      case 'head_hr':
        return 'bg-purple-100 text-purple-700';
      case 'branch_admin':
        return 'bg-orange-100 text-orange-700';
      case 'head_production': // Keep existing style if needed or map to default, but removing case as per plan. 
      // Actually if existing users have it they will be migrated. But to avoid runtime error if data is stale:
      case 'head_caravans':
      case 'head_events':
      case 'head_ethics':
      case 'head_quran':
      case 'head_marketing':
      case 'head_ashbal':
      case 'head_fourth_year':
      case 'marketing_member':
        return 'bg-blue-100 text-blue-700';

      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return t('common.admin');
      case 'supervisor': return t('common.supervisor');
      case 'committee_leader': return t('common.committeeLeader');
      case 'hr': return t('common.hr');
      case 'head_hr': return t('common.head_hr');
      case 'branch_admin': return language === 'ar' ? 'أدمن فرع' : 'Branch Admin';
      case 'head_caravans': return t('common.head_caravans');
      case 'head_events': return t('common.head_events');
      case 'head_ethics': return t('common.head_ethics');
      case 'head_quran': return t('common.head_quran');
      case 'head_marketing': return t('common.head_marketing');
      case 'head_ashbal': return t('common.head_ashbal');
      case 'head_production': return t('common.head_production');
      case 'head_fourth_year': return t('common.head_fourth_year');
      case 'marketing_member': return t('common.marketing_member');
      default: return t('common.volunteer');
    }
  };

  const getLastSeenText = (lastSeen: string | null | undefined) => {
    if (!lastSeen) return { text: language === 'ar' ? 'غير معروف' : 'Unknown', color: 'text-muted-foreground', dot: 'bg-gray-400' };
    const now = new Date();
    const seen = new Date(lastSeen);
    const diffMs = now.getTime() - seen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 3) return { text: language === 'ar' ? 'متصل الآن' : 'Online', color: 'text-emerald-600', dot: 'bg-emerald-500' };
    if (diffMins < 60) return { text: language === 'ar' ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`, color: 'text-yellow-600', dot: 'bg-yellow-500' };
    if (diffHours < 24) return { text: language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`, color: 'text-orange-600', dot: 'bg-orange-500' };
    return { text: language === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`, color: 'text-muted-foreground', dot: 'bg-gray-400' };
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(language === 'ar' ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
  };

  const handleExportUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch passwords from user_private_details table
      let passwordsMap = new Map<string, string>();
      if (['admin', 'head_hr', 'hr'].includes(primaryRole)) {
        const { data: privateData, error: privateError } = await supabase
          .from('user_private_details')
          .select('id, visible_password');

        if (!privateError && privateData) {
          passwordsMap = new Map(privateData.map(p => [p.id, p.visible_password || '']));
        }
      }

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role as string]) || []);

      const exportData = profilesData
        .filter(u => u.full_name !== 'RTC Admin')
        .map(u => ({
          'Full Name (English)': u.full_name,
          'Full Name (Arabic)': u.full_name_ar,
          'Email': u.email,
          'Phone': u.phone ? `'${u.phone}` : '',
          'Role': (() => {
            const role = rolesMap.get(u.id);
            switch (role) {
              case 'admin': return 'مسؤول';
              case 'supervisor': return 'هيد الفرع';
              case 'committee_leader': return 'هيد اللجنة';
              case 'hr': return 'HR';
              case 'head_hr': return 'Head HR';
              case 'branch_admin': return 'أدمن فرع';
              case 'head_caravans': return 'هيد لجنة قوافل';
              case 'head_events': return 'هيد لجنة ايفنتات';
              case 'head_ethics': return 'هيد نشر اخلاقيات';
              case 'head_quran': return 'هيد لجنة القرآن';
              case 'head_marketing': return 'هيد لجنة التسويق';
              case 'head_ashbal': return 'هيد لجنة الأشبال';
              case 'head_production': return 'هيد لجان انتاج';
              case 'head_fourth_year': return 'هيد لجان سنة رابعة';

              default: return 'متطوع';
            }
          })(),
          'Password': passwordsMap.get(u.id) || '',
          'Joined At': new Date(u.created_at).toLocaleDateString(),
          'Mini Camp Attendance': u.level === 'under_follow_up' ? (u.attended_mini_camp ? (isRTL ? 'حضر' : 'Attended') : (isRTL ? 'لم يحضر' : 'Not Attended')) : 'N/A',
          'Camp Attendance': u.level === 'project_responsible' ? (u.attended_camp ? (isRTL ? 'حضر' : 'Attended') : (isRTL ? 'لم يحضر' : 'Not Attended')) : 'N/A'
        }));

      downloadCSV(exportData, 'Users_Export');

    } catch (error) {
      console.error('Export error:', error);
      toast.error(isRTL ? 'فشل في تصدير المستخدمين' : 'Failed to export users');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('users.title')}</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          {['admin', 'head_hr', 'branch_admin'].includes(primaryRole) && (
            <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={handleExportUsers} className="w-full xs:w-auto">
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                <span className="text-xs sm:text-sm">{isRTL ? 'تصدير المتطوعين' : 'Export Users'}</span>
              </Button>
              <DialogTrigger asChild>
                <Button className="w-full xs:w-auto">
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  <span className="text-xs sm:text-sm">{t('users.addUser')}</span>
                </Button>
              </DialogTrigger>
            </div>
          )}
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader className="px-4 sm:px-6 py-5 border-b-2 border-border/50 dark:border-border/80 shrink-0 bg-muted/30 flex flex-col items-center text-center">
              <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
                <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                {t('users.addUser')}
              </DialogTitle>
              <DialogDescription className="text-center mt-1.5">
                {language === 'ar' ? 'أدخل تفاصيل الحساب لإنشاء متطوع جديد' : 'Enter account details to create a new volunteer'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{language === 'ar' ? 'الاسم بالإنجليزي' : 'Full Name (English)'} *</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={language === 'ar' ? 'Omar Mohamed' : 'Full Name'}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name-ar">{language === 'ar' ? 'الاسم بالعربي' : 'Full Name (Arabic)'} *</Label>
                    <Input
                      id="name-ar"
                      value={formNameAr}
                      onChange={(e) => setFormNameAr(e.target.value)}
                      placeholder={language === 'ar' ? 'عمر محمد' : 'Arabic Name'}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t('auth.email')} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder={t('auth.email')}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">{t('users.phoneNumber')}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+20 123 456 7890"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">{t('password')} *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      required
                      className="ltr:pr-10 rtl:pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="role">{t('users.role')}</Label>
                    <Select value={formRole} onValueChange={(value) => setFormRole(value as UserRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('users.role')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                        <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                        <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                        <SelectItem value="branch_admin">{language === 'ar' ? 'أدمن فرع' : 'Branch Admin'}</SelectItem>
                        <SelectItem value="hr">{t('common.hr')}</SelectItem>
                        <SelectItem value="head_hr">{t('common.head_hr')}</SelectItem>
                        <SelectItem value="head_caravans">{t('common.head_caravans')}</SelectItem>
                        <SelectItem value="head_events">{t('common.head_events')}</SelectItem>
                        <SelectItem value="head_ethics">{t('common.head_ethics')}</SelectItem>
                        <SelectItem value="head_quran">{t('common.head_quran')}</SelectItem>
                        <SelectItem value="head_marketing">{t('common.head_marketing')}</SelectItem>
                        <SelectItem value="head_ashbal">{t('common.head_ashbal')}</SelectItem>
                        <SelectItem value="head_production">{t('common.head_production')}</SelectItem>
                        <SelectItem value="head_fourth_year">{t('common.head_fourth_year')}</SelectItem>
                        <SelectItem value="marketing_member">{t('common.marketing_member')}</SelectItem>

                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="level">{t('users.level')}</Label>
                    <Select value={formLevel} onValueChange={setFormLevel} disabled={!['admin', 'head_hr', 'supervisor'].includes(primaryRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('users.level')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="under_follow_up">{t('level.under_follow_up')}</SelectItem>
                        <SelectItem value="project_responsible">{t('level.project_responsible')}</SelectItem>
                        <SelectItem value="responsible">{t('level.responsible')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="committee">{t('users.committee')}</Label>
                  <Select
                    value={formCommitteeId || 'none'}
                    onValueChange={(val) => setFormCommitteeId(val === 'none' ? '' : val)}
                    disabled={!['admin', 'head_hr', 'hr', 'supervisor'].includes(primaryRole)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.committee')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{language === 'ar' ? 'بدون لجنة' : 'No Committee'}</SelectItem>
                      {committees.map(committee => (
                        <SelectItem key={committee.id} value={committee.id}>
                          {language === 'ar' ? committee.name_ar : committee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{language === 'ar' ? 'الفرع' : 'Branch'} *</Label>
                  <Select value={formBranchId || 'none'} onValueChange={(val) => setFormBranchId(val === 'none' ? '' : val)} disabled={!canViewAllBranches}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'ar' ? 'اختر الفرع' : 'Select Branch'} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {language === 'ar' ? branch.name_ar : branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Avatar Upload */}
                <div className="grid gap-2">
                  <Label>{language === 'ar' ? 'الصورة الشخصية' : 'Profile Picture'}</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={formAvatarPreview || undefined} />
                      <AvatarFallback>{formName ? formName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleAvatarSelect}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === 'ar' ? 'الحد الأقصى 2 ميجابايت' : 'Max size 2MB'}
                      </p>
                    </div>
                  </div>

                  {/* Crop UI */}
                  {isCropping && tempImageSrc && (
                    <div className="mt-4 border rounded-lg p-4 space-y-4">
                      <div className="relative h-64 w-full bg-black rounded-lg overflow-hidden">
                        <Cropper
                          image={tempImageSrc}
                          crop={crop}
                          zoom={zoom}
                          aspect={1}
                          onCropChange={setCrop}
                          onCropComplete={onCropComplete}
                          onZoomChange={setZoom}
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm min-w-[3rem]">{t('Zoom')}</span>
                        <Slider
                          value={[zoom]}
                          min={1}
                          max={3}
                          step={0.1}
                          onValueChange={(vals) => setZoom(vals[0])}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsCropping(false);
                            setTempImageSrc(null);
                            setFormAvatarFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button type="button" onClick={showCroppedImage}>
                          {language === 'ar' ? 'قص وحفظ' : 'Crop & Save'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(formLevel === 'under_follow_up' || formLevel === 'project_responsible') && (
                <div className="border-t pt-4 mt-4 pb-4">
                  <h4 className="text-sm font-medium mb-4">
                    {formLevel === 'under_follow_up'
                      ? (language === 'ar' ? 'حضور الميني كامب' : 'Mini Camp Attendance')
                      : (language === 'ar' ? 'حضور الكامب' : 'Camp Attendance')}
                  </h4>
                  <div className="grid gap-4">
                    {formLevel === 'under_follow_up' && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="mini-camp-attendance">{language === 'ar' ? 'حضور الميني كامب' : 'Mini Camp Attendance'}</Label>
                        </div>
                        <Switch
                          id="mini-camp-attendance"
                          checked={formAttendedMiniCamp}
                          onCheckedChange={setFormAttendedMiniCamp}
                        />
                      </div>
                    )}
                    {formLevel === 'project_responsible' && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="camp-attendance">{language === 'ar' ? 'حضور الكامب' : 'Camp Attendance'}</Label>
                        </div>
                        <Switch
                          id="camp-attendance"
                          checked={formAttendedCamp}
                          onCheckedChange={setFormAttendedCamp}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'تاريخ الانضمام' : 'Join Date'}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-start font-normal",
                          !formJoinDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                        {formJoinDate ? (
                          format(new Date(formJoinDate), "PPP", { locale: language === 'ar' ? ar : undefined })
                        ) : (
                          <span>{language === 'ar' ? 'اختر التاريخ' : 'Pick a date'}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formJoinDate ? new Date(formJoinDate) : undefined}
                        onSelect={(date) => setFormJoinDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={2000}
                        toYear={new Date().getFullYear() + 5}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-start font-normal",
                          !formBirthDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                        {formBirthDate ? (
                          format(new Date(formBirthDate), "PPP", { locale: language === 'ar' ? ar : undefined })
                        ) : (
                          <span>{language === 'ar' ? 'اختر التاريخ' : 'Pick a date'}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formBirthDate ? new Date(formBirthDate) : undefined}
                        onSelect={(date) => setFormBirthDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={1960}
                        toYear={new Date().getFullYear() + 5}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <Switch
                  id="is-ashbal"
                  checked={formIsAshbal}
                  onCheckedChange={setFormIsAshbal}
                />
                <Label htmlFor="is-ashbal">
                  {language === 'ar' ? 'من الأشبال؟' : 'Is Ashbal?'}
                </Label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t-2 border-border/50 dark:border-border/80 bg-muted/10 shrink-0">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto h-11 px-6 text-sm font-medium">
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto h-11 px-6 text-sm font-semibold shadow-sm">
                  {isSubmitting ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...') : t('common.add')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setSelectedUser(null);
          resetForm();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader className="px-4 sm:px-6 py-5 border-b-2 border-border/50 dark:border-border/80 shrink-0 bg-muted/30 flex flex-col items-center text-center">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
              <Pencil className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              {language === 'ar' ? 'تعديل المستخدم' : 'Edit User'}
            </DialogTitle>
            <DialogDescription className="text-center mt-1.5">
              {language === 'ar' ? 'تعديل بيانات الحساب للمتطوع' : 'Update volunteer account information'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">{language === 'ar' ? 'الاسم بالإنجليزي' : 'Full Name (English)'} *</Label>
                  <Input
                    id="edit-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={language === 'ar' ? 'Omar Mohamed' : 'Full Name'}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-name-ar">{language === 'ar' ? 'الاسم بالعربي' : 'Full Name (Arabic)'}</Label>
                  <Input
                    id="edit-name-ar"
                    value={formNameAr}
                    onChange={(e) => setFormNameAr(e.target.value)}
                    placeholder={language === 'ar' ? 'عمر محمد' : 'Arabic Name'}
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Avatar Upload */}
              <div className="grid gap-2">
                <Label>{language === 'ar' ? 'الصورة الشخصية' : 'Profile Picture'}</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={formAvatarPreview || undefined} />
                    <AvatarFallback>{formName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleAvatarSelect}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'ar' ? 'الحد الأقصى 2 ميجابايت' : 'Max size 2MB'}
                    </p>
                  </div>
                </div>

                {/* Crop UI */}
                {isCropping && tempImageSrc && (
                  <div className="mt-4 border rounded-lg p-4 space-y-4">
                    <div className="relative h-64 w-full bg-black rounded-lg overflow-hidden">
                      <Cropper
                        image={tempImageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm min-w-[3rem]">{t('Zoom')}</span>
                      <Slider
                        value={[zoom]}
                        min={1}
                        max={3}
                        step={0.1}
                        onValueChange={(vals) => setZoom(vals[0])}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCropping(false);
                          setTempImageSrc(null);
                          setFormAvatarFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button type="button" onClick={showCroppedImage}>
                        {language === 'ar' ? 'قص وحفظ' : 'Crop & Save'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">{t('users.phoneNumber')}</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+20 123 456 7890"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-password">{t('password')} ({language === 'ar' ? 'اختياري' : 'Optional'})</Label>
                  <div className="relative">
                    <Input
                      id="edit-password"
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={language === 'ar' ? 'اترك فارغاً للاحتفاظ بكلمة المرور الحالية' : 'Leave empty to keep current password'}
                      minLength={6}
                      className="ltr:pr-10 rtl:pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'أدخل كلمة مرور جديدة فقط إذا كنت تريد تغييرها' : 'Enter a new password only if you want to change it'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-role">{t('users.role')}</Label>
                  <Select value={formRole} onValueChange={(value) => setFormRole(value as UserRole)} disabled={!['admin', 'head_hr', 'branch_admin'].includes(primaryRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                      <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                      <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                      <SelectItem value="branch_admin">{language === 'ar' ? 'أدمن فرع' : 'Branch Admin'}</SelectItem>
                      <SelectItem value="head_caravans">{t('common.head_caravans')}</SelectItem>
                      <SelectItem value="head_events">{t('common.head_events')}</SelectItem>
                      <SelectItem value="head_ethics">{t('common.head_ethics')}</SelectItem>
                      <SelectItem value="hr">{t('common.hr')}</SelectItem>
                      <SelectItem value="head_hr">{t('common.head_hr')}</SelectItem>
                      <SelectItem value="head_quran">{t('common.head_quran')}</SelectItem>
                      <SelectItem value="head_marketing">{t('common.head_marketing')}</SelectItem>
                      <SelectItem value="head_ashbal">{t('common.head_ashbal')}</SelectItem>
                      <SelectItem value="head_production">{t('common.head_production')}</SelectItem>
                      <SelectItem value="head_fourth_year">{t('common.head_fourth_year')}</SelectItem>
                      <SelectItem value="marketing_member">{t('common.marketing_member')}</SelectItem>

                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-level">{t('users.level')}</Label>
                  <Select value={formLevel} onValueChange={setFormLevel} disabled={!['admin', 'head_hr', 'branch_admin'].includes(primaryRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.level')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under_follow_up">{t('level.under_follow_up')}</SelectItem>
                      <SelectItem value="project_responsible">{t('level.project_responsible')}</SelectItem>
                      <SelectItem value="responsible">{t('level.responsible')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-committee">{t('users.committee')}</Label>
                <Select value={formCommitteeId || 'none'} onValueChange={(val) => setFormCommitteeId(val === 'none' ? '' : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('users.committee')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{language === 'ar' ? 'بدون لجنة' : 'No Committee'}</SelectItem>
                    {committees.map(committee => (
                      <SelectItem key={committee.id} value={committee.id}>
                        {language === 'ar' ? committee.name_ar : committee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{language === 'ar' ? 'الفرع' : 'Branch'}</Label>
                <Select value={formBranchId || 'none'} onValueChange={(val) => setFormBranchId(val === 'none' ? '' : val)} disabled={!canViewAllBranches}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر الفرع' : 'Select Branch'} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {language === 'ar' ? branch.name_ar : branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="join-date">{language === 'ar' ? 'تاريخ الانضمام لعائلة RTC 😊' : 'Join Date to RTC Family 😊'}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-start font-normal",
                          !formJoinDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                        {formJoinDate ? (
                          format(new Date(formJoinDate), "PPP", { locale: language === 'ar' ? ar : undefined })
                        ) : (
                          <span>{language === 'ar' ? 'اختر التاريخ' : 'Pick a date'}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formJoinDate ? new Date(formJoinDate) : undefined}
                        onSelect={(date) => setFormJoinDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={2000}
                        toYear={new Date().getFullYear() + 5}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth-date">{language === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-start font-normal",
                          !formBirthDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                        {formBirthDate ? (
                          format(new Date(formBirthDate), "PPP", { locale: language === 'ar' ? ar : undefined })
                        ) : (
                          <span>{language === 'ar' ? 'اختر التاريخ' : 'Pick a date'}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formBirthDate ? new Date(formBirthDate) : undefined}
                        onSelect={(date) => setFormBirthDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={1960}
                        toYear={new Date().getFullYear() + 5}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <Switch
                  id="edit-is-ashbal"
                  checked={formIsAshbal}
                  onCheckedChange={setFormIsAshbal}
                />
                <Label htmlFor="edit-is-ashbal">
                  {language === 'ar' ? 'من الأشبال؟' : 'Is Ashbal?'}
                </Label>
              </div>

              {(formLevel === 'under_follow_up' || formLevel === 'project_responsible') && (
                <div className="border-t pt-4 mt-4 pb-4">
                  <h4 className="text-sm font-medium mb-4">{language === 'ar' ? 'حضور الكامب' : 'Camp Attendance'}</h4>
                  <div className="grid gap-4">
                    {formLevel === 'under_follow_up' && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="mini-camp-attendance">{language === 'ar' ? 'حضور الميني كامب' : 'Mini Camp Attendance'}</Label>
                        </div>
                        <Switch
                          id="mini-camp-attendance"
                          checked={formAttendedMiniCamp}
                          onCheckedChange={setFormAttendedMiniCamp}
                        />
                      </div>
                    )}
                    {formLevel === 'project_responsible' && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="camp-attendance">{language === 'ar' ? 'حضور الكامب' : 'Camp Attendance'}</Label>
                        </div>
                        <Switch
                          id="camp-attendance"
                          checked={formAttendedCamp}
                          onCheckedChange={setFormAttendedCamp}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>



            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t-2 border-border/50 dark:border-border/80 bg-muted/10 shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto h-11 px-6 text-sm font-medium">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto h-11 px-6 text-sm font-semibold shadow-sm">
                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog >

      {/* Filters */}
      < Card >
        <CardHeader>
          <CardTitle>{t('users.filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
              <Input
                placeholder={t('users.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ltr:pl-9 rtl:pr-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={language === 'ar' ? 'حسب الدرجة التطوعية' : 'Filter by Level'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'كل الدرجات' : 'All Levels'}</SelectItem>
                <SelectItem value="under_follow_up">{t('level.under_follow_up')}</SelectItem>
                <SelectItem value="project_responsible">{t('level.project_responsible')}</SelectItem>
                <SelectItem value="responsible">{t('level.responsible')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('users.filterByCommittee')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('users.allCommittees')}</SelectItem>
                {committees.map(committee => (
                  <SelectItem key={committee.id} value={committee.id}>
                    {language === 'ar' ? committee.name_ar : committee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card >

      {/* Users Table */}
      < Card >
        <CardHeader>
          <CardTitle>{t('common.volunteers')} ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No users found. Add your first user!
            </p>
          ) : (
            <>
              {/* Unified Responsive Cards View */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className={`overflow-hidden transition-all hover:shadow-md ${!user.is_active ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                    <div className="p-4 sm:p-5">
                      {/* Header: Avatar, Name, Email, Status */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border shadow-sm">
                              <AvatarImage src={user.avatar_url || undefined} alt={(isRTL ? user.full_name_ar : user.full_name) || user.full_name || ''} />
                              <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                                {((isRTL && user.full_name_ar) ? user.full_name_ar : user.full_name)?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            {/* Online dot */}
                            {(() => {
                              const status = getLastSeenText(user.last_seen_at);
                              return (
                                <span className={`absolute bottom-0 right-0 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full border-2 border-background ${status.dot}`} />
                              );
                            })()}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-base sm:text-lg truncate">{(isRTL ? user.full_name_ar : user.full_name) || user.full_name || 'No name'}</h3>
                              {!user.is_active && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 shrink-0">
                                  {isRTL ? 'معطّل' : 'Inactive'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate" dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>{user.email}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${getRoleBadgeClass(user.role)}`}>
                                {user.role === 'admin' && <Shield className="h-3 w-3 ltr:mr-1 rtl:ml-1" />}
                                {getRoleText(user.role)}
                              </span>
                              <LevelBadge level={user.level} size="sm" />
                            </div>
                          </div>
                        </div>

                        {/* Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 -mr-2 rtl:-ml-2 mt-1">
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {['admin', 'head_hr', 'branch_admin'].includes(primaryRole) && (
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setViewProfileUser(user)}>
                              <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                              {t('users.viewProfile')}
                            </DropdownMenuItem>
                            {['admin', 'branch_admin'].includes(primaryRole) && (
                              <DropdownMenuItem onClick={() => openCustomizeFeatures(user)}>
                                <Settings className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {isRTL ? 'تخصيص المميزات' : 'Customize Features'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                if (user.phone) {
                                  window.open(`https://wa.me/${user.phone.replace(/\D/g, '')}`, '_blank');
                                } else {
                                  toast.error(language === 'ar' ? 'لا يوجد رقم هاتف لهذا المستخدم' : 'No phone number for this user');
                                }
                              }}
                            >
                              <Mail className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                              {t('users.sendWhatsapp')}
                            </DropdownMenuItem>
                            {['admin', 'head_hr', 'branch_admin'].includes(primaryRole) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleToggleActive(user)}
                                  className={user.is_active ? 'text-orange-600 focus:text-orange-600' : 'text-emerald-600 focus:text-emerald-600'}
                                >
                                  {user.is_active
                                    ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ltr:mr-2 rtl:ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ltr:mr-2 rtl:ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                  }
                                  {user.is_active
                                    ? (isRTL ? 'تعطيل المتطوع' : 'Deactivate')
                                    : (isRTL ? 'تفعيل المتطوع' : 'Activate')
                                  }
                                </DropdownMenuItem>
                              </>
                            )}
                            {primaryRole === 'admin' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Stats & Details grid */}
                      <div className="bg-muted/30 rounded-xl p-3 space-y-2 text-sm border border-border/50">
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground text-xs font-medium">{t('users.committee')}</span>
                          <span className="font-semibold text-xs text-foreground bg-background px-2 py-1 rounded-md border shadow-sm">{user.committee_name || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground text-xs font-medium">{language === 'ar' ? 'عدد المشاركات' : 'Participations'}</span>
                          <span className="font-semibold text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">{user.participation_count || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground text-xs font-medium">{language === 'ar' ? 'آخر ظهور' : 'Last Seen'}</span>
                          <span className="font-medium text-xs">
                            {(() => {
                              const status = getLastSeenText(user.last_seen_at);
                              return status.text;
                            })()}
                          </span>
                        </div>
                        {user.phone && (
                          <div className="flex justify-between items-center py-1 border-t border-border/50 pt-2 mt-1">
                            <span className="text-muted-foreground text-xs font-medium">{t('users.phoneNumber')}</span>
                            <span className="font-medium text-xs font-mono" dir="ltr">{user.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 mt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    {language === 'ar'
                      ? `عرض ${(currentPage - 1) * pageSize + 1} إلى ${Math.min(currentPage * pageSize, totalUserCount)} من ${totalUserCount}`
                      : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, totalUserCount)} of ${totalUserCount}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      {t('common.previous')}
                    </Button>
                    <span className="text-sm font-medium px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card >

      {/* Delete Confirmation */}
      < AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              <br />
              <strong>{(isRTL ? selectedUser?.full_name_ar : selectedUser?.full_name) || selectedUser?.full_name} ({selectedUser?.email})</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >

      {/* View Profile Dialog */}
      < Dialog open={!!viewProfileUser
      } onOpenChange={(open) => !open && setViewProfileUser(null)}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl sm:rounded-3xl gap-0">
          <DialogTitle className="sr-only">
            {language === 'ar' ? 'الملف الشخصي للمتطوع' : "Volunteer Profile"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === 'ar' ? 'عرض تفاصيل الملف الشخصي' : "View profile details"}
          </DialogDescription>
          {viewProfileUser && <Profile userId={viewProfileUser.id} />}
        </DialogContent>
      </Dialog >

      {/* Customize Features Dialog */}
      <Dialog open={isCustomizeFeaturesDialogOpen} onOpenChange={setIsCustomizeFeaturesDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader className="px-4 sm:px-6 py-5 border-b border-border/50 dark:border-border/80 shrink-0 bg-muted/30 flex flex-col items-center text-center">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              {isRTL ? 'تخصيص المميزات والخصائص' : 'Customize Features'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {isRTL 
                ? `تعديل المميزات المتاحة لـ ${featuresSelectedUser?.full_name_ar || featuresSelectedUser?.full_name}`
                : `Modify available features for ${featuresSelectedUser?.full_name || featuresSelectedUser?.full_name_ar}`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50 rounded-xl p-4 text-xs text-yellow-800 dark:text-yellow-400">
              <p className="font-semibold mb-1">
                {isRTL ? '💡 ملاحظة حول الصلاحيات:' : '💡 Permissions Note:'}
              </p>
              <p>
                {isRTL 
                  ? 'المميزات الموسومة بـ (أساسي للدور) يتم تفعيلها تلقائياً بناءً على الدور الحالي للمتطوع ولا يمكن إيقافها من هنا.'
                  : 'Features marked as (Role default) are active by default for the user\'s role and cannot be turned off here.'
                }
              </p>
            </div>

            <div className="grid gap-3 pt-2">
              {ALL_FEATURES.map((feat) => {
                const isDefault = featuresSelectedUser 
                  ? getRoleDefaultFeatures(featuresSelectedUser.role).includes(feat.id)
                  : false;
                const isChecked = isDefault || selectedUserFeatures.includes(feat.id);

                return (
                  <div key={feat.id} className="flex items-start justify-between rounded-xl border border-border/50 p-4 transition-all hover:bg-muted/20">
                    <div className="space-y-1 ltr:pr-4 rtl:pl-4">
                      <Label htmlFor={`feat-${feat.id}`} className="font-semibold text-sm cursor-pointer select-none">
                        {isRTL ? feat.label : feat.labelEn}
                      </Label>
                      {isDefault && (
                        <p className="text-[10px] text-primary font-medium">
                          {isRTL ? '(أساسي للدور)' : '(Role default)'}
                        </p>
                      )}
                    </div>
                    <Switch
                      id={`feat-${feat.id}`}
                      disabled={isDefault || isSavingFeatures}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserFeatures(prev => [...prev, feat.id]);
                        } else {
                          setSelectedUserFeatures(prev => prev.filter(f => f !== feat.id));
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-border/50 dark:border-border/80 bg-muted/10 shrink-0">
            <Button type="button" variant="outline" disabled={isSavingFeatures} onClick={() => setIsCustomizeFeaturesDialogOpen(false)} className="w-full sm:w-auto h-11 px-6 text-sm font-medium">
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={isSavingFeatures} onClick={handleSaveFeatures} className="w-full sm:w-auto h-11 px-6 text-sm font-semibold shadow-sm">
              {isSavingFeatures ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
