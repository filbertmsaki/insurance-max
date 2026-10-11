import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { UnderwriteLine } from '@insurance-max/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/modules/shared/formatting/number-format';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { MotorDetailsStep } from '@/modules/tenant/quotations/wizard/steps/MotorDetailsStep';
import { PolicyholderStep } from '@/modules/tenant/quotations/wizard/steps/PolicyholderStep';
import {
  computeCoverNoteDateRange,
  dateOnlyPart,
  formatCoverDateLabel,
  inclusiveDayCount,
} from '@/modules/tenant/quotations/wizard/utils/coverNoteDateRange';
import { quotationTotals } from '@/modules/tenant/quotations/wizard/utils/quotationTotals';
import { useRiskPremiumCalculation } from '@/modules/tenant/quotations/wizard/hooks/useRiskPremiumCalculation';
import { RiskTaxesFields } from '@/modules/tenant/quotations/wizard/components/RiskTaxesFields';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { getUnderwriteLineMeta } from '../lines';
import { UnderwriteWizardShell } from '../wizard/UnderwriteWizardShell';
import {
  useUnderwriteQuotationWizard,
  type UnderwriteWizardStep,
  type UnderwriteQuotationWizard,
} from '../wizard/useUnderwriteQuotationWizard';

const MOTOR = getUnderwriteLineMeta(UnderwriteLine.MOTOR);
const SHORT_TERM_PRODUCT_CODE = 'SP014001000000';
const SHORT_TERM_RISK_CODE = 'SP014001000007';
const SHORT_TERM_SUM_INSURED = '20000';
const SHORT_TERM_OPERATIVE_CLAUSE = 'Short Term Policy';

const COVER_PERIODS = [
  { days: 30, label: '30 Days' },
  { days: 60, label: '60 Days' },
  { days: 90, label: '90 Days' },
] as const;

const SHORT_TERM_STEPS: UnderwriteWizardStep[] = [
  {
    id: 'details',
    label: 'Quotation Details',
    description: 'Choose the cover period, customer and vehicle',
    fields: ['customer_id', 'policyholder', 'motor'],
  },
  {
    id: 'summary',
    label: 'Premium & Summary',
    description: 'Review calculated premium and submit',
    fields: ['payment_mode_tira', 'risks'],
  },
];

function coverPeriodFromWizard(wizard: UnderwriteQuotationWizard) {
  const days = inclusiveDayCount(
    wizard.form.watch('valid_from'),
    wizard.form.watch('valid_until'),
  );
  return COVER_PERIODS.some((option) => option.days === days) ? days : 30;
}

function ShortTermPremiumCalculator({
  wizard,
}: {
  wizard: UnderwriteQuotationWizard;
}) {
  const { calculateMutation } = useRiskPremiumCalculation(
    wizard.form,
    0,
    wizard.factorContext,
  );

  if (calculateMutation.isPending) {
    return <p className="text-sm text-slate-500">Calculating premium...</p>;
  }

  if (calculateMutation.isError) {
    return (
      <p className="text-sm text-red-600">
        Premium could not be calculated. Check the vehicle details and try
        again.
      </p>
    );
  }

  return null;
}

