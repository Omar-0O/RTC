import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface QuranProgressProps {
    previousParts: number; // in quarters (rub')
    currentParts: number; // in quarters (rub')
    onChange?: (prev: number, curr: number) => void;
    readOnly?: boolean;
}

export const QuranProgress: React.FC<QuranProgressProps> = ({
    previousParts,
    currentParts,
    onChange,
    readOnly = false
}) => {
    const { isRTL } = useLanguage();
    const totalQuarters = 30 * 8; // 30 Juz * 8 Quarters/Juz = 240

    // Calculate completion percentage for visual bar
    // Each Juz has 8 quarters.

    const handlePartClick = (quarterIndex: number) => {
        if (readOnly || !onChange) return;

        // Logic:
        // If click is within previous range -> adjust previous
        // If click is after previous but within current -> adjust current
        // If click is after both -> extend current

        // Simplified interaction:
        // Left click sets "Total Limit" (Previous + Current).
        // Right click or modifier could set split point?
        // Let's implement a simpler 2-step click or just drag handles?
        // Given the complexity of 240 items, let's just make it a visual bar with 30 blocks (Juz)
        // and when you click a Juz, it selects up to that Juz.

        // Better: Render 30 Juz blocks.
        // Each block has 8 sub-segments? Too small.
        // Just render 30 blocks.
        // If click on Juz 5:
        //  - If it's already "Previous", do nothing?
        //  - Let's assume input is done via number inputs for precision, 
        //    and this component is strictly for VISUALIZATION in the table.
    };

    // Visualization only for now as requested "Visual bar... like a strip"
    // We will render a single progress bar with 2 colors.

    const prevPercent = Math.min(100, (previousParts / totalQuarters) * 100);
    const currPercent = Math.min(100, ((previousParts + currentParts) / totalQuarters) * 100);
    const currRelativePercent = currPercent - prevPercent;

    return (
        <div className="w-full relative h-8 bg-secondary/30 rounded-full overflow-hidden flex" title={`${previousParts} prev + ${currentParts} curr / 240`}>
            {/* Background Grid (30 Juz) */}
            <div className="absolute inset-0 flex w-full h-full opacity-20 pointer-events-none">
                {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="flex-1 border-r border-gray-400/50 last:border-0" />
                ))}
            </div>

            {/* Previous Memorization */}
            <div
                className="h-full bg-blue-500/80 transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                style={{ width: `${prevPercent}%` }}
            >
                {prevPercent > 5 && isRTL ? 'سابق' : ''}
            </div>

            {/* Current Memorization */}
            <div
                className="h-full bg-green-500/90 transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                style={{ width: `${currRelativePercent}%` }}
            >
                {currRelativePercent > 5 && isRTL ? 'حالي' : ''}
            </div>
        </div>
    );
};
