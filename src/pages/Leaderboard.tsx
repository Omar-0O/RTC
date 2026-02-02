import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { Trophy, Loader2, Calendar, Users, Star, Crown, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type LeaderboardEntry = {
  volunteer_id: string;
  full_name: string;
  full_name_ar: string | null;
  avatar_url?: string | null;
  total_points: number;
  activities_count?: number;
  level: string;
  committee_id?: string | null;
  committee_name?: string | null;
  committee_name_ar?: string | null;
};

type Committee = {
  id: string;
  name: string;
  name_ar: string;
};

const LEVELS = [
  { value: 'all', labelEn: 'All Levels', labelAr: 'كل الدرجات', icon: '🏆' },
  { value: 'under_follow_up', labelEn: 'Under Follow Up', labelAr: 'تحت المتابعة', icon: '👀' },
  { value: 'project_responsible', labelEn: 'Project Responsible', labelAr: 'مسؤول مشروع', icon: '📋' },
  { value: 'responsible', labelEn: 'Responsible', labelAr: 'مسؤول', icon: '👑' },
];

export default function Leaderboard() {
  const { user, primaryRole } = useAuth();
  const { isRTL } = useLanguage();
  const [selectedCommittee, setSelectedCommittee] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('month');
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);

  useEffect(() => {
    fetchData();
  }, [timeFilter, selectedCommittee]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (committees.length === 0) {
        const { data } = await supabase.from('committees').select('id, name, name_ar').order('name');
        if (data) setCommittees(data);
      }

      const committeeId = selectedCommittee === 'all' ? null : selectedCommittee;

      const { data, error } = await supabase.rpc('get_leaderboard', {
        period_type: timeFilter,
        target_date: new Date().toISOString(),
        committee_filter: committeeId
      });

      if (error) throw error;
      setLeaderboard((data as LeaderboardEntry[]) || []);

    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter by level on client side
  const filteredLeaderboard = useMemo(() => {
    if (selectedLevel === 'all') return leaderboard;
    return leaderboard.filter(entry => entry.level?.toLowerCase() === selectedLevel);
  }, [leaderboard, selectedLevel]);

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

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-4 w-4" />;
      case 2: return <Medal className="h-4 w-4" />;
      case 3: return <Award className="h-4 w-4" />;
      default: return rank;
    }
  };

  const getName = (entry: LeaderboardEntry) => {
    return isRTL ? (entry.full_name_ar || entry.full_name) : entry.full_name;
  };

  const getCommitteeName = (entry: LeaderboardEntry) => {
    if (!entry.committee_name) return isRTL ? 'عام' : 'General';
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
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{isRTL ? 'سباق الخير' : 'Race of Goodness'}</h1>
            <p className="text-sm text-muted-foreground">
              {filteredLeaderboard.length} {isRTL ? 'متطوع' : 'volunteers'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <Calendar className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{isRTL ? 'هذا الشهر' : 'This Month'}</SelectItem>
              <SelectItem value="quarter">{isRTL ? 'هذا الربع' : 'This Quarter'}</SelectItem>
              <SelectItem value="third_year">{isRTL ? 'الثلث السنوي' : 'Third of Year'}</SelectItem>
              <SelectItem value="half_year">{isRTL ? 'نصف سنوي' : 'Half Yearly'}</SelectItem>
              <SelectItem value="all_time">{isRTL ? 'كل الوقت' : 'All Time'}</SelectItem>
              {primaryRole === 'admin' && (
                <SelectItem value="year">{isRTL ? 'هذه السنة' : 'This Year'}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
            <SelectTrigger className="w-[140px] h-9">
              <Users className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل اللجان' : 'All'}</SelectItem>
              {committees.map((committee) => (
                <SelectItem key={committee.id} value={committee.id}>
                  {isRTL ? committee.name_ar : committee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-[140px] h-9">
              <Star className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  <span className="flex items-center gap-2">
                    <span>{level.icon}</span>
                    <span>{isRTL ? level.labelAr : level.labelEn}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredLeaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>{isRTL ? 'لا يوجد متطوعون لهذه الفترة' : 'No volunteers found'}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top 3 */}
          {filteredLeaderboard.length >= 3 && (
            <div className="grid grid-cols-3 gap-3">
              {[1, 0, 2].map((idx) => {
                const entry = filteredLeaderboard[idx];
                if (!entry) return null;
                const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                const displayName = getName(entry);
                const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const isCurrentUser = entry.volunteer_id === user?.id;

                const colors = {
                  1: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20',
                  2: 'border-gray-300 bg-gray-50 dark:bg-gray-900/20',
                  3: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                };

                return (
                  <Card key={entry.volunteer_id} className={cn(
                    "border-2 transition-all hover:shadow-md",
                    colors[rank as 1 | 2 | 3],
                    isCurrentUser && "ring-2 ring-primary",
                    rank === 1 && "scale-105"
                  )}>
                    <CardContent className="pt-4 pb-3 text-center">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2",
                        getRankStyle(rank)
                      )}>
                        {getRankIcon(rank)}
                      </div>
                      <Avatar className={cn("mx-auto mb-2 border-2", rank === 1 ? "h-16 w-16" : "h-12 w-12")}>
                        <AvatarImage src={entry.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                      </Avatar>
                      <p className="font-semibold text-sm truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{getCommitteeName(entry)}</p>
                      <div className="mt-2">
                        <span className="text-lg font-bold text-primary">{entry.total_points}</span>
                        <span className="text-xs text-muted-foreground mx-1">{isRTL ? 'أثر' : 'pts'}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {entry.activities_count} {isRTL ? 'مشاركة' : 'participations'}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Full List */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{isRTL ? 'الترتيب الكامل' : 'Full Rankings'}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredLeaderboard.map((entry, index) => {
                  const displayName = getName(entry);
                  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                  const isCurrentUser = entry.volunteer_id === user?.id;
                  const rank = index + 1;

                  return (
                    <div
                      key={entry.volunteer_id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
                        isCurrentUser && "bg-primary/5"
                      )}
                    >
                      <div className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                        getRankStyle(rank)
                      )}>
                        {rank <= 3 ? getRankIcon(rank) : rank}
                      </div>
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={entry.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{displayName}</p>
                          {isCurrentUser && (
                            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                              {isRTL ? 'أنت' : 'You'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{getCommitteeName(entry)}</p>
                      </div>
                      <LevelBadge level={entry.level as any} size="sm" showLabel={false} className="hidden sm:flex" />
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-primary">{entry.total_points}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.activities_count} {isRTL ? 'مشاركة' : 'parts'}</p>
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
