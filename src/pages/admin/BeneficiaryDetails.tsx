import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, Loader2, Calendar, TrendingUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

interface Beneficiary {
    id: string;
    name_ar: string;
    name_en: string;
    phone: string;
    image_url: string | null;
    current_parts: number;
    previous_parts: number;
    created_at: string;
}

interface AttendanceRecord {
    date: string;
    type: 'memorization' | 'revision';
}

interface ProgressRecord {
    date: string;
    total_parts: number;
}

export default function BeneficiaryDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isRTL } = useLanguage();
    const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [progressData, setProgressData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Beneficiary Details
            const { data: benData, error: benError } = await supabase
                .from('quran_beneficiaries')
                .select('*')
                .eq('id', id)
                .single();

            if (benError) throw benError;
            setBeneficiary(benData);

            // Fetch Attendance History
            // Joining quran_circles to get the date
            const { data: attData, error: attError } = await supabase
                .from('quran_circle_beneficiaries')
                .select(`
                    attendance_type,
                    quran_circles (
                        date
                    )
                `)
                .eq('beneficiary_id', id);

            if (attError) throw attError;

            // Process Attendance Data for Chart
            // Group by date and count types
            const attMap = new Map<string, { date: string, memorization: number, revision: number }>();

            attData?.forEach((record: any) => {
                const date = record.quran_circles?.date;
                if (!date) return;

                if (!attMap.has(date)) {
                    attMap.set(date, { date, memorization: 0, revision: 0 });
                }

                const entry = attMap.get(date)!;
                if (record.attendance_type === 'memorization') {
                    entry.memorization += 1; // Or just 1 for presence
                } else {
                    entry.revision += 1;
                }
            });

            const processedAttData = Array.from(attMap.values())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setAttendanceData(processedAttData);

            // Fetch Progress History
            const { data: progData, error: progError } = await supabase
                .from('quran_progress_history')
                .select('*')
                .eq('beneficiary_id', id)
                .order('created_at', { ascending: true });

            if (progError) throw progError;

            // Process Progress Data
            const processedProgData = progData?.map(p => ({
                date: format(new Date(p.created_at), 'yyyy-MM-dd'),
                parts: p.new_parts / 8 // Convert to Juz
            })) || [];

            // If no history but we have current parts, add a point for today (or fetch created_at)
            // The migration backfills, so we should be good.
            setProgressData(processedProgData);

        } catch (error) {
            console.error('Error fetching details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!beneficiary) {
        return <div>{isRTL ? 'لم يتم العثور على المستفيد' : 'Beneficiary not found'}</div>;
    }

    return (
        <div className="container py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    {isRTL ? <ArrowRight className="h-6 w-6" /> : <ArrowLeft className="h-6 w-6" />}
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Avatar className="h-12 w-12 border-2 border-primary">
                            <AvatarImage src={beneficiary.image_url || undefined} />
                            <AvatarFallback>{beneficiary.name_en?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {beneficiary.name_ar}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {beneficiary.name_en} • {beneficiary.phone}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Attendance Chart */}
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            {isRTL ? 'سجل الحضور' : 'Attendance History'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        {attendanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={attendanceData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(date) => format(new Date(date), 'MM/dd')}
                                    />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip
                                        labelFormatter={(label) => format(new Date(label), 'PPP', { locale: isRTL ? ar : enUS })}
                                    />
                                    <Legend />
                                    <Bar
                                        dataKey="memorization"
                                        name={isRTL ? 'حفظ' : 'Memorization'}
                                        fill="#10b981" // emerald-500
                                        radius={[4, 4, 0, 0]}
                                        stackId="a"
                                    />
                                    <Bar
                                        dataKey="revision"
                                        name={isRTL ? 'مراجعة' : 'Revision'}
                                        fill="#f59e0b" // amber-500
                                        radius={[4, 4, 0, 0]}
                                        stackId="a"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                {isRTL ? 'لا توجد بيانات حضور' : 'No attendance data'}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Progress Chart */}
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            {isRTL ? 'تقدم الحفظ' : 'Memorization Progress'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        {progressData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={progressData}>
                                    <defs>
                                        <linearGradient id="colorParts" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(date) => format(new Date(date), 'MM/dd')}
                                    />
                                    <YAxis
                                        label={{
                                            value: isRTL ? 'الأجزاء' : 'Juz',
                                            angle: -90,
                                            position: 'insideLeft'
                                        }}
                                    />
                                    <Tooltip
                                        labelFormatter={(label) => format(new Date(label), 'PPP', { locale: isRTL ? ar : enUS })}
                                        formatter={(value: number) => [value.toFixed(2), isRTL ? 'جزء' : 'Juz']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="parts"
                                        name={isRTL ? 'إجمالي الحفظ' : 'Total Memorized'}
                                        stroke="#8b5cf6"
                                        fillOpacity={1}
                                        fill="url(#colorParts)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                {isRTL ? 'لا توجد بيانات تقدم' : 'No progress data'}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
