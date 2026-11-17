import { BadRequestException, ConflictException } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  calculatePercentageTaxes,
  requiredDecimal,
  taxMoney,
  taxOptions,
  assertTaxEffective,
  statutoryCharge,
  type ChargeCategory,
} from '../../../shared/finance/tax-calculation';
import { DecimalUtil } from '../../../shared/finance/decimal.util';
import type { Invoice } from '../entities/invoice.entity';
type Row = Record<string, any>;
export interface InvoiceChargeEvidence {
  code: string;
  name: string;
  category: ChargeCategory;
  ruleId: string;
  rate: string;
  basis: 'EXCLUSIVE' | 'INCLUSIVE';
  baseAmount: string;
  amount: string;
  exempt: boolean;
  exemptionType: string | null;
  exemptionReference: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  ledgerAccountCode: string | null;
}
export interface InvoicePremiumEvidence {
  key: string;
  sourceId: string;
  sourceType: 'RISK' | 'ADDON';
  description: string;
  gross: string;
  discount: string;
  net: string;
  total: string;
  charges: InvoiceChargeEvidence[];
  pricingResultHash: string | null;
}
export interface QuotationInvoiceTaxBreakdown {
  schema: 'QUOTATION_INVOICE_TAX_V1';
  quotationId: string;
  companyId: string;
  currency: string;
  effectiveDate: string;
  gross: string;
  discount: string;
  net: string;
  tax: string;
  levies: string;
  fees: string;
  statutory: string;
  total: string;
  lines: InvoicePremiumEvidence[];
  financialHash: string;
}
const h = new ProductDefinitionHashService();
function unresolved(message: string): never {
  throw new BadRequestException({
    code: 'QUOTATION_TAX_BREAKDOWN_UNRESOLVED',
    message,
    action: 'RECONCILE_OR_RECALCULATE_WITHOUT_CHANGING_AGREED_PAYABLE',
  });
}
const money = (v: unknown, label: string) =>
  taxMoney(requiredDecimal(v, label));
function sum(values: string[]) {
  return values.reduce((n, v) => n.plus(v), DecimalUtil.value(0)).toFixed(2);
}

