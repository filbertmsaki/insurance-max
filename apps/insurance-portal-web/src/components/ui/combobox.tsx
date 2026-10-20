import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { selectTriggerClassName } from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ReadonlyArray<ComboboxOption>;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  onSearchChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  /** Forwarded to the trigger so forms can focus it (e.g. on a validation error). */
  ref?: React.Ref<HTMLButtonElement>;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  loading = false,
  onSearchChange,
  className,
  disabled,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  ref,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          ref={ref}
          role="combobox"
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-required={ariaRequired}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            selectTriggerClassName,
            'text-left',
            !selected && 'text-slate-500',
            className,
          )}
        >
          <span>{selected ? selected.label : placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      {/* Cap the popover at the space Radix measures between the trigger and
          the viewport edge, so near the bottom of the screen the list scrolls
          (and the search box stays visible) instead of running off-screen. */}
      <PopoverContent
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1rem)] flex-col p-0"
        collisionPadding={8}
      >
        <Command shouldFilter={!onSearchChange} className="min-h-0">
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={onSearchChange}
          />
          <CommandList className="max-h-[300px] min-h-0">
            <CommandEmpty>
              {loading ? 'Loading options…' : emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      option.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
