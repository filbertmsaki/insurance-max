import * as React from 'react';
import {
  useQuery,
  keepPreviousData,
  type QueryKey,
} from '@tanstack/react-query';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/components/data-table/hooks/useDebouncedValue';
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
import type { ComboboxOption } from '@/components/ui/combobox';

export const ASYNC_COMBOBOX_PAGE_SIZE = 20;

interface AsyncComboboxProps {
  /** Base cache key; the search term is appended. */
  queryKey: QueryKey;
  /**
   * Returns up to `limit` options matching `search`, searched on the server
   * so records beyond the first page stay reachable.
   */
  fetchOptions: (
    search: string,
    limit: number,
    signal: AbortSignal,
  ) => Promise<{ options: ComboboxOption[]; total?: number }>;
  value?: string;
  /** Label for the current value when it is not in the loaded options. */
  selectedLabel?: string;
  onValueChange: (value: string, option?: ComboboxOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Searchable select backed by a server query (debounced, cancellable). Unlike
 * `Combobox`, it never needs the full option list in memory.
 */
export function AsyncCombobox({
  queryKey,
  fetchOptions,
  value,
  selectedLabel,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No results found.',
  className,
  disabled,
  id,
  'aria-invalid': ariaInvalid,
  ref,
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const [picked, setPicked] = React.useState<ComboboxOption | null>(null);

  const query = useQuery({
    queryKey: [...queryKey, 'options', debounced],
    queryFn: ({ signal }) =>
      fetchOptions(debounced, ASYNC_COMBOBOX_PAGE_SIZE, signal),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const options = query.data?.options ?? [];
  const total = query.data?.total;

  const label =
    (value && options.find((option) => option.value === value)?.label) ||
    (value && picked?.value === value ? picked.label : undefined) ||
    (value ? selectedLabel : undefined);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          ref={ref}
          role="combobox"
          id={id}
          aria-invalid={ariaInvalid}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            selectTriggerClassName,
            'text-left',
            !label && 'text-slate-500',
            className,
          )}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] min-w-64 max-w-[calc(100vw-1rem)] flex-col p-0"
        collisionPadding={8}
      >
        {/* Filtering happens on the server; cmdk must not re-filter. */}
        <Command className="min-h-0" shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px] min-h-0">
            {query.isFetching && (
              <div
                role="status"
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500"
              >
                <Loader2 className="h-3 w-3 animate-spin" /> Searching…
              </div>
            )}
            {query.isError ? (
              <div className="px-3 py-6 text-center text-sm text-red-600">
                Could not load options.{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void query.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              !query.isFetching && <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    setPicked(option);
                    onValueChange(option.value, option);
                    setOpen(false);
                    setSearch('');
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
            {total !== undefined && total > options.length && (
              <p className="border-t px-3 py-2 text-xs text-slate-500">
                Showing {options.length} of {total}. Type to narrow the results.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
