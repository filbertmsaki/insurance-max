import { computeAddonAmounts } from './addonCalculations';
import {
  roundMoney,
  sumDecimals,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import type { QuotationFormSchemaValues } from '../../schemas';

export function quotationTotals(values: QuotationFormSchemaValues) {
  const fleet = values.quotation_flow === 'MOTOR_FLEET';
  const risks = fleet
    ? values.fleet.items.flatMap((item) => item.risks_covered)
    : values.risks;
  const addons = fleet
    ? values.fleet.items.flatMap((item) => item.cover_note_addons)
    : values.addons
        .filter((addon) => addon.enabled)
        .map((addon) => {
          const computed = computeAddonAmounts(addon, 1);
          return {
            premium_excluding_tax: String(computed.premiumExcludingTax),
            premium_excluding_tax_equivalent: String(
              computed.premiumExcludingTax,
            ),
            premium_including_tax: String(computed.premiumIncludingTax),
          };
        });
  const premium = roundMoney(
    sumDecimals([
      ...risks.map(
        (risk) =>
          risk.premium_excluding_tax_equivalent ||
          risk.premium_after_discount ||
          0,
      ),
      ...addons.map(
        (addon) =>
          addon.premium_excluding_tax_equivalent ||
          addon.premium_excluding_tax ||
          0,
      ),
    ]),
  );
  const total = roundMoney(
    sumDecimals([
      ...risks.map((risk) => risk.premium_including_tax || 0),
      ...addons.map(
        (addon) =>
          addon.premium_including_tax || addon.premium_excluding_tax || 0,
      ),
    ]),
  );
  return {
    premium,
    total,
    tax: roundMoney(total - premium),
    sumInsured: roundMoney(
      sumDecimals(risks.map((risk) => risk.sum_insured || 0)),
    ),
  };
}
