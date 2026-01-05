import { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Users, Award, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DropdownMenuTrigger,
  DropdownMenuItem,
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
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Committee {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  description_ar: string | null;
  color: string | null;
  committee_type: 'production' | 'fourth_year';
}

interface CommitteeWithStats extends Committee {
  volunteerCount: number;
  totalPoints: number;
}

export default function CommitteeManagement() {
  const { t, language } = useLanguage();
  const [committees, setCommittees] = useState<CommitteeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState<CommitteeWithStats | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDescriptionAr, setFormDescriptionAr] = useState('');

  const [formColor, setFormColor] = useState('#3B82F6');
  const [formType, setFormType] = useState<'production' | 'fourth_year'>('production');

  const fetchCommittees = async () => {
    setIsLoading(true);
    try {
      const { data: committeesData, error } = await supabase
        .from('committees')
        .select('*')
        .order('name');

      if (error) throw error;

      // Get stats for each committee
      const committeesWithStats: CommitteeWithStats[] = await Promise.all(
        (committeesData || []).map(async (committee) => {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('total_points')
            .eq('committee_id', committee.id);

          const volunteerCount = profiles?.length || 0;
          const totalPoints = profiles?.reduce((sum, p) => sum + (p.total_points || 0), 0) || 0;

          return {
            ...committee,
            volunteerCount,
            totalPoints,
          };
        })
      );

      setCommittees(committeesWithStats);
    } catch (error) {
      console.error('Error fetching committees:', error);
      toast.error('Failed to load committees');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommittees();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormNameAr('');
    setFormDescription('');
    setFormDescriptionAr('');
    setFormColor('#3B82F6');
    setFormType('production');
  };

  const handleAddCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNameAr.trim()) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('committees').insert({
        name: formName.trim(),
        name_ar: formNameAr.trim(),
        description: formDescription.trim() || null,
        description_ar: formDescriptionAr.trim() || null,
        color: formColor,
        committee_type: formType,
      });

      if (error) throw error;

      toast.success('Committee added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      fetchCommittees();
    } catch (error: any) {
      console.error('Error adding committee:', error);
      toast.error(error.message || 'Failed to add committee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommittee || !formName.trim() || !formNameAr.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('committees')
        .update({
          name: formName.trim(),
          name_ar: formNameAr.trim(),
          description: formDescription.trim() || null,
          description_ar: formDescriptionAr.trim() || null,

          color: formColor,
          committee_type: formType,
        })
        .eq('id', selectedCommittee.id);

      if (error) throw error;

      toast.success('Committee updated successfully');
      setIsEditDialogOpen(false);
      setSelectedCommittee(null);
      resetForm();
      fetchCommittees();
    } catch (error: any) {
      console.error('Error updating committee:', error);
      toast.error(error.message || 'Failed to update committee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCommittee = async () => {
    if (!selectedCommittee) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('committees')
        .delete()
        .eq('id', selectedCommittee.id);

      if (error) throw error;

      toast.success('Committee deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedCommittee(null);
      fetchCommittees();
    } catch (error: any) {
      console.error('Error deleting committee:', error);
      toast.error(error.message || 'Failed to delete committee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (committee: CommitteeWithStats) => {
    setSelectedCommittee(committee);
    setFormName(committee.name);
    setFormNameAr(committee.name_ar);
    setFormDescription(committee.description || '');
    setFormDescriptionAr(committee.description_ar || '');
    setFormColor(committee.color || '#3B82F6');
    setFormType(committee.committee_type || 'production');
    setIsEditDialogOpen(true);
  };

  const getDisplayName = (committee: Committee) => {
    return language === 'ar' ? committee.name_ar : committee.name;
  };

  const getDisplayDescription = (committee: Committee) => {
    return language === 'ar' ? committee.description_ar : committee.description;
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
          <h1 className="text-3xl font-bold tracking-tight">{t('committees.title')}</h1>
          <p className="text-muted-foreground">{t('committees.subtitle')}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('committees.addCommittee')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('committees.createNew')}</DialogTitle>
              <DialogDescription>{t('committees.createDescription')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCommittee}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name (English) *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Committee name in English"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name-ar">الاسم (عربي) *</Label>
                  <Input
                    id="name-ar"
                    value={formNameAr}
                    onChange={(e) => setFormNameAr(e.target.value)}
                    placeholder="اسم اللجنة بالعربي"
                    dir="rtl"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (English)</Label>
                  <Textarea
                    id="description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Committee description"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description-ar">الوصف (عربي)</Label>
                  <Textarea
                    id="description-ar"
                    value={formDescriptionAr}
                    onChange={(e) => setFormDescriptionAr(e.target.value)}
                    placeholder="وصف اللجنة"
                    dir="rtl"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formType}
                    onValueChange={(val: 'production' | 'fourth_year') => setFormType(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Production Committee / لجنة انتاج</SelectItem>
                      <SelectItem value="fourth_year">Fourth Year Committee / لجنة سنة رابعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="h-10 w-20"
                  />
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

      {/* Committee Grid */}
      {committees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No committees yet. Add your first committee!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((committee) => (
            <Card key={committee.id} className="relative">
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                style={{ backgroundColor: committee.color || '#3B82F6' }}
              />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{getDisplayName(committee)}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(committee)}>
                        <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setSelectedCommittee(committee);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-sm text-muted-foreground">
                  {getDisplayDescription(committee) || 'No description'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold">{committee.volunteerCount}</p>
                    <p className="text-xs text-muted-foreground">{t('common.volunteers')}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Award className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold">{committee.totalPoints.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{t('common.points')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setSelectedCommittee(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.edit')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditCommittee}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name (English) *</Label>
                <Input
                  id="edit-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name-ar">الاسم (عربي) *</Label>
                <Input
                  id="edit-name-ar"
                  value={formNameAr}
                  onChange={(e) => setFormNameAr(e.target.value)}
                  dir="rtl"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description (English)</Label>
                <Textarea
                  id="edit-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description-ar">الوصف (عربي)</Label>
                <Textarea
                  id="edit-description-ar"
                  value={formDescriptionAr}
                  onChange={(e) => setFormDescriptionAr(e.target.value)}
                  dir="rtl"
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={formType}
                  onValueChange={(val: 'production' | 'fourth_year') => setFormType(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production Committee / لجنة انتاج</SelectItem>
                    <SelectItem value="fourth_year">Fourth Year Committee / لجنة سنة رابعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-color">Color</Label>
                <Input
                  id="edit-color"
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="h-10 w-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('committees.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('committees.deleteWarning')}
              <br />
              <strong>{selectedCommittee && getDisplayName(selectedCommittee)}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCommittee}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
