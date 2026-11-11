import { useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { useRiskPremiumCalculation } from '@/modules/tenant/quotations/wizard/hooks/useRiskPremiumCalculation';
import { useFleetPremiumCalculation } from '@/modules/tenant/quotations/wizard/steps/MotorFleetDetailsStep';
import { useAutoFleetPricing } from '@/modules/tenant/quotations/wizard/hooks/useAutoFleetPricing';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';

function CalculateButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={pending} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-[5px] border border-[#3B4A8C] px-3 font-semibold text-[#3B4A8C] disabled:opacity-60">
    {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
    {pending ? 'Calculating premium…' : 'Calculate premium'}
  </button>;
}

export function MobileSinglePricingControl({ wizard }: { wizard: UnderwriteQuotationWizard }) {
  const { calculateMutation, recalculate, handleSumInsuredBlur } = useRiskPremiumCalculation(wizard.form, 0, wizard.factorContext);
  const [riskId, sumInsured] = useWatch({ control: wizard.form.control, name: ['risks.0.risk_id', 'risks.0.sum_insured'] });
  useEffect(() => {
    const timer = window.setTimeout(handleSumInsuredBlur, 600);
    return () => window.clearTimeout(timer);
  }, [riskId, sumInsured, handleSumInsuredBlur]);
  return <CalculateButton pending={calculateMutation.isPending} onClick={() => { handleSumInsuredBlur(); recalculate(); }} />;
}

export function MobileFleetPricingControl({ wizard }: { wizard: UnderwriteQuotationWizard }) {
  const { form } = wizard;
  const { calculateFleetPremiums, isCalculating, calculationErrorMessage } = useFleetPremiumCalculation({
    form, riskOptions: wizard.riskOptions, factorContext: wizard.factorContext,
  });
  useAutoFleetPricing(form, calculateFleetPremiums, true);
  return <>
    <CalculateButton pending={isCalculating} onClick={() => void calculateFleetPremiums()} />
    {calculationErrorMessage && <p role="alert" className="mt-2 text-xs text-[#B42318]">{calculationErrorMessage}</p>}
  </>;
}
