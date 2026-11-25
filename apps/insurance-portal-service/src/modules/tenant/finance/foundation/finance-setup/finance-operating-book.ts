import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { FinanceJournalCandidateService } from '../../accounting/journal-entries/finance-journal-candidate.service';
import type { FoundationActor } from '../../accounting/general-ledger/finance-ledger-foundation.service';
import type { CurrencyContextInput } from '../../accounting/general-ledger/finance-ledger-foundation.types';
import { canonicalFinanceJson } from '../finance-configuration/finance-configuration.types';

type Review = {
  id: string;
  step: string;
  subject_hash: string;
  subject: Record<string, any>;
};
const releases = `FROM finance_foundation_documents d JOIN finance_foundation_decisions e
  ON e.document_id=d.id AND e.subject_hash=d.subject_hash AND e.state='APPROVED'
  WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND d.kind='RELEASE' AND d.mode='LIVE'
  AND d.payload->>'sourceCompanyId'=$4`;

export async function operatingInventory(
  m: EntityManager,
  ids: string[],
  company: string,
) {
  const [activation] = await m.query(
    `SELECT id,book_role AS "bookRole",starts_on::text AS "startsOn",ends_before::text AS "endsBefore",
    setup_id AS "setupId",release_id AS "releaseId",finance_fin01_current(id) AS current FROM finance_operating_setups
    WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND company_id=$4 AND withdrawn_at IS NULL`,
    [...ids, company],
  );
  const approvedReleases = await m.query(
    `SELECT d.id,d.subject_hash AS hash,d.version,d.payload->>'activeFrom' AS "startsOn",
    d.payload->>'activeTo' AS "endsBefore" ${releases} ORDER BY d.version DESC`,
    [...ids, company],
  );
  const [deployment] = await m.query(
    'SELECT action,release_id AS "releaseId" FROM finance_foundation_deployments WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 ORDER BY sequence DESC LIMIT 1',
    ids,
  );
  const issues: Record<string, string[]> = {};
  if (activation) {
    const [state] = await m.query(
      `SELECT finance_fin01_blocker(a.id) AS blocker,
        EXISTS(SELECT 1 FROM finance_foundation_periods p WHERE p.book_id=a.book_id AND p.mode='LIVE' AND p.period_kind='REGULAR' AND p.state='OPEN'
          AND (statement_timestamp() AT TIME ZONE a.timezone)::date >=p.starts_on AND (statement_timestamp() AT TIME ZONE a.timezone)::date<p.ends_before) AS open,
        EXISTS(SELECT 1 FROM finance_draft_periods p WHERE p.book_id=a.book_id AND p.state='OPEN_FOR_VALIDATION' AND to_jsonb(p)->>'adjustment_period_id' IS NULL AND
          (statement_timestamp() AT TIME ZONE a.timezone)::date>=p.starts_on AND (statement_timestamp() AT TIME ZONE a.timezone)::date<p.ends_before) AS candidate_open
      FROM finance_operating_setups a WHERE a.id=$1`,
      [activation.id],
    );
    if (state.blocker) {
      const [module, detail] = state.blocker.split('|');
      issues[module] = [detail];
    }
    if (!state.open)
      issues['FIN-01.07'] = ['No open regular accounting period covers today.'];
    else if (deployment?.action === 'ENABLE' && !state.candidate_open)
      issues['FIN-01.07'] = [
        'Open the journal candidate period for today to post invoices and receipts.',
      ];

    if (
      deployment?.action !== 'ENABLE' ||
      deployment.releaseId !== activation.releaseId
    )
      issues['FIN-01.14'] = [
        'The approved ledger release is not enabled for this book.',
      ];
    const blockers = Object.values(issues).flat();
    if (blockers.length) issues['FIN-01.16'] = blockers;
  }
  return {
    issues,
    activation: activation ?? null,
    approvedReleases,
    deployment: deployment ?? null,
  };
}

export function contextMatchesSetup(
  c: CurrencyContextInput,
  basis: Record<string, any>,
  chart: Record<string, any>,
) {
  const sameSet = (a: string[], b: string[]) =>
    canonicalFinanceJson([...a].sort()) === canonicalFinanceJson([...b].sort());
  return (
    c.basis === basis.accountingBasis &&
    c.functionalCurrency === basis.functionalCurrency &&
    sameSet(c.presentationCurrencies, basis.presentationCurrencies) &&
    sameSet(c.rateSources, basis.rateSources) &&
    canonicalFinanceJson(c.currencyScales) ===
      canonicalFinanceJson(basis.currencyScales) &&
    c.maxRateAgeDays === basis.maximumRateAgeDays &&
    c.roundingMode === basis.roundingMode &&
    c.chartReleaseId === chart.chartReleaseId &&
    c.chartReleaseHash === chart.chartReleaseHash
  );
}

