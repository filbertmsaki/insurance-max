import { Button } from '@/components/ui/button';
import { formatMoney } from '@/modules/shared/formatting/number-format';
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
  readOnly = false,
  onEdit,
}: {
  wizard: UnderwriteQuotationWizard;
  readOnly?: boolean;
  onEdit?: () => void;
}) {
  const { form, canSelectInsuranceChannel } = wizard;
  const channelType = form.watch('channel_type');
  const productId = form.watch('product_id');
  const intermediaries = useIntermediaryCompanyOptions(
    canSelectInsuranceChannel ? channelType : 'DIRECT',
    productId,
  );
  const commissionRate = form.watch('commission_rate');
  const commissionPaid = form.watch('commission_paid');
  const currency = form.watch('currency');
  const intermediaryId = form.watch('intermediary_company_id');
  const isIntermediated = canSelectInsuranceChannel && channelType !== 'DIRECT';

  if (readOnly) {
    return (
      <StepSection
        title="Business source"
        action={
          onEdit && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={onEdit}
            >
              Edit business source
            </Button>
          )
        }
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Channel</dt>
            <dd className="mt-1 font-medium">{CHANNEL_LABELS[channelType]}</dd>
          </div>
          {isIntermediated && (
            <div>
              <dt className="text-slate-500">Intermediary</dt>
              <dd className="mt-1 font-medium">
                {intermediaries.find((item) => item.id === intermediaryId)
                  ?.name || 'Not selected'}
              </dd>
            </div>
          )}
          {isIntermediated && commissionRate && (
            <div>
              <dt className="text-slate-500">Commission rate</dt>
              <dd className="mt-1 tabular-nums">{commissionRate}</dd>
            </div>
          )}
          {isIntermediated && commissionPaid && (
            <div>
              <dt className="text-slate-500">Commission amount</dt>
              <dd className="mt-1 tabular-nums">
                {formatMoney(Number(commissionPaid), currency || 'TZS')}
              </dd>
            </div>
          )}
          {wizard.salePointCode && (
            <div>
              <dt className="text-slate-500">Sales point</dt>
              <dd className="mt-1 font-medium">{wizard.salePointCode}</dd>
            </div>
          )}
        </dl>
      </StepSection>
    );
  }

  return (
    <div className="space-y-6">
      {!canSelectInsuranceChannel && wizard.line.slug === 'fleet' && (
        <StepSection title="Insurance channel" first>
          <p className="text-sm font-medium text-slate-900">Direct business</p>
        </StepSection>
      )}
      {canSelectInsuranceChannel && (
        <StepSection
          title="Insurance channel"
          description="Choose how this business was sourced."
          first
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <WizardInput
              form={form}
              name="channel_type"
              label="Channel"
              required
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
      )}

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
    </div>
  );
}
