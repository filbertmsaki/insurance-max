import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import { AddOnsStep } from '@/modules/tenant/quotations/wizard/steps/AddOnsStep';
import { quotationPricingIssues } from '@/modules/tenant/quotations/wizard/utils/quotationReadiness';
import { quotationTotals } from '@/modules/tenant/quotations/wizard/utils/quotationTotals';
import { dateOnlyPart } from '@/modules/tenant/quotations/wizard/utils/coverNoteDateRange';
import { BusinessSourceStep } from '@/modules/tenant/underwrite/wizard/steps/BusinessSourceStep';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import type { CoverSummary, MobileQuoteMode } from './MobileCoverStep';
import { MobileCard, SummaryItem } from './MobileUi';
import { MobileFleetPricingControl, MobileSinglePricingControl } from './MobilePricingControl';

const PAYMENT_MODE_OPTIONS = [
  { value: '1', label: 'Cash' },
  { value: '2', label: 'Cheque' },
  { value: '3', label: 'EFT' },
];

const amount = (value: unknown) => Number(value) || 0;

function EditLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="mq-raw -my-2 -mr-2 flex h-11 items-center px-2 text-[14px] font-semibold text-[#3B4A8C] focus-visible:outline-2 focus-visible:outline-[#3B4A8C]"
    >
      Edit
    </button>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[15px]">
      <dt className="text-[#5B6275]">{label}</dt>
      <dd className="font-medium text-[#1B1F2E]">{value}</dd>
    </div>
  );
}

/** Tax label from the first charged tax, e.g. "VAT 18%". */
function taxLabel(
  taxes: Array<{ tax_code?: string; tax_rate?: string }> | undefined,
) {
  const tax = taxes?.find((row) => row.tax_code?.trim());
  if (!tax) return 'Tax';
  const rate = Number(tax.tax_rate);
  return Number.isFinite(rate) && rate > 0
    ? `${tax.tax_code} ${rate}%`
    : String(tax.tax_code);
}

