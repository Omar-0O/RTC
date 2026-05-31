import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { Loader2, Cake } from 'lucide-react';

interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

interface UserWithDetails {
  id: string;
  email: string;
  full_name: string | null;
  full_name_ar?: string | null;
  avatar_url: string | null;
  committee_id: string | null;
  committee_name?: string;
  level: string;
  birth_date?: string | null;
  role?: string;
}

export default function Birthdays() {
  const { t, language, isRTL } = useLanguage();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch committees
        const { data: committeesData } = await supabase
          .from('committees')
          .select('id, name, name_ar');

        // Fetch users
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .not('birth_date', 'is', null);

        if (profilesData) {
          const committeesMap = new Map(
            committeesData?.map(c => [c.id, language === 'ar' ? c.name_ar : c.name]) || []
          );

          const currentMonth = new Date().getMonth();

          const birthdayUsers = profilesData
            .filter(user => {
              if (!user.birth_date) return false;
              const birthDate = new Date(user.birth_date);
              return birthDate.getMonth() === currentMonth;
            })
            .map(profile => ({
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              full_name_ar: profile.full_name_ar,
              avatar_url: profile.avatar_url,
              committee_id: profile.committee_id,
              committee_name: profile.committee_id ? committeesMap.get(profile.committee_id) : undefined,
              level: profile.level || 'under_follow_up',
              birth_date: profile.birth_date,
              role: profile.role
            }))
            .sort((a, b) => {
              const dayA = new Date(a.birth_date!).getDate();
              const dayB = new Date(b.birth_date!).getDate();
              return dayA - dayB;
            });

          setUsers(birthdayUsers);
        }
      } catch (error) {
        console.error('Error fetching birthdays:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [language]);

  const getDayOfMonth = (dateString?: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.getDate();
  };

  const getMonthName = () => {
    const date = new Date();
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }).format(date);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cake className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            <span>
              {language === 'ar' ? 'أيام ميلاد هذا الشهر' : 'Birthdays of the Month'}
            </span>
            <span className="text-primary ltr:ml-2 rtl:mr-2">({getMonthName()})</span>
          </h1>
        </div>
      </div>

      {/* Desktop Table View */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className={`whitespace-nowrap font-semibold ${isRTL ? "text-right" : "text-left"}`}>{language === 'ar' ? 'يوم الميلاد' : 'Birthday'}</TableHead>
                  <TableHead className={`whitespace-nowrap font-semibold ${isRTL ? "text-right" : "text-left"}`}>{t('users.fullName')}</TableHead>
                  <TableHead className={`whitespace-nowrap font-semibold ${isRTL ? "text-right" : "text-left"}`}>{t('users.committee')}</TableHead>
                  <TableHead className={`whitespace-nowrap font-semibold ${isRTL ? "text-right" : "text-left"}`}>{t('users.level')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {language === 'ar' ? 'لا توجد أيام ميلاد هذا الشهر' : 'No birthdays this month'}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center justify-center bg-primary/10 text-primary border border-primary/20 font-bold rounded-full h-10 w-10">
                          {getDayOfMonth(user.birth_date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                            <AvatarFallback>
                              {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name || 'No name'}</p>
                            {user.full_name_ar && (
                              <p className="text-sm text-muted-foreground">{user.full_name_ar}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{user.committee_name || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <LevelBadge level={user.level} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="block sm:hidden space-y-4">
        {users.length === 0 ? (
          <div className="border rounded-xl bg-card p-8 text-center text-muted-foreground">
            {language === 'ar' ? 'لا توجد أيام ميلاد هذا الشهر' : 'No birthdays this month'}
          </div>
        ) : (
          <div className="grid gap-4">
            {users.map((user) => (
              <div key={user.id} className="border rounded-xl bg-card p-4 shadow-sm space-y-3 transition-all duration-200 hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                        {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{user.full_name || 'No name'}</p>
                      {user.full_name_ar && (
                        <p className="text-xs text-muted-foreground font-arabic truncate">{user.full_name_ar}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded-lg py-1 px-2.5 min-w-[50px] shrink-0">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">{language === 'ar' ? 'يوم' : 'Day'}</span>
                    <span className="text-base font-bold leading-none mt-0.5">{getDayOfMonth(user.birth_date)}</span>
                  </div>
                </div>
                
                <div className="border-t pt-3 grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">{t('users.committee')}</span>
                    <span className="font-medium truncate block">{user.committee_name || '—'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">{t('users.level')}</span>
                    <div className="inline-block">
                      <LevelBadge level={user.level} size="sm" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
