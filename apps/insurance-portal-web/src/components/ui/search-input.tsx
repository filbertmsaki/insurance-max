import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input, type InputProps } from './input';
import { cn } from '@/lib/utils';

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, disabled, ...props }, ref) => (
    <div className="relative min-w-0">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
      <Input {...props} ref={ref} type="search" value={value} disabled={disabled} className={cn('pl-9 pr-9', onClear && 'ui-search-with-clear', className)} />
      {value && onClear && !disabled && <button type="button" aria-label="Clear search" onClick={onClear} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"><X aria-hidden="true" className="h-4 w-4" /></button>}
    </div>
  ),
);
SearchInput.displayName = 'SearchInput';
