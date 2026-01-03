import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { Trophy, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type LeaderboardEntry = {
  volunteer_id: string; // Changed from id to match RPC
  full_name: string;
  full_name_ar: string | null;
  avatar_url: string | null;
  total_points: number;
  activities_count: number;
  level: string;
  committee_id: string | null;
  committee_name: string | null;
  committee_name_ar: string | null;
};

type Committee = {
  id: string;
  name: string;
  name_ar: string;
};

export default function Leaderboard() {
  const { user, primaryRole } = useAuth();
  const { isRTL, t } = useLanguage();
  const [selectedCommittee, setSelectedCommittee] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('month');
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);

  useEffect(() => {
    fetchData();
  }, [timeFilter, selectedCommittee]); // Re-fetch when filters change

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch committees if not already loaded
      if (committees.length === 0) {
        const { data } = await supabase.from('committees').select('id, name, name_ar').order('name');
        if (data) setCommittees(data);
      }

      // Determine committee filter (UUID or null)
      const committeeId = selectedCommittee === 'all' ? null : selectedCommittee;

      // Call the RPC function
      const { data, error } = await supabase.rpc('get_leaderboard', {
        period_type: timeFilter,
        target_date: new Date().toISOString(),
        committee_filter: committeeId
      });

      if (error) throw error;
      setLeaderboard(data || []);

    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
      case 3:
        return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getName = (entry: LeaderboardEntry) => {
    return isRTL ? (entry.full_name_ar || entry.full_name) : entry.full_name;
  };

  const getCommitteeName = (entry: LeaderboardEntry) => {
    if (!entry.committee_name) return isRTL ? 'بدون لجنة' : 'No Committee';
    return isRTL ? (entry.committee_name_ar || entry.committee_name) : entry.committee_name;
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            {isRTL ? 'المتصدرين' : 'Leaderboard'}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? 'أفضل المتطوعين في RTC' : 'Top performing volunteers across RTC'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Time Filter */}
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[180px]">
              <Calendar className={isRTL ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{isRTL ? 'هذا الشهر' : 'This Month'}</SelectItem>
              <SelectItem value="quarter">{isRTL ? 'هذا الربع' : 'This Quarter'}</SelectItem>
              <SelectItem value="half_year">{isRTL ? 'نصف سنوي' : 'Half Yearly'}</SelectItem>
              <SelectItem value="all_time">{isRTL ? 'كل الوقت' : 'All Time'}</SelectItem>
              {/* Only show Year filter to admins as requested */}
              {primaryRole === 'admin' && (
                <SelectItem value="year">{isRTL ? 'هذه السنة' : 'This Year'}</SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Committee Filter */}
          <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={isRTL ? 'فلترة حسب اللجنة' : 'Filter by committee'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'جميع اللجان' : 'All Committees'}</SelectItem>
              {committees.map((committee) => (
                <SelectItem key={committee.id} value={committee.id}>
                  {isRTL ? committee.name_ar : committee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {isRTL ? 'لا يوجد متطوعون لهذه الفترة' : 'No volunteers found for this period'}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {leaderboard.slice(0, 3).map((entry, index) => {
              const displayName = getName(entry);
              const userInitials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              const isCurrentUser = entry.volunteer_id === user?.id; // RPC returns volunteer_id

              return (
                <Card
                  key={entry.volunteer_id}
                  className={cn(
                    "relative overflow-hidden",
                    isCurrentUser && "ring-2 ring-primary"
                  )}
                >
                  <div className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    index === 0 && "bg-yellow-400",
                    index === 1 && "bg-gray-400",
                    index === 2 && "bg-amber-600"
                  )} />
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold mb-3",
                        getRankStyle(index + 1)
                      )}>
                        {index + 1}
                      </div>
                      <Avatar className="h-16 w-16 mb-3">
                        <AvatarImage src={entry.avatar_url || undefined} alt={displayName} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold">{displayName}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{getCommitteeName(entry)}</p>
                      <LevelBadge level={entry.level as any} size="sm" />
                      <div className="mt-3">
                        <span className="text-2xl font-bold text-primary">{entry.total_points}</span>
                        <span className="text-sm text-muted-foreground ml-1">{isRTL ? 'أثر' : 'impact'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.activities_count} {isRTL ? 'نشاط' : 'activities'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Full Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'الترتيب الكامل' : 'Full Rankings'}</CardTitle>
              <CardDescription>
                {selectedCommittee === 'all'
                  ? (isRTL ? 'جميع المتطوعين' : 'All volunteers')
                  : (isRTL
                    ? committees.find(c => c.id === selectedCommittee)?.name_ar
                    : committees.find(c => c.id === selectedCommittee)?.name
                  )
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.map((entry, index) => {
                  const displayName = getName(entry);
                  const userInitials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  const isCurrentUser = entry.volunteer_id === user?.id; // RPC returns volunteer_id
                  const rank = index + 1;

                  return (
                    <div
                      key={entry.volunteer_id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg transition-colors",
                        isCurrentUser ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                        getRankStyle(rank)
                      )}>
                        {rank}
                      </div>
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={entry.avatar_url || undefined} alt={displayName} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{displayName}</p>
                          {isCurrentUser && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              {isRTL ? 'أنت' : 'You'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{getCommitteeName(entry)}</p>
                      </div>
                      <LevelBadge level={entry.level as any} size="sm" showLabel={false} className="hidden md:flex" />
                      <div className="text-right shrink-0">
                        <p className="font-bold">{entry.total_points}</p>
                        <p className="text-xs text-muted-foreground">{isRTL ? 'أثر' : 'impact'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
