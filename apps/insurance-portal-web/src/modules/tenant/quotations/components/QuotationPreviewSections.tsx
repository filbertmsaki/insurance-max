import { useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Cog,
  Eye,
  Search,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTable, type Column } from '@/components/data-table';
import { SectionCard, KeyValueGrid } from './QuotationDetailLayout';
import { EmptyState } from '@/components/shared/DetailSections';
import { PremiumBreakdown } from '@/components/shared/PremiumBreakdown';
import {
  displayValue,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  humanizeCode,
} from '../utils/quotationFormat';
import { QuotationStatusBadge } from './QuotationStatusBadge';
import type {
  QuotationPreviewAddon,
  QuotationPreviewFleetHeader,
  QuotationPreviewFleetSummary,
  QuotationPreviewFleetVehicle,
  QuotationPreviewHistoryItem,
  QuotationPreviewMotorDetails,
  QuotationPreviewPayment,
  QuotationPreviewPolicyholder,
  QuotationPreviewPremiumOverride,
  QuotationPreviewRecord,
  QuotationPreviewRisk,
  QuotationPreviewSubjectMatter,
  QuotationPreviewTiramisSubmission,
} from '../types';
import type { CoverNoteRecord } from '@/modules/tenant/cover-notes/types';
import { getFriendlyTiramisStatus } from '../utils/quotationWorkflowLabels';
import {
  groupHistory,
  type HistoryEventKind,
  type HistoryFilter,
  type HistoryGroup,
} from '../utils/quotationHistory';
import {
  getMotorTypeLabelFromCode,
  getMotorUsageLabelFromCode,
  getOwnerCategoryLabelFromCode,
  getVehicleCategoryLabelFromCode,
} from '../wizard/utils/motorOptions';

