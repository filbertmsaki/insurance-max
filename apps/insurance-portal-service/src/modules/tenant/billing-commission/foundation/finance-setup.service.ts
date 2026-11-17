import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { FinancePermissions } from '../finance.permissions';
import { FoundationActor } from './finance-ledger-foundation.service';
import { FinanceBookSelection } from './finance-scope.service';
import {
  canonicalFinanceJson,
  CONFIGURATION_KINDS,
  financeConfigurationHash,
  isFinanceDate,
} from './finance-configuration.types';
import { FINANCE_SETUP_CATALOG } from './finance-setup.catalog';
import { validateSetupConfiguration } from './finance-setup-configuration';
import { ADMIN_ROLE_BY_COMPANY_TYPE } from '../../../platform/companies/access-rules';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { financeChartSourceMapHash } from './finance-chart.snapshot';
import type { FinanceLegalEntitySourceMap } from './entities/finance-legal-entity-source-map.entity';
import { readSetupTaxRules, selectSetupTaxRules } from './finance-setup-tax';
import {
  setupLegalIdentifiers,
  isDemonstrationIdentifier,
} from './finance-setup-legal';
import {
  FINANCE_SETUP_STEPS,
  FinanceSetupAction,
  FinanceSetupInput,
  FinanceSetupState,
  SetupEvidence,
  setupAnswerIssues,
  setupHash,
  setupInput,
  setupObject,
  setupText,
  setupUuid,
} from './finance-setup.types';

type Access = 'READ' | 'PREPARE_CONFIG' | 'REVIEW_CONFIG';
type Row = {
  id: string;
  step: string;
  version: number;
  subject: Record<string, any>;
  subject_hash: string;
  canonical_subject: string;
  maker_subject_id: string;
  maker_natural_person_id: string;
  state: FinanceSetupState;
  events?: any[];
};
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Company setup review has no activation, journal, settlement or deployment command. */
@Injectable()
export class FinanceSetupService {
  constructor(
    @InjectDataSource() private readonly source: DataSource | EntityManager,
  ) {}

