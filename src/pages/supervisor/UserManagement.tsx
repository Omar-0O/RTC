import { useCallback, useState, useEffect } from 'react';
import { Search, User, Pencil, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/ui/level-badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { VolunteerProfilePreview } from '@/components/volunteer/VolunteerProfilePreview';
import type { Database } from '@/integrations/supabase/types';
import type { UserRole } from '@/types';

type Committee = Pick<Database['public']['Tables']['committees']['Row'], 'id' | 'name' | 'name_ar'>;
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type UserRoleRow = Pick<Database['public']['Tables']['user_roles']['Row'], 'user_id' | 'role'>;

const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
);

interface UserWithDetails {
    id: string;
    email: string;
    full_name: string | null;
    full_name_ar: string | null;
    avatar_url: string | null;
    role: UserRole;
    committee_id: string | null;
    committee_name?: string;
    total_points: number;
    level: string;
    join_date: string;
    phone: string | null;
    attended_mini_camp?: boolean;
    attended_camp?: boolean;
    last_seen_at?: string | null;
    is_active: boolean;
}

export default function SupervisorUserManagement() {
    const { t, language, isRTL } = useLanguage();
    const [users, setUsers] = useState<UserWithDetails[]>([]);
    const [committees, setCommittees] = useState<Committee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [committeeFilter, setCommitteeFilter] = useState<string>('all');
    const [viewProfileUser, setViewProfileUser] = useState<UserWithDetails | null>(null);

    // Edit State
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
    const [formName, setFormName] = useState('');
    const [formNameAr, setFormNameAr] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formRole, setFormRole] = useState<string>('volunteer');
    const [formCommitteeId, setFormCommitteeId] = useState<string>('');
    const [formLevel, setFormLevel] = useState<string>('under_follow_up');
    const [formAttendedMiniCamp, setFormAttendedMiniCamp] = useState(false);
    const [formAttendedCamp, setFormAttendedCamp] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
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

            const rolesMap = new Map((rolesData as UserRoleRow[] | null)?.map(r => [r.user_id, r.role as UserRole]) || []);
            const committeesMap = new Map(committeesData?.map(c => [c.id, language === 'ar' ? c.name_ar : c.name]) || []);

            const usersWithDetails: UserWithDetails[] = ((profilesData || []) as ProfileRow[]).map(profile => ({
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                full_name_ar: profile.full_name_ar,
                avatar_url: profile.avatar_url,
                role: rolesMap.get(profile.id) || 'volunteer',
                committee_id: profile.committee_id,
                committee_name: profile.committee_id ? committeesMap.get(profile.committee_id) : undefined,
                total_points: profile.total_points || 0,
                level: profile.level || 'under_follow_up',
                join_date: profile.created_at,
                phone: profile.phone,
                attended_mini_camp: profile.attended_mini_camp || false,
                attended_camp: profile.attended_camp || false,
                last_seen_at: profile.last_seen_at || null,
                is_active: profile.is_active !== false,
            }));

            setUsers(usersWithDetails);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error(isRTL ? 'فشل في تحميل المستخدمين' : 'Failed to load users');
        } finally {
            setIsLoading(false);
        }
    }, [isRTL, language]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setIsSubmitting(true);
        try {
            const updates: ProfileUpdate = {
                full_name: formName,
                full_name_ar: formNameAr,
                phone: formPhone,
                committee_id: formCommitteeId || null,
                level: formLevel,
                updated_at: new Date().toISOString(),
            };

            // Only update attendance if applicable
            if (formLevel === 'under_follow_up') {
                updates.attended_mini_camp = formAttendedMiniCamp;
            } else if (formLevel === 'project_responsible') {
                updates.attended_camp = formAttendedCamp;
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', selectedUser.id);

            if (profileError) throw profileError;

            // Note: Supervisors cannot change user ROLES (app_role), only admin/HR generally.
            // Keeping role update disabled or restricted for now as per usual hierarchy.
            // Assuming supervisors just edit profile details (committee, level, name, phone).

            toast.success(language === 'ar' ? 'تم تحديث البيانات بنجاح' : 'User updated successfully');
            setIsEditDialogOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error updating user:', error);
            toast.error(getErrorMessage(error, language === 'ar' ? 'فشل تحديث المستخدم' : 'Failed to update user'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async (user: UserWithDetails) => {
        const newStatus = !user.is_active;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: newStatus })
                .eq('id', user.id);
            if (error) throw error;
            toast.success(
                newStatus
                    ? (language === 'ar' ? `✅ تم تفعيل ${user.full_name}` : `✅ ${user.full_name} activated`)
                    : (language === 'ar' ? `🚫 تم تعطيل ${user.full_name}` : `🚫 ${user.full_name} deactivated`)
            );
            fetchData();
        } catch (error) {
            toast.error(getErrorMessage(error, language === 'ar' ? 'فشل في تغيير الحالة' : 'Failed to change status'));
        }
    };

    const openEditDialog = (user: UserWithDetails) => {
        setSelectedUser(user);
        setFormName(user.full_name || '');
        setFormNameAr(user.full_name_ar || '');
        setFormEmail(user.email);
        setFormPhone(user.phone || '');
        setFormRole(user.role);
        setFormCommitteeId(user.committee_id || '');
        setFormLevel(user.level || 'under_follow_up');
        setFormAttendedMiniCamp(user.attended_mini_camp || false);
        setFormAttendedCamp(user.attended_camp || false);
        setIsEditDialogOpen(true);
    };

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
            case 'head_production':
            case 'head_fourth_year':
            case 'head_events':
            case 'head_caravans':
            case 'head_ethics':
            case 'head_quran':
            case 'head_marketing':
            case 'head_ashbal':
            case 'marketing_member':
                return 'bg-blue-100 text-blue-700';
            default:
                return 'bg-muted text-muted-foreground';
        }
    };

    const getRoleText = (role: string) => {
        switch (role) {
            case 'admin': return t('common.admin');
            case 'supervisor': return t('common.supervisor');
            case 'committee_leader': return t('common.committeeLeader');
            case 'head_production': return t('common.head_production');
            case 'head_fourth_year': return t('common.head_fourth_year');
            case 'head_events': return t('common.head_events');
            case 'head_caravans': return t('common.head_caravans');
            case 'head_ethics': return t('common.head_ethics');
            case 'head_quran': return t('common.head_quran');
            case 'head_marketing': return t('common.head_marketing');
            case 'head_ashbal': return t('common.head_ashbal');
            case 'marketing_member': return t('common.marketing_member');
            default: return t('common.volunteer');
        }
    };

    const getLastSeenText = (lastSeen: string | null | undefined) => {
        if (!lastSeen) return { text: language === 'ar' ? 'غير معروف' : 'Unknown', color: 'text-muted-foreground', dot: 'bg-gray-400' };
        const now = new Date();
        const seen = new Date(lastSeen);
        const diffMs = now.getTime() - seen.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 3) return { text: language === 'ar' ? 'متصل الآن' : 'Online', color: 'text-emerald-600', dot: 'bg-emerald-500' };
        if (diffMins < 60) return { text: language === 'ar' ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`, color: 'text-yellow-600', dot: 'bg-yellow-500' };
        if (diffHours < 24) return { text: language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`, color: 'text-orange-600', dot: 'bg-orange-500' };
        return { text: language === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`, color: 'text-muted-foreground', dot: 'bg-gray-400' };
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
                                <SelectItem value="head_production">{t('common.head_production')}</SelectItem>
                                <SelectItem value="head_fourth_year">{t('common.head_fourth_year')}</SelectItem>
                                <SelectItem value="head_caravans">{t('common.head_caravans')}</SelectItem>
                                <SelectItem value="head_events">{t('common.head_events')}</SelectItem>
                                <SelectItem value="head_ethics">{t('common.head_ethics')}</SelectItem>
                                <SelectItem value="head_quran">{t('common.head_quran')}</SelectItem>
                                <SelectItem value="head_marketing">{t('common.head_marketing')}</SelectItem>
                                <SelectItem value="head_ashbal">{t('common.head_ashbal')}</SelectItem>
                                <SelectItem value="marketing_member">{t('common.marketing_member')}</SelectItem>
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
                            {/* Unified Responsive Cards View */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredUsers.map((user) => (
                                    <Card key={user.id} className={`overflow-hidden transition-all hover:shadow-md ${!user.is_active ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                                        <div className="p-4 sm:p-5">
                                            {/* Header: Avatar, Name, Email, Status */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border shadow-sm">
                                                            <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                                                            <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                                                                {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {/* Online dot */}
                                                        {(() => {
                                                            const status = getLastSeenText(user.last_seen_at);
                                                            return (
                                                                <span className={`absolute bottom-0 right-0 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full border-2 border-background ${status.dot}`} />
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-bold text-base sm:text-lg truncate">{user.full_name || 'No name'}</h3>
                                                            {!user.is_active && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 shrink-0">
                                                                    {language === 'ar' ? 'معطّل' : 'Inactive'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-muted-foreground truncate" dir="ltr" style={{ textAlign: language === 'ar' ? 'right' : 'left' }}>{user.email}</p>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${getRoleBadgeClass(user.role)}`}>
                                                                {getRoleText(user.role)}
                                                            </span>
                                                            <LevelBadge level={user.level} size="sm" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-1 -mr-2 rtl:-ml-2 rtl:-mr-0 shrink-0">
                                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)} className="h-8 w-8">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setViewProfileUser(user)} className="h-8 w-8">
                                                        <User className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleToggleActive(user)}
                                                        title={user.is_active ? (language === 'ar' ? 'تعطيل المتطوع' : 'Deactivate') : (language === 'ar' ? 'تفعيل المتطوع' : 'Activate')}
                                                        className={`h-8 w-8 ${user.is_active ? 'text-orange-600 hover:text-orange-600' : 'text-emerald-600 hover:text-emerald-600'}`}
                                                    >
                                                        {user.is_active
                                                            ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                                            : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                        }
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Stats & Details grid */}
                                            <div className="bg-muted/30 rounded-xl p-3 space-y-2 text-sm border border-border/50">
                                                <div className="flex justify-between items-center py-1">
                                                    <span className="text-muted-foreground text-xs font-medium">{t('users.committee')}</span>
                                                    <span className="font-semibold text-xs text-foreground bg-background px-2 py-1 rounded-md border shadow-sm">{user.committee_name || '—'}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-1">
                                                    <span className="text-muted-foreground text-xs font-medium">{t('common.points')}</span>
                                                    <span className="font-semibold text-xs bg-primary/10 text-primary px-2 py-1 rounded-md">{user.total_points.toLocaleString() || 0}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-1">
                                                    <span className="text-muted-foreground text-xs font-medium">{language === 'ar' ? 'آخر ظهور' : 'Last Seen'}</span>
                                                    <span className="font-medium text-xs">
                                                        {(() => {
                                                            const status = getLastSeenText(user.last_seen_at);
                                                            return status.text;
                                                        })()}
                                                    </span>
                                                </div>
                                                {user.phone && (
                                                    <div className="flex justify-between items-center py-1 border-t border-border/50 pt-2 mt-1">
                                                        <span className="text-muted-foreground text-xs font-medium">{t('users.phoneNumber')}</span>
                                                        <span className="font-medium text-xs font-mono" dir="ltr">{user.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl sm:rounded-3xl border border-border/40 shadow-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader className="px-4 sm:px-6 py-5 border-b-2 border-border/50 dark:border-border/80 shrink-0 bg-muted/30 flex flex-col items-center text-center">
                        <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
                            <Pencil className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                            {language === 'ar' ? 'تعديل المستخدم' : 'Edit User'}
                        </DialogTitle>
                        <DialogDescription className="text-center mt-1.5">
                            {language === 'ar' ? 'تعديل بيانات الحساب للمتطوع' : 'Update volunteer account information'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditUser} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-name">{t('users.fullName')}</Label>
                                    <Input
                                        id="edit-name"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder={t('users.fullName')}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-name-ar">{language === 'ar' ? 'الاسم بالعربي' : 'Full Name (Arabic)'}</Label>
                                    <Input
                                        id="edit-name-ar"
                                        value={formNameAr}
                                        onChange={(e) => setFormNameAr(e.target.value)}
                                        placeholder={language === 'ar' ? 'عمر محمد' : 'Arabic Name'}
                                        dir="rtl"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-email">{t('auth.email')} *</Label>
                                    <Input
                                        id="edit-email"
                                        type="email"
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        placeholder={t('auth.email')}
                                        required
                                        disabled
                                        className="opacity-60"
                                    />
                                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'لا يمكن تعديل البريد الإلكتروني' : 'Email cannot be changed'}</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-phone">{t('users.phoneNumber')}</Label>
                                    <Input
                                        id="edit-phone"
                                        type="tel"
                                        value={formPhone}
                                        onChange={(e) => setFormPhone(e.target.value)}
                                        placeholder="+20 123 456 7890"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Role Selection Disabled for Supervisors usually, but showing as disabled */}
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-role">{t('users.role')}</Label>
                                    <Select value={formRole} onValueChange={setFormRole} disabled>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('users.role')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                                            <SelectItem value="committee_leader">{t('common.committeeLeader')}</SelectItem>
                                            <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المشرف لا يملك صلاحية تغيير الأدوار' : 'Supervisor cannot change roles'}</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-level">{t('users.level')}</Label>
                                    <Select value={formLevel} onValueChange={setFormLevel}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('users.level')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="under_follow_up">{t('level.under_follow_up')}</SelectItem>
                                            <SelectItem value="project_responsible">{t('level.project_responsible')}</SelectItem>
                                            <SelectItem value="responsible">{t('level.responsible')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-committee">{t('users.committee')}</Label>
                                <Select value={formCommitteeId || 'none'} onValueChange={(val) => setFormCommitteeId(val === 'none' ? '' : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('users.committee')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{language === 'ar' ? 'بدون لجنة' : 'No Committee'}</SelectItem>
                                        {committees.map(committee => (
                                            <SelectItem key={committee.id} value={committee.id}>
                                                {language === 'ar' ? committee.name_ar : committee.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {(formLevel === 'under_follow_up' || formLevel === 'project_responsible') && (
                                <div className="border-t pt-4 mt-4 pb-4">
                                    <h4 className="text-sm font-medium mb-4">{t('users.attendance')}</h4>
                                    <div className="grid gap-4">
                                        {formLevel === 'under_follow_up' && (
                                            <div className="flex items-center justify-between rounded-lg border p-3">
                                                <div className="space-y-0.5">
                                                    <Label htmlFor="mini-camp-attendance">{language === 'ar' ? 'حضور الميني كامب' : 'Mini Camp Attendance'}</Label>
                                                </div>
                                                <Switch
                                                    id="mini-camp-attendance"
                                                    checked={formAttendedMiniCamp}
                                                    onCheckedChange={setFormAttendedMiniCamp}
                                                />
                                            </div>
                                        )}
                                        {formLevel === 'project_responsible' && (
                                            <div className="flex items-center justify-between rounded-lg border p-3">
                                                <div className="space-y-0.5">
                                                    <Label htmlFor="camp-attendance">{language === 'ar' ? 'حضور الكامب' : 'Camp Attendance'}</Label>
                                                </div>
                                                <Switch
                                                    id="camp-attendance"
                                                    checked={formAttendedCamp}
                                                    onCheckedChange={setFormAttendedCamp}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-4 sm:px-6 py-4 border-t-2 border-border/50 dark:border-border/80 bg-muted/10 shrink-0">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto h-11 px-6 text-sm font-medium">
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto h-11 px-6 text-sm font-semibold shadow-sm">
                                {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Profile Dialog */}
            <Dialog open={!!viewProfileUser} onOpenChange={(open) => !open && setViewProfileUser(null)}>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl sm:rounded-3xl gap-0">
                    <DialogTitle className="sr-only">
                        {language === 'ar' ? 'الملف الشخصي للمتطوع' : "Volunteer Profile"}
                    </DialogTitle>
                    {viewProfileUser && <VolunteerProfilePreview userId={viewProfileUser.id} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}