function premiumOverrideBadgeVariant(
  status: QuotationPreviewPremiumOverride['approval_status'],
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
      return 'destructive';
    case 'PENDING':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function QuotationInformationPreview({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  const { overview } = preview;
  return (
    <SectionCard
      id="section-quotation"
      title="Quotation information"
      summary={[
        humanizeCode(overview.quotation_type),
        overview.branch.name ?? overview.branch.code,
        overview.channel_type ? humanizeCode(overview.channel_type) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <KeyValueGrid
        items={[
          { label: 'Quotation Number', value: overview.quotation_no },
          {
            label: 'Quotation Type',
            value: humanizeCode(overview.quotation_type),
          },
          {
            label: 'Quotation Flow',
            value: humanizeCode(overview.quotation_flow),
          },
          {
            label: 'Quotation Status',
            value: <QuotationStatusBadge status={overview.display_status} />,
          },
          { label: 'Channel Type', value: humanizeCode(overview.channel_type) },
          {
            label: 'Company',
            value: overview.company.name ?? overview.company.code,
          },
          {
            label: 'Branch',
            value: overview.branch.name ?? overview.branch.code,
          },
          {
            label: 'Department',
            value: overview.department.name ?? overview.department.code,
          },
          {
            label: 'Product',
            value: overview.product.name ?? overview.product.code,
          },
          {
            label: 'Insurance Category',
            value:
              overview.insurance_category.name ??
              overview.insurance_category.code,
          },
          {
            label: 'Subclass',
            value: overview.subclass.name ?? overview.subclass.code,
          },
          {
            label: 'Sales Point',
            value: overview.sales_point.name ?? overview.sales_point.code,
          },
          {
            label: 'Created By',
            value: overview.created_by.name ?? overview.created_by.code,
          },
          {
            label: 'Created Date',
            value: formatDateTime(overview.created_at),
          },
          {
            label: 'Last Updated By',
            value: overview.updated_by.name ?? overview.updated_by.code,
          },
          {
            label: 'Last Updated Date',
            value: formatDateTime(overview.updated_at),
          },
          // Approval details, once decided. Automatic approval has no
          // approver; the comment records the method (direct or rule).
          ...(overview.approval_decided_at
            ? [
                {
                  label: 'Approved By',
                  value:
                    overview.approved_by?.name ??
                    (overview.approval_comments?.startsWith('Automatically')
                      ? 'System (automatic)'
                      : null),
                },
                {
                  label: 'Approval Date',
                  value: formatDateTime(overview.approval_decided_at),
                },
                {
                  label: 'Approval Note',
                  value: overview.approval_comments,
                },
              ]
            : []),
        ]}
      />
    </SectionCard>
  );
}

export function QuotationCoverPreview({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  const { cover_note } = preview;
  return (
    <SectionCard
      id="section-cover"
      title="Cover and insurance"
      summary={
        cover_note.cover_note_start_date || cover_note.cover_note_end_date
          ? `${formatDate(cover_note.cover_note_start_date)} – ${formatDate(cover_note.cover_note_end_date)}`
          : undefined
      }
    >
      <KeyValueGrid
        items={[
          {
            label: 'Cover Note Type',
            value: displayValue(cover_note.cover_note_type),
          },
          {
            label: 'Cover Note Number',
            value: displayValue(cover_note.cover_note_number),
          },
          {
            label: 'Previous Cover Note Reference',
            value: displayValue(
              cover_note.previous_cover_note_reference_number,
            ),
          },
          {
            label: 'Description',
            value: displayValue(cover_note.cover_note_description),
          },
          {
            label: 'Operative Clause',
            value: displayValue(cover_note.operative_clause),
          },
          {
            label: 'Payment Mode',
            value: displayValue(cover_note.payment_mode),
          },
          {
            label: 'Cover Start Date',
            value: formatDateTime(cover_note.cover_note_start_date),
          },
          {
            label: 'Cover End Date',
            value: formatDateTime(cover_note.cover_note_end_date),
          },
          { label: 'Currency', value: displayValue(cover_note.currency) },
          {
            label: 'Exchange Rate',
            value: formatNumber(cover_note.exchange_rate, 6),
          },
          {
            label: 'Product Code',
            value: displayValue(cover_note.product_code),
          },
          {
            label: 'Authorizing Officer',
            value: displayValue(cover_note.authorizing_officer_name),
          },
          {
            label: 'Officer Title',
            value: displayValue(cover_note.authorizing_officer_title),
          },
          {
            label: 'Commission Rate',
            value: formatNumber(cover_note.commission_rate, 6),
          },
          {
            label: 'Commission Paid',
            value: formatMoney(cover_note.commission_paid, cover_note.currency),
          },
          {
            label: 'Endorsement Type',
            value: displayValue(cover_note.endorsement_type),
          },
          {
            label: 'Endorsement Reason',
            value: displayValue(cover_note.endorsement_reason),
          },
          {
            label: 'Endorsement Premium Earned',
            value: formatMoney(
              cover_note.endorsement_premium_earned,
              cover_note.currency,
            ),
          },
        ]}
      />
    </SectionCard>
  );
}

export function QuotationPremiumPreview({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  const { premium_summary } = preview;
  return (
    <PremiumBreakdown
      sectionComponent={SectionCard}
      currency={premium_summary.currency}
      sumInsured={premium_summary.total_sum_insured}
      rows={[
        {
          label: 'Premium before discount',
          value: premium_summary.total_premium_before_discount,
        },
        {
          label: 'Discount',
          value: premium_summary.total_discount_amount,
          negative: true,
        },
        {
          label: 'Premium excluding tax',
          value: premium_summary.total_premium_excluding_tax,
        },
        {
          label: 'Tax',
          value: premium_summary.total_tax_amount,
        },
      ]}
      total={{
        label: 'Total premium',
        value: premium_summary.total_premium_including_tax,
      }}
    />
  );
}

export function QuotationOverviewPreview({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  return (
    <>
      <QuotationInformationPreview preview={preview} />
      <QuotationCoverPreview preview={preview} />
      <QuotationPremiumPreview preview={preview} />
    </>
  );
}

export function PolicyholderPreview({
  policyholders,
  mobileCollapsible = false,
}: {
  mobileCollapsible?: boolean;
  policyholders: QuotationPreviewPolicyholder[];
}) {
  if (!policyholders.length)
    return <EmptyState text="No policyholders attached to this quotation." />;

  return (
    <div className="space-y-4">
      {policyholders.map((holder, index) => (
        <SectionCard
          mobileCollapsible={mobileCollapsible}
          key={`${holder.full_name ?? 'policyholder'}-${index}`}
          summary={[
            holder.policyholder_type
              ? humanizeCode(String(holder.policyholder_type))
              : null,
            holder.region || holder.district,
          ]
            .filter(Boolean)
            .join(' · ')}
          title={
            policyholders.length === 1
              ? 'Policyholder'
              : `Policyholder ${index + 1}`
          }
        >
          <KeyValueGrid
            items={[
              {
                label: 'Policyholder Type',
                value: displayValue(holder.policyholder_type),
              },
              {
                label: 'Full Name / Company',
                value: displayValue(holder.full_name),
              },
              ...(['2', 'CORPORATE'].includes(
                String(holder.policyholder_type).toUpperCase(),
              ) && !holder.date_of_birth
                ? []
                : [
                    {
                      label: 'Date of Birth',
                      value: formatDate(holder.date_of_birth),
                    },
                  ]),
              {
                label: 'Identification Type',
                value: displayValue(holder.identification_type),
              },
              {
                label: 'Identification Number',
                value: displayValue(holder.identification_number),
              },
              ...(['2', 'CORPORATE'].includes(
                String(holder.policyholder_type).toUpperCase(),
              ) && !holder.gender
                ? []
                : [{ label: 'Gender', value: displayValue(holder.gender) }]),
              { label: 'Country', value: displayValue(holder.country) },
              { label: 'Region', value: displayValue(holder.region) },
              { label: 'District', value: displayValue(holder.district) },
              { label: 'Street', value: displayValue(holder.street) },
              {
                label: 'Phone Number',
                value: displayValue(holder.phone_number),
              },
              { label: 'Fax Number', value: displayValue(holder.fax_number) },
              {
                label: 'Postal Address',
                value: displayValue(holder.postal_address),
              },
              {
                label: 'Email Address',
                value: displayValue(holder.email_address),
              },
            ]}
          />
        </SectionCard>
      ))}
    </div>
  );
}

function RiskSection({
  title,
  risks,
  renderRiskActions,
}: {
  title: string;
  risks: QuotationPreviewRisk[];
  renderRiskActions?: (risk: QuotationPreviewRisk) => ReactNode;
}) {
  if (!risks.length)
    return <EmptyState text={`No ${title.toLowerCase()} found.`} />;

  return (
    <div className="space-y-4">
      {risks.map((risk, index) => (
        <SectionCard
          key={`${risk.risk_code ?? 'risk'}-${index}`}
          title={`${title} ${risk.risk_number ?? index + 1}`}
          summary={[
            risk.risk_name ?? risk.risk_code,
            risk.premium_including_tax != null
              ? formatMoney(risk.premium_including_tax)
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{displayValue(risk.risk_code)}</Badge>
              <Badge variant="outline">{displayValue(risk.risk_name)}</Badge>
              {risk.premium_overrides[0] ? (
                <Badge
                  variant={premiumOverrideBadgeVariant(
                    risk.premium_overrides[0].approval_status,
                  )}
                >
                  Override{' '}
                  {risk.premium_overrides[0].approval_status.toLowerCase()}
                </Badge>
              ) : null}
            </div>
            {renderRiskActions ? (
              <div className="flex flex-wrap gap-2">
                {renderRiskActions(risk)}
              </div>
            ) : null}
          </div>
          <KeyValueGrid
            items={[
              { label: 'Sum Insured', value: formatMoney(risk.sum_insured) },
              {
                label: 'Sum Insured Equivalent',
                value: formatMoney(risk.sum_insured_equivalent),
              },
              {
                label: 'Premium Rate',
                value: formatNumber(risk.premium_rate, 6),
              },
              {
                label: 'Premium Before Discount',
                value: formatMoney(risk.premium_before_discount),
              },
              {
                label: 'Premium After Discount',
                value: formatMoney(risk.premium_after_discount),
              },
              {
                label: 'Premium Excluding Tax Equivalent',
                value: formatMoney(risk.premium_excluding_tax_equivalent),
              },
              {
                label: 'Premium Including Tax',
                value: formatMoney(risk.premium_including_tax),
              },
            ]}
          />

          <Separator className="my-4" />
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">
                Discounts
              </div>
              {risk.discounts.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risk.discounts.map((discount, discountIndex) => (
                      <TableRow
                        key={`${discount.discount_type ?? 'd'}-${discountIndex}`}
                      >
                        <TableCell>
                          {displayValue(
                            discount.discount_label ?? discount.discount_type,
                          )}
                        </TableCell>
                        <TableCell>
                          {formatNumber(discount.discount_rate, 6)}
                        </TableCell>
                        <TableCell>
                          {formatMoney(discount.discount_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState text="No discounts recorded." />
              )}
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">
                Taxes
              </div>
              {risk.taxes.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Exempted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risk.taxes.map((tax, taxIndex) => (
                      <TableRow key={`${tax.tax_code ?? 't'}-${taxIndex}`}>
                        <TableCell>
                          {displayValue(tax.tax_name ?? tax.tax_code)}
                        </TableCell>
                        <TableCell>{formatNumber(tax.tax_rate, 6)}</TableCell>
                        <TableCell>{formatMoney(tax.tax_amount)}</TableCell>
                        <TableCell>
                          {tax.is_tax_exempted ? 'Yes' : 'No'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState text="No taxes recorded." />
              )}
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

/** Premium overrides of every risk, in one section of their own. */
export function PremiumOverridesPreview({
  risks,
}: {
  risks: QuotationPreviewRisk[];
}) {
  const withOverrides = risks.filter((risk) => risk.premium_overrides.length);
  return (
    <SectionCard
      id="section-overrides"
      title="Premium overrides"
      defaultOpen={withOverrides.length > 0}
      summary={
        withOverrides.length
          ? `${withOverrides.length} ${withOverrides.length === 1 ? 'risk' : 'risks'} with overrides`
          : 'None recorded'
      }
    >
      {withOverrides.length ? (
        <div className="space-y-5">
          {withOverrides.map((risk, index) => (
            <div
              key={`${risk.risk_id}-${index}`}
              className="min-w-0 overflow-x-auto"
            >
              {withOverrides.length > 1 || risks.length > 1 ? (
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  {displayValue(risk.risk_name ?? risk.risk_code)}
                </p>
              ) : null}
              {risk.premium_overrides.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Original</TableHead>
                      <TableHead>Proposed</TableHead>
                      <TableHead>Difference</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Requested At</TableHead>
                      <TableHead>Decided By</TableHead>
                      <TableHead>Decided At</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risk.premium_overrides.map((premiumOverride) => (
                      <TableRow key={premiumOverride.id}>
                        <TableCell>
                          <Badge
                            variant={premiumOverrideBadgeVariant(
                              premiumOverride.approval_status,
                            )}
                          >
                            {premiumOverride.approval_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatMoney(
                            premiumOverride.original_calculated_premium,
                          )}
                        </TableCell>
                        <TableCell>
                          {formatMoney(premiumOverride.proposed_premium)}
                        </TableCell>
                        <TableCell>
                          {formatMoney(premiumOverride.difference_amount)}
                          {premiumOverride.difference_percentage !== null ? (
                            <div className="text-xs text-slate-500">
                              {formatNumber(
                                premiumOverride.difference_percentage,
                                4,
                              )}
                              %
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {displayValue(
                            premiumOverride.requested_by.name ??
                              premiumOverride.requested_by.code,
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDateTime(premiumOverride.requested_at)}
                        </TableCell>
                        <TableCell>
                          {displayValue(
                            premiumOverride.approved_by.name ??
                              premiumOverride.approved_by.code,
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDateTime(premiumOverride.approved_at)}
                        </TableCell>
                        <TableCell>
                          {displayValue(
                            premiumOverride.rejection_reason ??
                              premiumOverride.supporting_notes ??
                              premiumOverride.override_reason,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState text="No premium overrides recorded." />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No premium overrides recorded.</p>
      )}
    </SectionCard>
  );
}

export function RiskPreview({
  risks,
  renderRiskActions,
}: {
  risks: QuotationPreviewRisk[];
  renderRiskActions?: (risk: QuotationPreviewRisk) => ReactNode;
}) {
  return (
    <RiskSection
      title="Risk"
      risks={risks}
      renderRiskActions={renderRiskActions}
    />
  );
}

export function SubjectMatterPreview({
  subjectMatters,
}: {
  subjectMatters: QuotationPreviewSubjectMatter[];
}) {
  if (!subjectMatters.length) {
    return <EmptyState text="No subject matters attached." />;
  }

  return (
    <SectionCard
      title="Subject Matters"
      summary={`${subjectMatters.length} ${subjectMatters.length === 1 ? 'item' : 'items'}`}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Related Risk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subjectMatters.map((subject, index) => (
            <TableRow
              key={`${subject.subject_matter_reference ?? 'subject'}-${index}`}
            >
              <TableCell>
                {displayValue(subject.subject_matter_reference)}
              </TableCell>
              <TableCell>
                {displayValue(subject.subject_matter_description)}
              </TableCell>
              <TableCell>{displayValue(subject.related_risk_code)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

export function AddonPreview({ addons }: { addons: QuotationPreviewAddon[] }) {
  if (!addons.length) return <EmptyState text="No add-ons attached." />;

  return (
    <div className="space-y-4">
      {addons.map((addon, index) => (
        <SectionCard
          key={`${addon.addon_reference ?? 'addon'}-${index}`}
          title={`Add-on ${index + 1}`}
        >
          <KeyValueGrid
            items={[
              {
                label: 'Add-on Reference',
                value: displayValue(addon.addon_reference),
              },
              {
                label: 'Description',
                value: displayValue(addon.addon_description),
              },
              {
                label: 'Insured Amount',
                value: formatMoney(addon.insured_amount),
              },
              {
                label: 'Premium Rate',
                value: formatNumber(addon.premium_rate, 6),
              },
              {
                label: 'Premium Excluding Tax',
                value: formatMoney(addon.premium_excluding_tax),
              },
              {
                label: 'Premium Excluding Tax Equivalent',
                value: formatMoney(addon.premium_excluding_tax_equivalent),
              },
              {
                label: 'Premium Including Tax',
                value: formatMoney(addon.premium_including_tax),
              },
            ]}
          />
          <Separator className="my-4" />
          <div className="text-sm font-semibold text-slate-900">
            Addon Taxes
          </div>
          {addon.taxes.length ? (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Exempted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addon.taxes.map((tax, taxIndex) => (
                  <TableRow key={`${tax.tax_code ?? 't'}-${taxIndex}`}>
                    <TableCell>{displayValue(tax.tax_code)}</TableCell>
                    <TableCell>{displayValue(tax.tax_name)}</TableCell>
                    <TableCell>{formatNumber(tax.tax_rate, 6)}</TableCell>
                    <TableCell>{formatMoney(tax.tax_amount)}</TableCell>
                    <TableCell>{tax.is_tax_exempted ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState text="No addon taxes recorded." />
          )}
        </SectionCard>
      ))}
    </div>
  );
}

export function MotorDetailsPreview({
  motor,
  title = 'Vehicle',
}: {
  motor: QuotationPreviewMotorDetails | null;
  title?: string;
}) {
  if (!motor) return <EmptyState text="No motor details available." />;

  return (
    <SectionCard
      title={title}
      summary={[
        motor.registration_number || motor.chassis_number,
        [motor.make, motor.model].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <KeyValueGrid
        items={[
          {
            label: 'Motor Category',
            value:
              getVehicleCategoryLabelFromCode(
                String(motor.motor_category ?? ''),
              ) || displayValue(motor.motor_category),
          },
          {
            label: 'Motor Type',
            value:
              getMotorTypeLabelFromCode(motor.motor_type) ||
              displayValue(motor.motor_type),
          },
          {
            label: 'Registration Number',
            value: displayValue(motor.registration_number),
          },
          {
            label: 'Chassis Number',
            value: displayValue(motor.chassis_number),
          },
          { label: 'Make', value: displayValue(motor.make) },
          { label: 'Model', value: displayValue(motor.model) },
          { label: 'Model Number', value: displayValue(motor.model_number) },
          { label: 'Body Type', value: displayValue(motor.body_type) },
          { label: 'Colour', value: displayValue(motor.colour) },
          { label: 'Engine Number', value: displayValue(motor.engine_number) },
          {
            label: 'Engine Capacity',
            value: displayValue(motor.engine_capacity),
          },
          { label: 'Fuel Used', value: displayValue(motor.fuel_used) },
          {
            label: 'Number of Axles',
            value: displayValue(motor.number_of_axles),
          },
          { label: 'Axle Distance', value: displayValue(motor.axle_distance) },
          {
            label: 'Seating Capacity',
            value: displayValue(motor.seating_capacity),
          },
          {
            label: 'Year of Manufacture',
            value: displayValue(motor.year_of_manufacture),
          },
          { label: 'Tare Weight', value: displayValue(motor.tare_weight) },
          { label: 'Gross Weight', value: displayValue(motor.gross_weight) },
          {
            label: 'Motor Usage',
            value:
              getMotorUsageLabelFromCode(motor.motor_usage) ||
              displayValue(motor.motor_usage),
          },
          { label: 'Owner Name', value: displayValue(motor.owner_name) },
          {
            label: 'Owner Category',
            value:
              getOwnerCategoryLabelFromCode(motor.owner_category) ||
              displayValue(motor.owner_category),
          },
          { label: 'Owner Address', value: displayValue(motor.owner_address) },
        ]}
      />
    </SectionCard>
  );
}

export function FleetHeaderPreview({
  header,
  summary,
}: {
  header: QuotationPreviewFleetHeader;
  summary: QuotationPreviewFleetSummary;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Fleet Header">
        <KeyValueGrid
          items={[
            { label: 'Fleet ID', value: displayValue(header.fleet_id) },
            {
              label: 'Fleet Type',
              value: displayValue(header.fleet_type_label ?? header.fleet_type),
            },
            { label: 'Fleet Size', value: displayValue(header.fleet_size) },
            {
              label: 'Comprehensively Insured Vehicles',
              value: displayValue(header.comprehensive_insured),
            },
            {
              label: 'Cover Note Type',
              value: displayValue(header.cover_note_type),
            },
            {
              label: 'Sales Point',
              value: displayValue(header.sales_point_code),
            },
            {
              label: 'Cover Start Date',
              value: formatDateTime(header.cover_start_date),
            },
            {
              label: 'Cover End Date',
              value: formatDateTime(header.cover_end_date),
            },
            { label: 'Payment Mode', value: displayValue(header.payment_mode) },
            { label: 'Currency', value: displayValue(header.currency) },
            {
              label: 'Exchange Rate',
              value: formatNumber(header.exchange_rate, 6),
            },
            { label: 'Product Code', value: displayValue(header.product_code) },
            {
              label: 'Commission Rate',
              value: formatNumber(header.commission_rate, 6),
            },
            {
              label: 'Commission Paid',
              value: formatMoney(header.commission_paid, header.currency),
            },
            {
              label: 'Authorizing Officer',
              value: displayValue(header.authorizing_officer_name),
            },
            {
              label: 'Officer Title',
              value: displayValue(header.authorizing_officer_title),
            },
            {
              label: 'Total Premium Excluding Tax',
              value: formatMoney(
                header.total_premium_excluding_tax,
                header.currency,
              ),
            },
            {
              label: 'Total Premium Including Tax',
              value: formatMoney(
                header.total_premium_including_tax,
                header.currency,
              ),
            },
          ]}
        />
      </SectionCard>

      <SectionCard title="Fleet Summary">
        <KeyValueGrid
          items={[
            {
              label: 'Declared Fleet Size',
              value: displayValue(summary.declared_fleet_size),
            },
            {
              label: 'Vehicles Saved',
              value: displayValue(summary.saved_vehicle_count),
            },
            {
              label: 'Comprehensive Vehicles',
              value: displayValue(summary.comprehensive_vehicle_count),
            },
            {
              label: 'Third Party Vehicles',
              value: displayValue(summary.third_party_vehicle_count),
            },
            {
              label: 'Total Fleet Sum Insured',
              value: formatMoney(summary.total_fleet_sum_insured),
            },
            {
              label: 'Total Risk Premium',
              value: formatMoney(summary.total_risk_premium),
            },
            {
              label: 'Total Add-on Premium',
              value: formatMoney(summary.total_addon_premium),
            },
            {
              label: 'Total Discounts',
              value: formatMoney(summary.total_discounts),
            },
            { label: 'Total Taxes', value: formatMoney(summary.total_taxes) },
            {
              label: 'Total Premium Excluding Tax',
              value: formatMoney(summary.total_premium_excluding_tax),
            },
            {
              label: 'Total Premium Including Tax',
              value: formatMoney(summary.total_premium_including_tax),
            },
            {
              label: 'Successful Entries',
              value: displayValue(summary.successful_entries),
            },
            {
              label: 'Failed Entries',
              value: displayValue(summary.failed_entries),
            },
            {
              label: 'Pending Entries',
              value: displayValue(summary.pending_entries),
            },
          ]}
        />
        {summary.declared_fleet_size !== null &&
        summary.declared_fleet_size !== summary.saved_vehicle_count ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Declared fleet size and saved vehicles differ.
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function tiramisStatusBadge(status: string | null | undefined) {
  if (!status) return <Badge variant="muted">Not submitted</Badge>;
  const normalized = status.toUpperCase();
  // TIRA's final outcome is FINAL_SUCCESS / FINAL_FAILED; ACK_* are interim.
  const variant = [
    'SUCCESS',
    'FINAL_SUCCESS',
    'ACCEPTED',
    'SUBMITTED',
  ].includes(normalized)
    ? 'success'
    : /FAILED|REJECTED|ERROR|EXHAUSTED/.test(normalized)
      ? 'destructive'
      : 'warning';
  return <Badge variant={variant}>{humanizeCode(status)}</Badge>;
}

/** Sum of already-computed line-item premiums for display — not a recalculation, the backend doesn't return a per-vehicle total. */
function vehicleTotalPremium(vehicle: QuotationPreviewFleetVehicle) {
  return (
    vehicle.risks.reduce(
      (sum, risk) => sum + (risk.premium_including_tax ?? 0),
      0,
    ) +
    vehicle.addons.reduce(
      (sum, addon) => sum + (addon.premium_including_tax ?? 0),
      0,
    )
  );
}

function vehicleTotalSumInsured(vehicle: QuotationPreviewFleetVehicle) {
  return vehicle.risks.reduce((sum, risk) => sum + (risk.sum_insured ?? 0), 0);
}

/** Registration number, or the chassis number for unregistered vehicles. */
function vehicleIdentifier(vehicle: QuotationPreviewFleetVehicle) {
  return (
    vehicle.motor_details?.registration_number?.trim() ||
    vehicle.motor_details?.chassis_number?.trim() ||
    null
  );
}

interface FleetVehicleTiraRefs {
  coverNote: string | null;
  reference: string | null;
  sticker: string | null;
}

/**
 * Cover note per fleet entry. An entry can have several notes over time
 * (re-issues, cancellations); the issued one wins, then the most recent.
 */
function coverNotesByEntry(coverNotes: CoverNoteRecord[] = []) {
  const byEntry = new Map<number, CoverNoteRecord>();
  for (const note of coverNotes) {
    if (note.fleet_entry == null) continue;
    const current = byEntry.get(note.fleet_entry);
    const rank = (n: CoverNoteRecord) =>
      `${n.status === 'ISSUED' ? 1 : 0}|${n.issued_at ?? ''}`;
    if (!current || rank(note) > rank(current))
      byEntry.set(note.fleet_entry, note);
  }
  return byEntry;
}

export function FleetVehiclesTable({
  vehicles,
  currency,
  coverNotes,
  renderRiskActions,
}: {
  currency?: string;
  vehicles: QuotationPreviewFleetVehicle[];
  /** Issued cover notes for the quotation, matched to vehicles by fleet entry. */
  coverNotes?: CoverNoteRecord[];
  renderRiskActions?: (risk: QuotationPreviewRisk) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedVehicle, setSelectedVehicle] =
    useState<QuotationPreviewFleetVehicle | null>(null);

  const notesByEntry = useMemo(
    () => coverNotesByEntry(coverNotes),
    [coverNotes],
  );
  /** The vehicle's own cover note first, then its TIRA response. */
  const tiraRefs = (
    vehicle: QuotationPreviewFleetVehicle,
  ): FleetVehicleTiraRefs => {
    const note =
      vehicle.fleet_entry_number != null
        ? notesByEntry.get(vehicle.fleet_entry_number)
        : undefined;
    return {
      coverNote: note?.cover_note_number ?? vehicle.cover_note_number,
      reference:
        note?.cover_note_reference_number ??
        vehicle.tiramis?.cover_note_reference_number ??
        null,
      sticker: note?.sticker_number ?? vehicle.tiramis?.sticker_number ?? null,
    };
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter((vehicle) =>
      [
        vehicle.motor_details?.registration_number,
        vehicle.motor_details?.chassis_number,
        vehicle.motor_details?.make,
        vehicle.motor_details?.model,
        vehicle.fleet_entry_number,
        ...Object.values(tiraRefs(vehicle)),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
    // tiraRefs only reads notesByEntry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, search, notesByEntry]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const pageVehicles = filtered.slice((page - 1) * limit, page * limit);

  if (!vehicles.length)
    return <EmptyState text="No fleet vehicles available." />;

  const columns: Column<QuotationPreviewFleetVehicle>[] = [
    {
      key: 'registration',
      header: 'Reg. No.',
      cell: (vehicle) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900">
            {displayValue(vehicleIdentifier(vehicle))}
          </p>
          <p className="text-xs text-slate-500">
            Entry {displayValue(vehicle.fleet_entry_number)}
            <span className="md:hidden">
              {' · '}
              {[vehicle.motor_details?.make, vehicle.motor_details?.model]
                .filter(Boolean)
                .join(' ')}
            </span>
          </p>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      hideOnMobile: true,
      cell: (vehicle) =>
        `${displayValue(vehicle.motor_details?.make)} ${displayValue(vehicle.motor_details?.model)}`,
    },
    {
      key: 'cover',
      header: 'Cover',
      hideOnMobile: true,
      cell: (vehicle) => displayValue(vehicle.risks[0]?.risk_name),
    },
    {
      key: 'coverNote',
      header: 'Cover note',
      hideOnMobile: true,
      cell: (vehicle) => (
        <span className="font-mono text-xs">
          {displayValue(tiraRefs(vehicle).coverNote)}
        </span>
      ),
    },
    {
      key: 'coverNoteRef',
      header: 'TIRA reference',
      hideOnMobile: true,
      cell: (vehicle) => (
        <span className="font-mono text-xs">
          {displayValue(tiraRefs(vehicle).reference)}
        </span>
      ),
    },
    {
      key: 'sticker',
      header: 'Sticker',
      hideOnMobile: true,
      cell: (vehicle) => (
        <span className="font-mono text-xs">
          {displayValue(tiraRefs(vehicle).sticker)}
        </span>
      ),
    },
    {
      key: 'sumInsured',
      header: 'Sum Insured',
      className: 'text-right tabular-nums',
      hideOnMobile: true,
      cell: (vehicle) => formatMoney(vehicleTotalSumInsured(vehicle), currency),
    },
    {
      key: 'premium',
      header: 'Premium',
      className: 'text-right tabular-nums',
      cell: (vehicle) => (
        <span className="font-medium text-slate-900">
          {formatMoney(vehicleTotalPremium(vehicle), currency)}
        </span>
      ),
    },
    {
      key: 'tiramis',
      header: 'TIRA',
      hideOnMobile: true,
      cell: (vehicle) => tiramisStatusBadge(vehicle.tiramis?.submission_status),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (vehicle) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`View vehicle ${displayValue(vehicleIdentifier(vehicle))}`}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedVehicle(vehicle);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="relative w-full sm:max-w-sm">
        <Search
          className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
          aria-hidden="true"
        />
        <Input
          aria-label="Search vehicles"
          placeholder="Search registration, make, sticker, cover note..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="min-h-11 pl-9 text-base sm:text-sm"
        />
      </div>

      {filtered.length === 0 && (
        <p
          role="status"
          className="py-6 text-center text-sm text-slate-500 md:hidden"
        >
          No vehicles match your search.
        </p>
      )}
      <ul className="space-y-3 md:hidden">
        {pageVehicles.map((vehicle) => (
          <li
            key={vehicle.fleet_entry_number}
            className="rounded-lg border border-slate-200 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold">
                  {vehicleIdentifier(vehicle) || 'Vehicle'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {[vehicle.motor_details?.make, vehicle.motor_details?.model]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              </div>
              {tiramisStatusBadge(vehicle.tiramis?.submission_status)}
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Cover</dt>
                <dd>
                  {vehicle.risks
                    .map((risk) => risk.risk_name)
                    .filter(Boolean)
                    .join(', ') || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Cover note</dt>
                <dd className="break-all font-mono text-xs">
                  {displayValue(tiraRefs(vehicle).coverNote)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">TIRA reference</dt>
                <dd className="break-all font-mono text-xs">
                  {displayValue(tiraRefs(vehicle).reference)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Sticker</dt>
                <dd className="break-all font-mono text-xs">
                  {displayValue(tiraRefs(vehicle).sticker)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Sum insured</dt>
                <dd className="break-words tabular-nums">
                  {formatMoney(vehicleTotalSumInsured(vehicle), currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Premium incl. tax</dt>
                <dd className="break-words font-semibold tabular-nums">
                  {formatMoney(vehicleTotalPremium(vehicle), currency)}
                </dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11 w-full"
              onClick={() => setSelectedVehicle(vehicle)}
            >
              View details
              <span className="sr-only">
                {' '}
                for vehicle {vehicle.fleet_entry_number}
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="[&_table]:hidden md:[&_table]:table">
        <DataTable
          columns={columns}
          data={pageVehicles}
          page={page}
          limit={limit}
          total={filtered.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          showColumnVisibility={false}
          onRowClick={setSelectedVehicle}
        />
      </div>

      <Dialog
        open={selectedVehicle != null}
        onOpenChange={(open) => {
          if (!open) setSelectedVehicle(null);
        }}
      >
        <DialogContent className="flex max-w-3xl max-h-[90dvh] flex-col overflow-hidden p-0 max-sm:inset-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
          <DialogHeader className="shrink-0 border-b border-slate-100 p-4 pr-12 sm:p-6">
            <DialogTitle>
              {(selectedVehicle && vehicleIdentifier(selectedVehicle)) ||
                'Vehicle'}
            </DialogTitle>
            <DialogDescription>
              Vehicle details and risks covered.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            {selectedVehicle ? (
              <FleetVehiclePreview
                vehicle={selectedVehicle}
                renderRiskActions={renderRiskActions}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FleetVehiclePreview({
  vehicle,
  renderRiskActions,
}: {
  vehicle: QuotationPreviewFleetVehicle;
  renderRiskActions?: (risk: QuotationPreviewRisk) => ReactNode;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Vehicle Cover Note Information">
        <KeyValueGrid
          items={[
            {
              label: 'Fleet Entry Number',
              value: displayValue(vehicle.fleet_entry_number),
            },
            {
              label: 'Cover Note Number',
              value: displayValue(vehicle.cover_note_number),
            },
            {
              label: 'Previous Cover Note Reference',
              value: displayValue(vehicle.previous_cover_note_reference_number),
            },
            {
              label: 'Description',
              value: displayValue(vehicle.cover_note_description),
            },
            {
              label: 'Operative Clause',
              value: displayValue(vehicle.operative_clause),
            },
            {
              label: 'Endorsement Type',
              value: displayValue(vehicle.endorsement_type),
            },
            {
              label: 'Endorsement Reason',
              value: displayValue(vehicle.endorsement_reason),
            },
            {
              label: 'Endorsement Premium Earned',
              value: formatMoney(vehicle.endorsement_premium_earned),
            },
          ]}
        />
      </SectionCard>

      <RiskSection
        title="Vehicle Risk"
        risks={vehicle.risks}
        renderRiskActions={renderRiskActions}
      />
      <SectionCard title="Vehicle Subject Matters">
        {vehicle.subject_matters.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Related Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicle.subject_matters.map((subject, index) => (
                <TableRow
                  key={`${subject.subject_matter_reference ?? 'subject'}-${index}`}
                >
                  <TableCell>
                    {displayValue(subject.subject_matter_reference)}
                  </TableCell>
                  <TableCell>
                    {displayValue(subject.subject_matter_description)}
                  </TableCell>
                  <TableCell>
                    {displayValue(subject.related_risk_code)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState text="No subject matters recorded." />
        )}
      </SectionCard>

      <AddonPreview addons={vehicle.addons} />
      <MotorDetailsPreview
        motor={vehicle.motor_details}
        title="Vehicle Motor Details"
      />

      <TiramisSubmissionPreview tiramis={vehicle.tiramis} />
    </div>
  );
}

export function PaymentPreview({
  payment,
}: {
  payment: QuotationPreviewPayment | null;
}) {
  if (!payment) return <EmptyState text="No payment information available." />;

  return (
    <SectionCard title="Payment Information">
      <KeyValueGrid
        items={[
          {
            label: 'Quotation Payment Status',
            value: displayValue(payment.quotation_payment_status),
          },
          {
            label: 'Payment Status',
            value: displayValue(payment.payment_status),
          },
          {
            label: 'Payment Method',
            value: displayValue(payment.payment_method),
          },
          {
            label: 'Payment Reference',
            value: displayValue(payment.payment_reference),
          },
          {
            label: 'Receipt Number',
            value: displayValue(payment.receipt_number),
          },
          {
            label: 'Amount Paid',
            value: formatMoney(payment.amount_paid, payment.currency),
          },
          {
            label: 'Payment Date',
            value: formatDateTime(payment.payment_date),
          },
          { label: 'Currency', value: displayValue(payment.currency) },
          {
            label: 'Outstanding Amount',
            value: formatMoney(payment.outstanding_amount, payment.currency),
          },
          {
            label: 'Verification Status',
            value: displayValue(payment.verification_status),
          },
          {
            label: 'Invoice Number',
            value: displayValue(payment.invoice_number),
          },
        ]}
      />
    </SectionCard>
  );
}

const TIRA_TONE: Record<string, string> = {
  Issued: 'border-green-200 bg-green-50 text-green-800',
  Issuing: 'border-sky-200 bg-sky-50 text-sky-800',
  'Ready to Issue': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Not Issued': 'border-slate-200 bg-slate-100 text-slate-700',
  Rejected: 'border-red-200 bg-red-50 text-red-800',
  'Action Required': 'border-red-200 bg-red-50 text-red-800',
};

export function TiramisSubmissionPreview({
  tiramis,
}: {
  tiramis: QuotationPreviewTiramisSubmission | null;
}) {
  if (!tiramis)
    return <EmptyState text="No TIRA submission information available." />;

  const friendlyStatus = getFriendlyTiramisStatus(tiramis);
  const failed =
    friendlyStatus === 'Rejected' || friendlyStatus === 'Action Required';
  const error =
    tiramis.last_submission_error ||
    (friendlyStatus === 'Rejected'
      ? tiramis.response_status_description
      : null);

  return (
    <SectionCard title="TIRA submission">
      <div className="space-y-4">
        <div
          className={
            'rounded-lg border p-4 ' +
            (failed ? 'border-red-200 bg-red-50/40' : 'border-slate-200')
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span
              className={
                'inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-semibold ' +
                (TIRA_TONE[friendlyStatus] ?? TIRA_TONE['Not Issued'])
              }
            >
              {friendlyStatus}
            </span>
            {tiramis.submission_attempt_number &&
            tiramis.submission_attempt_number > 1 ? (
              <span className="text-[13px] text-slate-600">
                Attempt {tiramis.submission_attempt_number}
              </span>
            ) : null}
          </div>
          <KeyValueGrid
            items={[
              { label: 'Request ID', value: displayValue(tiramis.request_id) },
              {
                label: 'Cover note reference',
                value: displayValue(tiramis.cover_note_reference_number),
              },
              {
                label: 'Sticker number',
                value: displayValue(tiramis.sticker_number),
              },
              {
                label: 'Submitted at',
                value: formatDateTime(tiramis.date_submitted),
              },
              {
                label: 'Callback status',
                value: displayValue(tiramis.callback_received_status),
              },
              {
                label: 'Callback received',
                value: formatDateTime(tiramis.callback_received_date),
              },
            ]}
          />
        </div>

        {error || tiramis.next_retry_time ? (
          <div
            role={error ? 'alert' : undefined}
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error && (
              <p className="[overflow-wrap:anywhere]">
                <span className="font-semibold">Last error:</span>{' '}
                {displayValue(error)}
              </p>
            )}
            {tiramis.next_retry_time && (
              <p className={error ? 'mt-1' : undefined}>
                <span className="font-semibold">Next retry:</span>{' '}
                {formatDateTime(tiramis.next_retry_time)}
              </p>
            )}
          </div>
        ) : null}

        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Integration details
          </summary>
          <div className="mt-4">
            <KeyValueGrid
              items={[
                {
                  label: 'Submission status',
                  value: displayValue(tiramis.submission_status),
                },
                {
                  label: 'Submission attempt',
                  value: displayValue(tiramis.submission_attempt_number),
                },
                {
                  label: 'Submitted by',
                  value: displayValue(tiramis.submitted_by),
                },
                {
                  label: 'Environment',
                  value: displayValue(tiramis.tiramis_environment),
                },
                {
                  label: 'Acknowledgement ID',
                  value: displayValue(tiramis.acknowledgement_id),
                },
                {
                  label: 'Acknowledgement status code',
                  value: displayValue(tiramis.acknowledgement_status_code),
                },
                {
                  label: 'Acknowledgement description',
                  value: displayValue(
                    tiramis.acknowledgement_status_description,
                  ),
                },
                {
                  label: 'Acknowledgement received',
                  value: formatDateTime(tiramis.acknowledgement_received_date),
                },
                {
                  label: 'Response ID',
                  value: displayValue(tiramis.response_id),
                },
                {
                  label: 'Response status code',
                  value: displayValue(tiramis.response_status_code),
                },
                {
                  label: 'Response description',
                  value: displayValue(tiramis.response_status_description),
                },
              ]}
            />
          </div>
        </details>
      </div>
    </SectionCard>
  );
}

const HISTORY_FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'user', label: 'User actions' },
  { value: 'system', label: 'System' },
  { value: 'errors', label: 'Errors' },
];

const KIND_STYLE: Record<
  HistoryEventKind,
  { icon: typeof Eye; className: string; label: string }
> = {
  success: {
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700',
    label: 'Success',
  },
  failure: {
    icon: XCircle,
    className: 'bg-red-100 text-red-700',
    label: 'Error',
  },
  payment: {
    icon: Wallet,
    className: 'bg-amber-100 text-amber-800',
    label: 'Payment',
  },
  user: {
    icon: UserRound,
    className: 'bg-blue-100 text-blue-700',
    label: 'User action',
  },
  system: {
    icon: Cog,
    className: 'bg-slate-100 text-slate-600',
    label: 'System',
  },
};

function HistoryEntry({ group }: { group: HistoryGroup }) {
  const [expanded, setExpanded] = useState(false);
  const event = group.latest;
  const style = KIND_STYLE[event.kind];
  const Icon = style.icon;
  const failure = event.kind === 'failure';
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <span
        aria-hidden
        className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-slate-200"
      />
      <span
        className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.className}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
        <span className="sr-only">{style.label}</span>
      </span>
      <div
        className={
          'min-w-0 flex-1 [overflow-wrap:anywhere] ' +
          (failure ? 'rounded-lg border border-red-200 bg-red-50/60 p-3' : '')
        }
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p
            className={
              'text-[15px] font-semibold ' +
              (failure ? 'text-red-800' : 'text-slate-900')
            }
          >
            {event.title}
            {group.count > 1 && (
              <span className="ml-1.5 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                ×{group.count}
              </span>
            )}
          </p>
        </div>
        <p className="mt-0.5 text-[13px] text-slate-500">
          {event.actor} · {formatDateTime(event.dateTime)}
          {group.count > 1 &&
            ` (latest; first ${formatDateTime(
              group.events[group.events.length - 1].dateTime,
            )})`}
        </p>
        {event.transition && (
          <p className="mt-1 text-[13px] text-slate-600">{event.transition}</p>
        )}
        {event.remarks && (
          <p
            className={
              'mt-1 whitespace-pre-wrap text-sm ' +
              (failure ? 'text-red-800' : 'text-slate-700')
            }
          >
            {event.remarks}
          </p>
        )}
        {group.count > 1 && (
          <>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="mt-2 min-h-11 text-[13px] font-medium text-blue-700 hover:underline sm:min-h-0"
            >
              {expanded ? 'Hide occurrences' : `Show all ${group.count}`}
            </button>
            {expanded && (
              <ul className="mt-2 space-y-1 border-l border-slate-200 pl-3 text-[13px] text-slate-600">
                {group.events.map((item, index) => (
                  <li key={index}>
                    {formatDateTime(item.dateTime)} · {item.actor}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Vertical activity timeline, newest first. Consecutive duplicates are
 * grouped, automated events show "System", and errors are highlighted. This
 * only changes presentation; stored history is untouched.
 */
export function QuotationHistoryPreview({
  history,
  title = 'Quotation activity',
  showFilters = true,
}: {
  history: QuotationPreviewHistoryItem[];
  title?: string;
  showFilters?: boolean;
}) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [page, setPage] = useState(1);
  const groups = useMemo(
    () => groupHistory(history, showFilters ? filter : 'all'),
    [history, filter, showFilters],
  );
  const errorCount = useMemo(
    () => groupHistory(history, 'errors').length,
    [history],
  );
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(groups.length / pageSize));
  const currentPage = Math.min(page, pages);

  return (
    <SectionCard title={title} description="Most recent activity first.">
      {showFilters && history.length > 0 && (
        <div
          role="radiogroup"
          aria-label="Filter activity"
          className="mb-5 flex flex-wrap gap-2"
        >
          {HISTORY_FILTERS.map((option) => {
            const selected = option.value === filter;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setFilter(option.value);
                  setPage(1);
                }}
                className={
                  'min-h-11 rounded-full border px-4 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-9 ' +
                  (selected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                }
              >
                {option.label}
                {option.value === 'errors' && errorCount > 0
                  ? ` (${errorCount})`
                  : ''}
              </button>
            );
          })}
        </div>
      )}
      {!history.length ? (
        <EmptyState text="No history available." />
      ) : !groups.length ? (
        <p className="text-sm text-slate-500">No matching activity.</p>
      ) : (
        <ol className="[&>li:last-child>span:first-child]:hidden">
          {groups
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map((group) => (
              <HistoryEntry key={group.key} group={group} />
            ))}
        </ol>
      )}
      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[13px] text-slate-500">
          <span>
            Page {currentPage} of {pages} · {groups.length} entries
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
