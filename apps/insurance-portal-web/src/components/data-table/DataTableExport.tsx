import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DataTableExport as ExportOptions } from './types';

export function DataTableExport({ options }: { options?: ExportOptions }) {
  const [busy, setBusy] = useState(false);
  if (!options || (!options.onExportPage && !options.onExportAll)) return null;

  const runAll = async () => {
    setBusy(true);
    try {
      await options.onExportAll?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9" disabled={busy}>
          <Download className="mr-2 h-4 w-4" />
          {busy ? 'Exporting…' : (options.label ?? 'Export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.onExportPage && (
          <DropdownMenuItem onClick={options.onExportPage}>Current page</DropdownMenuItem>
        )}
        {options.onExportAll && (
          <DropdownMenuItem onClick={() => void runAll()}>
            All matching records
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
