import { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';

type ActivityType = {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  description_ar: string | null;
  points: number;
  mode: 'individual' | 'group';
  committee_id: string | null;
};

type Committee = {
  id: string;
  name: string;
  name_ar: string;
};

export default function ActivityManagement() {
  const { t, isRTL } = useLanguage();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    description: '',
    description_ar: '',
    points: 10,
    mode: 'individual' as 'individual' | 'group',
    committee_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [activitiesRes, committeesRes] = await Promise.all([
        supabase.from('activity_types').select('*').order('created_at', { ascending: false }),
        supabase.from('committees').select('id, name, name_ar').order('name'),
      ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (committeesRes.error) throw committeesRes.error;

      setActivities(activitiesRes.data || []);
      setCommittees(committeesRes.data || []);
    } catch (error: any) {
      toast.error('فشل في تحميل البيانات');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getCommitteeName = (committeeId: string | null) => {
    if (!committeeId) return isRTL ? 'جميع اللجان' : 'All Committees';
    const committee = committees.find(c => c.id === committeeId);
    return committee ? (isRTL ? committee.name_ar : committee.name) : '';
  };

  const filteredActivities = activities.filter(activity => {
    const name = isRTL ? activity.name_ar : activity.name;
    const description = isRTL ? activity.description_ar : activity.description;
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCommittee = committeeFilter === 'all' || activity.committee_id === committeeFilter || (!activity.committee_id && committeeFilter === 'none');
    return matchesSearch && matchesCommittee;
  });

  const resetForm = () => {
    setFormData({
      name: '',
      name_ar: '',
      description: '',
      description_ar: '',
      points: 10,
      mode: 'individual',
      committee_id: '',
    });
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from('activity_types').insert({
        name: formData.name,
        name_ar: formData.name_ar,
        description: formData.description || null,
        description_ar: formData.description_ar || null,
        points: formData.points,
        mode: formData.mode,
        committee_id: formData.committee_id || null,
      });

      if (error) throw error;

      toast.success(isRTL ? 'تم إنشاء نوع النشاط بنجاح' : 'Activity type created successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(isRTL ? 'فشل في إنشاء نوع النشاط' : 'Failed to create activity type');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('activity_types').update({
        name: formData.name,
        name_ar: formData.name_ar,
        description: formData.description || null,
        description_ar: formData.description_ar || null,
        points: formData.points,
        mode: formData.mode,
        committee_id: formData.committee_id || null,
      }).eq('id', selectedActivity.id);

      if (error) throw error;

      toast.success(isRTL ? 'تم تحديث نوع النشاط بنجاح' : 'Activity type updated successfully');
      setIsEditDialogOpen(false);
      setSelectedActivity(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(isRTL ? 'فشل في تحديث نوع النشاط' : 'Failed to update activity type');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!selectedActivity) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('activity_types').delete().eq('id', selectedActivity.id);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      toast.success(isRTL ? 'تم حذف نوع النشاط بنجاح' : 'Activity type deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedActivity(null);
      fetchData();
    } catch (error: any) {
      console.error('Failed to delete activity:', error);
      toast.error(isRTL ? 'فشل في حذف نوع النشاط. قد يكون هناك مشاركات مرتبطة به.' : 'Failed to delete activity type. There might be submissions linked to it.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (activity: ActivityType) => {
    setSelectedActivity(activity);
    setFormData({
      name: activity.name,
      name_ar: activity.name_ar,
      description: activity.description || '',
      description_ar: activity.description_ar || '',
      points: activity.points,
      mode: activity.mode,
      committee_id: activity.committee_id || '',
    });
    setIsEditDialogOpen(true);
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
          <h1 className="text-3xl font-bold tracking-tight">{isRTL ? 'أنواع الأنشطة' : 'Activity Types'}</h1>
          <p className="text-muted-foreground">{isRTL ? 'إدارة أنواع الأنشطة التطوعية والأثر' : 'Manage volunteer activity types and point values'}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {isRTL ? 'إضافة نوع نشاط' : 'Add Activity Type'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'إنشاء نوع نشاط' : 'Create Activity Type'}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'تعريف نوع جديد من الأنشطة التطوعية' : 'Define a new type of volunteer activity.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddActivity}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Activity Name (EN)</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter name"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name_ar">اسم النشاط (عربي)</Label>
                    <Input
                      id="name_ar"
                      value={formData.name_ar}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      placeholder="أدخل الاسم"
                      required
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="committee">{isRTL ? 'اللجنة' : 'Committee'}</Label>
                  <Select
                    value={formData.committee_id}
                    onValueChange={(value) => setFormData({ ...formData, committee_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر اللجنة' : 'Select committee'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? 'جميع اللجان' : 'All Committees'}</SelectItem>
                      {committees
                        .filter(c => !profile?.committee_id || c.id === profile.committee_id)
                        .map(committee => (
                          <SelectItem key={committee.id} value={committee.id}>
                            {isRTL ? committee.name_ar : committee.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="points">{isRTL ? 'الأثر' : 'Points Value'}</Label>
                    <Input
                      id="points"
                      type="number"
                      min="1"
                      max="1000"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 10 })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mode">{isRTL ? 'النوع' : 'Mode'}</Label>
                    <Select
                      value={formData.mode}
                      onValueChange={(value: 'individual' | 'group') => setFormData({ ...formData, mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">{isRTL ? 'فردي' : 'Individual'}</SelectItem>
                        <SelectItem value="group">{isRTL ? 'جماعي' : 'Group'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (EN)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this activity"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description_ar">الوصف (عربي)</Label>
                  <Textarea
                    id="description_ar"
                    value={formData.description_ar}
                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    placeholder="وصف النشاط"
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'الفلاتر' : 'Filters'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={isRTL ? 'البحث في الأنشطة...' : 'Search activities...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={isRTL ? 'فلترة حسب اللجنة' : 'Filter by committee'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'جميع اللجان' : 'All Committees'}</SelectItem>
                <SelectItem value="none">{isRTL ? 'عام (بدون لجنة)' : 'General (No Committee)'}</SelectItem>
                {committees.map(committee => (
                  <SelectItem key={committee.id} value={committee.id}>
                    {isRTL ? committee.name_ar : committee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'أنواع الأنشطة' : 'Activity Types'} ({filteredActivities.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <>
            {/* Mobile View (Cards) */}
            <div className="grid gap-4 md:hidden">
              {filteredActivities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {isRTL ? 'لا توجد أنشطة' : 'No activities found'}
                </p>
              ) : (
                filteredActivities.map((activity) => (
                  <Card key={activity.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{isRTL ? activity.name_ar : activity.name}</p>
                          <span className="text-sm text-muted-foreground block mt-1">
                            {isRTL ? activity.description_ar : activity.description}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="-mr-2">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(activity)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {isRTL ? 'تعديل' : 'Edit'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedActivity(activity);
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
                          <span className="text-muted-foreground">{isRTL ? 'اللجنة' : 'Committee'}</span>
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                            {getCommitteeName(activity.committee_id)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">{isRTL ? 'الأثر' : 'Points'}</span>
                          <span className="font-bold text-primary">{activity.points} {isRTL ? 'أثر' : 'pts'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">{isRTL ? 'النوع' : 'Mode'}</span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${activity.mode === 'group' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                            {activity.mode === 'group' ? (isRTL ? 'جماعي' : 'Group') : (isRTL ? 'فردي' : 'Individual')}
                          </span>
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
                    <TableHead className="text-start">{isRTL ? 'اسم النشاط' : 'Activity Name'}</TableHead>
                    <TableHead className="text-start">{isRTL ? 'اللجنة' : 'Committee'}</TableHead>
                    <TableHead className="text-start">{isRTL ? 'الأثر' : 'Points'}</TableHead>
                    <TableHead className="text-start">{isRTL ? 'النوع' : 'Mode'}</TableHead>
                    <TableHead className="max-w-[200px] text-start">{isRTL ? 'الوصف' : 'Description'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {isRTL ? 'لا توجد أنشطة' : 'No activities found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium">
                          {isRTL ? activity.name_ar : activity.name}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                            {getCommitteeName(activity.committee_id)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-primary">{activity.points} {isRTL ? 'أثر' : 'pts'}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${activity.mode === 'group' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                            {activity.mode === 'group' ? (isRTL ? 'جماعي' : 'Group') : (isRTL ? 'فردي' : 'Individual')}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-sm text-muted-foreground truncate block">
                            {isRTL ? activity.description_ar : activity.description}
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
                              <DropdownMenuItem onClick={() => openEditDialog(activity)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {isRTL ? 'تعديل' : 'Edit'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedActivity(activity);
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
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setSelectedActivity(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تعديل نوع النشاط' : 'Edit Activity Type'}</DialogTitle>
            <DialogDescription>
              {isRTL ? 'تحديث تفاصيل نوع النشاط' : 'Update activity type details.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditActivity}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Activity Name (EN)</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-name_ar">اسم النشاط (عربي)</Label>
                  <Input
                    id="edit-name_ar"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    required
                    dir="rtl"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'اللجنة' : 'Committee'}</Label>
                <Select
                  value={formData.committee_id || 'all'}
                  onValueChange={(value) => setFormData({ ...formData, committee_id: value === 'all' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? 'جميع اللجان' : 'All Committees'}</SelectItem>
                    {committees
                      .filter(c => !profile?.committee_id || c.id === profile.committee_id)
                      .map(committee => (
                        <SelectItem key={committee.id} value={committee.id}>
                          {isRTL ? committee.name_ar : committee.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الأثر' : 'Points Value'}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 10 })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'النوع' : 'Mode'}</Label>
                  <Select
                    value={formData.mode}
                    onValueChange={(value: 'individual' | 'group') => setFormData({ ...formData, mode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">{isRTL ? 'فردي' : 'Individual'}</SelectItem>
                      <SelectItem value="group">{isRTL ? 'جماعي' : 'Group'}</SelectItem>
                    </SelectContent>
                  </Select>
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
                {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف نوع النشاط؟' : 'Delete Activity Type?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? `هل أنت متأكد من حذف "${selectedActivity?.name_ar}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${selectedActivity?.name}"? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteActivity}
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
