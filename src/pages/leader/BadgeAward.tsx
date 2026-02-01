import { useState, useEffect } from 'react';
import { Search, Loader2, Award, UserPlus, Star, Trophy, Medal, Crown, Heart, Zap, Target, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

type Badge = {
    id: string;
    name: string;
    name_ar: string;
    description: string | null;
    description_ar: string | null;
    icon: string;
    color: string;
    points_required: number | null;
    activities_required: number | null;
};

type Profile = {
    id: string;
    full_name: string | null;
    full_name_ar: string | null;
    email: string;
    avatar_url: string | null;
    total_points: number;
    activities_count: number;
};

const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    award: Award,
    star: Star,
    trophy: Trophy,
    medal: Medal,
    crown: Crown,
    heart: Heart,
    zap: Zap,
    target: Target,
};

export default function BadgeAward() {
    const { isRTL } = useLanguage();
    const { profile: authProfile } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAwardDialogOpen, setIsAwardDialogOpen] = useState(false);
    const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
    const [badges, setBadges] = useState<Badge[]>([]);
    const [committeeMembers, setCommitteeMembers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [openCombobox, setOpenCombobox] = useState(false);
    const [usersWithBadge, setUsersWithBadge] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
    }, [authProfile?.committee_id]);

    const fetchData = async () => {
        if (!authProfile?.committee_id) return;

        setLoading(true);
        try {
            const [badgesRes, membersRes] = await Promise.all([
                supabase.from('badges').select('*').order('created_at', { ascending: false }),
                supabase.from('profiles')
                    .select('id, full_name, full_name_ar, email, avatar_url, total_points, activities_count')
                    .eq('committee_id', authProfile.committee_id)
                    .order('full_name'),
            ]);

            if (badgesRes.error) throw badgesRes.error;
            if (membersRes.error) throw membersRes.error;

            setBadges(badgesRes.data || []);
            setCommitteeMembers(membersRes.data || []);
        } catch (error: any) {
            toast.error(isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredBadges = badges.filter(badge => {
        const name = isRTL ? badge.name_ar : badge.name;
        const description = isRTL ? badge.description_ar : badge.description;
        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (description || '').toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Fetch users who already have the selected badge
    const fetchUsersWithBadge = async (badgeId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_badges')
                .select('user_id')
                .eq('badge_id', badgeId);

            if (error) throw error;
            setUsersWithBadge(data?.map(ub => ub.user_id) || []);
        } catch (error) {
            console.error('Failed to fetch users with badge:', error);
            setUsersWithBadge([]);
        }
    };

    // Filter out members who already have the selected badge
    const eligibleMembers = committeeMembers.filter(
        member => !usersWithBadge.includes(member.id)
    );

    const handleAwardBadge = async () => {
        if (!selectedBadge || !selectedUserId) return;
        setSubmitting(true);
        try {
            const selectedMember = committeeMembers.find(p => p.id === selectedUserId);

            if (!selectedMember) {
                toast.error(isRTL ? 'لم يتم العثور على المتطوع' : 'Volunteer not found');
                return;
            }

            // Check if volunteer meets the requirements
            if (selectedBadge.points_required && selectedMember.total_points < selectedBadge.points_required) {
                toast.error(
                    isRTL
                        ? `المتطوع يحتاج ${selectedBadge.points_required} أثر، ولديه ${selectedMember.total_points} فقط`
                        : `Volunteer needs ${selectedBadge.points_required} points, but has only ${selectedMember.total_points}`
                );
                setSubmitting(false);
                return;
            }

            if (selectedBadge.activities_required && selectedMember.activities_count < selectedBadge.activities_required) {
                toast.error(
                    isRTL
                        ? `المتطوع يحتاج ${selectedBadge.activities_required} مشاركة، ولديه ${selectedMember.activities_count} فقط`
                        : `Volunteer needs ${selectedBadge.activities_required} activities, but has only ${selectedMember.activities_count}`
                );
                setSubmitting(false);
                return;
            }

            const { error } = await supabase.from('user_badges').insert({
                user_id: selectedUserId,
                badge_id: selectedBadge.id,
            });

            if (error) {
                if (error.code === '23505') {
                    toast.error(isRTL ? 'المتطوع لديه هذه الشارة بالفعل' : 'Volunteer already has this badge');
                } else {
                    throw error;
                }
                return;
            }

            toast.success(isRTL ? 'تم منح الشارة بنجاح' : 'Badge awarded successfully');
            // Update the usersWithBadge list to include the newly awarded user
            setUsersWithBadge(prev => [...prev, selectedUserId]);
            setIsAwardDialogOpen(false);
            setSelectedBadge(null);
            setSelectedUserId('');
        } catch (error: any) {
            toast.error(isRTL ? 'فشل في منح الشارة' : 'Failed to award badge');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const getIconComponent = (iconName: string) => {
        const IconComponent = BADGE_ICONS[iconName] || Award;
        return <IconComponent className="h-5 w-5" />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{isRTL ? 'منح الشارات' : 'Award Badges'}</h1>
                <p className="text-muted-foreground mt-1">
                    {isRTL ? 'منح شارات للمتطوعين في لجنتك' : 'Award badges to volunteers in your committee'}
                </p>
            </div>

            {/* Search */}
            <Card>
                <CardHeader>
                    <CardTitle>{isRTL ? 'البحث' : 'Search'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={isRTL ? 'البحث في الشارات...' : 'Search badges...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Badges Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBadges.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-8 text-center text-muted-foreground">
                            {isRTL ? 'لا توجد شارات' : 'No badges found'}
                        </CardContent>
                    </Card>
                ) : (
                    filteredBadges.map((badge) => (
                        <Card key={badge.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div
                                        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: badge.color + '20', color: badge.color }}
                                    >
                                        {getIconComponent(badge.icon)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold">{isRTL ? badge.name_ar : badge.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {isRTL ? badge.description_ar : badge.description}
                                        </p>
                                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                            {badge.points_required && (
                                                <span>{isRTL ? `${badge.points_required} أثر` : `${badge.points_required} pts`}</span>
                                            )}
                                            {badge.activities_required && (
                                                <span>{isRTL ? `${badge.activities_required} مشاركة` : `${badge.activities_required} activities`}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    className="w-full mt-4"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedBadge(badge);
                                        fetchUsersWithBadge(badge.id);
                                        setIsAwardDialogOpen(true);
                                    }}
                                >
                                    <UserPlus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                    {isRTL ? 'منح لمتطوع' : 'Award to Volunteer'}
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Award Dialog */}
            <Dialog open={isAwardDialogOpen} onOpenChange={(open) => { setIsAwardDialogOpen(open); if (!open) { setSelectedBadge(null); setSelectedUserId(''); } }}>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'منح شارة' : 'Award Badge'}</DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? `منح شارة "${selectedBadge?.name_ar}" لأحد أعضاء لجنتك`
                                : `Award "${selectedBadge?.name}" badge to a committee member`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between"
                                >
                                    {selectedUserId
                                        ? (() => {
                                            const member = committeeMembers.find(m => m.id === selectedUserId);
                                            return isRTL ? (member?.full_name_ar || member?.full_name) : member?.full_name;
                                        })()
                                        : (isRTL ? 'اختر متطوع...' : 'Select volunteer...')}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                <Command>
                                    <CommandInput placeholder={isRTL ? 'البحث...' : 'Search...'} />
                                    <CommandList>
                                        <CommandEmpty>{isRTL ? 'لا يوجد نتائج' : 'No results found.'}</CommandEmpty>
                                        <CommandGroup>
                                            {eligibleMembers.map((member) => (
                                                <CommandItem
                                                    key={member.id}
                                                    value={member.full_name || member.email}
                                                    onSelect={() => {
                                                        setSelectedUserId(member.id);
                                                        setOpenCombobox(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedUserId === member.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={member.avatar_url || undefined} />
                                                            <AvatarFallback>
                                                                {member.full_name?.substring(0, 2).toUpperCase() || 'U'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span>{isRTL ? (member.full_name_ar || member.full_name) : member.full_name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {member.total_points} {isRTL ? 'أثر' : 'pts'} • {member.activities_count} {isRTL ? 'مشاركة' : 'activities'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => setIsAwardDialogOpen(false)} className="w-full sm:w-auto">
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleAwardBadge} disabled={!selectedUserId || submitting} className="w-full sm:w-auto">
                            {submitting && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                            {isRTL ? 'منح الشارة' : 'Award Badge'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
