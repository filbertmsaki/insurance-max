import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  MoreHorizontal,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ActionMenuItem } from '@/components/shared/ActionMenu';
import { formatMoney } from '@/components/shared/detailFormat';
import {
  compactPeriod,
  numericPeriod,
  shortMoney,
  type RecordSummary,
  type SummaryRetry,
  type SummaryTiraState,
  type SummaryTone,
  type SummaryVehicleFailure,
} from './record-summary';

/*
 * Compact summary header for quotation and policy detail pages.
 * Desktop/tablet (>=768px): a two-line page header and one facts strip.
 * Phone (<768px): a sticky 56px top bar and one summary card.
 * Both layouts render from the same `RecordSummary`.
 */

const FONT = {
  fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const PILL: Record<SummaryTone, string> = {
  success: 'bg-[#E3F4EC] text-[#146C43]',
  progress: 'bg-[#FDEFD9] text-[#8A4B08]',
  danger: 'bg-[#FDE8E8] text-[#B42318]',
  muted: 'bg-slate-100 text-slate-700',
};

export function SummaryPill({
  tone,
  children,
  size = 'md',
}: {
  tone: SummaryTone;
  children: ReactNode;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        PILL[tone],
      )}
    >
      {children}
    </span>
  );
}

const TIRA_BADGE: Record<
  SummaryTiraState,
  { label: string; tone: SummaryTone }
> = {
  success: { label: 'Success', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  pending: { label: 'Pending', tone: 'progress' },
  not_submitted: { label: 'Not submitted', tone: 'muted' },
};

function TiraBadge({ state }: { state: SummaryTiraState }) {
  const badge = TIRA_BADGE[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
        PILL[badge.tone],
      )}
    >
      {state === 'failed' && (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      )}
      {badge.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

function useCopied() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (value: string, what: string) => {
    if (!navigator.clipboard) {
      toast.error('Copying is not available in this browser');
      return;
    }
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(value);
        toast.success(`${what} copied`);
        window.setTimeout(
          () => setCopied((current) => (current === value ? null : current)),
          2000,
        );
      },
      () => toast.error(`Could not copy the ${what.toLowerCase()}`),
    );
  };
  return { copied, copy };
}

