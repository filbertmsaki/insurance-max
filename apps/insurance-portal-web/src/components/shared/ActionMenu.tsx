import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
  disabled?: boolean;
};

interface ActionMenuProps {
  items: ActionMenuItem[];
  className?: string;
  align?: 'start' | 'center' | 'end';
  contentClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function ActionMenu({
  items,
  className,
  align = 'end',
  contentClassName,
  disabled = false,
  ariaLabel = 'Open actions menu',
}: ActionMenuProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', className)}
          aria-label={ariaLabel}
          disabled={disabled}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn('w-44', contentClassName)}>
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`}>
            {item.separatorBefore && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={item.onClick}
              disabled={item.disabled}
              className={cn(
                item.destructive &&
                  'text-red-600 focus:bg-red-50 focus:text-red-600',
              )}
            >
              {item.icon ? <span className="mr-2 h-4 w-4">{item.icon}</span> : null}
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
