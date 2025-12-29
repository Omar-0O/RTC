import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { Trophy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type LeaderboardEntry = {
  id: string;
  full_name: string;
  full_name_ar: string | null;
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
  const { user } = useAuth();
  const { isRTL, t } = useLanguage();
  const [selectedCommittee, setSelectedCommittee] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, committeesRes] = await Promise.all([
        supabase.from('profiles').select(`
          id,
          full_name,
          full_name_ar,
          total_points,
          activities_count,
          level,
          committee_id,
          committee:committees(name, name_ar)
        `).order('total_points', { ascending: false }),
        supabase.from('committees').select('id, name, name_ar').order('name'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (committeesRes.error) throw committeesRes.error;

      const entries = (profilesRes.data || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || 'Unknown',
        full_name_ar: p.full_name_ar,
        total_points: p.total_points || 0,
        activities_count: p.activities_count || 0,
        level: p.level || 'bronze',
        committee_id: p.committee_id,
        committee_name: p.committee?.name || null,
        committee_name_ar: p.committee?.name_ar || null,
      }));

      setLeaderboard(entries);
      setCommittees(committeesRes.data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaderboard = selectedCommittee === 'all' 
    ? leaderboard 
    : leaderboard.filter(entry => entry.committee_id === selectedCommittee);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

      {filteredLeaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {isRTL ? 'لا يوجد متطوعون حتى الآن' : 'No volunteers yet'}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredLeaderboard.slice(0, 3).map((entry, index) => {
              const displayName = getName(entry);
              const userInitials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              const isCurrentUser = entry.id === user?.id;
              
              return (
                <Card
                  key={entry.id}
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
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold">{displayName}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{getCommitteeName(entry)}</p>
                      <LevelBadge level={entry.level as any} size="sm" />
                      <div className="mt-3">
                        <span className="text-2xl font-bold text-primary">{entry.total_points}</span>
                        <span className="text-sm text-muted-foreground ml-1">{isRTL ? 'نقطة' : 'pts'}</span>
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
                {filteredLeaderboard.map((entry, index) => {
                  const displayName = getName(entry);
                  const userInitials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  const isCurrentUser = entry.id === user?.id;
                  const rank = index + 1;
                  
                  return (
                    <div
                      key={entry.id}
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
                        <p className="text-xs text-muted-foreground">{isRTL ? 'نقطة' : 'points'}</p>
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
