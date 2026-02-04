import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredUsers = users.filter(user =>
    (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.full_name_ar?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {language === 'ar' ? 'أعياد ميلاد هذا الشهر' : 'Birthdays of the Month'}
            <span className="text-primary ltr:ml-2 rtl:mr-2">({getMonthName()})</span>
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
            <Input
              placeholder={language === 'ar' ? 'بحث عن متطوع...' : 'Search volunteers...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ltr:pl-9 rtl:pr-9 max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{language === 'ar' ? 'يوم الميلاد' : 'Birthday'}</TableHead>
                <TableHead className="text-start">{t('users.fullName')}</TableHead>
                <TableHead className="text-start">{t('users.committee')}</TableHead>
                <TableHead className="text-start">{t('users.level')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {language === 'ar' ? 'لا توجد أعياد ميلاد هذا الشهر' : 'No birthdays this month'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center justify-center bg-primary/10 text-primary font-bold rounded-full h-10 w-10">
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
        </CardContent>
      </Card>
    </div>
  );
}
