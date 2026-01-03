import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import logo from '@/assets/logo.jpg';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Clean input
    const cleanEmail = email.trim();
    console.log('Attempting login with:', cleanEmail);

    try {
      const { error } = await supabase.auth.signInWithPassword({
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img
            src={logo}
            alt="RTC Mohandseen Logo"
            className="h-24 w-24 mx-auto rounded-xl mb-4 object-cover"
          />
          <h1 className="text-2xl font-bold">RTC Mohandseen</h1>
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
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('signingIn') : t('signIn')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
