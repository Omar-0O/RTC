import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";

type Framework = Record<"value" | "label", string>;

interface MultiSelectProps {
    options: Framework[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Select options...",
    className,
}: MultiSelectProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState("");

    const handleUnselect = (item: string) => {
        onChange(selected.filter((i) => i !== item));
    };

    const handleSelect = (value: string) => {
        setInputValue("");
        if (selected.includes(value)) {
            handleUnselect(value);
        } else {
            onChange([...selected, value]);
        }
    };

    const selectedOptions = selected.map((s) => options.find((o) => o.value === s)).filter(Boolean) as Framework[];
    const selectables = options.filter((o) => !selected.includes(o.value));

    return (
        <Command onKeyDown={handleKeyDown} className="overflow-visible bg-transparent">
            <div
                className="group border border-input px-3 py-2 text-sm ring-offset-background rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            >
                <div className="flex gap-1 flex-wrap">
                    {selectedOptions.map((framework) => (
                        <Badge key={framework.value} variant="secondary">
                            {framework.label}
                            <button
                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleUnselect(framework.value);
                                    }
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={() => handleUnselect(framework.value)}
                            >
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </button>
                        </Badge>
                    ))}
                    <CommandPrimitive.Input
                        ref={inputRef}
                        value={inputValue}
                        onValueChange={setInputValue}
                        onBlur={() => setOpen(false)}
                        onFocus={() => setOpen(true)}
                        placeholder={placeholder}
                        className="ml-2 bg-transparent outline-none placeholder:text-muted-foreground flex-1"
                    />
                </div>
            </div>
            <div className="relative mt-2">
                {open && selectables.length > 0 ? (
                    <div className="absolute w-full z-10 top-0 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
                        <CommandList>
                            <CommandGroup className="h-full overflow-auto max-h-60">
                                {selectables.map((framework) => (
                                    <CommandItem
                                        key={framework.value}
                                        onSelect={() => {
                                            handleSelect(framework.value);
                                            inputRef.current?.focus();
                                        }}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    >
                                        {framework.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </div>
                ) : null}
            </div>
        </Command>
    );
}

const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
        (e.target as HTMLElement).blur();
    }
}
