import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type {
  QuotationPreviewAddon,
  QuotationPreviewFleetHeader,
  QuotationPreviewFleetSummary,
  QuotationPreviewFleetVehicle,
  QuotationPreviewHistoryItem,
  QuotationPreviewMotorDetails,
  QuotationPreviewPayment,
  QuotationPreviewPolicyholder,
  QuotationPreviewRecord,
  QuotationPreviewRisk,
  QuotationPreviewSubjectMatter,
  QuotationPreviewTiramisSubmission,
} from '../types';

function displayValue(value: unknown) {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'string' && !value.trim()) return 'N/A';
  if (Array.isArray(value) && value.length === 0) return 'N/A';
  return String(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'TZS',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
  }).format(value);
}

function labelFor(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return 'N/A';
  return String(value);
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <p className="text-sm text-slate-500">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KeyValueGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; meta?: string }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {item.label}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">{item.value}</div>
          {item.meta ? (
            <div className="mt-1 text-xs text-slate-500">{item.meta}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text = 'No data available' }: { text?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export function QuotationOverviewPreview({
  preview,
}: {
  preview: QuotationPreviewRecord;
}) {
  const { overview, cover_note, premium_summary } = preview;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Quotation Information"
        description="Core quotation, company and sales context."
      >
        <KeyValueGrid
          items={[
            { label: 'Quotation Number', value: overview.quotation_no },
            { label: 'Quotation Type', value: overview.quotation_type },
            { label: 'Quotation Flow', value: overview.quotation_flow },
            { label: 'Quotation Status', value: overview.quotation_status },
            { label: 'Channel Type', value: overview.channel_type },
            { label: 'Company', value: overview.company.name ?? overview.company.code },
            { label: 'Branch', value: overview.branch.name ?? overview.branch.code },
            { label: 'Department', value: overview.department.name ?? overview.department.code },
            { label: 'Product', value: overview.product.name ?? overview.product.code },
            {
              label: 'Insurance Category',
              value: overview.insurance_category.name ?? overview.insurance_category.code,
            },
            { label: 'Subclass', value: overview.subclass.name ?? overview.subclass.code },
            { label: 'Sales Point', value: overview.sales_point.name ?? overview.sales_point.code },
            { label: 'Created By', value: overview.created_by.name ?? overview.created_by.code },
            { label: 'Created Date', value: formatDateTime(overview.created_at) },
            { label: 'Last Updated By', value: overview.updated_by.name ?? overview.updated_by.code },
            { label: 'Last Updated Date', value: formatDateTime(overview.updated_at) },
          ]}
        />
      </SectionCard>

      <SectionCard title="Cover Note Information">
        <KeyValueGrid
          items={[
            { label: 'Cover Note Type', value: labelFor(cover_note.cover_note_type) },
            { label: 'Cover Note Number', value: displayValue(cover_note.cover_note_number) },
            {
              label: 'Previous Cover Note Reference',
              value: displayValue(cover_note.previous_cover_note_reference_number),
            },
            { label: 'Start Date', value: formatDateTime(cover_note.cover_note_start_date) },
            { label: 'End Date', value: formatDateTime(cover_note.cover_note_end_date) },
            { label: 'Description', value: displayValue(cover_note.cover_note_description) },
            { label: 'Operative Clause', value: displayValue(cover_note.operative_clause) },
            { label: 'Payment Mode', value: labelFor(cover_note.payment_mode) },
            { label: 'Currency', value: displayValue(cover_note.currency) },
            { label: 'Exchange Rate', value: formatNumber(cover_note.exchange_rate, 6) },
            { label: 'Product Code', value: displayValue(cover_note.product_code) },
            { label: 'Authorizing Officer', value: displayValue(cover_note.authorizing_officer_name) },
            { label: 'Officer Title', value: displayValue(cover_note.authorizing_officer_title) },
            { label: 'Commission Rate', value: formatNumber(cover_note.commission_rate, 6) },
            { label: 'Commission Paid', value: formatMoney(cover_note.commission_paid, cover_note.currency) },
            { label: 'Endorsement Type', value: displayValue(cover_note.endorsement_type) },
            { label: 'Endorsement Reason', value: displayValue(cover_note.endorsement_reason) },
            {
              label: 'Endorsement Premium Earned',
              value: formatMoney(cover_note.endorsement_premium_earned, cover_note.currency),
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Premium Summary"
        description="Stored totals and derived premium summary."
      >
        <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Stored values come from the quotation record. Detailed line items below show the components used to reach the totals.
        </div>
        <KeyValueGrid
          items={[
            { label: 'Total Sum Insured', value: formatMoney(premium_summary.total_sum_insured, premium_summary.currency) },
            {
              label: 'Total Premium Before Discount',
              value: formatMoney(premium_summary.total_premium_before_discount, premium_summary.currency),
              meta: 'Calculated',
            },
            {
              label: 'Total Discount Amount',
              value: formatMoney(premium_summary.total_discount_amount, premium_summary.currency),
              meta: 'Calculated',
            },
            {
              label: 'Total Premium After Discount',
              value: formatMoney(premium_summary.total_premium_after_discount, premium_summary.currency),
              meta: 'Calculated',
            },
            {
              label: 'Total Premium Excluding Tax',
              value: formatMoney(premium_summary.total_premium_excluding_tax, premium_summary.currency),
            },
            {
              label: 'Total Tax Amount',
              value: formatMoney(premium_summary.total_tax_amount, premium_summary.currency),
              meta: 'Calculated',
            },
            {
              label: 'Total Premium Including Tax',
              value: formatMoney(premium_summary.total_premium_including_tax, premium_summary.currency),
            },
            {
              label: 'Equivalent Premium Excluding Tax',
              value: formatMoney(premium_summary.equivalent_premium_excluding_tax, premium_summary.currency),
            },
            {
              label: 'Equivalent Premium Including Tax',
              value: formatMoney(premium_summary.equivalent_premium_including_tax, premium_summary.currency),
            },
            { label: 'Currency', value: displayValue(premium_summary.currency) },
            { label: 'Exchange Rate', value: formatNumber(premium_summary.exchange_rate, 6) },
          ]}
        />
      </SectionCard>
    </div>
  );
}

export function PolicyholderPreview({
  policyholders,
}: {
  policyholders: QuotationPreviewPolicyholder[];
}) {
  if (!policyholders.length) return <EmptyState text="No policyholders attached to this quotation." />;

  return (
    <div className="space-y-4">
      {policyholders.map((holder, index) => (
        <SectionCard key={`${holder.full_name ?? 'policyholder'}-${index}`} title={`Policyholder ${index + 1}`}>
          <KeyValueGrid
            items={[
              { label: 'Policyholder Type', value: displayValue(holder.policyholder_type) },
              { label: 'Full Name / Company', value: displayValue(holder.full_name) },
              { label: 'Date of Birth', value: formatDate(holder.date_of_birth) },
              { label: 'Identification Type', value: displayValue(holder.identification_type) },
              { label: 'Identification Number', value: displayValue(holder.identification_number) },
              { label: 'Gender', value: displayValue(holder.gender) },
              { label: 'Country', value: displayValue(holder.country) },
              { label: 'Region', value: displayValue(holder.region) },
              { label: 'District', value: displayValue(holder.district) },
              { label: 'Street', value: displayValue(holder.street) },
              { label: 'Phone Number', value: displayValue(holder.phone_number) },
              { label: 'Fax Number', value: displayValue(holder.fax_number) },
              { label: 'Postal Address', value: displayValue(holder.postal_address) },
              { label: 'Email Address', value: displayValue(holder.email_address) },
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
}: {
  title: string;
  risks: QuotationPreviewRisk[];
}) {
  if (!risks.length) return <EmptyState text={`No ${title.toLowerCase()} found.`} />;

  return (
    <div className="space-y-4">
      {risks.map((risk, index) => (
        <SectionCard key={`${risk.risk_code ?? 'risk'}-${index}`} title={`${title} ${risk.risk_number ?? index + 1}`}>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{displayValue(risk.risk_code)}</Badge>
            <Badge variant="outline">{displayValue(risk.risk_name)}</Badge>
          </div>
          <KeyValueGrid
            items={[
              { label: 'Risk Code', value: displayValue(risk.risk_code) },
              { label: 'Risk Name', value: displayValue(risk.risk_name) },
              { label: 'Sum Insured', value: formatMoney(risk.sum_insured) },
              { label: 'Sum Insured Equivalent', value: formatMoney(risk.sum_insured_equivalent) },
              { label: 'Premium Rate', value: formatNumber(risk.premium_rate, 6) },
              { label: 'Premium Before Discount', value: formatMoney(risk.premium_before_discount) },
              { label: 'Premium After Discount', value: formatMoney(risk.premium_after_discount) },
              {
                label: 'Premium Excluding Tax Equivalent',
                value: formatMoney(risk.premium_excluding_tax_equivalent),
              },
              { label: 'Premium Including Tax', value: formatMoney(risk.premium_including_tax) },
            ]}
          />

          <Separator className="my-4" />
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Discounts</div>
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
                      <TableRow key={`${discount.discount_type ?? 'd'}-${discountIndex}`}>
                        <TableCell>{displayValue(discount.discount_label ?? discount.discount_type)}</TableCell>
                        <TableCell>{formatNumber(discount.discount_rate, 6)}</TableCell>
                        <TableCell>{formatMoney(discount.discount_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState text="No discounts recorded." />
              )}
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Taxes</div>
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
                        <TableCell>{displayValue(tax.tax_name ?? tax.tax_code)}</TableCell>
                        <TableCell>{formatNumber(tax.tax_rate, 6)}</TableCell>
                        <TableCell>{formatMoney(tax.tax_amount)}</TableCell>
                        <TableCell>{tax.is_tax_exempted ? 'Yes' : 'No'}</TableCell>
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

export function RiskPreview({ risks }: { risks: QuotationPreviewRisk[] }) {
  return <RiskSection title="Risk" risks={risks} />;
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
            <TableRow key={`${subject.subject_matter_reference ?? 'subject'}-${index}`}>
              <TableCell>{displayValue(subject.subject_matter_reference)}</TableCell>
              <TableCell>{displayValue(subject.subject_matter_description)}</TableCell>
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
        <SectionCard key={`${addon.addon_reference ?? 'addon'}-${index}`} title={`Add-on ${index + 1}`}>
          <KeyValueGrid
            items={[
              { label: 'Add-on Reference', value: displayValue(addon.addon_reference) },
              { label: 'Description', value: displayValue(addon.addon_description) },
              { label: 'Insured Amount', value: formatMoney(addon.insured_amount) },
              { label: 'Premium Rate', value: formatNumber(addon.premium_rate, 6) },
              { label: 'Premium Excluding Tax', value: formatMoney(addon.premium_excluding_tax) },
              { label: 'Premium Excluding Tax Equivalent', value: formatMoney(addon.premium_excluding_tax_equivalent) },
              { label: 'Premium Including Tax', value: formatMoney(addon.premium_including_tax) },
            ]}
          />
          <Separator className="my-4" />
          <div className="text-sm font-semibold text-slate-900">Addon Taxes</div>
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
          { label: 'Motor Category', value: displayValue(motor.motor_category) },
          { label: 'Motor Type', value: displayValue(motor.motor_type) },
          { label: 'Registration Number', value: displayValue(motor.registration_number) },
          { label: 'Chassis Number', value: displayValue(motor.chassis_number) },
          { label: 'Make', value: displayValue(motor.make) },
          { label: 'Model', value: displayValue(motor.model) },
          { label: 'Model Number', value: displayValue(motor.model_number) },
          { label: 'Body Type', value: displayValue(motor.body_type) },
          { label: 'Colour', value: displayValue(motor.colour) },
          { label: 'Engine Number', value: displayValue(motor.engine_number) },
          { label: 'Engine Capacity', value: displayValue(motor.engine_capacity) },
          { label: 'Fuel Used', value: displayValue(motor.fuel_used) },
          { label: 'Number of Axles', value: displayValue(motor.number_of_axles) },
          { label: 'Axle Distance', value: displayValue(motor.axle_distance) },
          { label: 'Seating Capacity', value: displayValue(motor.seating_capacity) },
          { label: 'Year of Manufacture', value: displayValue(motor.year_of_manufacture) },
          { label: 'Tare Weight', value: displayValue(motor.tare_weight) },
          { label: 'Gross Weight', value: displayValue(motor.gross_weight) },
          { label: 'Motor Usage', value: displayValue(motor.motor_usage) },
          { label: 'Owner Name', value: displayValue(motor.owner_name) },
          { label: 'Owner Category', value: displayValue(motor.owner_category) },
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
            { label: 'Fleet Type', value: displayValue(header.fleet_type_label ?? header.fleet_type) },
            { label: 'Fleet Size', value: displayValue(header.fleet_size) },
            { label: 'Comprehensively Insured Vehicles', value: displayValue(header.comprehensive_insured) },
            { label: 'Cover Note Type', value: displayValue(header.cover_note_type) },
            { label: 'Sales Point', value: displayValue(header.sales_point_code) },
            { label: 'Cover Start Date', value: formatDateTime(header.cover_start_date) },
            { label: 'Cover End Date', value: formatDateTime(header.cover_end_date) },
            { label: 'Payment Mode', value: displayValue(header.payment_mode) },
            { label: 'Currency', value: displayValue(header.currency) },
            { label: 'Exchange Rate', value: formatNumber(header.exchange_rate, 6) },
            { label: 'Product Code', value: displayValue(header.product_code) },
            { label: 'Commission Rate', value: formatNumber(header.commission_rate, 6) },
            { label: 'Commission Paid', value: formatMoney(header.commission_paid, header.currency) },
            { label: 'Authorizing Officer', value: displayValue(header.authorizing_officer_name) },
            { label: 'Officer Title', value: displayValue(header.authorizing_officer_title) },
            { label: 'Total Premium Excluding Tax', value: formatMoney(header.total_premium_excluding_tax, header.currency) },
            { label: 'Total Premium Including Tax', value: formatMoney(header.total_premium_including_tax, header.currency) },
          ]}
        />
      </SectionCard>

      <SectionCard title="Fleet Summary">
        <KeyValueGrid
          items={[
            { label: 'Declared Fleet Size', value: displayValue(summary.declared_fleet_size) },
            { label: 'Vehicles Saved', value: displayValue(summary.saved_vehicle_count) },
            { label: 'Comprehensive Vehicles', value: displayValue(summary.comprehensive_vehicle_count) },
            { label: 'Third Party Vehicles', value: displayValue(summary.third_party_vehicle_count) },
            { label: 'Total Fleet Sum Insured', value: formatMoney(summary.total_fleet_sum_insured) },
            { label: 'Total Risk Premium', value: formatMoney(summary.total_risk_premium) },
            { label: 'Total Add-on Premium', value: formatMoney(summary.total_addon_premium) },
            { label: 'Total Discounts', value: formatMoney(summary.total_discounts) },
            { label: 'Total Taxes', value: formatMoney(summary.total_taxes) },
            { label: 'Total Premium Excluding Tax', value: formatMoney(summary.total_premium_excluding_tax) },
            { label: 'Total Premium Including Tax', value: formatMoney(summary.total_premium_including_tax) },
            { label: 'Successful Entries', value: displayValue(summary.successful_entries) },
            { label: 'Failed Entries', value: displayValue(summary.failed_entries) },
            { label: 'Pending Entries', value: displayValue(summary.pending_entries) },
          ]}
        />
        {summary.declared_fleet_size !== null && summary.declared_fleet_size !== summary.saved_vehicle_count ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Declared fleet size and saved vehicles differ.
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

export function FleetVehicleList({
  vehicles,
}: {
  vehicles: QuotationPreviewFleetVehicle[];
}) {
  if (!vehicles.length) return <EmptyState text="No fleet vehicles available." />;

  return (
    <div className="space-y-3">
      {vehicles.map((vehicle, index) => (
        <details
          key={`${vehicle.cover_note_number ?? 'vehicle'}-${index}`}
          className="group rounded-lg border border-slate-200 bg-white"
        >
          <summary className="cursor-pointer list-none px-4 py-3">
            <div className="grid gap-2 md:grid-cols-6 md:items-center">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Fleet Entry</div>
                <div className="font-medium text-slate-900">{displayValue(vehicle.fleet_entry_number)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Cover Note</div>
                <div className="font-medium text-slate-900">{displayValue(vehicle.cover_note_number)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Registration</div>
                <div className="font-medium text-slate-900">{displayValue(vehicle.motor_details?.registration_number)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Make / Model</div>
                <div className="font-medium text-slate-900">
                  {displayValue(vehicle.motor_details?.make)} {displayValue(vehicle.motor_details?.model)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Premium</div>
                <div className="font-medium text-slate-900">
                  {formatMoney(
                    vehicle.risks.reduce((sum, risk) => sum + (risk.premium_including_tax ?? 0), 0) +
                      vehicle.addons.reduce((sum, addon) => sum + (addon.premium_including_tax ?? 0), 0),
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">TIRAMIS</div>
                <div className="font-medium text-slate-900">{displayValue(vehicle.tiramis?.submission_status)}</div>
              </div>
            </div>
          </summary>
          <div className="border-t border-slate-200 p-4">
            <FleetVehiclePreview vehicle={vehicle} />
          </div>
        </details>
      ))}
    </div>
  );
}

export function FleetVehiclePreview({
  vehicle,
}: {
  vehicle: QuotationPreviewFleetVehicle;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Vehicle Cover Note Information">
        <KeyValueGrid
          items={[
            { label: 'Fleet Entry Number', value: displayValue(vehicle.fleet_entry_number) },
            { label: 'Cover Note Number', value: displayValue(vehicle.cover_note_number) },
            { label: 'Previous Cover Note Reference', value: displayValue(vehicle.previous_cover_note_reference_number) },
            { label: 'Description', value: displayValue(vehicle.cover_note_description) },
            { label: 'Operative Clause', value: displayValue(vehicle.operative_clause) },
            { label: 'Endorsement Type', value: displayValue(vehicle.endorsement_type) },
            { label: 'Endorsement Reason', value: displayValue(vehicle.endorsement_reason) },
            { label: 'Endorsement Premium Earned', value: formatMoney(vehicle.endorsement_premium_earned) },
          ]}
        />
      </SectionCard>

      <RiskSection title="Vehicle Risk" risks={vehicle.risks} />
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
                <TableRow key={`${subject.subject_matter_reference ?? 'subject'}-${index}`}>
                  <TableCell>{displayValue(subject.subject_matter_reference)}</TableCell>
                  <TableCell>{displayValue(subject.subject_matter_description)}</TableCell>
                  <TableCell>{displayValue(subject.related_risk_code)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState text="No subject matters recorded." />
        )}
      </SectionCard>

      <AddonPreview addons={vehicle.addons} />
      <MotorDetailsPreview motor={vehicle.motor_details} title="Vehicle Motor Details" />

      <SectionCard title="Vehicle TIRAMIS">
        {vehicle.tiramis ? (
          <KeyValueGrid
            items={[
              { label: 'Submission Status', value: displayValue(vehicle.tiramis.submission_status) },
              { label: 'Request ID', value: displayValue(vehicle.tiramis.request_id) },
              { label: 'Submission Attempts', value: displayValue(vehicle.tiramis.submission_attempt_number) },
              { label: 'Date Submitted', value: formatDateTime(vehicle.tiramis.date_submitted) },
              { label: 'Submitted By', value: displayValue(vehicle.tiramis.submitted_by) },
              { label: 'Environment', value: displayValue(vehicle.tiramis.tiramis_environment) },
              { label: 'Last Error', value: displayValue(vehicle.tiramis.last_submission_error) },
              { label: 'Next Retry Time', value: formatDateTime(vehicle.tiramis.next_retry_time) },
              { label: 'Acknowledgement ID', value: displayValue(vehicle.tiramis.acknowledgement_id) },
              { label: 'Acknowledgement Status Code', value: displayValue(vehicle.tiramis.acknowledgement_status_code) },
              { label: 'Acknowledgement Description', value: displayValue(vehicle.tiramis.acknowledgement_status_description) },
              { label: 'Acknowledgement Received', value: formatDateTime(vehicle.tiramis.acknowledgement_received_date) },
              { label: 'Callback Status', value: displayValue(vehicle.tiramis.callback_received_status) },
              { label: 'Callback Received', value: formatDateTime(vehicle.tiramis.callback_received_date) },
              { label: 'Response ID', value: displayValue(vehicle.tiramis.response_id) },
              { label: 'Response Status Code', value: displayValue(vehicle.tiramis.response_status_code) },
              { label: 'Response Description', value: displayValue(vehicle.tiramis.response_status_description) },
              { label: 'Cover Note Reference Number', value: displayValue(vehicle.tiramis.cover_note_reference_number) },
              { label: 'Sticker Number', value: displayValue(vehicle.tiramis.sticker_number) },
            ]}
          />
        ) : (
          <EmptyState text="No TIRAMIS data recorded for this vehicle." />
        )}
      </SectionCard>
    </div>
  );
}

export function PaymentPreview({ payment }: { payment: QuotationPreviewPayment | null }) {
  if (!payment) return <EmptyState text="No payment information available." />;

  return (
    <SectionCard title="Payment Information">
      <KeyValueGrid
        items={[
          { label: 'Payment Status', value: displayValue(payment.payment_status) },
          { label: 'Payment Method', value: displayValue(payment.payment_method) },
          { label: 'Payment Reference', value: displayValue(payment.payment_reference) },
          { label: 'Receipt Number', value: displayValue(payment.receipt_number) },
          { label: 'Amount Paid', value: formatMoney(payment.amount_paid, payment.currency) },
          { label: 'Payment Date', value: formatDateTime(payment.payment_date) },
          { label: 'Currency', value: displayValue(payment.currency) },
          { label: 'Outstanding Amount', value: formatMoney(payment.outstanding_amount, payment.currency) },
          { label: 'Verification Status', value: displayValue(payment.verification_status) },
          { label: 'Invoice Number', value: displayValue(payment.invoice_number) },
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
  if (!tiramis) return <EmptyState text="No TIRAMIS submission information available." />;

  return (
    <SectionCard title="TIRAMIS Submission Information">
      <KeyValueGrid
        items={[
          { label: 'Submission Status', value: displayValue(tiramis.submission_status) },
          { label: 'Request ID', value: displayValue(tiramis.request_id) },
          { label: 'Submission Attempt', value: displayValue(tiramis.submission_attempt_number) },
          { label: 'Date Submitted', value: formatDateTime(tiramis.date_submitted) },
          { label: 'Submitted By', value: displayValue(tiramis.submitted_by) },
          { label: 'Environment', value: displayValue(tiramis.tiramis_environment) },
          { label: 'Last Submission Error', value: displayValue(tiramis.last_submission_error) },
          { label: 'Next Retry Time', value: formatDateTime(tiramis.next_retry_time) },
          { label: 'Acknowledgement ID', value: displayValue(tiramis.acknowledgement_id) },
          { label: 'Acknowledgement Status Code', value: displayValue(tiramis.acknowledgement_status_code) },
          { label: 'Acknowledgement Description', value: displayValue(tiramis.acknowledgement_status_description) },
          { label: 'Acknowledgement Received', value: formatDateTime(tiramis.acknowledgement_received_date) },
          { label: 'Callback Received Status', value: displayValue(tiramis.callback_received_status) },
          { label: 'Callback Received Date', value: formatDateTime(tiramis.callback_received_date) },
          { label: 'Response ID', value: displayValue(tiramis.response_id) },
          { label: 'Response Status Code', value: displayValue(tiramis.response_status_code) },
          { label: 'Response Description', value: displayValue(tiramis.response_status_description) },
          { label: 'TIRAMIS Cover Note Reference', value: displayValue(tiramis.cover_note_reference_number) },
          { label: 'Sticker Number', value: displayValue(tiramis.sticker_number) },
        ]}
      />
    </SectionCard>
  );
}

export function QuotationHistoryPreview({
  history,
}: {
  history: QuotationPreviewHistoryItem[];
}) {
  if (!history.length) return <EmptyState text="No history available." />;

  return (
    <SectionCard title="Audit and Status History">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Previous Status</TableHead>
            <TableHead>New Status</TableHead>
            <TableHead>Performed By</TableHead>
            <TableHead>Date and Time</TableHead>
            <TableHead>Remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((item, index) => (
            <TableRow key={`${item.action}-${index}`}>
              <TableCell>{displayValue(item.action)}</TableCell>
              <TableCell>{displayValue(item.previous_status)}</TableCell>
              <TableCell>{displayValue(item.new_status)}</TableCell>
              <TableCell>{displayValue(item.performed_by)}</TableCell>
              <TableCell>{formatDateTime(item.date_time)}</TableCell>
              <TableCell>{displayValue(item.remarks)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
