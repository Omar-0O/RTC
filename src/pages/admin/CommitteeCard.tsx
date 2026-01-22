import { MoreHorizontal, Users, Award, Pencil, Trash2, FileSpreadsheet, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface Committee {
    id: string;
    name: string;
    name_ar: string;
    description: string | null;
    description_ar: string | null;
    color: string | null;
    committee_type: 'production' | 'fourth_year';
}

interface CommitteeWithStats extends Committee {
    volunteerCount: number;
    totalPoints: number;
    participationCount: number;
    trainerCount: number;
}
interface CommitteeCardProps {
    committee: CommitteeWithStats;
    showTrainers: boolean;
    language: string;
    getDisplayName: (c: Committee) => string;
    getDisplayDescription: (c: Committee) => string | null;
    t: (key: string) => string;
    openEditDialog: (c: CommitteeWithStats) => void;
    setSelectedCommittee: (c: CommitteeWithStats) => void;
    setIsDeleteDialogOpen: (val: boolean) => void;
}

const CommitteeCard = ({
    committee,
    showTrainers,
    language,
    getDisplayName,
    getDisplayDescription,
    t,
    openEditDialog,
    setSelectedCommittee,
    setIsDeleteDialogOpen
}: CommitteeCardProps) => (
    <Card className="relative">
        <div
            className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
            style={{ backgroundColor: committee.color || '#3B82F6' }}
        />
        <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{getDisplayName(committee)}</CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(committee)}>
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
            <p className="text-sm text-muted-foreground">
                {getDisplayDescription(committee) || 'No description'}
            </p>
        </CardHeader>
        <CardContent>
            <div className={`grid grid-cols-2 ${showTrainers ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4 text-center`}>
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
                    <p className="text-2xl font-bold">{committee.totalPoints.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{t('common.points')}</p>
                </div>
                <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold">{committee.participationCount || 0}</p>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المشاركات' : 'Participations'}</p>
                </div>
                {showTrainers && (
                    <div>
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <GraduationCap className="h-4 w-4" />
                        </div>
                        <p className="text-2xl font-bold">{committee.trainerCount || 0}</p>
                        <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المدربين' : 'Trainers'}</p>
                    </div>
                )}
            </div>
        </CardContent>
    </Card>
);

export default CommitteeCard;