/** Consume original quotation evidence; never look up a new rate and reprice the customer. */
export function buildQuotationInvoiceTax(
  q: Row,
  catalogue: Row[],
  pricingQuotes: Row[],
  agreedAmount: string,
  currency: string,
): QuotationInvoiceTaxBreakdown {
  const cover = q.cover_note;
  if (!cover || !Array.isArray(cover.entries) || !cover.entries.length)
    unresolved('The quotation has no persisted premium components.');
  if (
    !currency ||
    currency !== cover.currency_code ||
    !/^[A-Z]{3}$/.test(currency)
  )
    unresolved('Quotation and invoice currencies must match explicitly.');
  const start = cover.cover_note_start_date;
  const date =
    start instanceof Date && !Number.isNaN(start.getTime())
      ? start.toISOString().slice(0, 10)
      : String(start ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    unresolved('The quotation tax effective date is missing.');
  const configs = new Map(catalogue.map((t) => [t.tax_code, t])),
    quotes = new Map(pricingQuotes.map((p) => [p.pricing_quote_id, p]));
  const lines: InvoicePremiumEvidence[] = [];
  for (const entry of [...cover.entries].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  ))
    for (const [type, items] of [
      ['RISK', entry.risks],
      ['ADDON', entry.addons],
    ] as const) {
      if (!Array.isArray(items))
        unresolved(
          'The complete quotation risk and add-on collections are required.',
        );
      for (const item of [...items].sort((a, b) =>
        String(a.id).localeCompare(String(b.id)),
      )) {
        if (!item.id || !Array.isArray(item.taxes) || !item.taxes.length)
          unresolved(
            'Every premium component needs explicit taxable, zero-rated or exemption evidence.',
          );
        const net = money(
            item.premium_excluding_tax_equivalent,
            `Net premium ${item.id}`,
          ),
          total = money(item.premium_including_tax, `Total premium ${item.id}`);
        const gross =
          type === 'RISK'
            ? money(
                item.premium_before_discount,
                `Premium before discount ${item.id}`,
              )
            : net;
        const discount = DecimalUtil.value(gross).minus(net);
        if (discount.isNegative())
          unresolved('Discounted premium exceeds its original premium.');
        const pq = quotes.get(item.pricing_quote_id),
          frozen = Array.isArray(pq?.result_payload?.charges)
            ? pq.result_payload.charges
            : [];
        const basis: 'INCLUSIVE' | 'EXCLUSIVE' =
          item.pricing_snapshot?.taxBasis === 'INCLUSIVE' ||
          frozen.some((c: Row) => c.price_basis === 'INCLUSIVE')
            ? 'INCLUSIVE'
            : 'EXCLUSIVE';
        const quoteHash =
          item.pricing_result_hash ?? item.pricing_snapshot?.resultHash ?? null;
        if (pq && quoteHash && pq.result_hash !== quoteHash)
          unresolved(
            'The original pricing result hash differs from the quotation.',
          );
        const seen = new Set<string>();
        const charges: InvoiceChargeEvidence[] = [...item.taxes]
          .sort((a, b) => String(a.tax_code).localeCompare(String(b.tax_code)))
          .map((t: Row) => {
            const code = String(t.tax_code ?? '')
              .trim()
              .toUpperCase();
            if (!code || seen.has(code))
              unresolved(
                'Tax codes must be present and unique per premium component.',
              );
            seen.add(code);
            const rate = requiredDecimal(
                t.tax_rate,
                `Original rate ${code}`,
              ).toFixed(10),
              original = frozen.find((r: Row) => r.charge_code === code),
              config = configs.get(code);
            let options: ReturnType<typeof taxOptions>,
              ruleId: string,
              name: string;
            if (original) {
              if (
                original.charge_type !== 'PERCENTAGE' ||
                original.calculation_base !== 'NET_PREMIUM' ||
                !original.applied_rule_id ||
                !original.charge_name
              )
                unresolved(
                  `The original charge model or rule evidence for ${code} is unsupported; do not infer a different calculation basis.`,
                );
              if (
                requiredDecimal(original.rate, `Frozen rate ${code}`).toFixed(
                  10,
                ) !== rate
              )
                unresolved(
                  `Original pricing and quotation tax rates differ for ${code}.`,
                );
              options = assertTaxEffective(
                {
                  category: original.charge_category,
                  effective_from: original.effective_from || null,
                  effective_to: original.effective_to || null,
                  ledger_account_code: original.ledger_account_code ?? null,
                },
                date,
              );
              ruleId = original.applied_rule_id;
              name = original.charge_name;
            } else {
              if (
                !config ||
                config.is_active === false ||
                config.deleted_at ||
                requiredDecimal(
                  config.tax_rate,
                  `Configured rate ${code}`,
                ).toFixed(10) !== rate
              )
                unresolved(
                  `Historical tax configuration is unavailable for ${code}; do not substitute the latest rate.`,
                );
              options = assertTaxEffective(config.calculation_options, date);
              ruleId = config.id;
              name = config.tax_name;
            }
            const exempt = t.is_tax_exempted === 'Y';
            if (!['Y', 'N'].includes(t.is_tax_exempted))
              unresolved(`Exemption status for ${code} is missing.`);
            const amount = money(t.tax_amount, `Original amount ${code}`);
            return {
              code,
              name,
              category: options.category,
              ruleId,
              rate,
              basis,
              baseAmount: '',
              amount,
              exempt,
              exemptionType: exempt ? t.tax_exemption_type : null,
              exemptionReference: exempt ? t.tax_exemption_reference : null,
              effectiveFrom: options.effective_from,
              effectiveTo: options.effective_to,
              ledgerAccountCode:
                options.ledger_account_code ??
                (options.category === 'TAX' ? '4200' : null),
            };
          });
        const calculated = calculatePercentageTaxes(
          basis === 'INCLUSIVE' ? total : net,
          charges.map((c) => ({
            code: c.code,
            rate: c.rate,
            exempt: c.exempt,
            exemptionType: c.exemptionType,
            exemptionReference: c.exemptionReference,
          })),
          basis,
        );
        if (calculated.net !== net)
          unresolved(
            'Extracted inclusive net premium differs from the agreed source breakdown.',
          );
        charges.forEach((c, n) => {
          if (c.amount !== calculated.charges[n].amount)
            unresolved(
              `Calculated ${c.code} does not reconcile to the agreed quotation tax amount.`,
            );
          c.baseAmount = calculated.charges[n].baseAmount;
        });
        if (sum([net, ...charges.map((c) => c.amount)]) !== total)
          unresolved(
            'Premium and all tax/levy/fee components do not equal the agreed item total.',
          );
        lines.push({
          key: `${type}:${item.id}`,
          sourceId: item.id,
          sourceType: type,
          description:
            type === 'RISK'
              ? `Premium ${item.risk_code}`
              : `Add-on ${item.addon_reference}`,
          gross,
          discount: discount.toFixed(2),
          net,
          total,
          charges,
          pricingResultHash: quoteHash,
        });
      }
    }
  if (!lines.length) unresolved('The quotation has no premium lines.');
  const amounts = {
    gross: sum(lines.map((l) => l.gross)),
    discount: sum(lines.map((l) => l.discount)),
    net: sum(lines.map((l) => l.net)),
    tax: sum(
      lines.flatMap((l) =>
        l.charges.filter((c) => c.category === 'TAX').map((c) => c.amount),
      ),
    ),
    levies: sum(
      lines.flatMap((l) =>
        l.charges
          .filter((c) => c.category === 'LEVY' || c.category === 'STAMP_DUTY')
          .map((c) => c.amount),
      ),
    ),
    fees: sum(
      lines.flatMap((l) =>
        l.charges
          .filter((c) => !statutoryCharge(c.category))
          .map((c) => c.amount),
      ),
    ),
    statutory: sum(
      lines.flatMap((l) =>
        l.charges
          .filter((c) => statutoryCharge(c.category))
          .map((c) => c.amount),
      ),
    ),
    total: sum(lines.map((l) => l.total)),
  };
  if (
    amounts.net !==
      money(cover.total_premium_excluding_tax, 'Quotation net total') ||
    amounts.total !==
      money(cover.total_premium_including_tax, 'Quotation payable total') ||
    amounts.total !== money(agreedAmount, 'Agreed customer payable')
  )
    unresolved(
      'The component breakdown does not reconcile with the quotation and agreed payable. No customer amount was changed.',
    );
  const subject = {
    schema: 'QUOTATION_INVOICE_TAX_V1' as const,
    quotationId: q.id,
    companyId: q.company_id,
    currency,
    effectiveDate: date,
    ...amounts,
    lines,
  };
  return { ...subject, financialHash: h.hashDefinition(subject) };
}

