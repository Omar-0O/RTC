import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import CommitteeLeaderDashboard from '@/pages/leader/Dashboard';

export default function QuranParticipations() {
    const { profile } = useAuth();
    const [quranCommitteeIds, setQuranCommitteeIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuranCommitteeIds = async () => {
            try {
                // Search for ALL Quran committee variations to handle duplicates/legacy data
                let { data } = await supabase
                    .from('committees')
                    .select('id')
                    .or('name.ilike.%Quran%,name.ilike.%Ahl al-Quran%,name_ar.ilike.%قرآن%,name_ar.ilike.%أهل القرآن%');

                if (data && data.length > 0) {
                    console.log('Found Quran Committee IDs:', data.map(c => c.id));
                    setQuranCommitteeIds(data.map(c => c.id));
                } else {
                    // Fallback to profile committee if search fails
                    if (profile?.committee_id) {
                        setQuranCommitteeIds([profile.committee_id]);
                    }
                }
            } catch (error) {
                console.error('Error fetching Quran committee IDs:', error);
                if (profile?.committee_id) {
                    setQuranCommitteeIds([profile.committee_id]);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchQuranCommitteeIds();
    }, [profile?.committee_id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Pass ALL fetched IDs to the dashboard to aggregate submissions
    return <CommitteeLeaderDashboard committeeIds={quranCommitteeIds} />;
}
