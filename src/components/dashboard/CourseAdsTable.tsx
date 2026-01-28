
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Megaphone, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface CourseAd {
    id: string;
    course_id: string;
    ad_number: number;
    ad_date: string;
    poster_done: boolean;
    content_done: boolean;
    course: {
        name: string;
    };
}

export function CourseAdsTable() {
    const { isRTL } = useLanguage();
    const [ads, setAds] = useState<CourseAd[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAds();
    }, []);

    const fetchAds = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('course_ads')
                .select(`
          id,
          course_id,
          ad_number,
          ad_date,
          poster_done,
          content_done,
          course:courses(name)
        `)
                .gte('ad_date', today) // Show upcoming ads mainly? Or all? User said "Ads I am doing". Let's show all upcoming and recent.
                // Actually "Ads I am making" usually implies future work. Let's show everything sorted by date.
                // Let's filter for relevant ones (e.g. not ancient history). Maybe last 30 days and future?
                // For now, let's just order by date desc.
                .order('ad_date', { ascending: true });

            if (error) throw error;

            // Transform data to match interface
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                course: item.course || { name: 'Unknown Course' }
            }));

            setAds(formattedData);
        } catch (error) {
            console.error('Error fetching course ads:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (ads.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Megaphone className="h-5 w-5 text-primary" />
                    {isRTL ? 'إعلانات الكورسات القادمة' : 'Upcoming Course Ads'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{isRTL ? 'الكورس' : 'Course'}</TableHead>
                                <TableHead>{isRTL ? 'رقم الإعلان' : 'Ad #'}</TableHead>
                                <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                                <TableHead>{isRTL ? 'البوستر' : 'Poster'}</TableHead>
                                <TableHead>{isRTL ? 'المحتوى' : 'Content'}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ads.map((ad) => (
                                <TableRow key={ad.id}>
                                    <TableCell className="font-medium">{ad.course.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">#{ad.ad_number}</Badge>
                                    </TableCell>
                                    <TableCell>{format(new Date(ad.ad_date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>
                                        {ad.poster_done ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {ad.content_done ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
