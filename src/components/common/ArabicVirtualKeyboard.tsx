import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Delete, Space, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArabicVirtualKeyboardProps {
  value: string;
  onChange: (newValue: string) => void;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const ROW_1 = ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'];
const ROW_2 = ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'];
const ROW_3 = ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ'];
const NUMBERS = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '٠'];



export const ArabicVirtualKeyboard: React.FC<ArabicVirtualKeyboardProps> = ({
  value,
  onChange,
  isOpen,
  onClose,
  className,
}) => {
  if (!isOpen) return null;

  const handleKeyPress = (char: string) => {
    onChange(value + char);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div
      className={cn(
        'p-3 bg-card border-2 border-primary/30 rounded-2xl shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 dir-rtl text-right select-none',
        className
      )}
    >
      {/* Header & Close */}
      <div className="flex items-center justify-between border-b pb-2">
        <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          لوحة المفاتيح العربية الافتراضية
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 rounded-full hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1.5 pt-1">
        {/* Numbers */}
        <div className="flex justify-center gap-1">
          {NUMBERS.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="flex-1 h-9 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary active:scale-95 font-medium text-sm transition-all border border-border/40 shadow-sm"
            >
              {num}
            </button>
          ))}
        </div>

        {/* Row 1 */}
        <div className="flex justify-center gap-1">
          {ROW_1.map((char) => (
            <button
              key={char}
              type="button"
              onClick={() => handleKeyPress(char)}
              className="flex-1 h-10 rounded-lg bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 font-bold text-base transition-all border border-border/60 shadow-sm"
            >
              {char}
            </button>
          ))}
        </div>

        {/* Row 2 */}
        <div className="flex justify-center gap-1 px-2">
          {ROW_2.map((char) => (
            <button
              key={char}
              type="button"
              onClick={() => handleKeyPress(char)}
              className="flex-1 h-10 rounded-lg bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 font-bold text-base transition-all border border-border/60 shadow-sm"
            >
              {char}
            </button>
          ))}
        </div>

        {/* Row 3 */}
        <div className="flex justify-center gap-1 px-4">
          {ROW_3.map((char) => (
            <button
              key={char}
              type="button"
              onClick={() => handleKeyPress(char)}
              className="flex-1 h-10 rounded-lg bg-background hover:bg-primary hover:text-primary-foreground active:scale-95 font-bold text-base transition-all border border-border/60 shadow-sm"
            >
              {char}
            </button>
          ))}
        </div>

        {/* Controls Row */}
        <div className="flex gap-1.5 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="flex-1 h-10 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            مسح الكل
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSpace}
            className="flex-[3] h-10 text-xs font-semibold gap-1.5 bg-muted hover:bg-muted/80 border"
          >
            <Space className="h-4 w-4" />
            مســــافة
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBackspace}
            className="flex-1 h-10 text-xs gap-1 border-warning/40 text-warning hover:bg-warning/10"
          >
            <Delete className="h-4 w-4" />
            حذف
          </Button>
        </div>
      </div>
    </div>
  );
};