function CopyButton({
  value,
  what,
  copied,
  onCopy,
  size,
}: {
  value: string;
  what: string;
  copied: boolean;
  onCopy: () => void;
  size: 'cell' | 'row';
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={
        copied ? `${what} copied` : `Copy ${what.toLowerCase()} ${value}`
      }
      title={copied ? 'Copied' : `Copy ${what.toLowerCase()}`}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]',
        size === 'cell' ? 'h-7 w-7' : '-mr-2.5 h-11 w-11 rounded-lg',
        copied
          ? 'bg-[#E3F4EC] text-[#127A55]'
          : 'text-slate-500 hover:bg-slate-100 hover:text-[#3B4A8C]',
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function ErrorBox({
  message,
  code,
  lines = 3,
}: {
  message: string;
  code?: string | null;
  lines?: 2 | 3;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = message.length > (lines === 2 ? 90 : 120);
  return (
    <div className="rounded-xl bg-[#FEF3F2] p-3 text-[13px] text-[#B42318]">
      <p
        className={cn(
          'whitespace-pre-wrap [overflow-wrap:anywhere]',
          !expanded && (lines === 2 ? 'line-clamp-2' : 'line-clamp-3'),
        )}
      >
        {message}
      </p>
      {code && <p className="mt-1 font-semibold">Code: {code}</p>}
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="mt-1 min-h-11 font-semibold underline underline-offset-2 sm:min-h-0"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function FailedVehiclesDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SummaryVehicleFailure[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Failed vehicles</DialogTitle>
        </DialogHeader>
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="space-y-1.5">
              <p className="text-[14px] font-semibold">{item.name}</p>
              <ErrorBox message={item.message} code={item.code} />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function RetryButton({
  retry,
  compact,
}: {
  retry: SummaryRetry;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={retry.pending}
      onClick={retry.onClick}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#3B4A8C] bg-white font-semibold text-[#3B4A8C] hover:bg-[#3B4A8C]/5 disabled:opacity-60',
        compact ? 'h-8 px-3 text-[13px]' : 'h-11 w-full rounded-xl text-[14px]',
      )}
    >
      <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
      {retry.pending ? 'Retrying…' : retry.label}
    </button>
  );
}

function Notice({
  notice,
  compact,
}: {
  notice: NonNullable<RecordSummary['notice']>;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl px-3 py-2',
        PILL[notice.tone],
      )}
    >
      <p className="text-[13px] font-semibold">{notice.text}</p>
      {notice.action && (
        <button
          type="button"
          disabled={notice.action.pending}
          onClick={notice.action.onClick}
          className={cn(
            'shrink-0 rounded-lg bg-[#3B4A8C] px-3 font-semibold text-white disabled:opacity-60',
            compact ? 'h-8 text-[13px]' : 'h-11 text-[14px]',
          )}
        >
          {notice.action.label}
        </button>
      )}
    </div>
  );
}

function FailureNote({
  failure,
  retry,
  compact,
}: {
  failure: NonNullable<RecordSummary['failure']>;
  retry?: SummaryRetry | null;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl bg-[#FEF3F2] p-3 text-[13px] text-[#B42318] sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="[overflow-wrap:anywhere]">
        <span className="font-semibold">{failure.label} failed.</span>{' '}
        {failure.error}
      </p>
      {retry && <RetryButton retry={retry} compact={compact} />}
    </div>
  );
}

interface RecordSummaryHeaderProps {
  summary: RecordSummary;
  onBack?: () => void;
  /** Desktop action buttons. */
  actions: ReactNode;
  /** Phone ⋯ menu entries. */
  menuItems: ActionMenuItem[];
  /** Main action shown in the phone summary card. */
  primaryAction?: ReactNode;
  /** Retry for a failed TIRA submission (or the failed step). */
  retry?: SummaryRetry | null;
  onViewVehicles?: () => void;
}

/* ------------------------------------------------------------------ */
/* Desktop / tablet                                                    */
/* ------------------------------------------------------------------ */

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 bg-white px-3.5 py-2.5', className)}>
      <dt className="text-[12px] text-slate-600">{label}</dt>
      <dd className="mt-0.5 flex min-h-7 min-w-0 items-center gap-1.5 text-[14px] font-semibold text-slate-900">
        {children}
      </dd>
    </div>
  );
}

function CellLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[12px] font-semibold text-[#3B4A8C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function CopyValue({
  value,
  what,
  copied,
  copy,
  href,
}: {
  value: string | null | undefined;
  what: string;
  copied: string | null;
  copy: (value: string, what: string) => void;
  href?: string;
}) {
  if (!value) return <span className="font-normal text-slate-500">—</span>;
  return (
    <>
      {href ? (
        <Link
          to={href}
          title={value}
          className="min-w-0 truncate text-[#3B4A8C] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
        >
          {value}
        </Link>
      ) : (
        <span className="min-w-0 truncate" title={value}>
          {value}
        </span>
      )}
      <CopyButton
        size="cell"
        value={value}
        what={what}
        copied={copied === value}
        onCopy={() => copy(value, what)}
      />
    </>
  );
}

function ReferenceValue({
  reference,
  copied,
  copy,
}: {
  reference: RecordSummary['reference'];
  copied: string | null;
  copy: (value: string, what: string) => void;
}) {
  if (reference.value === undefined)
    return <span className="font-normal text-slate-500">—</span>;
  if (!reference.value)
    return (
      <span className="font-normal text-slate-600">{reference.emptyText}</span>
    );
  return (
    <CopyValue
      value={reference.value}
      what={reference.label}
      copied={copied}
      copy={copy}
      href={reference.href}
    />
  );
}

