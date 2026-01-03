import { useState, useEffect, useRef } from 'react';
import { Search, Plus, MoreHorizontal, Mail, Shield, User, Trash2, Upload, Loader2 } from 'lucide-react';
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

type AppRole = 'admin' | 'supervisor' | 'volunteer' | 'committee_leader';

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
}

import Profile from '@/pages/volunteer/Profile';

export default function UserManagement() {
  const { t, language } = useLanguage();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [viewProfileUser, setViewProfileUser] = useState<UserWithDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<string>('volunteer');
  const [formCommitteeId, setFormCommitteeId] = useState<string>('');
  const [formAvatarFile, setFormAvatarFile] = useState<File | null>(null);
  const [formAvatarPreview, setFormAvatarPreview] = useState<string | null>(null);

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

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
      const committeesMap = new Map(committeesData?.map(c => [c.id, language === 'ar' ? c.name_ar : c.name]) || []);

      const usersWithDetails: UserWithDetails[] = (profilesData || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: (rolesMap.get(profile.id) as any) || 'volunteer',
        committee_id: profile.committee_id,
        committee_name: profile.committee_id ? committeesMap.get(profile.committee_id) : undefined,
        total_points: profile.total_points || 0,
        level: profile.level || 'bronze',
        join_date: profile.join_date,
      }));

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
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesCommittee = committeeFilter === 'all' || user.committee_id === committeeFilter;
    return matchesSearch && matchesRole && matchesCommittee;
  });

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('volunteer');
    setFormCommitteeId('');
    setFormAvatarFile(null);
    setFormAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت' : 'Image must be less than 2MB');
      return;
    }

    setFormAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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
      // Create user via signup
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formEmail.trim(),
        password: formPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: formName.trim(),
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Upload avatar if provided
        let avatarUrl: string | null = null;
        if (formAvatarFile) {
          avatarUrl = await uploadAvatar(authData.user.id);
        }

        // Update role
        await supabase
          .from('user_roles')
          .update({ role: formRole as AppRole })
          .eq('user_id', authData.user.id);

        // Update profile with committee and avatar
        await supabase
          .from('profiles')
          .update({
            full_name: formName.trim(),
            committee_id: formCommitteeId || null,
            avatar_url: avatarUrl,
          })
          .eq('id', authData.user.id);

        toast.success('User added successfully');
        setIsAddDialogOpen(false);
        resetForm();
        fetchData();
      }
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(error.message || 'Failed to add user');
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
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return t('common.admin');
      case 'supervisor': return t('common.supervisor');
      case 'committee_leader': return t('common.committeeLeader');
      default: return t('common.volunteer');
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
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('users.addUser')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('users.addUser')}</DialogTitle>
              <DialogDescription>{t('users.createUser')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t('users.fullName')} *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('users.fullName')}
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
                  <Label htmlFor="password">{t('password')} *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
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
                      <SelectItem value="admin">{t('common.admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="committee">{t('users.committee')}</Label>
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
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('users.filterByRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('users.allRoles')}</SelectItem>
                <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                <SelectItem value="admin">{t('common.admin')}</SelectItem>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.fullName')}</TableHead>
                  <TableHead>{t('users.role')}</TableHead>
                  <TableHead>{t('users.committee')}</TableHead>
                  <TableHead>{t('users.level')}</TableHead>
                  <TableHead>{t('common.points')}</TableHead>
                  <TableHead>{t('users.joined')}</TableHead>
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
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleUpdateRole(user.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                            {user.role === 'admin' && <Shield className="h-3 w-3 ltr:mr-1 rtl:ml-1" />}
                            {getRoleText(user.role)}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                          <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                          <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                          <SelectItem value="admin">{t('common.admin')}</SelectItem>
                        </SelectContent>
                      </Select>
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
                        {new Date(user.join_date).toLocaleDateString()}
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
                          <DropdownMenuItem onClick={() => setViewProfileUser(user)}>
                            <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t('users.viewProfile')}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t('users.sendEmail')}
                          </DropdownMenuItem>
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
      </AlertDialog>

      {/* View Profile Dialog */}
      <Dialog open={!!viewProfileUser} onOpenChange={(open) => !open && setViewProfileUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'الملف الشخصي للمتطوع' : "Volunteer Profile"}
            </DialogTitle>
          </DialogHeader>
          {viewProfileUser && <Profile userId={viewProfileUser.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
