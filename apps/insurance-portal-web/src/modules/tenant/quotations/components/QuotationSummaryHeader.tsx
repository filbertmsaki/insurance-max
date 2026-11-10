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
import { cn } from '@/lib/utils';
import type { ActionMenuItem } from '@/components/shared/ActionMenu';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  humanizeCode,
} from '../utils/quotationFormat';
import type {
  OverallTone,
  QuotationLifecycle,
} from '../utils/quotationLifecycle';
import type {
  PaymentStatus,
  QuotationPreviewFleetVehicle,
  QuotationPreviewRecord,
  QuotationWorkflowView,
} from '../types';

/*
 * Top-of-page summary for every quotation line (single motor, fleet,
 * non-motor). Desktop/tablet (>=768px) and phone (<768px) render different
 * markup from the same props; nothing here fetches data.
 */

const FONT = {
  fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
};

type Tone = 'success' | 'progress' | 'danger' | 'muted';

const PILL: Record<Tone, string> = {
  success: 'bg-[#E3F4EC] text-[#146C43]',
  progress: 'bg-[#FDEFD9] text-[#8A4B08]',
  danger: 'bg-red-50 text-red-800',
  muted: 'bg-slate-100 text-slate-700',
};

function Pill({
  tone,
  children,
  size = 'md',
}: {
  tone: Tone;
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

const OVERALL_TONE: Record<OverallTone, Tone> = {
  success: 'success',
  info: 'progress',
  warning: 'progress',
  danger: 'danger',
  muted: 'muted',
};

function paymentTone(status: PaymentStatus): Tone {
  if (status === 'PAID' || status === 'NOT_REQUIRED') return 'success';
  if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(status)) return 'danger';
  if (status === 'REFUNDED') return 'muted';
  return 'progress';
}

function tiraTone(status: string): Tone {
  if (status === 'SUCCESS' || status === 'ENDORSED') return 'success';
  if (status === 'FAILED' || status === 'REJECTED') return 'danger';
  if (status === 'NOT_SUBMITTED' || status === 'CANCELLED') return 'muted';
  return 'progress';
}

/** "MOTOR PRIVATE VEHICLE" -> "Motor private vehicle"; mixed case is kept. */
function sentenceCase(value: string | null | undefined) {
  if (!value) return null;
  if (value !== value.toUpperCase()) return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

/** "9 Nov – 8 Dec 2026", or with both years when they differ. */
function compactPeriod(start?: string | null, end?: string | null) {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const valid = (d: Date | null) => d && !Number.isNaN(d.getTime());
  if (!valid(s) && !valid(e)) return null;
  if (valid(s) && valid(e) && s!.getFullYear() === e!.getFullYear())
    return `${SHORT_DATE.format(s!)} – ${formatDate(end)}`;
  return `${start ? formatDate(start) : '…'} – ${end ? formatDate(end) : '…'}`;
}

const COMPACT = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * "TSh 23.6K", "TSh 1.2M", "TSh 3T": short enough to show in full in a
 * narrow cell. The exact amount stays available as the cell's title.
 */
function shortMoney(value: number | null | undefined, currency: string | null) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return formatMoney(value, currency);
  if (Math.abs(value) < 1000) return formatMoney(value, currency);
  // Reuse the configured currency prefix ("TSh") from the full format.
  const prefix = formatMoney(0, currency)
    .replace(/[\d.,\s-]+$/, '')
    .trim();
  return `${prefix ? prefix + ' ' : ''}${COMPACT.format(value)}`;
}

const NUMERIC_DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'numeric',
  year: '2-digit',
});

/** "09/11/26 – 08/12/26" */
function numericPeriod(start?: string | null, end?: string | null) {
  const fmt = (value?: string | null) => {
    if (!value) return '…';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : NUMERIC_DATE.format(date);
  };
  return start || end ? `${fmt(start)} – ${fmt(end)}` : null;
}

export interface SummaryPolicy {
  id: string;
  policy_no: string;
  href: string;
}

export interface SummaryRetry {
  label: string;
  onClick: () => void;
  pending?: boolean;
}

