import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
} from '@/components/shared/detailFormat';
import type { QuotationPreviewRecord, QuotationPreviewRisk } from '../types';
import { SectionCard } from './QuotationDetailLayout';
import {
  FleetVehiclesTable,
  PolicyholderPreview,
} from './QuotationPreviewSections';

const COVER_NOTE_TYPE_LABELS: Record<number, string> = {
  1: 'New',
  2: 'Renewal',
  3: 'Endorsement',
};
const PAYMENT_MODE_LABELS: Record<number, string> = {
  1: 'Cash',
  2: 'Cheque',
  3: 'EFT',
};

// The shared formatters render missing values as "N/A".
function isEmpty(value: ReactNode) {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    value === '—' ||
    value === 'N/A'
  );
}

function joinPresent(values: Array<string | null | undefined>) {
  return values.filter((value) => !isEmpty(value)).join(' · ');
}

/**
 * Label/value list that leaves out empty fields, so a fleet quotation shows
 * what was captured instead of rows of "N/A".
 */
function FactList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; wide?: boolean }>;
}) {
  const visible = items.filter((item) => !isEmpty(item.value));
  if (!visible.length) {
    return <p className="text-sm text-slate-500">Nothing recorded.</p>;
  }
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map((item) => (
        <div
          key={item.label}
          className={
            item.wide ? 'min-w-0 sm:col-span-2 xl:col-span-3' : 'min-w-0'
          }
        >
          <dt className="text-xs text-slate-500">{item.label}</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OverviewFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 [overflow-wrap:anywhere]">
        {value}
      </dd>
      {hint ? <dd className="text-xs text-slate-500">{hint}</dd> : null}
    </div>
  );
}

/**
 * The premium as a short calculation, each figure shown once: base, less any
 * discount, plus tax, giving the total payable. All figures are the backend's.
 */
function FleetPremiumBreakdown({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  const summary = preview.premium_summary;
  const money = (value: number | null | undefined) =>
    formatMoney(value, summary.currency);
  const discount = summary.total_discount_amount ?? 0;
  const lines: Array<{ sign?: string; label: string; value: string }> = [
    {
      label: 'Base premium',
      value: money(summary.total_premium_before_discount),
    },
    ...(discount > 0
      ? [
          { sign: '−', label: 'Discount', value: money(discount) },
          {
            sign: '=',
            label: 'Premium excl. tax',
            value: money(summary.total_premium_excluding_tax),
          },
        ]
      : []),
    { sign: '+', label: 'Tax', value: money(summary.total_tax_amount) },
  ];

  return (
    <SectionCard title="Premium Summary">
      <div className="max-w-xl">
        <dl className="space-y-2 text-sm">
          {lines.map((line) => (
            <div
              key={line.label}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="flex min-w-0 items-baseline gap-2 text-slate-600">
                <span
                  aria-hidden="true"
                  className="w-3 shrink-0 text-center text-slate-400"
                >
                  {line.sign}
                </span>
                {line.label}
              </dt>
              <dd className="whitespace-nowrap tabular-nums text-slate-900">
                {line.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3">
          <p className="flex items-baseline gap-2 text-sm font-semibold text-slate-900">
            <span
              aria-hidden="true"
              className="w-3 shrink-0 text-center text-slate-400"
            >
              =
            </span>
            Total payable
          </p>
          <p className="whitespace-nowrap text-lg font-semibold tabular-nums text-slate-900">
            {money(summary.total_premium_including_tax)}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Details tab for a motor fleet quotation: totals first, then the vehicles,
 * the premium, the cover terms, the policyholder and finally the record's
 * audit details. Quotation number, status and product already sit in the
 * page header, so they are not repeated here.
 */
export function FleetQuotationDetails({
  preview,
  renderRiskActions,
}: {
  preview: QuotationPreviewRecord;
  renderRiskActions: (risk: QuotationPreviewRisk) => ReactNode;
}) {
  const fleet = preview.fleet!;
  const { header, summary, vehicles } = fleet;
  const { overview, premium_summary } = preview;
  const currency = header.currency ?? premium_summary.currency;
  const money = (value: number | null | undefined) =>
    formatMoney(value, currency);
  const vehicleCount = summary.saved_vehicle_count;
  const sizeMismatch =
    summary.declared_fleet_size !== null &&
    summary.declared_fleet_size !== vehicleCount;
  const cover = vehicles[0]?.risks[0];
  const coverPeriod = [
    formatDate(header.cover_start_date),
    formatDate(header.cover_end_date),
  ]
    .filter((value) => !isEmpty(value))
    .join(' – ');
  const officer = joinPresent([
    header.authorizing_officer_name,
    header.authorizing_officer_title,
  ]);
  const comprehensive = summary.comprehensive_vehicle_count;
  const thirdParty = summary.third_party_vehicle_count;
  const fleetMix =
    comprehensive === 0 && thirdParty > 0
      ? 'All third party'
      : thirdParty === 0 && comprehensive > 0
        ? 'All comprehensive'
        : joinPresent([
            comprehensive ? `${comprehensive} comprehensive` : null,
            thirdParty ? `${thirdParty} third party` : null,
          ]) || undefined;
  const isForeignCurrency = !!currency && currency.toUpperCase() !== 'TZS';

  return (
    <>
      <SectionCard
        title="Fleet overview"
        description={joinPresent([
          header.fleet_type_label,
          cover?.risk_name,
          coverPeriod,
        ])}
      >
        <div className="flex flex-col overflow-hidden rounded-lg border border-sky-200 bg-sky-50/50 md:flex-row">
          <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
            <p className="text-xs font-medium text-sky-800">Total payable</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-950 [overflow-wrap:anywhere] sm:text-3xl">
              {money(summary.total_premium_including_tax)}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-sky-200 bg-white/60 px-4 py-4 sm:px-5 md:w-auto md:min-w-72 md:grid-cols-1 md:border-l md:border-t-0 lg:grid-cols-2 lg:min-w-96">
            <OverviewFact
              label="Vehicles"
              value={formatNumber(vehicleCount, 0)}
              hint={fleetMix}
            />
            {summary.total_fleet_sum_insured > 0 && (
              <OverviewFact
                label="Total sum insured"
                value={money(summary.total_fleet_sum_insured)}
              />
            )}
          </dl>
        </div>
        {(sizeMismatch ||
          summary.failed_entries > 0 ||
          summary.pending_entries > 0) && (
          <div className="mt-3 space-y-2">
            {sizeMismatch && (
              <Notice>
                {formatNumber(summary.declared_fleet_size, 0)} vehicles were
                declared but {formatNumber(vehicleCount, 0)} are saved.
              </Notice>
            )}
            {summary.failed_entries > 0 && (
              <Notice>
                {summary.failed_entries} vehicle
                {summary.failed_entries === 1 ? '' : 's'} failed TIRAMIS
                submission. See the TIRAMIS Information tab.
              </Notice>
            )}
            {summary.pending_entries > 0 && (
              <Notice>
                {summary.pending_entries} vehicle
                {summary.pending_entries === 1 ? ' is' : 's are'} awaiting a
                TIRAMIS response.
              </Notice>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Vehicles"
        description="Select a vehicle to see its details, risk and premium breakdown."
      >
        <FleetVehiclesTable
          vehicles={vehicles}
          renderRiskActions={renderRiskActions}
        />
      </SectionCard>

      <FleetPremiumBreakdown preview={preview} />

      <SectionCard title="Cover and terms">
        <FactList
          items={[
            { label: 'Fleet ID', value: header.fleet_id },
            {
              label: 'Cover note type',
              value:
                header.cover_note_type != null
                  ? (COVER_NOTE_TYPE_LABELS[header.cover_note_type] ??
                    String(header.cover_note_type))
                  : null,
            },
            { label: 'Cover period', value: coverPeriod },
            {
              label: 'Payment mode',
              value:
                header.payment_mode != null
                  ? (PAYMENT_MODE_LABELS[header.payment_mode] ??
                    String(header.payment_mode))
                  : null,
            },
            {
              label: 'Currency',
              value: isForeignCurrency
                ? `${currency} · rate ${formatNumber(header.exchange_rate, 6)}`
                : currency,
            },
            { label: 'Sales point', value: header.sales_point_code },
            { label: 'Authorizing officer', value: officer },
            {
              label: 'Commission rate',
              value: header.commission_rate
                ? formatNumber(header.commission_rate, 6)
                : null,
            },
            {
              label: 'Commission paid',
              value: header.commission_paid
                ? money(header.commission_paid)
                : null,
            },
            {
              label: 'Add-on premium',
              value: summary.total_addon_premium
                ? money(summary.total_addon_premium)
                : null,
            },
          ]}
        />
      </SectionCard>

      <PolicyholderPreview policyholders={preview.policyholders} />

      <SectionCard title="Record details">
        <FactList
          items={[
            { label: 'Channel', value: overview.channel_type },
            {
              label: 'Branch',
              value: overview.branch.name ?? overview.branch.code,
            },
            {
              label: 'Department',
              value: overview.department.name ?? overview.department.code,
            },
            {
              label: 'Subclass',
              value: overview.subclass.name ?? overview.subclass.code,
            },
            {
              label: 'Created',
              value: joinPresent([
                overview.created_by.name ?? overview.created_by.code,
                formatDateTime(overview.created_at),
              ]),
            },
            {
              label: 'Last updated',
              value: joinPresent([
                overview.updated_by.name ?? overview.updated_by.code,
                formatDateTime(overview.updated_at),
              ]),
            },
          ]}
        />
      </SectionCard>
    </>
  );
}
