import { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Loader2, Award, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

type Badge = {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  description_ar: string | null;
  icon: string;
  color: string;
  points_required: number | null;
  activities_required: number | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  email: string;
};

const BADGE_ICONS = ['award', 'star', 'trophy', 'medal', 'crown', 'heart', 'zap', 'target'];
const BADGE_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#14B8A6', '#F97316'];

export default function BadgeManagement() {
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAwardDialogOpen, setIsAwardDialogOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    description: '',
    description_ar: '',
    icon: 'award',
    color: '#F59E0B',
    points_required: '',
    activities_required: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [badgesRes, profilesRes] = await Promise.all([
        supabase.from('badges').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, full_name_ar, email').order('full_name'),
      ]);

      if (badgesRes.error) throw badgesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setBadges(badgesRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (error: any) {
      toast.error(isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBadges = badges.filter(badge => {
    const name = isRTL ? badge.name_ar : badge.name;
    const description = isRTL ? badge.description_ar : badge.description;
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (description || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const resetForm = () => {
    setFormData({
      name: '',
      name_ar: '',
      description: '',
      description_ar: '',
      icon: 'award',
      color: '#F59E0B',
      points_required: '',
      activities_required: '',
    });
  };

  const handleAddBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from('badges').insert({
        name: formData.name,
        name_ar: formData.name_ar,
        description: formData.description || null,
        description_ar: formData.description_ar || null,
        icon: formData.icon,
        color: formData.color,
        points_required: formData.points_required ? parseInt(formData.points_required) : null,
        activities_required: formData.activities_required ? parseInt(formData.activities_required) : null,
      });

      if (error) throw error;

      toast.success(isRTL ? 'تم إنشاء الشارة بنجاح' : 'Badge created successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(isRTL ? 'فشل في إنشاء الشارة' : 'Failed to create badge');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBadge) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('badges').update({
        name: formData.name,
        name_ar: formData.name_ar,
        description: formData.description || null,
        description_ar: formData.description_ar || null,
        icon: formData.icon,
        color: formData.color,
        points_required: formData.points_required ? parseInt(formData.points_required) : null,
        activities_required: formData.activities_required ? parseInt(formData.activities_required) : null,
      }).eq('id', selectedBadge.id);

      if (error) throw error;

      toast.success(isRTL ? 'تم تحديث الشارة بنجاح' : 'Badge updated successfully');
      setIsEditDialogOpen(false);
      setSelectedBadge(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(isRTL ? 'فشل في تحديث الشارة' : 'Failed to update badge');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBadge = async () => {
    if (!selectedBadge) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('badges').delete().eq('id', selectedBadge.id);

      if (error) throw error;

      toast.success(isRTL ? 'تم حذف الشارة بنجاح' : 'Badge deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedBadge(null);
      fetchData();
    } catch (error: any) {
      toast.error(isRTL ? 'فشل في حذف الشارة' : 'Failed to delete badge');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAwardBadge = async () => {
    if (!selectedBadge || !selectedUserId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('user_badges').insert({
        user_id: selectedUserId,
        badge_id: selectedBadge.id,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error(isRTL ? 'المستخدم لديه هذه الشارة بالفعل' : 'User already has this badge');
        } else {
          throw error;
        }
        return;
      }

      toast.success(isRTL ? 'تم منح الشارة بنجاح' : 'Badge awarded successfully');
      setIsAwardDialogOpen(false);
      setSelectedBadge(null);
      setSelectedUserId('');
    } catch (error: any) {
      toast.error(isRTL ? 'فشل في منح الشارة' : 'Failed to award badge');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (badge: Badge) => {
    setSelectedBadge(badge);
    setFormData({
      name: badge.name,
      name_ar: badge.name_ar,
      description: badge.description || '',
      description_ar: badge.description_ar || '',
      icon: badge.icon,
      color: badge.color,
      points_required: badge.points_required?.toString() || '',
      activities_required: badge.activities_required?.toString() || '',
    });
    setIsEditDialogOpen(true);
  };

  const getIconComponent = (iconName: string) => {
    return <Award className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isRTL ? 'الشارات والإنجازات' : 'Badges & Achievements'}</h1>
          <p className="text-muted-foreground">{isRTL ? 'إدارة شارات المتطوعين ومنحها يدوياً' : 'Manage volunteer badges and award them manually'}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {isRTL ? 'إضافة شارة' : 'Add Badge'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'إنشاء شارة جديدة' : 'Create New Badge'}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'تعريف شارة جديدة للمتطوعين' : 'Define a new badge for volunteers.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddBadge}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Badge Name (EN)</Label>
                    <Input 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter name" 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>اسم الشارة (عربي)</Label>
                    <Input 
                      value={formData.name_ar}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      placeholder="أدخل الاسم" 
                      required 
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'الأيقونة' : 'Icon'}</Label>
                    <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BADGE_ICONS.map(icon => (
                          <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'اللون' : 'Color'}</Label>
                    <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BADGE_COLORS.map(color => (
                          <SelectItem key={color} value={color}>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                              {color}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'النقاط المطلوبة' : 'Points Required'}</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={formData.points_required}
                      onChange={(e) => setFormData({ ...formData, points_required: e.target.value })}
                      placeholder={isRTL ? 'اختياري' : 'Optional'}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'الأنشطة المطلوبة' : 'Activities Required'}</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={formData.activities_required}
                      onChange={(e) => setFormData({ ...formData, activities_required: e.target.value })}
                      placeholder={isRTL ? 'اختياري' : 'Optional'}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Description (EN)</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Badge description"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>الوصف (عربي)</Label>
                  <Textarea 
                    value={formData.description_ar}
                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    placeholder="وصف الشارة"
                    rows={2}
                    dir="rtl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isRTL ? 'إنشاء' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'البحث' : 'Search'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'البحث في الشارات...' : 'Search badges...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Badges Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'الشارات' : 'Badges'} ({filteredBadges.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? 'الشارة' : 'Badge'}</TableHead>
                <TableHead>{isRTL ? 'الوصف' : 'Description'}</TableHead>
                <TableHead>{isRTL ? 'النقاط المطلوبة' : 'Points Req.'}</TableHead>
                <TableHead>{isRTL ? 'الأنشطة المطلوبة' : 'Activities Req.'}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBadges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد شارات' : 'No badges found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBadges.map((badge) => (
                  <TableRow key={badge.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: badge.color + '20', color: badge.color }}
                        >
                          {getIconComponent(badge.icon)}
                        </div>
                        <span className="font-medium">{isRTL ? badge.name_ar : badge.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm text-muted-foreground truncate block">
                        {isRTL ? badge.description_ar : badge.description}
                      </span>
                    </TableCell>
                    <TableCell>
                      {badge.points_required ? (
                        <span className="font-medium">{badge.points_required}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {badge.activities_required ? (
                        <span className="font-medium">{badge.activities_required}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedBadge(badge);
                            setIsAwardDialogOpen(true);
                          }}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            {isRTL ? 'منح لمتطوع' : 'Award to User'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(badge)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {isRTL ? 'تعديل' : 'Edit'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedBadge(badge);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {isRTL ? 'حذف' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setSelectedBadge(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تعديل الشارة' : 'Edit Badge'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditBadge}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Badge Name (EN)</Label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>اسم الشارة (عربي)</Label>
                  <Input 
                    value={formData.name_ar}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    required 
                    dir="rtl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الأيقونة' : 'Icon'}</Label>
                  <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BADGE_ICONS.map(icon => (
                        <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'اللون' : 'Color'}</Label>
                  <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BADGE_COLORS.map(color => (
                        <SelectItem key={color} value={color}>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                            {color}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{isRTL ? 'النقاط المطلوبة' : 'Points Required'}</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.points_required}
                    onChange={(e) => setFormData({ ...formData, points_required: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الأنشطة المطلوبة' : 'Activities Required'}</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.activities_required}
                    onChange={(e) => setFormData({ ...formData, activities_required: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Description (EN)</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label>الوصف (عربي)</Label>
                <Textarea 
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  rows={2}
                  dir="rtl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Award Badge Dialog */}
      <Dialog open={isAwardDialogOpen} onOpenChange={(open) => { setIsAwardDialogOpen(open); if (!open) { setSelectedBadge(null); setSelectedUserId(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'منح الشارة' : 'Award Badge'}</DialogTitle>
            <DialogDescription>
              {isRTL 
                ? `منح شارة "${selectedBadge?.name_ar}" لمتطوع`
                : `Award "${selectedBadge?.name}" badge to a volunteer`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>{isRTL ? 'اختر المتطوع' : 'Select Volunteer'}</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={isRTL ? 'اختر متطوع...' : 'Select a volunteer...'} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(profile => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {isRTL ? (profile.full_name_ar || profile.full_name || profile.email) : (profile.full_name || profile.email)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAwardDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleAwardBadge} disabled={submitting || !selectedUserId}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRTL ? 'منح الشارة' : 'Award Badge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف الشارة؟' : 'Delete Badge?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? `هل أنت متأكد من حذف "${selectedBadge?.name_ar}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${selectedBadge?.name}"? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBadge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
