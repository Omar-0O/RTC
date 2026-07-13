import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type BranchRow = Database['public']['Tables']['branches']['Row'];
type BranchInsert = Database['public']['Tables']['branches']['Insert'];
type BranchUpdate = Database['public']['Tables']['branches']['Update'];
type BranchSummary = Pick<
  BranchRow,
  'id' | 'name' | 'name_ar' | 'code' | 'is_default' | 'created_at' | 'updated_at'
>;
type ProfileBranchRef = Pick<Database['public']['Tables']['profiles']['Row'], 'branch_id'>;

interface BranchStats extends BranchSummary {
  volunteer_count: number;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

export default function BranchManagement() {
  const { language, isRTL } = useLanguage();
  const { refreshBranches } = useBranch();

  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchStats | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formCode, setFormCode] = useState('');

  const ar = (ar: string, en: string) => language === 'ar' ? ar : en;

  const fetchBranchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [branchResult, profileResult] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name, name_ar, code, is_default, created_at, updated_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('branch_id')
          .not('branch_id', 'is', null),
      ]);

      if (branchResult.error) throw branchResult.error;
      if (profileResult.error) throw profileResult.error;

      const countMap = new Map<string, number>();
      ((profileResult.data || []) as ProfileBranchRef[]).forEach(p => {
        if (p.branch_id) {
          countMap.set(p.branch_id, (countMap.get(p.branch_id) || 0) + 1);
        }
      });

      const stats: BranchStats[] = ((branchResult.data || []) as BranchSummary[]).map(b => ({
        ...b,
        volunteer_count: countMap.get(b.id) ?? 0,
      }));

      setBranchStats(stats);
    } catch (err) {
      console.error(err);
      toast.error(language === 'ar' ? 'فشل في تحميل الفروع' : 'Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchBranchStats();
  }, [fetchBranchStats]);

  const resetForm = () => {
    setFormName('');
    setFormNameAr('');
    setFormCode('');
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNameAr.trim()) {
      toast.error(ar('يرجى ملء جميع الحقول المطلوبة', 'Please fill in all required fields'));
      return;
    }

    setIsSubmitting(true);
    try {
      const newBranch: BranchInsert = { name: formName.trim(), name_ar: formNameAr.trim(), code: formCode.trim() || null, is_default: false };
      const { data, error } = await supabase
        .from('branches')
        .insert(newBranch)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Branch was not created');

      toast.success(ar('تم إضافة الفرع بنجاح', 'Branch added successfully'));
      setIsAddDialogOpen(false);
      resetForm();
      await refreshBranches();
      await fetchBranchStats();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, ar('فشل في إضافة الفرع', 'Failed to add branch')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (branch: BranchStats) => {
    setSelectedBranch(branch);
    setFormName(branch.name);
    setFormNameAr(branch.name_ar);
    setFormCode(branch.code || '');
    setIsEditDialogOpen(true);
  };

  const handleEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    if (!formName.trim() || !formNameAr.trim()) {
      toast.error(ar('يرجى ملء جميع الحقول المطلوبة', 'Please fill in all required fields'));
      return;
    }

    setIsSubmitting(true);
    try {
      const branchUpdates: BranchUpdate = { name: formName.trim(), name_ar: formNameAr.trim(), code: formCode.trim() || null };
      const { data, error } = await supabase
        .from('branches')
        .update(branchUpdates)
        .eq('id', selectedBranch.id)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Branch was not updated');

      toast.success(ar('تم تحديث الفرع بنجاح', 'Branch updated successfully'));
      setIsEditDialogOpen(false);
      setSelectedBranch(null);
      resetForm();
      await refreshBranches();
      await fetchBranchStats();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, ar('فشل في تحديث الفرع', 'Failed to update branch')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (branch: BranchStats) => {
    setSelectedBranch(branch);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteBranch = async () => {
    if (!selectedBranch) return;
    if (selectedBranch.is_default) {
      toast.error(ar('لا يمكن حذف الفرع الافتراضي', 'The default branch cannot be deleted'));
      return;
    }
    if (selectedBranch.volunteer_count > 0) {
      toast.error(ar(
        'انقل المتطوعين إلى فرع آخر قبل حذف هذا الفرع',
        'Move this branch\'s volunteers before deleting it'
      ));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .delete()
        .eq('id', selectedBranch.id)
        .select('id');

      if (error) throw error;
      if (!data?.length) throw new Error('Branch was not deleted');

      toast.success(ar('تم حذف الفرع بنجاح', 'Branch deleted successfully'));
      setIsDeleteDialogOpen(false);
      setSelectedBranch(null);
      await refreshBranches();
      await fetchBranchStats();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, ar('فشل في حذف الفرع', 'Failed to delete branch')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            {ar('إدارة الفروع', 'Branch Management')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ar('أضف وعدّل فروع الجمعية وتتبع أعداد المتطوعين في كل فرع', 'Add and manage organization branches and track volunteer counts')}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} className="shrink-0">
          <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
          {ar('إضافة فرع جديد', 'Add New Branch')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{branchStats.length}</p>
              <p className="text-sm text-muted-foreground mt-1">{ar('إجمالي الفروع', 'Total Branches')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {branchStats.reduce((sum, b) => sum + b.volunteer_count, 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{ar('إجمالي المتطوعين', 'Total Volunteers')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branches Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : branchStats.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {ar('لا توجد فروع بعد. أضف أول فرع!', 'No branches yet. Add your first branch!')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branchStats.map(branch => (
            <Card key={branch.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg leading-tight">
                      {language === 'ar' ? branch.name_ar : branch.name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {branch.code ? `${ar('كود:', 'Code:')} ${branch.code}` : ar('لا يوجد كود', 'No code set')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-bold">{branch.volunteer_count}</p>
                    <p className="text-xs text-muted-foreground">{ar('متطوع', 'volunteers')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(branch)}
                  >
                    <Pencil className={cn('h-3.5 w-3.5', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                    {ar('تعديل', 'Edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => openDeleteDialog(branch)}
                    disabled={branch.is_default || branch.volunteer_count > 0}
                    title={branch.is_default
                      ? ar('لا يمكن حذف الفرع الافتراضي', 'The default branch cannot be deleted')
                      : branch.volunteer_count > 0
                        ? ar('انقل المتطوعين أولاً', 'Move volunteers first')
                        : ar('حذف الفرع', 'Delete branch')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Branch Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ar('إضافة فرع جديد', 'Add New Branch')}</DialogTitle>
            <DialogDescription>
              {ar('أدخل بيانات الفرع الجديد', 'Enter the details for the new branch')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddBranch}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{ar('اسم الفرع (إنجليزي)', 'Branch Name (English)')} *</Label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Mohandeseen"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>{ar('اسم الفرع (عربي)', 'Branch Name (Arabic)')} *</Label>
                <Input
                  value={formNameAr}
                  onChange={e => setFormNameAr(e.target.value)}
                  placeholder="المهندسين"
                  dir="rtl"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>{ar('كود الفرع (اختياري)', 'Branch Code (Optional)')}</Label>
                <Input
                  value={formCode}
                  onChange={e => setFormCode(e.target.value)}
                  placeholder="e.g. ma"
                />
                <p className="text-xs text-muted-foreground">
                  {ar('يستخدم في الاستيراد للتعرف على الفرع', 'Used in import to identify branch')}
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                {ar('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ar('إضافة', 'Add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setSelectedBranch(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ar('تعديل الفرع', 'Edit Branch')}</DialogTitle>
            <DialogDescription>
              {ar('تعديل بيانات الفرع', 'Update branch details')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditBranch}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{ar('اسم الفرع (إنجليزي)', 'Branch Name (English)')} *</Label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Mohandeseen"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>{ar('اسم الفرع (عربي)', 'Branch Name (Arabic)')} *</Label>
                <Input
                  value={formNameAr}
                  onChange={e => setFormNameAr(e.target.value)}
                  placeholder="المهندسين"
                  dir="rtl"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>{ar('كود الفرع (اختياري)', 'Branch Code (Optional)')}</Label>
                <Input
                  value={formCode}
                  onChange={e => setFormCode(e.target.value)}
                  placeholder="e.g. ma"
                />
                <p className="text-xs text-muted-foreground">
                  {ar('يستخدم في الاستيراد للتعرف على الفرع', 'Used in import to identify branch')}
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {ar('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ar('حفظ', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar('تأكيد الحذف', 'Confirm Deletion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar(
                `هل أنت متأكد من حذف فرع "${selectedBranch?.name_ar}"؟ سيتم إلغاء ربط جميع المتطوعين والبيانات التابعة له. لا يمكن التراجع عن هذا الإجراء.`,
                `Are you sure you want to delete the "${selectedBranch?.name}" branch? All associated volunteers and data will be unlinked. This action cannot be undone.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBranch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ar('حذف', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
