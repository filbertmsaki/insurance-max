import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { assertTaxEffective } from '../../../shared/finance/tax-calculation';

export async function readSetupTaxRules(m: EntityManager, companyId: string) {
  const legacy = await m.query(
    `SELECT id,tax_name,tax_code,tax_rate::text,is_active,calculation_options FROM taxes WHERE company_id=$1 AND deleted_at IS NULL ORDER BY id FOR SHARE`,
    [companyId],
  );
  const product = await m.query(
    `SELECT id,tax_name,tax_code,tax_type,charge_category,tax_rate::text,tax_amount::text,calculation_base,effective_from::text,effective_to::text,status FROM product_tax_rules WHERE company_id=$1 AND deleted_at IS NULL ORDER BY id FOR SHARE`,
    [companyId],
  );
  return [
    ...legacy.map((r: any) => ({ ...r, source: 'LEGACY_TAXES' })),
    ...product.map((r: any) => ({ ...r, source: 'PRODUCT_TAX_RULES' })),
  ];
}
/** Uses the source engine's date rules; never calculates or maintains a second tax rate schedule. */
export function selectSetupTaxRules(
  rows: any[],
  source: string,
  ids: string[],
  from: string,
  to: string | null,
) {
  const selected = rows.filter(
    (r) => r.source === source && ids.includes(r.id),
  );
  if (selected.length !== ids.length)
    throw new ConflictException(
      'Every configured tax rule must belong to this source company and catalogue.',
    );
  for (const r of selected) {
    const legacy = source === 'LEGACY_TAXES';
    if (legacy ? !r.is_active : r.status !== 'ACTIVE')
      throw new ConflictException(
        'Referenced source tax rules must be active.',
      );
    const options = legacy
      ? r.calculation_options
      : { effective_from: r.effective_from, effective_to: r.effective_to };
    const validated = assertTaxEffective(options, from);
    if (to)
      assertTaxEffective(
        options,
        new Date(Date.parse(to + 'T00:00:00Z') - 86400000)
          .toISOString()
          .slice(0, 10),
      );
    else if (validated.effective_to)
      throw new ConflictException(
        'A bounded source tax rule requires a bounded configuration interval.',
      );
  }
  return selected;
}
