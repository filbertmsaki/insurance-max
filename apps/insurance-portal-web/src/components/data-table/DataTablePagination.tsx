import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZES = [10, 20, 50, 100];

export function DataTablePagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const safePage = Math.min(Math.max(page, 1), safeTotalPages);
  const from = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const to = Math.min(safePage * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">Rows per page:</span>
        <Select
          value={String(limit)}
          onValueChange={(v) => {
            onLimitChange(Number(v));
            onPageChange(1);
          }}
        >
          <SelectTrigger className="h-8 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="text-xs">
        Showing{' '}
        <span className="font-semibold text-slate-700">
          {from}-{to}
        </span>{' '}
        of <span className="font-semibold text-slate-700">{total}</span>{' '}
        results
      </span>
      <div className="flex items-center gap-1">
        <Button
          aria-label="First page"
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className="h-8 w-8"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Previous page"
          variant="outline"
          size="icon"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-blue-600 px-2 text-xs font-semibold tabular-nums text-white">
          {safePage}
        </span>
        <span className="px-1.5 text-xs tabular-nums">
          of {safeTotalPages}
        </span>
        <Button
          aria-label="Next page"
          variant="outline"
          size="icon"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Last page"
          variant="outline"
          size="icon"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safePage >= safeTotalPages}
          className="h-8 w-8"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
