import { useState, useEffect } from 'react';
import { Users, Award, TrendingUp, Activity, Trash2, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatsCard } from '@/components/ui/stats-card';
import { LevelBadge } from '@/components/ui/level-badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  total_points: number;
  level: string;
  activities_count: number;
}

interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

export default function CommitteeLeaderDashboard() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [committee, setCommittee] = useState<Committee | null>(null);

  const committeeId = profile?.committee_id;

  useEffect(() => {
    const fetchData = async () => {
      if (!committeeId) return;

      // Fetch committee info
      const { data: committeeData } = await supabase
        .from('committees')
        .select('*')
        .eq('id', committeeId)
        .maybeSingle();
      
      if (committeeData) setCommittee(committeeData);

      // Fetch committee members
      const { data: membersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('committee_id', committeeId);
      
      if (membersData) setMembers(membersData);
    };

    fetchData();
  }, [committeeId]);

  // Calculate stats
  const totalMembers = members.length;
  const totalPoints = members.reduce((sum, m) => sum + (m.total_points || 0), 0);
  const avgPoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;
  const topPerformer = [...members].sort((a, b) => (b.total_points || 0) - (a.total_points || 0))[0];

  // Level progress calculation
  const getLevelProgress = (points: number) => {
    if (points >= 5000) return 100;
    if (points >= 2500) return ((points - 2500) / 2500) * 100;
    if (points >= 1000) return ((points - 1000) / 1500) * 100;
    if (points >= 500) return ((points - 500) / 500) * 100;
    return (points / 500) * 100;
  };

  const displayLevel = (dbLevel: string) => {
    const levelMap: Record<string, string> = {
      bronze: 'Newbie',
      silver: 'Silver',
      gold: 'Golden',
      platinum: 'Platinum',
      diamond: 'Diamond',
    };
    return levelMap[dbLevel] || 'Newbie';
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(t('leader.addMember'));
    setIsAddDialogOpen(false);
  };

  const handleRemoveMember = () => {
    toast.success(t('leader.removeMember'));
    setIsRemoveDialogOpen(false);
    setSelectedMember(null);
  };

  const committeeName = language === 'ar' ? committee?.name_ar : committee?.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('leader.dashboard')}</h1>
          <p className="text-muted-foreground">{committeeName} - {t('leader.overview')}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('leader.addMember')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('leader.addMember')}</DialogTitle>
              <DialogDescription>{t('leader.overview')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMember}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t('users.fullName')}</Label>
                  <Input id="name" placeholder={t('users.fullName')} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input id="email" type="email" placeholder={t('auth.email')} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">{t('common.add')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title={t('leader.totalMembers')}
          value={totalMembers}
          icon={Users}
          description={t('common.volunteers')}
        />
        <StatsCard
          title={t('committees.totalPoints')}
          value={totalPoints.toLocaleString()}
          icon={Award}
          description={t('common.points')}
        />
        <StatsCard
          title={t('leader.avgPoints')}
          value={avgPoints}
          icon={TrendingUp}
          description={t('common.points')}
        />
        <StatsCard
          title={t('leader.topPerformer')}
          value={topPerformer?.full_name?.split(' ')[0] || '-'}
          icon={Award}
          description={`${topPerformer?.total_points || 0} ${t('common.points')}`}
        />
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('leader.members')} ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No members in this committee yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.fullName')}</TableHead>
                  <TableHead>{t('users.level')}</TableHead>
                  <TableHead>{t('common.points')}</TableHead>
                  <TableHead>{t('leader.memberProgress')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {member.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">{member.activities_count} activities</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <LevelBadge level={displayLevel(member.level)} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span className="font-bold">{member.total_points}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={getLevelProgress(member.total_points)} className="h-2 w-24" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Remove Member Confirmation */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leader.removeMember')}?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember?.full_name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
