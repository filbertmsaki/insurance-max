import { useEffect } from 'react';
import { useReferenceCurrencies } from '@/modules/platform/reference-data/hooks';
import { CURRENCY_OPTIONS } from '@/modules/tenant/quotations/wizard/QuotationStartModal';
import { CoverNoteSetupStep } from '@/modules/tenant/quotations/wizard/steps/CoverNoteSetupStep';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import type { UnderwriteQuotationWizard } from '../useUnderwriteQuotationWizard';

/**
 * Product & Cover: product, configured currency, then the existing cover
 * period / wording step. Motor insurance class is derived from the selected
 * product and resolved again by the backend.
 */
export function ProductCoverStep({
  wizard,
  currencyEditable = false,
}: {
  wizard: UnderwriteQuotationWizard;
  /** Enable when the exchange rate module supports user-selected currencies. */
  currencyEditable?: boolean;
}) {
  const { form, categoryOptions, productOptions, isHydrating, line } = wizard;
  const isMotor = line.line === 'MOTOR';
  const productId = form.watch('product_id');
  const categoryId = form.watch('category_id');
  const currency = form.watch('currency');
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
      ? productOptions.filter(
          (product) => product.category_id === categoryId,
        )
      : productOptions;

  useEffect(() => {
    if (isMotor && selectedProduct?.category_id) {
      form.setValue('category_id', selectedProduct.category_id, {
        shouldValidate: true,
      });
    }
  }, [form, isMotor, selectedProduct]);

  return (
    <div className="space-y-6">
      <StepSection
        title="Product"
        description="The product decides the available covers, rates and add-ons."
        first
      >
        <div className="grid gap-4 lg:grid-cols-3">
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
