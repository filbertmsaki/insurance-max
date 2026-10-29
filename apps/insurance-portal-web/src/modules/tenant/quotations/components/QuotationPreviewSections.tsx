import { useMemo, useState, type ReactNode } from 'react';
import { Eye, Search } from 'lucide-react';
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
} from '@/components/shared/detailFormat';
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
import { getFriendlyTiramisStatus } from '../utils/quotationWorkflowLabels';
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
    <SectionCard title="Quotation Information">
      <KeyValueGrid
        items={[
          { label: 'Quotation Number', value: overview.quotation_no },
          { label: 'Quotation Type', value: overview.quotation_type },
          { label: 'Quotation Flow', value: overview.quotation_flow },
          {
            label: 'Quotation Status',
            value: <QuotationStatusBadge status={overview.display_status} />,
          },
          { label: 'Channel Type', value: overview.channel_type },
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
    <SectionCard title="Cover and Insurance Details">
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
          label: 'Base Premium',
          value: premium_summary.total_premium_before_discount,
        },
        {
          label: 'Discount',
          value: premium_summary.total_discount_amount,
          negative: true,
        },
        {
          label: 'Premium Excluding Tax',
          value: premium_summary.total_premium_excluding_tax,
        },
        {
          label: 'Tax',
          value: premium_summary.total_tax_amount,
        },
      ]}
      total={{
        label: 'Total Premium',
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
}: {
  policyholders: QuotationPreviewPolicyholder[];
}) {
  if (!policyholders.length)
    return <EmptyState text="No policyholders attached to this quotation." />;

  return (
    <div className="space-y-4">
      {policyholders.map((holder, index) => (
        <SectionCard
          key={`${holder.full_name ?? 'policyholder'}-${index}`}
          title={
            policyholders.length === 1
              ? 'Policyholder / Customer Details'
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
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-900">
              Premium Overrides
            </div>
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
    <SectionCard title="Subject Matters">
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
  title = 'Motor Details',
}: {
  motor: QuotationPreviewMotorDetails | null;
  title?: string;
}) {
  if (!motor) return <EmptyState text="No motor details available." />;

  return (
    <SectionCard title={title}>
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
  const variant = ['SUCCESS', 'ACCEPTED', 'SUBMITTED'].includes(normalized)
    ? 'success'
    : ['FAILED', 'REJECTED', 'ERROR'].includes(normalized)
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

export function FleetVehiclesTable({
  vehicles,
  renderRiskActions,
}: {
  vehicles: QuotationPreviewFleetVehicle[];
  renderRiskActions?: (risk: QuotationPreviewRisk) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedVehicle, setSelectedVehicle] =
    useState<QuotationPreviewFleetVehicle | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter((vehicle) =>
      [
        vehicle.motor_details?.registration_number,
        vehicle.motor_details?.make,
        vehicle.motor_details?.model,
        vehicle.cover_note_number,
        vehicle.fleet_entry_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [vehicles, search]);

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
            {displayValue(vehicle.motor_details?.registration_number)}
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
      key: 'sumInsured',
      header: 'Sum Insured',
      className: 'text-right tabular-nums',
      hideOnMobile: true,
      cell: (vehicle) => formatMoney(vehicleTotalSumInsured(vehicle)),
    },
    {
      key: 'premium',
      header: 'Premium',
      className: 'text-right tabular-nums',
      cell: (vehicle) => (
        <span className="font-medium text-slate-900">
          {formatMoney(vehicleTotalPremium(vehicle))}
        </span>
      ),
    },
    {
      key: 'tiramis',
      header: 'TIRAMIS',
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
            aria-label={`View vehicle ${displayValue(vehicle.motor_details?.registration_number)}`}
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
          placeholder="Search registration, make, model..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

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

      <Dialog
        open={selectedVehicle != null}
        onOpenChange={(open) => {
          if (!open) setSelectedVehicle(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedVehicle
                ? displayValue(
                    selectedVehicle.motor_details?.registration_number,
                  )
                : 'Vehicle'}
            </DialogTitle>
            <DialogDescription>
              Vehicle details and risks covered.
            </DialogDescription>
          </DialogHeader>
          {selectedVehicle ? (
            <FleetVehiclePreview
              vehicle={selectedVehicle}
              renderRiskActions={renderRiskActions}
            />
          ) : null}
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

export function TiramisSubmissionPreview({
  tiramis,
}: {
  tiramis: QuotationPreviewTiramisSubmission | null;
}) {
  if (!tiramis)
    return <EmptyState text="No TIRAMIS submission information available." />;

  const friendlyStatus = getFriendlyTiramisStatus(tiramis);

  return (
    <SectionCard title="TIRAMIS Submission">
      <div className="space-y-4">
        <KeyValueGrid
          items={[
            {
              label: 'Status',
              value: friendlyStatus,
            },
            { label: 'Request ID', value: displayValue(tiramis.request_id) },
            {
              label: 'Callback Status',
              value: displayValue(tiramis.callback_received_status),
            },
            {
              label: 'Callback Received',
              value: formatDateTime(tiramis.callback_received_date),
            },
            {
              label: 'TIRAMIS Cover Note Reference',
              value: displayValue(tiramis.cover_note_reference_number),
            },
            {
              label: 'Sticker Number',
              value: displayValue(tiramis.sticker_number),
            },
            {
              label: 'Submitted',
              value: formatDateTime(tiramis.date_submitted),
            },
            {
              label: 'Last Issue',
              value: displayValue(tiramis.last_submission_error),
            },
            {
              label: 'Next Retry',
              value: formatDateTime(tiramis.next_retry_time),
            },
          ]}
        />

        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Integration Details
          </summary>
          <div className="mt-4">
            <KeyValueGrid
              items={[
                {
                  label: 'Submission Status',
                  value: displayValue(tiramis.submission_status),
                },
                {
                  label: 'Submission Attempt',
                  value: displayValue(tiramis.submission_attempt_number),
                },
                {
                  label: 'Submitted By',
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
                  label: 'Acknowledgement Status Code',
                  value: displayValue(tiramis.acknowledgement_status_code),
                },
                {
                  label: 'Acknowledgement Description',
                  value: displayValue(
                    tiramis.acknowledgement_status_description,
                  ),
                },
                {
                  label: 'Acknowledgement Received',
                  value: formatDateTime(tiramis.acknowledgement_received_date),
                },
                {
                  label: 'Callback Received Status',
                  value: displayValue(tiramis.callback_received_status),
                },
                {
                  label: 'Response ID',
                  value: displayValue(tiramis.response_id),
                },
                {
                  label: 'Response Status Code',
                  value: displayValue(tiramis.response_status_code),
                },
                {
                  label: 'Response Description',
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

export function QuotationHistoryPreview({
  history,
  title = 'Quotation Activity',
}: {
  history: QuotationPreviewHistoryItem[];
  title?: string;
}) {
  const [page, setPage] = useState(1);
  const ordered = [...history].sort(
    (a, b) =>
      (Date.parse(b.date_time ?? '') || 0) -
      (Date.parse(a.date_time ?? '') || 0),
  );
  const pages = Math.max(1, Math.ceil(ordered.length / 20));
  const currentPage = Math.min(page, pages);
  return (
    <SectionCard title={title} description="Most recent activity first.">
      {!history.length ? (
        <EmptyState text="No history available." />
      ) : (
        <ol className="divide-y divide-slate-100">
          {ordered
            .slice((currentPage - 1) * 20, currentPage * 20)
            .map((item, index) => (
              <li
                key={`${item.action}-${index}`}
                className="grid min-w-0 gap-2 py-4 first:pt-0 sm:grid-cols-[10rem_minmax(0,1fr)]"
              >
                <p className="text-xs text-slate-500">
                  {formatDateTime(item.date_time)}
                </p>
                <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                  <p className="text-sm font-semibold text-slate-900">
                    {humanizeCode(item.action)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.performed_by || 'Actor not recorded'}
                  </p>
                  {(item.previous_status || item.new_status) && (
                    <p className="text-xs text-slate-600">
                      {item.previous_status
                        ? `${humanizeCode(item.previous_status)} → `
                        : ''}
                      {item.new_status ? humanizeCode(item.new_status) : '—'}
                    </p>
                  )}
                  {item.remarks && (
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {item.remarks}
                    </p>
                  )}
                </div>
              </li>
            ))}
        </ol>
      )}
      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>
            Page {currentPage} of {pages} · {history.length} events
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
