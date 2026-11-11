import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { containerClassName?: string }>(
  ({ className, containerClassName, children, ...props }, ref) => <div className={cn('relative', containerClassName)}>
    <select ref={ref} className={cn('ui-control appearance-none pr-9', className)} {...props}>{children}</select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
  </div>,
);
NativeSelect.displayName = 'NativeSelect';
