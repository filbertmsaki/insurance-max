import type { QuotationFormSchemaValues } from '../../schemas';
import {
  buildFleetRiskPricingSignature,
  buildSingleRiskPricingSignature,
} from './pricingStaleness';

export function quotationPricingIssues(
  values: QuotationFormSchemaValues,
): string[] {
  const rows =
    values.quotation_flow === 'MOTOR_FLEET'
      ? values.fleet.items.flatMap((item, index) =>
          item.risks_covered.map((risk) => ({
            label: `Vehicle ${index + 1}`,
            risk,
            signature: buildFleetRiskPricingSignature({
              ...values,
              fleet_header: values.fleet.header,
              item,
              risk,
            }),
          })),
        )
      : values.risks.map((risk, index) => ({
          label: `Cover ${index + 1}`,
          risk,
          signature: buildSingleRiskPricingSignature({ ...values, risk }),
        }));
  return rows.flatMap(({ label, risk, signature }) => {
    const metadata = risk.rating_result_metadata;
    if (
      !metadata?.pricing_quote_id ||
      metadata.pricing_is_stale ||
      metadata.pricing_status === 'STALE' ||
      metadata.pricing_input_signature !== signature ||
      (metadata.expires_at &&
        new Date(metadata.expires_at).getTime() <= Date.now())
    ) {
      return [
        `${label}: premium needs to finish calculating. Check any missing cover details.`,
      ];
    }
    return [];
  });
}
