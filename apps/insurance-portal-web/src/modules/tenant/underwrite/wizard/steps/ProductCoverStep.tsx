import { useEffect, type ReactNode } from 'react';
import { useReferenceCurrencies } from '@/modules/platform/reference-data/hooks';
import { CURRENCY_OPTIONS } from '@/modules/tenant/quotations/wizard/QuotationStartModal';
import { CoverNoteSetupStep } from '@/modules/tenant/quotations/wizard/steps/CoverNoteSetupStep';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import {
  createEmptyRiskDiscountRow,
  createEmptyRiskTaxRow,
} from '@/modules/tenant/quotations/schemas';
import type { UnderwriteQuotationWizard } from '../useUnderwriteQuotationWizard';

/**
 * Product & Cover: product, configured currency, then the existing cover
 * period / wording step. Motor insurance class is derived from the selected
 * product and resolved again by the backend.
 */
export function ProductCoverStep({
  wizard,
  currencyEditable = false,
  compact = false,
  extraFields,
  leadingFields,
  title = 'Product',
  first = true,
}: {
  wizard: UnderwriteQuotationWizard;
  /** Enable when the exchange rate module supports user-selected currencies. */
  currencyEditable?: boolean;
  /** Uses a compact two-column product and risk layout in the Motor wizard. */
  compact?: boolean;
  /** Extra inputs placed in the product grid (e.g. payment method). */
  extraFields?: ReactNode;
  /** Inputs placed before Product in the same grid row (e.g. fleet type). */
  leadingFields?: ReactNode;
  title?: string;
  first?: boolean;
}) {
  const { form, categoryOptions, productOptions, isHydrating, line } = wizard;
  const isMotor = line.line === 'MOTOR';
  const productId = form.watch('product_id');
  const categoryId = form.watch('category_id');
  const currency = form.watch('currency');
  const selectedRiskId = form.watch('risks.0.risk_id');
  const selectedProduct = productOptions.find(
    (product) => product.id === productId,
  );
  const { data: referenceCurrencies = [] } = useReferenceCurrencies({
    is_active: true,
  });
  const currencies = referenceCurrencies.length
    ? referenceCurrencies.map((item) => item.code)
    : [...CURRENCY_OPTIONS];
  const products = isMotor
    ? productOptions
    : categoryId
      ? productOptions.filter((product) => product.category_id === categoryId)
      : productOptions;

  // The only valid product needs no decision.
  const onlyProduct = products.length === 1 ? products[0] : undefined;
  useEffect(() => {
    if (isHydrating || productId || !onlyProduct) return;
    form.setValue('product_id', onlyProduct.id, { shouldValidate: true });
    if (onlyProduct.category_id) {
      form.setValue('category_id', onlyProduct.category_id);
    }
  }, [form, isHydrating, onlyProduct, productId]);

  useEffect(() => {
    if (isMotor && selectedProduct?.category_id) {
      form.setValue('category_id', selectedProduct.category_id, {
        shouldValidate: true,
      });
    }
  }, [form, isMotor, selectedProduct]);

  useEffect(() => {
    if (!isMotor || !selectedRiskId) return;
    const selectedRisk = wizard.riskOptions.find(
      (risk) => risk.id === selectedRiskId,
    );
    if (
      selectedRisk?.risk_code &&
      form.getValues('risks.0.risk_code') !== selectedRisk.risk_code
    ) {
      form.setValue('risks.0.risk_code', selectedRisk.risk_code, {
        shouldValidate: true,
      });
    }
  }, [form, isMotor, selectedRiskId, wizard.riskOptions]);

  useEffect(() => {
    if (!isMotor || !selectedRiskId || wizard.riskOptions.length === 0) return;
    if (wizard.riskOptions.some((risk) => risk.id === selectedRiskId)) return;
    form.setValue('risks.0.risk_id', '', { shouldValidate: true });
    form.setValue('risks.0.risk_code', '', { shouldValidate: true });
  }, [form, isMotor, selectedRiskId, wizard.riskOptions]);

  const resetMotorPricing = () => {
    form.setValue('risks.0.premium_rate', '');
    form.setValue('risks.0.premium_before_discount', '');
    form.setValue('risks.0.premium_after_discount', '');
    form.setValue('risks.0.premium_excluding_tax_equivalent', '');
    form.setValue('risks.0.premium_including_tax', '');
    form.setValue('risks.0.discounts_offered', [createEmptyRiskDiscountRow()]);
    form.setValue('risks.0.taxes_charged', [createEmptyRiskTaxRow()]);
    form.setValue('risks.0.factor_values', {});
    form.setValue('risks.0.rating_result_metadata', null);
    form.setValue('risks.0.minimum_amount', '');
  };

  const showCurrency = !compact || currencyEditable || currency !== 'TZS';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      <StepSection title={compact ? undefined : title} first={first}>
        <div
          className={
            compact ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4 lg:grid-cols-3'
          }
        >
          {leadingFields}
          <WizardInput
            form={form}
            name="product_id"
            label="Product"
            required
            searchable
            options={products.map((item) => ({
              value: item.id,
              label: item.product_name,
            }))}
            onChange={(value) => {
              const product = productOptions.find((item) => item.id === value);
              if (product?.category_id) {
                form.setValue('category_id', product.category_id);
              }
            }}
          />
          {isMotor && (
            <WizardInput
              form={form}
              name="risks.0.risk_id"
              label="Risk"
              required
              searchable
              disabled={!productId}
              options={wizard.riskOptions.map((risk) => ({
                value: risk.id,
                label: risk.risk_name,
              }))}
              onChange={(value) => {
                const risk = wizard.riskOptions.find(
                  (option) => option.id === value,
                );
                form.setValue('risks.0.risk_code', risk?.risk_code ?? '', {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                resetMotorPricing();
              }}
            />
          )}
          {showCurrency && (
            <WizardInput
              form={form}
              name="currency"
              label="Currency"
              required
              options={currencies.map((code) => ({ value: code, label: code }))}
              readOnly={!currencyEditable}
              onChange={(value) => {
                if (value === 'TZS') form.setValue('exchange_rate', '1');
              }}
            />
          )}
          {extraFields}
        </div>
        {currency !== 'TZS' && (
          <p className="mt-2 text-xs text-slate-500">
            The exchange rate to TZS is captured under cover options below.
          </p>
        )}
      </StepSection>

      {/* The legacy cover step owns class selection for non-Motor lines. */}
      {(isMotor
        ? Boolean(productId)
        : Boolean(categoryId || categoryOptions.length <= 1)) && (
        <CoverNoteSetupStep
          form={form}
          categoryOptions={isMotor ? [] : categoryOptions}
          productOptions={productOptions}
          isHydrating={isHydrating}
          title="Cover period & wording"
          firstSection={false}
          canSelectInsuranceChannel={false}
          showCategoryPicker={!isMotor}
        />
      )}
    </div>
  );
}
