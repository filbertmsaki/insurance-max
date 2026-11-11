import { useEffect, useRef } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import type { QuotationFormSchemaValues } from '../../schemas';
import { getVehicleIssues } from '../steps/MotorFleetDetailsStep';
import { buildFleetRiskPricingSignature } from '../utils/pricingStaleness';

/** Reprice after the loaded fleet or its pricing inputs change. */
export function useAutoFleetPricing(
  form: UseFormReturn<QuotationFormSchemaValues>,
  calculate: (index?: number, silent?: boolean) => Promise<void>,
  enabled: boolean,
) {
  useWatch({ control: form.control });
  const values = form.getValues();
  const signatures = values.fleet.items.flatMap((item) =>
    item.risks_covered.map((risk) =>
      buildFleetRiskPricingSignature({ ...values, fleet_header: values.fleet.header, item, risk }),
    ),
  ).join('|');
  const ready = values.fleet.items.length >= 2 && values.fleet.items.some((item) =>
    getVehicleIssues(item).length === 0 && item.risks_covered.some((risk) => Boolean(risk.risk_id)),
  );
  const calculateRef = useRef(calculate);
  useEffect(() => { calculateRef.current = calculate; });
  useEffect(() => {
    if (!enabled || !ready || !signatures) return;
    const timer = window.setTimeout(() => void calculateRef.current(undefined, true), 600);
    return () => window.clearTimeout(timer);
  }, [enabled, ready, signatures]);
}
