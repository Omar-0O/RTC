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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Search, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AddUserForm } from "../admin/AddUserForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";

export default function AshbalManagement() {
    const { isRTL, t } = useLanguage();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [trimesterTarget, setTrimesterTarget] = useState(0);

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
                    <p className="text-muted-foreground mt-1">
                        {isRTL ? "إدارة ومتابعة متطوعي الأشبال" : "Manage and track Ashbal volunteers"}
                    </p>
                </div>

                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <UserPlus className="h-4 w-4" />
                            {isRTL ? "إضافة شبل" : "Add Ashbal"}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        {/* We pass isAshbal=true prop if supported, or handle handleSuccess to refetch */}
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
                        {isRTL ? "هدف الثلث سنوي (إضافة أشبال)" : "Trimester Target (Add Ashbal)"}
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
                        <p className="text-xs text-muted-foreground pt-1">
                            {isRTL
                                ? "المطلوب إضافة 10 أشبال جدد خلال الثلث الحالي من السنة."
                                : "Target: Add 10 new Ashbal volunteers this trimester."}
                        </p>
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
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{isRTL ? "الاسم" : "Name"}</TableHead>
                            <TableHead>{isRTL ? "الهاتف" : "Phone"}</TableHead>
                            <TableHead>{isRTL ? "تاريخ الانضمام" : "Join Date"}</TableHead>
                            <TableHead>{isRTL ? "المستوى" : "Level"}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    {isRTL ? "لا يوجد أشبال" : "No Ashbal found"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        {user.full_name}
                                    </TableCell>
                                    <TableCell>{user.phone}</TableCell>
                                    <TableCell>
                                        {new Date(user.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                                    </TableCell>
                                    <TableCell>
                                        {/* Simple badge or text */}
                                        {user.level}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
