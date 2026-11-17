import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../../shared/audit/audit.service';
import { FinancePermissions } from '../finance.permissions';
import {
  FoundationActor,
  FinanceLedgerFoundationService,
} from './finance-ledger-foundation.service';
import { FinanceBookSelection } from './finance-scope.service';
import {
  FinanceConfigurationInput,
  financeConfigurationHash,
  isFinanceDate,
} from './finance-configuration.types';
import { FinanceConfigurationService } from './finance-configuration.service';
import { FinancePolicyService } from './finance-policy.service';
import { FinancePolicyDefinition } from './finance-policy.types';
import { FinanceSetupService } from './finance-setup.service';
import { validateSetupConfiguration } from './finance-setup-configuration';
import {
  setupHash,
  setupText,
  setupUuid,
  setupObject,
} from './finance-setup.types';
import { FinanceLegalEntitySourceMap } from './entities/finance-legal-entity-source-map.entity';
import {
  financeChartSourceMapHash,
  PORTAL_FINANCE_ACCOUNT_ADAPTER,
} from './finance-chart.snapshot';
import { readSetupTaxRules, selectSetupTaxRules } from './finance-setup-tax';

@Injectable()
export class FinanceSetupConfigurationService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    private readonly setup: FinanceSetupService,
    private readonly audit: AuditService,
  ) {}
  private ids(a: FoundationActor, s: FinanceBookSelection) {
    return [a.tenantId, s.legalEntityId, s.bookId];
  }

  private async taxRules(
    m: EntityManager,
    a: FoundationActor,
    input: FinanceConfigurationInput,
    prepare = false,
  ) {
    if (input.kind !== 'TAX_RULES') return input;
    const p = input.payload!;
    const rows = selectSetupTaxRules(
      await readSetupTaxRules(m, a.sourceCompanyId!),
      String(p.sourceTaxCatalogue),
      p.sourceTaxRuleIds as string[],
      input.effectiveFrom,
      input.effectiveTo ?? null,
    );
    const hash = financeConfigurationHash(rows);
    if (!prepare && p.sourceRuleHash !== hash)
      throw new ConflictException(
        'Source tax rules changed after preparation; freeze a new configuration version.',
      );
    return {
      ...input,
      payload: { ...p, sourceRuleSnapshot: rows, sourceRuleHash: hash },
    };
  }

  async configuration(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    hash: string,
  ) {
    return this.setup.withAccess(
      actor,
      scope,
      'READ',
      FinancePermissions.FOUNDATION_READ,
      async (m) => this.exactConfiguration(m, actor, scope, id, hash),
    );
  }
  private async exactConfiguration(
    m: EntityManager,
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    hash: string,
  ) {
    if (!setupUuid(id) || !setupHash(hash))
      throw new BadRequestException(
        'An exact configuration ID and hash are required.',
      );
    const [r] = await m.query(
      `SELECT *,effective_from::text AS effective_from,effective_to::text AS effective_to FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR SHARE`,
      [...this.ids(a, s), id],
    );
    if (!r || r.release_hash !== hash)
      throw new ForbiddenException(
        'Exact configuration is unavailable in this book.',
      );
    const snapshot = {
      id: r.id,
      tenantId: r.tenant_id,
      legalEntityId: r.legal_entity_id,
      bookId: r.book_id,
      kind: r.kind,
      key: r.configuration_key,
      version: r.version,
      effectiveFrom: r.effective_from,
      effectiveTo: r.effective_to,
      payload: r.payload,
      dependencyRefs: r.dependency_refs,
      makerSubjectId: r.maker_subject_id,
      makerNaturalPersonId: r.maker_natural_person_id,
      supersedesId: r.supersedes_id,
      supersedesHash: r.supersedes_hash,
    };
    if (financeConfigurationHash(snapshot) !== hash)
      throw new ConflictException('Configuration integrity differs.');
    const events = await m.query(
      'SELECT * FROM finance_configuration_events WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND release_id=$4 ORDER BY occurred_at,id',
      [...this.ids(a, s), id],
    );
    return { ...r, events };
  }

  async createConfiguration(
    a: FoundationActor,
    s: FinanceBookSelection,
    input: FinanceConfigurationInput,
    reason: string,
  ) {
    if (!setupObject(input))
      throw new BadRequestException(
        'An explicit versioned configuration is required.',
      );
    validateSetupConfiguration(input);
    return this.setup.withAccess(
      a,
      s,
      'PREPARE_CONFIG',
      FinancePermissions.CONFIG_PREPARE,
      async (m) => {
        const value = await this.taxRules(m, a, input, true);
        return new FinanceConfigurationService(m).createDraft(
          a,
          s,
          value,
          reason,
        );
      },
    );
  }
  async configurationDecision(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    hash: string,
    action: 'SUBMIT' | 'REVIEW_INACTIVE' | 'REJECT',
    reason: string,
  ) {
    if (!['SUBMIT', 'REVIEW_INACTIVE', 'REJECT'].includes(action))
      throw new BadRequestException(
        'Only submission, inactive review or rejection is supported.',
      );
    const submit = action === 'SUBMIT';
    return this.setup.withAccess(
      a,
      s,
      submit ? 'PREPARE_CONFIG' : 'REVIEW_CONFIG',
      submit
        ? FinancePermissions.CONFIG_PREPARE
        : FinancePermissions.CONFIG_REVIEW,
      async (m) => {
        const r = await this.exactConfiguration(m, a, s, id, hash);
        const input: FinanceConfigurationInput = {
          kind: r.kind,
          key: r.configuration_key,
          version: r.version,
          effectiveFrom: r.effective_from,
          effectiveTo: r.effective_to,
          payload: r.payload,
          dependencyRefs: r.dependency_refs,
        };
        if (action !== 'REJECT') {
          validateSetupConfiguration(input);
          await this.taxRules(m, a, input);
        }
        const native = new FinanceConfigurationService(m);
        return submit
          ? native.submit(a, s, id, hash, reason)
          : native.reviewInactive(
              a,
              s,
              id,
              hash,
              action === 'REJECT' ? 'REJECTED' : 'REVIEWED_INACTIVE',
              reason,
            );
      },
    );
  }

  async createSourceMap(
    a: FoundationActor,
    s: FinanceBookSelection,
    input: {
      version: number;
      legalRole: string;
      effectiveFrom: string;
      effectiveTo: string | null;
    },
    reason: string,
  ) {
    if (
      !Number.isSafeInteger(input?.version) ||
      input.version < 1 ||
      !setupText(input.legalRole, 50) ||
      !isFinanceDate(input.effectiveFrom) ||
      (input.effectiveTo !== null &&
        (!isFinanceDate(input.effectiveTo) ||
          input.effectiveTo <= input.effectiveFrom)) ||
      !setupText(reason)
    )
      throw new BadRequestException(
        'Explicit source role, version, effective interval and reason are required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'PREPARE_CONFIG',
      FinancePermissions.CONFIG_PREPARE,
      async (m) => {
        const [entity] = await m.query(
          'SELECT business_profile FROM finance_legal_entities WHERE tenant_id=$1 AND id=$2',
          [a.tenantId, s.legalEntityId],
        );
        const repo = m.getRepository(FinanceLegalEntitySourceMap);
        const map = await repo.save(
          repo.create({
            tenant_id: a.tenantId,
            legal_entity_id: s.legalEntityId,
            source_system: PORTAL_FINANCE_ACCOUNT_ADAPTER,
            source_company_id: a.sourceCompanyId,
            legal_role: input.legalRole,
            business_profile: entity.business_profile,
            mapping_version: input.version,
            valid_from: input.effectiveFrom,
            valid_to: input.effectiveTo,
            state: 'DRAFT',
          }),
        );
        await this.sourceReadAuthority(m, a, s, map, reason);
        await this.audit.logCritical(
          {
            userId: a.sourceUserId,
            companyId: a.sourceCompanyId,
            actorType: 'user',
            action: 'finance.setup.source_map.prepared',
            resource: 'finance-source-map',
            resourceId: map.id,
            reason,
            afterState: {
              sourceMapId: map.id,
              sourceMapHash: financeChartSourceMapHash(map),
              state: 'DRAFT',
              financialEffects: 0,
            },
          },
          m,
        );
        return {
          map,
          hash: financeChartSourceMapHash(map),
          financialEffects: 0,
        };
      },
    );
  }
  async claimSourceRead(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    hash: string,
    reason: string,
  ) {
    if (!setupUuid(id) || !setupHash(hash) || !setupText(reason))
      throw new BadRequestException(
        'Exact source map and reason are required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'REVIEW_CONFIG',
      FinancePermissions.CONFIG_REVIEW,
      async (m) => {
        if (!(await this.setup.isCompanyAdmin(m, a)))
          throw new ForbiddenException(
            'A scoped company admin must attest the source review remit.',
          );
        const map = await m.getRepository(FinanceLegalEntitySourceMap).findOne({
          where: {
            id,
            tenant_id: a.tenantId,
            legal_entity_id: s.legalEntityId,
          },
          lock: { mode: 'pessimistic_read' },
        });
        if (
          !map ||
          map.source_company_id !== a.sourceCompanyId ||
          financeChartSourceMapHash(map) !== hash
        )
          throw new ForbiddenException('Exact owned source map unavailable.');
        const authority = await this.sourceReadAuthority(m, a, s, map, reason);
        await this.audit.logCritical(
          {
            userId: a.sourceUserId,
            companyId: a.sourceCompanyId,
            action: 'finance.setup.source_read.attested',
            resource: 'finance-chart-source-authority',
            resourceId: authority.id,
            reason,
            afterState: {
              sourceMapId: id,
              hash,
              subjectId: a.subjectId,
              naturalPersonId: a.naturalPersonId,
              financialEffects: 0,
            },
          },
          m,
        );
        return authority;
      },
    );
  }
  private async sourceReadAuthority(
    m: EntityManager,
    a: FoundationActor,
    s: FinanceBookSelection,
    map: FinanceLegalEntitySourceMap,
    reason: string,
  ) {
    const hash = financeChartSourceMapHash(map),
      existing = await m.query(
        'SELECT id,source_map_hash,state,(valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())) AS is_current FROM finance_chart_source_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_map_id=$4 AND subject_id=$5 AND natural_person_id=$6 AND revoked_at IS NULL',
        [...this.ids(a, s), map.id, a.subjectId, a.naturalPersonId],
      );
    if (existing.length) {
      if (
        existing.length !== 1 ||
        existing[0].source_map_hash !== hash ||
        existing[0].state !== 'ENABLED' ||
        !existing[0].is_current
      )
        throw new ConflictException(
          'Source-read authority requires explicit renewal or reconciliation.',
        );
      return existing[0];
    }
    const [binding] = await m.query(
      'SELECT valid_from,valid_to FROM finance_foundation_identity_bindings WHERE id=$1',
      [a.identityBindingId],
    );
    if (!binding.valid_to)
      throw new ConflictException(
        'A bounded identity expiry is required for source-read setup.',
      );
    const id = randomUUID();
    await m.query(
      `INSERT INTO finance_chart_source_authorities(id,tenant_id,legal_entity_id,book_id,source_map_id,source_map_hash,subject_id,natural_person_id,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ENABLED',$9,statement_timestamp(),$10)`,
      [
        id,
        ...this.ids(a, s),
        map.id,
        hash,
        a.subjectId,
        a.naturalPersonId,
        ('G04-SOURCE-READ:' + reason).slice(0, 200),
        binding.valid_to,
      ],
    );
    return {
      id,
      sourceMapHash: hash,
      state: 'ENABLED',
      validTo: binding.valid_to,
    };
  }

  async createPolicy(
    a: FoundationActor,
    s: FinanceBookSelection,
    definition: FinancePolicyDefinition,
  ) {
    if (!setupObject(definition))
      throw new BadRequestException(
        'An explicit policy definition is required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'PREPARE_CONFIG',
      FinancePermissions.POLICY_PREPARE,
      async (m) => {
        const [entity] = await m.query(
          'SELECT business_profile FROM finance_legal_entities WHERE tenant_id=$1 AND id=$2',
          [a.tenantId, s.legalEntityId],
        );
        const policyProfile: Record<string, string> = {
          INSURER: 'INSURER',
          GENERAL_INSURER: 'INSURER',
          BROKER: 'BROKER',
          REINSURER: 'REINSURER',
          OTHER: 'OTHER',
        };
        if (definition.profile !== policyProfile[entity.business_profile])
          throw new ConflictException(
            'Company policy profile must match the actual legal entity.',
          );
        if (definition.evidenceReferences?.length)
          await this.policyEvidence(m, a, s, definition);
        return new FinancePolicyService(m).prepare(
          { tenantId: a.tenantId, ...s },
          a,
          definition,
        );
      },
    );
  }
  async policy(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    hash: string,
  ) {
    return this.setup.withAccess(
      a,
      s,
      'READ',
      FinancePermissions.FOUNDATION_READ,
      async (m) => ({
        scope: { tenantId: a.tenantId, ...s },
        policy: await new FinanceLedgerFoundationService(
          m as unknown as DataSource,
        ).policyDetails(a, s, id, hash),
      }),
    );
  }
  async policyDecision(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    hash: string,
    action: 'CONFIGURE' | 'VALIDATE' | 'APPROVE' | 'NOT_APPLICABLE',
    evidenceHash: string,
    reason: string,
  ) {
    if (
      !['CONFIGURE', 'VALIDATE', 'APPROVE', 'NOT_APPLICABLE'].includes(
        action,
      ) ||
      !setupUuid(id) ||
      !setupHash(hash) ||
      !setupHash(evidenceHash) ||
      !setupText(reason)
    )
      throw new BadRequestException(
        'Only explicit inactive policy configuration/review decisions are supported.',
      );
    const configure = action === 'CONFIGURE';
    return this.setup.withAccess(
      a,
      s,
      configure ? 'PREPARE_CONFIG' : 'REVIEW_CONFIG',
      configure
        ? FinancePermissions.POLICY_PREPARE
        : FinancePermissions.POLICY_DECIDE,
      async (m) => {
        if (!configure && !(await this.setup.isCompanyAdmin(m, a)))
          throw new ForbiddenException(
            'The current scoped company admin must decide the policy version.',
          );
        const [policy] = await m.query(
          'SELECT id,definition FROM finance_policy_versions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND definition_hash=$5 FOR SHARE',
          [...this.ids(a, s), id, hash],
        );
        if (!policy)
          throw new ForbiddenException(
            'Exact owned policy version is unavailable.',
          );
        await this.policyEvidence(m, a, s, policy.definition, evidenceHash);
        return new FinancePolicyService(m).transition(
          { tenantId: a.tenantId, ...s },
          a,
          id,
          hash,
          action,
          evidenceHash,
          reason,
        );
      },
    );
  }

  private async policyEvidence(
    m: EntityManager,
    a: FoundationActor,
    s: FinanceBookSelection,
    definition: FinancePolicyDefinition,
    evidenceHash?: string,
  ) {
    if (
      !Array.isArray(definition.evidenceReferences) ||
      !definition.evidenceReferences.length
    )
      throw new ConflictException(
        'Attach actual owned document-version evidence before configuring or deciding policy.',
      );
    const references: {
      documentId: string;
      id: string;
      hash: string;
      purpose: string;
    }[] = [];
    for (const ref of definition.evidenceReferences) {
      const match =
        typeof ref === 'string' &&
        /^document:([a-f0-9-]{36}):([a-f0-9-]{36}):([a-f0-9]{64})$/.exec(ref);
      if (!match || !setupUuid(match[1]) || !setupUuid(match[2]))
        throw new BadRequestException(
          'Policy evidence references require document:documentId:versionId:sha256.',
        );
      const e = {
        documentId: match[1],
        id: match[2],
        hash: match[3],
        purpose: 'POLICY_REVIEW',
      };
      if (!(await this.setup.evidenceAvailable(m, a, s, e)))
        throw new ConflictException(
          'Policy evidence is unavailable, changed or outside this company/book.',
        );
      references.push(e);
    }
    if (evidenceHash && !references.some((e) => e.hash === evidenceHash))
      throw new ConflictException(
        'The decision must identify attached owned policy evidence.',
      );
  }
}