export async function prepareAdjustmentValidation(
  m: EntityManager,
  actor: FoundationActor,
  ids: string[],
  periodId: string,
  reason: string,
) {
  const [period] = await m.query(
    `SELECT p.starts_on::text,p.ends_before::text,d.id AS validation FROM finance_foundation_periods p LEFT JOIN finance_draft_periods d ON d.adjustment_period_id=p.id
    WHERE p.tenant_id=$1 AND p.legal_entity_id=$2 AND p.book_id=$3 AND p.id=$4 AND p.mode='LIVE' AND p.period_kind='ADJUSTMENT' FOR UPDATE OF p`,
    [...ids, periodId],
  );
  if (!period)
    throw new ConflictException(
      'Select a reviewed adjustment period in this book.',
    );
  if (period.validation) return { id: period.validation };
  const candidates = new FinanceJournalCandidateService(m.connection),
    scope = { legalEntityId: ids[1], bookId: ids[2] };
  const draft = await candidates.createDraftPeriod(
    actor,
    scope,
    {
      code: 'ADJ.' + periodId.toUpperCase(),
      startsOn: period.starts_on,
      endsBefore: period.ends_before,
      adjustmentPeriodId: periodId,
    },
    reason,
    m,
  );
  return candidates.fenceDraftPeriod(
    actor,
    scope,
    draft.id,
    draft.revision,
    'OPEN_FOR_VALIDATION',
    reason,
    m,
  );
}

async function installCalendar(
  m: EntityManager,
  ids: string[],
  authority: string,
  actor: FoundationActor,
  calendar: Record<string, any>,
  hash: string,
  reason: unknown,
) {
  for (const p of calendar.periods) {
    const kind = p.kind ?? 'REGULAR';
    const [existing] = await m.query(
      `SELECT id,starts_on::text AS start,ends_before::text AS finish,period_kind
      FROM finance_foundation_periods WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND mode='LIVE' AND period_code=$4 FOR SHARE`,
      [...ids, p.code],
    );
    if (existing) {
      if (
        existing.start !== p.from ||
        existing.finish !== p.to ||
        existing.period_kind !== kind
      )
        throw new ConflictException(
          'An existing ledger period differs from the reviewed calendar.',
        );
      if (kind === 'ADJUSTMENT')
        await prepareAdjustmentValidation(
          m,
          actor,
          ids,
          existing.id,
          String(reason),
        );
      continue;
    }
    const [created] = await m.query(
      `INSERT INTO finance_foundation_periods(tenant_id,legal_entity_id,book_id,mode,period_code,starts_on,ends_before,state,revision,period_kind)
      VALUES($1,$2,$3,'LIVE',$4,$5,$6,'OPEN',1,$7) RETURNING id`,
      [...ids, p.code, p.from, p.to, kind],
    );
    await m.query(
      `INSERT INTO finance_foundation_period_events(tenant_id,legal_entity_id,book_id,period_id,revision,state,actor_subject_id,actor_natural_person_id,authority_id,reason,evidence_hash)
      VALUES($1,$2,$3,$4,1,'OPEN',$5,$6,$7,$8,$9)`,
      [
        ...ids,
        created.id,
        actor.subjectId,
        actor.naturalPersonId,
        authority,
        reason,
        hash,
      ],
    );
    if (kind === 'ADJUSTMENT')
      await prepareAdjustmentValidation(
        m,
        actor,
        ids,
        created.id,
        String(reason),
      );
  }
}

