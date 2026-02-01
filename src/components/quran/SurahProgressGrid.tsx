import { useState, useEffect } from 'react';
import { QURAN_SURAHS, QuranSurah, SurahStatus, SURAH_STATUS_COLORS } from '@/data/quranSurahs';
import { useLanguage } from '@/contexts/LanguageContext';
import { SurahEditModal } from './SurahEditModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Check, Clock, BookOpen, RotateCcw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SurahProgress {
    id?: string;
    beneficiary_id: string;
    surah_number: number;
    status: SurahStatus;
    from_ayah: number;
    to_ayah: number | null;
    notes: string | null;
}

interface SurahProgressGridProps {
    beneficiaryId: string;
    readOnly?: boolean;
}

export function SurahProgressGrid({ beneficiaryId, readOnly = false }: SurahProgressGridProps) {
    const { isRTL } = useLanguage();
    const [progressMap, setProgressMap] = useState<Map<number, SurahProgress>>(new Map());
    const [loading, setLoading] = useState(true);
    const [selectedSurah, setSelectedSurah] = useState<QuranSurah | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [viewFilter, setViewFilter] = useState<'all' | 'juz30' | 'juz29' | 'long'>('all');

    useEffect(() => {
        fetchProgress();
    }, [beneficiaryId]);

    const fetchProgress = async () => {
        try {
            const { data, error } = await supabase
                .from('beneficiary_surah_progress')
                .select('*')
                .eq('beneficiary_id', beneficiaryId);

            if (error) throw error;

            const map = new Map<number, SurahProgress>();
            (data || []).forEach(item => {
                map.set(item.surah_number, item as SurahProgress);
            });
            setProgressMap(map);
        } catch (error) {
            console.error('Error fetching surah progress:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSurahClick = (surah: QuranSurah) => {
        if (readOnly) return;
        setSelectedSurah(surah);
    };

    const handleSaveProgress = async (progress: Omit<SurahProgress, 'beneficiary_id' | 'surah_number'>) => {
        if (!selectedSurah) return;
        setIsSaving(true);

        try {
            const existingProgress = progressMap.get(selectedSurah.number);

            if (existingProgress?.id) {
                // Update existing
                const { error } = await supabase
                    .from('beneficiary_surah_progress')
                    .update({
                        status: progress.status,
                        from_ayah: progress.from_ayah,
                        to_ayah: progress.to_ayah,
                        notes: progress.notes,
                        last_updated: new Date().toISOString(),
                    })
                    .eq('id', existingProgress.id);

                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('beneficiary_surah_progress')
                    .insert({
                        beneficiary_id: beneficiaryId,
                        surah_number: selectedSurah.number,
                        status: progress.status,
                        from_ayah: progress.from_ayah,
                        to_ayah: progress.to_ayah,
                        notes: progress.notes,
                    });

                if (error) throw error;
            }

            toast.success(isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully');
            setSelectedSurah(null);
            fetchProgress();
        } catch (error) {
            console.error('Error saving progress:', error);
            toast.error(isRTL ? 'فشل الحفظ' : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusIcon = (status: SurahStatus) => {
        switch (status) {
            case 'completed': return <Check className="h-3 w-3" />;
            case 'in_progress': return <Clock className="h-3 w-3" />;
            case 'revision': return <RotateCcw className="h-3 w-3" />;
            default: return null;
        }
    };

    // Calculate stats
    const stats = {
        completed: Array.from(progressMap.values()).filter(p => p.status === 'completed').length,
        inProgress: Array.from(progressMap.values()).filter(p => p.status === 'in_progress').length,
        revision: Array.from(progressMap.values()).filter(p => p.status === 'revision').length,
        notStarted: 114 - Array.from(progressMap.values()).filter(p => p.status !== 'not_started').length,
    };

    // Filter surahs based on view
    const getFilteredSurahs = (): QuranSurah[] => {
        switch (viewFilter) {
            case 'juz30':
                return QURAN_SURAHS.filter(s => s.juz_start === 30);
            case 'juz29':
                return QURAN_SURAHS.filter(s => s.juz_start === 29);
            case 'long':
                return QURAN_SURAHS.filter(s => s.ayah_count >= 100);
            default:
                return QURAN_SURAHS;
        }
    };

    const filteredSurahs = getFilteredSurahs();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <Check className="h-5 w-5 text-emerald-600" />
                    <div>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.completed}</p>
                        <p className="text-xs text-emerald-600/80">{isRTL ? 'مكتمل' : 'Completed'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Clock className="h-5 w-5 text-amber-600" />
                    <div>
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.inProgress}</p>
                        <p className="text-xs text-amber-600/80">{isRTL ? 'جاري الحفظ' : 'In Progress'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <RotateCcw className="h-5 w-5 text-blue-600" />
                    <div>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.revision}</p>
                        <p className="text-xs text-blue-600/80">{isRTL ? 'مراجعة' : 'Revision'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <BookOpen className="h-5 w-5 text-gray-500" />
                    <div>
                        <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.notStarted}</p>
                        <p className="text-xs text-gray-500">{isRTL ? 'لم يبدأ' : 'Not Started'}</p>
                    </div>
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{isRTL ? 'سور القرآن' : 'Quran Surahs'}</h3>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Filter className="h-4 w-4" />
                            {viewFilter === 'all' ? (isRTL ? 'الكل' : 'All') :
                                viewFilter === 'juz30' ? (isRTL ? 'جزء عم' : 'Juz 30') :
                                    viewFilter === 'juz29' ? (isRTL ? 'جزء تبارك' : 'Juz 29') :
                                        (isRTL ? 'السور الطويلة' : 'Long Surahs')}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewFilter('all')}>
                            {isRTL ? 'كل السور (114)' : 'All Surahs (114)'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewFilter('juz30')}>
                            {isRTL ? 'جزء عم' : 'Juz 30 (Amma)'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewFilter('juz29')}>
                            {isRTL ? 'جزء تبارك' : 'Juz 29 (Tabarak)'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewFilter('long')}>
                            {isRTL ? 'السور الطويلة (100+ آية)' : 'Long Surahs (100+ Ayahs)'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Surah Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {filteredSurahs.map((surah) => {
                    const progress = progressMap.get(surah.number);
                    const status: SurahStatus = progress?.status || 'not_started';

                    return (
                        <button
                            key={surah.number}
                            onClick={() => handleSurahClick(surah)}
                            disabled={readOnly}
                            className={cn(
                                "relative flex flex-col items-center p-2 rounded-lg border-2 transition-all text-center",
                                "hover:scale-105 hover:shadow-md",
                                readOnly && "cursor-default hover:scale-100 hover:shadow-none",
                                SURAH_STATUS_COLORS[status]
                            )}
                        >
                            {/* Status indicator */}
                            {status !== 'not_started' && (
                                <span className="absolute -top-1 -right-1 p-1 rounded-full bg-current/20">
                                    {getStatusIcon(status)}
                                </span>
                            )}

                            {/* Surah number */}
                            <span className="text-xs font-medium opacity-60">{surah.number}</span>

                            {/* Surah name */}
                            <span className="text-sm font-bold leading-tight mt-0.5 line-clamp-1">{surah.name_ar}</span>

                            {/* Ayah progress for in_progress */}
                            {status === 'in_progress' && progress && (
                                <span className="text-[10px] opacity-70 mt-0.5">
                                    {progress.from_ayah}-{progress.to_ayah}/{surah.ayah_count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Edit Modal */}
            {selectedSurah && (
                <SurahEditModal
                    open={!!selectedSurah}
                    onOpenChange={(open) => !open && setSelectedSurah(null)}
                    surah={selectedSurah}
                    progress={progressMap.get(selectedSurah.number) || null}
                    onSave={handleSaveProgress}
                    isSaving={isSaving}
                />
            )}
        </div>
    );
}