interface QuotationSummaryHeaderProps {
  preview: QuotationPreviewRecord;
  workflow?: QuotationWorkflowView;
  lifecycle: QuotationLifecycle;
  onBack?: () => void;
  /** Issued policies; undefined while unknown or not permitted. */
  policies?: SummaryPolicy[];
  retry?: SummaryRetry | null;
  /** Desktop action buttons (Sync, Duplicate, Edit, workflow actions). */
  actions: ReactNode;
  /** Phone ⋯ menu entries (Sync with TIRA, Duplicate, ...). */
  menuItems: ActionMenuItem[];
  /** The main workflow action, shown in the phone summary card. */
  primaryAction?: ReactNode;
  onViewVehicles?: () => void;
}

function lineInfo(preview: QuotationPreviewRecord) {
  const flow = preview.overview.quotation_flow;
  if (flow === 'MOTOR_FLEET')
    return { breadcrumb: 'Underwrite · Motor · Fleet', short: 'Fleet motor' };
  if (flow === 'NON_MOTOR')
    return { breadcrumb: 'Underwrite · Non-motor', short: 'Non-motor' };
  return {
    breadcrumb: 'Underwrite · Motor · Single motor',
    short: 'Single motor',
  };
}

function useSummaryFacts(
  preview: QuotationPreviewRecord,
  workflow?: QuotationWorkflowView,
) {
  const { overview, premium_summary, payment, cover_note } = preview;
  const fleetVehicles = preview.fleet?.vehicles ?? null;
  const category = sentenceCase(
    overview.insurance_category.name ?? overview.insurance_category.code,
  );
  const productName = sentenceCase(
    overview.product.name ?? overview.product.code,
  );
  const outstanding = payment?.outstanding_amount ?? null;
  const currency = payment?.currency ?? premium_summary.currency;
  const approvalStatus = workflow?.approval.status ?? overview.approval_status;

  const paymentNote =
    overview.payment_status === 'NOT_REQUIRED'
      ? 'No payment required'
      : outstanding && outstanding > 0
        ? `Outstanding ${formatMoney(outstanding, currency)}`
        : overview.payment_status === 'PAID'
          ? 'Paid in full'
          : null;

  const coverNotes = fleetVehicles
    ? `${fleetVehicles.filter((v) => v.tiramis?.cover_note_reference_number).length} of ${fleetVehicles.length} cover notes`
    : preview.tiramis?.cover_note_reference_number ||
      cover_note.cover_note_number ||
      null;

  return {
    customer:
      preview.policyholders
        .map((h) => h.full_name)
        .filter(Boolean)
        .join(', ') || 'Policyholder not provided',
    product:
      [category, productName].filter(Boolean).join(' · ') ||
      'Product not provided',
    shortProduct: productName || category || 'Product not provided',
    premium: formatMoney(
      premium_summary.total_premium_including_tax,
      premium_summary.currency,
    ),
    paymentLabel: humanizeCode(overview.payment_status).toUpperCase(),
    paymentTone: paymentTone(overview.payment_status),
    paymentNote,
    period: compactPeriod(
      cover_note.cover_note_start_date,
      cover_note.cover_note_end_date,
    ),
    premiumShort: shortMoney(
      premium_summary.total_premium_including_tax,
      premium_summary.currency,
    ),
    periodNumeric: numericPeriod(
      cover_note.cover_note_start_date,
      cover_note.cover_note_end_date,
    ),
    tiraLabel: humanizeCode(overview.tira_status),
    tiraTone: tiraTone(overview.tira_status),
    coverNotes,
    vehicles: fleetVehicles?.length ?? null,
    approval:
      !overview.requires_approval && approvalStatus === 'NOT_REQUIRED'
        ? 'Not required'
        : approvalStatus === 'APPROVED' && overview.approved_by?.name
          ? `Approved by ${overview.approved_by.name}`
          : humanizeCode(approvalStatus),
    created: formatDateTime(overview.created_at),
  };
}

/** TIRA failures are explained in the TIRA block; this covers the other steps. */
function nonTiraFailure(lifecycle: QuotationLifecycle) {
  return lifecycle.steps.find(
    (step) =>
      step.state === 'failed' &&
      step.key !== 'submitted' &&
      step.key !== 'cover_note',
  );
}

