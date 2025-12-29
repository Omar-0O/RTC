import { useState } from 'react';
import { Users, Award, TrendingUp, Activity, Plus, MoreHorizontal, Trash2, UserPlus } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { mockVolunteers, mockSubmissions, committees } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export default function CommitteeLeaderDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<typeof mockVolunteers[0] | null>(null);

  // Get current committee (using IT as default for demo)
  const committeeId = user?.committeeId || 'it';
  const committee = committees.find(c => c.id === committeeId);
  
  // Get committee members
  const members = mockVolunteers.filter(v => v.committeeId === committeeId);
  
  // Get committee submissions
  const submissions = mockSubmissions.filter(s => s.committeeId === committeeId);
  const recentSubmissions = submissions
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  // Calculate stats
  const totalMembers = members.length;
  const totalPoints = members.reduce((sum, m) => sum + m.totalPoints, 0);
  const avgPoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;
  const topPerformer = members.sort((a, b) => b.totalPoints - a.totalPoints)[0];

  // Level progress calculation
  const getLevelProgress = (points: number) => {
    if (points >= 300) return 100; // Golden
    if (points >= 150) return ((points - 150) / 150) * 100; // Silver -> Golden
    if (points >= 50) return ((points - 50) / 100) * 100; // Active -> Silver
    return (points / 50) * 100; // Newbie -> Active
  };

  const getNextLevel = (level: string) => {
    switch (level) {
      case 'Newbie': return t('level.active');
      case 'Active': return t('level.silver');
      case 'Silver': return t('level.golden');
      default: return t('level.golden');
    }
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return t('common.approved');
      case 'rejected': return t('common.rejected');
      default: return t('common.pending');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('leader.dashboard')}</h1>
          <p className="text-muted-foreground">{committee?.name} - {t('leader.overview')}</p>
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
          value={topPerformer?.name.split(' ')[0] || '-'}
          icon={Award}
          description={`${topPerformer?.totalPoints || 0} ${t('common.points')}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Members Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('leader.members')} ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.fullName')}</TableHead>
                  <TableHead>{t('users.level')}</TableHead>
                  <TableHead>{t('common.points')}</TableHead>
                  <TableHead>{t('leader.memberProgress')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.activitiesCompleted} {t('nav.activities')}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <LevelBadge level={member.level} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span className="font-bold">{member.totalPoints}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={getLevelProgress(member.totalPoints)} className="h-2 w-24" />
                        <p className="text-xs text-muted-foreground">
                          {t('profile.nextLevel')}: {getNextLevel(member.level)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedMember(member);
                              setIsRemoveDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t('leader.removeMember')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('leader.recentActivities')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{submission.volunteerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{submission.activityTypeName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-medium">+{submission.points}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        submission.status === 'approved'
                          ? 'bg-success/10 text-success'
                          : submission.status === 'rejected'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {getStatusText(submission.status)}
                    </span>
                  </div>
                </div>
              ))}
              {recentSubmissions.length === 0 && (
                <p className="text-center text-muted-foreground py-4">{t('leader.recentActivities')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('leader.memberProgress')}
          </CardTitle>
          <CardDescription>{t('leader.overview')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {members.slice(0, 8).map((member) => (
              <div key={member.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{member.name}</p>
                    <LevelBadge level={member.level} size="sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('common.points')}</span>
                    <span className="font-bold">{member.totalPoints}</span>
                  </div>
                  <Progress value={getLevelProgress(member.totalPoints)} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Remove Member Confirmation */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leader.removeMember')}?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember?.name}
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
