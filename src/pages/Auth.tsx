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
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from 'next-themes';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { setTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Clean input
    const cleanEmail = email.trim();
    console.log('Attempting login with:', cleanEmail);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive',
        });
      } else {
        // Check user role for redirection
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        }

        const userRoles = roles?.map(r => r.role) || [];

        console.log('Login successful. User ID:', data.user.id);
        console.log('Fetched roles:', roles);
        console.log('User roles array:', userRoles);

        toast({
          title: t('welcomeBack'),
          description: t('loginSuccess'),
        });

        if (userRoles.includes('admin')) {
          console.log('Redirecting to /admin');
          navigate('/admin');
        } else if (userRoles.includes('supervisor')) {
          console.log('Redirecting to /supervisor');
          navigate('/supervisor');
        } else if (userRoles.includes('committee_leader')) {
          console.log('Redirecting to /leader');
          navigate('/leader');
        } else {
          console.log('Redirecting to /dashboard');
          navigate('/dashboard');
        }
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
            alt="RTC Mohandseen Logo"
            className="h-48 w-auto mx-auto mb-1 object-contain"
          />
          <h1 className="text-lg font-bold">RTC Mohandseen</h1>
          <p className="text-muted-foreground">{t('volunteerPortal')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('signIn')}</CardTitle>
            <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
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
                    required
                    minLength={6}
                    className="ltr:pr-10 rtl:pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
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