export async function releaseBook(
  m: EntityManager,
  actor: FoundationActor,
  ids: string[],
  authority: string,
  rows: Review[],
  request: Record<string, unknown>,
) {
  const byStep = Object.fromEntries(rows.map((r) => [r.step, r]));
  const answers = (step: string) => byStep[step].subject.input.answers;
  const basis = answers('G04-03'),
    calendar = answers('G04-04'),
    chart = answers('G04-06'),
    settings = answers('G04-07');
  const [release] = await m.query(
    `SELECT d.* ${releases} AND d.id=$5 AND d.subject_hash=$6 FOR SHARE OF d,e`,
    [...ids, actor.sourceCompanyId, request.releaseId, request.releaseHash],
  );
  if (!release)
    throw new ConflictException(
      'Select an independently approved live release for this company and book.',
    );
  if (
    ![
      answers('G04-05').populationEvidenceHash,
      answers('G04-09').reconciliationEvidenceHash,
    ].includes(release.payload.sourceReconciliationHash)
  )
    throw new ConflictException(
      'The opening reconciliation must use the evidence reviewed in the source population or rehearsal step.',
    );
  if (
    actor.naturalPersonId === release.maker_natural_person_id ||
    actor.subjectId === release.maker_subject_id
  )
    throw new ForbiddenException(
      'The maker of the ledger release cannot activate the book.',
    );
  const [context] = await m.query(
    `SELECT d.payload FROM finance_foundation_documents d JOIN finance_foundation_decisions e
    ON e.document_id=d.id AND e.subject_hash=d.subject_hash AND e.state='REVIEWED'
    WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND d.id=$4 AND d.subject_hash=$5 AND d.kind='CURRENCY_CONTEXT'`,
    [...ids, release.parent_id, release.payload.contextHash],
  );
  if (!context || !contextMatchesSetup(context.payload, basis, chart))
    throw new ConflictException(
      'Ledger and setup must agree on the accounting basis, chart, currencies and exchange rules.',
    );
  const decisions = answers('G04-08').policyDecisions;
  if (
    context.payload.policyPins.some(
      (p: { id: string; hash: string }) =>
        !decisions.some(
          (d: any) =>
            d.policyVersionId === p.id &&
            d.policyVersionHash === p.hash &&
            d.disposition === 'PROPOSED_TREATMENT',
        ),
    )
  )
    throw new ConflictException(
      'The ledger release uses a policy outside the reviewed company setup.',
    );
  const pins = settings.configurationPins;
  const configs = await m.query(
    `SELECT kind,payload FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=ANY($4::uuid[])`,
    [...ids, pins.map((p: any) => p.id)],
  );
  const rules =
    configs.find((r: any) => r.kind === 'POSTING_RULES')?.payload.rules ?? [];
  const rolesMatch = (a: string[], b: string[]) =>
    canonicalFinanceJson([...a].sort()) === canonicalFinanceJson([...b].sort());
  for (const component of context.payload
    .allowedComponents as CurrencyContextInput['allowedComponents']) {
    const measurement =
      component.owner === 'IFRS17_ENGINE' &&
      component.sourceEventType === 'IFRS17_MEASUREMENT_APPROVED' &&
      component.effect === 'INSURANCE_MEASUREMENT';
    const memo =
      component.owner === 'FINANCE' &&
      component.sourceEventType === 'INVOICE_ISSUED' &&
      component.effect === 'BILLING_MEMORANDUM';
    if (
      !measurement &&
      !memo &&
      (component.owner !== 'FINANCE' ||
        !['CASH', 'ORDINARY'].includes(component.effect))
    )
      continue;
    if (
      !rules.some(
        (r: any) =>
          (memo
            ? r.layer === 'BILLING_MEMORANDUM' && !r.financialPosting
            : r.financialPosting) &&
          (!measurement ||
            (r.layer === 'IFRS17_MEASUREMENT' &&
              r.measurementSource === 'IFRS17_ENGINE')) &&
          !r.unresolvedDecisions.length &&
          (component.sourceEventType === null ||
            r.sourceEvent === component.sourceEventType) &&
          r.economicEffectKey === component.component &&
          r.policyReferences.includes(component.policyCode) &&
          (memo ||
            (rolesMatch(r.debitRoles, component.debitRoles) &&
              rolesMatch(r.creditRoles, component.creditRoles))),
      )
    )
      throw new ConflictException(
        'Review matching source, policy, debit and credit roles for ledger component ' +
          component.component +
          '.',
      );
  }
  const start = [
    release.payload.activeFrom,
    ...rows.map((r) => r.subject.input.effectiveFrom),
    calendar.periods.map((p: { from: string }) => p.from).sort()[0],
  ]
    .filter(Boolean)
    .sort()
    .at(-1);
  const end = [
    release.payload.activeTo,
    ...rows.map((r) => r.subject.input.effectiveTo),
    calendar.periods
      .map((p: { to: string }) => p.to)
      .sort()
      .at(-1),
  ]
    .filter(Boolean)
    .sort()[0];
  const [{ today }] = await m.query(
    'SELECT (statement_timestamp() AT TIME ZONE $1)::date::text AS today',
    [calendar.timezone],
  );
  if (!start || !end || today < start || today >= end)
    throw new ConflictException(
      'The reviewed calendar, setup and ledger release must all cover today.',
    );
  await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    'FIN01/' + actor.sourceCompanyId,
  ]);
  const existing = await m.query(
    `SELECT id FROM finance_operating_setups WHERE withdrawn_at IS NULL AND
    ((tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3) OR (company_id=$4 AND book_role='PRIMARY' AND $5='PRIMARY'))`,
    [...ids, actor.sourceCompanyId, basis.bookRole],
  );
  if (existing.length)
    throw new ConflictException(
      'Withdraw the existing book activation before replacing it.',
    );
  const controls = {
    numbering: settings.numbering,
    paymentTerms: settings.paymentTerms,
    termAssignments: settings.termAssignments ?? [],
    paymentMethods: settings.paymentMethods,
    approvalLimits: settings.approvalLimits,
    currencies: basis.transactionCurrencies,
    currencyScales: basis.currencyScales,
    configurationPins: settings.configurationPins,
    functionalCurrency: basis.functionalCurrency,
    calendar: calendar.periods,
    departmentIds: chart.departmentIds ?? [],
    costCentres: chart.costCentres ?? [],
    dimensionReleaseId: chart.dimensionReleaseId,
    dimensionReleaseHash: chart.dimensionReleaseHash,
  };
  const [activation] = await m.query(
    `INSERT INTO finance_operating_setups(tenant_id,legal_entity_id,book_id,company_id,book_role,setup_id,
    release_id,legal_step_id,starts_on,ends_before,controls,timezone,actor_id,authority_id,reason)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      ...ids,
      actor.sourceCompanyId,
      basis.bookRole,
      request.setupId,
      release.id,
      byStep['G04-01'].id,
      start,
      end,
      JSON.stringify(controls),
      calendar.timezone,
      actor.subjectId,
      authority,
      request.reason,
    ],
  );
  const [verified] = await m.query(
    'SELECT finance_fin01_current($1) AS current',
    [activation.id],
  );
  if (!verified.current)
    throw new ConflictException(
      'Company or evidence changed before activation.',
    );
  await installCalendar(
    m,
    ids,
    authority,
    actor,
    calendar,
    byStep['G04-04'].subject_hash,
    request.reason,
  );
  if (
    context.payload.allowedComponents.some(
      (c: CurrencyContextInput['allowedComponents'][number]) =>
        (c.origin === 'INSURANCE_PORTAL_FINANCE' || c.origin === 'FIN02_GL') &&
        c.owner === 'FINANCE' &&
        ['CASH', 'ORDINARY'].includes(c.effect),
    )
  ) {
    const candidates = new FinanceJournalCandidateService(m.connection);
    const scope = { legalEntityId: ids[1], bookId: ids[2] };
    for (const p of calendar.periods.filter(
      (p: { kind?: string }) => (p.kind ?? 'REGULAR') === 'REGULAR',
    )) {
      const [existing] = await m.query(
        "SELECT id,starts_on::text,ends_before::text,state FROM finance_draft_periods d WHERE book_id=$1 AND starts_on<$3::date AND ends_before>$2::date AND to_jsonb(d)->>'adjustment_period_id' IS NULL",
        [ids[2], p.from, p.to],
      );
      if (existing) {
        if (
          existing.starts_on !== p.from ||
          existing.ends_before !== p.to ||
          existing.state !== 'OPEN_FOR_VALIDATION'
        )
          throw new ConflictException(
            'Align the existing journal validation period with the approved open calendar before activation.',
          );
      } else {
        const period = await candidates.createDraftPeriod(
          actor,
          scope,
          { code: 'FIN01.' + p.from, startsOn: p.from, endsBefore: p.to },
          String(request.reason),
          m,
        );
        await candidates.fenceDraftPeriod(
          actor,
          scope,
          period.id,
          period.revision,
          'OPEN_FOR_VALIDATION',
          String(request.reason),
          m,
        );
      }
    }
  }
  if (basis.bookRole === 'PRIMARY')
    await m.query(
      'UPDATE companies SET finance_primary_setup_id=$2 WHERE id=$1',
      [actor.sourceCompanyId, activation.id],
    );
  return {
    id: activation.id,
    bookRole: basis.bookRole,
    startsOn: start,
    endsBefore: end,
  };
}

export async function withdrawBook(
  m: EntityManager,
  actor: FoundationActor,
  ids: string[],
  id: string,
  reason: string,
) {
  const [deployment] = await m.query(
    'SELECT action FROM finance_foundation_deployments WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 ORDER BY sequence DESC LIMIT 1',
    ids,
  );
  if (deployment?.action === 'ENABLE')
    throw new ConflictException(
      'Disable the live ledger deployment before withdrawing its setup.',
    );
  const [rows] = await m.query(
    `UPDATE finance_operating_setups SET withdrawn_at=statement_timestamp(),withdrawn_by=$6,withdrawal_reason=$7
    WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND company_id=$4 AND id=$5 AND withdrawn_at IS NULL RETURNING id`,
    [...ids, actor.sourceCompanyId, id, actor.subjectId, reason],
  );
  if (!rows?.length)
    throw new ConflictException(
      'This activation is unavailable or already withdrawn.',
    );
  await m.query(
    'UPDATE companies SET finance_primary_setup_id=NULL WHERE id=$1 AND finance_primary_setup_id=$2',
    [actor.sourceCompanyId, id],
  );
  return { id, withdrawn: true };
}
