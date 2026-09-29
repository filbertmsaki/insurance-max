import { useReferenceCurrencies } from '@/modules/platform/reference-data/hooks';
import { CURRENCY_OPTIONS } from '@/modules/tenant/quotations/wizard/QuotationStartModal';
import { CoverNoteSetupStep } from '@/modules/tenant/quotations/wizard/steps/CoverNoteSetupStep';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import type { UnderwriteQuotationWizard } from '../useUnderwriteQuotationWizard';

/**
 * Product & Cover: insurance class (category), product, currency, then the
 * existing cover period / wording step. Channel and intermediary live in the
 * Business Source step, so the cover step is rendered without them.
 */
export function ProductCoverStep({
  wizard,
}: {
  wizard: UnderwriteQuotationWizard;
}) {
  const { form, categoryOptions, productOptions, isHydrating } = wizard;
  const categoryId = form.watch('category_id');
  const currency = form.watch('currency');
  const { data: referenceCurrencies = [] } = useReferenceCurrencies({
    is_active: true,
  });
  const currencies = referenceCurrencies.length
    ? referenceCurrencies.map((item) => item.code)
    : [...CURRENCY_OPTIONS];
  const products = categoryId
    ? productOptions.filter((product) => product.category_id === categoryId)
    : productOptions;

  return (
    <div className="space-y-6">
      <StepSection
        title="Insurance class & product"
        description="The product decides the available covers, rates and add-ons."
        first
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <WizardInput
            form={form}
            name="category_id"
            label="Insurance class"
            required
            options={categoryOptions.map((item) => ({
              value: item.id,
              label: item.name ?? 'Category',
            }))}
            onChange={() => {
              if (
                !productOptions.some(
                  (product) =>
                    product.id === form.getValues('product_id') &&
                    product.category_id === form.getValues('category_id'),
                )
              ) {
                form.setValue('product_id', '', { shouldValidate: false });
              }
            }}
          />
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

      {/* The cover step shows its own class picker while none is chosen, so
          it is mounted once the class is known (or there is only one). */}
      {(categoryId || categoryOptions.length <= 1) && (
        <CoverNoteSetupStep
          form={form}
          categoryOptions={categoryOptions}
          productOptions={productOptions}
          isHydrating={isHydrating}
          title="Cover period & wording"
          firstSection={false}
          canSelectInsuranceChannel={false}
        />
      )}
    </div>
  );
}
