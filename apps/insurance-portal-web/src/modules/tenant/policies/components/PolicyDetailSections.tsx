import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import {
  displayValue,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@/components/shared/detailFormat';
import { compactPeriod } from '@/components/record-summary/record-summary';
import { SummaryPill } from '@/components/record-summary/RecordSummaryHeader';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import type { CoverNoteRecord } from '@/modules/tenant/cover-notes/types';
import type { NonMotorPolicyDetailRecord } from '@/modules/tenant/non-motor/types';
import {
  KeyValueGrid,
  SectionCard,
  SectionCards,
} from '@/modules/tenant/quotations/components/QuotationDetailLayout';
import type {
  PolicyEndorsementRecord,
  PolicyRecord,
  PolicyVersionRecord,
} from '../types';
import {
  daysLeftLabel,
  policyStatusView,
  type PolicyKind,
} from '../utils/policyDisplay';
import {
  policyQuotationNo,
  policyVehicleEntries,
} from '../utils/policySummary';

type Rec = Record<string, unknown>;

function asObject(value: unknown): Rec | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

function str(value: unknown) {
  return value == null || value === '' ? null : String(value);
}

function money(value: unknown, currency: string) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? formatMoney(n, currency) : null;
}

const VEHICLE_FIELDS: Array<[string, string]> = [
  ['Registration no.', 'registrationNumber'],
  ['Chassis no.', 'chassisNumber'],
  ['Engine no.', 'engineNumber'],
  ['Make', 'make'],
  ['Model', 'model'],
  ['Body type', 'bodyType'],
  ['Year', 'yearOfManufacture'],
  ['Seating', 'sittingCapacity'],
  ['Colour', 'color'],
  ['Usage', 'motorUsage'],
  ['Category', 'motorCategory'],
  ['Owner', 'ownerName'],
];

function FleetVehiclesTable({ entries }: { entries: Rec[] }) {
  const rows = entries.map((entry, index) => ({
    id: String(entry.id ?? index),
    motor: asObject(entry.motor) ?? {},
    sticker: str(entry.stickerNumber),
  }));
  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'reg',
      header: 'Reg. / Chassis no.',
      cell: (row) =>
        displayValue(
          str(row.motor.registrationNumber) ?? str(row.motor.chassisNumber),
        ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: (row) =>
        [row.motor.make, row.motor.model].filter(Boolean).join(' ') || 'N/A',
    },
    {
      key: 'usage',
      header: 'Usage',
      hideOnMobile: true,
      cell: (row) => displayValue(str(row.motor.motorUsage)),
    },
    {
      key: 'sticker',
      header: 'Sticker no.',
      hideOnMobile: true,
      cell: (row) => displayValue(row.sticker),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(row) => row.id}
      page={1}
      limit={rows.length || 1}
      total={rows.length}
      totalPages={1}
      onPageChange={() => undefined}
      onLimitChange={() => undefined}
      showColumnVisibility={false}
      emptyMessage="This policy has no vehicles."
    />
  );
}

export interface PolicyDetailsTabProps {
  policy: PolicyRecord;
  kind: PolicyKind;
  version?: PolicyVersionRecord | null;
  versionsCount: number;
  coverNotes?: CoverNoteRecord[];
  endorsements: PolicyEndorsementRecord[];
  quotationHref?: string;
  /** Host content for the insured items (fleet panel, non-motor risks). */
  insuredItems?: ReactNode;
  nonMotorDetails: NonMotorPolicyDetailRecord[];
  onAddNonMotorDetail?: () => void;
  onOpenEndorsements: () => void;
  onOpenHistory: () => void;
}

