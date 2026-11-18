import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FinanceAccount } from './entities/finance-account.entity';
import { FinanceLegalEntitySourceMap } from '../entities/finance-legal-entity-source-map.entity';
import { FinanceChartSourceAuthority } from '../entities/finance-chart-source-authority.entity';
import {
  CHART_ACCOUNT_TYPES,
  validateFinanceChart,
} from './finance-chart.types';
import {
  FINANCE_UUID,
  financeConfigurationHash,
  canonicalFinanceJson,
  type FinanceConfigurationActor,
  type FinanceSourceReadCheck,
} from '../finance-configuration/finance-configuration.types';
import type { FinanceBookSelection } from '../finance-configuration/finance-scope.service';

export const PORTAL_FINANCE_ACCOUNT_ADAPTER = 'INSURANCE_PORTAL_FINANCE';

export function financeChartSourceMapHash(
  map: FinanceLegalEntitySourceMap,
): string {
  return financeConfigurationHash({
    id: map.id,
    tenantId: map.tenant_id,
    legalEntityId: map.legal_entity_id,
    sourceSystem: map.source_system,
    sourceCompanyId: map.source_company_id,
    legalRole: map.legal_role,
    businessProfile: map.business_profile,
    version: map.mapping_version,
    validFrom: map.valid_from,
    validTo: map.valid_to ?? null,
    state: map.state,
  });
}

