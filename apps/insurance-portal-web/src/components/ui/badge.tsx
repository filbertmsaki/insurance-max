import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold leading-4 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-blue-600 text-white',
        secondary: 'border-transparent bg-slate-100 text-slate-700',
        destructive: 'border-transparent bg-red-500 text-white',
        outline: 'border-slate-200 bg-white text-slate-600',
        success: 'border-transparent bg-green-500/10 text-green-600',
        warning: 'border-transparent bg-amber-500/15 text-amber-700',
        danger: 'border-transparent bg-red-500/10 text-red-600',
        info: 'border-transparent bg-sky-500/10 text-sky-600',
        primary: 'border-transparent bg-blue-600/10 text-blue-600',
        muted: 'border-transparent bg-slate-100 text-slate-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn/ui pattern: variants helper co-located with its component
export { Badge, badgeVariants };