export function validatedInvoiceTax(
  invoice: Pick<
    Invoice,
    | 'source_type'
    | 'quotation_id'
    | 'company_id'
    | 'currency'
    | 'gross_amount'
    | 'discount_amount'
    | 'tax_amount'
    | 'charges_amount'
    | 'total_amount'
    | 'items'
  >,
): QuotationInvoiceTaxBreakdown {
  const fail = (): never => {
    throw new ConflictException({
      code: 'INVOICE_TAX_RECONCILIATION_REQUIRED',
      message:
        'The quotation invoice tax breakdown is missing, changed or unreconciled. Review the original quotation and financial records before issuing, posting or creating payment instructions.',
    });
  };
  const items = invoice.items ?? [],
    evidence = items.filter((i) => i.line_snapshot?.tax_breakdown);
  if (evidence.length !== 1) fail();
  const b = evidence[0].line_snapshot!
    .tax_breakdown as QuotationInvoiceTaxBreakdown;
  if (!b || b.schema !== 'QUOTATION_INVOICE_TAX_V1' || !Array.isArray(b.lines))
    fail();
  const { financialHash, ...subject } = b;
  if (
    h.hashDefinition(subject) !== financialHash ||
    b.quotationId !== invoice.quotation_id ||
    b.companyId !== invoice.company_id ||
    b.currency !== invoice.currency ||
    invoice.gross_amount !== b.gross ||
    invoice.discount_amount !== b.discount ||
    invoice.tax_amount !== b.statutory ||
    invoice.charges_amount !== b.fees ||
    invoice.total_amount !== b.total
  )
    fail();
  const expected: Record<string, string> = {};
  for (const l of b.lines) {
    if (!l.sourceId || !Array.isArray(l.charges)) fail();
    expected[`${l.key}:NET`] = l.net;
    const basis = l.charges[0]?.basis ?? 'EXCLUSIVE';
    if (l.charges.some((c) => c.basis !== basis)) fail();
    const calc = calculatePercentageTaxes(
      basis === 'INCLUSIVE' ? l.total : l.net,
      l.charges.map((c) => ({
        code: c.code,
        rate: c.rate,
        exempt: c.exempt,
        exemptionType: c.exemptionType,
        exemptionReference: c.exemptionReference,
      })),
      basis,
    );
    if (calc.net !== l.net) fail();
    l.charges.forEach((c, n) => {
      if (
        calc.charges[n].amount !== c.amount ||
        calc.charges[n].baseAmount !== c.baseAmount
      )
        fail();
      expected[`${l.key}:${c.code}`] = c.amount;
    });
    if (sum([l.net, ...l.charges.map((c) => c.amount)]) !== l.total) fail();
  }
  if (
    items.length !== Object.keys(expected).length ||
    sum(b.lines.map((l) => l.gross)) !== b.gross ||
    sum(b.lines.map((l) => l.discount)) !== b.discount ||
    sum(b.lines.map((l) => l.net)) !== b.net ||
    sum(b.lines.map((l) => l.total)) !== b.total ||
    sum(
      b.lines.flatMap((l) =>
        l.charges
          .filter((c) => statutoryCharge(c.category))
          .map((c) => c.amount),
      ),
    ) !== b.statutory ||
    sum(
      b.lines.flatMap((l) =>
        l.charges
          .filter((c) => !statutoryCharge(c.category))
          .map((c) => c.amount),
      ),
    ) !== b.fees
  )
    fail();
  const seen = new Set<string>();
  for (const i of items) {
    const s = i.line_snapshot;
    if (!s) return fail();
    const key = s.component_key;
    if (
      typeof key !== 'string' ||
      seen.has(key) ||
      expected[key] !== i.total_amount ||
      !requiredDecimal(i.quantity, 'Invoice component quantity').equals(1) ||
      i.unit_amount !== i.total_amount ||
      i.line_hash !== h.hashDefinition(s)
    )
      return fail();
    seen.add(key);
  }
  return b;
}
