import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export interface UserFeatureOption {
  id: string;
  label: string;
  labelEn: string;
}

interface UserFeaturesDialogProps {
  open: boolean;
  isRTL: boolean;
  userName: string;
  features: UserFeatureOption[];
  defaultFeatures: string[];
  selectedFeatures: string[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectedFeaturesChange: (features: string[]) => void;
  onSave: () => void;
}

export function UserFeaturesDialog({
  open, isRTL, userName, features, defaultFeatures, selectedFeatures, saving,
  onOpenChange, onSelectedFeaturesChange, onSave,
}: UserFeaturesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="px-4 sm:px-6 py-5 border-b border-border/50 shrink-0 bg-muted/30 flex flex-col items-center text-center"><DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2"><Settings className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />{isRTL ? 'تخصيص المميزات والخصائص' : 'Customize Features'}</DialogTitle><DialogDescription className="text-sm text-muted-foreground mt-1">{isRTL ? `تعديل المميزات المتاحة لـ ${userName}` : `Modify available features for ${userName}`}</DialogDescription></DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-4"><div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50 rounded-xl p-4 text-xs text-yellow-800 dark:text-yellow-400"><p className="font-semibold mb-1">{isRTL ? 'ملاحظة حول الصلاحيات:' : 'Permissions Note:'}</p><p>{isRTL ? 'المميزات الأساسية للدور تتفعل تلقائياً ولا يمكن إيقافها من هنا.' : 'Role default features are active automatically and cannot be disabled here.'}</p></div><div className="grid gap-3 pt-2">{features.map((feature) => { const isDefault = defaultFeatures.includes(feature.id); const isChecked = isDefault || selectedFeatures.includes(feature.id); return <div key={feature.id} className="flex items-start justify-between rounded-xl border border-border/50 p-4 transition-all hover:bg-muted/20"><div className="space-y-1 ltr:pr-4 rtl:pl-4"><Label htmlFor={`feat-${feature.id}`} className="font-semibold text-sm cursor-pointer select-none">{isRTL ? feature.label : feature.labelEn}</Label>{isDefault && <p className="text-[10px] text-primary font-medium">{isRTL ? '(أساسي للدور)' : '(Role default)'}</p>}</div><Switch id={`feat-${feature.id}`} disabled={isDefault || saving} checked={isChecked} onCheckedChange={(checked) => onSelectedFeaturesChange(checked ? [...selectedFeatures, feature.id] : selectedFeatures.filter((id) => id !== feature.id))} /></div>; })}</div></div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t border-border/50 bg-muted/10 shrink-0"><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)} className="w-full sm:w-auto h-11 px-6 text-sm font-medium">{isRTL ? 'إلغاء' : 'Cancel'}</Button><Button type="button" disabled={saving} onClick={onSave} className="w-full sm:w-auto h-11 px-6 text-sm font-semibold shadow-sm">{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
