import * as React from 'react';
import { Button, buttonVariants, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

export function ButtonGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)} {...props} />;
}

export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps & { 'aria-label': string }>(
  (props, ref) => <Button ref={ref} size="icon" {...props} />,
);
IconButton.displayName = 'IconButton';

type AnchorLinkButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  disabled?: boolean;
};
type ActionLinkButtonProps = ButtonProps & { href?: undefined };

export function LinkButton(props: AnchorLinkButtonProps | ActionLinkButtonProps) {
  if (props.href !== undefined) {
    const { href, className, variant, size, children, disabled, onClick, ...anchorProps } = props as AnchorLinkButtonProps;
    return <a {...anchorProps} href={disabled ? undefined : href} role={disabled ? 'link' : undefined} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : anchorProps.tabIndex} className={cn(buttonVariants({ variant, size }), disabled && 'cursor-not-allowed bg-[var(--color-disabled-bg)] text-[var(--color-disabled-text)] hover:bg-[var(--color-disabled-bg)] hover:text-[var(--color-disabled-text)]', className)} onClick={(event) => { if (disabled) { event.preventDefault(); return; } onClick?.(event); }}>{children}</a>;
  }
  return <Button {...(props as ActionLinkButtonProps)} />;
}