export function MobileReviewStep({
  wizard,
  mode,
  summary,
  coverStepId,
  vehicleStepId,
  showAddOns = false,
}: {
  wizard: UnderwriteQuotationWizard;
  mode: MobileQuoteMode;
  summary: CoverSummary;
  coverStepId: string;
  vehicleStepId: string;
  /** Single vehicle: the product offers add-ons, or some are already added. */
  showAddOns?: boolean;
}) {
  const { form } = wizard;
  const [showVehicles, setShowVehicles] = useState(false);
  // Re-render on any change so totals and summaries stay current.
  useWatch({ control: form.control });
  const values = form.getValues();
  const currency = values.currency || 'TZS';
  const money = (value: number) => formatMoney(value, currency);
  const totals = quotationTotals(values);
  const issues = quotationPricingIssues(values);
  const isFleet = mode === 'fleet';

  const risks = isFleet
    ? values.fleet.items.flatMap((item) => item.risks_covered)
    : values.risks;
  const discount = risks.reduce(
    (sum, risk) =>
      sum +
      Math.max(
        0,
        amount(risk.premium_before_discount) -
          amount(risk.premium_after_discount),
      ),
    0,
  );
  const tax = taxLabel(
    isFleet
      ? values.fleet.header.cover.taxes_charged
      : values.risks[0]?.taxes_charged,
  );

  const customer = wizard.customerOptions.find(
    (item) => item.id === values.customer_id,
  );
  const holder =
    values.policyholder_mode === 'existing' && customer
      ? {
          name: getCustomerDisplayName(customer),
          type:
            customer.customer_type === 'CORPORATE' ? 'Corporate' : 'Individual',
          phone: customer.phone,
        }
      : {
          name: values.policyholder.policy_holder_name,
          type:
            values.policyholder.policy_holder_type === 2
              ? 'Corporate'
              : 'Individual',
          phone: values.policyholder.policy_holder_phone_number,
        };

  const vehicles = values.fleet.items
    .filter(
      (item) =>
        item.motor_dtl.registration_number.trim() ||
        item.motor_dtl.chassis_number.trim(),
    )
    .map((item, index) => ({
      key: item.risks_covered[0]?.client_ref || String(index),
      label:
        item.motor_dtl.registration_number ||
        item.motor_dtl.chassis_number ||
        `Vehicle ${index + 1}`,
      name: [item.motor_dtl.make, item.motor_dtl.model]
        .filter(Boolean)
        .join(' '),
      premium:
        item.risks_covered.reduce(
          (sum, risk) => sum + amount(risk.premium_including_tax),
          0,
        ) +
        item.cover_note_addons.reduce(
          (sum, addon) => sum + amount(addon.premium_including_tax),
          0,
        ),
    }));

  return (
    <>
      <MobileCard>
        <p className="text-[13px] text-[#5B6275]">Total premium</p>
        <p className="text-2xl font-bold leading-8 text-[#1B1F2E]">
          {money(totals.total)}
        </p>
        <dl className="mt-3 border-t border-[#E6E8EF] pt-2">
          <PriceRow label="Premium" value={money(totals.premium + discount)} />
          <PriceRow
            label="Discount"
            value={discount ? `− ${money(discount)}` : money(0)}
          />
          <PriceRow label={tax} value={money(totals.tax)} />
        </dl>
        {isFleet ? <MobileFleetPricingControl wizard={wizard} /> : <MobileSinglePricingControl wizard={wizard} />}
        {issues.length > 0 && (
          <p
            role="alert"
            data-mq-error
            className="mt-2 text-[12px] leading-4 text-[#B42318]"
          >
            {issues[0]}
          </p>
        )}
      </MobileCard>

      <MobileCard
        title="Cover"
        action={
          <EditLink
            label="Edit cover"
            onClick={() => wizard.setStep(coverStepId)}
          />
        }
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <SummaryItem label="Type" value={summary.cover} />
          <SummaryItem label="Duration" value={summary.duration} />
          <SummaryItem
            label="Dates"
            value={`${dateOnlyPart(values.valid_from)} – ${dateOnlyPart(values.valid_until)}`}
          />
          <SummaryItem label="Motor class" value={summary.motorClass} />
        </dl>
      </MobileCard>

      <MobileCard
        title="Policyholder"
        action={
          <EditLink
            label="Edit policyholder"
            onClick={() => wizard.setStep(coverStepId)}
          />
        }
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="col-span-2">
            <SummaryItem label="Name" value={holder.name} />
          </div>
          <SummaryItem label="Type" value={holder.type} />
          <SummaryItem label="Phone" value={holder.phone} />
        </dl>
      </MobileCard>

      <MobileCard
        title={isFleet ? 'Vehicles' : 'Vehicle'}
        action={
          <EditLink
            label={isFleet ? 'Edit vehicles' : 'Edit vehicle'}
            onClick={() => wizard.setStep(vehicleStepId)}
          />
        }
      >
        {isFleet ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium text-[#1B1F2E]">
                {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                aria-expanded={showVehicles}
                onClick={() => setShowVehicles((open) => !open)}
                className="mq-raw -mr-2 flex h-11 items-center px-2 text-[14px] font-semibold text-[#3B4A8C]"
              >
                {showVehicles ? 'Hide list' : 'View list'}
              </button>
            </div>
            {showVehicles && (
              <ul className="mt-1 divide-y divide-[#E6E8EF]">
                {vehicles.map((vehicle) => (
                  <li
                    key={vehicle.key}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-[14px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[#1B1F2E]">
                        {vehicle.label}
                      </span>
                      <span className="block truncate text-[13px] text-[#5B6275]">
                        {vehicle.name}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-[#1B1F2E]">
                      {money(vehicle.premium)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2">
              <SummaryItem
                label="Make & model"
                value={[
                  values.motor.make,
                  values.motor.model,
                  values.motor.manufacture_year,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            </div>
            <div className="col-span-2">
              <SummaryItem
                label={
                  values.motor.registration_no
                    ? 'Registration number'
                    : 'Chassis number'
                }
                value={values.motor.registration_no || values.motor.chassis_no}
              />
            </div>
          </dl>
        )}
      </MobileCard>

      {showAddOns && !isFleet && (
        <MobileCard title="Add-ons">
          <AddOnsStep
            form={form}
            fieldArray={wizard.addonFieldArray}
            requirePremiumRate
          />
        </MobileCard>
      )}

      <MobileCard title="Payment">
        <div className="space-y-3">
          <WizardInput
            form={form}
            name="payment_mode_tira"
            label="Payment method"
            required
            options={PAYMENT_MODE_OPTIONS}
          />
          <BusinessSourceStep wizard={wizard} />
        </div>
      </MobileCard>
    </>
  );
}
