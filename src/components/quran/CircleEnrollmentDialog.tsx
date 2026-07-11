import { Plus, UserPlus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Beneficiary, QuranCircle } from '@/services/circles.service';

interface CircleEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circle: QuranCircle | null;
  circleName: string;
  beneficiaries: Beneficiary[];
  enrolledBeneficiaryIds: Set<string>;
  enrolledCount: number;
  loading: boolean;
  search: string;
  isRTL: boolean;
  onSearchChange: (value: string) => void;
  onEnroll: (beneficiaryId: string) => void;
  onUnenroll: (beneficiaryId: string) => void;
}

export function CircleEnrollmentDialog({
  open,
  onOpenChange,
  circle,
  circleName,
  beneficiaries,
  enrolledBeneficiaryIds,
  enrolledCount,
  loading,
  search,
  isRTL,
  onSearchChange,
  onEnroll,
  onUnenroll,
}: CircleEnrollmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {isRTL ? 'إدارة المسجلين في الحلقة' : 'Manage Circle Enrollments'}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? 'إضافة المستفيدين أو إزالة تسجيلهم من الحلقة' : 'Add or remove circle beneficiary enrollments'}
          </DialogDescription>
          {circle && <p className="text-sm text-muted-foreground">{circleName}</p>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span>{isRTL ? 'عدد المسجلين:' : 'Enrolled Students:'}</span>
            <Badge className="text-lg px-3">{enrolledCount}</Badge>
          </div>

          <Input
            placeholder={isRTL ? 'بحث عن مستفيد...' : 'Search beneficiaries...'}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />

          <ScrollArea className="h-[400px] border rounded-md p-2">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-1">
                {beneficiaries.map((beneficiary) => {
                  const isEnrolled = enrolledBeneficiaryIds.has(beneficiary.id);
                  return (
                    <div
                      key={beneficiary.id}
                      className={`flex items-center justify-between p-2 rounded-md ${isEnrolled
                        ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                        : 'hover:bg-muted'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={beneficiary.image_url || undefined} />
                          <AvatarFallback>{beneficiary.name_ar.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{beneficiary.name_ar}</span>
                      </div>
                      {isEnrolled ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUnenroll(beneficiary.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                          {isRTL ? 'إلغاء' : 'Remove'}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => onEnroll(beneficiary.id)} className="text-primary">
                          <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                          {isRTL ? 'تسجيل' : 'Enroll'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRTL ? 'إغلاق' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
