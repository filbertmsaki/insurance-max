import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortOrder } from '@/types';
import { cn } from '@/lib/utils';

export function DataTableColumnHeader({
  label,
  columnKey,
  sortable,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  label: string;
  columnKey: string;
  sortable?: boolean;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange?: (key: string, order: SortOrder) => void;
}) {
  if (!sortable || !onSortChange) return <>{label}</>;

  const active = sortBy === columnKey;
  const nextOrder: SortOrder = active && sortOrder === 'ASC' ? 'DESC' : 'ASC';

  return (
    <button
      type="button"
      aria-label={`Sort by ${label}`}
      onClick={() => onSortChange(columnKey, nextOrder)}
      className={cn(
        'flex items-center text-left font-medium hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        active ? 'text-slate-900' : 'text-slate-500',
      )}
    >
      {label}
      {!active ? (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
      ) : sortOrder === 'ASC' ? (
        <ArrowUp className="ml-1 h-3 w-3 text-blue-600" />
      ) : (
        <ArrowDown className="ml-1 h-3 w-3 text-blue-600" />
      )}
    </button>
  );
}
