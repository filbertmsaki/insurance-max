import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { Input, type InputProps } from './input';
import { cn } from '@/lib/utils';
import { formatControlDate, parseControlDate } from './date-format';

export interface DatePickerProps extends Omit<
  InputProps,
  'value' | 'defaultValue' | 'onChange' | 'type'
> {
  value: string;
  onChange: (isoDate: string) => void;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      onBlur,
      onKeyDown,
      disabled,
      readOnly,
      name,
      className,
      min,
      max,
      'aria-invalid': ariaInvalid,
      'aria-describedby': describedBy,
      ...props
    },
    ref,
  ) => {
    const [draft, setDraft] = React.useState(() => formatControlDate(value));
    const [error, setError] = React.useState('');
    const [syncedValue, setSyncedValue] = React.useState(value);
    if (syncedValue !== value) {
      setSyncedValue(value);
      setDraft(formatControlDate(value));
      setError('');
    }
    const calendarRef = React.useRef<HTMLInputElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const errorId = React.useId();
    React.useImperativeHandle(ref, () => inputRef.current!, []);
    React.useEffect(() => {
      inputRef.current?.setCustomValidity('');
    }, [value]);
    const validate = (parsed: string | undefined) => {
      if (parsed === undefined) return 'Enter a valid date in DD/MM/YY format.';
      if (parsed && typeof min === 'string' && parsed < min) return `Enter a date on or after ${formatControlDate(min)}.`;
      if (parsed && typeof max === 'string' && parsed > max) return `Enter a date on or before ${formatControlDate(max)}.`;
      return '';
    };
    const commit = (input: HTMLInputElement) => {
      if (draft === formatControlDate(value)) return;
      const parsed = parseControlDate(draft);
      const problem = validate(parsed);
      if (problem || parsed === undefined) {
        setError(problem);
        input.setCustomValidity(problem);
      } else {
        setDraft(formatControlDate(parsed));
        onChange(parsed);
      }
    };
    return (
      <div className="relative">
        {name && (
          <input type="hidden" name={name} value={value} disabled={disabled} />
        )}
        <Input
          {...props}
          ref={inputRef}
          value={draft}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={props.placeholder ?? 'DD/MM/YY'}
          inputMode="numeric"
          aria-invalid={ariaInvalid || !!error || undefined}
          aria-describedby={
            [describedBy, error ? errorId : undefined]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={cn('pr-12', className)}
          onChange={(event) => {
            const next = event.target.value;
            const parsed = parseControlDate(next);
            const problem = validate(parsed);
            setDraft(next);
            setError('');
            event.target.setCustomValidity(problem);
          }}
          onBlur={(event) => {
            commit(event.currentTarget);
            onBlur?.(event);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(event.currentTarget);
            onKeyDown?.(event);
          }}
        />
        <input
          ref={calendarRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          min={min}
          max={max}
          disabled={disabled || readOnly}
          className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
          onChange={(event) => {
            inputRef.current?.setCustomValidity('');
            onChange(event.target.value);
          }}
        />
        <button
          type="button"
          aria-label="Open calendar"
          disabled={disabled || readOnly}
          className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed"
          onClick={() => {
            const calendar = calendarRef.current;
            if (calendar) {
              try {
                calendar.showPicker();
              } catch {
                calendar.focus();
              }
            }
          }}
        >
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
        </button>
        {error && (
          <span
            id={errorId}
            role="alert"
            className="mt-1 block text-[length:var(--helper-font-size)] text-[var(--color-danger)]"
          >
            {error}
          </span>
        )}
      </div>
    );
  },
);
DatePicker.displayName = 'DatePicker';

export interface DateRangePickerProps {
  value: { start: string; end: string };
  onChange: (value: { start: string; end: string }) => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
}
export function DateRangePicker({
  value,
  onChange,
  startLabel = 'Start date',
  endLabel = 'End date',
  disabled,
  readOnly,
  name,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-36 flex-1">
        <DatePicker
          aria-label={startLabel}
          name={name ? `${name}.start` : undefined}
          value={value.start}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(start) => onChange({ ...value, start })}
        />
      </div>
      <span aria-hidden="true">–</span>
      <div className="min-w-36 flex-1">
        <DatePicker
          aria-label={endLabel}
          name={name ? `${name}.end` : undefined}
          value={value.end}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(end) => onChange({ ...value, end })}
        />
      </div>
    </div>
  );
}
