import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../../../shared/audit/audit.service';
import { FinancePermissions } from '../../governance/finance-permissions/finance.permissions';
import {
  FoundationActor,
  FinanceLedgerFoundationService,
} from '../../accounting/general-ledger/finance-ledger-foundation.service';
import { FinanceBookSelection } from '../finance-configuration/finance-scope.service';
import {
  FinanceConfigurationInput,
  financeConfigurationHash,
  isFinanceDate,
} from '../finance-configuration/finance-configuration.types';
import { FinanceConfigurationService } from '../finance-configuration/finance-configuration.service';
import { FinancePolicyService } from '../../governance/accounting-policies/finance-policy.service';
import { FinancePolicyDefinition } from '../../governance/accounting-policies/finance-policy.types';
import { FinanceSetupService } from './finance-setup.service';
import { validateSetupConfiguration } from './finance-setup-configuration';
import {
  setupHash,
  setupText,
  setupUuid,
  setupObject,
} from './finance-setup.types';
import { FinanceLegalEntitySourceMap } from '../entities/finance-legal-entity-source-map.entity';
import {
  financeChartSourceMapHash,
  PORTAL_FINANCE_ACCOUNT_ADAPTER,
} from '../chart-of-accounts/finance-chart.snapshot';
import { readSetupTaxRules, selectSetupTaxRules } from './finance-setup-tax';
import { prepareProductMap } from './finance-setup-product-map';
import { prepareSetupDimensionMaster } from './finance-setup-dimension-master';
import { validateAllocationSchedule } from '../../accounting/allocations/finance-allocation-schedule.types';
import {
  previewBranchAllocation,
  validateAllocationRule,
} from '../../accounting/allocations/finance-branch-allocation';
import { verifyReviewedDimensionMaster } from '../accounting-dimensions/finance-reviewed-dimension-master';
import { preparePortalSourceAttestation } from '../../integrations/source-evidence/finance-portal-source-producer';
import { reconcileSourceReceipt } from '../../integrations/source-evidence/finance-source-receipt';
import { sourceByteHash } from '../../accounting/accounting-events/finance-event.types';

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
        let value = await this.taxRules(m, a, input, true);
        if (
          value.kind === 'DIMENSIONS' &&
          value.payload?.schema === 'FINANCE_ALLOCATION_SCHEDULE_V2' &&
          validateAllocationSchedule(
            value.payload,
          ).dimension?.companyId.toLowerCase() !==
            a.sourceCompanyId!.toLowerCase()
        )
          throw new ForbiddenException(
            'Allocation schedule source company differs from the authenticated company.',
          );
        if (value.kind === 'DIMENSIONS' && value.payload) {
          value = {
            ...value,
            payload: await prepareSetupDimensionMaster(
              m,
              a.sourceCompanyId!,
              value.payload,
              value.effectiveFrom,
              value.effectiveTo ?? null,
              true,
            ),
          };
        }
        if (value.kind === 'POSTING_RULES' && value.payload) {
          value = {
            ...value,
            payload: await prepareProductMap(
              m,
              a.sourceCompanyId!,
              value.payload,
              value.effectiveFrom,
              value.effectiveTo ?? null,
              true,
            ),
          };
        }
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
          if (
            input.kind === 'DIMENSIONS' &&
            input.payload?.schema === 'FINANCE_ALLOCATION_SCHEDULE_V2' &&
            validateAllocationSchedule(
              input.payload,
            ).dimension?.companyId.toLowerCase() !==
              a.sourceCompanyId!.toLowerCase()
          )
            throw new ForbiddenException(
              'Allocation schedule source company differs from the authenticated company.',
            );
          await this.taxRules(m, a, input);
          if (input.kind === 'DIMENSIONS' && input.payload)
            await prepareSetupDimensionMaster(
              m,
              a.sourceCompanyId!,
              input.payload,
              input.effectiveFrom,
              input.effectiveTo ?? null,
              false,
            );
          if (input.kind === 'POSTING_RULES' && input.payload)
            await prepareProductMap(
              m,
              a.sourceCompanyId!,
              input.payload,
              input.effectiveFrom,
              input.effectiveTo ?? null,
              false,
            );
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
  async prepareSourceAttestation(
    a: FoundationActor,
    s: FinanceBookSelection,
    masterId: string,
    hash: string,
    reason: string,
  ) {
    if (!setupUuid(masterId) || !setupHash(hash) || !setupText(reason))
      throw new BadRequestException(
        'An exact reviewed company master and reason are required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'REVIEW_CONFIG',
      FinancePermissions.CONFIG_REVIEW,
      async (m, authorityId) => {
        if (!(await this.setup.isCompanyAdmin(m, a)))
          throw new ForbiddenException(
            'A scoped company admin must prepare source evidence.',
          );
        const release = await this.exactConfiguration(m, a, s, masterId, hash);
        if (
          release.kind !== 'DIMENSIONS' ||
          release.state !== 'REVIEWED_INACTIVE' ||
          release.payload?.companyMaster?.snapshot?.companyId !==
            a.sourceCompanyId ||
          release.maker_natural_person_id === a.naturalPersonId
        )
          throw new ForbiddenException(
            'An independently reviewed master belonging to the authenticated company is required.',
          );
        const result = await preparePortalSourceAttestation(
          m,
          {
            tenantId: a.tenantId,
            legalEntityId: s.legalEntityId,
            bookId: s.bookId,
            companyId: a.sourceCompanyId!,
            masterId,
            masterHash: hash,
            actorSubjectId: a.subjectId,
            actorPersonId: a.naturalPersonId,
            authorityId,
            reason,
          },
          release,
        );
        await this.audit.logCritical(
          {
            userId: a.sourceUserId,
            companyId: a.sourceCompanyId,
            actorType: 'user',
            action: 'finance.source.attestation.prepared',
            resource: 'finance-source-attestation',
            resourceId: result.id,
            reason,
            afterState: {
              masterId,
              masterHash: hash,
              rawHash: result.rawHash,
              revision: result.revision,
              postingAuthorized: false,
            },
          },
          m,
        );
        return result;
      },
    );
  }
  async sourceAttestation(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    hash: string,
  ) {
    if (!setupUuid(id) || !setupHash(hash))
      throw new BadRequestException(
        'An exact source attestation and hash are required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'READ',
      FinancePermissions.FOUNDATION_READ,
      async (m) => {
        const [row] = await m.query(
          `SELECT id,revision,raw_body,raw_hash,signature_base64,issued_at,expires_at FROM finance_source_attestation_outbox WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_company_id=$4 AND id=$5 FOR SHARE`,
          [...this.ids(a, s), a.sourceCompanyId, id],
        );
        if (
          !row ||
          row.raw_hash !== hash ||
          sourceByteHash(row.raw_body) !== hash
        )
          throw new ForbiddenException(
            'Exact company source attestation is unavailable.',
          );
        return {
          id: row.id,
          revision: row.revision,
          rawHash: row.raw_hash,
          bodyBase64: row.raw_body.toString('base64'),
          signature: row.signature_base64,
          issuedAt: row.issued_at.toISOString(),
          expiresAt: row.expires_at.toISOString(),
          postingAuthorized: false,
        };
      },
    );
  }
  async reconcileSourceAttestation(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    receiptBodyBase64: string,
    receiptSignature: string,
    reason: string,
  ) {
    if (!setupUuid(id) || !setupText(reason))
      throw new BadRequestException(
        'An exact source attestation and reason are required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'REVIEW_CONFIG',
      FinancePermissions.CONFIG_REVIEW,
      async (m) => {
        if (!(await this.setup.isCompanyAdmin(m, a)))
          throw new ForbiddenException(
            'A scoped company admin must reconcile source evidence.',
          );
        const result = await reconcileSourceReceipt(
          m,
          {
            tenantId: a.tenantId,
            legalEntityId: s.legalEntityId,
            bookId: s.bookId,
            companyId: a.sourceCompanyId!,
          },
          id,
          receiptBodyBase64,
          receiptSignature,
        );
        if (!result.reused)
          await this.audit.logCritical(
            {
              userId: a.sourceUserId,
              companyId: a.sourceCompanyId,
              actorType: 'user',
              action: 'finance.source.attestation.reconciled',
              resource: 'finance-source-attestation',
              resourceId: id,
              reason,
              afterState: {
                receiptId: result.receiptId,
                revision: result.revision,
                postingAuthorized: false,
              },
            },
            m,
          );
        return result;
      },
    );
  }
  async grantSourceDeliveryWorker(
    a: FoundationActor,
    s: FinanceBookSelection,
    input: { workerSubjectId: string; validUntil: string },
    reason: string,
  ) {
    if (
      !setupObject(input) ||
      Object.keys(input).some(
        (key) => !['workerSubjectId', 'validUntil'].includes(key),
      ) ||
      !setupUuid(input.workerSubjectId) ||
      typeof input.validUntil !== 'string' ||
      !Number.isFinite(Date.parse(input.validUntil)) ||
      !setupText(reason)
    )
      throw new BadRequestException(
        'A worker, bounded expiry and reason are required.',
      );
    const expires = new Date(input.validUntil);
    if (
      expires.toISOString() !== input.validUntil ||
      expires.getTime() <= Date.now() ||
      expires.getTime() > Date.now() + 90 * 86400000
    )
      throw new BadRequestException(
        'Worker authority must expire within 90 days.',
      );
    return this.setup.withAccess(
      a,
      s,
      'REVIEW_CONFIG',
      FinancePermissions.CONFIG_REVIEW,
      async (m) => {
        if (
          !(await this.setup.isCompanyAdmin(m, a)) ||
          input.workerSubjectId.toLowerCase() === a.subjectId.toLowerCase()
        )
          throw new ForbiddenException(
            'A scoped company admin and distinct source-delivery worker are required.',
          );
        const [old] = await m.query(
          `SELECT id FROM finance_source_delivery_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_company_id=$4 AND worker_subject_id=$5 AND state='ENABLED' AND revoked_at IS NULL FOR SHARE`,
          [
            ...this.ids(a, s),
            a.sourceCompanyId,
            input.workerSubjectId.toLowerCase(),
          ],
        );
        if (old)
          throw new ConflictException(
            'Revoke the existing source-delivery authority before granting another.',
          );
        const [row] = await m.query(
          `INSERT INTO finance_source_delivery_authorities(tenant_id,legal_entity_id,book_id,source_company_id,worker_subject_id,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,'ENABLED',$6,statement_timestamp(),$7) RETURNING id`,
          [
            ...this.ids(a, s),
            a.sourceCompanyId,
            input.workerSubjectId.toLowerCase(),
            reason,
            expires,
          ],
        );
        await this.audit.logCritical(
          {
            userId: a.sourceUserId,
            companyId: a.sourceCompanyId,
            actorType: 'user',
            action: 'finance.source.delivery_worker.granted',
            resource: 'finance-source-delivery-authority',
            resourceId: row.id,
            reason,
            afterState: {
              workerSubjectId: input.workerSubjectId.toLowerCase(),
              validTo: expires.toISOString(),
              postingAuthorized: false,
            },
          },
          m,
        );
        return {
          authorityId: row.id,
          state: 'ENABLED',
          validUntil: expires.toISOString(),
          postingAuthorized: false,
        };
      },
    );
  }
  async revokeSourceDeliveryWorker(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    reason: string,
  ) {
    if (!setupUuid(id) || !setupText(reason))
      throw new BadRequestException(
        'An exact delivery authority and reason are required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'REVIEW_CONFIG',
      FinancePermissions.CONFIG_REVIEW,
      async (m) => {
        if (!(await this.setup.isCompanyAdmin(m, a)))
          throw new ForbiddenException(
            'A scoped company admin must revoke source-delivery authority.',
          );
        const [row] = await m.query(
          `SELECT * FROM finance_source_delivery_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_company_id=$4 AND id=$5 FOR UPDATE`,
          [...this.ids(a, s), a.sourceCompanyId, id],
        );
        if (!row || row.state !== 'ENABLED' || row.revoked_at)
          throw new ForbiddenException(
            'Current company-owned delivery authority is unavailable.',
          );
        await m.query(
          `UPDATE finance_source_delivery_authorities SET state='REVOKED',revoked_at=statement_timestamp() WHERE id=$1`,
          [id],
        );
        await this.audit.logCritical(
          {
            userId: a.sourceUserId,
            companyId: a.sourceCompanyId,
            actorType: 'user',
            action: 'finance.source.delivery_worker.revoked',
            resource: 'finance-source-delivery-authority',
            resourceId: id,
            reason,
            beforeState: {
              workerSubjectId: row.worker_subject_id,
              state: row.state,
            },
            afterState: { state: 'REVOKED', postingAuthorized: false },
          },
          m,
        );
        return { authorityId: id, state: 'REVOKED', postingAuthorized: false };
      },
    );
  }
  async grantAllocationWorker(
    a: FoundationActor,
    s: FinanceBookSelection,
    input: {
      workerSubjectId: string;
      scheduleId: string;
      scheduleHash: string;
      validUntil: string;
    },
    reason: string,
  ) {
    if (
      !setupObject(input) ||
      Object.keys(input).some(
        (k) =>
          ![
            'workerSubjectId',
            'scheduleId',
            'scheduleHash',
            'validUntil',
          ].includes(k),
      ) ||
      !setupUuid(input.workerSubjectId) ||
      !setupUuid(input.scheduleId) ||
      !setupHash(input.scheduleHash) ||
      !setupText(reason) ||
      typeof input.validUntil !== 'string' ||
      !Number.isFinite(Date.parse(input.validUntil))
    )
      throw new BadRequestException(
        'An exact worker, schedule, bounded expiry and reason are required.',
      );
    const expires = new Date(input.validUntil);
    if (
      expires.toISOString() !== input.validUntil ||
      expires.getTime() <= Date.now() ||
      expires.getTime() > Date.now() + 90 * 86400000
    )
      throw new BadRequestException(
        'Worker authority must expire within 90 days.',
      );
    return this.setup.withAccess(
      a,
      s,
      'REVIEW_CONFIG',
      FinancePermissions.CONFIG_REVIEW,
      async (m) => {
        if (!(await this.setup.isCompanyAdmin(m, a)))
          throw new ForbiddenException(
            'A scoped company admin must grant allocation worker authority.',
          );
        const r = await this.exactConfiguration(
          m,
          a,
          s,
          input.scheduleId,
          input.scheduleHash,
        );
        const plan = validateAllocationSchedule(r.payload);
        if (
          r.kind !== 'DIMENSIONS' ||
          r.state !== 'REVIEWED_INACTIVE' ||
          plan.schema !== 'FINANCE_ALLOCATION_SCHEDULE_V2' ||
          !plan.dimension ||
          plan.dimension.companyId.toLowerCase() !==
            a.sourceCompanyId!.toLowerCase() ||
          r.maker_natural_person_id === a.naturalPersonId ||
          input.workerSubjectId.toLowerCase() === a.subjectId.toLowerCase() ||
          input.workerSubjectId.toLowerCase() === r.maker_subject_id
        )
          throw new ForbiddenException(
            'An independently reviewed company-owned schedule and distinct worker are required.',
          );
        const [old] = await m.query(
          `SELECT id FROM finance_allocation_worker_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND worker_subject_id=$4 AND schedule_release_id=$5 AND state='ENABLED' AND revoked_at IS NULL FOR SHARE`,
          [...this.ids(a, s), input.workerSubjectId.toLowerCase(), r.id],
        );
        if (old)
          throw new ConflictException(
            'Revoke the existing worker authority before granting another.',
          );
        const [authority] = await m.query(
          `INSERT INTO finance_allocation_worker_authorities(tenant_id,legal_entity_id,book_id,worker_subject_id,schedule_release_id,schedule_release_hash,state,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,'ENABLED',$7,statement_timestamp(),$8) RETURNING *`,
          [
            ...this.ids(a, s),
            input.workerSubjectId.toLowerCase(),
            r.id,
            r.release_hash,
            reason,
            expires,
          ],
        );
        await this.audit.logCritical(
          {
            userId: a.sourceUserId,
            companyId: a.sourceCompanyId,
            actorType: 'user',
            action: 'finance.allocation.worker.granted',
            resource: 'finance-allocation-worker-authority',
            resourceId: authority.id,
            reason,
            afterState: {
              workerSubjectId: authority.worker_subject_id,
              scheduleId: r.id,
              scheduleHash: r.release_hash,
              validTo: expires.toISOString(),
              postingAuthorized: false,
            },
          },
          m,
        );
        return {
          authorityId: authority.id,
          state: authority.state,
          validUntil: expires.toISOString(),
          postingAuthorized: false,
        };
      },
    );
  }
  async revokeAllocationWorker(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    reason: string,
  ) {
    if (!setupUuid(id) || !setupText(reason))
      throw new BadRequestException(
        'An exact authority and reason are required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'REVIEW_CONFIG',
      FinancePermissions.CONFIG_REVIEW,
      async (m) => {
        if (!(await this.setup.isCompanyAdmin(m, a)))
          throw new ForbiddenException(
            'A scoped company admin must revoke allocation worker authority.',
          );
        const [authority] = await m.query(
          `SELECT a.*,r.payload FROM finance_allocation_worker_authorities a JOIN finance_configuration_releases r ON r.tenant_id=a.tenant_id AND r.legal_entity_id=a.legal_entity_id AND r.book_id=a.book_id AND r.id=a.schedule_release_id WHERE a.tenant_id=$1 AND a.legal_entity_id=$2 AND a.book_id=$3 AND a.id=$4 FOR UPDATE OF a`,
          [...this.ids(a, s), id],
        );
        const plan = authority && validateAllocationSchedule(authority.payload);
        if (
          !authority ||
          !plan?.dimension ||
          plan.dimension.companyId.toLowerCase() !==
            a.sourceCompanyId!.toLowerCase() ||
          authority.state !== 'ENABLED' ||
          authority.revoked_at
        )
          throw new ForbiddenException(
            'Current company-owned worker authority is unavailable.',
          );
        await m.query(
          `UPDATE finance_allocation_worker_authorities SET state='REVOKED',revoked_at=statement_timestamp() WHERE id=$1`,
          [id],
        );
        await this.audit.logCritical(
          {
            userId: a.sourceUserId,
            companyId: a.sourceCompanyId,
            actorType: 'user',
            action: 'finance.allocation.worker.revoked',
            resource: 'finance-allocation-worker-authority',
            resourceId: id,
            reason,
            beforeState: {
              workerSubjectId: authority.worker_subject_id,
              state: authority.state,
            },
            afterState: { state: 'REVOKED', postingAuthorized: false },
          },
          m,
        );
        return { authorityId: id, state: 'REVOKED', postingAuthorized: false };
      },
    );
  }
  async reviewAllocationPreview(
    a: FoundationActor,
    s: FinanceBookSelection,
    id: string,
    hash: string,
    reason: string,
  ) {
    if (!setupUuid(id) || !setupHash(hash) || !setupText(reason))
      throw new BadRequestException(
        'An exact preview, hash and reason are required.',
      );
    return this.setup.withAccess(
      a,
      s,
      'REVIEW_CONFIG',
      FinancePermissions.CONFIG_REVIEW,
      async (m, authorityId) => {
        const [occurrence] = await m.query(
          `SELECT *,occurrence_date::text AS day FROM finance_allocation_preview_occurrences WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR SHARE`,
          [...this.ids(a, s), id],
        );
        if (
          !occurrence ||
          occurrence.subject_hash !== hash ||
          financeConfigurationHash(occurrence.payload) !== hash ||
          occurrence.worker_subject_id === a.subjectId
        )
          throw new ForbiddenException(
            'An exact independent worker preview is required.',
          );
        const payload = occurrence.payload;
        const schedule = await this.exactConfiguration(
          m,
          a,
          s,
          occurrence.schedule_release_id,
          occurrence.schedule_release_hash,
        );
        const rule = await this.exactConfiguration(
          m,
          a,
          s,
          occurrence.rule_release_id,
          occurrence.rule_release_hash,
        );
        const plan = validateAllocationSchedule(schedule.payload);
        if (
          schedule.state !== 'REVIEWED_INACTIVE' ||
          rule.state !== 'REVIEWED_INACTIVE' ||
          plan.schema !== 'FINANCE_ALLOCATION_SCHEDULE_V2' ||
          !plan.dimension ||
          plan.dimension.companyId.toLowerCase() !==
            a.sourceCompanyId!.toLowerCase() ||
          schedule.maker_natural_person_id === a.naturalPersonId ||
          plan.ruleId !== rule.id ||
          plan.ruleHash !== rule.release_hash ||
          payload.occurrenceDate !== occurrence.day ||
          payload.postingAuthorized !== false ||
          financeConfigurationHash(payload.dimension) !==
            financeConfigurationHash(plan.dimension)
        )
          throw new ForbiddenException(
            'A current reviewed company schedule and independent reviewer are required.',
          );
        validateAllocationRule(rule.payload);
        const expected = previewBranchAllocation({
          sourceBranch: rule.payload.sourceBranch,
          expenseRole: rule.payload.expenseRole,
          interbranchRole: rule.payload.interbranchRole,
          targets: rule.payload.targets,
          amountMinor: plan.amountMinor,
        });
        if (
          financeConfigurationHash(expected) !==
            financeConfigurationHash(payload.lines) ||
          payload.amountMinor !== plan.amountMinor ||
          payload.currency !== plan.currency ||
          payload.decimalScale !== plan.decimalScale
        )
          throw new ConflictException(
            'Preview lines or amount differ from the reviewed schedule.',
          );
        const d = plan.dimension;
        const common = {
          COMPANY: d.companyId,
          DIMENSION_RELEASE: d.dimensionReleaseId,
          DIMENSION_HASH: d.dimensionReleaseHash,
          SOURCE_ASSOCIATION: d.sourceAssociationId,
          SOURCE_ASSOCIATION_HASH: d.sourceAssociationHash,
        };
        await verifyReviewedDimensionMaster(m, this.ids(a, s), {
          economicOrigin: 'SCHEDULED_ALLOCATION',
          accountingDate: occurrence.day,
          lines: expected.map((line, index) => ({
            lineKey: `LINE-${index}`,
            roleCode: line.role,
            debit: '0',
            credit: '0',
            dimensions: { ...common, BRANCH: line.branch },
          })),
        });
        const [existing] = await m.query(
          'SELECT id,occurrence_hash,reviewer_subject_id,reviewer_natural_person_id FROM finance_allocation_preview_reviews WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND occurrence_id=$4 FOR SHARE',
          [...this.ids(a, s), id],
        );
        if (existing) {
          if (
            existing.occurrence_hash !== hash ||
            existing.reviewer_subject_id !== a.subjectId ||
            existing.reviewer_natural_person_id !== a.naturalPersonId
          )
            throw new ConflictException(
              'Allocation preview already has a different independent review.',
            );
          return {
            reviewId: existing.id,
            occurrenceId: id,
            occurrenceHash: hash,
            state: 'REVIEWED_INACTIVE',
            postingAuthorized: false,
          };
        }
        const [review] = await m.query(
          `INSERT INTO finance_allocation_preview_reviews(tenant_id,legal_entity_id,book_id,occurrence_id,occurrence_hash,reviewer_subject_id,reviewer_natural_person_id,authority_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            ...this.ids(a, s),
            id,
            hash,
            a.subjectId,
            a.naturalPersonId,
            authorityId,
            reason,
          ],
        );
        await this.audit.logCritical(
          {
            userId: a.sourceUserId,
            companyId: a.sourceCompanyId,
            actorType: 'user',
            action: 'finance.allocation.preview.reviewed',
            resource: 'finance-allocation-preview',
            resourceId: id,
            reason,
            afterState: {
              reviewId: review.id,
              occurrenceHash: hash,
              postingAuthorized: false,
            },
          },
          m,
        );
        return {
          reviewId: review.id,
          occurrenceId: id,
          occurrenceHash: hash,
          state: 'REVIEWED_INACTIVE',
          postingAuthorized: false,
        };
      },
    );
  }
  async allocationPreviews(a: FoundationActor, s: FinanceBookSelection) {
    return this.setup.withAccess(
      a,
      s,
      'READ',
      FinancePermissions.FOUNDATION_READ,
      async (m) => {
        const rows = await m.query(
          `SELECT o.id,o.subject_hash,o.occurrence_date::text AS occurrence_date,o.payload,o.created_at,r.id AS review_id,r.reviewer_subject_id,r.reviewed_at FROM finance_allocation_preview_occurrences o LEFT JOIN finance_allocation_preview_reviews r ON r.tenant_id=o.tenant_id AND r.legal_entity_id=o.legal_entity_id AND r.book_id=o.book_id AND r.occurrence_id=o.id WHERE o.tenant_id=$1 AND o.legal_entity_id=$2 AND o.book_id=$3 AND o.payload->'dimension'->>'companyId'=$4 ORDER BY o.occurrence_date DESC,o.id LIMIT 100`,
          [...this.ids(a, s), a.sourceCompanyId],
        );
        return { previews: rows, postingAuthorized: false };
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
