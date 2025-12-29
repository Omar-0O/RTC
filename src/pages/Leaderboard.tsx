import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLeaderboard, committees } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Leaderboard() {
  const { user } = useAuth();
  const [selectedCommittee, setSelectedCommittee] = useState<string>('all');

  const leaderboard = getLeaderboard(selectedCommittee === 'all' ? undefined : selectedCommittee);

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

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Top performing volunteers across RTC
          </p>
        </div>
        <Select value={selectedCommittee} onValueChange={setSelectedCommittee}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by committee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Committees</SelectItem>
            {committees.map((committee) => (
              <SelectItem key={committee.id} value={committee.id}>
                {committee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {leaderboard.slice(0, 3).map((entry, index) => {
          const userInitials = entry.userName.split(' ').map(n => n[0]).join('').toUpperCase();
          const isCurrentUser = entry.userId === user?.id;
          
          return (
            <Card
              key={entry.userId}
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
                    getRankStyle(entry.rank)
                  )}>
                    {entry.rank}
                  </div>
                  <Avatar className="h-16 w-16 mb-3">
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold">{entry.userName}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{entry.committeeName}</p>
                  <LevelBadge level={entry.level} size="sm" />
                  <div className="mt-3">
                    <span className="text-2xl font-bold text-primary">{entry.totalPoints}</span>
                    <span className="text-sm text-muted-foreground ml-1">pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entry.activitiesCompleted} activities
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
          <CardTitle>Full Rankings</CardTitle>
          <CardDescription>
            {selectedCommittee === 'all' ? 'All volunteers' : committees.find(c => c.id === selectedCommittee)?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard.map((entry) => {
              const userInitials = entry.userName.split(' ').map(n => n[0]).join('').toUpperCase();
              const isCurrentUser = entry.userId === user?.id;
              
              return (
                <div
                  key={entry.userId}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-colors",
                    isCurrentUser ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                    getRankStyle(entry.rank)
                  )}>
                    {entry.rank}
                  </div>
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{entry.userName}</p>
                      {isCurrentUser && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{entry.committeeName}</p>
                  </div>
                  <LevelBadge level={entry.level} size="sm" showLabel={false} className="hidden md:flex" />
                  <div className="text-right shrink-0">
                    <p className="font-bold">{entry.totalPoints}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
