import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search, UserPlus, MoreHorizontal, User, Mail, Shield, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AddUserForm } from "../admin/AddUserForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LevelBadge } from "@/components/ui/level-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Profile from '@/pages/volunteer/Profile';
import { EditAshbalDialog } from "./EditAshbalDialog";

export default function AshbalManagement() {
    const { isRTL, t } = useLanguage();
    const { user, primaryRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [trimesterTarget, setTrimesterTarget] = useState(0);
    const [viewProfileUser, setViewProfileUser] = useState<any | null>(null);
    const [editUser, setEditUser] = useState<any | null>(null);

    const fetchAshbalUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('is_ashbal', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);

            calculateTarget(data || []);
        } catch (error) {
            console.error('Error fetching ashbal users:', error);
            toast.error(isRTL ? "حدث خطأ أثناء تحميل البيانات" : "Error loading data");
        } finally {
            setLoading(false);
        }
    };

    const calculateTarget = (ashbalUsers: any[]) => {
        // Current Trimester Logic
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-11
        // Trimester 1: 0,1,2,3 (Jan-Apr)
        // Trimester 2: 4,5,6,7 (May-Aug)
        // Trimester 3: 8,9,10,11 (Sep-Dec)

        let startMonth, endMonth;
        if (currentMonth <= 3) { startMonth = 0; endMonth = 3; }
        else if (currentMonth <= 7) { startMonth = 4; endMonth = 7; }
        else { startMonth = 8; endMonth = 11; }

        const currentYear = now.getFullYear();

        const count = ashbalUsers.filter(u => {
            const joinDate = new Date(u.created_at);
            return joinDate.getFullYear() === currentYear &&
                joinDate.getMonth() >= startMonth &&
                joinDate.getMonth() <= endMonth;
        }).length;

        setTrimesterTarget(count);
    };

    useEffect(() => {
        fetchAshbalUsers();
    }, []);

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone?.includes(searchQuery)
    );

    return (
        <div className="space-y-6 animate-slide-up p-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isRTL ? "إدارة الأشبال" : "Ashbal Management"}
                    </h1>
                </div>

                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <UserPlus className="h-4 w-4" />
                            {isRTL ? "إضافة شبل" : "Add Ashbal"}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <AddUserForm
                            onSuccess={() => {
                                setIsAddUserOpen(false);
                                fetchAshbalUsers();
                            }}
                            defaultIsAshbal={true}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* Target Section */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium">
                        {isRTL ? "تارجت الثلث السنوي" : "Trimester Target (Add Ashbal)"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>{trimesterTarget} / 10</span>
                            <span className="text-muted-foreground">
                                {Math.min(100, (trimesterTarget / 10) * 100).toFixed(0)}%
                            </span>
                        </div>
                        <Progress value={(trimesterTarget / 10) * 100} className="h-2" />
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={isRTL ? "بحث بالاسم أو الهاتف..." : "Search by name or phone..."}
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-md border bg-card">
                 {/* Desktop View */}
                 <div className="hidden lg:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-start">{isRTL ? "الاسم" : "Name"}</TableHead>
                                <TableHead className="text-start">{isRTL ? "الهاتف" : "Phone"}</TableHead>
                                <TableHead className="text-start">{isRTL ? "المستوى" : "Level"}</TableHead>
                                <TableHead className="text-start">{isRTL ? "تاريخ الانضمام" : "Join Date"}</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        {isRTL ? "لا يوجد أشبال" : "No Ashbal found"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                                                    <AvatarFallback className="text-xs">
                                                        {user.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{user.full_name || 'No name'}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{user.phone}</TableCell>
                                        <TableCell>
                                             <LevelBadge level={user.level} size="sm" />
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(user.join_date || user.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB')}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {['admin', 'head_ashbal'].includes(primaryRole) && (
                                                        <DropdownMenuItem onClick={() => setEditUser(user)}>
                                                            <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                            {t('common.edit')}
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => setViewProfileUser(user)}>
                                                        <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                        {t('users.viewProfile')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            if (user.phone) {
                                                                window.open(`https://wa.me/${user.phone.replace(/\D/g, '')}`, '_blank');
                                                            } else {
                                                                toast.error(isRTL ? 'لا يوجد رقم هاتف لهذا المستخدم' : 'No phone number for this user');
                                                            }
                                                        }}
                                                    >
                                                        <Mail className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                        {t('users.sendWhatsapp')}
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

                {/* Mobile View */}
                <div className="grid gap-4 lg:hidden p-4">
                    {loading ? (
                         <div className="text-center py-8">
                             <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                         </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                             {isRTL ? "لا يوجد أشبال" : "No Ashbal found"}
                        </div>
                    ) : (
                        filteredUsers.map((user) => (
                            <Card key={user.id}>
                                <CardContent className="p-4">
                                    {/* Header with avatar and actions */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <Avatar className="h-12 w-12 shrink-0">
                                                <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
                                                <AvatarFallback className="text-sm">
                                                    {user.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold truncate">{user.full_name || 'No name'}</p>
                                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 -mr-2 rtl:-ml-2">
                                                    <MoreHorizontal className="h-5 w-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {['admin', 'head_ashbal'].includes(primaryRole) && (
                                                    <DropdownMenuItem onClick={() => setEditUser(user)}>
                                                        <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                        {t('common.edit')}
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => setViewProfileUser(user)}>
                                                    <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                    {t('users.viewProfile')}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        if (user.phone) {
                                                            window.open(`https://wa.me/${user.phone.replace(/\D/g, '')}`, '_blank');
                                                        } else {
                                                            toast.error(isRTL ? 'لا يوجد رقم هاتف لهذا المستخدم' : 'No phone number for this user');
                                                        }
                                                    }}
                                                >
                                                    <Mail className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                                    {t('users.sendWhatsapp')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <LevelBadge level={user.level} size="sm" />
                                    </div>

                                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 pt-3 border-t text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-0.5">{t('users.joined')}</p>
                                            <p>{new Date(user.join_date || user.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB')}</p>
                                        </div>
                                        {user.phone && (
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">{t('users.phoneNumber')}</p>
                                                <p dir="ltr" className={isRTL ? "text-right" : "text-left"}>{user.phone}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* View Profile Dialog */}
            <Dialog open={!!viewProfileUser} onOpenChange={(open) => !open && setViewProfileUser(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {isRTL ? 'الملف الشخصي للمتطوع' : "Volunteer Profile"}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL ? 'عرض تفاصيل الملف الشخصي' : "View profile details"}
                        </DialogDescription>
                    </DialogHeader>
                    {viewProfileUser && <Profile userId={viewProfileUser.id} />}
                </DialogContent>
            </Dialog>

            <EditAshbalDialog
                open={!!editUser}
                user={editUser}
                onOpenChange={(open) => !open && setEditUser(null)}
                onSuccess={() => {
                    fetchAshbalUsers();
                    setEditUser(null);
                }}
            />
        </div>
    );
}
