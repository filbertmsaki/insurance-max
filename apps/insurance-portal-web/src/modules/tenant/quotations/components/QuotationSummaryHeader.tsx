import type { ReactNode } from 'react';
import type { ActionMenuItem } from '@/components/shared/ActionMenu';
import { RecordSummaryHeader } from '@/components/record-summary/RecordSummaryHeader';
import {
  sentenceCase,
  tiraState,
  type RecordSummary,
  type SummaryRetry,
  type SummaryTone,
} from '@/components/record-summary/record-summary';
import {
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

export type { SummaryRetry } from '@/components/record-summary/record-summary';

export interface SummaryPolicy {
  id: string;
  policy_no: string;
  href: string;
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

const OVERALL_TONE: Record<OverallTone, SummaryTone> = {
  success: 'success',
  info: 'progress',
  warning: 'progress',
  danger: 'danger',
  muted: 'muted',
};

function paymentTone(status: PaymentStatus): SummaryTone {
  if (status === 'PAID' || status === 'NOT_REQUIRED') return 'success';
  if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(status)) return 'danger';
  if (status === 'REFUNDED') return 'muted';
  return 'progress';
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

function vehicleName(vehicle: QuotationPreviewFleetVehicle, index: number) {
  return (
    vehicle.motor_details?.registration_number ||
    vehicle.motor_details?.chassis_number ||
    `Vehicle ${vehicle.fleet_entry_number ?? index + 1}`
  );
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

/** Maps a quotation preview onto the shared summary view model. */
function quotationSummary(
  preview: QuotationPreviewRecord,
  lifecycle: QuotationLifecycle,
  workflow?: QuotationWorkflowView,
  policies?: SummaryPolicy[],
): RecordSummary {
  const { overview, premium_summary, payment, cover_note } = preview;
  const line = lineInfo(preview);
  const category = sentenceCase(
    overview.insurance_category.name ?? overview.insurance_category.code,
  );
  const productName = sentenceCase(
    overview.product.name ?? overview.product.code,
  );
  const outstanding = payment?.outstanding_amount ?? null;
  const currency = payment?.currency ?? premium_summary.currency;
  const approvalStatus = workflow?.approval.status ?? overview.approval_status;
  const paid = overview.payment_status;
  const vehicles = preview.fleet?.vehicles ?? null;
  const tiramis = preview.tiramis;
  const failure = nonTiraFailure(lifecycle);

  return {
    entity: 'quotation',
    breadcrumb: line.breadcrumb,
    typeLabel: line.short,
    number: overview.quotation_no,
    status: {
      label: lifecycle.overall.label,
      tone: OVERALL_TONE[lifecycle.overall.tone],
    },
    customer:
      preview.policyholders
        .map((h) => h.full_name)
        .filter(Boolean)
        .join(', ') || 'Policyholder not provided',
    product:
      [category, productName].filter(Boolean).join(' · ') ||
      'Product not provided',
    shortProduct: productName || category || 'Product not provided',
    premium: premium_summary.total_premium_including_tax,
    currency: premium_summary.currency,
    payment: {
      label:
        paid === 'PAID'
          ? 'PAID'
          : paid === 'NOT_REQUIRED'
            ? 'NO PAYMENT DUE'
            : 'UNPAID',
      tone:
        paid === 'PAID'
          ? 'success'
          : paid === 'NOT_REQUIRED'
            ? 'muted'
            : paymentTone(paid) === 'danger'
              ? 'danger'
              : 'progress',
      note:
        paid === 'NOT_REQUIRED'
          ? 'No payment required'
          : outstanding && outstanding > 0
            ? `Outstanding ${formatMoney(outstanding, currency)}`
            : paid === 'PAID'
              ? 'Paid in full'
              : null,
    },
    period: {
      start: cover_note.cover_note_start_date,
      end: cover_note.cover_note_end_date,
      label: 'Cover period',
      mobileLabel: 'Cover',
    },
    reference: {
      label: 'Policy number',
      mobileLabel: 'Policy',
      value:
        policies === undefined ? undefined : (policies[0]?.policy_no ?? null),
      href: policies?.[0]?.href,
      emptyText: 'Not issued yet',
    },
    tira: {
      state: tiraState(overview.tira_status),
      sticker: tiramis?.sticker_number,
      coverRef: tiramis?.cover_note_reference_number,
      error:
        tiramis?.last_submission_error ||
        tiramis?.response_status_description ||
        null,
      code:
        tiramis?.response_status_code ||
        tiramis?.acknowledgement_status_code ||
        null,
      fleet: vehicles
        ? {
            total: vehicles.length,
            issued: vehicles.filter(
              (v) => v.tiramis?.cover_note_reference_number,
            ).length,
            failed: vehicles
              .map((vehicle, index) => ({ vehicle, index }))
              .filter(
                ({ vehicle }) =>
                  tiraState(vehicle.tiramis?.submission_status) === 'failed' ||
                  !!vehicle.tiramis?.last_submission_error,
              )
              .map(({ vehicle, index }) => ({
                name: vehicleName(vehicle, index),
                message:
                  vehicle.tiramis?.last_submission_error ||
                  vehicle.tiramis?.response_status_description ||
                  'No reason was returned.',
                code: vehicle.tiramis?.response_status_code,
              })),
          }
        : null,
    },
    vehicles: vehicles?.length ?? null,
    footer: [
      {
        label: 'Approval',
        value:
          !overview.requires_approval && approvalStatus === 'NOT_REQUIRED'
            ? 'Not required'
            : approvalStatus === 'APPROVED' && overview.approved_by?.name
              ? `Approved by ${overview.approved_by.name}`
              : humanizeCode(approvalStatus),
      },
      { label: 'Created', value: formatDateTime(overview.created_at) },
    ],
    failure: failure ? { label: failure.label, error: failure.error } : null,
  };
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
  return (
    <RecordSummaryHeader
      summary={quotationSummary(preview, lifecycle, workflow, policies)}
      onBack={onBack}
      actions={actions}
      menuItems={menuItems}
      primaryAction={primaryAction}
      retry={retry}
      onViewVehicles={onViewVehicles}
    />
  );
}