function ShortTermDetailsStep({ wizard }: { wizard: UnderwriteQuotationWizard }) {
  const period = coverPeriodFromWizard(wizard);

  return (
    <div className="space-y-6">
      <StepSection title="Cover period" first>
        <div className="flex flex-wrap gap-2">
          {COVER_PERIODS.map((option) => (
            <Button
              key={option.days}
              type="button"
              variant={period === option.days ? 'default' : 'outline'}
              onClick={() => setCoverPeriod(wizard, option.days)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </StepSection>

      <PolicyholderStep
        form={wizard.form}
        customerOptions={wizard.customerOptions}
        newCustomerInDialog
      />
      <MotorDetailsStep
        form={wizard.form}
        vehicleOptions={wizard.vehicleOptions}
      />
    </div>
  );
}

function ShortTermSummaryStep({
  wizard,
}: {
  wizard: UnderwriteQuotationWizard;
}) {
  const values = wizard.form.watch();
  const totals = quotationTotals(values);
  const customer = wizard.customerOptions.find(
    (item) => item.id === values.customer_id,
  );
  const product = wizard.productOptions.find(
    (item) => item.id === values.product_id,
  );
  const risk = wizard.riskOptions.find(
    (item) => item.id === values.risks[0]?.risk_id,
  );
  const row = values.risks[0];
  const days = inclusiveDayCount(values.valid_from, values.valid_until) ?? 30;
  const money = (amount: number | string | undefined) =>
    formatMoney(Number(amount) || 0, values.currency || 'TZS');

  return (
    <div className="space-y-6">
      <ShortTermPremiumCalculator wizard={wizard} />
      <StepSection title="Quotation summary" first>
        <div className="grid gap-4 rounded-lg border border-slate-200 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <SummaryItem
            label="Customer"
            value={
              customer
                ? getCustomerDisplayName(customer)
                : values.policyholder.full_name ||
                  values.policyholder.company_name ||
                  'Not selected'
            }
          />
          <SummaryItem
            label="Vehicle"
            value={`${values.motor.registration_no || values.motor.chassis_no || 'Vehicle'} - ${values.motor.make} ${values.motor.model}`.trim()}
          />
          <SummaryItem
            label="Product"
            value={
              product
                ? `${product.product_name} (${SHORT_TERM_PRODUCT_CODE})`
                : SHORT_TERM_PRODUCT_CODE
            }
          />
          <SummaryItem
            label="Cover"
            value={risk?.risk_name ?? 'Short-term private motor transit'}
          />
          <SummaryItem
            label="Cover period"
            value={`${formatCoverDateLabel(values.valid_from)} to ${formatCoverDateLabel(values.valid_until)}`}
          />
          <SummaryItem label="Duration" value={`${days} days`} />
          <SummaryItem label="Sum insured" value={money(row?.sum_insured)} />
          <SummaryItem
            label="Premium rate"
            value={`${Number(row?.premium_rate ?? 0).toFixed(4)}`}
          />
          <SummaryItem
            label="Basic premium"
            value={money(row?.premium_before_discount)}
          />
          <SummaryItem
            label="Taxes and mandatory charges"
            value={money(totals.tax)}
          />
          <SummaryItem label="Total premium payable" value={money(totals.total)} />
        </div>
      </StepSection>
      <StepSection title="Taxes">
        <RiskTaxesFields form={wizard.form} riskPath="risks.0" inline />
      </StepSection>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value || 'Not set'}</p>
    </div>
  );
}

function setCoverPeriod(wizard: UnderwriteQuotationWizard, days: number) {
  const dates = computeCoverNoteDateRange(days);
  wizard.form.setValue('valid_from', dateOnlyPart(dates.validFrom), {
    shouldDirty: true,
    shouldValidate: true,
  });
  wizard.form.setValue('valid_until', dateOnlyPart(dates.validUntil), {
    shouldDirty: true,
    shouldValidate: true,
  });
}

function useShortTermDefaults(wizard: UnderwriteQuotationWizard) {
  const { form, isHydrating, productOptions, riskOptions } = wizard;
  const user = useAuthStore((state) => state.user);
  const userName = user?.email ?? '';
  const product = useMemo(
    () =>
      productOptions.find(
        (item) => item.product_code === SHORT_TERM_PRODUCT_CODE,
      ),
    [productOptions],
  );
  const risk = useMemo(
    () =>
      riskOptions.find(
        (item) => item.risk_code === SHORT_TERM_RISK_CODE,
      ),
    [riskOptions],
  );
  const vehicleValue = form.watch('motor.vehicle_value');

  useEffect(() => {
    if (isHydrating) return;
    if (!form.getValues('valid_from')) {
      const dates = computeCoverNoteDateRange(30);
      form.setValue('valid_from', dateOnlyPart(dates.validFrom), {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue('valid_until', dateOnlyPart(dates.validUntil), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    form.setValue('currency', 'TZS');
    form.setValue('exchange_rate', '1');
    form.setValue('cover_note_type', '1');
    form.setValue('payment_mode_tira', '1');
    form.setValue('channel_type', 'DIRECT');
    form.setValue('intermediary_company_id', '');
    form.setValue('cover_note_desc', 'Cover Note for Short-Term Motor');
    form.setValue('operative_clause', SHORT_TERM_OPERATIVE_CLAUSE);
    if (userName && !form.getValues('officer_name')) {
      form.setValue('officer_name', userName);
    }
    if (!form.getValues('officer_title')) {
      form.setValue('officer_title', 'DIRECT');
    }
  }, [form, isHydrating, userName]);

  useEffect(() => {
    if (!product || form.getValues('product_id') === product.id) return;
    form.setValue('product_id', product.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('category_id', product.category_id, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [form, product]);

  useEffect(() => {
    if (!risk) return;
    const sumInsured = vehicleValue || SHORT_TERM_SUM_INSURED;
    form.setValue('risks.0.risk_id', risk.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('risks.0.risk_code', risk.risk_code, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('risks.0.sum_insured', sumInsured, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('risks.0.sum_insured_equivalent', sumInsured);
    form.setValue('risks.0.discounts_offered', []);
    form.setValue('risks.0.taxes_charged', [
      {
        tax_code: 'VAT-MAINLAND',
        is_tax_exempted: false,
        tax_exemption_type: '',
        tax_exemption_reference: '',
        tax_rate: '0.18',
        tax_amount: '',
      },
    ]);
  }, [form, risk, vehicleValue]);

  return { product, risk };
}

export function ShortTermMotorQuotationWizardPage() {
  const { id } = useParams<{ id?: string }>();
  const wizard = useUnderwriteQuotationWizard({
    line: MOTOR,
    quotationId: id,
    steps: SHORT_TERM_STEPS,
  });
  const { product } = useShortTermDefaults(wizard);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Short-term</Badge>
        <span className="text-sm text-slate-500">
          {product
            ? `${product.product_name} mapped to TIRAMIS ${SHORT_TERM_PRODUCT_CODE}`
            : 'Waiting for short-term product configuration'}
        </span>
      </div>
      <UnderwriteWizardShell
        wizard={wizard}
        title={id ? 'Edit short-term motor quotation' : 'New short-term motor quotation'}
        renderStep={(stepId) => {
          switch (stepId) {
            case 'details':
              return <ShortTermDetailsStep wizard={wizard} />;
            case 'summary':
              return <ShortTermSummaryStep wizard={wizard} />;
            default:
              return null;
          }
        }}
      />
    </div>
  );
}
