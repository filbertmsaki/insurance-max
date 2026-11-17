import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  FINANCE_UUID,
  financeConfigurationHash,
} from './finance-configuration.types';
import { prepareSetupDimensionMaster } from './finance-setup-dimension-master';
import { validateDimensionSelection } from './finance-dimension-master';
import type { JournalCandidateInput } from './finance-journal-candidate.types';

/** Deployment-specific source verifier; never falls back to portal tables in an independent deployment. */
export const FINANCE_JOURNAL_DIMENSION_VERIFIER = Symbol(
  'FINANCE_JOURNAL_DIMENSION_VERIFIER',
);

/** Validate explicit, hash-pinned company dimension evidence inside the candidate transaction. */
export async function verifyReviewedDimensionMaster(
  manager: EntityManager,
  ids: string[],
  p: Pick<JournalCandidateInput, 'lines' | 'economicOrigin' | 'accountingDate'>,
  verifySource: typeof prepareSetupDimensionMaster = prepareSetupDimensionMaster,
): Promise<void> {
  const fields = [
    'DIMENSION_RELEASE',
    'DIMENSION_HASH',
    'SOURCE_ASSOCIATION',
    'SOURCE_ASSOCIATION_HASH',
    'COMPANY',
  ] as const;
  if (
    !p.lines.some(
      (line) =>
        fields.some((field) => line.dimensions[field] !== undefined) ||
        (p.economicOrigin !== 'FIN03_ALLOCATION_PREVIEW' &&
          (line.dimensions.BRANCH !== undefined ||
            line.dimensions.PRODUCT !== undefined)),
    )
  )
    return;
  const first = p.lines[0].dimensions;
  if (
    !fields.every((field) => typeof first[field] === 'string') ||
    !FINANCE_UUID.test(first.DIMENSION_RELEASE) ||
    !FINANCE_UUID.test(first.SOURCE_ASSOCIATION) ||
    !FINANCE_UUID.test(first.COMPANY) ||
    !/^[a-f0-9]{64}$/.test(first.DIMENSION_HASH) ||
    !/^[a-f0-9]{64}$/.test(first.SOURCE_ASSOCIATION_HASH) ||
    p.lines.some((line) =>
      fields.some((field) => line.dimensions[field] !== first[field]),
    )
  )
    throw new ConflictException(
      'Exact company, dimension release and source association are required on every journal line.',
    );
  const [release] = await manager.query(
    `SELECT *,effective_from::text AS start_date,effective_to::text AS end_date FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND kind='DIMENSIONS' AND state='REVIEWED_INACTIVE' FOR SHARE`,
    [...ids, first.DIMENSION_RELEASE],
  );
  const [association] = await manager.query(
    `SELECT *,effective_from::text AS start_date,effective_to::text AS end_date FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND kind='SOURCE_ASSOCIATIONS' AND state='REVIEWED_INACTIVE' FOR SHARE`,
    [...ids, first.SOURCE_ASSOCIATION],
  );
  const covers = (row: any, hash: string) =>
    row &&
    row.release_hash === hash &&
    row.start_date <= p.accountingDate &&
    (!row.end_date || p.accountingDate < row.end_date);
  const company = first.COMPANY.toLowerCase();
  if (
    !covers(release, first.DIMENSION_HASH) ||
    !covers(association, first.SOURCE_ASSOCIATION_HASH) ||
    !Array.isArray(association.payload?.sourceMaps) ||
    !association.payload.sourceMaps.some(
      (map: any) =>
        map.sourceSystem === 'INSURANCE_PORTAL_FINANCE' &&
        typeof map.sourceCompanyId === 'string' &&
        map.sourceCompanyId.toLowerCase() === company,
    ) ||
    release.payload?.companyMaster?.snapshot?.companyId !== company
  )
    throw new ConflictException(
      'Reviewed company dimension and source releases are unavailable for this scope and date.',
    );
  const sourceMap = association.payload.sourceMaps.find(
    (map: any) =>
      map.sourceSystem === 'INSURANCE_PORTAL_FINANCE' &&
      typeof map.sourceCompanyId === 'string' &&
      map.sourceCompanyId.toLowerCase() === company,
  );
  const [currentMap] = await manager.query(
    `SELECT id::text,tenant_id::text AS "tenantId",legal_entity_id::text AS "legalEntityId",source_system AS "sourceSystem",source_company_id AS "sourceCompanyId",legal_role AS "legalRole",business_profile AS "businessProfile",mapping_version AS version,valid_from::text AS "validFrom",valid_to::text AS "validTo" FROM finance_legal_entity_source_maps WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 AND state='DRAFT' FOR SHARE`,
    [ids[0], ids[1], sourceMap.id],
  );
  if (
    !currentMap ||
    financeConfigurationHash(currentMap) !== financeConfigurationHash(sourceMap)
  )
    throw new ConflictException('Reviewed source-company association changed.');
  const master = release.payload.companyMaster;
  if (financeConfigurationHash(master.snapshot) !== master.snapshotHash)
    throw new ConflictException('Dimension source snapshot hash differs.');
  await verifySource(
    manager,
    company,
    release.payload,
    release.start_date,
    release.end_date,
    false,
  );
  const values = [
    ...master.branchIds.map((id: string) => ({
      kind: 'BRANCH' as const,
      id,
      effectiveFrom: release.start_date,
      effectiveTo: release.end_date,
    })),
    ...master.productIds.map((id: string) => ({
      kind: 'PRODUCT' as const,
      id,
      effectiveFrom: release.start_date,
      effectiveTo: release.end_date,
    })),
  ];
  for (const line of p.lines)
    validateDimensionSelection(
      { companyId: company, values },
      company,
      p.accountingDate,
      { branchId: line.dimensions.BRANCH, productId: line.dimensions.PRODUCT },
    );
}
