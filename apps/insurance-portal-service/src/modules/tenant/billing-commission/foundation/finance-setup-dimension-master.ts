import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  financeConfigurationHash,
  FINANCE_UUID,
  isFinanceDate,
} from './finance-configuration.types';
import { setupProductCoversInterval } from './finance-setup-legal';

/** Freeze company-owned source identities for an inactive setup release, then recheck them on review. */
export async function prepareSetupDimensionMaster(
  manager: EntityManager,
  companyId: string,
  payload: Record<string, unknown>,
  from: string,
  to: string | null,
  freeze: boolean,
): Promise<Record<string, unknown>> {
  const requested = payload.companyMaster;
  if (requested === undefined) return payload;
  if (
    !requested ||
    typeof requested !== 'object' ||
    Array.isArray(requested) ||
    !FINANCE_UUID.test(companyId) ||
    !isFinanceDate(from) ||
    !isFinanceDate(to) ||
    to <= from
  )
    throw new BadRequestException(
      'A bounded company dimension master is required.',
    );
  const master = requested as Record<string, unknown>;
  const allowed = [
    'schema',
    'branchIds',
    'productIds',
    ...(freeze ? [] : ['snapshot', 'snapshotHash']),
  ];
  if (
    master.schema !== 'FINANCE_COMPANY_DIMENSION_MASTER_V1' ||
    Object.keys(master).some((key) => !allowed.includes(key)) ||
    !Array.isArray(master.branchIds) ||
    !Array.isArray(master.productIds) ||
    master.branchIds.length + master.productIds.length < 1 ||
    master.branchIds.length + master.productIds.length > 10000
  )
    throw new BadRequestException(
      'Explicit bounded branch and product identifiers are required.',
    );
  const ids = (items: unknown[]) => {
    if (items.some((id) => typeof id !== 'string' || !FINANCE_UUID.test(id)))
      throw new BadRequestException(
        'Dimension source identifiers must be UUIDs.',
      );
    const normalized = (items as string[]).map((id) => id.toLowerCase()).sort();
    if (new Set(normalized).size !== normalized.length)
      throw new BadRequestException(
        'Dimension source identifiers must be unique.',
      );
    return normalized;
  };
  const branchIds = ids(master.branchIds),
    productIds = ids(master.productIds);
  const company = companyId.toLowerCase();
  const branches = await manager.query(
    `SELECT id::text,code,status FROM branches WHERE company_id=$1 AND id::text=ANY($2::text[]) AND deleted_at IS NULL ORDER BY id FOR SHARE`,
    [company, branchIds],
  );
  await manager.query(
    'SELECT id FROM insurance_product_versions WHERE company_id=$1 AND product_id::text=ANY($2::text[]) FOR SHARE',
    [company, productIds],
  );
  const products = await manager.query(
    `SELECT p.id::text,p.product_code,p.is_active,p.lifecycle_status,p.current_version_id::text,v.status AS version_status,v.effective_from::text,v.effective_to::text,v.definition_hash FROM insurance_products p LEFT JOIN insurance_product_versions v ON v.id=p.current_version_id AND v.company_id::text=p.company_id::text AND v.product_id=p.id WHERE p.company_id=$1 AND p.id::text=ANY($2::text[]) AND p.deleted_at IS NULL ORDER BY p.id FOR SHARE OF p`,
    [company, productIds],
  );
  if (
    branches.length !== branchIds.length ||
    branches.some((branch: { status: string }) => branch.status !== 'active') ||
    products.length !== productIds.length ||
    products.some(
      (product: Record<string, unknown>) =>
        !setupProductCoversInterval(product, from, to),
    )
  )
    throw new ConflictException(
      'Selected branches must be active and company-owned, and company-owned product versions must cover the requested interval.',
    );
  const snapshot = {
    companyId: company,
    effectiveFrom: from,
    effectiveTo: to,
    branches,
    products,
  };
  const snapshotHash = financeConfigurationHash(snapshot);
  if (
    !freeze &&
    (master.snapshotHash !== snapshotHash ||
      financeConfigurationHash(master.snapshot) !== snapshotHash)
  )
    throw new ConflictException(
      'Company dimension source records changed; prepare a new version.',
    );
  return {
    ...payload,
    companyMaster: {
      schema: master.schema,
      branchIds,
      productIds,
      snapshot,
      snapshotHash,
    },
  };
}
