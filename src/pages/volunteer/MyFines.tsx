import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Calendar, UserCheck, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';

type FineRecord = {
  source_type: string;
  source_id: string;
  source_name: string;
  source_name_ar: string;
  created_at: string;
  amount: number;
  is_paid: boolean;
  reviewed_by_name: string | null;
  reviewed_by_name_ar: string | null;
};

export default function MyFines() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [fines, setFines] = useState<FineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFines = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('volunteer_fines_view')
        .select('source_type, source_id, source_name, source_name_ar, created_at, amount, is_paid, reviewed_by_name, reviewed_by_name_ar')
        .eq('volunteer_id', user.id)
        .eq('source_type', 'manual')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFines(data || []);
    } catch (error) {
      console.error('Error fetching volunteer fines:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  const activeFines = fines.filter((f) => !f.is_paid);
  const paidFines = fines.filter((f) => f.is_paid);
  const totalActiveAmount = activeFines.reduce((sum, f) => sum + (f.amount || 0), 0);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getSourceTypeLabel = (_type: string) => {
    return isRTL ? 'غرامة' : 'Fine';
  };

  const getAssigneeName = (fine: FineRecord) => {
    const name = isRTL
      ? (fine.reviewed_by_name_ar || fine.reviewed_by_name)
      : (fine.reviewed_by_name || fine.reviewed_by_name_ar);

    return name || (isRTL ? 'مسئول المتابعة' : 'Admin');
  };

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Coins className="h-7 w-7 text-amber-500" />
            {isRTL ? 'غراماتك' : 'Your Fines'}
          </h1>
        </div>
      </div>

      {/* Main Fines List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{isRTL ? 'قائمة الغرامات' : 'Fines List'}</span>
            <Badge variant="outline" className="font-mono">
              {fines.length} {isRTL ? 'إجمالي' : 'Total'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : fines.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold">{isRTL ? 'ممتاز! ليس عليك أي غرامات' : 'Great! You have no fines.'}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {isRTL ? 'سجلك نظيف خالي من أي غرامات مسجلة. واصل التزامك الرائع!' : 'Your record is clear with zero registered fines. Keep up the great work!'}
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/dashboard">{isRTL ? 'العودة للرئيسية' : 'Return to Home'}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {fines.map((fine, index) => {
                const isPaid = fine.is_paid;
                const assignee = getAssigneeName(fine);

                return (
                  <div
                    key={`${fine.source_id}-${index}`}
                    className={`rounded-xl border p-4 transition-all duration-200 ${
                      isPaid
                        ? 'bg-muted/20 border-border opacity-80'
                        : 'bg-card border-rose-500/30 hover:border-rose-500/50 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-base text-foreground">
                            {isRTL ? (fine.source_name_ar || fine.source_name) : (fine.source_name || fine.source_name_ar)}
                          </h4>
                          <Badge variant={isPaid ? 'secondary' : 'destructive'} className="text-[11px] font-semibold">
                            {isPaid ? (isRTL ? 'تم السداد' : 'Paid') : (isRTL ? 'غير مدفوعة' : 'Unpaid')}
                          </Badge>
                          <Badge variant="outline" className="text-[11px] text-muted-foreground">
                            {getSourceTypeLabel(fine.source_type)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1.5 text-foreground/90 font-medium">
                            <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{isRTL ? 'بواسطة:' : 'Assigned by:'}</span>
                            <span className="font-semibold">{assignee}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>{formatDate(fine.created_at)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 shrink-0">
                        <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
                          {fine.amount} <span className="text-xs font-medium text-muted-foreground">{isRTL ? 'ج.م' : 'EGP'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
