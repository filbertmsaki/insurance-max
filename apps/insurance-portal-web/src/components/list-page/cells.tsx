import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  Hourglass,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TONE_CLASS, TONE_TEXT, type PaymentState, type Tone } from './tones';
import {
  coverHint,
  formatDate,
  formatFullDate,
  formatTime,
  toIsoDate,
  type DateInput,
  type TiraState,
} from './format';

/*
 * Cells and badges shared by every Underwriting list. Badges always pair an
 * icon with text (never colour alone); every colour pair meets 4.5:1.
 */

const TONE_ICON: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock,
  danger: AlertTriangle,
  neutral: Circle,
  info: Info,
};

/** Pill badge with an icon and text. */
export function ToneBadge({
  tone,
  children,
  icon,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  /** Defaults to the tone's icon; pass null for text-only type badges. */
  icon?: LucideIcon | null;
  className?: string;
}) {
  const Icon = icon === undefined ? TONE_ICON[tone] : icon;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold leading-5',
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export type RecordKind = 'single' | 'fleet' | 'non_motor';

const KIND_LABEL: Record<RecordKind, string> = {
  single: 'Single',
  fleet: 'Fleet',
  non_motor: 'Non-motor',
};

/** Single / Fleet / Non-motor type badge. */
export function TypeBadge({ kind }: { kind: RecordKind }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4',
        kind === 'fleet'
          ? 'bg-[#E6ECFA] text-[#2A3D80]'
          : 'bg-[#EEF0F4] text-[#4A5165]',
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

/** A date as DD/MM/YY in a `<time>` element, full date in the tooltip. */
export function DateText({
  value,
  className,
}: {
  value: DateInput;
  className?: string;
}) {
  const iso = toIsoDate(value);
  if (!iso) return <span className={className}>—</span>;
  return (
    <time
      dateTime={iso}
      title={formatFullDate(value)}
      className={cn('tabular-nums', className)}
    >
      {formatDate(value)}
    </time>
  );
}

/** Date issued: DD/MM/YY with HH:mm below. */
export function DateCell({ value }: { value: DateInput }) {
  const time = formatTime(value);
  return (
    <div className="min-w-0 leading-5">
      <DateText value={value} className="block font-semibold text-[#1B1F2E]" />
      {time ? (
        <span className="block text-xs tabular-nums text-[#5B6275]">
          {time}
        </span>
      ) : null}
    </div>
  );
}

/** Cover period range with the coloured days-left hint below. */
export function CoverPeriodCell({
  start,
  end,
  today,
}: {
  start: DateInput;
  end: DateInput;
  today?: Date;
}) {
  const hint = coverHint(start, end, today);
  return (
    <div className="min-w-0 leading-5">
      <span
        className="block whitespace-nowrap font-semibold tabular-nums text-[#1B1F2E]"
        title={`${formatFullDate(start)} – ${formatFullDate(end)}`}
      >
        <time dateTime={toIsoDate(start)}>{formatDate(start)}</time>
        {' – '}
        <time dateTime={toIsoDate(end)}>{formatDate(end)}</time>
      </span>
      {hint ? (
        <span className={cn('block text-xs font-medium', TONE_TEXT[hint.tone])}>
          {hint.text}
        </span>
      ) : null}
    </div>
  );
}

export interface TiraInfo {
  state: TiraState;
  /** Error code and reason, shown on hover (desktop) or tap (mobile). */
  errorCode?: string | null;
  errorReason?: string | null;
}

const TIRA_BADGE: Record<
  TiraState,
  { label: string; tone: Tone; icon: LucideIcon }
> = {
  success: { label: 'Success', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', tone: 'danger', icon: AlertTriangle },
  pending: { label: 'Pending', tone: 'warning', icon: Hourglass },
  not_submitted: { label: 'Not submitted', tone: 'neutral', icon: Ban },
};

/**
 * TIRA badge. A failure opens its code and reason on hover or focus
 * (desktop) and on tap (touch); the click never reaches the row.
 */
export function TiraBadge({
  info,
  compact = false,
}: {
  info: TiraInfo;
  /** Mobile list: "TIRA" prefix. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const view = TIRA_BADGE[info.state];
  const label = compact ? `TIRA ${view.label.toLowerCase()}` : view.label;
  const badge = (
    <ToneBadge tone={view.tone} icon={view.icon}>
      {label}
    </ToneBadge>
  );
  const hasDetail =
    info.state === 'failed' && Boolean(info.errorCode || info.errorReason);

  return (
    <div className="min-w-0 leading-5">
      {hasDetail ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`TIRA failed: ${[info.errorCode, info.errorReason].filter(Boolean).join(' – ')}`}
              onClick={(event) => event.stopPropagation()}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') setOpen(true);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') setOpen(false);
              }}
              className="-m-1 inline-flex min-h-8 items-center rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] max-md:min-h-11"
            >
              {badge}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 p-3 text-sm"
            onClick={(event) => event.stopPropagation()}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <p className="font-semibold text-[#B42318]">
              TIRA submission failed
            </p>
            {info.errorCode ? (
              <p className="mt-1 text-xs text-[#5B6275]">
                Code <span className="font-mono">{info.errorCode}</span>
              </p>
            ) : null}
            {info.errorReason ? (
              <p className="mt-1 text-[#1B1F2E]">{info.errorReason}</p>
            ) : null}
          </PopoverContent>
        </Popover>
      ) : (
        badge
      )}
    </div>
  );
}

/** Two-line cell: main value 14px semibold, secondary 12px grey. */
export function TwoLineCell({
  main,
  secondary,
  className,
}: {
  main: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 leading-5', className)}>
      <span className="block truncate font-semibold text-[#1B1F2E]">
        {main}
      </span>
      {secondary ? (
        <span className="block truncate text-xs text-[#5B6275]">
          {secondary}
        </span>
      ) : null}
    </div>
  );
}

export function PaymentBadge({ state }: { state: PaymentState }) {
  if (!state) return null;
  const tone: Tone =
    state === 'paid' ? 'success' : state === 'partial' ? 'warning' : 'danger';
  return (
    <ToneBadge tone={tone} className="px-1.5 py-0 text-[11px] leading-4">
      {state.toUpperCase()}
    </ToneBadge>
  );
}
