import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BadgeAward from '@/pages/leader/BadgeAward';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function QuranBadges() {
    const { profile } = useAuth();
    const [quranCommitteeId, setQuranCommitteeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuranCommitteeId = async () => {
            if (profile?.committee_id) {
                setQuranCommitteeId(profile.committee_id);
                setLoading(false);
                return;
            }

            try {
                // Try English name
                let { data } = await supabase
                    .from('committees')
                    .select('id')
                    .ilike('name', '%Quran%')
                    .maybeSingle();

                // If not found, try Arabic name
                if (!data) {
                    const { data: arData } = await supabase
                        .from('committees')
                        .select('id')
                        .ilike('name_ar', '%قرآن%')
                        .maybeSingle();
                    if (arData) data = arData;
                }

                if (data) {
                    setQuranCommitteeId(data.id);
                }
            } catch (error) {
                console.error('Error fetching Quran committee ID:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchQuranCommitteeId();
    }, [profile?.committee_id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!quranCommitteeId) {
        return <div>Error loading Quran committee.</div>;
    }

    return <BadgeAward committeeId={quranCommitteeId} />;
}
