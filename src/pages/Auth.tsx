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
  const [showSetup, setShowSetup] = useState(false);
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupName, setSetupName] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('welcomeBack'),
          description: t('loginSuccess'),
        });
        navigate('/dashboard');
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

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: setupEmail,
        password: setupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: setupName,
          },
        },
      });

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      if (data.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'admin' })
          .eq('user_id', data.user.id);

        if (roleError) {
          console.error('Role update error:', roleError);
        }

        await supabase
          .from('profiles')
          .update({ full_name: setupName })
          .eq('id', data.user.id);

        toast({
          title: 'Success!',
          description: 'Admin account created. You can now login.',
        });
        
        setShowSetup(false);
        setEmail(setupEmail);
        setPassword(setupPassword);
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: 'Failed to create admin account',
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
            className="h-24 w-24 mx-auto rounded-xl mb-4 object-cover cursor-pointer"
            onDoubleClick={() => setShowSetup(!showSetup)}
          />
          <h1 className="text-2xl font-bold">RTC Mohandseen</h1>
          <p className="text-muted-foreground">{t('volunteerPortal')}</p>
        </div>

        {showSetup ? (
          <Card>
            <CardHeader>
              <CardTitle>Initial Admin Setup</CardTitle>
              <CardDescription>Create the first admin account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetupAdmin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="setup-name">Full Name</Label>
                  <Input
                    id="setup-name"
                    type="text"
                    placeholder="Admin Name"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-email">Email</Label>
                  <Input
                    id="setup-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-password">Password</Label>
                  <Input
                    id="setup-password"
                    type="password"
                    placeholder="••••••••"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Admin Account'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setShowSetup(false)}
                >
                  Back to Login
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
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
        )}
      </div>
    </div>
  );
}
