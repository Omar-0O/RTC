import { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, HelpCircle, PhoneCall, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DismissalNoticeBannerProps {
  isRTL: boolean;
  volunteerName?: string | null;
  dismissalReason?: string | null;
}

function getReasonLabel(reason: string | null | undefined, isRTL: boolean): string {
  switch (reason) {
    case 'target_not_met':
      return isRTL
        ? 'عدم استيفاء الحد الأدنى للمشاركات الشهرية المقررة'
        : 'Failure to meet the required monthly participation target';
    case 'unpaid_fine':
      return isRTL
        ? 'وجود غرامة مالية مستحقة غير مسددة على الحساب'
        : 'Outstanding unpaid fine on the account';
    case 'target_and_fine':
      return isRTL
        ? 'عدم استيفاء الحد الأدنى للمشاركات الشهرية ووجود غرامة مالية غير مسددة'
        : 'Failure to meet the monthly participation target and an outstanding unpaid fine';
    case 'manual':
      return isRTL
        ? 'قرار إداري لحين مراجعة إدارة الموارد البشرية (HR)'
        : 'Administrative decision pending Human Resources (HR) review';
    default:
      return isRTL
        ? 'عدم استيفاء الحد الأدنى للمشاركات الشهرية أو وجود غرامة مالية غير مسددة'
        : 'Failure to meet the participation target or an outstanding unpaid fine';
  }
}

export function DismissalNoticeBanner({
  isRTL,
  volunteerName,
  dismissalReason,
}: DismissalNoticeBannerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('rtc_dismissed_welcome_modal') === '1') {
        sessionStorage.removeItem('rtc_dismissed_welcome_modal');
        setIsModalOpen(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const reasonText = getReasonLabel(dismissalReason, isRTL);
  const trimmedName = volunteerName?.trim();
  const displayName = trimmedName || (isRTL ? 'المتطوع' : 'Volunteer');

  return (
    <>
      {/* Clean, Modern & Professional Banner */}
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="relative overflow-hidden rounded-xl border border-destructive/20 bg-card p-4 sm:p-5 shadow-sm transition-all"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/15">
              <AlertCircle className="h-5 w-5" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground tracking-tight">
                  {isRTL
                    ? trimmedName
                      ? `إشعار إداري — ${displayName}`
                      : 'إشعار إداري بشأن حالة العضوية'
                    : trimmedName
                      ? `Administrative Notice — ${displayName}`
                      : 'Administrative Membership Notice'}
                </h2>
                <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive border border-destructive/20">
                  {isRTL ? 'مرفود مؤقتاً' : 'Temporarily Dismissed'}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {isRTL
                  ? 'نحيطكم علماً بأن حسابكم في حالة إيقاف مؤقت (رفد مؤقت) لحين استكمال إجراءات المراجعة مع إدارة الموارد البشرية (HR). يقتصر استخدام الحساب حالياً على تسجيل المشاركات الجديدة فقط.'
                  : 'Please be advised that your account is temporarily dismissed pending a formal review by Human Resources (HR). Account access is currently restricted to logging new participations.'}
              </p>

              <div className="pt-0.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-md border">
                  {isRTL ? `سبب القرار: ${reasonText}` : `Reason: ${reasonText}`}
                </span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 text-xs font-medium gap-1.5 border-border/80 hover:bg-muted/60 self-end sm:self-center"
          >
            <span>{isRTL ? 'تفاصيل القرار والإجراءات المطلوبة' : 'View Official Notice'}</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </div>
      </div>

      {/* Structured, Clean Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="sm:max-w-lg rounded-2xl border p-0 overflow-hidden shadow-xl"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="p-6 border-b bg-muted/30">
            <DialogHeader className="text-start space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                    {isRTL ? 'إشعار رسمي بشأن حالة العضوية' : 'Official Membership Status Notice'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {isRTL
                      ? 'قرار إيقاف مؤقت (رفد مؤقت) لحين مراجعة إدارة الموارد البشرية (HR)'
                      : 'Temporary Dismissal Pending Human Resources Review'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-3.5 text-sm">
            <p className="text-sm font-medium text-foreground">
              {isRTL
                ? trimmedName
                  ? `السيد المتطوع / ${displayName}، نحيطكم علماً بالآتي:`
                  : 'عزيزي المتطوع، نحيطكم علماً بالآتي:'
                : `Dear ${displayName}, please be advised of the following:`}
            </p>

            {/* Point 1: Reason */}
            <div className="rounded-xl border bg-card p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>
                  {isRTL ? 'أولاً: سبب قرار الإيقاف المؤقت (الرفد)' : '1. Reason for Temporary Dismissal'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pr-6">
                {isRTL
                  ? `تقرر تحويل حالة حسابكم إلى (مرفود مؤقتاً)؛ وذلك نظراً لـ: ${reasonText}.`
                  : `Your account status has been set to Temporarily Dismissed due to: ${reasonText}.`}
              </p>
            </div>

            {/* Point 2: Next Step */}
            <div className="rounded-xl border bg-card p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <PhoneCall className="h-4 w-4 shrink-0" />
                <span>
                  {isRTL
                    ? 'ثانياً: إجراءات المراجعة مع إدارة الموارد البشرية (HR)'
                    : '2. Human Resources Review Process'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pr-6">
                {isRTL
                  ? 'سيتواصل معكم ممثل إدارة الموارد البشرية (HR) لتحديد موعد مقابلة متابعة رسمية؛ وذلك للوقوف على أسباب عدم استيفاء المتطلبات المقررة والنظر في إعادة تفعيل الحساب بكامل صلاحياته.'
                  : 'A Human Resources (HR) representative will contact you to schedule a formal follow-up review to address the requirements and evaluate full account reinstatement.'}
              </p>
            </div>

            {/* Point 3: What to do now */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span>
                  {isRTL
                    ? 'ثالثاً: ضوابط استخدام الحساب خلال فترة الإيقاف'
                    : '3. Account Access During Temporary Dismissal'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pr-6">
                {isRTL
                  ? 'يقتصر استخدام الحساب حالياً على تسجيل المشاركات الجديدة فقط. يُرجى الاستمرار في الالتزام بحضور الأنشطة وتوثيق المشاركات عبر المنصة، حيث يُؤخذ ذلك بعين الاعتبار عند تقييم إعادة تفعيل العضوية.'
                  : 'Account access is currently restricted to logging new participations. Continued attendance and activity documentation will be taken into consideration during your reinstatement review.'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-3.5 bg-muted/20 border-t flex sm:justify-end">
            <Button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="w-full sm:w-auto text-xs h-9 px-4"
            >
              {isRTL
                ? 'أقر بالاطلاع والمتابعة لتسجيل المشاركات'
                : 'Acknowledge & Continue to Log Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
