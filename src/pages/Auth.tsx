import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Languages, Eye, EyeOff, Sun, Moon, Laptop } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { setTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanInput = email.trim();

    localStorage.setItem('rememberMe', String(rememberMe));

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
            title: isRTL ? 'تم الدخول بنجاح' : 'Kiosk Access Granted',
            description: isRTL
              ? `تم التوجيه إلى كشك فرع ${matchedBranch.name_ar || matchedBranch.name}`
              : `Welcome to ${matchedBranch.name} Branch Kiosk`,
          });
          navigate('/kiosk');
          setIsLoading(false);
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanInput,
        password: password,
      });

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
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

        const destination = userRoles.includes('admin')
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
                  {isRTL ? 'البريد الإلكتروني أو اسم الفرع' : 'Email or Branch Name'}
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder={isRTL ? 'مثال: المهندسين أو user@example.com' : 'e.g. Mohandseen or user@example.com'}
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
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-4">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t('auth.rememberMe')}
                </Label>
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
