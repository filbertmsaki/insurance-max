import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * 44×44px icon-only button: transparent, circular hover/pressed highlight
 * (--color-surface-muted) and the design-system focus ring. Always pass an
 * aria-label.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }
>(function IconButton({ className, type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-[var(--color-text)]',
        'transition-colors duration-[120ms] hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-surface-muted)]',
        'outline-none focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:stroke-[1.9]',
        className,
      )}
      {...props}
    />
  );
});