/** "Policy details" tab: section cards and a premium / cover note panel. */
export function PolicyDetailsTab({
  policy,
  kind,
  version,
  versionsCount,
  coverNotes,
  endorsements,
  quotationHref,
  insuredItems,
  nonMotorDetails,
  onAddNonMotorDetail,
  onOpenEndorsements,
  onOpenHistory,
}: PolicyDetailsTabProps) {
  const c = policy.customer ?? null;
  const status = policyStatusView(policy.policy_status, policy.end_date);
  const vehicleEntries = policyVehicleEntries(version);
  const motor = asObject(vehicleEntries[0]?.motor);
  const quotationNo = policyQuotationNo(version);
  const regulatory = asObject(version?.policy_snapshot?.['regulatory']);
  const risks = policy.risks ?? [];
  const note = (coverNotes ?? []).find(
    (n) => !['CANCELLED', 'VOID', 'REPLACED'].includes(n.status),
  );
  const latestEndorsement = endorsements[0];
  const periodDays =
    policy.start_date && policy.end_date
      ? Math.round(
          (new Date(policy.end_date).getTime() -
            new Date(policy.start_date).getTime()) /
            86_400_000,
        )
      : null;

  const premiumRows: Array<[string, unknown, boolean?]> = [
    ['Premium before discount', policy.basic_premium],
    ['Discount', policy.total_discount, true],
    ['Charges', policy.total_charges],
    ['Tax', policy.total_tax],
  ];

  const sidePanel = (
    <div className="space-y-3 lg:sticky lg:top-4">
      <section
        aria-label="Premium summary"
        className="rounded-xl border border-[#E6E8EF] bg-white p-4"
      >
        <h2 className="mb-2 text-[15px] font-semibold text-slate-900">
          Premium summary
        </h2>
        <dl className="space-y-1.5 text-[13px]">
          {premiumRows
            .filter(([, value]) => Math.abs(Number(value) || 0) >= 0.005)
            .map(([label, value, negative]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-slate-600">{label}</dt>
                <dd className="font-semibold tabular-nums">
                  {negative ? '(' : ''}
                  {formatMoney(Math.abs(Number(value)), policy.currency)}
                  {negative ? ')' : ''}
                </dd>
              </div>
            ))}
          <div className="mt-2 flex justify-between gap-3 border-t border-[#E6E8EF] pt-2 text-[15px]">
            <dt className="font-semibold">Total premium</dt>
            <dd className="font-bold tabular-nums">
              {formatMoney(Number(policy.total_premium), policy.currency)}
            </dd>
          </div>
          {money(policy.sum_insured, policy.currency) && (
            <div className="flex justify-between gap-3 text-slate-600">
              <dt>Sum insured</dt>
              <dd className="tabular-nums">
                {money(policy.sum_insured, policy.currency)}
              </dd>
            </div>
          )}
        </dl>
      </section>
      <section
        aria-label="Cover note"
        className="rounded-xl border border-[#E6E8EF] bg-white p-4"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Cover note
          </h2>
          {note && (
            <SummaryPill
              tone={note.status === 'ISSUED' ? 'success' : 'muted'}
              size="sm"
            >
              {note.status}
            </SummaryPill>
          )}
        </div>
        <dl className="space-y-1.5 text-[13px]">
          {[
            ['Number', note?.cover_note_number ?? policy.cover_note_no],
            [
              'Reference',
              note?.cover_note_reference_number ??
                str(regulatory?.currentCoverNoteReference),
            ],
            ['Sticker', note?.sticker_number ?? policy.sticker_no],
            [
              'Valid',
              note ? compactPeriod(note.start_date, note.end_date) : null,
            ],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-slate-600">{label}</dt>
                <dd className="min-w-0 truncate text-right font-semibold">
                  {value}
                </dd>
              </div>
            ))}
          {!note && !policy.cover_note_no && (
            <p className="text-slate-500">No cover note recorded.</p>
          )}
          {kind === 'fleet' && (coverNotes?.length ?? 0) > 1 && (
            <p className="text-slate-500">
              {coverNotes!.length} cover notes · see the TIRA tab
            </p>
          )}
        </dl>
      </section>
    </div>
  );

  return (
    <div className="grid min-w-0 gap-4 bg-[#F4F5F9] p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      {/* Panel first on tablet/phone (above the sections), right on desktop. */}
      <div className="min-w-0 lg:order-2">{sidePanel}</div>
      <div className="min-w-0 space-y-3 lg:order-1">
        <SectionCards>
          <SectionCard
            title="Policy information"
            summary={[
              policy.product?.product_name,
              policy.branch?.name,
              status.label,
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <KeyValueGrid
              items={[
                { label: 'Policy no.', value: policy.policy_no },
                {
                  label: 'Quotation no.',
                  value: policy.quotation_id ? (
                    quotationHref ? (
                      <Link
                        to={quotationHref}
                        className="text-[#3B4A8C] hover:underline"
                      >
                        {quotationNo || 'View quotation'}
                      </Link>
                    ) : (
                      quotationNo || null
                    )
                  ) : null,
                },
                {
                  label: 'External policy no.',
                  value: policy.external_policy_no,
                },
                { label: 'Status', value: status.label },
                { label: 'Class', value: policy.category?.name },
                { label: 'Product', value: policy.product?.product_name },
                { label: 'Sub-class', value: policy.sub_class?.name },
                { label: 'Channel', value: str(policy.channel_type) },
                { label: 'Branch', value: policy.branch?.name },
                { label: 'Insurer', value: policy.insurer_company?.name },
                {
                  label: 'Intermediary',
                  value: policy.intermediary_company?.name,
                },
                { label: 'Issue date', value: formatDate(policy.issue_date) },
                {
                  label: 'Issuance source',
                  value: policy.issued_by_system
                    ? 'TIRA final success'
                    : 'Legacy / manual record',
                },
                {
                  label: 'Renewal no.',
                  value: policy.renewal_sequence
                    ? String(policy.renewal_sequence)
                    : null,
                },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="Policyholder"
            summary={[str(c?.customer_type), c?.region || c?.district]
              .filter(Boolean)
              .join(' · ')}
          >
            <KeyValueGrid
              items={[
                { label: 'Name', value: c ? getCustomerDisplayName(c) : null },
                { label: 'Customer no.', value: c?.customer_no },
                { label: 'Customer type', value: str(c?.customer_type) },
                { label: 'TIN', value: c?.tin },
                { label: 'VRN', value: c?.vrn },
                { label: 'Phone', value: c?.phone },
                { label: 'Email', value: c?.email },
                { label: 'Region', value: c?.region },
                { label: 'District', value: c?.district },
                { label: 'Street', value: c?.street },
                {
                  label: 'Postal address',
                  value: c?.postal_address
                    ? `P.O. Box ${c.postal_address}`
                    : null,
                },
              ]}
            />
          </SectionCard>

          <SectionCard
            title={
              kind === 'non_motor'
                ? 'Insured items'
                : kind === 'fleet'
                  ? 'Vehicles'
                  : 'Vehicle'
            }
            summary={
              kind === 'fleet'
                ? `${vehicleEntries.length} vehicles`
                : kind === 'single' && motor
                  ? [
                      str(motor.registrationNumber) ?? str(motor.chassisNumber),
                      [motor.make, motor.model].filter(Boolean).join(' '),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : `${risks.length} risk${risks.length === 1 ? '' : 's'}`
            }
            action={
              kind === 'non_motor' && onAddNonMotorDetail ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAddNonMotorDetail}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add detail
                </Button>
              ) : undefined
            }
          >
            {insuredItems ??
              (kind === 'fleet' ? (
                <FleetVehiclesTable entries={vehicleEntries} />
              ) : kind === 'single' ? (
                motor ? (
                  <KeyValueGrid
                    items={VEHICLE_FIELDS.map(([label, key]) => ({
                      label,
                      value: str(motor[key]),
                    }))}
                  />
                ) : (
                  <p className="text-sm text-slate-500">
                    This policy does not contain a motor asset.
                  </p>
                )
              ) : null)}
            {kind === 'non_motor' && nonMotorDetails.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 text-[13px]">
                {nonMotorDetails.map((detail) => (
                  <li
                    key={detail.id}
                    className="flex flex-wrap justify-between gap-2 py-2"
                  >
                    <span className="font-semibold">
                      {detail.subject_matter?.subject_code ??
                        detail.subject_matter_id}
                    </span>
                    <span className="text-slate-600">
                      {detail.policy_risk?.risk?.risk_name ?? ''}
                      {detail.insured_value
                        ? ` · ${formatMoney(Number(detail.insured_value), policy.currency)}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Cover & insurance"
            summary={
              [
                compactPeriod(policy.start_date, policy.end_date),
                daysLeftLabel(status.daysLeft),
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
          >
            <KeyValueGrid
              items={[
                { label: 'Start', value: formatDateTime(policy.start_date) },
                { label: 'End', value: formatDateTime(policy.end_date) },
                {
                  label: 'Period',
                  value: periodDays ? `${periodDays} days` : null,
                },
                {
                  label: 'Time left',
                  value:
                    status.daysLeft !== null
                      ? daysLeftLabel(status.daysLeft)
                      : null,
                },
                { label: 'Currency', value: policy.currency },
                {
                  label: 'Sum insured',
                  value: money(policy.sum_insured, policy.currency),
                },
                { label: 'Cover note no.', value: policy.cover_note_no },
                {
                  label: 'Previous cover note',
                  value: policy.previous_cover_note_reference_number,
                },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="Risks & premium"
            summary={`${risks.length} risk${risks.length === 1 ? '' : 's'} · ${formatMoney(Number(policy.total_premium), policy.currency)}`}
          >
            {risks.length ? (
              <ul className="divide-y divide-slate-100 text-[14px]">
                {risks.map((risk) => (
                  <li
                    key={risk.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <span className="font-semibold">
                      {displayValue(risk.risk?.risk_name)}
                    </span>
                    <span className="text-[13px] text-slate-600 tabular-nums">
                      Sum insured{' '}
                      {formatMoney(Number(risk.sum_insured), policy.currency)} ·
                      Premium{' '}
                      <span className="font-semibold text-slate-900">
                        {formatMoney(
                          Number(risk.total_premium),
                          policy.currency,
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No policy risks recorded.
              </p>
            )}
            {(policy.premium_breakdowns ?? []).length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <h3 className="mb-1.5 text-[13px] font-semibold text-slate-700">
                  Premium line items
                </h3>
                <dl className="space-y-1 text-[13px]">
                  {(policy.premium_breakdowns ?? [])
                    .filter((item) => item.item_type !== 'COMMISSION')
                    .map((item) => (
                      <div key={item.id} className="flex justify-between gap-3">
                        <dt className="text-slate-600">
                          {displayValue(item.item_name)}
                        </dt>
                        <dd className="font-semibold tabular-nums">
                          {formatMoney(Number(item.amount), policy.currency)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Endorsement summary"
            summary={
              latestEndorsement
                ? `${endorsements.length} endorsement${endorsements.length === 1 ? '' : 's'} · latest ${latestEndorsement.transaction_no}`
                : 'No endorsements'
            }
          >
            {latestEndorsement ? (
              <KeyValueGrid
                items={[
                  { label: 'Endorsements', value: String(endorsements.length) },
                  { label: 'Latest', value: latestEndorsement.transaction_no },
                  {
                    label: 'Effective',
                    value: formatDate(latestEndorsement.effective_date),
                  },
                  { label: 'Stage', value: str(latestEndorsement.stage) },
                  {
                    label: 'Premium change',
                    value: formatMoney(
                      Number(latestEndorsement.net_premium_difference ?? 0),
                      latestEndorsement.currency_code,
                    ),
                  },
                ]}
              />
            ) : (
              <p className="text-sm text-slate-500">
                No endorsements have been made on this policy.
              </p>
            )}
            <button
              type="button"
              onClick={onOpenEndorsements}
              className="mt-3 min-h-11 text-[13px] font-semibold text-[#3B4A8C] hover:underline sm:min-h-0"
            >
              View endorsements
            </button>
          </SectionCard>

          <SectionCard
            title="Record activity"
            summary={`Updated ${formatDate(policy.updated_at)} · ${versionsCount} version${versionsCount === 1 ? '' : 's'}`}
          >
            <KeyValueGrid
              items={[
                { label: 'Created', value: formatDateTime(policy.created_at) },
                {
                  label: 'Last updated',
                  value: formatDateTime(policy.updated_at),
                },
                {
                  label: 'Current version',
                  value: version ? `Version ${version.version_number}` : null,
                },
                { label: 'Version type', value: str(version?.version_type) },
                { label: 'Versions', value: String(versionsCount) },
                {
                  label: 'Status changes',
                  value: String((policy.status_history ?? []).length),
                },
              ]}
            />
            <button
              type="button"
              onClick={onOpenHistory}
              className="mt-3 min-h-11 text-[13px] font-semibold text-[#3B4A8C] hover:underline sm:min-h-0"
            >
              View history
            </button>
          </SectionCard>
        </SectionCards>
      </div>
    </div>
  );
}
