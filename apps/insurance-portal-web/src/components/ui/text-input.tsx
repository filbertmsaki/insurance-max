import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './input';
import { cn } from '@/lib/utils';

export interface TextInputProps extends Omit<InputProps, 'prefix'> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      prefix,
      suffix,
      type = 'text',
      className,
      disabled,
      readOnly,
      style,
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false);
    const [widths, setWidths] = React.useState({ prefix: 0, suffix: 0 });
    const prefixRef = React.useRef<HTMLSpanElement>(null);
    const suffixRef = React.useRef<HTMLSpanElement>(null);
    const password = type === 'password';
    React.useLayoutEffect(() => {
      const measure = () =>
        setWidths({
          prefix: prefixRef.current?.offsetWidth ?? 0,
          suffix: suffixRef.current?.offsetWidth ?? 0,
        });
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      if (prefixRef.current) observer.observe(prefixRef.current);
      if (suffixRef.current) observer.observe(suffixRef.current);
      return () => observer.disconnect();
    }, [prefix, suffix, password]);
    return (
      <div className="relative flex min-w-0 items-center">
        {prefix && (
          <span
            ref={prefixRef}
            className="pointer-events-none absolute left-3 text-[var(--color-text-muted)]"
          >
            {prefix}
          </span>
        )}
        <Input
          {...props}
          ref={ref}
          type={password && visible ? 'text' : type}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(password && 'pr-12', className)}
          style={{
            ...style,
            ...(prefix ? { paddingInlineStart: `calc(${widths.prefix}px + 2 * var(--control-padding-x))` } : {}),
            ...(suffix && !password
              ? { paddingInlineEnd: `calc(${widths.suffix}px + 2 * var(--control-padding-x))` }
              : {}),
          }}
        />
        {password ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={visible ? 'Hide password' : 'Show password'}
            onClick={() => setVisible(!visible)}
            className="absolute right-1 flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        ) : (
          suffix && (
            <span
              ref={suffixRef}
              className="pointer-events-none absolute right-3 text-[var(--color-text-muted)]"
            >
              {suffix}
            </span>
          )
        )}
      </div>
    );
  },
);
TextInput.displayName = 'TextInput';
