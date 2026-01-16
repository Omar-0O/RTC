import { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Users, Award, Pencil, Trash2, FileSpreadsheet, GraduationCap } from 'lucide-react';
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
import { utils, writeFile } from 'xlsx';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } from 'date-fns';

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
  participationCount: number;
  trainerCount: number;
}

export default function CommitteeManagement() {
  const { t, language } = useLanguage();
  const [committees, setCommittees] = useState<CommitteeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');
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

  const getFilterDisplayLabel = (filter: string) => {
    switch (filter) {
      case 'weekly': return language === 'ar' ? 'أسبوعي' : 'Weekly';
      case 'monthly': return language === 'ar' ? 'شهري' : 'Monthly';
      case 'quarterly': return language === 'ar' ? 'ربع سنوي' : 'Quarterly';
      case 'trimester': return language === 'ar' ? 'ثلث سنوي' : 'Trimester';
      case 'semi_annual': return language === 'ar' ? 'نصف سنوي' : 'Semi-Annual';
      case 'annual': return language === 'ar' ? 'سنوي' : 'Annual';
      default: return language === 'ar' ? 'الكل' : 'All';
    }
  };

  const getDateRange = (filter: string) => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let label = 'All Time';

    switch (filter) {
      case 'weekly':
        startDate = startOfWeek(now, { weekStartsOn: 6 });
        endDate = endOfWeek(now, { weekStartsOn: 6 });
        label = 'Weekly';
        break;
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        label = 'Monthly';
        break;
      case 'quarterly':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        label = 'Quarterly';
        break;
      case 'trimester':
        {
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const startMonth = Math.floor(currentMonth / 4) * 4;
          startDate = new Date(currentYear, startMonth, 1);
          endDate = endOfMonth(new Date(currentYear, startMonth + 3));
          label = 'Trimester';
        }
        break;
      case 'semi_annual':
        const month = now.getMonth();
        if (month < 6) {
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = endOfMonth(new Date(now.getFullYear(), 5, 1));
        } else {
          startDate = new Date(now.getFullYear(), 6, 1);
          endDate = endOfMonth(new Date(now.getFullYear(), 11, 1));
        }
        label = 'Semi-Annual';
        break;
      case 'annual':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        label = 'Annual';
        break;
    }
    return { startDate, endDate, label };
  };

  const fetchCommittees = async () => {
    setIsLoading(true);
    try {
      const { data: committeesData, error } = await supabase
        .from('committees')
        .select('*')
        .order('name');

      if (error) throw error;

      const { startDate, endDate } = getDateRange(timeFilter);

      // Get stats for each committee
      const committeesWithStats: CommitteeWithStats[] = await Promise.all(
        (committeesData || []).map(async (committee) => {
          // 1. Volunteer Count (Always total currently joined)
          const { count: volunteerCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('committee_id', committee.id);

          // 2. Trainer Count
          const { count: trainerCount } = await supabase
            .from('trainers')
            .select('*', { count: 'exact', head: true })
            .eq('committee_id', committee.id);

          // 3. Stats from Activities (Points & Participations) - Filtered by Time
          let query = supabase
            .from('activity_submissions')
            .select('points_awarded')
            .eq('committee_id', committee.id)
            .eq('status', 'approved'); // Only approved points count

          if (startDate && endDate) {
            query = query
              .gte('submitted_at', startDate.toISOString())
              .lte('submitted_at', endDate.toISOString());
          }

          const { data: participationData } = await query;

          const participationCount = participationData?.length || 0;
          const totalPoints = participationData?.reduce((sum, p) => sum + (p.points_awarded || 0), 0) || 0;

          return {
            ...committee,
            committee_type: committee.committee_type as 'production' | 'fourth_year',
            volunteerCount: volunteerCount || 0,
            trainerCount: trainerCount || 0,
            totalPoints,
            participationCount
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
  }, [timeFilter]);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { startDate, endDate, label } = getDateRange(timeFilter);

      // Fetch fresh data for export
      const { data: allCommittees } = await supabase.from('committees').select('*');
      if (!allCommittees) return;

      const reportData = await Promise.all(allCommittees.map(async (committee) => {
        // 1. Volunteer Count (Total joined)
        const { count: volCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('committee_id', committee.id);

        // 2. Participation Count (Filtered by time)
        let participationQuery = supabase
          .from('activity_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('committee_id', committee.id)
          .eq('status', 'approved'); // Consistency: only approved

        if (startDate && endDate) {
          participationQuery = participationQuery
            .gte('submitted_at', startDate.toISOString())
            .lte('submitted_at', endDate.toISOString());
        }

        const { count: partCount } = await participationQuery;

        return {
          id: committee.id,
          name: language === 'ar' ? committee.name_ar : committee.name,
          volunteers: volCount || 0,
          participations: partCount || 0
        };
      }));

      // Format for Excel
      const excelRows = reportData.map(item => ({
        [language === 'ar' ? 'اسم اللجنة' : 'Committee Name']: item.name,
        [language === 'ar' ? 'عدد المتطوعين' : 'Volunteers Count']: item.volunteers,
        [language === 'ar' ? 'عدد المشاركات' : 'Participations Count']: item.participations,
      }));

      // Create Workbook
      const ws = utils.json_to_sheet(excelRows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Committees Report");

      // Save File
      // Format filename: Committees_Report_Label_YYYY-MM-DD.xlsx
      const filenameLabel = label.replace(/\s+/g, '_');
      writeFile(wb, `Committees_Report_${filenameLabel}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success(language === 'ar' ? 'تم تصدير التقرير بنجاح' : 'Report exported successfully');

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
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
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('committees.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('committees.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={language === 'ar' ? 'اختر الفترة' : 'Select Period'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
              <SelectItem value="weekly">{language === 'ar' ? 'أسبوعي' : 'Weekly'}</SelectItem>
              <SelectItem value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</SelectItem>
              <SelectItem value="quarterly">{language === 'ar' ? 'ربع سنوي' : 'Quarterly'}</SelectItem>
              <SelectItem value="trimester">{language === 'ar' ? 'ثلث سنوي' : 'Trimester'}</SelectItem>
              <SelectItem value="semi_annual">{language === 'ar' ? 'نصف سنوي' : 'Semi-Annual'}</SelectItem>
              <SelectItem value="annual">{language === 'ar' ? 'سنوي' : 'Annual'}</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            <FileSpreadsheet className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {isExporting
              ? (language === 'ar' ? 'جاري التصدير...' : 'Exporting...')
              : (language === 'ar' ? `تصدير (${getFilterDisplayLabel(timeFilter)})` : `Export (${getFilterDisplayLabel(timeFilter)})`)
            }
          </Button>

          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t('committees.addCommittee')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
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
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold">{committee.participationCount || 0}</p>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المشاركات' : 'Participations'}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold">{committee.trainerCount || 0}</p>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المدربين' : 'Trainers'}</p>
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
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('common.edit')}</DialogTitle>
            <DialogDescription>
              {t('committees.editDescription') || 'Update committee details'}
            </DialogDescription>
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
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
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
