import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** White card: 16px radius, 1px #E6E8EF border, 16px padding, no shadow. */
export function MobileCard({
  title,
  action,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-2xl border border-[#E6E8EF] bg-white p-4',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
          {title && (
            <h2 className="text-[15px] font-semibold leading-5 text-[#1B1F2E]">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        complete
          ? 'bg-[#E3F4EC] text-[#146C43]'
          : 'bg-[#FDEFD9] text-[#8A4B08]',
      )}
    >
      {complete ? 'Complete' : 'Details needed'}
    </span>
  );
}

/** Two-option switch (`role="radiogroup"`), full width, 44px tall. */
export function MobileSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
  helper,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  onChange?: (value: T) => void;
  helper?: ReactNode;
}) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex h-11 w-full rounded-[10px] bg-[#ECEEF5] p-1"
      >
        {options.map((option) => {
          const active = option.value === value;
          const disabled = option.disabled || (!onChange && !active);
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => !active && onChange?.(option.value)}
              className={cn(
                'mq-raw flex-1 rounded-lg text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#3B4A8C]',
                active
                  ? 'border border-[#E6E8EF] bg-white text-[#3B4A8C]'
                  : 'text-[#5B6275] disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {helper && (
        <p className="mt-2 text-[13px] leading-[18px] text-[#5B6275]">
          {helper}
        </p>
      )}
    </div>
  );
}

/** On/off switch (`role="switch"`) with a visible label. */
export function MobileSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span id={id} className="text-[15px] text-[#1B1F2E]">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className="flex h-11 w-14 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-[#3B4A8C]"
      >
        <span
          className={cn(
            'relative inline-block h-7 w-12 rounded-full transition-colors',
            checked ? 'bg-[#3B4A8C]' : 'bg-[#767D90]',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform',
              checked ? 'translate-x-[22px]' : 'translate-x-0.5',
            )}
          />
        </span>
      </button>
    </div>
  );
}

/**
 * Collapsible card with a one-line summary and status badge. `forceOpen`
 * keeps it open while it holds a validation error, so the error is visible.
 */
export function CollapsibleCard({
  title,
  summary,
  complete,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  title: string;
  summary: string;
  complete: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = open || forceOpen;
  const panelId = useId();
  return (
    <section className="rounded-2xl border border-[#E6E8EF] bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setOpen(!expanded)}
        className="mq-raw flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-[#3B4A8C]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-[#1B1F2E]">
            {title}
          </span>
          <span className="block truncate text-[13px] text-[#5B6275]">
            {summary || 'Not entered yet'}
          </span>
        </span>
        <StatusBadge complete={complete} />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-5 w-5 shrink-0 text-[#5B6275] transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      <div id={panelId} hidden={!expanded} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}

/** Label/value pair used in summary grids. */
export function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#5B6275]">{label}</dt>
      <dd className="truncate text-[15px] font-medium text-[#1B1F2E]">
        {value || '—'}
      </dd>
    </div>
  );
}
