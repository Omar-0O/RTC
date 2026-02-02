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
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
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
  full_name_ar?: string | null;
  avatar_url: string | null;
  role: AppRole;
  committee_id: string | null;
  committee_name?: string;
  total_points: number;
  participation_count: number;
  level: string;
  join_date: string;
  phone?: string;
  attended_mini_camp?: boolean;
  attended_camp?: boolean;
  is_ashbal?: boolean;
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

import Cropper from 'react-easy-crop';
import { Slider } from '@/components/ui/slider';

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
    image.src = url
  })

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

/**
 * This function was adapted from the one in the Readme of https://github.com/DominicTobias/react-image-crop
 */
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<File | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const rotRad = getRadianAngle(rotation)

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  // draw rotated image
  ctx.drawImage(image, 0, 0)

  // croppedAreaPixels values are bounding box relative
  // extract the cropped image using these values
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  // set canvas width to final desired crop size - this will clear existing context
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // paste generated rotate image at the top left corner
  ctx.putImageData(data, 0, 0)

  // As a blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg')
  })
}

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
  const [formAttendedMiniCamp, setFormAttendedMiniCamp] = useState(false);
  const [formAttendedCamp, setFormAttendedCamp] = useState(false);
  const [formIsAshbal, setFormIsAshbal] = useState(false);
  const [formJoinDate, setFormJoinDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showPassword, setShowPassword] = useState(false);

  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch committees
      const { data: committeesData } = await supabase
        .from('committees')
        .select('id, name, name_ar')
        .order('name');

      setCommittees(committeesData || []);

      setCommittees(committeesData || []);

      // Fetch users, roles, and activity submissions in parallel to avoid join issues
      const usersQuery = supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      const rolesQuery = supabase
        .from('user_roles')
        .select('user_id, role');

      const activitiesQuery = supabase
        .from('activity_submissions')
        .select('volunteer_id, status');

      const [profilesRes, rolesRes, activitiesRes] = await Promise.all([
        usersQuery,
        rolesQuery,
        activitiesQuery
      ]);

      if (profilesRes.error) {
        console.error('Profiles fetch error:', profilesRes.error);
        throw profilesRes.error;
      }

      if (activitiesRes.error) {
        console.error('Activities fetch error:', activitiesRes.error);
      } else {
        console.log('Fetched activities count:', activitiesRes.data?.length);
      }

      const profilesData = profilesRes.data;
      const rolesData = rolesRes.data || [];
      const activitiesData = activitiesRes.data || [];

      // Create maps for O(1) lookup
      const rolesMap = new Map<string, AppRole[]>();
      rolesData.forEach((r: any) => {
        if (r.user_id) {
          const currentRoles = rolesMap.get(r.user_id) || [];
          currentRoles.push(r.role as AppRole);
          rolesMap.set(r.user_id, currentRoles);
        }
      });

      const participationMap = new Map<string, number>();
      activitiesData.forEach((activity: any) => {
        if (activity.volunteer_id && activity.status !== 'rejected') {
          participationMap.set(activity.volunteer_id, (participationMap.get(activity.volunteer_id) || 0) + 1);
        }
      });

      const getPrimaryRole = (roles: AppRole[]): AppRole => {
        if (roles.includes('admin')) return 'admin';
        if (roles.includes('head_hr')) return 'head_hr';
        if (roles.includes('hr')) return 'hr';
        if (roles.includes('supervisor')) return 'supervisor';
        if (roles.includes('committee_leader')) return 'committee_leader';
        if (roles.includes('head_caravans')) return 'head_caravans';
        if (roles.includes('head_events')) return 'head_events';
        if (roles.includes('head_ethics')) return 'head_ethics';
        if (roles.includes('head_quran')) return 'head_quran';
        if (roles.includes('marketing_member')) return 'marketing_member';
        return 'volunteer';
      };

      const committeesMap = new Map(committeesData?.map(c => [c.id, language === 'ar' ? c.name_ar : c.name]) || []);

      const usersWithDetails: UserWithDetails[] = (profilesData || []).map((profile: any) => {
        // Get roles from map and fallback to profile.role
        const userRoles = rolesMap.get(profile.id) || [];
        if (profile.role) {
          // Normalize role string (e.g. 'Head HR' -> 'head_hr')
          const normalizedRole = profile.role.toLowerCase().trim().replace(/ /g, '_');
          if (!userRoles.includes(normalizedRole as AppRole)) {
            userRoles.push(normalizedRole as AppRole);
          }
        }

        // Participation count from map
        const participationCount = participationMap.get(profile.id) || 0;

        // If no roles found, default to 'volunteer'
        if (userRoles.length === 0) userRoles.push('volunteer');

        const uniqueRoles = Array.from(new Set(userRoles)); // deduplicate just in case

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          full_name_ar: profile.full_name_ar,
          avatar_url: profile.avatar_url,
          role: getPrimaryRole(uniqueRoles as AppRole[]),
          committee_id: profile.committee_id,
          committee_name: profile.committee_id ? committeesMap.get(profile.committee_id) : undefined,
          total_points: profile.total_points || 0,
          participation_count: participationCount,
          level: profile.level || 'under_follow_up',
          join_date: profile.created_at,
          phone: profile.phone,
          attended_mini_camp: profile.attended_mini_camp,
          attended_camp: profile.attended_camp,
          is_ashbal: profile.is_ashbal,
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
    setFormAvatarFile(null);
    setFormAvatarPreview(null);
    setFormAttendedMiniCamp(false);
    setFormAttendedCamp(false);
    setFormIsAshbal(false);
    setFormJoinDate(format(new Date(), 'yyyy-MM-dd'));
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
      toast.error('Failed to crop image')
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

      toast.success('User added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();

    } catch (error: any) {
      console.error('Error adding user:', error);
      const message = error?.message || error?.error || 'Failed to add user';
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
    setFormAttendedMiniCamp(user.attended_mini_camp || false);
    setFormAttendedCamp(user.attended_camp || false);
    setFormAttendedCamp(user.attended_camp || false);
    setFormIsAshbal(user.is_ashbal || false);
    setFormJoinDate(user.join_date ? format(new Date(user.join_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
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
          level: formLevel as any,
          attended_mini_camp: formLevel === 'under_follow_up' ? formAttendedMiniCamp : null,
          attended_camp: formLevel === 'project_responsible' ? formAttendedCamp : null,
          is_ashbal: formIsAshbal,
          join_date: formJoinDate,
        })
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

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
          toast.error('Failed to upload new avatar');
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

        // Then, insert the new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: selectedUser.id, role: formRole as AppRole });

        if (roleError) throw roleError;
      }

      // Update password if provided
      if (formPassword.trim()) {
        if (formPassword.length < 6) {
          toast.error('Password must be at least 6 characters');
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
      fetchData();
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

      // Then, insert the new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole as AppRole });

      if (insertError) throw insertError;

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
      case 'head_production': // Keep existing style if needed or map to default, but removing case as per plan. 
      // Actually if existing users have it they will be migrated. But to avoid runtime error if data is stale:
      case 'head_caravans':
      case 'head_events':
      case 'head_events':
      case 'head_ethics':
      case 'head_quran':
        return 'bg-blue-100 text-blue-700';
      case 'marketing_member':
        return 'bg-amber-100 text-amber-700';
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
      case 'head_caravans': return t('common.head_caravans');
      case 'head_events': return t('common.head_events');
      case 'head_ethics': return t('common.head_ethics');
      case 'head_quran': return t('common.head_quran');
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

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

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
              case 'head_caravans': return 'هيد لجنة قوافل';
              case 'head_events': return 'هيد لجنة ايفنتات';
              case 'head_ethics': return 'هيد نشر اخلاقيات';
              case 'head_quran': return 'هيد لجنة القرآن';
              case 'head_marketing': return 'هيد لجنة التسويق';
              case 'head_ashbal': return 'هيد لجنة الأشبال';
              case 'head_production': return 'هيد لجان انتاج';
              case 'head_fourth_year': return 'هيد لجان سنة رابعة';
              case 'marketing_member': return 'متطوع لجنة تسويق';
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('users.title')}</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          {['admin', 'head_hr'].includes(primaryRole) && (
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
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('users.addUser')}</DialogTitle>
              <DialogDescription>{t('users.createUser')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="max-h-[70vh] overflow-y-auto px-1">
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
                        <SelectItem value="head_caravans">{t('common.head_caravans')}</SelectItem>
                        <SelectItem value="head_events">{t('common.head_events')}</SelectItem>
                        <SelectItem value="head_ethics">{t('common.head_ethics')}</SelectItem>
                        <SelectItem value="head_quran">{t('common.head_quran')}</SelectItem>
                        <SelectItem value="head_marketing">{t('common.head_marketing')}</SelectItem>
                        <SelectItem value="head_ashbal">{t('common.head_ashbal')}</SelectItem>
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
                <div className="grid gap-2">
                  <Label htmlFor="join-date">{language === 'ar' ? 'تاريخ الانضمام لعائلة RTC 😊' : 'Join Date to RTC Family 😊'}</Label>
                  <Input
                    id="join-date"
                    type="date"
                    value={formJoinDate}
                    onChange={(e) => setFormJoinDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is-ashbal"
                      checked={formIsAshbal}
                      onCheckedChange={setFormIsAshbal}
                    />
                    <Label htmlFor="is-ashbal">
                      {language === 'ar' ? 'من الأشبال؟' : 'Is Ashbal?'}
                    </Label>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto">
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل المستخدم' : 'Edit User'}</DialogTitle>
            <DialogDescription>{language === 'ar' ? 'تعديل بيانات المستخدم' : 'Update user information'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="max-h-[70vh] overflow-y-auto px-1">
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
                  <Select value={formRole} onValueChange={setFormRole} disabled={!['admin', 'head_hr'].includes(primaryRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                      <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                      <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                      <SelectItem value="head_caravans">{t('common.head_caravans')}</SelectItem>
                      <SelectItem value="head_events">{t('common.head_events')}</SelectItem>
                      <SelectItem value="head_ethics">{t('common.head_ethics')}</SelectItem>
                      <SelectItem value="hr">{t('common.hr')}</SelectItem>
                      <SelectItem value="head_hr">{t('common.head_hr')}</SelectItem>
                      <SelectItem value="head_quran">{t('common.head_quran')}</SelectItem>
                      <SelectItem value="head_marketing">{t('common.head_marketing')}</SelectItem>
                      <SelectItem value="head_ashbal">{t('common.head_ashbal')}</SelectItem>
                      <SelectItem value="marketing_member">{t('common.marketing_member')}</SelectItem>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-join-date">{language === 'ar' ? 'تاريخ الانضمام لعائلة RTC 😊' : 'Join Date to RTC Family 😊'}</Label>
                  <Input
                    id="edit-join-date"
                    type="date"
                    value={formJoinDate}
                    onChange={(e) => setFormJoinDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-is-ashbal"
                      checked={formIsAshbal}
                      onCheckedChange={setFormIsAshbal}
                    />
                    <Label htmlFor="edit-is-ashbal">
                      {language === 'ar' ? 'من الأشبال؟' : 'Is Ashbal?'}
                    </Label>
                  </div>
                </div>
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



            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? 'Updating...' : t('common.save')}
              </Button>
            </DialogFooter>
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
              {/* Desktop View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t('users.fullName')}</TableHead>
                      <TableHead className="text-start">{t('users.role')}</TableHead>
                      <TableHead className="text-start">{t('users.committee')}</TableHead>
                      <TableHead className="text-start">{t('users.level')}</TableHead>
                      <TableHead className="text-start">{language === 'ar' ? 'عدد المشاركات' : 'Number of Participations'}</TableHead>
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
                          <span className="font-medium">{user.participation_count || 0}</span>
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
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-12 w-12 shrink-0">
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

                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 pt-3 border-t text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">{t('users.committee')}</p>
                          <p className="font-medium truncate">{user.committee_name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">{language === 'ar' ? 'عدد المشاركات' : 'Participations'}</p>
                          <p className="font-medium">{user.participation_count || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">{t('users.joined')}</p>
                          <p>{new Date(user.join_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB')}</p>
                        </div>
                        {user.phone && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">{t('users.phoneNumber')}</p>
                            <p dir="ltr" className={language === 'ar' ? "text-right" : "text-left"}>{user.phone}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
      < Dialog open={!!viewProfileUser
      } onOpenChange={(open) => !open && setViewProfileUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'الملف الشخصي للمتطوع' : "Volunteer Profile"}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'عرض تفاصيل الملف الشخصي' : "View profile details"}
            </DialogDescription>
          </DialogHeader>
          {viewProfileUser && <Profile userId={viewProfileUser.id} />}
        </DialogContent>
      </Dialog >
    </div >
  );
}
