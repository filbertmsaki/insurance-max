import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import type { ComboboxOption } from './combobox';

export interface MultiSelectProps {
  options: readonly ComboboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}
export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  ({ options, value, onChange, name, id, placeholder = 'Select options', disabled, readOnly, required, ...aria }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const selected = value.map((item) => options.find((option) => option.value === item) ?? { value: item, label: item });
    const filtered = options.filter((option) => option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const toggle = (item: string) => onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item]);
    return <div>
      {name && value.map((item) => <input key={item} type="hidden" name={name} value={item} disabled={disabled} />)}
      <Popover open={open} onOpenChange={(next) => { if (!readOnly) setOpen(next); if (!next) setSearch(''); }}>
        <PopoverTrigger asChild>
          <button {...aria} id={id} type="button" ref={ref} role="combobox" aria-expanded={open} aria-required={required} aria-readonly={readOnly || undefined} data-readonly={readOnly || undefined} disabled={disabled} className="ui-control flex items-center justify-between text-left">
            <span className={cn('truncate', !selected.length && 'text-[var(--color-placeholder)]')}>{selected.length ? selected.map((item) => item.label).join(', ') : placeholder}</span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-label="Choose options" className="w-[var(--radix-popover-trigger-width)] rounded-[var(--radius-control)] border-[var(--color-divider)] p-1">
          <Input type="search" aria-label="Search options" placeholder="Search options" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="max-h-[280px] overflow-y-auto" role="group" aria-label="Options">
            {filtered.length === 0 && <p className="p-3 text-sm text-[var(--color-text-muted)]">No results found.</p>}
            {filtered.map((option) => <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 hover:bg-[var(--color-primary-50)]">
              <input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} className="h-[18px] w-[18px] accent-[var(--color-primary-600)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]" />
              <span>{option.label}</span>
            </label>)}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{selected.map((option) => <span key={option.value} className="inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-[var(--color-primary-50)] px-2 py-1 text-xs text-[var(--color-text)]">{option.label}{!disabled && !readOnly && <button type="button" aria-label={`Remove ${option.label}`} onClick={() => toggle(option.value)} className="rounded-[var(--radius-control)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"><X aria-hidden="true" className="h-3 w-3" /></button>}</span>)}</div>}
    </div>;
  },
);
MultiSelect.displayName = 'MultiSelect';
