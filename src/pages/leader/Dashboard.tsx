import { useState, useEffect } from 'react';
import { Users, Award, TrendingUp, UserPlus, UserMinus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatsCard } from '@/components/ui/stats-card';
import { LevelBadge } from '@/components/ui/level-badge';
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
  activities_count: number;
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>('');
  const [members, setMembers] = useState<Profile[]>([]);
  const [availableVolunteers, setAvailableVolunteers] = useState<Profile[]>([]);
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
      .select('*')
      .eq('committee_id', committeeId);
    
    if (membersData) setMembers(membersData);

    // Fetch available volunteers (those without a committee)
    const { data: volunteersData } = await supabase
      .from('profiles')
      .select('*')
      .is('committee_id', null);
    
    if (volunteersData) setAvailableVolunteers(volunteersData);
  };

  useEffect(() => {
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

  const handleAddMember = async () => {
    if (!selectedVolunteerId || !committeeId) {
      toast.error(language === 'ar' ? 'يرجى اختيار متطوع' : 'Please select a volunteer');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ committee_id: committeeId })
        .eq('id', selectedVolunteerId);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم إضافة العضو بنجاح' : 'Member added successfully');
      setIsAddDialogOpen(false);
      setSelectedVolunteerId('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

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
              <DialogDescription>
                {language === 'ar' ? 'اختر متطوعاً لإضافته إلى اللجنة' : 'Select a volunteer to add to the committee'}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {availableVolunteers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {language === 'ar' ? 'لا يوجد متطوعين متاحين للإضافة' : 'No available volunteers to add'}
                </p>
              ) : (
                <Select value={selectedVolunteerId} onValueChange={setSelectedVolunteerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر متطوعاً' : 'Select a volunteer'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVolunteers.map((volunteer) => (
                      <SelectItem key={volunteer.id} value={volunteer.id}>
                        {language === 'ar' ? volunteer.full_name_ar || volunteer.full_name : volunteer.full_name} - {volunteer.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={handleAddMember} 
                disabled={isLoading || !selectedVolunteerId}
              >
                {isLoading ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...') : t('common.add')}
              </Button>
            </DialogFooter>
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
              {language === 'ar' ? 'لا يوجد أعضاء في هذه اللجنة بعد.' : 'No members in this committee yet.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.fullName')}</TableHead>
                  <TableHead>{t('users.level')}</TableHead>
                  <TableHead>{t('common.points')}</TableHead>
                  <TableHead>{t('leader.memberProgress')}</TableHead>
                  <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
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
                            {member.activities_count} {language === 'ar' ? 'نشاط' : 'activities'}
                          </p>
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
