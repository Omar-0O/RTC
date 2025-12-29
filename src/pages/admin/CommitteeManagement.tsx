import { useState } from 'react';
import { Plus, MoreHorizontal, Users, Award, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { committees, mockVolunteers, activityTypes } from '@/data/mockData';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export default function CommitteeManagement() {
  const { t } = useLanguage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState<typeof committees[0] | null>(null);

  const committeeStats = committees.map(committee => {
    const volunteers = mockVolunteers.filter(v => v.committeeId === committee.id);
    const activities = activityTypes.filter(a => a.committeeId === committee.id);
    const totalPoints = volunteers.reduce((sum, v) => sum + v.totalPoints, 0);
    return {
      ...committee,
      volunteerCount: volunteers.length,
      activityCount: activities.length,
      totalPoints,
    };
  });

  const handleAddCommittee = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(t('committees.title'));
    setIsAddDialogOpen(false);
  };

  const handleEditCommittee = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(t('common.save'));
    setIsEditDialogOpen(false);
    setSelectedCommittee(null);
  };

  const handleDeleteCommittee = () => {
    toast.success(t('common.delete'));
    setIsDeleteDialogOpen(false);
    setSelectedCommittee(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('committees.title')}</h1>
          <p className="text-muted-foreground">{t('committees.subtitle')}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('committees.addCommittee')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('committees.createNew')}</DialogTitle>
              <DialogDescription>{t('committees.createDescription')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCommittee}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t('committees.name')}</Label>
                  <Input id="name" placeholder={t('committees.name')} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">{t('committees.description')}</Label>
                  <Textarea id="description" placeholder={t('committees.description')} rows={3} />
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

      {/* Committee Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {committeeStats.map((committee) => (
          <Card key={committee.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{committee.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedCommittee(committee);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setSelectedCommittee(committee);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-sm text-muted-foreground">{committee.description}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold">{committee.volunteerCount}</p>
                  <p className="text-xs text-muted-foreground">{t('common.volunteers')}</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Award className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold">{committee.totalPoints}</p>
                  <p className="text-xs text-muted-foreground">{t('common.points')}</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <Award className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold">{committee.activityCount}</p>
                  <p className="text-xs text-muted-foreground">{t('nav.activities')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.edit')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditCommittee}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">{t('committees.name')}</Label>
                <Input id="edit-name" defaultValue={selectedCommittee?.name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">{t('committees.description')}</Label>
                <Textarea id="edit-description" defaultValue={selectedCommittee?.description} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('committees.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('committees.deleteWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCommittee}
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
