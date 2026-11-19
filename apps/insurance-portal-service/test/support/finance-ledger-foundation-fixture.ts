import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { FinancePolicyGovernance1797100000000 } from '../../src/database/migrations/1797100000000-FinancePolicyGovernance';
import { FinanceLedgerFoundation1797200000000 } from '../../src/database/migrations/1797200000000-FinanceLedgerFoundation';
import {
  FinanceLedgerFoundationService,
  FoundationActor,
} from '../../src/modules/tenant/finance/accounting/general-ledger/finance-ledger-foundation.service';
import {
  CurrencyContextInput,
  FoundationAcceptInput,
  FOUNDATION_CHECKS,
  currencyContextPolicyHash,
} from '../../src/modules/tenant/finance/accounting/general-ledger/finance-ledger-foundation.types';
import { FinancePolicyService } from '../../src/modules/tenant/finance/governance/accounting-policies/finance-policy.service';
import { createCandidateFixture } from './finance-candidate-fixture';
import { createIntegrationFixture } from './finance-integration-fixture';
import { withFinanceTestDatabase } from './finance-test-database';
import { readAiclFin01Demonstration } from '../../src/database/seeds/data/aicl-fin-01-reader';
import { AICL_UAT_CHART } from './aicl-uat-baseline';
export const FOUNDATION_TEST_HASH = 'a'.repeat(64);
export async function withFoundationDatabase<T>(
  work: (f: Awaited<ReturnType<typeof createFoundationFixture>>) => Promise<T>,
  options: {
    signed?: boolean;
    policies?: boolean;
    functional?: 'TZS' | 'USD';
    unresolved?: string[];
    aiclBookCode?: string;
    aiclBasis?: 'IFRS' | 'STATUTORY' | 'OPERATIONAL_BRIDGE';
    chartEffectiveTo?: string;
    contextEffectiveTo?: string;
    guideUat?: boolean;
  } = {},
) {
  return withFinanceTestDatabase(
    async ({ dataSource: s }) => {
      const q = s.createQueryRunner();
      try {
        await new FinancePolicyGovernance1797100000000().up(q);
        await new FinanceLedgerFoundation1797200000000().up(q);
      } finally {
        await q.release();
      }
      return work(await createFoundationFixture(s, options));
    },
    process.env,
    options.signed ? 'integration-reliability' : 'journal-candidates',
  );
}
async function createFoundationFixture(
  s: DataSource,
  options: {
    signed?: boolean;
    policies?: boolean;
    functional?: 'TZS' | 'USD';
    unresolved?: string[];
    aiclBookCode?: string;
    aiclBasis?: 'IFRS' | 'STATUTORY' | 'OPERATIONAL_BRIDGE';
    chartEffectiveTo?: string;
    contextEffectiveTo?: string;
    guideUat?: boolean;
  },
) {
  const integration = options.signed
    ? await createIntegrationFixture(s, {
        eventContract: {
          eventType: 'source.payment.confirmed.v1',
          aggregateType: 'PAYMENT',
          factKind: 'CONFIRMED_RECEIPT',
        },
      })
    : null;
  const f = await createCandidateFixture(s, {
      ...(integration ? { base: integration } : {}),
      aiclBookCode: options.aiclBookCode,
      chartEffectiveTo: options.chartEffectiveTo,
      guideUat: options.guideUat,
    }),
    ledger = new FinanceLedgerFoundationService(s),
    policy = new FinancePolicyService(s);
  const actor = (): FoundationActor => ({
    kind: 'USER',
    tenantId: f.tenantId,
    subjectId: randomUUID(),
    naturalPersonId: randomUUID(),
  });
  const admin = actor(),
    alias = { ...f.maker, subjectId: randomUUID() },
    companyId = integration?.companyId ?? randomUUID();
  const grant = async (
    who: FoundationActor,
    capability: string,
    role = 'FINANCE_OPERATOR',
    bookId = f.scope.bookId,
  ) => {
    const [a] = await s.query(
      "INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,capability,company_role,authority_reference,valid_from,limits) VALUES($1,$2,$3,$4,$5,$6,$7,'SYNTHETIC-ONLY-NOT-A-REAL-MANDATE','2020-01-01',$8) RETURNING id",
      [
        f.tenantId,
        f.entity.id,
        bookId,
        who.subjectId,
        who.naturalPersonId,
        capability,
        role,
        capability === 'ACCEPT'
          ? { USD: '1000000', ...(options.guideUat ? { TZS: '1000000' } : {}) }
          : {},
      ],
    );
    return a.id as string;
  };
  for (const who of [f.maker, f.checker, alias])
    for (const capability of ['PREPARE', 'REVIEW', 'ACCEPT', 'READ'])
      await grant(who, capability);
  await grant(admin, 'RELEASE', 'COMPANY_ADMIN');
  await grant(admin, 'READ', 'COMPANY_ADMIN');
  const [{ today }] = await s.query(
    'SELECT statement_timestamp()::date::text today',
  );
  const config: CurrencyContextInput = {
    schema: 'FINANCE_CURRENCY_CONTEXT_V1',
    version: 1,
    sourceCompanyId: companyId,
    basis: options.aiclBasis ?? 'IFRS',
    functionalCurrency: options.functional ?? 'TZS',
    presentationCurrencies: ['TZS', 'USD'],
    currencyScales: { TZS: 2, USD: 3 },
    effectiveFrom: '2026-01-01',
    effectiveTo: options.contextEffectiveTo ?? null,
    rateSources: ['SYNTHETIC'],
    maxRateAgeDays: 1,
    roundingMode: 'REJECT_IMBALANCED',
    chartReleaseId: f.chart.id,
    chartReleaseHash: f.chart.release_hash,
    policyPins: [],
    unresolvedDecisions:
      options.unresolved ?? (options.policies ? [] : ['DEC-05']),
    allowedComponents: [
      {
        origin: integration ? 'SYNTHETIC_PORTAL' : 'SYNTHETIC',
        component: 'CASH',
        owner: 'FINANCE',
        policyCode: 'AP-08.01',
        effect: 'CASH',
        sourceEventType: integration ? 'source.payment.confirmed.v1' : null,
        factKind: integration ? 'CONFIRMED_RECEIPT' : null,
        sourceMapping: integration
          ? {
              amountPath: '/amount',
              currencyPath: '/currency',
              datePath: '/transactionDate',
              companyPath: '/companyId',
              aggregatePath: '/sourceId',
            }
          : null,
        debitRoles: ['BANK'],
        creditRoles: ['CLEARING'],
      },
    ],
    assessmentReference:
      'PRIVATE SYNTHETIC functional assessment; no customer policy election',
    assessmentEvidenceHash: FOUNDATION_TEST_HASH,
  };
  if (options.policies) {
    const ps = { tenantId: f.tenantId, ...f.scope };
    for (const [who, capability, role] of [
      [f.maker, 'PREPARE', 'FINANCE_POLICY_PREPARER'],
      [f.checker, 'VALIDATE', 'FINANCE_POLICY_VALIDATOR'],
      [admin, 'APPROVE', 'COMPANY_ADMIN'],
      [admin, 'ACTIVATE', 'COMPANY_ADMIN'],
    ] as const)
      await s.query(
        "INSERT INTO finance_policy_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,company_role,capability,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,$7,'SYNTHETIC-POLICY-TEST-ONLY','2020-01-01')",
        [
          f.tenantId,
          f.entity.id,
          f.scope.bookId,
          who.subjectId,
          who.naturalPersonId,
          role,
          capability,
        ],
      );
    for (const code of [
      'AP-01.01',
      'AP-02.01',
      'AP-03.01',
      'AP-04.01',
      'AP-04.02',
      'AP-05.01',
      'AP-06.01',
      'AP-06.02',
      'AP-33.01',
      'AP-20.04',
      'AP-20.01',
      'AP-31.01',
      'AP-32.01',
      'AP-08.01',
    ]) {
      const p = await policy.prepare(ps, f.maker, {
        schema: 'FINANCE_POLICY_V1',
        policyCode: code,
        version: 1,
        profile: 'INSURER',
        description: 'Synthetic policy for isolated acceptance tests',
        treatment:
          'No real insurer or company treatment is approved by this fixture.',
        accountingLayer: 'CONTROL',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        configuration: {
          currencyContextHash: currencyContextPolicyHash(config),
          businessProfile: f.entity.business_profile,
        },
        decisionReferences: [],
        unresolvedDecisions: [],
        dependencyPolicyHashes: [],
        evidenceReferences: ['PRIVATE-SYNTHETIC-ONLY'],
      });
      await policy.transition(
        ps,
        f.maker,
        p.id,
        p.definitionHash,
        'CONFIGURE',
        FOUNDATION_TEST_HASH,
        'Synthetic configuration only',
      );
      await policy.transition(
        ps,
        f.checker,
        p.id,
        p.definitionHash,
        'VALIDATE',
        FOUNDATION_TEST_HASH,
        'Synthetic independent validation only',
      );
      await policy.transition(
        ps,
        admin,
        p.id,
        p.definitionHash,
        'APPROVE',
        FOUNDATION_TEST_HASH,
        'Synthetic company-admin decision only',
      );
      config.policyPins.push({ id: p.id, hash: p.definitionHash });
    }
  }
  const context = await ledger.prepareCurrencyContext(
    f.maker,
    f.scope,
    config,
    'Synthetic context preparation',
  );
  await ledger.reviewDocument(
    f.checker,
    f.scope,
    context.id,
    context.subjectHash,
    'REVIEWED',
    FOUNDATION_TEST_HASH,
    'Synthetic independent context review',
  );
  const rate =
    config.functionalCurrency === 'USD'
      ? null
      : await ledger.prepareRate(
          f.maker,
          f.scope,
          {
            contextId: context.id,
            contextHash: context.subjectHash,
            transactionCurrency: 'USD',
            rate: '2500',
            rateDate: today,
            validTo: options.contextEffectiveTo ?? '2027-01-01',
            source: 'SYNTHETIC',
            sourceReference: 'NOT A MARKET RATE; test only',
            evidenceHash: FOUNDATION_TEST_HASH,
          },
          1,
          'Synthetic rate preparation',
        );
  if (rate)
    await ledger.reviewDocument(
      f.checker,
      f.scope,
      rate.id,
      rate.subjectHash,
      'REVIEWED',
      FOUNDATION_TEST_HASH,
      'Synthetic independent rate review',
    );
  const period = await ledger.createPeriod(
    f.checker,
    f.scope,
    {
      code: 'VALIDATION-NOV',
      mode: 'VALIDATION',
      from: '2026-11-01',
      to: '2026-12-01',
    },
    FOUNDATION_TEST_HASH,
    'Synthetic validation period',
  );
  const balances = options.guideUat
    ? AICL_UAT_CHART.map(([accountCode, , , signedBalance]) => ({
        accountCode,
        signedBalance,
      }))
    : options.aiclBookCode
      ? (() => {
          const proposal = readAiclFin01Demonstration();
          return proposal.chartProposal
            .filter(
              ([, , type]) => type !== 'HEADER' && type !== 'REPORTING_MAPPING',
            )
            .map(([accountCode]) => {
              const line = proposal.openingProposal.lines.find(
                (value) => value.account === accountCode,
              );
              return {
                accountCode,
                signedBalance: line
                  ? (BigInt(line.debit) - BigInt(line.credit)).toString()
                  : '0',
              };
            });
        })()
      : [
          { accountCode: '110110', signedBalance: '0' },
          { accountCode: '210110', signedBalance: '0' },
        ];
  const opening = await ledger.prepareOpening(
    f.maker,
    f.scope,
    {
      contextId: context.id,
      contextHash: context.subjectHash,
      mode: 'VALIDATION',
      date: '2026-11-01',
      balances,
      sourceReference: options.guideUat
        ? 'Synthetic guide opening; not company financial records'
        : 'Explicit complete synthetic zero opening',
      sourceEvidenceHash: FOUNDATION_TEST_HASH,
      explicitZeroReason: options.guideUat
        ? null
        : 'Owned empty test population; not a company opening balance',
    },
    1,
    'Synthetic opening preparation',
  );
  await ledger.reviewDocument(
    f.checker,
    f.scope,
    opening.id,
    opening.subjectHash,
    'REVIEWED',
    FOUNDATION_TEST_HASH,
    'Synthetic independent opening certification',
  );
  const prepare = async (
    options: {
      date?: string;
      sourceId?: string;
      amount?: string;
      revision?: string;
    } = {},
  ) => {
    const p = f.input();
    p.accountingDate = options.date ?? today;
    p.economicOrigin = config.allowedComponents[0].origin;
    p.economicSourceId = options.sourceId ?? 'foundation-source';
    p.sourceRevision = options.revision ?? '1';
    if (options.amount) {
      p.lines[0].debit = options.amount;
      p.lines[1].credit = options.amount;
    }
    return f.validate(await f.prepare(p));
  };
  const input = (
    candidate: { id: string; subject_hash: string },
    mode: 'VALIDATION' | 'LIVE' = 'VALIDATION',
  ): FoundationAcceptInput => ({
    candidateId: candidate.id,
    candidateHash: candidate.subject_hash,
    contextId: context.id,
    contextHash: context.subjectHash,
    mode,
    rateId: rate?.id ?? null,
    rateHash: rate?.subjectHash ?? null,
    transactionDate: today,
    source: {
      kind: 'MANUAL',
      reference: 'Independent synthetic source approval',
      evidenceHash: FOUNDATION_TEST_HASH,
    },
  });
  const accept = (
    candidate: { id: string; subject_hash: string },
    mode: 'VALIDATION' | 'LIVE' = 'VALIDATION',
  ) =>
    ledger.acceptCandidate(
      f.checker,
      f.scope,
      input(candidate, mode),
      'Synthetic explicit ledger acceptance',
    );
  const report = () =>
    ledger.trialBalance(f.checker, f.scope, {
      mode: 'VALIDATION',
      openingId: opening.id,
      openingHash: opening.subjectHash,
      from: '2026-11-01',
      to: '2026-12-01',
    });
  const acceptance = async () => {
    const a = await ledger.prepareAcceptance(
      f.maker,
      f.scope,
      {
        contextId: context.id,
        contextHash: context.subjectHash,
        openingId: opening.id,
        openingHash: opening.subjectHash,
        from: '2026-11-01',
        to: '2026-12-01',
        checks: FOUNDATION_CHECKS.map((code) => ({
          code,
          evidenceHash: FOUNDATION_TEST_HASH,
          reference: 'Synthetic test manifest ' + code,
        })),
        compatibilityEvidenceHash: FOUNDATION_TEST_HASH,
        historicalProtectionHash: FOUNDATION_TEST_HASH,
        scopeReference: 'Owned test DB only; not production acceptance',
      },
      1,
      'Synthetic technical manifest',
    );
    await ledger.reviewDocument(
      f.checker,
      f.scope,
      a.id,
      a.subjectHash,
      'REVIEWED',
      FOUNDATION_TEST_HASH,
      'Synthetic independent B45 review',
    );
    return a;
  };
  const release = async () => {
    const a = await acceptance(),
      liveOpening = await ledger.prepareOpening(
        f.maker,
        f.scope,
        {
          contextId: context.id,
          contextHash: context.subjectHash,
          mode: 'LIVE',
          date: today,
          balances,
          sourceReference: 'Synthetic reconciled cutover',
          sourceEvidenceHash: FOUNDATION_TEST_HASH,
          explicitZeroReason:
            'Empty owned test population, not company financial balances',
        },
        1,
        'Synthetic live-mode certificate preparation',
      );
    await ledger.reviewDocument(
      f.checker,
      f.scope,
      liveOpening.id,
      liveOpening.subjectHash,
      'REVIEWED',
      FOUNDATION_TEST_HASH,
      'Synthetic independent cutover certification',
    );
    const r = await ledger.prepareRelease(
      f.maker,
      f.scope,
      {
        contextId: context.id,
        contextHash: context.subjectHash,
        acceptanceId: a.id,
        acceptanceHash: a.subjectHash,
        activeFrom: today,
        activeTo: '2026-12-01',
        sourceReconciliationHash: FOUNDATION_TEST_HASH,
        openingId: liveOpening.id,
        openingHash: liveOpening.subjectHash,
        historicalProtectionHash: FOUNDATION_TEST_HASH,
        authorityReference:
          'PRIVATE-SYNTHETIC-RELEASE-NOT-A-COMPANY-AUTHORIZATION',
      },
      1,
      'Synthetic release preparation',
    );
    await ledger.reviewDocument(
      admin,
      f.scope,
      r.id,
      r.subjectHash,
      'APPROVED',
      FOUNDATION_TEST_HASH,
      'Synthetic explicit company-admin release approval',
    );
    return { a, r, liveOpening };
  };
  const enable = async () => {
    const { a, r, liveOpening } = await release();
    for (const p of config.policyPins)
      await policy.transition(
        { tenantId: f.tenantId, ...f.scope },
        admin,
        p.id,
        p.hash,
        'ACTIVATE',
        a.subjectHash,
        'EXPLICIT SYNTHETIC company-admin activation in disposable test DB only',
      );
    await ledger.deployment(
      admin,
      f.scope,
      r.id,
      r.subjectHash,
      'ENABLE',
      'Explicit synthetic enable after policy approval',
    );
    await ledger.createPeriod(
      admin,
      f.scope,
      { code: 'LIVE-NOV', mode: 'LIVE', from: today, to: '2026-12-01' },
      FOUNDATION_TEST_HASH,
      'Synthetic independently authorized live-mode period',
    );
    return { a, r, liveOpening };
  };
  const bind = async (who: FoundationActor, userId = randomUUID()) => {
    const [b] = await s.query(
      "INSERT INTO finance_foundation_identity_bindings(source_company_id,source_user_id,tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,$7,'SYNTHETIC-IDENTITY-ONLY','2020-01-01') RETURNING id",
      [
        companyId,
        userId,
        f.tenantId,
        f.entity.id,
        f.scope.bookId,
        who.subjectId,
        who.naturalPersonId,
      ],
    );
    return { id: b.id, userId, companyId };
  };
  return {
    ...f,
    chartConfiguration: f.config,
    source: s,
    ledger,
    policy,
    config,
    context,
    rate,
    ledgerPeriod: period,
    opening,
    balances,
    admin,
    alias,
    companyId,
    today,
    ledgerGrant: grant,
    prepareLedger: prepare,
    ledgerInput: input,
    acceptLedger: accept,
    reportLedger: report,
    technicalAcceptance: acceptance,
    prepareLedgerRelease: release,
    enableLedger: enable,
    bind,
    integration,
  };
}
