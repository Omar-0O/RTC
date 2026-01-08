import { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Loader2, Award, UserPlus, Star, Trophy, Medal, Crown, Heart, Zap, Target, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  months_required: number | null;
  caravans_required: number | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  email: string;
};

const BADGE_ICONS = [
  { name: 'Award', name_ar: 'وسام', value: 'award', component: Award },
  { name: 'Star', name_ar: 'نجمة', value: 'star', component: Star },
  { name: 'Trophy', name_ar: 'كأس', value: 'trophy', component: Trophy },
  { name: 'Medal', name_ar: 'ميدالية', value: 'medal', component: Medal },
  { name: 'Crown', name_ar: 'تاج', value: 'crown', component: Crown },
  { name: 'Heart', name_ar: 'قلب', value: 'heart', component: Heart },
  { name: 'Zap', name_ar: 'طاقة', value: 'zap', component: Zap },
  { name: 'Target', name_ar: 'هدف', value: 'target', component: Target },
];
const BADGE_COLORS = [
  { name: 'Amber', name_ar: 'عنبري', value: '#F59E0B' },
  { name: 'Emerald', name_ar: 'زمردي', value: '#10B981' },
  { name: 'Blue', name_ar: 'أزرق', value: '#3B82F6' },
  { name: 'Violet', name_ar: 'بنفسجي', value: '#8B5CF6' },
  { name: 'Pink', name_ar: 'وردي', value: '#EC4899' },
  { name: 'Red', name_ar: 'أحمر', value: '#EF4444' },
  { name: 'Teal', name_ar: 'فيروزي', value: '#14B8A6' },
  { name: 'Orange', name_ar: 'برتقالي', value: '#F97316' },
];

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
  const [openCombobox, setOpenCombobox] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    description: '',
    description_ar: '',
    icon: 'award',
    color: '#F59E0B',
    points_required: '',
    activities_required: '',
    months_required: '',
    caravans_required: '',
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

      setBadges((badgesRes.data as any) || []);
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
      months_required: '',
      caravans_required: '',
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
        months_required: formData.months_required ? parseInt(formData.months_required) : null,
        caravans_required: formData.caravans_required ? parseInt(formData.caravans_required) : null,
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
        months_required: formData.months_required ? parseInt(formData.months_required) : null,
        caravans_required: formData.caravans_required ? parseInt(formData.caravans_required) : null,
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
      // Get volunteer's current points and activities count
      const selectedProfile = profiles.find(p => p.id === selectedUserId);

      if (!selectedProfile) {
        toast.error(isRTL ? 'لم يتم العثور على المتطوع' : 'Volunteer not found');
        return;
      }

      // Fetch full profile data with points and activities count
      // Fetch full profile data with points
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', selectedUserId)
        .single();

      if (profileError) throw profileError;

      // Fetch activities count separately
      const { count: activitiesCount, error: activitiesError } = await supabase
        .from('activity_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('volunteer_id', selectedUserId)
        .eq('status', 'approved');

      if (activitiesError) throw activitiesError;

      // Check if volunteer meets the requirements
      if (selectedBadge.points_required && (profileData.total_points || 0) < selectedBadge.points_required) {
        toast.error(
          isRTL
            ? `المتطوع يحتاج ${selectedBadge.points_required} أثر، ولديه ${profileData.total_points || 0} فقط`
            : `Volunteer needs ${selectedBadge.points_required} points, but has only ${profileData.total_points || 0}`
        );
        setSubmitting(false);
        return;
      }

      const currentActivities = activitiesCount || 0;
      if (selectedBadge.activities_required && currentActivities < selectedBadge.activities_required) {
        toast.error(
          isRTL
            ? `المتطوع يحتاج ${selectedBadge.activities_required} مشاركة، ولديه ${currentActivities} فقط`
            : `Volunteer needs ${selectedBadge.activities_required} activities, but has only ${currentActivities}`
        );
        setSubmitting(false);
        return;
      }

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
      months_required: badge.months_required?.toString() || '',
      caravans_required: badge.caravans_required?.toString() || '',
    });
    setIsEditDialogOpen(true);
  };

  const getIconComponent = (iconName: string) => {
    const icon = BADGE_ICONS.find(i => i.value === iconName);
    const IconComponent = icon ? icon.component : Award;
    return <IconComponent className="h-5 w-5" />;
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
                          <SelectItem key={icon.value} value={icon.value}>
                            <div className="flex items-center gap-2">
                              {<icon.component className="h-4 w-4" />}
                              <span>{isRTL ? icon.name_ar : icon.name}</span>
                            </div>
                          </SelectItem>
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
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color.value }} />
                              {isRTL ? color.name_ar : color.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'الأثر المطلوب' : 'Points Required'}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.points_required}
                      onChange={(e) => setFormData({ ...formData, points_required: e.target.value })}
                      placeholder={isRTL ? 'اختياري' : 'Optional'}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'المشاركات المطلوبة' : 'Activities Required'}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.activities_required}
                      onChange={(e) => setFormData({ ...formData, activities_required: e.target.value })}
                      placeholder={isRTL ? 'اختياري' : 'Optional'}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'المدة بالأشهر' : 'Months Required'}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.months_required}
                      onChange={(e) => setFormData({ ...formData, months_required: e.target.value })}
                      placeholder={isRTL ? 'اختياري' : 'Optional'}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'القوافل المطلوبة' : 'Caravans Required'}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.caravans_required}
                      onChange={(e) => setFormData({ ...formData, caravans_required: e.target.value })}
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
          <>
            {/* Mobile View (Cards) */}
            <div className="grid gap-4 md:hidden">
              {filteredBadges.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {isRTL ? 'لا توجد شارات' : 'No badges found'}
                </p>
              ) : (
                filteredBadges.map((badge) => (
                  <Card key={badge.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: badge.color + '20', color: badge.color }}
                          >
                            {getIconComponent(badge.icon)}
                          </div>
                          <div>
                            <p className="font-semibold">{isRTL ? badge.name_ar : badge.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {isRTL ? badge.description_ar : badge.description}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="-mr-2">
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
                      </div>

                      <div className="mt-4 grid gap-2 text-sm">
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">{isRTL ? 'الأثر المطلوب' : 'Points Req.'}</span>
                          {badge.points_required ? (
                            <span className="font-medium">{badge.points_required}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">{isRTL ? 'المشاركات المطلوبة' : 'Activities Req.'}</span>
                          {badge.activities_required ? (
                            <span className="font-medium">{badge.activities_required}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">{isRTL ? 'المدة بالأشهر' : 'Months Req.'}</span>
                          {badge.months_required ? (
                            <span className="font-medium">{badge.months_required}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">{isRTL ? 'القوافل المطلوبة' : 'Caravans Req.'}</span>
                          {badge.caravans_required ? (
                            <span className="font-medium">{badge.caravans_required}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{isRTL ? 'الشارة' : 'Badge'}</TableHead>
                    <TableHead className="text-start">{isRTL ? 'الوصف' : 'Description'}</TableHead>
                    <TableHead className="text-start">{isRTL ? 'الأثر المطلوب' : 'Points Req.'}</TableHead>
                    <TableHead className="text-start">{isRTL ? 'المشاركات المطلوبة' : 'Activities Req.'}</TableHead>
                    <TableHead className="text-start">{isRTL ? 'المدة بالأشهر' : 'Months Req.'}</TableHead>
                    <TableHead className="text-start">{isRTL ? 'القوافل المطلوبة' : 'Caravans Req.'}</TableHead>
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
                          {badge.months_required ? (
                            <span className="font-medium">{badge.months_required}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {badge.caravans_required ? (
                            <span className="font-medium">{badge.caravans_required}</span>
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
            </div>
          </>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setSelectedBadge(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تعديل الشارة' : 'Edit Badge'}</DialogTitle>
            <DialogDescription>
              {isRTL ? 'تعديل تفاصيل الشارة' : 'Edit badge details.'}
            </DialogDescription>
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
                        <SelectItem key={icon.value} value={icon.value}>
                          <div className="flex items-center gap-2">
                            {<icon.component className="h-4 w-4" />}
                            <span>{isRTL ? icon.name_ar : icon.name}</span>
                          </div>
                        </SelectItem>
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
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color.value }} />
                            {isRTL ? color.name_ar : color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الأثر المطلوب' : 'Points Required'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.points_required}
                    onChange={(e) => setFormData({ ...formData, points_required: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'المشاركات المطلوبة' : 'Activities Required'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.activities_required}
                    onChange={(e) => setFormData({ ...formData, activities_required: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{isRTL ? 'المدة بالأشهر' : 'Months Required'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.months_required}
                    onChange={(e) => setFormData({ ...formData, months_required: e.target.value })}
                    placeholder={isRTL ? 'اختياري' : 'Optional'}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'القوافل المطلوبة' : 'Caravans Required'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.caravans_required}
                    onChange={(e) => setFormData({ ...formData, caravans_required: e.target.value })}
                    placeholder={isRTL ? 'اختياري' : 'Optional'}
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
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between mt-2"
                >
                  {selectedUserId
                    ? profiles.find((profile) => profile.id === selectedUserId)?.full_name ||
                    profiles.find((profile) => profile.id === selectedUserId)?.email
                    : (isRTL ? 'اختر متطوع...' : 'Select a volunteer...')}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom">
                <Command>
                  <CommandInput placeholder={isRTL ? 'ابحث عن متطوع...' : 'Search volunteer...'} />
                  <CommandList>
                    <CommandEmpty>{isRTL ? 'لا يوجد متطوعين' : 'No volunteer found.'}</CommandEmpty>
                    <CommandGroup>
                      {profiles.map((profile) => (
                        <CommandItem
                          key={profile.id}
                          value={profile.full_name || profile.email}
                          onSelect={() => {
                            setSelectedUserId(profile.id === selectedUserId ? "" : profile.id);
                            setOpenCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedUserId === profile.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{isRTL ? (profile.full_name_ar || profile.full_name) : profile.full_name}</span>
                            <span className="text-xs text-muted-foreground">{profile.email}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
