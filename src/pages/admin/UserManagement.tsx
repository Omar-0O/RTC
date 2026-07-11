import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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
import { getUsersForExport } from '@/services/users.service';
import { useUsers, useCommittees, useCreateUser, useUpdateUser, useDeleteUser, useToggleUserActive, useUserFeatures, useSaveUserFeatures } from '@/hooks/useUsers';
import type { UserWithDetails, Committee } from '@/hooks/useUsers';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';

// Committee and UserWithDetails types imported from useUsers hook

import { UserRole } from '@/types';

// AppRole type — kept for local usage
type AppRole = UserRole;

// UserWithDetails interface imported from useUsers hook

import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { waPhoneLink } from '@/utils/phoneUtils';
import { VolunteerProfilePreview } from '@/components/volunteer/VolunteerProfilePreview';
import { getSafeImageExtension, isSafeImageFile, SAFE_IMAGE_ACCEPT } from '@/utils/safeImages';
import { downloadCsv as saveCsv } from '@/utils/csv';
import type { SpreadsheetRow } from '@/utils/spreadsheetSecurity';

// Image utilities extracted to @/utils/imageCrop

import type { Area } from 'react-easy-crop';
import { getCroppedImg } from '@/utils/imageCrop';
import { UserFeaturesDialog } from '@/components/admin/UserFeaturesDialog';
import { UserCardsGrid } from '@/components/admin/UserCardsGrid';
import { UserFilters } from '@/components/admin/UserFilters';
import { AvatarCropPanel } from '@/components/admin/AvatarCropPanel';

