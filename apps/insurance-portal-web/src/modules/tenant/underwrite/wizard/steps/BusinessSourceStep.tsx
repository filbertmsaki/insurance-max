import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { KeyValueGrid } from '@/components/shared/DetailSections';
import { useIntermediaryCompanyOptions } from '@/modules/tenant/quotations/hooks';
import { CHANNEL_TYPES } from '@/modules/tenant/quotations/wizard/steps/CoverNoteSetupStep';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import type { UnderwriteQuotationWizard } from '../useUnderwriteQuotationWizard';

const CHANNEL_LABELS: Record<(typeof CHANNEL_TYPES)[number], string> = {
  DIRECT: 'Direct',
  BROKER: 'Broker',
  AGENCY: 'Agency',
  BANCASSURANCE: 'Bancassurance',
  API: 'API',
};

/**
 * Business source: insurance channel, intermediary (broker/agency/...),
 * commission, and the issuing branch / sales point.
 *
 * Channel choice follows the existing rule: only users holding
 * `quotations:select-insurance-channel` may leave DIRECT, and the backend
 * rejects any other attempt. Intermediaries are the companies with an active
 * distribution channel for the selected product.
 */
export function BusinessSourceStep({
  wizard,
}: {
  wizard: UnderwriteQuotationWizard;
}) {
  const { form, canSelectInsuranceChannel, salePointCode } = wizard;
  const channelType = form.watch('channel_type');
  const productId = form.watch('product_id');
  const intermediaries = useIntermediaryCompanyOptions(
    canSelectInsuranceChannel ? channelType : 'DIRECT',
    productId,
  );
  const user = useAuthStore((state) => state.user);
  const isIntermediated = canSelectInsuranceChannel && channelType !== 'DIRECT';

  return (
    <div className="space-y-6">
      <StepSection
        title="Insurance channel"
        description={
          canSelectInsuranceChannel
            ? 'Choose how this business was sourced.'
            : 'You can quote direct business only. Ask an administrator for insurance channel access to quote through an intermediary.'
        }
        first
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <WizardInput
            form={form}
            name="channel_type"
            label="Channel"
            required
            disabled={!canSelectInsuranceChannel}
            options={CHANNEL_TYPES.map((value) => ({
              value,
              label: CHANNEL_LABELS[value],
            }))}
            onChange={(value) => {
              if (value === 'DIRECT') {
                form.setValue('intermediary_company_id', '');
                form.setValue('commission_paid', '');
                form.setValue('commission_rate', '');
              }
            }}
          />
          {isIntermediated && (
            <WizardInput
              form={form}
              name="intermediary_company_id"
              label="Intermediary"
              required
              searchable
              options={intermediaries.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          )}
        </div>
        {isIntermediated && intermediaries.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">
            No active{' '}
            {CHANNEL_LABELS[
              channelType as keyof typeof CHANNEL_LABELS
            ]?.toLowerCase()}{' '}
            is set up to quote this product.
          </p>
        )}
      </StepSection>

      {isIntermediated && (
        <StepSection title="Commission">
          <div className="grid gap-4 sm:grid-cols-2">
            <WizardInput
              form={form}
              name="commission_rate"
              label="Commission rate"
              type="number"
            />
            <WizardInput
              form={form}
              name="commission_paid"
              label="Commission amount"
              type="number"
            />
          </div>
        </StepSection>
      )}

      <StepSection title="Issuing office">
        <KeyValueGrid
          items={[
            {
              label: 'Branch',
              value: user?.activeBranchName || user?.activeBranchCode || '—',
            },
            {
              label: 'Sales point',
              value: salePointCode
                ? [user?.defaultSalePointName, salePointCode]
                    .filter(Boolean)
                    .join(' · ')
                : 'Not configured for your active branch',
            },
          ]}
        />
      </StepSection>
    </div>
  );
}
