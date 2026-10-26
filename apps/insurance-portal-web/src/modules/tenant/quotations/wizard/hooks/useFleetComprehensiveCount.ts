import { useEffect, useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import {
  countComprehensiveVehicles,
  type FleetComprehensiveCount,
  type MotorCoverClassSource,
} from '@insurance-max/contracts';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';

type FleetItems = QuotationFormSchemaValues['fleet']['items'];

/** Classify each vehicle's covers against the product's configured risks. */
export function countFleetComprehensive(
  items: FleetItems,
  riskOptions: InsuranceRisk[],
): FleetComprehensiveCount {
  return countComprehensiveVehicles(
    items.map((item) =>
      item.risks_covered
        .filter((risk) => risk.risk_id || risk.risk_code)
        .map(
          (risk): MotorCoverClassSource =>
            riskOptions.find(
              (option) =>
                option.id === risk.risk_id ||
                option.risk_code === risk.risk_code,
            ) ?? { risk_code: risk.risk_code },
        ),
    ),
  );
}

/**
 * Keeps `fleet.header.comprehensive_insured` equal to the vehicles whose
 * cover counts as comprehensive (TIRA §6 ComprehensiveInsured). Mount it
 * where it stays alive across wizard steps.
 */
export function useFleetComprehensiveCount(
  form: UseFormReturn<QuotationFormSchemaValues>,
  riskOptions: InsuranceRisk[],
  enabled: boolean,
): FleetComprehensiveCount {
  const items = useWatch({ control: form.control, name: 'fleet.items' });
  const count = useMemo(
    () => countFleetComprehensive(items ?? [], riskOptions),
    [items, riskOptions],
  );

  // Until the product's risks load, every cover looks unclassified; writing
  // then would overwrite a saved draft's value with 0. With no covers chosen
  // yet there is nothing to wait for, so the default must not linger.
  const hasCovers = (items ?? []).some((item) =>
    item.risks_covered.some((risk) => risk.risk_id || risk.risk_code),
  );
  const ready = enabled && (riskOptions.length > 0 || !hasCovers);
  useEffect(() => {
    if (!ready) return;
    const next = String(count.comprehensive);
    if (form.getValues('fleet.header.comprehensive_insured') !== next)
      form.setValue('fleet.header.comprehensive_insured', next, {
        shouldValidate: form.formState.isSubmitted,
      });
  }, [ready, count.comprehensive, form]);

  return count;
}
