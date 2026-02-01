import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuranSurah, SurahStatus, SURAH_STATUS_COLORS } from '@/data/quranSurahs';
import { useLanguage } from '@/contexts/LanguageContext';
import { Check, Clock, BookOpen, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SurahProgress {
    surah_number: number;
    status: SurahStatus;
    from_ayah: number;
    to_ayah: number | null;
    notes: string | null;
}

interface SurahEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    surah: QuranSurah;
    progress: SurahProgress | null;
    onSave: (progress: Omit<SurahProgress, 'surah_number'>) => void;
    isSaving?: boolean;
}

export function SurahEditModal({
    open,
    onOpenChange,
    surah,
    progress,
    onSave,
    isSaving = false
}: SurahEditModalProps) {
    const { isRTL } = useLanguage();

    const [status, setStatus] = useState<SurahStatus>(progress?.status || 'not_started');
    const [fromAyah, setFromAyah] = useState<number>(progress?.from_ayah || 1);
    const [toAyah, setToAyah] = useState<number>(progress?.to_ayah || surah.ayah_count);
    const [notes, setNotes] = useState<string>(progress?.notes || '');

    const handleSave = () => {
        onSave({
            status,
            from_ayah: status === 'in_progress' ? fromAyah : 1,
            to_ayah: status === 'in_progress' ? toAyah : (status === 'completed' || status === 'revision' ? surah.ayah_count : null),
            notes: notes.trim() || null,
        });
    };

    const statusOptions: { value: SurahStatus; label: string; labelAr: string; icon: React.ReactNode }[] = [
        { value: 'not_started', label: 'Not Started', labelAr: 'لم يبدأ', icon: <BookOpen className="h-4 w-4" /> },
        { value: 'in_progress', label: 'In Progress', labelAr: 'جاري الحفظ', icon: <Clock className="h-4 w-4" /> },
        { value: 'completed', label: 'Completed', labelAr: 'مكتمل', icon: <Check className="h-4 w-4" /> },
        { value: 'revision', label: 'In Revision', labelAr: 'مراجعة', icon: <RotateCcw className="h-4 w-4" /> },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                            {surah.number}
                        </span>
                        <div>
                            <span className="text-xl font-bold">{surah.name_ar}</span>
                            <span className="text-sm text-muted-foreground block">{surah.name_en} • {surah.ayah_count} {isRTL ? 'آية' : 'Ayahs'}</span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Status Selection */}
                    <div className="space-y-3">
                        <Label>{isRTL ? 'الحالة' : 'Status'}</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {statusOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setStatus(option.value)}
                                    className={cn(
                                        "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium",
                                        status === option.value
                                            ? SURAH_STATUS_COLORS[option.value] + " border-current"
                                            : "bg-background border-border hover:border-primary/30"
                                    )}
                                >
                                    {option.icon}
                                    {isRTL ? option.labelAr : option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ayah Range (only for in_progress) */}
                    {status === 'in_progress' && (
                        <div className="space-y-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <Label className="text-amber-700 dark:text-amber-400 font-medium">
                                {isRTL ? 'نطاق الآيات المحفوظة' : 'Memorized Ayah Range'}
                            </Label>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground mb-1 block">{isRTL ? 'من آية' : 'From'}</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={surah.ayah_count}
                                        value={fromAyah}
                                        onChange={(e) => setFromAyah(Math.max(1, Math.min(parseInt(e.target.value) || 1, surah.ayah_count)))}
                                        className="bg-white dark:bg-black"
                                    />
                                </div>
                                <div className="text-muted-foreground pt-5">→</div>
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground mb-1 block">{isRTL ? 'إلى آية' : 'To'}</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={surah.ayah_count}
                                        value={toAyah}
                                        onChange={(e) => setToAyah(Math.max(fromAyah, Math.min(parseInt(e.target.value) || surah.ayah_count, surah.ayah_count)))}
                                        className="bg-white dark:bg-black"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                {isRTL ? `${toAyah - fromAyah + 1} من ${surah.ayah_count} آية` : `${toAyah - fromAyah + 1} of ${surah.ayah_count} ayahs`}
                            </p>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={isRTL ? 'ملاحظات إضافية...' : 'Additional notes...'}
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
