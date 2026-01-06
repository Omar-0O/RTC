import { useState, useEffect } from 'react';
import { Users, Award, TrendingUp, UserPlus, UserMinus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatsCard } from '@/components/ui/stats-card';
import { LevelBadge, getLevelProgress } from '@/components/ui/level-badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  email: string;
  total_points: number;
  level: string;
  activities_count?: number;
  avatar_url: string | null;
  committee_id: string | null;
}

interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

export default function CommitteeLeaderDashboard() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const committeeId = profile?.committee_id;

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
      .select('*, activity_submissions:activity_submissions!activity_submissions_volunteer_id_fkey(id, created_at, committee_id)')
      .eq('committee_id', committeeId);

    if (membersData) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const membersWithCount: Profile[] = membersData.map((member: any) => {
        const calculateMonthlyCount = (submissions: any[]) => {
          if (!submissions) return 0;
          return submissions.filter(sub => {
            const subDate = new Date(sub.created_at);
            return subDate.getMonth() === currentMonth &&
              subDate.getFullYear() === currentYear &&
              sub.committee_id === committeeId;
          }).length;
        };

        return {
          ...member,
          activities_count: calculateMonthlyCount(member.activity_submissions)
        };
      });
      setMembers(membersWithCount);
    }
  };

  useEffect(() => {
    fetchData();
  }, [committeeId]);

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ committee_id: null })
        .eq('id', selectedMember.id);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم إزالة العضو بنجاح' : 'Member removed successfully');
      setIsRemoveDialogOpen(false);
      setSelectedMember(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openRemoveDialog = (member: Profile) => {
    setSelectedMember(member);
    setIsRemoveDialogOpen(true);
  };

  const committeeName = language === 'ar' ? committee?.name_ar : committee?.name;

  const totalMembers = members.length;
  // Calculate total monthly participations across all members
  const totalMonthlyParticipations = members.reduce((sum, member) => sum + (member.activities_count || 0), 0);

  const displayLevel = (level: string) => {
    const map: Record<string, string> = {
      'bronze': 'under_follow_up',
      'silver': 'under_follow_up',
      'gold': 'project_responsible',
      'platinum': 'responsible',
      'diamond': 'responsible',
      'newbie': 'under_follow_up',
      'active': 'under_follow_up',
      'تحت المتابعة': 'under_follow_up',
      'مشروع مسؤول': 'project_responsible',
      'مسؤول': 'responsible',
    };
    return map[level] || level || 'under_follow_up';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('leader.dashboard')} - {committeeName}
          </h1>
          <p className="text-muted-foreground">{t('leader.overview')}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatsCard
          title={t('leader.totalMembers')}
          value={totalMembers}
          icon={Users}
          description={t('common.volunteers')}
        />
        <StatsCard
          title={language === 'ar' ? 'المشاركات الشهرية' : 'Monthly Participations'}
          value={totalMonthlyParticipations}
          icon={TrendingUp}
          description={language === 'ar' ? 'مشاركة هذا الشهر' : 'participations this month'}
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
              {language === 'ar' ? 'لا يوجد أعضاء في هذه اللجنة بعد.' : 'No members in this committee yet.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('users.fullName')}</TableHead>
                  <TableHead className="text-start">{t('users.level')}</TableHead>
                  <TableHead className="text-start">{language === 'ar' ? 'المشاركات الشهرية' : 'Monthly Participations'}</TableHead>
                  <TableHead className="text-start">{t('leader.memberProgress')}</TableHead>
                  <TableHead className="text-start">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                          <AvatarFallback className="text-xs">
                            {member.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? member.full_name_ar || member.full_name : member.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.activities_count} {language === 'ar' ? 'مشاركة' : 'participations'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <LevelBadge level={displayLevel(member.level)} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span className="font-bold">{member.activities_count || 0}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={getLevelProgress(member.total_points).progress} className="h-2 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openRemoveDialog(member)}
                        disabled={member.id === profile?.id}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
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
            <AlertDialogTitle>
              {language === 'ar' ? 'إزالة العضو من اللجنة؟' : 'Remove member from committee?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد من إزالة ${selectedMember?.full_name_ar || selectedMember?.full_name} من اللجنة؟`
                : `Are you sure you want to remove ${selectedMember?.full_name} from the committee?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoading}
            >
              {isLoading ? (language === 'ar' ? 'جاري الإزالة...' : 'Removing...') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
