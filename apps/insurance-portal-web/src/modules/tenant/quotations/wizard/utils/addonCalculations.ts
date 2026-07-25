import type { QuotationFormSchemaValues } from '../../schemas';

// The zod-inferred row shape (optional string fields) — not the hand-written
// QuotationWizardAddonRow interface, which is what actually flows through the
// wizard's react-hook-form state.
type QuotationWizardAddonRow = QuotationFormSchemaValues['addons'][number];

export interface AddonTaxComputed {
  tax_code: string | undefined;
  tax_amount: number;
}

export interface AddonComputed {
  premiumExcludingTax: number;
  premiumExcludingTaxEquivalent: number;
  taxes: AddonTaxComputed[];
  totalTax: number;
  premiumIncludingTax: number;
}

/**
 * Derives the read-only totals shown next to an add-on row and used to build
 * the TIRA `CoverNoteAddon` payload later (Phase 13): tax amounts per tax row
 * (rate applied to premium-excluding-tax, 0 if exempted), the excluding-tax
 * equivalent (converted via exchangeRate when the quotation currency isn't
 * TZS, mirroring how risk SumInsuredEquivalent is derived), and the final
 * premium-including-tax total.
 */
export function computeAddonAmounts(
  addon: QuotationWizardAddonRow,
  exchangeRate: number,
): AddonComputed {
  const premiumExcludingTax = Number(addon.premium_excluding_tax) || 0;
  const rate =
    Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1;
  const premiumExcludingTaxEquivalent = premiumExcludingTax * rate;

  // tax_rate is a fraction (e.g. 0.18 for 18%), matching TIRA's own TaxRate
  // convention (<TaxRate>0.18</TaxRate>) rather than a whole-number percentage.
  const taxes = addon.taxes.map((tax) => ({
    tax_code: tax.tax_code,
    tax_amount: tax.is_tax_exempted
      ? 0
      : premiumExcludingTax * (Number(tax.tax_rate) || 0),
  }));

  const totalTax = taxes.reduce((sum, tax) => sum + tax.tax_amount, 0);

  return {
    premiumExcludingTax,
    premiumExcludingTaxEquivalent,
    taxes,
    totalTax,
    premiumIncludingTax: premiumExcludingTax + totalTax,
  };
}

/** Sum of premium-including-tax across all enabled add-on rows. */
export function sumEnabledAddonsTotal(
  addons: QuotationWizardAddonRow[],
  exchangeRate: number,
): number {
  return addons
    .filter((addon) => addon.enabled)
    .reduce(
      (total, addon) =>
        total + computeAddonAmounts(addon, exchangeRate).premiumIncludingTax,
      0,
    );
}
