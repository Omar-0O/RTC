import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Search, Plus, MoreHorizontal, Mail, Shield, User, Trash2, Upload, Loader2, Pencil, Download, Eye, EyeOff } from 'lucide-react';

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
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

import { UserRole } from '@/types';

type AppRole = UserRole;

interface UserWithDetails {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  committee_id: string | null;
  committee_name?: string;
  total_points: number;
  level: string;
  join_date: string;
  phone?: string;
}

import Profile from '@/pages/volunteer/Profile';
import { useAuth } from '@/contexts/AuthContext';

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimension 1200px (good for avatars)
        const MAX_DIMENSION = 1200;
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.7
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function UserManagement() {
  const { t, language, isRTL } = useLanguage();
  const { primaryRole } = useAuth();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<string>('volunteer');
  const [formLevel, setFormLevel] = useState<string>('under_follow_up');
  const [formCommitteeId, setFormCommitteeId] = useState<string>('');
  const [formAvatarFile, setFormAvatarFile] = useState<File | null>(null);
  const [formAvatarPreview, setFormAvatarPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch committees
      const { data: committeesData } = await supabase
        .from('committees')
        .select('id, name, name_ar')
        .order('name');

      setCommittees(committeesData || []);

      // Fetch users with their roles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const rolesMap = new Map<string, AppRole[]>();
      rolesData?.forEach(r => {
        const userRoles = rolesMap.get(r.user_id) || [];
        userRoles.push(r.role as AppRole);
        rolesMap.set(r.user_id, userRoles);
      });

      const getPrimaryRole = (roles: AppRole[]): AppRole => {
        if (roles.includes('admin')) return 'admin';
        if (roles.includes('head_hr')) return 'head_hr';
        if (roles.includes('hr')) return 'hr';
        if (roles.includes('supervisor')) return 'supervisor';
        if (roles.includes('committee_leader')) return 'committee_leader';
        if (roles.includes('head_production')) return 'head_production';
        if (roles.includes('head_fourth_year')) return 'head_fourth_year';
        if (roles.includes('head_caravans')) return 'head_caravans';
        if (roles.includes('head_events')) return 'head_events';
        return 'volunteer';
      };

      const committeesMap = new Map(committeesData?.map(c => [c.id, language === 'ar' ? c.name_ar : c.name]) || []);

      const usersWithDetails: UserWithDetails[] = (profilesData || []).map(profile => {
        const userRoles = rolesMap.get(profile.id) || ['volunteer'];
        const uniqueRoles = Array.from(new Set(userRoles)); // deduplicate just in case

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: getPrimaryRole(uniqueRoles),
          committee_id: profile.committee_id,
          committee_name: profile.committee_id ? committeesMap.get(profile.committee_id) : undefined,
          total_points: profile.total_points || 0,
          level: profile.level || 'under_follow_up',
          join_date: profile.created_at,
          phone: profile.phone,
        };
      });

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [language]);

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || user.level === levelFilter;
    const matchesCommittee = committeeFilter === 'all' || user.committee_id === committeeFilter;
    return matchesSearch && matchesLevel && matchesCommittee;
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
    setFormAvatarFile(null);
    setFormAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
      return;
    }

    let processedFile = file;
    if (file.size > 2 * 1024 * 1024) {
      toast.info(language === 'ar' ? 'جاري ضغط الصورة لتناسب الحجم المسموح...' : 'Compressing image to fit size limit...');
      try {
        processedFile = await compressImage(file);
      } catch (error) {
        console.error('Compression error:', error);
        toast.error(language === 'ar' ? 'فشل ضغط الصورة' : 'Failed to compress image');
        return;
      }
    }

    setFormAvatarFile(processedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(processedFile);
  };

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
      toast.error('Please fill in all required fields');
      return;
    }

    if (formPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get the current session to pass the auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      // Call create-user edge function with explicit auth header
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formEmail.trim(),
          password: formPassword,
          fullName: formName.trim(),
          fullNameAr: formNameAr.trim(),
          role: formRole,
          committeeId: formCommitteeId || null,
          phone: formPhone.trim() || null,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Check for function invocation error (network issues, etc.)
      if (error) {
        console.error('Edge function invocation error:', error);
        throw error;
      }

      console.log('Create user response:', data);

      // Check for errors returned from the Edge Function
      // If we have a user object, we consider it a success even if there might be an error property
      if (!data || (data.error && !data.user)) {
        throw new Error(data?.error || 'Failed to create user');
      }

      // Upload avatar if provided
      if (formAvatarFile && data.user) {
        const avatarUrl = await uploadAvatar(data.user.id);
        if (avatarUrl) {
          await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', data.user.id);
        }
      }

      // Save visible password to private details (Admin only)
      // TODO: Add user_private_details table to database or regenerate types
      /* if (data.user) {
        const { error: privateError } = await supabase
          .from('user_private_details')
          .insert({
            id: data.user.id,
            visible_password: formPassword
          });

        if (privateError) {
          console.error('Failed to save visible password:', privateError);
          // access silent fail or warn?
        }
      } */

      toast.success('User added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();

    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(error.message || 'Failed to add user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setFormName(user.full_name || '');
    setFormNameAr('');
    setFormEmail(user.email);
    setFormPhone(user.phone || '');
    setFormRole(user.role);
    setFormLevel(user.level || 'under_follow_up');
    setFormCommitteeId(user.committee_id || '');
    setIsEditDialogOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formName.trim(),
          full_name_ar: formNameAr.trim() || null,
          email: formEmail.trim(),
          phone: formPhone.trim() || null,
          committee_id: formCommitteeId || null,
          level: formLevel,
        })
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

      // Update role if changed
      if (formRole !== selectedUser.role) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: formRole as AppRole })
          .eq('user_id', selectedUser.id);

        if (roleError) throw roleError;
      }

      toast.success('User updated successfully');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      // Delete from profiles (will cascade to user_roles)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('User deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as AppRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Role updated successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
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
      case 'head_production':
      case 'head_fourth_year':
      case 'head_caravans':
      case 'head_events':
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
      case 'head_production': return t('common.head_production');
      case 'head_fourth_year': return t('common.head_fourth_year');
      case 'head_caravans': return t('common.head_caravans');
      case 'head_events': return t('common.head_events');
      default: return t('common.volunteer');
    }
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

      let passwordsMap = new Map<string, string>();
      // TODO: Add user_private_details table to database or regenerate types
      /* if (['admin', 'head_hr', 'hr'].includes(primaryRole)) {
        const { data: passwordsData, error: passwordsError } = await supabase
          .from('user_private_details')
          .select('id, visible_password');

        if (!passwordsError && passwordsData) {
          passwordsMap = new Map(passwordsData.map(p => [p.id, p.visible_password]));
        }
      } */

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

      const exportData = profilesData.map(u => ({
        'Full Name (English)': u.full_name,
        'Full Name (Arabic)': u.full_name_ar,
        'Email': u.email,
        'Phone': u.phone,
        'Role': rolesMap.get(u.id) || 'volunteer',
        'Password': passwordsMap.get(u.id) || '',
        'Joined At': new Date(u.created_at).toLocaleDateString(),
        'Mini Camp Attendance': u.level === 'under_follow_up' ? (u.attended_mini_camp ? (isRTL ? 'حضر' : 'Attended') : (isRTL ? 'لم يحضر' : 'Not Attended')) : 'N/A',
        'Camp Attendance': u.level === 'project_responsible' ? (u.attended_camp ? (isRTL ? 'حضر' : 'Attended') : (isRTL ? 'لم يحضر' : 'Not Attended')) : 'N/A'
      }));

      downloadCSV(exportData, 'Users_Export');

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export users');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('users.title')}</h1>
          <p className="text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          {['admin', 'head_hr'].includes(primaryRole) && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportUsers}>
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {isRTL ? 'تصدير المتطوعين' : 'Export Users'}
              </Button>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t('users.addUser')}
                </Button>
              </DialogTrigger>
            </div>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('users.addUser')}</DialogTitle>
              <DialogDescription>{t('users.createUser')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser}>
              <div className="grid gap-4 py-4">
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
                <div className="grid gap-2">
                  <Label htmlFor="role">{t('users.role')}</Label>
                  <Select value={formRole} onValueChange={setFormRole}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                      <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                      <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                      <SelectItem value="hr">{t('common.hr')}</SelectItem>
                      <SelectItem value="head_hr">{t('common.head_hr')}</SelectItem>
                      <SelectItem value="head_production">{t('common.head_production')}</SelectItem>
                      <SelectItem value="head_fourth_year">{t('common.head_fourth_year')}</SelectItem>
                      <SelectItem value="head_caravans">{t('common.head_caravans')}</SelectItem>
                      <SelectItem value="head_events">{t('common.head_events')}</SelectItem>
                      <SelectItem value="admin">{t('common.admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="committee">{t('users.committee')}</Label>
                  <Select
                    value={formCommitteeId || 'none'}
                    onValueChange={(val) => setFormCommitteeId(val === 'none' ? '' : val)}
                    disabled={!['admin', 'head_hr', 'hr'].includes(primaryRole)}
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
                {/* Avatar Upload */}
                <div className="grid gap-2">
                  <Label>{language === 'ar' ? 'الصورة الشخصية' : 'Profile Picture'}</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      {formAvatarPreview ? (
                        <AvatarImage src={formAvatarPreview} alt="Preview" />
                      ) : (
                        <AvatarFallback className="bg-muted">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {language === 'ar' ? 'اختر صورة' : 'Choose Image'}
                    </Button>
                    {formAvatarPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormAvatarFile(null);
                          setFormAvatarPreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        {language === 'ar' ? 'إزالة' : 'Remove'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : t('common.add')}
                </Button>
              </DialogFooter>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل المستخدم' : 'Edit User'}</DialogTitle>
            <DialogDescription>{language === 'ar' ? 'تعديل بيانات المستخدم' : 'Update user information'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser}>
            <div className="grid gap-4 py-4">
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
              <div className="grid gap-2">
                <Label htmlFor="edit-email">{t('auth.email')} *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder={t('auth.email')}
                  required
                  disabled
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground">{language === 'ar' ? 'لا يمكن تعديل البريد الإلكتروني' : 'Email cannot be changed'}</p>
              </div>
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
                <Label htmlFor="edit-role">{t('users.role')}</Label>
                <Select value={formRole} onValueChange={setFormRole} disabled={!['admin', 'head_hr'].includes(primaryRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('users.role')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                    <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                    <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                    <SelectItem value="hr">{t('common.hr')}</SelectItem>
                    <SelectItem value="head_hr">{t('common.head_hr')}</SelectItem>
                    <SelectItem value="head_production">{t('common.head_production')}</SelectItem>
                    <SelectItem value="head_fourth_year">{t('common.head_fourth_year')}</SelectItem>
                    <SelectItem value="admin">{t('common.admin')}</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label htmlFor="edit-level">{t('users.level')}</Label>
                <Select value={formLevel} onValueChange={setFormLevel} disabled={!['admin', 'head_hr'].includes(primaryRole)}>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
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
      </Card>

      {/* Users Table */}
      <Card>
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
              {/* Desktop View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t('users.fullName')}</TableHead>
                      <TableHead className="text-start">{t('users.role')}</TableHead>
                      <TableHead className="text-start">{t('users.committee')}</TableHead>
                      <TableHead className="text-start">{t('users.level')}</TableHead>
                      <TableHead className="text-start">{t('common.points')}</TableHead>
                      <TableHead className="text-start">{t('users.joined')}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                              <AvatarFallback className="text-xs">
                                {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.full_name || 'No name'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                            {user.role === 'admin' && <Shield className="h-3 w-3 ltr:mr-1 rtl:ml-1" />}
                            {getRoleText(user.role)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{user.committee_name || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <LevelBadge level={user.level} size="sm" />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{user.total_points.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(user.join_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {['admin', 'head_hr'].includes(primaryRole) && (
                                <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                  <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                  {t('common.edit')}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setViewProfileUser(user)}>
                                <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t('users.viewProfile')}
                              </DropdownMenuItem>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="grid gap-4 lg:hidden">
                {filteredUsers.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      {/* Header with avatar and actions */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                            <AvatarFallback className="text-sm">
                              {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{user.full_name || 'No name'}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 -mr-2 rtl:-ml-2">
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {['admin', 'head_hr'].includes(primaryRole) && (
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setViewProfileUser(user)}>
                              <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                              {t('users.viewProfile')}
                            </DropdownMenuItem>
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

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                          {user.role === 'admin' && <Shield className="h-3 w-3 ltr:mr-1 rtl:ml-1" />}
                          {getRoleText(user.role)}
                        </span>
                        <LevelBadge level={user.level} size="sm" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">{t('users.committee')}</p>
                          <p className="font-medium truncate">{user.committee_name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">{t('common.points')}</p>
                          <p className="font-medium">{user.total_points?.toLocaleString() || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">{t('users.joined')}</p>
                          <p>{new Date(user.join_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB')}</p>
                        </div>
                        {user.phone && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">{t('users.phoneNumber')}</p>
                            <p dir="ltr" className="text-start">{user.phone}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )
          }
        </CardContent >
      </Card >

      {/* Delete Confirmation */}
      < AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              <br />
              <strong>{selectedUser?.full_name} ({selectedUser?.email})</strong>
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
      < Dialog open={!!viewProfileUser} onOpenChange={(open) => !open && setViewProfileUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'الملف الشخصي للمتطوع' : "Volunteer Profile"}
            </DialogTitle>
          </DialogHeader>
          {viewProfileUser && <Profile userId={viewProfileUser.id} />}
        </DialogContent>
      </Dialog >
    </div >
  );
}
