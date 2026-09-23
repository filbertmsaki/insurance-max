import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-600/25 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white hover:bg-blue-700',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline:
          'border border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700',
        secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        link: 'text-blue-600 underline-offset-4 hover:underline',
        success: 'bg-green-500 text-white hover:bg-green-600',
        info: 'bg-sky-500 text-white hover:bg-sky-600',
        warning: 'bg-amber-500 text-white hover:bg-amber-600',
        soft: 'bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white',
        'soft-success':
          'bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white',
        'soft-danger':
          'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white',
        'soft-info':
          'bg-sky-500/10 text-sky-600 hover:bg-sky-500 hover:text-white',
        'soft-warning':
          'bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white',
      },
      size: {
        default: 'h-[38px] px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-6 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

// eslint-disable-next-line react-refresh/only-export-components -- shadcn/ui pattern: variants helper co-located with its component
export { Button, buttonVariants };