/** Observed metadata only: no balances, conversion, cutover or source writes. */
export async function prepareFinanceChartSnapshot(
  manager: EntityManager,
  actor: FinanceConfigurationActor,
  scope: FinanceBookSelection,
  profile: string,
  value: unknown,
  from: string,
  to: string | null,
  dependencies: string[],
  checks: FinanceSourceReadCheck[],
): Promise<Record<string, unknown>> {
  const proposal = validateFinanceChart(value, profile, dependencies);
  if (proposal.legacy.mode === 'UNBOUND')
    return {
      schema: 'FINANCE_CHART_SNAPSHOT_V1',
      entityProfile: profile,
      proposal,
      legacyObservation: {
        state: 'NOT_SUPPLIED',
        reason: proposal.legacy.reason,
        sourceAccounts: null,
        balances: 'NOT_SUPPLIED',
      },
    };
  const map = await manager.getRepository(FinanceLegalEntitySourceMap).findOne({
    where: {
      id: proposal.legacy.sourceMapId,
      tenant_id: actor.tenantId,
      legal_entity_id: scope.legalEntityId,
    },
    lock: { mode: 'pessimistic_read' },
  });
  if (
    !map ||
    map.state !== 'DRAFT' ||
    map.source_system !== PORTAL_FINANCE_ACCOUNT_ADAPTER ||
    !FINANCE_UUID.test(map.source_company_id) ||
    map.business_profile !== profile ||
    map.valid_from > from ||
    (map.valid_to && (!to || map.valid_to < to))
  )
    throw new ConflictException(
      'An explicit compatible draft Portal Finance source association is required.',
    );
  const authority = await manager
    .getRepository(FinanceChartSourceAuthority)
    .createQueryBuilder('authority')
    .where(
      'authority.tenant_id = :tenant AND authority.legal_entity_id = :entity AND authority.book_id = :book',
      {
        tenant: actor.tenantId,
        entity: scope.legalEntityId,
        book: scope.bookId,
      },
    )
    .andWhere(
      'authority.source_map_id = :map AND authority.source_map_hash = :hash',
      { map: map.id, hash: financeChartSourceMapHash(map) },
    )
    .andWhere(
      'authority.subject_id = :subject AND authority.natural_person_id = :person',
      { subject: actor.subjectId, person: actor.naturalPersonId },
    )
    .andWhere(
      'authority.state = :state AND authority.revoked_at IS NULL AND authority.valid_from <= statement_timestamp() AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())',
      { state: 'ENABLED' },
    )
    .setLock('pessimistic_read')
    .getOne();
  if (!authority)
    throw new ForbiddenException(
      'Current source-read authority bound to the exact draft mapping is required before observing accounts.',
    );
  checks.push({
    authorityId: authority.id,
    verify: async () => {
      const [current] = await manager.query(
        'SELECT id FROM finance_chart_source_authorities WHERE id = $1 AND state = $2 AND revoked_at IS NULL AND valid_from <= statement_timestamp() AND (valid_to IS NULL OR valid_to > statement_timestamp())',
        [authority.id, 'ENABLED'],
      );
      if (!current)
        throw new ForbiddenException(
          'Chart source-read authority expired before completion.',
        );
    },
  });
  const rows = await manager
    .getRepository(FinanceAccount)
    .createQueryBuilder('account')
    .where('account.company_id = :company', {
      company: map.source_company_id.toLowerCase(),
    })
    .orderBy('account.id', 'ASC')
    .setLock('pessimistic_read')
    .getMany();
  const dispositions = new Map(
    proposal.legacy.dispositions.map((d) => [d.sourceAccountId, d]),
  );
  if (
    dispositions.size !== rows.length ||
    rows.some((row) => !dispositions.has(row.id))
  )
    throw new ConflictException(
      'Every observed source account, including custom/inactive accounts, must have exactly one disposition. Unknown or omitted IDs remain blocked.',
    );
  if (!rows.length && !proposal.legacy.emptyInventoryReason)
    throw new ConflictException(
      'An empty observation is not proof of an empty source. Record its missing-data reason explicitly.',
    );
  const roles = new Map(proposal.roles.map((role) => [role.code, role])),
    targets = new Map(
      proposal.accounts.map((account) => [account.code, account]),
    );
  for (const row of rows) {
    const disposition = dispositions.get(row.id)!;
    if (disposition.state === 'HELD') continue;
    // Known unresolved legacy meanings are quarantine rules for this V1
    // adapter, not target-account assignments or new accounting elections.
    if (
      !row.is_active ||
      ['2100', '4200'].includes(row.account_code) ||
      !CHART_ACCOUNT_TYPES.includes(
        row.account_type as (typeof CHART_ACCOUNT_TYPES)[number],
      )
    )
      throw new ConflictException(
        'Conditional, inactive or unknown-type source accounts must stay held.',
      );
    const role = roles.get(disposition.roleCode!)!,
      target = targets.get(role.accountCode!)!;
    if (
      row.account_type !== target.type ||
      row.is_control_account !== target.control
    )
      throw new ConflictException(
        'A proposed mapping cannot silently change account type or control status.',
      );
  }
  const observed = rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.account_code,
    name: row.account_name,
    type: row.account_type,
    control: row.is_control_account,
    active: row.is_active,
  }));
  return {
    schema: 'FINANCE_CHART_SNAPSHOT_V1',
    entityProfile: profile,
    proposal,
    legacyObservation: {
      state: rows.length
        ? 'DRAFT_METADATA_OBSERVATION'
        : 'EMPTY_OBSERVATION_NOT_RECONCILED',
      adapter: PORTAL_FINANCE_ACCOUNT_ADAPTER,
      sourceMap: {
        id: map.id,
        tenantId: map.tenant_id,
        legalEntityId: map.legal_entity_id,
        sourceCompanyId: map.source_company_id,
        legalRole: map.legal_role,
        businessProfile: map.business_profile,
        version: map.mapping_version,
        validFrom: map.valid_from,
        validTo: map.valid_to,
        state: map.state,
      },
      sourceAccounts: observed,
      populationHash: financeConfigurationHash(observed),
      proposedCount: proposal.legacy.dispositions.filter(
        (d) => d.state === 'PROPOSED',
      ).length,
      heldCount: proposal.legacy.dispositions.filter((d) => d.state === 'HELD')
        .length,
      balances: 'NOT_SUPPLIED',
      cutoverReconciliation: 'NOT_PERFORMED',
    },
  };
}

export async function verifyFinanceChartSnapshot(
  manager: EntityManager,
  actor: FinanceConfigurationActor,
  scope: FinanceBookSelection,
  profile: string,
  stored: Record<string, unknown>,
  from: string,
  to: string | null,
  dependencies: string[],
  checks: FinanceSourceReadCheck[],
) {
  if (stored.schema !== 'FINANCE_CHART_SNAPSHOT_V1')
    throw new ConflictException(
      'This account-role version requires a typed chart snapshot; create a new version.',
    );
  const current = await prepareFinanceChartSnapshot(
    manager,
    actor,
    scope,
    profile,
    stored.proposal,
    from,
    to,
    dependencies,
    checks,
  );
  if (canonicalFinanceJson(current) !== canonicalFinanceJson(stored))
    throw new ConflictException(
      'The chart profile, source association or observed account population changed. Capture a new chart version.',
    );
}
