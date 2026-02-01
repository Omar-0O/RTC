import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, UserMinus, User, Phone, Mail, Calendar, Loader2, Check, ChevronsUpDown, Eye, MoreVertical, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Profile {
    id: string;
    full_name: string | null;
    full_name_ar: string | null;
    email: string;
    phone: string | null;
    total_points: number;
    level: string;
    activities_count: number;
    avatar_url: string | null;
    committee_id: string | null;
    created_at: string;
}

export default function Members() {
    const { profile } = useAuth();
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const [members, setMembers] = useState<Profile[]>([]);
    const [availableVolunteers, setAvailableVolunteers] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
    const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<string[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [comboboxOpen, setComboboxOpen] = useState(false);

    const committeeId = profile?.committee_id;

    const fetchData = async () => {
        if (!committeeId) return;
        setIsLoading(true);

        try {
            // Fetch committee members with activity count
            const { data: membersData, error: membersError } = await supabase
                .from('profiles')
                .select('*, activity_submissions:activity_submissions!activity_submissions_volunteer_id_fkey(count)')
                .eq('committee_id', committeeId);

            if (membersError) throw membersError;

            if (membersData) {
                const membersWithCount: Profile[] = membersData.map((member: any) => ({
                    ...member,
                    activities_count: member.activity_submissions?.[0]?.count || 0
                }));
                setMembers(membersWithCount);
            }

            // Fetch available volunteers (those without a committee)
            const { data: volunteersData, error: volunteersError } = await supabase
                .from('profiles')
                .select('*')
                .is('committee_id', null);

            if (volunteersError) throw volunteersError;

            if (volunteersData) {
                const volunteers: Profile[] = volunteersData.map((v: any) => ({
                    ...v,
                    activities_count: 0
                }));
                setAvailableVolunteers(volunteers);
            }

        } catch (error: any) {
            console.error('Error fetching data:', error);
            toast.error(error.message || 'Failed to load members');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [committeeId]);

    const handleAddMember = async () => {
        if (selectedVolunteerIds.length === 0 || !committeeId) {
            toast.error(language === 'ar' ? 'يرجى اختيار متطوع' : 'Please select a volunteer');
            return;
        }

        setIsActionLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ committee_id: committeeId })
                .in('id', selectedVolunteerIds);

            if (error) throw error;

            toast.success(language === 'ar' ? 'تم إضافة الأعضاء بنجاح' : 'Members added successfully');
            setIsAddDialogOpen(false);
            setSelectedVolunteerIds([]);
            fetchData();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const toggleVolunteerSelection = (id: string) => {
        setSelectedVolunteerIds(prev =>
            prev.includes(id)
                ? prev.filter(vId => vId !== id)
                : [...prev, id]
        );
    };

    const handleRemoveMember = async () => {
        if (!selectedMember) return;

        setIsActionLoading(true);
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
            setIsActionLoading(false);
        }
    };

    const openRemoveDialog = (member: Profile) => {
        setSelectedMember(member);
        setIsRemoveDialogOpen(true);
    };

    const displayLevel = (dbLevel: string): string => {
        // Map database levels to the new volunteer level system
        const levelMap: Record<string, string> = {
            bronze: 'under_follow_up',
            silver: 'under_follow_up',
            gold: 'project_responsible',
            platinum: 'responsible',
            diamond: 'responsible',
            under_follow_up: 'under_follow_up',
            project_responsible: 'project_responsible',
            responsible: 'responsible',
        };
        return levelMap[dbLevel] || 'under_follow_up';
    };

    const filteredMembers = members.filter(member =>
        (member.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (member.full_name_ar?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('leader.members')}</h1>
                    <p className="text-muted-foreground">{t('leader.overview')}</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t('leader.addMember')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="overflow-visible">
                        <DialogHeader>
                            <DialogTitle>{t('leader.addMember')}</DialogTitle>
                            <DialogDescription>
                                {language === 'ar' ? 'اختر متطوعاً لإضافته إلى اللجنة' : 'Select a volunteer to add to the committee'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="flex flex-col space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {language === 'ar' ? 'بحث عن متطوع' : 'Search Volunteer'}
                                </label>
                                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={comboboxOpen}
                                            className="w-full justify-between"
                                        >
                                            {selectedVolunteerIds.length > 0
                                                ? (language === 'ar' ? `تم اختيار ${selectedVolunteerIds.length}` : `${selectedVolunteerIds.length} Selected`)
                                                : (language === 'ar' ? 'اختر متطوعين...' : 'Select volunteers...')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                        <Command>
                                            <CommandInput placeholder={language === 'ar' ? 'بحث بالاسم او البريد...' : 'Search name or email...'} />
                                            <CommandList>
                                                <CommandEmpty>{language === 'ar' ? 'لا يوجد نتائج.' : 'No volunteers found.'}</CommandEmpty>
                                                <CommandGroup>
                                                    {availableVolunteers.map((volunteer) => (
                                                        <CommandItem
                                                            key={volunteer.id}
                                                            value={volunteer.full_name || volunteer.email}
                                                            onSelect={() => toggleVolunteerSelection(volunteer.id)}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedVolunteerIds.includes(volunteer.id) ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarImage src={volunteer.avatar_url || undefined} />
                                                                    <AvatarFallback>
                                                                        {volunteer.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex flex-col">
                                                                    <span>{language === 'ar' ? volunteer.full_name_ar || volunteer.full_name : volunteer.full_name}</span>
                                                                    <span className="text-xs text-muted-foreground">{volunteer.email}</span>
                                                                </div>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {availableVolunteers.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-destructive">
                                        {language === 'ar'
                                            ? 'ملاحظة: لا يوجد متطوعين غير مسجلين في لجان حالياً.'
                                            : 'Note: No volunteers without a committee available.'}
                                    </p>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                onClick={handleAddMember}
                                disabled={isActionLoading || selectedVolunteerIds.length === 0}
                            >
                                {isActionLoading ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...') : t('common.add')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {t('leader.members')} ({members.length})
                        </CardTitle>
                        <div className="w-[300px]">
                            <div className="relative">
                                <Search className="absolute ltr:left-2 rtl:right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('common.search')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="ltr:pl-8 rtl:pr-8"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('users.fullName')}</TableHead>
                                    <TableHead>{t('users.level')}</TableHead>
                                    <TableHead>{t('common.points')}</TableHead>
                                    <TableHead>{t('users.joined')}</TableHead>
                                    <TableHead className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMembers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            {language === 'ar' ? 'لا يوجد أعضاء مطابقين للبحث' : 'No members found'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMembers.map((member) => (
                                        <TableRow key={member.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={member.avatar_url || undefined} />
                                                        <AvatarFallback>
                                                            {member.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            {language === 'ar' ? member.full_name_ar || member.full_name : member.full_name}
                                                        </p>
                                                        <div className="flex flex-col text-xs text-muted-foreground gap-0.5">
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3" />
                                                                {member.email}
                                                            </span>
                                                            {member.phone && (
                                                                <span className="flex items-center gap-1">
                                                                    <Phone className="h-3 w-3" />
                                                                    {member.phone}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <LevelBadge level={displayLevel(member.level)} size="sm" />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{member.total_points}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {member.activities_count} {language === 'ar' ? 'نشاط' : 'activities'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {member.created_at ? format(new Date(member.created_at), 'PPP') : '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-end">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => navigate(`/leader/members/${member.id}`)}>
                                                            <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                            {language === 'ar' ? 'عرض البروفايل' : 'View Profile'}
                                                        </DropdownMenuItem>
                                                        {member.phone && (
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    const phone = member.phone?.replace(/[^0-9]/g, '');
                                                                    const formattedPhone = phone?.startsWith('0') ? `2${phone}` : phone;
                                                                    window.open(`https://wa.me/${formattedPhone}`, '_blank');
                                                                }}
                                                            >
                                                                <MessageCircle className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-green-600" />
                                                                {language === 'ar' ? 'رسالة واتساب' : 'WhatsApp Message'}
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => openRemoveDialog(member)}
                                                            disabled={member.id === profile?.id}
                                                        >
                                                            <UserMinus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                            {language === 'ar' ? 'إزالة من اللجنة' : 'Remove from Committee'}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

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
                            disabled={isActionLoading}
                        >
                            {isActionLoading ? (language === 'ar' ? 'جاري الإزالة...' : 'Removing...') : t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
