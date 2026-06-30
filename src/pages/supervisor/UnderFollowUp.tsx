import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranch } from '@/contexts/BranchContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Users,
  Search,
  ClipboardList,
  ExternalLink,
  Loader2,
  Phone,
  Building2,
  UserCheck,
  Copy,
  StopCircle,
  MessageCircle,
  Star,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { waPhoneLink } from '@/utils/phoneUtils';


interface Volunteer {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  avatar_url: string | null;
  phone: string | null;
  committee_name: string | null;
  current_month_count: number;
}

// Random pleasant gradient backgrounds for avatar fallbacks
const avatarGradients = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-600',
];

const getGradient = (id: string) => {
  const idx = id.charCodeAt(0) % avatarGradients.length;
  return avatarGradients[idx];
};

export default function UnderFollowUp() {
  const { isRTL } = useLanguage();
  const { activeBranch } = useBranch();
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchVolunteers();
  }, [activeBranch?.id]);

  const fetchVolunteers = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      let query = (supabase as any)
        .from('profiles')
        .select('id, full_name, full_name_ar, avatar_url, phone, committee_id')
        .eq('level', 'under_follow_up')
        .neq('full_name', 'RTC Admin');

      if (activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data: profiles, error } = await query.order('full_name');

      if (error) throw error;

      const profileIds = (profiles || []).map(p => p.id);

      const committeeIds = [...new Set((profiles || []).map(p => p.committee_id).filter(Boolean))];
      let committeesMap: Record<string, string> = {};

      if (committeeIds.length > 0) {
        const { data: committees } = await supabase
          .from('committees')
          .select('id, name, name_ar')
          .in('id', committeeIds as string[]);
        committeesMap = Object.fromEntries(
          (committees || []).map(c => [c.id, isRTL ? c.name_ar : c.name])
        );
      }

      let submissionCounts = new Map<string, number>();
      if (profileIds.length > 0) {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data: monthSubmissions } = await supabase
          .from('activity_submissions')
          .select('volunteer_id')
          .in('volunteer_id', profileIds)
          .gte('submitted_at', startOfMonth);
        
        (monthSubmissions || []).forEach(sub => {
          submissionCounts.set(sub.volunteer_id, (submissionCounts.get(sub.volunteer_id) || 0) + 1);
        });
      }

      setVolunteers(
        (profiles || []).map(p => ({
          id: p.id,
          full_name: p.full_name,
          full_name_ar: p.full_name_ar,
          avatar_url: p.avatar_url,
          phone: p.phone,
          committee_name: p.committee_id ? committeesMap[p.committee_id] || null : null,
          current_month_count: submissionCounts.get(p.id) || 0,
        }))
      );
    } catch {
      toast.error(isRTL ? 'فشل تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getPortalLink = (id: string) => `${window.location.origin}/volunteer-portal/${id}`;

  const copyPortalLink = async (volunteer: Volunteer) => {
    const link = getPortalLink(volunteer.id);
    await navigator.clipboard.writeText(link);
    setCopiedId(volunteer.id);
    const name = (isRTL ? volunteer.full_name_ar : volunteer.full_name) || volunteer.full_name || '';
    toast.success(isRTL ? `✅ تم نسخ لينك ${name}` : `✅ Copied link for ${name}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDisplayName = (v: Volunteer) =>
    (isRTL ? v.full_name_ar || v.full_name : v.full_name) || '—';

  const filtered = volunteers.filter(v => {
    const q = search.toLowerCase();
    return (
      (v.full_name || '').toLowerCase().includes(q) ||
      (v.full_name_ar || '').toLowerCase().includes(q) ||
      (v.phone || '').includes(q) ||
      (v.committee_name || '').toLowerCase().includes(q)
    );
  });

  /* ── Loading skeleton ──────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="h-32 rounded-2xl bg-muted/50" />
        <div className="h-11 rounded-xl bg-muted/50" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 rounded-2xl bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-6 md:p-8 shadow-sm">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-amber-500/10 dark:bg-amber-400/5 blur-2xl" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex items-center gap-4 flex-1">
            {/* Icon */}
            <div className="relative shrink-0">
              <div className="h-16 w-16 rounded-2xl bg-amber-500 dark:bg-gradient-to-br dark:from-amber-400 dark:to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/10 dark:shadow-amber-500/20 border border-white/10">
                <UserCheck className="h-8 w-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5.5 w-5.5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center shadow-sm">
                <span className="text-white text-[10px] font-bold">{volunteers.length}</span>
              </div>
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-amber-950 dark:text-amber-50">
                {isRTL ? 'تحت المتابعة' : 'Under Follow-Up'}
              </h1>
              <p className="text-sm text-amber-800/80 dark:text-amber-400/70 mt-1 font-medium">
                {isRTL
                  ? `${volunteers.length} متطوع في مرحلة المتابعة`
                  : `${volunteers.length} volunteers in follow-up stage`}
              </p>
            </div>
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchVolunteers(true)}
            disabled={refreshing}
            className="gap-2 bg-background/50 dark:bg-amber-500/5 text-amber-900 dark:text-amber-400 border-amber-200 dark:border-amber-900/30 hover:bg-amber-100/50 dark:hover:bg-amber-500/10 hover:text-amber-950 dark:hover:text-amber-300 self-start sm:self-auto transition-all shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {isRTL ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative group">
        <Search className="pointer-events-none absolute z-10 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 transition-colors group-focus-within:text-amber-600 dark:group-focus-within:text-amber-400 ltr:left-4 rtl:right-4" />
        <Input
          placeholder={isRTL ? 'ابحث بالاسم أو اللجنة أو الهاتف...' : 'Search by name, committee or phone...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-12 ltr:pl-11 rtl:pr-11 border-2 focus:border-amber-500/50 dark:focus:border-amber-500/30 bg-card/70 backdrop-blur-sm text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute z-10 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors ltr:right-3 rtl:left-3"
          >
            <span className="text-xs text-muted-foreground">✕</span>
          </button>
        )}
      </div>

      {/* ── Result count ── */}
      {search && (
        <p className="text-sm text-muted-foreground -mt-1 ltr:pl-1 rtl:pr-1">
          {isRTL
            ? `${filtered.length} نتيجة من أصل ${volunteers.length}`
            : `${filtered.length} of ${volunteers.length} results`}
        </p>
      )}

      {/* ── Empty State ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Users className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-muted-foreground">
              {isRTL ? 'لا يوجد متطوعون' : 'No volunteers found'}
            </p>
            {search && (
              <p className="text-sm text-muted-foreground/60 mt-1">
                {isRTL ? 'جرب بحثًا مختلفًا' : 'Try a different search'}
              </p>
            )}
          </div>
          {search && (
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              {isRTL ? 'مسح البحث' : 'Clear search'}
            </Button>
          )}
        </div>
      ) : (
        /* ── Cards Grid ── */
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(volunteer => {
            const name = getDisplayName(volunteer);
            const isCopied = copiedId === volunteer.id;
            const gradient = getGradient(volunteer.id);

            return (
              <div
                key={volunteer.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm hover:shadow-xl hover:border-primary/25 hover:-translate-y-0.5 transition-all duration-300"
              >
                {/* Top accent line */}
                <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 flex-shrink-0" />

                <div className="p-5 flex flex-col gap-4 flex-1">
                  {/* ── Top Row: Avatar + Info ── */}
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="h-13 w-13" style={{ height: 52, width: 52 }}>
                        <AvatarImage src={volunteer.avatar_url || undefined} />
                        <AvatarFallback
                          className={`bg-gradient-to-br ${gradient} text-white font-bold text-lg`}
                        >
                          {name.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[15px] leading-tight truncate">{name}</p>
                      {volunteer.phone && (
                        <a
                          href={`tel:${volunteer.phone}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5 transition-colors"
                          dir="ltr"
                        >
                          <Phone className="h-3 w-3" />
                          {volunteer.phone}
                        </a>
                      )}
                    </div>

                    {/* Points pill -> Participations count pill */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
                        <ClipboardList className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold text-primary">
                          {volunteer.current_month_count} {isRTL ? 'مشاركة' : 'participations'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Committee badge ── */}
                  {volunteer.committee_name && (
                    <div className="flex">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/8 hover:bg-primary/12 text-primary text-xs font-medium border border-primary/15 transition-colors">
                        <Building2 className="h-3 w-3" />
                        {volunteer.committee_name}
                      </span>
                    </div>
                  )}

                  {/* ── Spacer ── */}
                  <div className="flex-1" />

                  {/* ── Actions ── */}
                  <div className="flex gap-2 pt-1 border-t border-border/50">
                    {/* Log Participation — primary CTA */}
                    <Button
                      size="sm"
                      className="flex-1 h-9 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 shadow-sm group/btn"
                      onClick={() => navigate(`/supervisor/log-for/${volunteer.id}`)}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      {isRTL ? 'تسجيل مشاركة' : 'Log Participation'}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 -mr-1 transition-opacity ltr:block rtl:hidden" />
                    </Button>

                    {/* Copy link */}
                    <Button
                      variant="outline"
                      size="icon"
                      className={`h-9 w-9 shrink-0 transition-all ${
                        isCopied
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-600'
                          : 'hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-400 hover:text-amber-600'
                      }`}
                      onClick={() => copyPortalLink(volunteer)}
                      title={isRTL ? 'نسخ اللينك الشخصي' : 'Copy personal link'}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>

                    {/* Open portal */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-400 hover:text-blue-600 transition-colors"
                      onClick={() => window.open(getPortalLink(volunteer.id), '_blank')}
                      title={isRTL ? 'فتح صفحة المتطوع' : 'Open volunteer platform'}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>

                    {/* WhatsApp */}
                    {volunteer.phone && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-500 hover:text-green-600 transition-colors"
                        onClick={() => {
                           const url = waPhoneLink(volunteer.phone);
                           if (url) window.open(url, '_blank');
                        }}
                        title={isRTL ? 'واتساب' : 'WhatsApp'}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
