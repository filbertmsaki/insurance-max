import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { FoundationActor } from './finance-ledger-foundation.service';
import {
  type ActivePostingBook,
  glDeployment,
  ownedEvidence,
} from './finance-book-request';
import { nativeComponents } from './finance-native-sources';
import type { Evidence } from './finance-gl-program';
import { financeConfigurationHash } from '../../foundation/finance-configuration/finance-configuration.types';

export const glComponents = [
  'MANUAL',
  'RECURRING',
  'ACCRUAL',
  'ACCRUAL_SETTLEMENT',
  'PREPAYMENT',
  'PREPAYMENT_RELEASE',
  'INTERBRANCH',
  'ALLOCATION',
  'REVALUATION',
];
export async function glReadiness(m: EntityManager, b: ActivePostingBook) {
  const components = b.context.allowedComponents,
    blockers: string[] = [];
  for (const kind of glComponents)
    if (
      !components.some(
        (c) =>
          c.origin === 'FIN02_GL' &&
          c.component === kind &&
          c.sourceEventType === null &&
          c.owner === 'FINANCE' &&
          ['ORDINARY', 'CASH'].includes(c.effect),
      )
    )
      blockers.push('Review the FIN02_GL posting rule for ' + kind + '.');
  const missingNative = nativeComponents
    .filter(
      ({ event, kind, effect }) =>
        !components.some(
          (c) =>
            c.origin === 'INSURANCE_PORTAL_FINANCE' &&
            c.sourceEventType === event &&
            c.factKind === kind &&
            c.owner === 'FINANCE' &&
            c.effect === effect,
        ),
    )
    .map((c) => c.kind);
  const [dimensions] = await m.query(
    'SELECT payload FROM finance_configuration_releases WHERE id=$1 AND release_hash=$2',
    [b.controls.dimensionReleaseId, b.controls.dimensionReleaseHash],
  );
  if (!dimensions?.payload.companyMaster?.branchIds?.length)
    blockers.push(
      'Review at least one company branch in the dimension master.',
    );
  if (!b.controls.costCentres.length)
    blockers.push('Review an operating expense cost centre.');
  const [history] = await m.query(
    `SELECT count(*)::int AS overlaps FROM finance_operating_postings p JOIN finance_journal_entries old
    ON old.company_id=p.company_id AND old.source_type=p.source_type AND old.source_id=p.source_id WHERE p.book_id=$1`,
    [b.book_id],
  );
  if (history.overlaps)
    blockers.push(
      'Reconcile ' +
        history.overlaps +
        ' sources with both legacy and canonical accounting.',
    );
  const [stats] = await m.query(
    `SELECT count(*)::int candidates,count(j.id)::int posted,count(*) FILTER(WHERE j.id IS NULL)::int unposted FROM finance_operating_postings p LEFT JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.mode='LIVE' WHERE p.book_id=$1`,
    [b.book_id],
  );
  return {
    releaseId: b.release_id,
    blockers,
    missingNative,
    counts: stats,
    deployment: (await glDeployment(m, b)) ?? null,
  };
}
export async function recordGlDeployment(
  m: EntityManager,
  a: FoundationActor,
  b: ActivePostingBook,
  input: {
    action: 'ENABLE' | 'PAUSE';
    releaseId: string;
    evidence: Evidence;
    excludedSources?: Record<string, string>;
    previousSequence: string | null;
  },
  reason: string,
) {
  if (
    !input ||
    !['ENABLE', 'PAUSE'].includes(input.action) ||
    input.releaseId !== b.release_id
  )
    throw new ConflictException(
      'Refresh the active book release before this decision.',
    );
  await ownedEvidence(m, b, input.evidence);
  const [release] = await m.query(
    'SELECT maker_subject_id,maker_natural_person_id FROM finance_foundation_documents WHERE id=$1',
    [b.release_id],
  );
  if (
    release.maker_subject_id === a.subjectId ||
    release.maker_natural_person_id === a.naturalPersonId
  )
    throw new ForbiddenException(
      'The release preparer cannot authorize rollout.',
    );
  const r = await glReadiness(m, b),
    ex = input.excludedSources ?? {};
  if (
    r.deployment?.action === input.action &&
    r.deployment.release_id === input.releaseId
  ) {
    const prior = r.deployment;
    if (
      prior.reviewer_subject_id !== a.subjectId ||
      prior.reviewer_person_id !== a.naturalPersonId ||
      prior.reason !== reason ||
      financeConfigurationHash({ document: input.evidence, exclusions: ex }) !==
        financeConfigurationHash({
          document: prior.evidence.document,
          exclusions: prior.evidence.exclusions,
        })
    )
      throw new ConflictException(
        'This rollout decision already has different signed evidence. Refresh the book history.',
      );
    return { sequence: prior.sequence, reused: true };
  }
  if ((r.deployment?.sequence ?? null) !== input.previousSequence)
    throw new ConflictException(
      'The deployment changed. Refresh its current decision.',
    );
  if (input.action === 'ENABLE') {
    if (r.blockers.length) throw new ConflictException(r.blockers.join(' '));
    if (
      Object.keys(ex).some((k) => !r.missingNative.includes(k)) ||
      r.missingNative.some(
        (k) =>
          typeof ex[k] !== 'string' || !ex[k].trim() || ex[k].length > 1000,
      )
    )
      throw new ConflictException(
        'Configure the remaining native sources or record an evidenced business exclusion for each unavailable source.',
      );
  }
  const [row] = await m.query(
    `INSERT INTO finance_gl_deployments(company_id,book_id,release_id,action,reviewer_subject_id,reviewer_person_id,evidence,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING sequence,action`,
    [
      b.company_id,
      b.book_id,
      b.release_id,
      input.action,
      a.subjectId,
      a.naturalPersonId,
      {
        document: input.evidence,
        exclusions: ex,
        readiness: { counts: r.counts, missingNative: r.missingNative },
      },
      reason,
    ],
  );
  return row;
}