function FailedStepAlert({
  lifecycle,
  retry,
}: {
  lifecycle: QuotationLifecycle;
  retry?: SummaryRetry | null;
}) {
  const failed = nonTiraFailure(lifecycle);
  if (!failed) return null;
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex min-w-0 items-start gap-2 text-sm text-red-800 [overflow-wrap:anywhere]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">{failed.label} failed.</span>{' '}
          {failed.error}
        </span>
      </p>
      {retry && (
        <button
          type="button"
          disabled={retry.pending}
          onClick={retry.onClick}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60 sm:min-h-9"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden />
          {retry.label}
        </button>
      )}
    </div>
  );
}

/* ── Phone header ("v3"): top bar + one compact summary card ─────────── */

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

function MobileCopy({
  value,
  what,
  copied,
  onCopy,
}: {
  value: string;
  what: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={
        copied ? `${what} copied` : `Copy ${what.toLowerCase()} ${value}`
      }
      className="-mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
    >
      {copied ? (
        <Check className="h-4 w-4 text-[#127A55]" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

/** One 40px label–value row (phone summary card). */
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

type TiraState = 'success' | 'failed' | 'pending' | 'not_submitted';

function tiraState(status: string | null | undefined): TiraState {
  const value = (status ?? '').toUpperCase();
  if (value === 'SUCCESS' || value === 'ENDORSED') return 'success';
  if (/FAIL|REJECT|ERROR|EXHAUST/.test(value)) return 'failed';
  if (/SUBMIT|PROCESS|QUEUE|ACK|RETRY/.test(value) && value !== 'NOT_SUBMITTED')
    return 'pending';
  return 'not_submitted';
}

const TIRA_BADGE: Record<TiraState, { label: string; className: string }> = {
  success: { label: 'Success', className: 'bg-[#E3F4EC] text-[#146C43]' },
  failed: { label: 'Failed', className: 'bg-[#FDE8E8] text-[#B42318]' },
  pending: { label: 'Pending', className: 'bg-[#FDEFD9] text-[#8A4B08]' },
  not_submitted: {
    label: 'Not submitted',
    className: 'bg-slate-100 text-slate-700',
  },
};

function vehicleName(vehicle: QuotationPreviewFleetVehicle, index: number) {
  return (
    vehicle.motor_details?.registration_number ||
    vehicle.motor_details?.chassis_number ||
    `Vehicle ${vehicle.fleet_entry_number ?? index + 1}`
  );
}

function ErrorBox({
  message,
  code,
}: {
  message: string;
  code?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = message.length > 120;
  return (
    <div className="rounded-xl bg-[#FEF3F2] p-3 text-[13px] text-[#B42318]">
      <p
        className={cn(
          'whitespace-pre-wrap [overflow-wrap:anywhere]',
          !expanded && 'line-clamp-3',
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
          className="mt-1 min-h-11 font-semibold underline underline-offset-2"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function getTiraFacts(preview: QuotationPreviewRecord) {
  const state = tiraState(preview.overview.tira_status);
  const tiramis = preview.tiramis;
  const vehicles = preview.fleet?.vehicles ?? null;
  return {
    state,
    badge: TIRA_BADGE[state],
    tiramis,
    vehicles,
    failedVehicles: (vehicles ?? [])
      .map((vehicle, index) => ({ vehicle, index }))
      .filter(
        ({ vehicle }) =>
          tiraState(vehicle.tiramis?.submission_status) === 'failed' ||
          !!vehicle.tiramis?.last_submission_error,
      ),
    issuedCount: (vehicles ?? []).filter(
      (vehicle) => vehicle.tiramis?.cover_note_reference_number,
    ).length,
    error:
      tiramis?.last_submission_error ||
      tiramis?.response_status_description ||
      'TIRA did not accept the submission.',
    code:
      tiramis?.response_status_code ||
      tiramis?.acknowledgement_status_code ||
      null,
  };
}

function TiraBadge({ state }: { state: TiraState }) {
  const badge = TIRA_BADGE[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
        badge.className,
      )}
    >
      {state === 'failed' && (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      )}
      {badge.label}
    </span>
  );
}

function FailedVehiclesDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Array<{ vehicle: QuotationPreviewFleetVehicle; index: number }>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Failed vehicles</DialogTitle>
        </DialogHeader>
        <ul className="space-y-3">
          {items.map(({ vehicle, index }) => (
            <li key={index} className="space-y-1.5">
              <p className="text-[14px] font-semibold">
                {vehicleName(vehicle, index)}
              </p>
              <ErrorBox
                message={
                  vehicle.tiramis?.last_submission_error ||
                  vehicle.tiramis?.response_status_description ||
                  'No reason was returned.'
                }
                code={vehicle.tiramis?.response_status_code}
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function MobileTiraBlock({
  preview,
  retry,
  onViewVehicles,
  copied,
  copy,
}: {
  preview: QuotationPreviewRecord;
  retry?: SummaryRetry | null;
  onViewVehicles?: () => void;
  copied: string | null;
  copy: (value: string, what: string) => void;
}) {
  const [failedOpen, setFailedOpen] = useState(false);
  const {
    state,
    badge,
    tiramis,
    vehicles,
    failedVehicles,
    issuedCount,
    error,
    code,
  } = getTiraFacts(preview);

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

  return (
    <div className="py-1">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <dt className="text-[13px] text-slate-600">TIRA</dt>
        <dd>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold',
              badge.className,
            )}
          >
            {state === 'failed' && (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
            {badge.label}
          </span>
        </dd>
      </div>

      {state === 'success' &&
        (vehicles ? (
          <div className="flex min-h-10 items-center justify-between gap-2 text-[13px]">
            <span className="min-w-0 text-slate-700">
              <span className="font-semibold text-slate-900">
                {issuedCount} of {vehicles.length}
              </span>{' '}
              stickers / cover notes issued
            </span>
            {link('View per vehicle', onViewVehicles)}
          </div>
        ) : (
          <>
            {tiramis?.sticker_number && (
              <Row
                label="Sticker no."
                trailing={
                  <MobileCopy
                    value={tiramis.sticker_number}
                    what="Sticker number"
                    copied={copied === tiramis.sticker_number}
                    onCopy={() =>
                      copy(tiramis.sticker_number!, 'Sticker number')
                    }
                  />
                }
              >
                {tiramis.sticker_number}
              </Row>
            )}
            {tiramis?.cover_note_reference_number && (
              <Row
                label="Cover note ref."
                trailing={
                  <MobileCopy
                    value={tiramis.cover_note_reference_number}
                    what="Cover note reference"
                    copied={copied === tiramis.cover_note_reference_number}
                    onCopy={() =>
                      copy(
                        tiramis.cover_note_reference_number!,
                        'Cover note reference',
                      )
                    }
                  />
                }
              >
                {tiramis.cover_note_reference_number}
              </Row>
            )}
          </>
        ))}

      {state === 'failed' && (
        <div className="space-y-2 pb-1">
          {vehicles ? (
            <div className="flex min-h-10 items-center justify-between gap-2 text-[13px]">
              <span className="font-semibold text-[#B42318]">
                {failedVehicles.length} of {vehicles.length} failed
              </span>
              {failedVehicles.length > 0 &&
                link('View failed vehicles', () => setFailedOpen(true))}
            </div>
          ) : (
            <ErrorBox message={error} code={code} />
          )}
          {retry && (
            <button
              type="button"
              disabled={retry.pending}
              onClick={retry.onClick}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#3B4A8C] bg-white text-[14px] font-semibold text-[#3B4A8C] disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              {retry.pending ? 'Retrying…' : 'Retry sync'}
            </button>
          )}
        </div>
      )}

      {state === 'pending' && (
        <p className="pb-2 text-[13px] text-slate-600">
          Waiting for TIRA response
        </p>
      )}

      {vehicles && (
        <FailedVehiclesDialog
          open={failedOpen}
          onOpenChange={setFailedOpen}
          items={failedVehicles}
        />
      )}
    </div>
  );
}

function QuotationMobileHeader({
  preview,
  workflow,
  lifecycle,
  onBack,
  policies,
  retry,
  menuItems,
  primaryAction,
  onViewVehicles,
}: QuotationSummaryHeaderProps) {
  const facts = useSummaryFacts(preview, workflow);
  const line = lineInfo(preview);
  const { copied, copy } = useCopied();
  const paid = preview.overview.payment_status;
  const paymentBadge =
    paid === 'PAID'
      ? { label: 'PAID', tone: 'success' as Tone }
      : paid === 'NOT_REQUIRED'
        ? { label: 'NO PAYMENT DUE', tone: 'muted' as Tone }
        : {
            label: 'UNPAID',
            tone: (paymentTone(paid) === 'danger'
              ? 'danger'
              : 'progress') as Tone,
          };
  const otherFailure = nonTiraFailure(lifecycle);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-3 -mt-5 flex h-14 items-center gap-1 border-b border-[#E6E8EF] bg-white px-1.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to quotations"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 active:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-[16px] font-bold leading-tight">
            {preview.overview.quotation_no}
          </h1>
          <p className="truncate text-[12px] text-slate-600">{line.short}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Quotation actions"
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
            {menuItems.length > 0 && <DropdownMenuSeparator />}
            <dl className="space-y-1 px-2 py-2 text-[12px] text-slate-600">
              <div className="flex justify-between gap-3">
                <dt>Approval</dt>
                <dd className="truncate text-right font-medium text-slate-800">
                  {facts.approval}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Created</dt>
                <dd className="text-right font-medium text-slate-800">
                  {facts.created}
                </dd>
              </div>
            </dl>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <section
        aria-label="Quotation summary"
        className="rounded-2xl border border-[#E6E8EF] bg-white p-[14px]"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-[15px] font-semibold">
            {facts.customer}
          </p>
          <Pill tone={OVERALL_TONE[lifecycle.overall.tone]} size="sm">
            {lifecycle.overall.label}
          </Pill>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-slate-600">
          {facts.shortProduct}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[22px] font-bold leading-tight tabular-nums">
            {facts.premium}
          </p>
          <Pill tone={paymentBadge.tone} size="sm">
            {paymentBadge.label}
          </Pill>
        </div>

        <dl className="mt-3 divide-y divide-[#E6E8EF] border-t border-[#E6E8EF]">
          <Row
            label="Policy"
            trailing={
              policies?.[0] ? (
                <MobileCopy
                  value={policies[0].policy_no}
                  what="Policy number"
                  copied={copied === policies[0].policy_no}
                  onCopy={() => copy(policies[0].policy_no, 'Policy number')}
                />
              ) : undefined
            }
          >
            {policies === undefined ? (
              <span className="font-normal text-slate-500">—</span>
            ) : policies[0] ? (
              <Link
                to={policies[0].href}
                className="text-[#3B4A8C] underline-offset-2 hover:underline"
              >
                {policies[0].policy_no}
              </Link>
            ) : (
              <span className="font-normal text-slate-600">Not issued yet</span>
            )}
          </Row>
          <Row label="Cover">
            {facts.period ?? (
              <span className="font-normal text-slate-600">Not set</span>
            )}
          </Row>
          <MobileTiraBlock
            preview={preview}
            retry={retry}
            onViewVehicles={onViewVehicles}
            copied={copied}
            copy={copy}
          />
          {facts.vehicles !== null && (
            <div>
              <button
                type="button"
                onClick={onViewVehicles}
                className="flex min-h-11 w-full items-center gap-3 text-left text-[13px]"
              >
                <span className="text-slate-600">Vehicles</span>
                <span className="ml-auto font-semibold">
                  {facts.vehicles}{' '}
                  {facts.vehicles === 1 ? 'vehicle' : 'vehicles'}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              </button>
            </div>
          )}
        </dl>

        {otherFailure && (
          <p
            role="alert"
            className="mt-2 rounded-xl bg-[#FEF3F2] p-3 text-[13px] text-[#B42318]"
          >
            <span className="font-semibold">{otherFailure.label} failed.</span>{' '}
            {otherFailure.error}
          </p>
        )}
        {otherFailure && retry && (
          <button
            type="button"
            disabled={retry.pending}
            onClick={retry.onClick}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-[#3B4A8C] text-[14px] font-semibold text-[#3B4A8C]"
          >
            {retry.label}
          </button>
        )}
        {primaryAction && <div className="mt-3">{primaryAction}</div>}
      </section>
    </div>
  );
}

/* ── Tablet / desktop header (compact, >=768px) ─────────────────────── */

function DesktopPageHeader({
  breadcrumb,
  quotationNo,
  status,
  statusTone,
  subtitle,
  onBack,
  actions,
}: {
  breadcrumb: string;
  quotationNo: string;
  status: string;
  statusTone: Tone;
  subtitle: string;
  onBack?: () => void;
  actions: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to quotations"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E6E8EF] bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
            {breadcrumb}
          </p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <h1 className="text-[20px] font-bold leading-tight [overflow-wrap:anywhere]">
              {quotationNo}
            </h1>
            <Pill tone={statusTone} size="sm">
              <span className="text-[12px]">{status}</span>
            </Pill>
            <p className="min-w-0 text-[13px] text-slate-700 [overflow-wrap:anywhere]">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {actions}
      </div>
    </div>
  );
}

function CellCopy({
  value,
  what,
  copied,
  onCopy,
}: {
  value: string;
  what: string;
  copied: boolean;
  onCopy: () => void;
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
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C]',
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
      <CellCopy
        value={value}
        what={what}
        copied={copied === value}
        onCopy={() => copy(value, what)}
      />
    </>
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

function DesktopSummaryCard({
  preview,
  facts,
  lifecycle,
  policies,
  retry,
  onViewVehicles,
}: {
  preview: QuotationPreviewRecord;
  facts: ReturnType<typeof useSummaryFacts>;
  lifecycle: QuotationLifecycle;
  policies?: SummaryPolicy[];
  retry?: SummaryRetry | null;
  onViewVehicles?: () => void;
}) {
  const { copied, copy } = useCopied();
  const [failedOpen, setFailedOpen] = useState(false);
  const tira = getTiraFacts(preview);
  const isFleet = tira.vehicles !== null;
  const policy = policies?.[0];
  const otherFailure = nonTiraFailure(lifecycle);
  const periodParts = facts.periodNumeric?.split(' – ') ?? null;

  // Cells 5 and 6 depend on the TIRA outcome and the line.
  let tail: ReactNode;
  if (tira.state === 'failed') {
    tail = (
      <div className="col-span-2 flex min-w-0 items-center gap-2 bg-white px-3.5 py-2.5">
        <div
          role="alert"
          className="min-w-0 flex-1 rounded-lg bg-[#FEF3F2] px-3 py-1.5 text-[#B42318]"
        >
          <p className="text-[12px] font-semibold">
            {isFleet
              ? `${tira.failedVehicles.length} of ${tira.vehicles!.length} vehicles failed`
              : `Submission failed${tira.code ? ` · Code ${tira.code}` : ''}`}
          </p>
          {isFleet ? (
            tira.failedVehicles.length > 0 && (
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
              title={tira.error}
            >
              {tira.error}
            </p>
          )}
        </div>
        {retry && (
          <button
            type="button"
            disabled={retry.pending}
            onClick={retry.onClick}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#3B4A8C] bg-white px-3 text-[13px] font-semibold text-[#3B4A8C] hover:bg-[#3B4A8C]/5 disabled:opacity-60"
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
            {retry.pending ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>
    );
  } else if (tira.state === 'pending') {
    tail = (
      <div className="col-span-2 flex items-center bg-white px-3.5 py-2.5 text-[13px] text-slate-600">
        Waiting for TIRA response
      </div>
    );
  } else if (isFleet) {
    tail = (
      <>
        <Cell label="Cover notes">
          <span className="truncate">
            {tira.issuedCount} of {tira.vehicles!.length} issued
          </span>
          {tira.state === 'success' && (
            <CellLink onClick={onViewVehicles}>Per vehicle</CellLink>
          )}
        </Cell>
        <Cell label="Vehicles">
          <span className="truncate">
            {facts.vehicles} {facts.vehicles === 1 ? 'vehicle' : 'vehicles'}
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
            value={tira.tiramis?.sticker_number}
            what="Sticker number"
            copied={copied}
            copy={copy}
          />
        </Cell>
        <Cell label="Cover note ref.">
          <CopyValue
            value={tira.tiramis?.cover_note_reference_number}
            what="Cover note reference"
            copied={copied}
            copy={copy}
          />
        </Cell>
      </>
    );
  }

  return (
    <section
      aria-label="Quotation summary"
      className="overflow-hidden rounded-xl border border-[#E6E8EF] bg-white"
    >
      {otherFailure && (
        <div className="border-b border-[#E6E8EF] px-3.5 py-2.5">
          <FailedStepAlert lifecycle={lifecycle} retry={retry} />
        </div>
      )}
      {/* 1px gaps over the border colour draw the dividers in both grids. */}
      <dl className="grid grid-cols-[1fr_1fr_1.4fr] gap-px bg-[#E6E8EF] lg:grid-cols-[1fr_1.3fr_1.5fr_0.8fr_1.15fr_1.15fr]">
        <Cell label="Total premium">
          <span
            className="whitespace-nowrap text-[16px] font-bold tabular-nums"
            title={facts.premium}
          >
            <span aria-hidden>{facts.premiumShort}</span>
            <span className="sr-only">{facts.premium}</span>
          </span>
        </Cell>
        <Cell label="Cover period">
          {periodParts ? (
            // Each date stays whole; if the cell is narrow the end date
            // wraps under the start date instead of being cut off.
            <span
              className="flex flex-wrap gap-x-1 tabular-nums"
              title={facts.period ?? undefined}
            >
              <span className="whitespace-nowrap">{periodParts[0]} –</span>
              <span className="whitespace-nowrap">{periodParts[1]}</span>
            </span>
          ) : (
            <span className="font-normal text-slate-500">Not set</span>
          )}
        </Cell>
        <Cell label="Policy number">
          {policies === undefined ? (
            <span className="font-normal text-slate-500">—</span>
          ) : policy ? (
            <CopyValue
              value={policy.policy_no}
              what="Policy number"
              copied={copied}
              copy={copy}
              href={policy.href}
            />
          ) : (
            <span className="font-normal text-slate-600">Not issued yet</span>
          )}
        </Cell>
        <Cell label="TIRA">
          <TiraBadge state={tira.state} />
        </Cell>
        {tail}
      </dl>
      <p className="border-t border-[#E6E8EF] px-3.5 py-[7px] text-[12px] text-slate-600">
        Approval:{' '}
        <span className="font-medium text-slate-800">{facts.approval}</span>
        <span aria-hidden> · </span>
        Created:{' '}
        <span className="font-medium text-slate-800">{facts.created}</span>
        {facts.paymentNote && (
          <>
            <span aria-hidden> · </span>
            {facts.paymentNote}
          </>
        )}
      </p>
      {isFleet && (
        <FailedVehiclesDialog
          open={failedOpen}
          onOpenChange={setFailedOpen}
          items={tira.failedVehicles}
        />
      )}
    </section>
  );
}

export function QuotationSummaryHeader({
  preview,
  workflow,
  lifecycle,
  onBack,
  policies,
  retry,
  actions,
  menuItems,
  primaryAction,
  onViewVehicles,
}: QuotationSummaryHeaderProps) {
  const facts = useSummaryFacts(preview, workflow);
  const line = lineInfo(preview);
  const statusTone = OVERALL_TONE[lifecycle.overall.tone];
  const { quotation_no } = preview.overview;

  return (
    <div style={FONT} className="text-slate-900">
      {/* ── Tablet / desktop (compact) ───────────────────── */}
      <div className="hidden space-y-3 md:block">
        <DesktopPageHeader
          breadcrumb={line.breadcrumb}
          quotationNo={quotation_no}
          status={lifecycle.overall.label}
          statusTone={statusTone}
          subtitle={[facts.customer, facts.product].join(' · ')}
          onBack={onBack}
          actions={actions}
        />
        <DesktopSummaryCard
          preview={preview}
          facts={facts}
          lifecycle={lifecycle}
          policies={policies}
          retry={retry}
          onViewVehicles={onViewVehicles}
        />
      </div>

      {/* ── Phone ────────────────────────────────────────── */}
      <div className="md:hidden">
        <QuotationMobileHeader
          preview={preview}
          workflow={workflow}
          lifecycle={lifecycle}
          onBack={onBack}
          policies={policies}
          retry={retry}
          actions={null}
          menuItems={menuItems}
          primaryAction={primaryAction}
          onViewVehicles={onViewVehicles}
        />
      </div>
    </div>
  );
}
