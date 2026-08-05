import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface VisibilityColumn {
  key: string;
  header: string;
  defaultVisible?: boolean;
}

export function ColumnVisibilityMenu({
  columns,
  visible,
  onChange,
}: {
  columns: VisibilityColumn[];
  visible: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
}) {
  const configurable = columns.filter((column) => column.key !== 'actions');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Choose visible columns"
        >
          <Columns3 className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {configurable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={visible[column.key] !== false}
            onCheckedChange={(checked) =>
              onChange(column.key, Boolean(checked))
            }
          >
            {column.header}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
