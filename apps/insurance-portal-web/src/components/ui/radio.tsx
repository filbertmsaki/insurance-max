import * as React from 'react';
import { cn } from '@/lib/utils';

export const Radio = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    {...props}
    ref={ref}
    type="radio"
    className={cn(
      'h-[18px] w-[18px] accent-[var(--color-primary-600)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed',
      className,
    )}
  />
));
Radio.displayName = 'Radio';

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}
export interface SegmentedControlProps {
  name: string;
  value: string;
  options: readonly SegmentedOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}
export function SegmentedControl({
  name,
  value,
  options,
  onChange,
  disabled,
  ...aria
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      {...aria}
      className="inline-flex flex-wrap gap-1 rounded-[var(--radius-control)] bg-[var(--color-disabled-bg)] p-1"
    >
      {options.map((option) => (
        <label key={option.value} className="relative cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span className="flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-transparent px-3 text-sm font-semibold text-[var(--color-text)] peer-checked:border-[var(--color-border)] peer-checked:bg-[var(--color-surface)] peer-focus-visible:shadow-[var(--focus-ring)] peer-disabled:cursor-not-allowed peer-disabled:text-[var(--color-disabled-text)] md:min-h-9">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
