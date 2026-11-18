import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { financeConfigurationHash } from '../finance-configuration/finance-configuration.types';
import { setupObject, setupText, setupUuid } from './finance-setup.types';
import { setupProductCoversInterval } from './finance-setup-legal';

export function productMapMatchesLegalScope(
  selected: unknown,
  entries: unknown,
): boolean {
  if (!Array.isArray(selected) || !Array.isArray(entries)) return false;
  const mapped = entries
    .filter((entry) => entry?.disposition === 'IN_SCOPE')
    .map((entry) => entry.productId)
    .sort();
  return (
    financeConfigurationHash([...selected].sort()) ===
    financeConfigurationHash(mapped)
  );
}

/** The map is a reviewed inactive proposal, never a posting authorization. */
export async function prepareProductMap(
  manager: EntityManager,
  companyId: string,
  payload: Record<string, any>,
  effectiveFrom: string,
  effectiveTo: string | null,
  freeze: boolean,
) {
  const mapping = payload.productMapping;
  if (mapping === undefined) return payload;
  if (
    !setupObject(mapping) ||
    mapping.schema !== 'FINANCE_PRODUCT_MAPPING_V1' ||
    mapping.activationAuthorized !== false ||
    !Array.isArray(mapping.entries) ||
    !Array.isArray(payload.rules) ||
    !effectiveTo
  )
    throw new BadRequestException(
      'A bounded inactive product mapping and complete entries are required.',
    );
  await manager.query(
    'SELECT id FROM insurance_product_versions WHERE company_id=$1 FOR SHARE',
    [companyId],
  );
  const products = await manager.query(
    `SELECT p.id,p.product_code,p.is_active,p.lifecycle_status,p.current_version_id,p.supports_fleet,
       v.status AS version_status,v.effective_from::text,v.effective_to::text,
       v.definition_hash,v.currency_code,v.default_cover_duration_days,v.supports_fleet AS version_supports_fleet
     FROM insurance_products p LEFT JOIN insurance_product_versions v
       ON v.id=p.current_version_id AND v.company_id=p.company_id AND v.product_id=p.id
     WHERE p.company_id=$1 AND p.deleted_at IS NULL AND p.is_active AND p.lifecycle_status='ACTIVE'
     ORDER BY p.id FOR SHARE OF p`,
    [companyId],
  );
  const risks = await manager.query(
    `SELECT r.id,r.product_id,r.risk_code,r.is_active,r.lifecycle_status,r.cover_class
     FROM insurance_risks r JOIN insurance_products p
       ON p.id::text=r.product_id::text AND p.company_id::text=r.company_id::text
     WHERE r.company_id=$1 AND r.deleted_at IS NULL AND r.is_active AND r.lifecycle_status='ACTIVE'
       AND p.deleted_at IS NULL AND p.is_active AND p.lifecycle_status='ACTIVE'
     ORDER BY r.id FOR SHARE OF r`,
    [companyId],
  );
  const snapshotHash = financeConfigurationHash({ products, risks });
  if (!freeze && mapping.inventoryHash !== snapshotHash)
    throw new ConflictException(
      'Product or risk inventory changed; prepare a new mapping version.',
    );
  const rules = new Set(
    payload.rules.map((rule: any) => rule.economicEffectKey),
  );
  const seen = new Set<string>();
  for (const entry of mapping.entries) {
    if (
      !setupObject(entry) ||
      !setupUuid(entry.productId) ||
      !setupUuid(entry.productVersionId) ||
      !['IN_SCOPE', 'EXCLUDED'].includes(String(entry.disposition)) ||
      !setupText(entry.reason, 2000) ||
      !Array.isArray(entry.riskIds) ||
      !entry.riskIds.every(setupUuid) ||
      new Set(entry.riskIds).size !== entry.riskIds.length ||
      !Array.isArray(entry.ruleKeys) ||
      entry.ruleKeys.some((v: unknown) => !setupText(v, 100)) ||
      new Set(entry.ruleKeys).size !== entry.ruleKeys.length ||
      seen.has(entry.productId)
    )
      throw new BadRequestException(
        'Each product requires one exact version, explicit disposition, reason, risks and rule references.',
      );
    seen.add(entry.productId);
    const product = products.find((p: any) => p.id === entry.productId);
    if (
      !product ||
      product.current_version_id !== entry.productVersionId ||
      (entry.disposition === 'IN_SCOPE' &&
        !setupProductCoversInterval(product, effectiveFrom, effectiveTo))
    )
      throw new ConflictException(
        'Every in-scope product must have a current company-owned version covering the mapping interval.',
      );
    const actualRisks = risks
      .filter((r: any) => r.product_id === entry.productId)
      .map((r: any) => r.id)
      .sort();
    if (
      entry.disposition === 'IN_SCOPE' &&
      (JSON.stringify([...entry.riskIds].sort()) !==
        JSON.stringify(actualRisks) ||
        !entry.ruleKeys.length ||
        entry.ruleKeys.some((key: string) => !rules.has(key)))
    )
      throw new BadRequestException(
        'In-scope products must list every current risk and reference existing inactive rules.',
      );
    if (
      entry.disposition === 'EXCLUDED' &&
      (entry.riskIds.length || entry.ruleKeys.length)
    )
      throw new BadRequestException(
        'Excluded products cannot claim risk or posting-rule mappings.',
      );
  }
  if (
    seen.size !== products.length ||
    products.some((p: any) => !seen.has(p.id))
  )
    throw new BadRequestException(
      'Every active company product needs an explicit mapping or exclusion.',
    );
  return {
    ...payload,
    productMapping: { ...mapping, inventoryHash: snapshotHash },
  };
}
