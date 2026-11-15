import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, HeartHandshake, ShieldAlert, Sparkles } from 'lucide-react';
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
        ? 'عدم تحقيق تارجت المشاركات الشهري المطلوب'
        : 'Monthly participation target was not met';
    case 'unpaid_fine':
      return isRTL
        ? 'وجود غرامة معلّقة غير مسددة'
        : 'Unpaid fine on account';
    case 'target_and_fine':
      return isRTL
        ? 'عدم تحقيق تارجت المشاركات الشهري ووجود غرامة غير مسددة'
        : 'Monthly target not met and unpaid fine on account';
    case 'manual':
      return isRTL
        ? 'قرار إداري لحين مراجعة الموارد البشرية (HR)'
        : 'Administrative decision pending HR review';
    default:
      return isRTL
        ? 'عدم تحقيق تارجت المشاركات المطلوب أو وجود غرامة غير مسددة'
        : 'Participation target not met or unpaid fine';
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
  const displayName = volunteerName?.trim() || (isRTL ? 'بطل RTC' : 'RTC Volunteer');

  return (
    <>
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-background p-5 sm:p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  {isRTL ? `أهلاً بك يا ${displayName} 🌱` : `Welcome, ${displayName} 🌱`}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:text-red-400 border border-red-500/20">
                  <AlertTriangle className="h-3 w-3" />
                  {isRTL ? 'مرفود مؤقتاً' : 'Temporarily Dismissed'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                {isRTL
                  ? 'حسابك حالياً في حالة رفد مؤقت من النشاط لحين إجراء مقابلة المتابعة (التحقيق) مع فريق الـ HR وإعادتك بكامل صلاحياتك. يمكنك خلال هذه الفترة تسجيل مشاركاتك الجديدة فقط لإثبات التزامك.'
                  : 'Your account is currently temporarily dismissed pending an HR follow-up interview to reinstate your full access. During this time, you can still log your new participations.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 border border-amber-500/20">
                  {isRTL ? `السبب المسجّل: ${reasonText}` : `Reason: ${reasonText}`}
                </span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="shrink-0 border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            {isRTL ? 'تفاصيل الرسالة والخطوة القادمة' : 'View Full Notice'}
          </Button>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="sm:max-w-lg rounded-2xl border-amber-500/30 p-0 overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-background p-6 border-b border-border/50">
            <DialogHeader className="text-start space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-bold">
                    {isRTL ? 'تنبيه هام بخصوص حالة عضويتك في النشاط' : 'Important Membership Status Notice'}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-300">
                    {isRTL ? 'إيقاف مؤقت (رفد) لحين مراجعة فريق الموارد البشرية (HR)' : 'Temporary Dismissal Pending HR Review'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4 text-sm leading-relaxed">
            <p className="font-medium text-foreground">
              {isRTL
                ? `أهلاً بك يا ${displayName} في عائلة RTC 🤍`
                : `Hello ${displayName}, welcome to the RTC family 🤍`}
            </p>

            <div className="rounded-xl bg-muted/40 border p-3.5 space-y-1.5">
              <p className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {isRTL ? 'لماذا ظهر لي هذا التنبيه؟' : 'Why am I seeing this notice?'}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {isRTL
                  ? `تم تحويل حالة حسابك إلى (مرفود مؤقتاً) بسبب: ${reasonText}.`
                  : `Your account status was set to Temporarily Dismissed due to: ${reasonText}.`}
              </p>
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 space-y-1.5">
              <p className="font-semibold text-primary flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 shrink-0" />
                {isRTL ? 'ما هي الخطوة القادمة لعودتك؟' : 'What is the next step?'}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {isRTL
                  ? 'لأنك فرد غالٍ ومؤثر في فريقنا، سيقوم فريق الموارد البشرية (HR) بالتواصل معك لإجراء تحقيق بسيط (مقابلة متابعة) للاطمئنان عليك ومعرفة أسباب غيابك أو تقصيرك، تمهيداً لإعادة تفعيل حسابك بالكامل.'
                  : 'Because you are a valued member of our team, our HR team will contact you for a brief follow-up inquiry to understand your situation and reinstate your full account.'}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 space-y-1.5">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {isRTL ? 'ماذا يمكنك فعله الآن؟' : 'What can you do right now?'}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {isRTL
                  ? 'حسابك مفتوح حالياً لتسجيل مشاركاتك الجديدة فقط؛ استمرارك في النزول وتسجيل مشاركاتك خلال هذه الفترة يُثبت التزامك وجديتك ويسرّع من إعادتك فوراً بعد مقابلة الـ HR!'
                  : 'Your account is currently open exclusively for logging new participations. Continuing to participate and log your activities demonstrates your commitment and speeds up your reinstatement!'}
              </p>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 border-t">
            <Button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              {isRTL ? 'فهمت، المتابعة لتسجيل مشاركة' : 'Understood, Continue to Log Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
