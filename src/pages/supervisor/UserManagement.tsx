import { useState, useEffect } from 'react';
import { Search, User } from 'lucide-react';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import Profile from '@/pages/volunteer/Profile';

interface Committee {
    id: string;
    name: string;
    name_ar: string;
}

type AppRole = 'admin' | 'supervisor' | 'volunteer' | 'committee_leader';

interface UserWithDetails {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    role: AppRole;
    committee_id: string | null;
    committee_name?: string;
    total_points: number;
    level: string;
    join_date: string;
    phone?: string;
}

export default function SupervisorUserManagement() {
    const { t, language } = useLanguage();
    const [users, setUsers] = useState<UserWithDetails[]>([]);
    const [committees, setCommittees] = useState<Committee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [committeeFilter, setCommitteeFilter] = useState<string>('all');
    const [viewProfileUser, setViewProfileUser] = useState<UserWithDetails | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: committeesData } = await supabase
                .from('committees')
                .select('id, name, name_ar')
                .order('name');

            setCommittees(committeesData || []);

            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name');

            if (profilesError) throw profilesError;

            const { data: rolesData } = await supabase
                .from('user_roles')
                .select('user_id, role');

            const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
            const committeesMap = new Map(committeesData?.map(c => [c.id, language === 'ar' ? c.name_ar : c.name]) || []);

            const usersWithDetails: UserWithDetails[] = (profilesData || []).map(profile => ({
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                role: (rolesMap.get(profile.id) as any) || 'volunteer',
                committee_id: profile.committee_id,
                committee_name: profile.committee_id ? committeesMap.get(profile.committee_id) : undefined,
                total_points: profile.total_points || 0,
                level: profile.level || 'bronze',
                join_date: profile.join_date,
                phone: profile.phone,
            }));

            setUsers(usersWithDetails);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [language]);

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesCommittee = committeeFilter === 'all' || user.committee_id === committeeFilter;
        return matchesSearch && matchesRole && matchesCommittee;
    });

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-destructive/10 text-destructive';
            case 'supervisor':
                return 'bg-primary/10 text-primary';
            case 'committee_leader':
                return 'bg-success/10 text-success';
            default:
                return 'bg-muted text-muted-foreground';
        }
    };

    const getRoleText = (role: string) => {
        switch (role) {
            case 'admin': return t('common.admin');
            case 'supervisor': return t('common.supervisor');
            case 'committee_leader': return t('common.committeeLeader');
            default: return t('common.volunteer');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('users.title')}</h1>
                <p className="text-muted-foreground">{t('users.subtitle')}</p>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('users.filters')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
                            <Input
                                placeholder={t('users.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="ltr:pl-9 rtl:pr-9"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder={t('users.filterByRole')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('users.allRoles')}</SelectItem>
                                <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                                <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                                <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                                <SelectItem value="admin">{t('common.admin')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder={t('users.filterByCommittee')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('users.allCommittees')}</SelectItem>
                                {committees.map(committee => (
                                    <SelectItem key={committee.id} value={committee.id}>
                                        {language === 'ar' ? committee.name_ar : committee.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('common.volunteers')} ({filteredUsers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredUsers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No users found
                        </p>
                    ) : (
                        <>
                            {/* Mobile View (Cards) */}
                            <div className="grid gap-4 md:hidden">
                                {filteredUsers.map((user) => (
                                    <Card key={user.id} className="overflow-hidden">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                                                        <AvatarFallback>
                                                            {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{user.full_name || 'No name'}</p>
                                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => setViewProfileUser(user)} className="-mr-2">
                                                    <User className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="mt-4 grid gap-2 text-sm">
                                                <div className="flex justify-between items-center py-1 border-b">
                                                    <span className="text-muted-foreground">{t('users.role')}</span>
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                                                        {getRoleText(user.role)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-1 border-b">
                                                    <span className="text-muted-foreground">{t('users.committee')}</span>
                                                    <span>{user.committee_name || '—'}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-1 border-b">
                                                    <span className="text-muted-foreground">{t('users.level')}</span>
                                                    <LevelBadge level={user.level} size="sm" />
                                                </div>
                                                <div className="flex justify-between items-center py-1 border-b">
                                                    <span className="text-muted-foreground">{t('common.points')}</span>
                                                    <span className="font-medium">{user.total_points.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-1">
                                                    <span className="text-muted-foreground">{t('users.joined')}</span>
                                                    <span>{new Date(user.join_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB')}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Desktop View (Table) */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-start">{t('users.fullName')}</TableHead>
                                            <TableHead className="text-start">{t('users.role')}</TableHead>
                                            <TableHead className="text-start">{t('users.committee')}</TableHead>
                                            <TableHead className="text-start">{t('users.level')}</TableHead>
                                            <TableHead className="text-start">{t('common.points')}</TableHead>
                                            <TableHead className="text-start">{t('users.joined')}</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                                                            <AvatarFallback className="text-xs">
                                                                {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{user.full_name || 'No name'}</p>
                                                            <p className="text-sm text-muted-foreground">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                                                        {getRoleText(user.role)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm">{user.committee_name || '—'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <LevelBadge level={user.level} size="sm" />
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium">{user.total_points.toLocaleString()}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">
                                                        {new Date(user.join_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB')}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => setViewProfileUser(user)}>
                                                        <User className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* View Profile Dialog */}
            <Dialog open={!!viewProfileUser} onOpenChange={(open) => !open && setViewProfileUser(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {language === 'ar' ? 'الملف الشخصي للمتطوع' : "Volunteer Profile"}
                        </DialogTitle>
                    </DialogHeader>
                    {viewProfileUser && <Profile userId={viewProfileUser.id} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}