  async withAccess<T>(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    access: Access,
    permission: string,
    work: (m: EntityManager, authorityId: string) => Promise<T>,
  ): Promise<T> {
    if (
      actor?.kind !== 'USER' ||
      ![
        actor.tenantId,
        actor.subjectId,
        actor.naturalPersonId,
        actor.identityBindingId,
        actor.sourceCompanyId,
        actor.sourceUserId,
        scope?.legalEntityId,
        scope?.bookId,
      ].every(setupUuid)
    )
      throw new ForbiddenException(
        'A current, trusted company Finance identity is required.',
      );
    return this.source.transaction('REPEATABLE READ', async (m) => {
      if (access !== 'READ')
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          ['G04-SCOPE', actor.tenantId, scope.legalEntityId, scope.bookId].join(
            '/',
          ),
        ]);
      const ids = [
        actor.tenantId,
        scope.legalEntityId,
        scope.bookId,
        actor.subjectId,
        actor.naturalPersonId,
      ];
      const identity = await m.query(
        `SELECT i.id FROM finance_foundation_identity_bindings i
        JOIN users u ON u.id::text=i.source_user_id::text JOIN company_users cu ON cu.user_id::text=u.id::text AND cu.company_id::text=i.source_company_id::text
        JOIN companies c ON c.id::text=cu.company_id::text JOIN finance_accounting_books b ON b.tenant_id=i.tenant_id AND b.legal_entity_id=i.legal_entity_id AND b.id=i.book_id
        JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id
        WHERE i.tenant_id=$1 AND i.legal_entity_id=$2 AND i.book_id=$3 AND i.subject_id=$4 AND i.natural_person_id=$5 AND i.id=$6 AND i.source_company_id=$7 AND i.source_user_id=$8
        AND i.revoked_at IS NULL AND i.valid_from<=statement_timestamp() AND (i.valid_to IS NULL OR i.valid_to>statement_timestamp())
        AND u.status='active' AND cu.status='active' AND c.status='active' AND u.deleted_at IS NULL AND c.deleted_at IS NULL AND b.state<>'DISABLED' AND l.state<>'DISABLED'
        AND EXISTS(SELECT 1 FROM permissions p WHERE p.name=$9 AND p.is_deprecated=false AND
          (EXISTS(SELECT 1 FROM company_user_permissions d WHERE d.company_user_id::text=cu.id::text AND d.permission_id::text=p.id::text) OR
           EXISTS(SELECT 1 FROM company_user_roles cr JOIN roles r ON r.id::text=cr.role_id::text JOIN permission_role pr ON pr.roles_id::text=r.id::text WHERE cr.company_user_id::text=cu.id::text AND pr.permissions_id::text=p.id::text AND (r.company_id::text=cu.company_id::text OR (r.company_id IS NULL AND r.scope='tenant_template')) AND NOT EXISTS(SELECT 1 FROM company_user_permission_exclusions ex WHERE ex.company_user_id::text=cu.id::text AND ex.permission_id::text=p.id::text))))
        FOR SHARE OF i,u,cu,c,b,l`,
        [
          ...ids,
          actor.identityBindingId,
          actor.sourceCompanyId,
          actor.sourceUserId,
          permission,
        ],
      );
      if (identity.length !== 1)
        throw new ForbiddenException(
          'Current company membership, setup permission and exact book identity are required.',
        );
      const authorities =
        access === 'READ'
          ? await m.query(
              `SELECT id FROM finance_foundation_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND capability='READ' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE`,
              ids,
            )
          : await m.query(
              `SELECT id FROM finance_configuration_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND permission=$6 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE`,
              [...ids, access],
            );
      if (authorities.length !== 1)
        throw new ForbiddenException(
          'A unique current scoped setup authority is required.',
        );
      const result = await work(m, authorities[0].id);
      const table =
        access === 'READ'
          ? 'finance_foundation_authorities'
          : 'finance_configuration_authorities';
      const current = await m.query(
        `SELECT id FROM ${table} WHERE id=$1 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())`,
        [authorities[0].id],
      );
      const binding = await m.query(
        `SELECT id FROM finance_foundation_identity_bindings WHERE id=$1 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())`,
        [actor.identityBindingId],
      );
      if (current.length !== 1 || binding.length !== 1)
        throw new ForbiddenException('Setup access expired before completion.');
      return result;
    });
  }

  private ids(actor: FoundationActor, scope: FinanceBookSelection) {
    return [actor.tenantId, scope.legalEntityId, scope.bookId];
  }

  async inventory(
    m: EntityManager,
    actor: FoundationActor,
    scope: FinanceBookSelection,
  ) {
    const [company] = await m.query(
      `SELECT id,name,company_type,status,verification_status,tira_license_number,tira_license_status,license_issued_at::text,license_expires_at::text,tin,brela_registration_number,operating_timezone,default_currency,regulatory_metadata->'finance_legal_evidence' AS finance_legal_evidence FROM companies WHERE id=$1`,
      [actor.sourceCompanyId],
    );
    if (!company)
      throw new ForbiddenException('Source company is unavailable.');
    await m.query(
      'SELECT id FROM insurance_product_versions WHERE company_id=$1 FOR SHARE',
      [actor.sourceCompanyId],
    );
    const products = await m.query(
      `SELECT p.id,p.product_code,p.product_name,p.business_line,p.supports_fleet,p.is_active,p.lifecycle_status,p.current_version_id,v.status AS version_status,v.effective_from::text,v.effective_to::text FROM insurance_products p LEFT JOIN insurance_product_versions v ON v.id=p.current_version_id AND v.company_id=p.company_id AND v.product_id=p.id WHERE p.company_id=$1 AND p.deleted_at IS NULL ORDER BY p.id FOR SHARE OF p`,
      [actor.sourceCompanyId],
    );
    const accounts = await m.query(
      `SELECT id,account_code,account_name,account_type,is_active,is_control_account FROM finance_accounts WHERE company_id=$1 ORDER BY id FOR SHARE`,
      [actor.sourceCompanyId],
    );
    const sourceMaps = await m.query(
      `SELECT id,source_system,source_company_id,legal_role,business_profile,mapping_version,valid_from::text,valid_to::text,state FROM finance_legal_entity_source_maps WHERE tenant_id=$1 AND legal_entity_id=$2 ORDER BY id FOR SHARE`,
      this.ids(actor, scope).slice(0, 2),
    );
    const people = await m.query(
      `SELECT i.id AS binding_id,i.subject_id,i.natural_person_id,i.source_user_id,u.first_name,u.last_name,u.status AS user_status,cu.status AS membership_status,i.valid_from,i.valid_to,i.revoked_at FROM finance_foundation_identity_bindings i JOIN users u ON u.id::text=i.source_user_id::text JOIN company_users cu ON cu.user_id::text=u.id::text AND cu.company_id::text=i.source_company_id::text WHERE i.tenant_id=$1 AND i.legal_entity_id=$2 AND i.book_id=$3 AND i.source_company_id=$4 ORDER BY i.id`,
      [...this.ids(actor, scope), actor.sourceCompanyId],
    );
    const documents = await m.query(
      `SELECT d.id,d.title,d.document_type,d.status,v.id AS version_id,v.version_number,v.sha256_hash,v.status AS version_status FROM documents d JOIN document_versions v ON v.id=d.current_version_id AND v.document_id=d.id AND v.company_id=d.company_id WHERE d.company_id=$1 AND ((d.owner_type='COMPANY' AND d.owner_id=$1) OR (d.owner_type='FINANCE_SETUP' AND d.owner_id=$2)) ORDER BY d.id`,
      [actor.sourceCompanyId, scope.bookId],
    );
    const configurations = await m.query(
      `SELECT id,kind,configuration_key,version,release_hash,state,effective_from::text,effective_to::text FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 ORDER BY kind,configuration_key,version DESC`,
      this.ids(actor, scope),
    );
    const taxRules = await readSetupTaxRules(m, actor.sourceCompanyId!);
    const policies = await m.query(
      `SELECT p.id,p.policy_code,p.version,p.profile,p.definition_hash,p.definition,COALESCE(e.to_state,'DRAFT') AS state FROM finance_policy_versions p LEFT JOIN LATERAL(SELECT to_state FROM finance_policy_events WHERE policy_id=p.id ORDER BY sequence DESC LIMIT 1)e ON true WHERE p.tenant_id=$1 AND p.legal_entity_id=$2 AND p.book_id=$3 ORDER BY p.policy_code,p.version DESC FOR SHARE OF p`,
      this.ids(actor, scope),
    );
    const [book] = await m.query(
      `SELECT b.id,b.book_code,b.state,l.business_profile,l.jurisdiction_code FROM finance_accounting_books b JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id WHERE b.tenant_id=$1 AND b.legal_entity_id=$2 AND b.id=$3`,
      this.ids(actor, scope),
    );
    return json({
      company,
      legalIdentifiers: setupLegalIdentifiers(company, book.jurisdiction_code),
      products,
      accounts,
      sourceMaps: sourceMaps.map((map: any) => ({
        ...map,
        hash: financeChartSourceMapHash({
          ...map,
          tenant_id: actor.tenantId,
          legal_entity_id: scope.legalEntityId,
        } as FinanceLegalEntitySourceMap),
      })),
      people,
      documents,
      configurations,
      taxRules,
      policies,
      book,
    });
  }

  private sourceSnapshot(
    input: FinanceSetupInput,
    inventory: Awaited<ReturnType<FinanceSetupService['inventory']>>,
  ) {
    switch (input.step) {
      case 'G04-01':
        return { company: inventory.company, products: inventory.products };
      case 'G04-02':
        return { people: inventory.people };
      case 'G04-05':
        return {
          accounts: inventory.accounts,
          sourceMaps: inventory.sourceMaps,
        };
      case 'G04-06':
        return {
          accounts: inventory.accounts,
          sourceMaps: inventory.sourceMaps,
        };
      case 'G04-07':
        return {
          configurations: inventory.configurations.filter(
            (c: any) =>
              Array.isArray(input.answers.configurationPins) &&
              input.answers.configurationPins.some((p: any) => p.id === c.id),
          ),
        };
      case 'G04-08':
        return { policies: inventory.policies };
      default:
        return { companyId: inventory.company.id, book: inventory.book };
    }
  }

  private async latest(
    m: EntityManager,
    actor: FoundationActor,
    scope: FinanceBookSelection,
  ): Promise<Row[]> {
    return m.query(
      `SELECT DISTINCT ON(v.step) v.*,e.to_state AS state FROM finance_setup_versions v JOIN LATERAL(SELECT to_state FROM finance_setup_events WHERE version_id=v.id ORDER BY sequence DESC LIMIT 1)e ON true WHERE v.tenant_id=$1 AND v.legal_entity_id=$2 AND v.book_id=$3 ORDER BY v.step,v.version DESC`,
      this.ids(actor, scope),
    );
  }

  private async issues(
    m: EntityManager,
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: FinanceSetupInput,
    inventory: Awaited<ReturnType<FinanceSetupService['inventory']>>,
    checkDependencies = true,
  ) {
    const issues = setupAnswerIssues(input),
      a = input.answers;
    const need = (ok: unknown, message: string) => {
      if (!ok) issues.push(message);
    };
    for (const e of input.evidence) {
      need(
        await this.evidenceAvailable(m, actor, scope, e),
        `Evidence ${e.purpose} is unavailable, changed or belongs to another company.`,
      );
    }
    const latest = await this.latest(m, actor, scope),
      index = FINANCE_SETUP_STEPS.findIndex(([id]) => id === input.step);
    const required = checkDependencies
      ? FINANCE_SETUP_STEPS.slice(0, index).map(([step]) =>
          latest.find((r) => r.step === step),
        )
      : [];
    if (checkDependencies)
      need(
        required.every(Boolean) && input.dependencies.length === index,
        'Pin each preceding setup step to its latest independently reviewed version.',
      );
    for (const row of required)
      if (row) {
        need(
          row.state === 'REVIEWED_INACTIVE' &&
            input.dependencies.some(
              (p) => p.id === row.id && p.hash === row.subject_hash,
            ),
          `${row.step} needs current independent inactive review.`,
        );
        const previousInput = setupInput(row.subject.input);
        need(
          previousInput.purpose === input.purpose,
          `${row.step} has a different setup purpose; demonstration evidence cannot complete company setup.`,
        );
        need(
          financeConfigurationHash(
            this.sourceSnapshot(previousInput, inventory),
          ) === row.subject.sourceHash,
          `${row.step} source evidence changed; prepare a new version.`,
        );
        const priorIndex = FINANCE_SETUP_STEPS.findIndex(
          ([id]) => id === row.step,
        );
        need(
          previousInput.dependencies.length === priorIndex &&
            FINANCE_SETUP_STEPS.slice(0, priorIndex).every(([id]) => {
              const current = latest.find((r) => r.step === id);
              return (
                current?.state === 'REVIEWED_INACTIVE' &&
                previousInput.dependencies.some(
                  (p) => p.id === current.id && p.hash === current.subject_hash,
                )
              );
            }),
          `${row.step} has stale prerequisite versions.`,
        );
        need(
          (await this.issues(m, actor, scope, previousInput, inventory, false))
            .length === 0,
          `${row.step} supporting evidence or configuration is no longer complete.`,
        );
      }
    if (input.step === 'G04-01') {
      const c = setupLegalIdentifiers(
        inventory.company,
        inventory.book.jurisdiction_code,
      );
      for (const [key, label] of [
        ['licenceNumber', 'Licence number'],
        ['taxIdentifier', 'Tax identifier'],
        ['registrationNumber', 'Company registration number'],
      ] as const)
        need(
          setupText(c[key], 100),
          `${label} is missing from the company master.`,
        );
      need(
        setupText(c.regulator, 100),
        'Provide the actual jurisdiction regulator.',
      );
      need(
        setupText(c.licenceStatus, 30) &&
          ['ACTIVE', 'VALID', 'LICENSED', 'LICENCED'].includes(
            c.licenceStatus.toUpperCase(),
          ),
        'Current licence status evidence is required.',
      );
      need(
        isFinanceDate(c.issuedOn) &&
          isFinanceDate(c.expiresOn) &&
          input.effectiveFrom &&
          c.issuedOn <= input.effectiveFrom &&
          c.expiresOn >= input.effectiveFrom,
        'Licence dates must cover the setup effective date.',
      );
      need(
        input.effectiveTo &&
          isFinanceDate(c.expiresOn) &&
          c.expiresOn >=
            new Date(Date.parse(input.effectiveTo + 'T00:00:00Z') - 86400000)
              .toISOString()
              .slice(0, 10),
        'Use a bounded setup interval covered by the licence evidence.',
      );
      if (input.purpose === 'COMPANY_SETUP')
        need(
          ![c.licenceNumber, c.taxIdentifier, c.registrationNumber].some(
            isDemonstrationIdentifier,
          ),
          'Demonstration identifiers cannot complete actual company setup.',
        );
      need(
        a.jurisdictionCode === inventory.book.jurisdiction_code,
        'Jurisdiction must match the scoped legal entity.',
      );
      if (Array.isArray(a.productIds))
        for (const id of a.productIds) {
          const p = inventory.products.find((p: any) => p.id === id);
          need(
            p?.is_active &&
              p.lifecycle_status === 'ACTIVE' &&
              p.current_version_id &&
              ['ACTIVE', 'PUBLISHED'].includes(p.version_status) &&
              (!p.effective_from ||
                (input.effectiveFrom &&
                  p.effective_from <= input.effectiveFrom)) &&
              (!p.effective_to ||
                (input.effectiveFrom && p.effective_to > input.effectiveFrom)),
            'Every selected product must have a current, applicable active version owned by this company.',
          );
        }
      for (const purpose of ['LICENCE', 'TIN', 'REGISTRATION'])
        need(
          input.evidence.some((e) => e.purpose === purpose),
          `Attach ${purpose.toLowerCase()} evidence.`,
        );
    }
    if (input.step === 'G04-02') {
      const preparer = inventory.people.find(
          (p: any) => p.binding_id === a.preparerBindingId,
        ),
        reviewer = inventory.people.find(
          (p: any) => p.binding_id === a.reviewerBindingId,
        );
      need(
        preparer &&
          reviewer &&
          preparer.subject_id !== reviewer.subject_id &&
          preparer.natural_person_id !== reviewer.natural_person_id,
        'Preparer and reviewer must be different real people, including across logins.',
      );
      for (const p of [preparer, reviewer])
        need(
          p &&
            p.user_status === 'active' &&
            p.membership_status === 'active' &&
            !p.revoked_at &&
            Date.parse(p.valid_from) <= Date.now() &&
            (!p.valid_to || Date.parse(p.valid_to) > Date.now()),
          'Appointments require current active company identities.',
        );
      need(
        reviewer &&
          (await this.isCompanyAdmin(m, {
            ...actor,
            sourceUserId: reviewer.source_user_id,
          })),
        'The company policy reviewer must hold the actual company-admin role.',
      );
    }
    if (input.step === 'G04-05' && Array.isArray(a.sourceMapIds))
      for (const id of a.sourceMapIds) {
        const map = inventory.sourceMaps.find((v: any) => v.id === id);
        need(
          map &&
            map.source_company_id === actor.sourceCompanyId &&
            map.business_profile === inventory.book.business_profile &&
            map.state === 'DRAFT' &&
            input.effectiveFrom &&
            map.valid_from <= input.effectiveFrom &&
            (!map.valid_to ||
              (input.effectiveTo && map.valid_to >= input.effectiveTo)),
          'Source maps must match this company, profile and full effective interval.',
        );
      }
    if (input.step === 'G04-06')
      for (const [kind, id, hash] of [
        ['ACCOUNT_ROLES', a.chartReleaseId, a.chartReleaseHash],
        ['DIMENSIONS', a.dimensionReleaseId, a.dimensionReleaseHash],
      ]) {
        const r = inventory.configurations.find(
          (r: any) =>
            r.id === id &&
            r.release_hash === hash &&
            r.kind === kind &&
            r.state === 'REVIEWED_INACTIVE',
        );
        need(
          r,
          'Chart and dimensions need exact reviewed inactive configuration versions.',
        );
        if (r && kind === 'ACCOUNT_ROLES') {
          const [chart] = await m.query(
            'SELECT payload FROM finance_configuration_releases WHERE id=$1',
            [r.id],
          );
          need(
            chart?.payload?.proposal?.legacy?.mode === 'SCOPED_INVENTORY',
            'An unbound chart does not certify actual legacy-account inventory.',
          );
        }
      }
    if (input.step === 'G04-07' && Array.isArray(a.configurationPins)) {
      const selected = a.configurationPins.map((p: any) =>
        setupObject(p)
          ? inventory.configurations.find(
              (c: any) =>
                c.id === p.id &&
                c.release_hash === p.hash &&
                c.state === 'REVIEWED_INACTIVE',
            )
          : undefined,
      );
      need(
        selected.every(Boolean) &&
          new Set(selected.map((r: any) => r?.kind)).size ===
            CONFIGURATION_KINDS.length,
        'All 13 distinct configuration families require current inactive review.',
      );
      for (const r of selected.filter(Boolean))
        need(
          input.effectiveFrom &&
            r.effective_from <= input.effectiveFrom &&
            (!r.effective_to ||
              (input.effectiveTo && r.effective_to >= input.effectiveTo)),
          'Configuration must cover the entire proposed effective interval.',
        );
      for (const r of selected.filter(Boolean)) {
        const [full] = await m.query(
          'SELECT payload FROM finance_configuration_releases WHERE id=$1',
          [r.id],
        );
        try {
          validateSetupConfiguration({
            kind: r.kind,
            payload: full.payload,
          } as any);
        } catch {
          issues.push(`${r.kind} needs its complete typed setup contract.`);
        }
        if (r.kind === 'TAX_RULES') {
          const taxIds = full.payload.sourceTaxRuleIds;
          try {
            const rows = selectSetupTaxRules(
              inventory.taxRules,
              full.payload.sourceTaxCatalogue,
              Array.isArray(taxIds) ? taxIds : [],
              input.effectiveFrom!,
              input.effectiveTo,
            );
            need(
              rows.length > 0 &&
                financeConfigurationHash(rows) === full.payload.sourceRuleHash,
              'Source tax rules changed or are not fully evidenced by the reviewed configuration.',
            );
          } catch {
            issues.push(
              'Source tax rules are unavailable or do not cover the approved interval.',
            );
          }
        }
        if (r.kind === 'CURRENCY_RULES') {
          const assessment = latest.find((r) => r.step === 'G04-03');
          const agreed = assessment?.subject.input.answers;
          need(
            assessment &&
              full.payload.assessmentReference ===
                assessment.id + '/' + assessment.subject_hash &&
              [
                'functionalCurrency',
                'presentationCurrencies',
                'transactionCurrencies',
                'currencyScales',
                'rateSources',
                'maximumRateAgeDays',
                'roundingMode',
              ].every(
                (k) =>
                  financeConfigurationHash(full.payload[k] ?? null) ===
                  financeConfigurationHash(agreed?.[k] ?? null),
              ),
            'Currency rules must exactly match the reviewed functional-currency assessment.',
          );
        }
      }
    }
    if (input.step === 'G04-08') {
      if (Array.isArray(a.policyDecisions))
        for (const decision of a.policyDecisions.filter(setupObject)) {
          if (decision.disposition === 'DEFERRED') continue;
          const policy = inventory.policies.find(
            (p: any) =>
              p.id === decision.policyVersionId &&
              p.definition_hash === decision.policyVersionHash &&
              p.policy_code === decision.id,
          );
          const expected =
            decision.disposition === 'NOT_APPLICABLE'
              ? 'NOT_APPLICABLE'
              : 'APPROVED';
          const expectedProfile =
            inventory.book.business_profile === 'GENERAL_INSURER'
              ? 'INSURER'
              : inventory.book.business_profile;
          const latestPolicy = inventory.policies.find(
            (p: any) =>
              p.policy_code === decision.id && p.profile === policy?.profile,
          );
          need(
            policy &&
              latestPolicy?.id === policy.id &&
              policy.profile === expectedProfile &&
              policy.state === expected &&
              input.effectiveFrom &&
              policy.definition.effectiveFrom <= input.effectiveFrom &&
              (!policy.definition.effectiveTo ||
                (input.effectiveTo &&
                  policy.definition.effectiveTo >= input.effectiveTo)) &&
              (decision.disposition !== 'PROPOSED_TREATMENT' ||
                policy.definition.treatment === decision.selection),
            `${decision.id} needs its exact latest independently approved inactive policy treatment or approved nonapplicability. A setup declaration cannot replace native policy approval.`,
          );
          if (policy)
            for (const reference of policy.definition.evidenceReferences ??
              []) {
              const match = /^document:([^:]+):([^:]+):([a-f0-9]{64})$/.exec(
                reference,
              );
              need(
                match &&
                  (await this.evidenceAvailable(m, actor, scope, {
                    documentId: match[1],
                    id: match[2],
                    hash: match[3],
                    purpose: 'POLICY_REVIEW',
                  })),
                `${decision.id} policy evidence must remain owned and available.`,
              );
            }
        }
      for (const [field, catalog] of [
        ['policyDecisions', FINANCE_SETUP_CATALOG.policies],
        ['decisionSelections', FINANCE_SETUP_CATALOG.decisions],
      ] as const) {
        const rows = a[field];
        need(
          Array.isArray(rows) &&
            rows.length === catalog.length &&
            rows.every(setupObject) &&
            new Set(rows.map((r: any) => r?.id)).size === catalog.length &&
            catalog.every((c) => rows.some((r: any) => r?.id === c.id)),
          `Cover each baseline ${field === 'policyDecisions' ? 'policy' : 'decision'} exactly once.`,
        );
      }
    }
    if (['G04-05', 'G04-09'].includes(input.step)) {
      const hash =
        input.step === 'G04-05'
          ? a.populationEvidenceHash
          : a.reconciliationEvidenceHash;
      need(
        input.evidence.some((e) => e.hash === hash),
        'Reconciliation/population hash must reference attached owned evidence.',
      );
    }
    if (input.step === 'G04-10') {
      need(
        inventory.book.state === 'DRAFT',
        'This workflow completes inactive setup review only.',
      );
      need(
        !inventory.policies.some((p: any) => p.state === 'ACTIVE'),
        'No policy may be activated by inactive setup review.',
      );
    }
    return [...new Set(issues)];
  }

  async overview(actor: FoundationActor, scope: FinanceBookSelection) {
    return this.withAccess(
      actor,
      scope,
      'READ',
      FinancePermissions.FOUNDATION_READ,
      async (m) => {
        const inventory = await this.inventory(m, actor, scope),
          latest = await this.latest(m, actor, scope);
        const steps: {
          id: string;
          title: string;
          latest: ReturnType<FinanceSetupService['summary']> | null;
          issues: string[];
          complete: boolean;
        }[] = [];
        for (const [id, title] of FINANCE_SETUP_STEPS) {
          const row = latest.find((r) => r.step === id);
          const input = row
            ? setupInput(row.subject.input)
            : setupInput({
                step: id,
                version: 1,
                effectiveFrom: null,
                effectiveTo: null,
                answers: {},
                dependencies: [],
                evidence: [],
              });
          const issues = await this.issues(m, actor, scope, input, inventory);
          if (
            row &&
            financeConfigurationHash(this.sourceSnapshot(input, inventory)) !==
              row.subject.sourceHash
          )
            issues.push('The source snapshot changed; create a new version.');
          steps.push({
            id,
            title,
            latest: row ? this.summary(row) : null,
            issues,
            complete: row?.state === 'REVIEWED_INACTIVE' && issues.length === 0,
          });
        }
        const demonstration = latest.some(
          (r) => r.subject.input.purpose === 'DEMONSTRATION',
        );
        return {
          scope: { tenantId: actor.tenantId, ...scope },
          viewerIdentity: {
            subjectId: actor.subjectId,
            naturalPersonId: actor.naturalPersonId,
          },
          inventory,
          steps,
          catalog: FINANCE_SETUP_CATALOG,
          configurationKinds: CONFIGURATION_KINDS,
          complete: steps.every((s) => s.complete),
          completionMeaning: demonstration
            ? 'DEMONSTRATION_ONLY'
            : 'INACTIVE_SETUP_REVIEW_ONLY',
          financialEffects: 0,
          activationAuthorized: false,
        };
      },
    );
  }

  async evidenceAvailable(
    m: EntityManager,
    actor: FoundationActor,
    scope: FinanceBookSelection,
    e: SetupEvidence,
  ) {
    return (
      (
        await m.query(
          `SELECT v.id FROM document_versions v JOIN documents d ON d.id=v.document_id AND d.company_id=v.company_id WHERE v.id=$1 AND v.document_id=$2 AND v.sha256_hash=$3 AND v.company_id=$4 AND v.status='AVAILABLE' AND d.status='AVAILABLE' AND ((d.owner_type='COMPANY' AND d.owner_id=$4) OR (d.owner_type='FINANCE_SETUP' AND d.owner_id=$5)) FOR SHARE OF v,d`,
          [e.id, e.documentId, e.hash, actor.sourceCompanyId, scope.bookId],
        )
      ).length === 1
    );
  }

  private summary(row: Row) {
    return {
      id: row.id,
      step: row.step,
      version: row.version,
      subjectHash: row.subject_hash,
      state: row.state,
      makerSubjectId: row.maker_subject_id,
      makerNaturalPersonId: row.maker_natural_person_id,
    };
  }

  async detail(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    hash: string,
  ) {
    return this.withAccess(
      actor,
      scope,
      'READ',
      FinancePermissions.FOUNDATION_READ,
      async (m) => this.exact(m, actor, scope, id, hash),
    );
  }
  private async exact(
    m: EntityManager,
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    hash: string,
  ): Promise<Row> {
    if (!setupUuid(id) || !setupHash(hash))
      throw new BadRequestException(
        'Exact setup version and hash are required.',
      );
    const [row] = await m.query(
      'SELECT * FROM finance_setup_versions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR SHARE',
      [...this.ids(actor, scope), id],
    );
    if (
      !row ||
      row.subject_hash !== hash ||
      financeConfigurationHash(row.subject) !== hash ||
      canonicalFinanceJson(row.subject) !== row.canonical_subject
    )
      throw new ForbiddenException(
        'Exact setup version is unavailable in this book.',
      );
    const events = await m.query(
      'SELECT * FROM finance_setup_events WHERE version_id=$1 ORDER BY sequence',
      [id],
    );
    let previous: string | null = null,
      state: FinanceSetupState | null = null,
      sequence = 0;
    for (const e of events) {
      if (
        e.sequence !== ++sequence ||
        e.previous_hash !== previous ||
        e.from_state !== state ||
        financeConfigurationHash(e.event_subject) !== e.event_hash ||
        canonicalFinanceJson(e.event_subject) !== e.canonical_event
      )
        throw new ConflictException('Setup audit-chain evidence differs.');
      previous = e.event_hash;
      state = e.to_state;
    }
    if (!state) throw new ConflictException('Setup creation audit is missing.');
    return { ...row, state, events };
  }

  async create(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    value: unknown,
    reason: string,
  ) {
    const input = setupInput(value);
    if (!setupText(reason))
      throw new BadRequestException('Record the preparation reason.');
    return this.withAccess(
      actor,
      scope,
      'PREPARE_CONFIG',
      FinancePermissions.SETUP_PREPARE,
      async (m, authority) => {
        if (input.purpose === 'DEMONSTRATION') {
          const [database] = await m.query(
            'SELECT current_database() AS name,inet_server_addr()::text AS host',
          );
          if (
            !database.name.startsWith('insurance_portal_test_') ||
            !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
              database.host.split('/')[0],
            )
          )
            throw new ConflictException(
              'Demonstration setup is restricted to an isolated local test database.',
            );
        }
        await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          [...this.ids(actor, scope), input.step].join('/'),
        ]);
        const [last] = await m.query(
          'SELECT COALESCE(max(version),0)::int AS version FROM finance_setup_versions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND step=$4',
          [...this.ids(actor, scope), input.step],
        );
        if (input.version !== last.version + 1)
          throw new ConflictException(
            'The setup version changed; refresh before preparing the next version.',
          );
        const inventory = await this.inventory(m, actor, scope),
          sourceSnapshot = this.sourceSnapshot(input, inventory);
        const subject = {
          schema: 'FINANCE_SETUP_V1',
          step: input.step,
          version: input.version,
          scope: { tenantId: actor.tenantId, ...scope },
          makerSubjectId: actor.subjectId,
          makerNaturalPersonId: actor.naturalPersonId,
          input,
          sourceSnapshot,
          sourceHash: financeConfigurationHash(sourceSnapshot),
        };
        const canonical = canonicalFinanceJson(subject),
          hash = financeConfigurationHash(subject),
          id = randomUUID();
        await m.query(
          `INSERT INTO finance_setup_versions(id,tenant_id,legal_entity_id,book_id,step,version,maker_subject_id,maker_natural_person_id,subject,canonical_subject,subject_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            id,
            ...this.ids(actor, scope),
            input.step,
            input.version,
            actor.subjectId,
            actor.naturalPersonId,
            subject,
            canonical,
            hash,
          ],
        );
        await this.event(
          m,
          actor,
          scope,
          id,
          'CREATE',
          null,
          'DRAFT',
          authority,
          reason,
        );
        return {
          id,
          subjectHash: hash,
          state: 'DRAFT',
          issues: await this.issues(m, actor, scope, input, inventory),
          financialEffects: 0,
        };
      },
    );
  }

  async isCompanyAdmin(m: EntityManager, actor: FoundationActor) {
    const [company] = await m.query(
      'SELECT company_type FROM companies WHERE id=$1',
      [actor.sourceCompanyId],
    );
    const role =
      company &&
      ADMIN_ROLE_BY_COMPANY_TYPE[company.company_type as CompanyType];
    if (!role) return false;
    return (
      (
        await m.query(
          `SELECT r.id FROM company_users cu JOIN company_user_roles cr ON cr.company_user_id::text=cu.id::text JOIN roles r ON r.id::text=cr.role_id::text WHERE cu.company_id=$1 AND cu.user_id=$2 AND cu.status='active' AND r.name=$3 AND (r.company_id::text=cu.company_id::text OR (r.company_id IS NULL AND r.scope='tenant_template'))`,
          [actor.sourceCompanyId, actor.sourceUserId, role],
        )
      ).length > 0
    );
  }

  async transition(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    hash: string,
    action: FinanceSetupAction,
    reason: string,
  ) {
    if (
      !['SUBMIT', 'REVIEW_INACTIVE', 'REJECT'].includes(action) ||
      !setupText(reason) ||
      !setupUuid(id) ||
      !setupHash(hash)
    )
      throw new BadRequestException(
        'A supported inactive decision, exact version and reason are required.',
      );
    const submit = action === 'SUBMIT';
    return this.withAccess(
      actor,
      scope,
      submit ? 'PREPARE_CONFIG' : 'REVIEW_CONFIG',
      submit
        ? FinancePermissions.SETUP_PREPARE
        : FinancePermissions.SETUP_REVIEW,
      async (m, authority) => {
        await m.query(
          'SELECT id FROM finance_setup_versions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR UPDATE',
          [...this.ids(actor, scope), id],
        );
        const row = await this.exact(m, actor, scope, id, hash),
          latest = (await this.latest(m, actor, scope)).find(
            (r) => r.step === row.step,
          );
        if (latest?.id !== id || row.state !== (submit ? 'DRAFT' : 'SUBMITTED'))
          throw new ConflictException(
            'Only the latest version in the expected state may be decided.',
          );
        const maker =
          row.maker_subject_id === actor.subjectId ||
          row.maker_natural_person_id === actor.naturalPersonId;
        if ((submit && !maker) || (!submit && maker))
          throw new ForbiddenException(
            'Preparation and independent review require different natural persons.',
          );
        if (
          !submit &&
          ['G04-01', 'G04-02', 'G04-03', 'G04-08', 'G04-10'].includes(
            row.step,
          ) &&
          !(await this.isCompanyAdmin(m, actor))
        )
          throw new ForbiddenException(
            'This setup decision requires the scoped company admin.',
          );
        const input = setupInput(row.subject.input),
          inventory = await this.inventory(m, actor, scope);
        if (action !== 'REJECT') {
          const issues = await this.issues(m, actor, scope, input, inventory);
          if (
            financeConfigurationHash(this.sourceSnapshot(input, inventory)) !==
            row.subject.sourceHash
          )
            issues.push('Source records changed after preparation.');
          if (issues.length)
            throw new ConflictException({
              code: 'FINANCE_SETUP_INCOMPLETE',
              message: 'Resolve setup evidence before submitting or reviewing.',
              issues,
            });
        }
        const state = submit
          ? 'SUBMITTED'
          : action === 'REJECT'
            ? 'REJECTED'
            : 'REVIEWED_INACTIVE';
        await this.event(
          m,
          actor,
          scope,
          id,
          action,
          row.state,
          state,
          authority,
          reason,
        );
        const policyReviewMandates =
          action === 'REVIEW_INACTIVE' && row.step === 'G04-02'
            ? await this.appointPolicyReview(
                m,
                actor,
                scope,
                input,
                id,
                hash,
                authority,
              )
            : 0;
        return {
          id,
          subjectHash: hash,
          state,
          financialEffects: 0,
          activationAuthorized: false,
          policyReviewMandates,
        };
      },
    );
  }

  /** An authenticated, independent G04-02 appointment grants review capabilities, never policy approval or activation. */
  private async appointPolicyReview(
    m: EntityManager,
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: FinanceSetupInput,
    id: string,
    hash: string,
    authorityId: string,
  ) {
    const rows = await m.query(
      `SELECT i.* FROM finance_foundation_identity_bindings i JOIN users u ON u.id::text=i.source_user_id::text JOIN company_users cu ON cu.user_id::text=u.id::text AND cu.company_id::text=i.source_company_id::text WHERE i.id=ANY($1::uuid[]) AND i.tenant_id=$2 AND i.legal_entity_id=$3 AND i.book_id=$4 AND i.source_company_id=$5 AND i.revoked_at IS NULL AND i.valid_from<=statement_timestamp() AND i.valid_to>statement_timestamp() AND u.status='active' AND cu.status='active' FOR SHARE OF i,u,cu`,
      [
        [input.answers.preparerBindingId, input.answers.reviewerBindingId],
        ...this.ids(actor, scope),
        actor.sourceCompanyId,
      ],
    );
    const preparer = rows.find(
        (r: any) => r.id === input.answers.preparerBindingId,
      ),
      reviewer = rows.find(
        (r: any) => r.id === input.answers.reviewerBindingId,
      );
    if (
      !preparer ||
      !reviewer ||
      preparer.subject_id === reviewer.subject_id ||
      preparer.natural_person_id === reviewer.natural_person_id
    )
      throw new ConflictException(
        'Current independent, bounded appointment identities are required.',
      );
    if (
      !(await this.isCompanyAdmin(m, {
        ...actor,
        sourceUserId: reviewer.source_user_id,
      }))
    )
      throw new ConflictException(
        'The selected company policy reviewer must hold the actual company-admin role.',
      );
    const [authority] = await m.query(
      'SELECT valid_to FROM finance_configuration_authorities WHERE id=$1',
      [authorityId],
    );
    if (!authority.valid_to)
      throw new ConflictException(
        'A bounded company-admin review mandate is required.',
      );
    const expires = new Date(
      Math.min(
        Date.parse(preparer.valid_to),
        Date.parse(reviewer.valid_to),
        Date.parse(authority.valid_to),
      ),
    );
    let written = 0;
    for (const [who, capability, role] of [
      [preparer, 'PREPARE', 'FINANCE_POLICY_PREPARER'],
      [reviewer, 'VALIDATE', 'COMPANY_ADMIN'],
      [reviewer, 'APPROVE', 'COMPANY_ADMIN'],
    ] as const) {
      const existing = await m.query(
        `SELECT id,company_role,valid_to FROM finance_policy_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND capability=$6 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE`,
        [
          ...this.ids(actor, scope),
          who.subject_id,
          who.natural_person_id,
          capability,
        ],
      );
      if (existing.length) {
        if (
          existing.length !== 1 ||
          existing[0].company_role !== role ||
          !existing[0].valid_to ||
          Date.parse(existing[0].valid_to) > expires.getTime()
        )
          throw new ConflictException(
            'Existing policy remit must be explicitly reconciled before the appointment changes.',
          );
        continue;
      }
      await m.query(
        `INSERT INTO finance_policy_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,company_role,capability,authority_reference,valid_from,valid_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,statement_timestamp(),$9)`,
        [
          ...this.ids(actor, scope),
          who.subject_id,
          who.natural_person_id,
          role,
          capability,
          (input.purpose === 'DEMONSTRATION' ? 'DEMONSTRATION-' : '') +
            'G04-02:' +
            id +
            ':' +
            hash,
          expires,
        ],
      );
      written++;
    }
    return written;
  }

  private async event(
    m: EntityManager,
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    action: string,
    fromState: FinanceSetupState | null,
    toState: FinanceSetupState,
    authorityId: string,
    reason: string,
  ) {
    const [previous] = await m.query(
      'SELECT sequence,event_hash FROM finance_setup_events WHERE version_id=$1 ORDER BY sequence DESC LIMIT 1',
      [id],
    );
    const event = {
      versionId: id,
      sequence: (previous?.sequence ?? 0) + 1,
      action,
      fromState,
      toState,
      actorSubjectId: actor.subjectId,
      actorNaturalPersonId: actor.naturalPersonId,
      identityBindingId: actor.identityBindingId!,
      authorityId,
      reason,
      previousHash: previous?.event_hash ?? null,
    };
    await m.query(
      `INSERT INTO finance_setup_events(tenant_id,legal_entity_id,book_id,version_id,sequence,action,from_state,to_state,actor_subject_id,actor_natural_person_id,identity_binding_id,authority_id,reason,previous_hash,event_subject,canonical_event,event_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        ...this.ids(actor, scope),
        id,
        event.sequence,
        action,
        fromState,
        toState,
        actor.subjectId,
        actor.naturalPersonId,
        actor.identityBindingId,
        authorityId,
        reason,
        event.previousHash,
        event,
        canonicalFinanceJson(event),
        financeConfigurationHash(event),
      ],
    );
  }
}
