import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  showCount?: boolean;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      showCount = false,
      value,
      defaultValue,
      onChange,
      maxLength,
      ...props
    },
    ref,
  ) => {
    const [uncontrolledLength, setUncontrolledLength] = React.useState(
      String(defaultValue ?? '').length,
    );
    const length =
      value === undefined ? uncontrolledLength : String(value).length;
    const control = (
      <textarea
        className={cn('ui-control flex resize-y', className)}
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        onChange={(event) => {
          setUncontrolledLength(event.target.value.length);
          onChange?.(event);
        }}
        {...props}
      />
    );
    if (!showCount) return control;
    return (
      <div>
        {control}
        <div className="mt-1 text-right text-[length:var(--helper-font-size)] text-[var(--color-text-muted)]">
          {length}
          {maxLength !== undefined ? ` / ${maxLength}` : ''}
        </div>
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
export { Textarea };