type CsvRow = SpreadsheetRow;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const message = (error as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

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
  const saveUserFeaturesMutation = useSaveUserFeatures();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [viewProfileUser, setViewProfileUser] = useState<UserWithDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom features states
  const [isCustomizeFeaturesDialogOpen, setIsCustomizeFeaturesDialogOpen] = useState(false);
  const [featuresSelectedUser, setFeaturesSelectedUser] = useState<UserWithDetails | null>(null);
  const [selectedUserFeatures, setSelectedUserFeatures] = useState<string[]>([]);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const { data: loadedUserFeatures = [] } = useUserFeatures(featuresSelectedUser?.id);

  useEffect(() => {
    if (featuresSelectedUser) setSelectedUserFeatures(loadedUserFeatures);
  }, [featuresSelectedUser, loadedUserFeatures]);

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
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, isRTL ? 'فشل في تغيير الحالة' : 'Failed to change status'));
    }
  };

  const openCustomizeFeatures = (user: UserWithDetails) => {
    setFeaturesSelectedUser(user);
    setIsCustomizeFeaturesDialogOpen(true);
    setSelectedUserFeatures([]);
  };

  const handleSaveFeatures = async () => {
    if (!featuresSelectedUser) return;
    setIsSavingFeatures(true);
    try {
      await saveUserFeaturesMutation.mutateAsync({
        userId: featuresSelectedUser.id,
        features: selectedUserFeatures,
      });

      toast.success(isRTL ? 'تم حفظ المميزات بنجاح' : 'Features saved successfully');
      setIsCustomizeFeaturesDialogOpen(false);
    } catch (err: unknown) {
      console.error('Error saving features:', err);
      toast.error(getErrorMessage(err, isRTL ? 'فشل في حفظ المميزات' : 'Failed to save features'));
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

    if (!isSafeImageFile(file)) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة JPG أو PNG أو WebP' : 'Please select a JPG, PNG, or WebP image');
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

  const onCropComplete = (_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
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

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast.error(isRTL ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill in all required fields");
      return;
    }
    if (formPassword.length < 6) {
      toast.error(isRTL ? "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    setIsSubmitting(true);
    try {
      await createUserMutation.mutateAsync({
        email: formEmail.trim(), password: formPassword, fullName: formName.trim(), fullNameAr: formNameAr.trim(), role: formRole,
        committeeId: formCommitteeId || null, phone: formPhone.trim() || null, level: formLevel, joinDate: formJoinDate,
        branchId: formBranchId || null, birthDate: formBirthDate || null, attendedMiniCamp: formAttendedMiniCamp,
        attendedCamp: formAttendedCamp, isAshbal: formIsAshbal, avatarFile: formAvatarFile,
      });
      toast.success(language === "ar" ? "تم إضافة المستخدم بنجاح" : "User added successfully");
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      console.error("Error adding user:", error);
      toast.error(getErrorMessage(error, language === "ar" ? "فشل في إضافة المستخدم" : "Failed to add user"));
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

  const handleEditUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    if (!formName.trim() || !formEmail.trim()) {
      toast.error(isRTL ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill in all required fields");
      return;
    }
    if (formPassword && formPassword.length < 6) {
      toast.error(isRTL ? "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateUserMutation.mutateAsync({
        userId: selectedUser.id, fullName: formName.trim(), fullNameAr: formNameAr.trim() || null, email: formEmail.trim(),
        phone: formPhone.trim() || null, committeeId: formCommitteeId || null, branchId: formBranchId || null, level: formLevel,
        attendedMiniCamp: formAttendedMiniCamp, attendedCamp: formAttendedCamp, isAshbal: formIsAshbal, joinDate: formJoinDate,
        birthDate: formBirthDate || null, role: formRole, previousRole: selectedUser.role, password: formPassword || undefined,
        avatarFile: formAvatarFile,
      });
      toast.success(language === "ar" ? "تم تحديث بيانات المستخدم بنجاح" : "User updated successfully");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      toast.error(getErrorMessage(error, language === "ar" ? "فشل في تحديث بيانات المستخدم" : "Failed to update user"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await deleteUserMutation.mutateAsync(selectedUser.id);
      toast.success(language === "ar" ? "تم حذف المستخدم بنجاح" : "User deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      toast.error(getErrorMessage(error, language === "ar" ? "فشل حذف المستخدم" : "Failed to delete user"));
    } finally {
      setIsSubmitting(false);
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
      case 'head_production':
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

  const downloadCSV = (data: CsvRow[], filename: string) => {
    if (data.length === 0) {
      toast.error(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    saveCsv(data, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);

    toast.success(language === 'ar' ? 'تم تصدير الملف بنجاح' : 'File exported successfully');
  };

  const handleExportUsers = async () => {
    try {
      const exportRows = await getUsersForExport({ branchId: activeBranch?.id, canViewAllBranches });
      const exportData = exportRows.map((user) => ({
        "Full Name (English)": user.fullName,
        "Full Name (Arabic)": user.fullNameAr,
        Email: user.email,
        Phone: user.phone ? String.fromCharCode(39) + user.phone : "",
        Role: getRoleText(user.role),
        "Joined At": new Date(user.createdAt).toLocaleDateString(),
        "Mini Camp Attendance": user.level === "under_follow_up" ? (user.attendedMiniCamp ? (isRTL ? "حضر" : "Attended") : (isRTL ? "لم يحضر" : "Not Attended")) : "N/A",
        "Camp Attendance": user.level === "project_responsible" ? (user.attendedCamp ? (isRTL ? "حضر" : "Attended") : (isRTL ? "لم يحضر" : "Not Attended")) : "N/A",
      }));
      downloadCSV(exportData, "Users_Export");
    } catch (error) {
      console.error("Export error:", error);
      toast.error(isRTL ? "فشل في تصدير المستخدمين" : "Failed to export users");
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
                    <Select value={formLevel} onValueChange={setFormLevel} disabled={!['admin', 'head_hr', 'supervisor', 'branch_admin'].includes(primaryRole)}>
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
                    disabled={!['admin', 'head_hr', 'hr', 'supervisor', 'branch_admin'].includes(primaryRole)}
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
                        accept={SAFE_IMAGE_ACCEPT}
                        ref={fileInputRef}
                        onChange={handleAvatarSelect}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === 'ar' ? 'الحد الأقصى 2 ميجابايت' : 'Max size 2MB'}
                      </p>
                    </div>
                  </div>

                  <AvatarCropPanel
                    image={isCropping ? tempImageSrc : null}
                    crop={crop}
                    zoom={zoom}
                    isRTL={isRTL}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    onCancel={() => { setIsCropping(false); setTempImageSrc(null); setFormAvatarFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    onSave={showCroppedImage}
                  />
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
                      accept={SAFE_IMAGE_ACCEPT}
                      ref={fileInputRef}
                      onChange={handleAvatarSelect}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'ar' ? 'الحد الأقصى 2 ميجابايت' : 'Max size 2MB'}
                    </p>
                  </div>
                </div>

                <AvatarCropPanel
                  image={isCropping ? tempImageSrc : null}
                  crop={crop}
                  zoom={zoom}
                  isRTL={isRTL}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  onCancel={() => { setIsCropping(false); setTempImageSrc(null); setFormAvatarFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  onSave={showCroppedImage}
                />
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

      <UserFilters
        isRTL={isRTL}
        search={searchQuery}
        level={levelFilter}
        committeeId={committeeFilter}
        committees={committees}
        onSearchChange={setSearchQuery}
        onLevelChange={setLevelFilter}
        onCommitteeChange={setCommitteeFilter}
      />

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
              <UserCardsGrid
                users={filteredUsers}
                primaryRole={primaryRole}
                isRTL={isRTL}
                language={language}
                getRoleText={getRoleText}
                getRoleBadgeClass={getRoleBadgeClass}
                getLastSeen={getLastSeenText}
                onEdit={openEditDialog}
                onView={setViewProfileUser}
                onCustomize={openCustomizeFeatures}
                onMessage={(user) => {
                  const url = waPhoneLink(user.phone);
                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                  else toast.error(isRTL ? "لا يوجد رقم هاتف صالح لهذا المستخدم" : "No valid phone number for this user");
                }}
                onToggleActive={handleToggleActive}
                onDelete={(user) => { setSelectedUser(user); setIsDeleteDialogOpen(true); }}
              />

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
          {viewProfileUser && <VolunteerProfilePreview userId={viewProfileUser.id} />}
        </DialogContent>
      </Dialog >

      <UserFeaturesDialog
        open={isCustomizeFeaturesDialogOpen}
        isRTL={isRTL}
        userName={featuresSelectedUser ? (isRTL ? featuresSelectedUser.full_name_ar || featuresSelectedUser.full_name || "" : featuresSelectedUser.full_name || featuresSelectedUser.full_name_ar || "") : ""}
        features={ALL_FEATURES}
        defaultFeatures={featuresSelectedUser ? getRoleDefaultFeatures(featuresSelectedUser.role) : []}
        selectedFeatures={selectedUserFeatures}
        saving={isSavingFeatures}
        onOpenChange={setIsCustomizeFeaturesDialogOpen}
        onSelectedFeaturesChange={setSelectedUserFeatures}
        onSave={handleSaveFeatures}
      />

    </div >
  );
}
