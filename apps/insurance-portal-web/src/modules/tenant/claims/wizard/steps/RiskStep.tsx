import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { formatClaimMoney } from '../../utils';
import { riskMeta, riskTitle } from '../helpers';
import type { ClaimWizard } from '../useClaimWizard';

export function RiskStep({ wizard }: { wizard: ClaimWizard }) {
  const { form, policy } = wizard;
  const selected = form.watch('policy_risk_id');
  const error = form.formState.errors.policy_risk_id?.message;
  const isFleet = policy.data?.business_line === 'FLEET';
  const currency = policy.data?.currency;

  if (policy.isLoading || !policy.data) {
    return <Skeleton className="h-40 w-full" />;
  }

  const risks = policy.data.risks;

  return (
    <StepSection
      title={isFleet ? 'Affected vehicle' : 'Affected risk'}
      description={
        isFleet
          ? 'A fleet claim covers one vehicle. Its own TIRA cover note is reported with the claim.'
          : 'Choose what the loss relates to. Risk details come from the policy and cannot be edited.'
      }
      first
    >
      {risks.length === 0 ? (
        <p className="text-sm text-slate-500">
          This policy has no itemised risks; the claim is recorded against the
          policy as a whole.
        </p>
      ) : (
        <div role="radiogroup" className="grid gap-3 md:grid-cols-2">
          {risks.map((risk) => {
            const checked = selected === risk.id;
            return (
              <label
                key={risk.id}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                  checked
                    ? 'border-sky-500 bg-sky-50/60'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <input
                  type="radio"
                  name="policy_risk_id"
                  className="mt-1"
                  checked={checked}
                  onChange={() =>
                    form.setValue('policy_risk_id', risk.id, {
                      shouldValidate: true,
                    })
                  }
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-slate-900">
                    {riskTitle(risk)}
                  </p>
                  <p className="text-xs text-slate-500">{riskMeta(risk)}</p>
                  <p className="text-xs text-slate-500">
                    Sum insured {formatClaimMoney(risk.sum_insured, currency)}
                    {risk.cover_note_reference_number
                      ? ` · Cover note ${risk.cover_note_reference_number}`
                      : ''}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}
      {error ? (
        <p className="text-sm font-medium text-red-600">{error}</p>
      ) : null}
    </StepSection>
  );
}
