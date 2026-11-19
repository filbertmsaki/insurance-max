import { randomUUID } from 'node:crypto';
import { FinanceApprovalService } from '../../src/modules/tenant/finance/governance/finance-approvals/finance-approval.service';
import type {
  ApprovalToken,
  BeneficiaryEvidence,
} from '../../src/modules/tenant/finance/governance/finance-approvals/finance-approval.types';
import { DataSource } from 'typeorm';
import { FinanceLegalEntity } from '../../src/modules/tenant/finance/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/finance/foundation/entities/finance-accounting-book.entity';
import { FinanceConfigurationAuthority } from '../../src/modules/tenant/finance/foundation/entities/finance-configuration-authority.entity';
import { FinanceConfigurationService } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.service';
import { FinanceJournalCandidateService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal-candidate.service';
import { type FinanceConfigurationActor } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import type { JournalCandidateInput } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal-candidate.types';
import { readAiclFin01Demonstration } from '../../src/database/seeds/data/aicl-fin-01-reader';
import { AICL_UAT_CHART } from './aicl-uat-baseline';

export async function createCandidateFixture(
  source: DataSource,
  options: {
    quorum?: number;
    ttlSeconds?: number;
    aiclBookCode?: string;
    chartEffectiveTo?: string;
    guideUat?: boolean;
    base?: {
      tenantId: string;
      entity: FinanceLegalEntity;
      books: FinanceAccountingBook[];
      maker: FinanceConfigurationActor;
      checker: FinanceConfigurationActor;
    };
  } = {},
) {
  const tenantId = options.base?.tenantId ?? randomUUID();
  const entity =
    options.base?.entity ??
    (await source.getRepository(FinanceLegalEntity).save({
      tenant_id: tenantId,
      entity_code: 'CANDIDATE',
      legal_name: 'Synthetic candidate entity',
      business_profile: 'GENERAL_INSURER',
    }));
  const books =
    options.base?.books ??
    (await source.getRepository(FinanceAccountingBook).save(
      [options.aiclBookCode ?? 'A', 'B'].map((book_code) => ({
        tenant_id: tenantId,
        legal_entity_id: entity.id,
        book_code,
      })),
    ));
  const scope = { legalEntityId: entity.id, bookId: books[0].id };
  const actor = (): FinanceConfigurationActor => ({
    kind: 'USER',
    tenantId,
    subjectId: randomUUID(),
    naturalPersonId: randomUUID(),
  });
  const maker = options.base?.maker ?? actor(),
    checker = options.base?.checker ?? actor(),
    controller = actor();
  const grant = async (
    who: FinanceConfigurationActor,
    permission: string,
    bookId = scope.bookId,
  ) => {
    const [row] = await source.query(
      `INSERT INTO finance_journal_candidate_authorities (tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from) VALUES ($1,$2,$3,$4,$5,$6,'ENABLED','SYNTHETIC-TEST-ONLY','2020-01-01') RETURNING *`,
      [
        tenantId,
        entity.id,
        bookId,
        who.subjectId,
        who.naturalPersonId,
        permission,
      ],
    );
    return row;
  };
  await grant(maker, 'PREPARE_CANDIDATE');
  await grant(checker, 'VALIDATE_CANDIDATE');
  await grant(controller, 'MANAGE_DRAFT_PERIOD');
  if (!options.base)
    await source.getRepository(FinanceConfigurationAuthority).save(
      [
        { who: maker, permission: 'PREPARE_CONFIG' as const },
        { who: checker, permission: 'REVIEW_CONFIG' as const },
      ].map(({ who, permission }) => ({
        tenant_id: tenantId,
        legal_entity_id: entity.id,
        book_id: scope.bookId,
        subject_id: who.subjectId,
        natural_person_id: who.naturalPersonId,
        permission,
        state: 'ENABLED' as const,
        authority_reference: 'SYNTHETIC-CHART-ONLY',
        valid_from: new Date('2020-01-01Z'),
      })),
    );
  const config = new FinanceConfigurationService(source);
  const draft = await config.createDraft(
    maker,
    scope,
    {
      kind: 'ACCOUNT_ROLES',
      key: 'TEST',
      version: 1,
      effectiveFrom: '2026-01-01',
      effectiveTo: options.chartEffectiveTo ?? null,
      dependencyRefs: ['DEC-01', 'DEC-05', 'DEC-06', 'DEC-12'],
      payload: {
        schema: 'FINANCE_CHART_V1',
        chartCode: 'TEST',
        supportedProfiles: ['GENERAL_INSURER'],
        accounts: options.guideUat
          ? AICL_UAT_CHART.map(([code, name, type]) => ({
              code,
              name: 'UAT DEMO ' + name,
              type,
              normalBalance: ['ASSET', 'EXPENSE'].includes(type) ? 'DR' : 'CR',
              posting: true,
              control: false,
              parentCode: null,
            }))
          : options.aiclBookCode
            ? readAiclFin01Demonstration()
                .chartProposal.filter(
                  ([, , type]) =>
                    type !== 'HEADER' && type !== 'REPORTING_MAPPING',
                )
                .map(([code, name, type]) => ({
                  code,
                  name: 'DEMO ' + name,
                  type,
                  normalBalance: ['ASSET', 'EXPENSE'].includes(type)
                    ? 'DR'
                    : 'CR',
                  posting: true,
                  control: false,
                  parentCode: null,
                }))
            : [
                {
                  code: '110110',
                  name: 'Synthetic asset',
                  type: 'ASSET',
                  normalBalance: 'DR',
                  posting: true,
                  control: false,
                  parentCode: null,
                },
                {
                  code: '210110',
                  name: 'Synthetic liability',
                  type: 'LIABILITY',
                  normalBalance: 'CR',
                  posting: true,
                  control: false,
                  parentCode: null,
                },
              ],
        roles: [
          {
            code: 'BANK',
            accountCode: options.guideUat
              ? '1000'
              : options.aiclBookCode
                ? '1100'
                : '110110',
            accountType: 'ASSET',
            requiredDimensions: ['CURRENCY'],
            dependencyRefs: ['DEC-05'],
          },
          {
            code: 'CLEARING',
            accountCode: options.guideUat
              ? '1100'
              : options.aiclBookCode
                ? '2300'
                : '210110',
            accountType: options.guideUat ? 'ASSET' : 'LIABILITY',
            requiredDimensions: [],
            dependencyRefs: ['DEC-01'],
          },
          {
            code: 'UNASSIGNED',
            accountCode: null,
            accountType: 'ASSET',
            requiredDimensions: [],
            dependencyRefs: ['DEC-01'],
          },
        ],
        legacy: {
          mode: 'UNBOUND',
          reason: 'Synthetic tests; actual accounts and balances unavailable',
        },
      },
    },
    'synthetic chart',
  );
  await config.submit(
    maker,
    scope,
    draft.id,
    draft.release_hash,
    'submit chart',
  );
  const chart = await config.reviewInactive(
    checker,
    scope,
    draft.id,
    draft.release_hash,
    'REVIEWED_INACTIVE',
    'inactive chart review',
  );
  const profileDraft = await config.createDraft(
    maker,
    scope,
    {
      kind: 'APPROVAL_RULES',
      key: 'SYNTHETIC-APPROVAL',
      version: 1,
      effectiveFrom: '2026-01-01',
      dependencyRefs: ['DEC-11', 'DEC-14'],
      payload: {
        schema: 'FINANCE_APPROVAL_PROFILE_V1',
        purpose: 'JOURNAL_CANDIDATE_ONLY',
        roleCode: 'SYNTHETIC_CHECKER',
        requiredCheckers: options.quorum ?? 1,
        ttlSeconds: options.ttlSeconds ?? 3600,
      },
    },
    'synthetic inactive control profile',
  );
  await config.submit(
    maker,
    scope,
    profileDraft.id,
    profileDraft.release_hash,
    'synthetic profile submission',
  );
  const profile = await config.reviewInactive(
    checker,
    scope,
    profileDraft.id,
    profileDraft.release_hash,
    'REVIEWED_INACTIVE',
    'synthetic profile review',
  );
  const approvals = new FinanceApprovalService(source);
  const mandate = async (
    who: FinanceConfigurationActor,
    overrides: Record<string, unknown> = {},
  ) => {
    const m = {
      id: randomUUID(),
      tenant_id: tenantId,
      legal_entity_id: entity.id,
      book_id: scope.bookId,
      subject_id: who.subjectId,
      natural_person_id: who.naturalPersonId,
      role_code: 'SYNTHETIC_CHECKER',
      currency: options.guideUat ? 'TZS' : 'USD',
      max_amount: '99999999999999999999999999.999999999999',
      delegated_from_id: null,
      version: 1,
      authority_reference: 'SYNTHETIC-MANDATE-ONLY',
      state: 'ENABLED',
      valid_from: new Date('2020-01-01Z'),
      valid_to: null,
      revoked_at: null,
      ...overrides,
    };
    const keys = Object.keys(m);
    const [saved] = await source.query(
      `INSERT INTO finance_approval_mandates (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
      Object.values(m),
    );
    return saved;
  };
  const checkerMandate = await mandate(checker);
  const service = new FinanceJournalCandidateService(source, approvals);
  const sealed = await service.createDraftPeriod(
    controller,
    scope,
    { code: 'TEST-2026-11', startsOn: '2026-11-01', endsBefore: '2026-12-01' },
    'draft dates only',
  );
  const period = await service.fenceDraftPeriod(
    controller,
    scope,
    sealed.id,
    sealed.revision,
    'OPEN_FOR_VALIDATION',
    'open candidate validation only',
  );
  const input = (): JournalCandidateInput => ({
    schema: 'FINANCE_JOURNAL_CANDIDATE_V1',
    periodId: period.id,
    periodRevision: period.revision,
    accountingDate: '2026-11-15',
    chartReleaseId: chart.id,
    chartReleaseHash: chart.release_hash,
    currency: 'USD',
    decimalScale: 3,
    economicOrigin: 'SYNTHETIC',
    economicSourceId: 'fixture-original',
    economicComponent: 'CASH',
    sourceRevision: '1',
    correctionOf: null,
    lines: [
      {
        lineKey: 'DR',
        roleCode: 'BANK',
        debit: '25.125',
        credit: '0',
        dimensions: { CURRENCY: 'USD' },
      },
      {
        lineKey: 'CR',
        roleCode: 'CLEARING',
        debit: '0',
        credit: '25.125',
        dimensions: {},
      },
    ],
  });
  const prepare = (p = input()) =>
    service.prepareInactive(maker, scope, p, 'synthetic candidate preparation');
  const request = (
    row: { id: string; subject_hash: string },
    beneficiary: BeneficiaryEvidence = {
      mode: 'NOT_APPLICABLE',
      reason: 'Synthetic journal-only validation without a payee',
    },
  ) =>
    approvals.requestInactive(
      maker,
      scope,
      row.id,
      row.subject_hash,
      profile.id,
      profile.release_hash,
      beneficiary,
      'freeze synthetic inactive approval',
    );
  const approve = (
    token: ApprovalToken,
    who = checker,
    mandateId = checkerMandate.id,
  ) =>
    approvals.decideInactive(
      who,
      scope,
      token,
      mandateId,
      'APPROVED_INACTIVE',
      'synthetic inactive approval',
    );
  const validate = async (row: { id: string; subject_hash: string }) => {
    const token = await request(row);
    await approve(token);
    return service.validateInactive(
      checker,
      scope,
      row.id,
      row.subject_hash,
      'synthetic candidate validation',
      token,
    );
  };
  return {
    tenantId,
    entity,
    books,
    scope,
    maker,
    checker,
    controller,
    grant,
    service,
    chart,
    period,
    input,
    prepare,
    validate,
    actor,
    config,
    profile,
    approvals,
    mandate,
    checkerMandate,
    request,
    approve,
  };
}
