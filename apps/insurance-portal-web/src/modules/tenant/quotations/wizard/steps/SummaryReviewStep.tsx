import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
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
}
export function SummaryReviewStep({
  form,
  customerOptions,
  productOptions,
  riskOptions,
  onEditStep,
}: Props) {
  const values = form.watch();
  const totals = quotationTotals(values);
  const issues = quotationPricingIssues(values);
  const product = productOptions.find((item) => item.id === values.product_id);
  const customer = customerOptions.find(
    (item) => item.id === values.customer_id,
  );
  const money = (value: number) =>
    new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: values.currency || 'TZS',
    }).format(value);
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
          <p className="text-slate-500">Product</p>
          <p className="font-medium">
            {product?.product_name ?? product?.name ?? 'Choose a product'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Cover period</p>
          <p>
            {formatCoverDateLabel(values.valid_from)} –{' '}
            {formatCoverDateLabel(values.valid_until)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Policyholder</p>
          <p>
            {values.policyholder_mode === 'existing'
              ? customer
                ? getCustomerDisplayName(customer)
                : 'Select policyholder'
              : values.policyholder.full_name ||
                values.policyholder.company_name}
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
        {values.quotation_flow === 'MOTOR_SINGLE' && (
          <div>
            <p className="text-slate-500">Vehicle</p>
            <p>
              {values.motor.registration_no || values.motor.chassis_no} ·{' '}
              {values.motor.make} {values.motor.model} ·{' '}
              {values.motor.manufacture_year}
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
      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <WizardInput
          form={form}
          name="payment_mode_tira"
          label="Payment method"
          required
          options={[
            { value: '1', label: 'Cash' },
            { value: '2', label: 'Cheque' },
            { value: '3', label: 'EFT' },
          ]}
        />
      </div>
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
      <div className="flex flex-wrap gap-2">
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