function DesktopHeader({
  summary,
  onBack,
  actions,
  retry,
  onViewVehicles,
}: Omit<RecordSummaryHeaderProps, 'menuItems' | 'primaryAction'>) {
  const s = summary;
  const { copied, copy } = useCopied();
  const [failedOpen, setFailedOpen] = useState(false);
  const fleet = s.tira.fleet ?? null;
  const period = numericPeriod(s.period.start, s.period.end);
  const premium = formatMoney(s.premium, s.currency);

  // Cells 5 and 6 depend on the TIRA outcome and the line.
  let tail: ReactNode;
  if (s.tira.state === 'failed') {
    tail = (
      <div className="col-span-2 flex min-w-0 items-center gap-2 bg-white px-3.5 py-2.5">
        <div
          role="alert"
          className="min-w-0 flex-1 rounded-lg bg-[#FEF3F2] px-3 py-1.5 text-[#B42318]"
        >
          <p className="text-[12px] font-semibold">
            {fleet
              ? `${fleet.failed.length} of ${fleet.total} vehicles failed`
              : `Submission failed${s.tira.code ? ` · Code ${s.tira.code}` : ''}`}
          </p>
          {fleet ? (
            fleet.failed.length > 0 && (
              <button
                type="button"
                onClick={() => setFailedOpen(true)}
                className="text-[12px] font-semibold underline underline-offset-2"
              >
                View failed vehicles
              </button>
            )
          ) : (
            <p
              className="line-clamp-2 text-[12px] [overflow-wrap:anywhere]"
              title={s.tira.error ?? undefined}
            >
              {s.tira.error || 'TIRA did not accept the submission.'}
            </p>
          )}
        </div>
        {retry && <RetryButton retry={retry} compact />}
      </div>
    );
  } else if (s.tira.state === 'pending') {
    tail = (
      <div className="col-span-2 flex items-center bg-white px-3.5 py-2.5 text-[13px] text-slate-600">
        Waiting for TIRA response
      </div>
    );
  } else if (fleet) {
    tail = (
      <>
        <Cell label="Stickers / cover notes">
          <span className="truncate">
            {fleet.issued} of {fleet.total} issued
          </span>
          <CellLink onClick={onViewVehicles}>Per vehicle</CellLink>
        </Cell>
        <Cell label="Vehicles">
          <span className="truncate">
            {fleet.total} {fleet.total === 1 ? 'vehicle' : 'vehicles'}
          </span>
          <CellLink onClick={onViewVehicles}>View fleet list</CellLink>
        </Cell>
      </>
    );
  } else {
    tail = (
      <>
        <Cell label="Sticker no.">
          <CopyValue
            value={s.tira.sticker}
            what="Sticker number"
            copied={copied}
            copy={copy}
          />
        </Cell>
        <Cell label="Cover note ref.">
          <CopyValue
            value={s.tira.coverRef}
            what="Cover note reference"
            copied={copied}
            copy={copy}
          />
        </Cell>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={`Back to ${s.entity === 'policy' ? 'policies' : 'quotations'}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E6E8EF] bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              {s.breadcrumb}
            </p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <h1 className="text-[20px] font-bold leading-tight [overflow-wrap:anywhere]">
                {s.number}
              </h1>
              <SummaryPill tone={s.status.tone} size="sm">
                <span className="text-[12px]">{s.status.label}</span>
              </SummaryPill>
              <p className="min-w-0 text-[13px] text-slate-700 [overflow-wrap:anywhere]">
                {[s.customer, s.product].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      </div>

      <section
        aria-label={`${s.entity === 'policy' ? 'Policy' : 'Quotation'} summary`}
        className="overflow-hidden rounded-xl border border-[#E6E8EF] bg-white"
      >
        {(s.failure || s.notice) && (
          <div className="space-y-2 border-b border-[#E6E8EF] px-3.5 py-2.5">
            {s.failure && (
              <FailureNote failure={s.failure} retry={retry} compact />
            )}
            {s.notice && <Notice notice={s.notice} compact />}
          </div>
        )}
        {/* 1px gaps over the border colour draw the dividers in both grids. */}
        <dl className="grid grid-cols-[1fr_1fr_1.4fr] gap-px bg-[#E6E8EF] lg:grid-cols-[1fr_1.3fr_1.5fr_0.8fr_1.15fr_1.15fr]">
          <Cell label="Total premium">
            <span
              className="whitespace-nowrap text-[16px] font-bold tabular-nums"
              title={premium}
            >
              <span aria-hidden>{shortMoney(s.premium, s.currency)}</span>
              <span className="sr-only">{premium}</span>
            </span>
            {s.entity === 'policy' && s.payment && (
              <SummaryPill tone={s.payment.tone} size="sm">
                {s.payment.label}
              </SummaryPill>
            )}
          </Cell>
          <Cell label={s.period.label}>
            {period ? (
              <span className="flex min-w-0 flex-col">
                <span
                  className="flex flex-wrap gap-x-1 tabular-nums"
                  title={
                    compactPeriod(s.period.start, s.period.end) ?? undefined
                  }
                >
                  <span className="whitespace-nowrap">{period[0]} –</span>
                  <span className="whitespace-nowrap">{period[1]}</span>
                </span>
                {s.period.note && (
                  <span className="text-[11px] font-medium text-slate-600">
                    {s.period.note}
                  </span>
                )}
              </span>
            ) : (
              <span className="font-normal text-slate-500">Not set</span>
            )}
          </Cell>
          <Cell label={s.reference.label}>
            <ReferenceValue
              reference={s.reference}
              copied={copied}
              copy={copy}
            />
          </Cell>
          <Cell label="TIRA">
            <TiraBadge state={s.tira.state} />
          </Cell>
          {tail}
        </dl>
        {(s.footer.length > 0 || s.payment?.note) && (
          <p className="border-t border-[#E6E8EF] px-3.5 py-[7px] text-[12px] text-slate-600">
            {s.footer.map((fact, index) => (
              <span key={fact.label}>
                {index > 0 && <span aria-hidden> · </span>}
                {fact.label}:{' '}
                <span className="font-medium text-slate-800">{fact.value}</span>
              </span>
            ))}
            {s.payment?.note && (
              <>
                {s.footer.length > 0 && <span aria-hidden> · </span>}
                {s.payment?.note}
              </>
            )}
          </p>
        )}
        {fleet && (
          <FailedVehiclesDialog
            open={failedOpen}
            onOpenChange={setFailedOpen}
            items={fleet.failed}
          />
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */

/** One 40px label–value row. */
function Row({
  label,
  children,
  trailing,
}: {
  label: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center gap-3">
      <dt className="shrink-0 text-[13px] text-slate-600">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-end gap-1 text-[13px] font-semibold text-slate-900">
        <span className="min-w-0 truncate text-right">{children}</span>
        {trailing}
      </dd>
    </div>
  );
}

function MobileTira({
  summary,
  retry,
  onViewVehicles,
  copied,
  copy,
}: {
  summary: RecordSummary;
  retry?: SummaryRetry | null;
  onViewVehicles?: () => void;
  copied: string | null;
  copy: (value: string, what: string) => void;
}) {
  const [failedOpen, setFailedOpen] = useState(false);
  const t = summary.tira;
  const fleet = t.fleet ?? null;
  const link = (label: string, onClick?: () => void) =>
    onClick ? (
      <button
        type="button"
        onClick={onClick}
        className="-mr-1 flex min-h-11 shrink-0 items-center gap-0.5 px-1 text-[13px] font-semibold text-[#3B4A8C]"
      >
        {label}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    ) : null;
  const numberRow = (label: string, what: string, value?: string | null) =>
    value ? (
      <Row
        label={label}
        trailing={
          <CopyButton
            size="row"
            value={value}
            what={what}
            copied={copied === value}
            onCopy={() => copy(value, what)}
          />
        }
      >
        {value}
      </Row>
    ) : null;

  return (
    <div className="py-1">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <dt className="text-[13px] text-slate-600">TIRA</dt>
        <dd>
          <TiraBadge state={t.state} />
        </dd>
      </div>
      {t.state === 'success' &&
        (fleet ? (
          <div className="flex min-h-10 items-center justify-between gap-2 text-[13px]">
            <span className="min-w-0 text-slate-700">
              <span className="font-semibold text-slate-900">
                {fleet.issued} of {fleet.total}
              </span>{' '}
              stickers / cover notes issued
            </span>
            {link('View per vehicle', onViewVehicles)}
          </div>
        ) : (
          <>
            {numberRow('Sticker no.', 'Sticker number', t.sticker)}
            {numberRow('Cover note ref.', 'Cover note reference', t.coverRef)}
          </>
        ))}
      {t.state === 'failed' && (
        <div className="space-y-2 pb-1">
          {fleet ? (
            <div className="flex min-h-10 items-center justify-between gap-2 text-[13px]">
              <span className="font-semibold text-[#B42318]">
                {fleet.failed.length} of {fleet.total} failed
              </span>
              {fleet.failed.length > 0 &&
                link('View failed vehicles', () => setFailedOpen(true))}
            </div>
          ) : (
            <ErrorBox
              message={t.error || 'TIRA did not accept the submission.'}
              code={t.code}
            />
          )}
          {retry && <RetryButton retry={retry} />}
        </div>
      )}
      {t.state === 'pending' && (
        <p className="pb-2 text-[13px] text-slate-600">
          Waiting for TIRA response
        </p>
      )}
      {fleet && (
        <FailedVehiclesDialog
          open={failedOpen}
          onOpenChange={setFailedOpen}
          items={fleet.failed}
        />
      )}
    </div>
  );
}

function MobileHeader({
  summary,
  onBack,
  menuItems,
  primaryAction,
  retry,
  onViewVehicles,
}: Omit<RecordSummaryHeaderProps, 'actions'>) {
  const s = summary;
  const { copied, copy } = useCopied();
  const entityLabel = s.entity === 'policy' ? 'Policy' : 'Quotation';
  const period = compactPeriod(s.period.start, s.period.end);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-3 -mt-5 flex h-14 items-center gap-1 border-b border-[#E6E8EF] bg-white px-1.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={`Back to ${s.entity === 'policy' ? 'policies' : 'quotations'}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 active:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-[16px] font-bold leading-tight">
            {s.number}
          </h1>
          <p className="truncate text-[12px] text-slate-600">{s.typeLabel}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${entityLabel} actions`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 shadow-lg">
            {menuItems.map((item, index) => (
              <div key={`${item.label}-${index}`}>
                {item.separatorBefore && index > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={item.onClick}
                  disabled={item.disabled}
                  title={item.title}
                  className={cn(
                    'min-h-11',
                    item.destructive &&
                      'text-red-600 focus:bg-red-50 focus:text-red-600',
                  )}
                >
                  {item.label}
                </DropdownMenuItem>
              </div>
            ))}
            {s.footer.length > 0 && (
              <>
                {menuItems.length > 0 && <DropdownMenuSeparator />}
                <dl className="space-y-1 px-2 py-2 text-[12px] text-slate-600">
                  {s.footer.map((fact) => (
                    <div
                      key={fact.label}
                      className="flex justify-between gap-3"
                    >
                      <dt>{fact.label}</dt>
                      <dd className="truncate text-right font-medium text-slate-800">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <section
        aria-label={`${entityLabel} summary`}
        className="rounded-2xl border border-[#E6E8EF] bg-white p-[14px]"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-[15px] font-semibold">
            {s.customer}
          </p>
          <SummaryPill tone={s.status.tone} size="sm">
            {s.status.label}
          </SummaryPill>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-slate-600">
          {s.shortProduct}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[22px] font-bold leading-tight tabular-nums">
            {formatMoney(s.premium, s.currency)}
          </p>
          {s.payment && (
            <SummaryPill tone={s.payment.tone} size="sm">
              {s.payment.label}
            </SummaryPill>
          )}
        </div>

        <dl className="mt-3 divide-y divide-[#E6E8EF] border-t border-[#E6E8EF]">
          {/* Quotations lead with their policy; policies with their period. */}
          {s.entity === 'quotation' ? (
            <>
              <Row
                label={s.reference.mobileLabel}
                trailing={
                  s.reference.value ? (
                    <CopyButton
                      size="row"
                      value={s.reference.value}
                      what={s.reference.label}
                      copied={copied === s.reference.value}
                      onCopy={() => copy(s.reference.value!, s.reference.label)}
                    />
                  ) : undefined
                }
              >
                {s.reference.value === undefined ? (
                  <span className="font-normal text-slate-500">—</span>
                ) : s.reference.value ? (
                  s.reference.href ? (
                    <Link
                      to={s.reference.href}
                      className="text-[#3B4A8C] underline-offset-2 hover:underline"
                    >
                      {s.reference.value}
                    </Link>
                  ) : (
                    s.reference.value
                  )
                ) : (
                  <span className="font-normal text-slate-600">
                    {s.reference.emptyText}
                  </span>
                )}
              </Row>
              <Row label={s.period.mobileLabel}>
                {period ?? (
                  <span className="font-normal text-slate-600">Not set</span>
                )}
              </Row>
            </>
          ) : (
            <>
              <Row label={s.period.mobileLabel}>
                {period ?? (
                  <span className="font-normal text-slate-600">Not set</span>
                )}
              </Row>
              <Row
                label={s.reference.mobileLabel}
                trailing={
                  s.reference.value ? (
                    <CopyButton
                      size="row"
                      value={s.reference.value}
                      what={s.reference.label}
                      copied={copied === s.reference.value}
                      onCopy={() => copy(s.reference.value!, s.reference.label)}
                    />
                  ) : undefined
                }
              >
                {s.reference.value === undefined ? (
                  <span className="font-normal text-slate-500">—</span>
                ) : s.reference.value ? (
                  s.reference.href ? (
                    <Link
                      to={s.reference.href}
                      className="text-[#3B4A8C] underline-offset-2 hover:underline"
                    >
                      {s.reference.value}
                    </Link>
                  ) : (
                    s.reference.value
                  )
                ) : (
                  <span className="font-normal text-slate-600">
                    {s.reference.emptyText}
                  </span>
                )}
              </Row>
            </>
          )}
          <MobileTira
            summary={s}
            retry={retry}
            onViewVehicles={onViewVehicles}
            copied={copied}
            copy={copy}
          />
          {s.vehicles !== null && (
            <div>
              <button
                type="button"
                onClick={onViewVehicles}
                className="flex min-h-11 w-full items-center gap-3 text-left text-[13px]"
              >
                <span className="text-slate-600">Vehicles</span>
                <span className="ml-auto font-semibold">
                  {s.vehicles} {s.vehicles === 1 ? 'vehicle' : 'vehicles'}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              </button>
            </div>
          )}
        </dl>

        {s.notice && (
          <div className="mt-2">
            <Notice notice={s.notice} />
          </div>
        )}
        {s.failure && (
          <div className="mt-2">
            <FailureNote failure={s.failure} retry={retry} />
          </div>
        )}
        {primaryAction && <div className="mt-3">{primaryAction}</div>}
      </section>
    </div>
  );
}

/** Quotation / policy summary header for every screen size. */
export function RecordSummaryHeader(props: RecordSummaryHeaderProps) {
  return (
    <div style={FONT} className="text-slate-900">
      <div className="hidden md:block">
        <DesktopHeader
          summary={props.summary}
          onBack={props.onBack}
          actions={props.actions}
          retry={props.retry}
          onViewVehicles={props.onViewVehicles}
        />
      </div>
      <div className="md:hidden">
        <MobileHeader
          summary={props.summary}
          onBack={props.onBack}
          menuItems={props.menuItems}
          primaryAction={props.primaryAction}
          retry={props.retry}
          onViewVehicles={props.onViewVehicles}
        />
      </div>
    </div>
  );
}
