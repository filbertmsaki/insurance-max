import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';
import type { QuotationWizardStepId } from '../types';
import { formatCoverDateLabel } from '../utils/coverNoteDateRange';
import { quotationTotals } from '../utils/quotationTotals';
import { quotationPricingIssues } from '../utils/quotationReadiness';
import { StepSection } from '../components/StepSection';
import { WizardInput } from '../components/WizardInput';
interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
}
interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  riskOptions: InsuranceRisk[];
  riskCount: number;
  onEditStep: (step: QuotationWizardStepId) => void;
  /** Payment method is captured here unless an earlier step already asks. */
  showPaymentMode?: boolean;
  /** Adds an Edit link to each summary block (single-screen wizards). */
  onEditSection?: (section: SummarySection) => void;
}

export type SummarySection = 'customer' | 'vehicle' | 'cover' | 'premium';

// eslint-disable-next-line react-refresh/only-export-components
export const PAYMENT_MODE_OPTIONS = [
  { value: '1', label: 'Cash' },
  { value: '2', label: 'Cheque' },
  { value: '3', label: 'EFT' },
] as const;

function EditLink({
  section,
  onEditSection,
}: {
  section: SummarySection;
  onEditSection?: (section: SummarySection) => void;
}) {
  if (!onEditSection) return null;
  return (
    <button
      type="button"
      className="ml-2 text-xs font-medium text-primary hover:underline"
      onClick={() => onEditSection(section)}
    >
      Edit
    </button>
  );
}

export function SummaryReviewStep({
  form,
  customerOptions,
  productOptions,
  riskOptions,
  onEditStep,
  showPaymentMode = true,
  onEditSection,
}: Props) {
  const values = form.watch();
  const totals = quotationTotals(values);
  const issues = quotationPricingIssues(values);
  const product = productOptions.find((item) => item.id === values.product_id);
  const customer = customerOptions.find(
    (item) => item.id === values.customer_id,
  );
  const money = (value: number) => formatMoney(value, values.currency || 'TZS');
  const totalDiscount = (
    values.quotation_flow === 'MOTOR_FLEET'
      ? values.fleet.items.flatMap((item) => item.risks_covered)
      : values.risks
  )
    .flatMap((risk) => risk.discounts_offered ?? [])
    .reduce(
      (sum, discount) => sum + (Number(discount.discount_amount) || 0),
      0,
    );
  const risks =
    values.quotation_flow === 'MOTOR_FLEET'
      ? values.fleet.items.flatMap((item) => item.risks_covered)
      : values.risks;
  const coverName = (id: string) =>
    riskOptions.find((item) => item.id === id)?.risk_name || 'Cover';
  return (
    <StepSection title="Review quotation" first>
      <div className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-slate-500">
            Policyholder
            <EditLink section="customer" onEditSection={onEditSection} />
          </p>
          <p className="font-medium">
            {values.policyholder_mode === 'existing'
              ? customer
                ? getCustomerDisplayName(customer)
                : 'Select policyholder'
              : values.policyholder.full_name ||
                values.policyholder.company_name}
          </p>
          {values.policyholder_mode === 'existing' && customer && (
            <p className="text-xs text-slate-500">
              {[customer.customer_no, customer.phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        {values.quotation_flow === 'MOTOR_SINGLE' && (
          <div>
            <p className="text-slate-500">
              Vehicle
              <EditLink section="vehicle" onEditSection={onEditSection} />
            </p>
            <p className="font-medium">
              {values.motor.registration_no || values.motor.chassis_no} ·{' '}
              {values.motor.make} {values.motor.model} ·{' '}
              {values.motor.manufacture_year}
            </p>
          </div>
        )}
        <div>
          <p className="text-slate-500">
            Product
            <EditLink section="cover" onEditSection={onEditSection} />
          </p>
          <p className="font-medium">
            {product?.product_name ?? product?.name ?? 'Choose a product'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Cover</p>
          <p>
            {[...new Set(risks.map((risk) => coverName(risk.risk_id)))].join(
              ', ',
            )}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Cover period</p>
          <p>
            {formatCoverDateLabel(values.valid_from)} –{' '}
            {formatCoverDateLabel(values.valid_until)}
          </p>
        </div>
        {!showPaymentMode && (
          <div>
            <p className="text-slate-500">Payment method</p>
            <p>
              {{ '1': 'Cash', '2': 'Cheque', '3': 'EFT' }[
                values.payment_mode_tira
              ] ?? '—'}
            </p>
          </div>
        )}
        {totals.sumInsured > 0 && (
          <div>
            <p className="text-slate-500">Sum insured</p>
            <p>{money(totals.sumInsured)}</p>
          </div>
        )}
      </div>
      {values.quotation_flow === 'MOTOR_FLEET' && (
        <div className="space-y-2">
          {values.fleet.items.map((item, index) => (
            <div
              key={item.risks_covered[0]?.client_ref || index}
              className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <span>
                {item.motor_dtl.registration_number ||
                  item.motor_dtl.chassis_number ||
                  'Vehicle ' + (index + 1)}{' '}
                · {item.motor_dtl.make} {item.motor_dtl.model}
              </span>
              <span>
                {item.risks_covered
                  .map((risk) => coverName(risk.risk_id))
                  .join(', ')}
              </span>
              <span>
                {money(
                  quotationTotals({
                    ...values,
                    fleet: { ...values.fleet, items: [item] },
                  }).total,
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {values.quotation_flow === 'NON_MOTOR' && (
        <div className="space-y-2">
          {values.nonMotor.items.map((item, index) => (
            <p key={index} className="text-sm">
              {item.subject_matter_reference} · {item.subject_matter_desc}
            </p>
          ))}
        </div>
      )}
      {values.addons.some((addon) => addon.enabled) &&
        values.quotation_flow !== 'MOTOR_FLEET' && (
          <p className="text-sm">
            Optional covers:{' '}
            {values.addons
              .filter((addon) => addon.enabled)
              .map((addon) => addon.addon_desc || 'Optional cover')
              .join(', ')}
          </p>
        )}
      <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
        {onEditSection && (
          <div className="flex justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
            <span>
              Premium
              <EditLink section="premium" onEditSection={onEditSection} />
            </span>
            <span>{values.currency || 'TZS'}</span>
          </div>
        )}
        {totalDiscount > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Discount applied</span>
            <span>−{money(totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Premium (including optional covers)</span>
          <span>{money(totals.premium)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxes & levies</span>
          <span>{money(totals.tax)}</span>
        </div>
        <div className="flex justify-between border-t pt-3 text-lg font-semibold">
          <span>Total</span>
          <span>{money(totals.total)}</span>
        </div>
      </div>
      {showPaymentMode && (
        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
          <WizardInput
            form={form}
            name="payment_mode_tira"
            label="Payment method"
            required
            options={PAYMENT_MODE_OPTIONS}
          />
        </div>
      )}
      {issues.length > 0 && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
        >
          <p>Waiting for complete, current premiums.</p>
          {issues.map((issue, index) => (
            <p key={index}>{issue}</p>
          ))}
        </div>
      )}
      <div className={onEditSection ? 'hidden' : 'flex flex-wrap gap-2'}>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onEditStep(
              values.is_fleet
                ? 'fleet-vehicles'
                : values.quotation_flow === 'MOTOR_SINGLE'
                  ? 'motor'
                  : 'risk-premium',
            )
          }
        >
          Edit cover details
        </Button>
        {values.is_fleet && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onEditStep('fleet-setup')}
          >
            Edit fleet & policyholder
          </Button>
        )}
      </div>
    </StepSection>
  );
}
