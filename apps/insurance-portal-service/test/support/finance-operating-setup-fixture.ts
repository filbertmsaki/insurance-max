import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { FINANCE_DOCUMENT_TYPES } from '@insurance-max/contracts';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
} from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import { FINANCE_SETUP_STEPS } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup.types';
import { releaseBook } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-operating-book';

/** Synthetic reviewed inputs exercise the operating handoff. Native preparation and reviews have separate ledger suites. */
export async function activateOperatingFixture(
  m: EntityManager,
  company: string,
  customer: string,
) {
  const ids = [randomUUID(), randomUUID(), randomUUID()],
    maker = randomUUID(),
    checker = randomUUID();
  const scope = { tenantId: ids[0], legalEntityId: ids[1], bookId: ids[2] };
  const actor = {
    kind: 'USER' as const,
    tenantId: ids[0],
    subjectId: checker,
    naturalPersonId: checker,
    sourceCompanyId: company,
  };
  await m.query(
    "INSERT INTO finance_legal_entities(tenant_id,id,entity_code,legal_name,business_profile,jurisdiction_code) VALUES($1,$2,'FX','Finance fixture','GENERAL_INSURER','TZ')",
    ids.slice(0, 2),
  );
  await m.query(
    "INSERT INTO finance_accounting_books(tenant_id,legal_entity_id,id,book_code) VALUES($1,$2,$3,'PRIMARY')",
    ids,
  );
  async function authority(person: string, config: string, capability: string) {
    const [c] = await m.query(
      `INSERT INTO finance_configuration_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from)
      VALUES($1,$2,$3,$4,$4,$5,'ENABLED','Fixture',now()-interval '1 day') RETURNING id`,
      [...ids, person, config],
    );
    const [b] = await m.query(
      `INSERT INTO finance_foundation_identity_bindings(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,source_company_id,source_user_id,authority_reference,valid_from)
      VALUES($1,$2,$3,$4,$4,$5,$4,'Fixture',now()-interval '1 day') RETURNING id`,
      [...ids, person, company],
    );
    const [f] = await m.query(
      `INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,capability,company_role,authority_reference,limits,valid_from)
      VALUES($1,$2,$3,$4,$4,$5,'COMPANY_ADMIN','Fixture','{}',now()-interval '1 day') RETURNING id`,
      [...ids, person, capability],
    );
    return { authority: c.id, identity: b.id, foundation: f.id };
  }
  const prepare = await authority(maker, 'PREPARE_CONFIG', 'PREPARE'),
    review = await authority(checker, 'REVIEW_CONFIG', 'RELEASE');
  const [reviewer] = await m.query(
    `INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,capability,company_role,authority_reference,limits,valid_from)
    VALUES($1,$2,$3,$4,$4,'REVIEW','COMPANY_ADMIN','Fixture','{}',now()-interval '1 day') RETURNING id`,
    [...ids, checker],
  );
  const [{ today, until }] = await m.query(
    'SELECT current_date::text today,(current_date+30)::text until',
  );
  const [source] = await m.query(
    'SELECT company,tz FROM finance_company_setup_sources WHERE id=$1',
    [company],
  );
  const account = randomUUID(),
    basis = {
      bookRole: 'PRIMARY',
      accountingBasis: 'IFRS',
      functionalCurrency: 'TZS',
      transactionCurrencies: ['TZS'],
      presentationCurrencies: ['TZS'],
      currencyScales: { TZS: 2 },
      maximumRateAgeDays: 1,
      rateSources: ['BANK'],
      roundingMode: 'REJECT_IMBALANCED',
    };
  const chart = {
    chartReleaseId: account,
    chartReleaseHash: '1'.repeat(64),
    dimensionReleaseId: randomUUID(),
    dimensionReleaseHash: '2'.repeat(64),
  };
  const settings = {
    configurationPins: [],
    numbering: FINANCE_DOCUMENT_TYPES.map((documentType, i) => ({
      documentType,
      prefix: 'D' + i,
      width: 4,
      reset: 'LIFETIME',
    })),
    paymentTerms: [
      { party: 'CUSTOMER', code: 'D7', days: 7, isDefault: true },
      { party: 'CUSTOMER', code: 'D14', days: 14, isDefault: false },
      { party: 'SUPPLIER', code: 'D30', days: 30, isDefault: true },
    ],
    termAssignments: [
      { party: 'CUSTOMER', partyId: customer, termCode: 'D14' },
    ],
    paymentMethods: [
      {
        method: 'CASH',
        direction: 'BOTH',
        accountCode: '1111',
        referenceRequired: false,
      },
    ],
    approvalLimits: [
      'REFUND',
      'COMMISSION_PAYMENT',
      'COMMISSION_ACCRUAL',
      'RECONCILIATION',
    ].map((action) => ({
      action,
      role: 'finance-checker',
      currency: 'TZS',
      maximum: '1000.00',
    })),
  };
  const answers: Record<string, object> = {
    'G04-01': { jurisdictionCode: 'TZ', productIds: [] },
    'G04-03': basis,
    'G04-05': { populationEvidenceHash: hash('opening') },
    'G04-04': {
      timezone: 'Africa/Dar_es_Salaam',
      periods: [{ code: 'M1', from: today, to: until }],
    },
    'G04-06': chart,
    'G04-07': settings,
    'G04-08': { policyDecisions: [] },
  };
  const rows: {
    id: string;
    step: string;
    subject_hash: string;
    subject: Record<string, any>;
  }[] = [];
  for (const [step] of FINANCE_SETUP_STEPS) {
    const snapshot =
      step === 'G04-01'
        ? { company: source.company, tanzaniaSource: source.tz, products: [] }
        : {};
    const input = {
      step,
      purpose: 'COMPANY_SETUP',
      version: 1,
      effectiveFrom: today,
      effectiveTo: until,
      answers: answers[step] ?? {},
      evidence: [],
      dependencies: rows.map((r) => ({ id: r.id, hash: r.subject_hash })),
    };
    const subject = {
      schema: 'FINANCE_SETUP_V1',
      step,
      version: 1,
      scope,
      makerSubjectId: maker,
      makerNaturalPersonId: maker,
      input,
      sourceSnapshot: snapshot,
      sourceHash: hash(snapshot),
    };
    const [row] = await m.query(
      `INSERT INTO finance_setup_versions(tenant_id,legal_entity_id,book_id,step,version,maker_subject_id,maker_natural_person_id,subject,canonical_subject,subject_hash)
      VALUES($1,$2,$3,$4,1,$5,$5,$6,$7,$8) RETURNING id`,
      [
        ...ids,
        step,
        maker,
        subject,
        canonicalFinanceJson(subject),
        hash(subject),
      ],
    );
    let previousHash: string | null = null,
      fromState: string | null = null,
      sequence = 0;
    for (const [action, toState] of [
      ['CREATE', 'DRAFT'],
      ['SUBMIT', 'SUBMITTED'],
      ['REVIEW_INACTIVE', 'REVIEWED_INACTIVE'],
    ]) {
      const person = action === 'REVIEW_INACTIVE' ? checker : maker,
        mandate = action === 'REVIEW_INACTIVE' ? review : prepare;
      const e = {
        versionId: row.id,
        sequence: ++sequence,
        action,
        fromState,
        toState,
        actorSubjectId: person,
        actorNaturalPersonId: person,
        identityBindingId: mandate.identity,
        authorityId: mandate.authority,
        reason: 'Fixture',
        previousHash,
      };
      await m.query(
        `INSERT INTO finance_setup_events(tenant_id,legal_entity_id,book_id,version_id,sequence,action,from_state,to_state,actor_subject_id,actor_natural_person_id,identity_binding_id,authority_id,reason,previous_hash,event_subject,canonical_event,event_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,'Fixture',$12,$13,$14,$15)`,
        [
          ...ids,
          row.id,
          sequence,
          action,
          fromState,
          toState,
          person,
          mandate.identity,
          mandate.authority,
          previousHash,
          e,
          canonicalFinanceJson(e),
          hash(e),
        ],
      );
      previousHash = hash(e);
      fromState = toState;
    }
    rows.push({ id: row.id, step, subject_hash: hash(subject), subject });
  }
  async function doc(
    kind: string,
    mode: string,
    payload: Record<string, unknown>,
    parent: string | null,
  ) {
    const h = hash(payload);
    const [d] = await m.query(
      `INSERT INTO finance_foundation_documents(tenant_id,legal_entity_id,book_id,kind,mode,document_key,version,parent_id,payload,subject_hash,maker_subject_id,maker_natural_person_id,authority_id)
      VALUES($1,$2,$3,$4,$5,$4,1,$6,$7,$8,$9,$9,$10) RETURNING id`,
      [...ids, kind, mode, parent, payload, h, maker, prepare.foundation],
    );
    await m.query(
      `INSERT INTO finance_foundation_decisions(tenant_id,legal_entity_id,book_id,document_id,state,subject_hash,actor_subject_id,actor_natural_person_id,authority_id,evidence_hash,reason,decision_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$6,'Fixture',$6)`,
      [
        ...ids,
        d.id,
        kind === 'RELEASE' ? 'APPROVED' : 'REVIEWED',
        h,
        checker,
        kind === 'RELEASE' ? review.foundation : reviewer.id,
      ],
    );
    return { id: d.id, hash: h };
  }
  const context = await doc(
    'CURRENCY_CONTEXT',
    'VALIDATION',
    {
      ...basis,
      ...chart,
      basis: 'IFRS',
      maxRateAgeDays: 1,
      policyPins: [],
      allowedComponents: [],
    },
    null,
  );
  const opening = await doc(
    'OPENING',
    'LIVE',
    {
      date: today,
      contextHash: context.hash,
      sourceEvidenceHash: hash('opening'),
    },
    context.id,
  );
  const release = await doc(
    'RELEASE',
    'LIVE',
    {
      activeFrom: today,
      activeTo: until,
      sourceCompanyId: company,
      contextHash: context.hash,
      openingId: opening.id,
      openingHash: opening.hash,
      sourceReconciliationHash: hash('opening'),
    },
    context.id,
  );
  const final = rows.at(-1)!;
  const activation = await releaseBook(m, actor, ids, review.foundation, rows, {
    setupId: final.id,
    setupHash: final.subject_hash,
    releaseId: release.id,
    releaseHash: release.hash,
    reason: 'Open fixture book',
  });
  return { ids, actor, activation, today };
}
