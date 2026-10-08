import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DataTableRefresh({
  onRefresh,
  isRefreshing,
}: {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  if (!onRefresh) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label="Refresh table"
    >
      <RefreshCw
        className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
        aria-hidden="true"
      />
      Refresh
    </Button>
  );
}
