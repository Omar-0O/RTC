import type { StructureColor } from '@/utils/activityStructureTree';

interface ColorTokens {
  /** Accent bar on top of the card */
  bar: string;
  /** Soft badge / chip */
  chip: string;
  /** Swatch used in the color picker */
  swatch: string;
  /** Soft hover glow & border highlight */
  glow: string;
  /** Avatar ring highlight on hover */
  ring: string;
  labelAr: string;
  labelEn: string;
}

/** Static class strings so Tailwind JIT can detect them. */
export const STRUCTURE_COLOR_TOKENS: Record<StructureColor, ColorTokens> = {
  primary: {
    bar: 'bg-primary',
    chip: 'bg-primary/10 text-primary',
    swatch: 'bg-primary',
    glow: 'hover:border-primary/50 hover:shadow-primary/15',
    ring: 'group-hover:ring-primary/40',
    labelAr: 'أساسي',
    labelEn: 'Primary',
  },
  blue: {
    bar: 'bg-blue-500',
    chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    swatch: 'bg-blue-500',
    glow: 'hover:border-blue-500/50 hover:shadow-blue-500/15',
    ring: 'group-hover:ring-blue-500/40',
    labelAr: 'أزرق',
    labelEn: 'Blue',
  },
  green: {
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    swatch: 'bg-emerald-500',
    glow: 'hover:border-emerald-500/50 hover:shadow-emerald-500/15',
    ring: 'group-hover:ring-emerald-500/40',
    labelAr: 'أخضر',
    labelEn: 'Green',
  },
  amber: {
    bar: 'bg-amber-500',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    swatch: 'bg-amber-500',
    glow: 'hover:border-amber-500/50 hover:shadow-amber-500/15',
    ring: 'group-hover:ring-amber-500/40',
    labelAr: 'برتقالي',
    labelEn: 'Amber',
  },
  rose: {
    bar: 'bg-rose-500',
    chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    swatch: 'bg-rose-500',
    glow: 'hover:border-rose-500/50 hover:shadow-rose-500/15',
    ring: 'group-hover:ring-rose-500/40',
    labelAr: 'وردي',
    labelEn: 'Rose',
  },
  violet: {
    bar: 'bg-violet-500',
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    swatch: 'bg-violet-500',
    glow: 'hover:border-violet-500/50 hover:shadow-violet-500/15',
    ring: 'group-hover:ring-violet-500/40',
    labelAr: 'بنفسجي',
    labelEn: 'Violet',
  },
  teal: {
    bar: 'bg-teal-500',
    chip: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    swatch: 'bg-teal-500',
    glow: 'hover:border-teal-500/50 hover:shadow-teal-500/15',
    ring: 'group-hover:ring-teal-500/40',
    labelAr: 'تركواز',
    labelEn: 'Teal',
  },
  slate: {
    bar: 'bg-slate-500',
    chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    swatch: 'bg-slate-500',
    glow: 'hover:border-slate-500/50 hover:shadow-slate-500/15',
    ring: 'group-hover:ring-slate-500/40',
    labelAr: 'رمادي',
    labelEn: 'Slate',
  },
};
