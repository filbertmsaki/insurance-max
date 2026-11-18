import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FinanceConfigurationRelease } from '../../foundation/entities/finance-configuration-release.entity';
import { FinanceLegalEntitySourceMap } from '../../foundation/entities/finance-legal-entity-source-map.entity';
import {
  canonicalFinanceJson,
  type FinanceConfigurationActor,
} from '../../foundation/finance-configuration/finance-configuration.types';
import { financeChartSourceMapHash } from '../../foundation/chart-of-accounts/finance-chart.snapshot';
import {
  validateEventContract,
  validateEventRoute,
} from './finance-event.types';
import type { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';

export function eventRouteSnapshot(
  v: Awaited<ReturnType<typeof verifyEventRoute>>,
): Record<string, unknown> {
  return {
    schema: 'FINANCE_EVENT_ROUTE_SNAPSHOT_V1',
    proposal: v.route,
    selector: {
      producerId: v.contract.producerId,
      eventType: v.contract.eventType,
      schemaVersion: v.contract.schemaVersion,
      sourceSystem: v.map.source_system,
      sourceCompanyId: v.map.source_company_id,
    },
    owner: {
      legalRole: v.map.legal_role,
      businessProfile: v.map.business_profile,
      sourceMapVersion: v.map.mapping_version,
    },
  };
}
export async function verifyEventRouteSnapshot(
  manager: EntityManager,
  actor: Pick<FinanceConfigurationActor, 'tenantId'>,
  scope: FinanceBookSelection,
  profile: string,
  stored: Record<string, unknown>,
  from: string,
  to: string | null,
  dependencies: string[],
) {
  if (stored.schema !== 'FINANCE_EVENT_ROUTE_SNAPSHOT_V1')
    throw new ConflictException('A captured exact event route is required.');
  const verified = await verifyEventRoute(
    manager,
    actor,
    scope,
    profile,
    stored.proposal,
    from,
    to,
    dependencies,
  );
  if (
    canonicalFinanceJson(eventRouteSnapshot(verified)) !==
    canonicalFinanceJson(stored)
  )
    throw new ConflictException(
      'Event route source, profile or contract selector changed.',
    );
  return verified;
}

/** Exact local draft references only. No source reads, grants or activation. */
export async function verifyEventRoute(
  manager: EntityManager,
  actor: Pick<FinanceConfigurationActor, 'tenantId'>,
  scope: FinanceBookSelection,
  profile: string,
  payload: unknown,
  from: string,
  to: string | null,
  dependencies: string[],
) {
  const route = validateEventRoute(payload, dependencies);
  const get = async (id: string, hash: string, kind: string) => {
    const row = await manager
      .getRepository(FinanceConfigurationRelease)
      .findOne({
        where: {
          tenant_id: actor.tenantId,
          legal_entity_id: scope.legalEntityId,
          book_id: scope.bookId,
          id,
        },
        lock: { mode: 'pessimistic_read' },
      });
    if (
      !row ||
      row.kind !== kind ||
      row.state !== 'REVIEWED_INACTIVE' ||
      row.release_hash !== hash ||
      row.effective_from > from ||
      (row.effective_to && (!to || row.effective_to < to))
    )
      throw new ConflictException(
        'An exact scope/date-compatible reviewed inactive contract or association is required.',
      );
    return row;
  };
  const contractRelease = await get(
    route.contractId,
    route.contractHash,
    'EVENT_CONTRACTS',
  );
  const contract = validateEventContract(
    contractRelease.payload,
    contractRelease.dependency_refs,
  );
  const association = await get(
    route.sourceAssociationId,
    route.sourceAssociationHash,
    'SOURCE_ASSOCIATIONS',
  );
  const map = await manager.getRepository(FinanceLegalEntitySourceMap).findOne({
    where: {
      tenant_id: actor.tenantId,
      legal_entity_id: scope.legalEntityId,
      id: route.sourceMapId,
    },
    lock: { mode: 'pessimistic_read' },
  });
  if (
    !map ||
    map.state !== 'DRAFT' ||
    map.business_profile !== profile ||
    map.source_system !== contract.sourceSystem ||
    financeChartSourceMapHash(map) !== route.sourceMapHash ||
    map.valid_from > from ||
    (map.valid_to && (!to || map.valid_to < to))
  )
    throw new ConflictException(
      'Exact draft source ownership/profile/version is required.',
    );
  const saved = association.payload.sourceMaps;
  const snapshot = {
    id: map.id,
    tenantId: map.tenant_id,
    legalEntityId: map.legal_entity_id,
    sourceSystem: map.source_system,
    sourceCompanyId: map.source_company_id,
    legalRole: map.legal_role,
    businessProfile: map.business_profile,
    version: map.mapping_version,
    validFrom: map.valid_from,
    validTo: map.valid_to,
  };
  if (
    !Array.isArray(saved) ||
    !saved.some(
      (r) => canonicalFinanceJson(r) === canonicalFinanceJson(snapshot),
    )
  )
    throw new ConflictException(
      'The reviewed association must contain this exact draft source snapshot.',
    );
  return { route, contract, map, contractRelease, association };
}
