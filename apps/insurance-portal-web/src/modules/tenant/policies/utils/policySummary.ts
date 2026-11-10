import {
  sentenceCase,
  tiraState,
  type RecordSummary,
  type SummaryTone,
} from '@/components/record-summary/record-summary';
import { formatDate, formatMoney } from '@/components/shared/detailFormat';
import type { CoverNoteRecord } from '@/modules/tenant/cover-notes/types';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type { FinanceInvoice } from '@/modules/tenant/finance/types';
import type { PolicyRecord, PolicyVersionRecord } from '../types';
import {
  EXPIRING_WINDOW_DAYS,
  POLICY_BREADCRUMB,
  POLICY_KIND_LABEL,
  daysLeftLabel,
  policyStatusView,
  type PolicyKind,
} from './policyDisplay';

type Rec = Record<string, unknown>;

function asObject(value: unknown): Rec | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim();
}

/** Motor entries of the current version (one per insured vehicle). */
export function policyVehicleEntries(version?: PolicyVersionRecord | null) {
  const entries = version?.policy_snapshot?.['entries'];
  return (Array.isArray(entries) ? (entries as Rec[]) : []).filter((entry) =>
    Boolean(asObject(entry.motor)),
  );
}

/** Quotation number the policy was issued from, from the version snapshot. */
export function policyQuotationNo(version?: PolicyVersionRecord | null) {
  return text(asObject(version?.policy_snapshot?.['source'])?.quotationNo);
}

/** Payment badge from the policy's invoices; null when none are visible. */
function paymentOf(
  invoices: FinanceInvoice[] | undefined,
  currency: string,
): RecordSummary['payment'] {
  if (!invoices?.length) return null;
  const live = invoices.filter(
    (invoice) => !['VOID', 'VOIDED', 'CANCELLED'].includes(invoice.status),
  );
  if (!live.length) return null;
  const balance = live.reduce(
    (sum, invoice) => sum + (Number(invoice.balance_amount) || 0),
    0,
  );
  const paid = live.reduce(
    (sum, invoice) => sum + (Number(invoice.paid_amount) || 0),
    0,
  );
  if (balance <= 0.004)
    return { label: 'PAID', tone: 'success', note: 'Paid in full' };
  return {
    label: paid > 0 ? 'PART PAID' : 'UNPAID',
    tone: 'progress' as SummaryTone,
    note: `Outstanding ${formatMoney(balance, currency)}`,
  };
}

export interface PolicySummaryInput {
  policy: PolicyRecord;
  kind: PolicyKind;
  version?: PolicyVersionRecord | null;
  /** Cover notes of the policy; undefined when not readable. */
  coverNotes?: CoverNoteRecord[];
  invoices?: FinanceInvoice[];
  quotationHref?: string;
  /** Renew action for the expiry notice, when renewal is allowed. */
  renew?: { onClick: () => void; pending?: boolean } | null;
  now?: Date;
}

/** Maps a policy onto the shared summary view model. */
export function policySummary({
  policy,
  kind,
  version,
  coverNotes,
  invoices,
  quotationHref,
  renew,
  now = new Date(),
}: PolicySummaryInput): RecordSummary {
  const status = policyStatusView(policy.policy_status, policy.end_date, now);
  const quotationNo = policyQuotationNo(version);
  const category = sentenceCase(policy.category?.name);
  const product = sentenceCase(policy.product?.product_name);
  const liveNotes = (coverNotes ?? []).filter(
    (note) => !['CANCELLED', 'VOID', 'REPLACED'].includes(note.status),
  );
  const mainNote = liveNotes[0];
  const regulatory = asObject(version?.policy_snapshot?.['regulatory']);
  const vehicleEntries = kind === 'fleet' ? policyVehicleEntries(version) : [];
  const fleetTotal = Math.max(
    vehicleEntries.length,
    new Set(liveNotes.map((note) => note.fleet_entry ?? note.id)).size,
  );
  const tira = tiraState(policy.tira_status || policy.tiramis_status);
  const expiring =
    status.daysLeft !== null &&
    status.daysLeft >= 0 &&
    status.daysLeft <= EXPIRING_WINDOW_DAYS &&
    status.label === 'Expiring soon';

  return {
    entity: 'policy',
    breadcrumb: POLICY_BREADCRUMB[kind],
    typeLabel: POLICY_KIND_LABEL[kind].long,
    number: policy.policy_no,
    status: { label: status.label, tone: status.tone },
    customer: policy.customer
      ? getCustomerDisplayName(policy.customer)
      : 'Customer not provided',
    product:
      [category, product].filter(Boolean).join(' · ') || 'Product not provided',
    shortProduct: product || category || 'Product not provided',
    premium: Number(policy.total_premium),
    currency: policy.currency,
    payment: paymentOf(invoices, policy.currency),
    period: {
      start: policy.start_date,
      end: policy.end_date,
      label: 'Policy period',
      mobileLabel: 'Period',
      note:
        status.daysLeft !== null && status.daysLeft >= 0
          ? daysLeftLabel(status.daysLeft)
          : null,
    },
    reference: {
      label: 'Quotation no.',
      mobileLabel: 'Quotation',
      value: policy.quotation_id ? quotationNo || 'View quotation' : null,
      href: policy.quotation_id ? quotationHref : undefined,
      emptyText: 'Not linked',
    },
    tira: {
      state: tira,
      sticker: policy.sticker_no || mainNote?.sticker_number || null,
      coverRef:
        mainNote?.cover_note_reference_number ||
        text(regulatory?.currentCoverNoteReference) ||
        null,
      error: policy.tiramis_last_error_message,
      code:
        policy.tiramis_final_response_status_code ||
        policy.tiramis_acknowledgement_status_code,
      fleet:
        kind === 'fleet'
          ? {
              total: fleetTotal,
              issued: liveNotes.filter(
                (note) => note.cover_note_reference_number,
              ).length,
              failed: [],
            }
          : null,
    },
    vehicles: kind === 'fleet' ? fleetTotal : null,
    footer: [
      {
        label: 'Issued by',
        value:
          policy.intermediary_company?.name ||
          policy.insurer_company?.name ||
          '—',
      },
      { label: 'Issued on', value: formatDate(policy.issue_date) },
    ],
    notice: expiring
      ? {
          text: `Expires in ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'}`,
          tone: 'progress',
          action: renew
            ? { label: 'Renew', onClick: renew.onClick, pending: renew.pending }
            : undefined,
        }
      : null,
  };
}
