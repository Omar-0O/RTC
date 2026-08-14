import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Languages, Eye, EyeOff, Sun, Moon, Laptop } from 'lucide-react';
import { AUTH_RELOGIN_NOTICE_KEY, AUTH_STORAGE_KEY, purgeExpiredAuthToken, supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from 'next-themes';
import logo from '@/assets/logo.webp';
import { cn } from '@/lib/utils';

interface BranchRecord {
  id: string;
  name: string;
  name_ar: string;
  code?: string | null;
}

const normalizeBranchText = (str: string) => {
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
};

const findBranchByInput = (input: string, branches: BranchRecord[]) => {
  const normInput = normalizeBranchText(input);
  if (!normInput) return null;

  return branches.find(b => {
    const normName = normalizeBranchText(b.name || '');
    const normNameAr = normalizeBranchText(b.name_ar || '');
    const normCode = normalizeBranchText(b.code || '');

    if (normName === normInput || normNameAr === normInput || (normCode && normCode === normInput)) {
      return true;
    }

    if (normName && (normName.includes(normInput) || normInput.includes(normName))) {
      return true;
    }
    if (normNameAr && (normNameAr.includes(normInput) || normInput.includes(normNameAr))) {
      return true;
    }

    return false;
  });
};

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { setTheme } = useTheme();

  // On mount: purge any expired token so the SDK doesn't attempt a
  // refresh_token call before sign-in (which causes 429 rate-limit loops).
  // We use purgeExpiredAuthToken (checks expires_at) instead of a blanket
  // removeItem so that a still-valid session is preserved (e.g. accidental
  // navigation to /auth while already logged in).
  useEffect(() => {
    purgeExpiredAuthToken();
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(AUTH_RELOGIN_NOTICE_KEY) !== '1') return;

      sessionStorage.removeItem(AUTH_RELOGIN_NOTICE_KEY);
      toast({
        title: t('auth.sessionExpired'),
        description: t('auth.sessionExpiredDescription'),
        variant: 'destructive',
      });
    } catch {
      // Session notices are optional when browser storage is unavailable.
    }
  }, [t, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanInput = email.trim();

    try {
      // Check if user entered a branch name
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name, name_ar, code');

      if (branches && branches.length > 0) {
        const matchedBranch = findBranchByInput(cleanInput, branches as BranchRecord[]);
        if (matchedBranch) {
          localStorage.setItem('rtc_kiosk_branch_id', matchedBranch.id);
          localStorage.setItem('active_branch_id', matchedBranch.id);
          toast({
            title: isRTL ? 'تم الدخول بنجاح' : 'Access Granted',
            description: isRTL
              ? `تم التوجيه إلى صفحة تسجيل مشاركات الميداني لفرع ${matchedBranch.name_ar || matchedBranch.name}`
              : `Welcome to ${matchedBranch.name} Branch Field Logging`,
          });
          setIsLoading(false);
          // Small delay so React finishes flushing toast state before navigating
          setTimeout(() => navigate('/field-logging'), 50);
          return;
        }
      }

      // Standard email/password login
      if (!password) {
        toast({
          title: t('error'),
          description: isRTL ? 'يرجى إدخال كلمة المرور' : 'Please enter your password',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Clear any existing local session BEFORE signing in.
      // signOut({ scope: 'local' }) only wipes localStorage — no HTTP request is made.
      // This prevents the SDK from trying to refresh a stale/invalid refresh_token
      // that it finds in storage during the signInWithPassword flow, which causes 429.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore errors — we're clearing local state only
      }
      // Also purge any expired token from storage (belt-and-suspenders)
      purgeExpiredAuthToken();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanInput,
        password: password,
      });

      if (error) {
        const isRateLimited = error.status === 429 || error.message?.includes('429') || error.message?.toLowerCase().includes('too many requests');
        toast({
          title: t('error'),
          description: isRateLimited
            ? (isRTL
                ? 'تم تجاوز الحد المسموح به من محاولات الدخول. يرجى الانتظار دقيقة واحدة ثم المحاولة مجدداً.'
                : 'Too many login attempts. Please wait 1 minute before trying again.')
            : error.message,
          variant: 'destructive',
        });
      } else {
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        }

        const userRoles = roles?.map(r => r.role) || [];

        toast({
          title: t('welcomeBack'),
          description: t('loginSuccess'),
        });

        const isKioskUser =
          cleanInput.toLowerCase() === 'medaniparticipations@rtc.org' ||
          data.user?.email?.toLowerCase() === 'medaniparticipations@rtc.org';

        const destination = isKioskUser
          ? '/field-logging'
          : userRoles.includes('admin')
            ? '/admin'
            : userRoles.includes('supervisor')
              ? '/supervisor'
              : userRoles.includes('committee_leader')
                ? '/leader'
                : '/dashboard';

        navigate(destination);
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('loginError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img
            src={logo}
            alt="RTC Logo"
            className="h-48 w-auto mx-auto mb-1 object-contain"
          />
          <h1 className="text-lg font-bold">RTC</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t('signIn')}</CardTitle>
            <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {isRTL ? 'البريد الإلكتروني' : 'Email'}
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="ltr:pr-10 rtl:pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('signingIn') : t('signIn')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-4 right-4 flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/50 backdrop-blur-sm hover:bg-white/80 text-black hover:text-black shadow-sm border border-gray-100 dark:bg-black/50 dark:hover:bg-black/80 dark:text-white dark:hover:text-white dark:border-gray-800"
              title={t('theme.toggle')}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.light')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.dark')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Laptop className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.system')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-white/50 backdrop-blur-sm hover:bg-white/80 text-black hover:text-black shadow-sm border border-gray-100 dark:bg-black/50 dark:hover:bg-black/80 dark:text-white dark:hover:text-white dark:border-gray-800"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          title={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        >
          <Languages className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
