import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { LoaderCircle } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-[14px] font-semibold transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled-text)] max-md:min-h-[var(--control-height-md)]',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]',
        primary:
          'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]',
        destructive: 'bg-[var(--color-danger)] text-white hover:brightness-90',
        danger: 'bg-[var(--color-danger)] text-white hover:brightness-90',
        'danger-outline':
          'border border-[var(--color-danger)] bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]',
        outline:
          'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]',
        secondary:
          'bg-[var(--color-secondary-600)] text-white hover:bg-[var(--color-secondary-700)]',
        ghost:
          'bg-transparent text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] active:bg-[var(--color-primary-100)]',
        link: 'bg-transparent text-[var(--color-primary-600)] underline-offset-4 hover:underline',
        success:
          'bg-[var(--color-secondary-600)] text-white hover:bg-[var(--color-secondary-700)]',
        info: 'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]',
        warning: 'bg-[var(--color-warning)] text-white hover:brightness-90',
        soft: 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-100)]',
        'soft-success':
          'bg-[var(--color-success-bg)] text-[var(--color-success)]',
        'soft-danger': 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
        'soft-info': 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
        'soft-warning':
          'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
      },
      size: {
        default: 'h-[var(--control-height-md)] px-4',
        sm: 'h-[var(--control-height-sm)] px-3 text-[13px]',
        lg: 'h-[var(--control-height-lg)] px-5 text-[15px]',
        icon: 'h-[var(--control-height-md)] w-[var(--control-height-md)]',
        'icon-sm': 'h-[var(--control-height-sm)] w-[var(--control-height-sm)] max-md:min-w-[var(--control-height-md)]',
        'icon-lg': 'h-[var(--control-height-lg)] w-[var(--control-height-lg)]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref,
  ) => {
    if (asChild && (disabled || loading)) {
      const child = React.Children.only(children) as React.ReactElement<{
        onClick?: React.MouseEventHandler<HTMLElement>;
        onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
        tabIndex?: number;
        href?: string;
      }>;
      return (
        <Slot
          {...props}
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }), 'cursor-not-allowed bg-[var(--color-disabled-bg)] text-[var(--color-disabled-text)] hover:bg-[var(--color-disabled-bg)] hover:text-[var(--color-disabled-text)]')}
          aria-disabled="true"
          aria-busy={loading || undefined}
        >
          {React.cloneElement(child, {
            tabIndex: -1,
            ...(child.type === 'a' ? { href: undefined } : {}),
            onClick: (event) => { event.preventDefault(); event.stopPropagation(); },
            onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); } },
          })}
        </Slot>
      );
    }
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-disabled={disabled || loading || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              leftIcon
            )}
            {children}
            {rightIcon}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

// eslint-disable-next-line react-refresh/only-export-components -- shared variants for Radix dialog actions
export { Button, buttonVariants };
