import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, DropdownProps } from "react-day-picker";
import { ar } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const { language, isRTL } = useLanguage();
  const defaultLocale = language === "ar" ? ar : undefined;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-background rounded-md border border-border shadow-md", className)}
      locale={props.locale || defaultLocale}
      dir={props.dir || (isRTL ? "rtl" : "ltr")}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        caption: "flex justify-center pt-1.5 pb-1.5 relative items-center gap-1",
        caption_label: "text-sm font-medium",
        caption_dropdowns: "flex justify-center gap-2 z-10",
        dropdown: "relative inline-flex items-center",
        vhidden: "sr-only",
        dropdown_month: "bg-transparent text-sm font-medium focus:ring-0 border-none cursor-pointer",
        dropdown_year: "bg-transparent text-sm font-medium focus:ring-0 border-none cursor-pointer",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-muted/80 dark:bg-muted/30 text-foreground border border-border/80 rounded-md p-0 shadow-sm transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer",
        ),
        nav_button_previous: isRTL ? "absolute right-2" : "absolute left-2",
        nav_button_next: isRTL ? "absolute left-2" : "absolute right-2",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "h-9 w-9 text-center text-sm p-0 relative rounded-md overflow-hidden focus-within:relative focus-within:z-20",
          isRTL
            ? "[&:has([aria-selected].day-range-end)]:rounded-l-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-r-md last:[&:has([aria-selected])]:rounded-l-md"
            : "[&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        Dropdown: ({ value, onChange, children, className, ...dropdownProps }: DropdownProps) => {
          const options = React.Children.toArray(children) as React.ReactElement<React.HTMLProps<HTMLOptionElement>>[];
          const selected = options.find((child) => child.props.value?.toString() === value?.toString());
          const handleChange = (val: string) => {
            const changeEvent = {
              target: { value: val },
            } as React.ChangeEvent<HTMLSelectElement>;
            onChange?.(changeEvent);
          };

          const isMonths = dropdownProps.name === "months" || dropdownProps["aria-label"]?.toLowerCase().includes("month");
          const widthClass = isMonths ? "w-[92px]" : "w-[72px]";
          const contentMinWidth = isMonths ? "min-w-[130px]" : "min-w-[100px]";

          return (
            <Select
              value={value?.toString()}
              onValueChange={handleChange}
            >
              <SelectTrigger
                className={cn(
                  "h-8 py-1.5 focus:ring-0 focus:ring-offset-0 border border-border/60 bg-muted/20 hover:bg-muted px-1.5 text-xs font-semibold rounded-md cursor-pointer transition-all text-foreground justify-center gap-1",
                  widthClass,
                  className
                )}
              >
                <SelectValue>{selected?.props.children}</SelectValue>
              </SelectTrigger>
              <SelectContent className={cn("max-h-60 z-[60] overflow-y-auto", contentMinWidth)}>
                <div className="flex flex-col p-1">
                  {options.map((option) => (
                    <SelectItem
                      key={option.props.value?.toString() ?? ""}
                      value={option.props.value?.toString() ?? ""}
                      className="text-sm cursor-pointer rounded-md py-2 pl-8 pr-2.5 focus:bg-accent focus:text-accent-foreground"
                    >
                      {option.props.children}
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

// --- MonthPicker Component ---

export interface MonthPickerProps {
  /** Currently selected date (only year & month are used) */
  selected?: Date;
  /** Called when a month is clicked, with a Date set to the 1st of that month */
  onSelect?: (date: Date) => void;
  className?: string;
}

function MonthPicker({ selected, onSelect, className }: MonthPickerProps) {
  const { language, isRTL } = useLanguage();
  const locale = language === "ar" ? ar : undefined;

  const [year, setYear] = React.useState<number>(
    selected ? selected.getFullYear() : new Date().getFullYear()
  );

  const selectedMonth = selected ? selected.getMonth() : -1;
  const selectedYear = selected ? selected.getFullYear() : -1;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Build short month labels
  const months = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, i, 1);
      // "LLL" gives abbreviated month name (e.g. Jan, فبر)
      const label = new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { month: "short" }).format(d);
      return label;
    });
  }, [year, language]);

  const navBtnClass = cn(
    buttonVariants({ variant: "outline" }),
    "h-8 w-8 bg-muted/80 dark:bg-muted/30 text-foreground border border-border/80 rounded-md p-0 shadow-sm transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer",
  );

  return (
    <div
      className={cn("p-3 bg-background rounded-md border border-border shadow-md", className)}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Year navigation header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          className={navBtnClass}
          onClick={() => setYear((y) => y - 1)}
          aria-label={isRTL ? "السنة السابقة" : "Previous year"}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{year}</span>
        <button
          type="button"
          className={navBtnClass}
          onClick={() => setYear((y) => y + 1)}
          aria-label={isRTL ? "السنة التالية" : "Next year"}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 4×3 month grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {months.map((label, i) => {
          const isSelected = year === selectedYear && i === selectedMonth;
          const isToday = year === currentYear && i === currentMonth;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(new Date(year, i, 1))}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-9 w-full p-0 text-sm font-normal cursor-pointer",
                isSelected &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                !isSelected && isToday && "bg-accent text-accent-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
MonthPicker.displayName = "MonthPicker";

export { Calendar, MonthPicker };
