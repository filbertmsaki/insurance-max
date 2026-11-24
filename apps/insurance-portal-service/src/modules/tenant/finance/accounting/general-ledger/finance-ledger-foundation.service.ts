import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  FinanceConfigurationActor,
  financeConfigurationHash as hash,
  canonicalFinanceJson,
} from '../../foundation/finance-configuration/finance-configuration.types';
import { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';
import {
  validateFinanceChart,
  FinanceChartProposal,
} from '../../foundation/chart-of-accounts/finance-chart.types';
import {
  candidateCode,
  candidateText,
  normalizeJournalCandidate,
} from '../journal-entries/finance-journal-candidate.types';
import { verifyAcceptedSource } from '../../integrations/source-evidence/finance-accepted-source';
import { retainedChartAuthorized } from '../../foundation/chart-of-accounts/finance-retained-chart';
import {
  FINANCE_JOURNAL_DIMENSION_VERIFIER,
  verifyReviewedDimensionMaster,
} from '../../foundation/accounting-dimensions/finance-reviewed-dimension-master';
import { normalizeSourceEnvelope } from '../accounting-events/finance-event.types';
import { verifyEventJournalDimensions } from '../../foundation/accounting-dimensions/finance-event-journal-dimensions';
import {
  policyDefinition,
  policyDefinitionHash,
} from '../../governance/accounting-policies/finance-policy.types';
import {
  CurrencyContextInput,
  FoundationAcceptInput,
  FoundationCapability,
  FoundationMode,
  FoundationRateInput,
  FOUNDATION_CHECKS,
  currencyContextPolicyHash,
  convertLedgerLines,
  dateOnly,
  digest,
  fixedRate,
  financialSnapshotValue,
  foundationFail,
  foundationIdentity,
  modeOnly,
  normalizeCurrencyContext,
  normalizeSourceProof,
  signedUnits,
  stored,
  units,
  uuid,
} from './finance-ledger-foundation.types';

import {
  activePostingBook,
  glDeployment,
  ownedEvidence,
} from './finance-book-request';
import { applyWriteOff } from './finance-gl-write-off';
import { verifyGlPosting } from './finance-gl-posting-check';
import { nativeLedgerEvents } from './finance-native-sources';

export interface FoundationActor extends FinanceConfigurationActor {
  identityBindingId?: string;
  sourceCompanyId?: string;
  sourceUserId?: string;
}
interface Command {
  manager: EntityManager;
  actor: FoundationActor;
  scope: FinanceBookSelection;
  ids: string[];
  authorityId: string;
  limits: Record<string, string>;
  profile: string;
  reason: string;
}
export interface FoundationDocument {
  id: string;
  kind: string;
  mode: FoundationMode;
  payload: any;
  subject_hash: string;
  maker_subject_id: string;
  maker_natural_person_id: string;
  parent_id: string | null;
  state?: string;
  [key: string]: any;
}

/** B43-B45 canonical ledger adapter. VALIDATION and LIVE populations never mix. */
@Injectable()
export class FinanceLedgerFoundationService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    @Optional()
    @Inject(FINANCE_JOURNAL_DIMENSION_VERIFIER)
    private readonly dimensionVerifier: typeof verifyReviewedDimensionMaster = verifyReviewedDimensionMaster,
  ) {}

  async scopes(user: { id: string; companyId?: string | null }) {
    uuid(user?.id);
    uuid(user?.companyId);
    const [{ deployed }] = await this.source.query(
      "SELECT to_regclass('public.finance_foundation_identity_bindings') IS NOT NULL deployed",
    );
    if (!deployed)
      foundationFail('Finance foundation identity bindings are not deployed.');
    return this.source.query(
      `SELECT DISTINCT b.tenant_id AS "tenantId",b.legal_entity_id AS "legalEntityId",b.id AS "bookId",b.book_code,b.state,l.entity_code,l.business_profile FROM finance_foundation_identity_bindings i JOIN finance_accounting_books b ON b.tenant_id=i.tenant_id AND b.legal_entity_id=i.legal_entity_id AND b.id=i.book_id JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id JOIN finance_foundation_authorities a ON a.tenant_id=i.tenant_id AND a.legal_entity_id=i.legal_entity_id AND a.book_id=i.book_id AND a.subject_id=i.subject_id AND a.natural_person_id=i.natural_person_id WHERE i.source_company_id=$1 AND i.source_user_id=$2 AND i.revoked_at IS NULL AND i.valid_from<=statement_timestamp() AND (i.valid_to IS NULL OR i.valid_to>statement_timestamp()) AND a.capability='READ' AND a.revoked_at IS NULL AND a.valid_from<=statement_timestamp() AND (a.valid_to IS NULL OR a.valid_to>statement_timestamp()) AND b.state<>'DISABLED' AND l.state<>'DISABLED' ORDER BY b.book_code`,
      [user.companyId, user.id],
    );
  }
  async documents(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    kind: string | undefined,
    limit = 50,
  ) {
    if (
      (kind !== undefined &&
        ![
          'CURRENCY_CONTEXT',
          'EXCHANGE_RATE',
          'OPENING',
          'B45_ACCEPTANCE',
          'RELEASE',
        ].includes(kind)) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      foundationFail(
        'A supported document kind and bounded limit from one to one hundred are required.',
      );
    return this.command(
      actor,
      scope,
      'READ',
      'List scoped review subjects',
      async (c) =>
        c.manager.query(
          'SELECT d.id,d.kind,d.mode,d.document_key,d.version,d.subject_hash,e.state,d.created_at FROM finance_foundation_documents d LEFT JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND ($4::text IS NULL OR d.kind=$4) ORDER BY d.created_at DESC,d.id LIMIT $5',
          [...c.ids, kind ?? null, limit],
        ),
    );
  }
  async documentDetails(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
  ) {
    return this.command(
      actor,
      scope,
      'READ',
      'Read a frozen approval subject',
      (c) => this.getDocument(c, id, expectedHash),
    );
  }
  async policyDetails(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
  ) {
    uuid(id);
    id = id.toLowerCase();
    digest(expectedHash);
    return this.command(
      actor,
      scope,
      'READ',
      'Read scoped policy and audit chain',
      async (c) => {
        const [p] = await c.manager.query(
          'SELECT * FROM finance_policy_versions WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4',
          [...c.ids, id],
        );
        if (
          !p ||
          p.definition_hash !== expectedHash ||
          policyDefinitionHash(policyDefinition(p.definition)) !== expectedHash
        )
          throw new ForbiddenException(
            'Exact policy version is unavailable in this scope.',
          );
        const events = await c.manager.query(
          'SELECT * FROM finance_policy_events WHERE policy_id=$1 ORDER BY sequence',
          [id],
        );
        let previous = expectedHash,
          state = 'DRAFT',
          sequence = 0;
        for (const e of events) {
          const content = {
            policyId: id,
            definitionHash: expectedHash,
            sequence: ++sequence,
            fromState: state,
            toState: e.to_state,
            action: e.action,
            actorSubjectId: e.actor_subject_id,
            actorNaturalPersonId: e.actor_natural_person_id,
            authorityId: e.authority_id,
            reason: e.reason,
            evidenceHash: e.evidence_hash,
            previousHash: previous,
          };
          if (
            e.sequence !== sequence ||
            e.from_state !== state ||
            e.previous_hash !== previous ||
            hash(content) !== e.event_hash
          )
            foundationFail('Policy audit-chain evidence differs.');
          previous = e.event_hash;
          state = e.to_state;
        }
        return {
          id,
          definitionHash: expectedHash,
          definition: p.definition,
          state,
          events,
          financialEffects: 0,
        };
      },
    );
  }

  async resolveIdentity(
    user: { id: string; companyId?: string | null },
    scope: FinanceBookSelection,
    manager: Pick<EntityManager, 'query'> = this.source,
  ): Promise<FoundationActor> {
    uuid(user?.id);
    uuid(user?.companyId);
    uuid(scope?.bookId);
    uuid(scope?.legalEntityId);
    const [{ deployed }] = await manager.query(
      "SELECT to_regclass('public.finance_foundation_identity_bindings') IS NOT NULL deployed",
    );
    if (!deployed)
      foundationFail(
        'Finance foundation identity bindings are not deployed. No legacy company/admin identity is inferred.',
      );
    const rows = await manager.query(
      `SELECT * FROM finance_foundation_identity_bindings WHERE source_company_id=$1 AND source_user_id=$2 AND legal_entity_id=$3 AND book_id=$4 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())`,
      [user.companyId, user.id, scope.legalEntityId, scope.bookId],
    );
    if (rows.length !== 1)
      throw new ForbiddenException(
        'A unique trusted company/user-to-Finance identity binding is required.',
      );
    const b = rows[0];
    return {
      kind: 'USER',
      tenantId: b.tenant_id,
      subjectId: b.subject_id,
      naturalPersonId: b.natural_person_id,
      identityBindingId: b.id,
      sourceCompanyId: user.companyId,
      sourceUserId: user.id,
    };
  }

  async prepareCurrencyContext(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: CurrencyContextInput,
    reason: string,
  ) {
    const p = normalizeCurrencyContext(input);
    return this.command(actor, scope, 'PREPARE', reason, async (c) => {
      if (
        c.actor.sourceCompanyId &&
        c.actor.sourceCompanyId !== p.sourceCompanyId
      )
        throw new ForbiddenException(
          'Context source company differs from the trusted identity binding.',
        );
      this.contextRoles(p, await this.chart(c, p, p.effectiveFrom));
      return this.document(
        c,
        'CURRENCY_CONTEXT',
        'VALIDATION',
        'CURRENCY',
        p.version,
        null,
        p,
      );
    });
  }
  async prepareRate(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: FoundationRateInput,
    version: number,
    reason: string,
  ) {
    input = JSON.parse(canonicalFinanceJson(input));
    uuid(input.contextId);
    digest(input.contextHash);
    dateOnly(input.rateDate);
    dateOnly(input.validTo);
    digest(input.evidenceHash);
    fixedRate(input.rate);
    return this.command(actor, scope, 'PREPARE', reason, async (c) => {
      const context = await this.reviewed(
          c,
          input.contextId,
          input.contextHash,
          'CURRENCY_CONTEXT',
        ),
        p = normalizeCurrencyContext(context.payload);
      if (
        !Object.hasOwn(p.currencyScales, input.transactionCurrency) ||
        input.transactionCurrency === p.functionalCurrency ||
        !p.rateSources.includes(input.source) ||
        !candidateText(input.sourceReference, 2000) ||
        input.validTo <= input.rateDate ||
        input.rateDate < p.effectiveFrom ||
        (p.effectiveTo && input.validTo > p.effectiveTo)
      )
        foundationFail(
          'Rate pair, source or validity is incompatible with its reviewed context. Same-currency parity is not a manually entered rate.',
        );
      return this.document(
        c,
        'EXCHANGE_RATE',
        'VALIDATION',
        input.transactionCurrency + ':' + input.rateDate + ':' + input.source,
        version,
        context.id,
        { ...input, functionalCurrency: p.functionalCurrency },
      );
    });
  }
  async reviewDocument(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
    decision: 'REVIEWED' | 'APPROVED' | 'REJECTED',
    evidenceHash: string,
    reason: string,
  ) {
    uuid(id);
    digest(expectedHash);
    digest(evidenceHash);
    foundationIdentity(actor, scope);
    const [{ deployed }] = await this.source.query(
      "SELECT to_regclass('public.finance_foundation_documents') IS NOT NULL deployed",
    );
    if (!deployed)
      foundationFail('Foundation document storage is not deployed.');
    const [{ kind } = {}] = await this.source.query(
      'SELECT kind FROM finance_foundation_documents WHERE id=$1 AND tenant_id=$2 AND legal_entity_id=$3 AND book_id=$4',
      [id, actor.tenantId, scope.legalEntityId, scope.bookId],
    );
    return this.command(
      actor,
      scope,
      kind === 'RELEASE' ? 'RELEASE' : 'REVIEW',
      reason,
      async (c) => {
        const d = await this.getDocument(c, id, expectedHash);
        if (
          !['REVIEWED', 'APPROVED', 'REJECTED'].includes(decision) ||
          (d.kind === 'RELEASE' && decision === 'REVIEWED') ||
          (d.kind !== 'RELEASE' && decision === 'APPROVED')
        )
          foundationFail(
            'Technical review and company-admin release approval are different decisions.',
          );
        if (
          d.maker_subject_id === c.actor.subjectId ||
          d.maker_natural_person_id === c.actor.naturalPersonId
        )
          throw new ForbiddenException(
            'The same natural person cannot prepare and review a foundation subject, including with a second login.',
          );
        if (decision !== 'REJECTED') await this.revalidate(c, d);
        const content = {
          documentId: d.id,
          subjectHash: d.subject_hash,
          state: decision,
          actorSubjectId: c.actor.subjectId,
          actorNaturalPersonId: c.actor.naturalPersonId,
          authorityId: c.authorityId,
          evidenceHash,
          reason: c.reason,
        };
        await c.manager.query(
          `INSERT INTO finance_foundation_decisions(tenant_id,legal_entity_id,book_id,document_id,state,subject_hash,actor_subject_id,actor_natural_person_id,authority_id,evidence_hash,reason,decision_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            ...c.ids,
            d.id,
            decision,
            d.subject_hash,
            c.actor.subjectId,
            c.actor.naturalPersonId,
            c.authorityId,
            evidenceHash,
            c.reason,
            hash(content),
          ],
        );
        return {
          id: d.id,
          subjectHash: d.subject_hash,
          state: decision,
          policyActivation: false,
          financialEffects: 0,
        };
      },
    );
  }

  async createPeriod(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: { code: string; mode: FoundationMode; from: string; to: string },
    evidenceHash: string,
    reason: string,
  ) {
    input = JSON.parse(canonicalFinanceJson(input));
    modeOnly(input.mode);
    dateOnly(input.from);
    dateOnly(input.to);
    digest(evidenceHash);
    if (!candidateCode(input.code) || input.from >= input.to)
      foundationFail('A nonempty explicit ledger period is required.');
    return this.command(
      actor,
      scope,
      input.mode === 'LIVE' ? 'RELEASE' : 'REVIEW',
      reason,
      async (c) => {
        if (input.mode === 'LIVE') await this.live(c, null, input.from);
        const [p] = await c.manager.query(
          `INSERT INTO finance_foundation_periods(tenant_id,legal_entity_id,book_id,mode,period_code,starts_on,ends_before,state,revision) VALUES($1,$2,$3,$4,$5,$6,$7,'OPEN',1) RETURNING *,starts_on::text starts_on,ends_before::text ends_before`,
          [...c.ids, input.mode, input.code, input.from, input.to],
        );
        await this.periodAudit(c, p, evidenceHash);
        return p;
      },
    );
  }
  async fencePeriod(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    revision: number,
    state: 'OPEN' | 'CLOSED',
    evidenceHash: string,
    reason: string,
  ) {
    uuid(id);
    digest(evidenceHash);
    if (
      !Number.isInteger(revision) ||
      revision < 1 ||
      !['OPEN', 'CLOSED'].includes(state)
    )
      foundationFail(
        'An exact period revision and requested state are required.',
      );
    return this.command(actor, scope, 'RELEASE', reason, async (c) => {
      const [p] = await c.manager.query(
        'SELECT * FROM finance_foundation_periods WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR UPDATE',
        [...c.ids, id],
      );
      if (!p || p.revision !== revision || p.state === state)
        foundationFail(
          'Period is unavailable, stale or already in the requested state.',
        );
      const [updated] = await c.manager.query(
        'WITH changed AS (UPDATE finance_foundation_periods SET state=$2,revision=revision+1 WHERE id=$1 RETURNING *) SELECT *,starts_on::text starts_on,ends_before::text ends_before FROM changed',
        [id, state],
      );
      await this.periodAudit(c, updated, evidenceHash);
      return updated;
    });
  }

  async prepareOpening(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: {
      contextId: string;
      contextHash: string;
      mode: FoundationMode;
      date: string;
      balances: { accountCode: string; signedBalance: string }[];
      sourceReference: string;
      sourceEvidenceHash: string;
      explicitZeroReason: string | null;
    },
    version: number,
    reason: string,
  ) {
    input = JSON.parse(canonicalFinanceJson(input));
    uuid(input.contextId);
    digest(input.contextHash);
    digest(input.sourceEvidenceHash);
    modeOnly(input.mode);
    dateOnly(input.date);
    if (
      !candidateText(input.sourceReference, 2000) ||
      !Array.isArray(input.balances)
    )
      foundationFail(
        'A certified source population and explicit opening balances are required.',
      );
    return this.command(actor, scope, 'PREPARE', reason, async (c) => {
      const context = await this.reviewed(
          c,
          input.contextId,
          input.contextHash,
          'CURRENCY_CONTEXT',
        ),
        config = normalizeCurrencyContext(context.payload);
      const chart = await this.chart(c, config, input.date);
      this.openingBalances(
        input.balances,
        chart,
        config.currencyScales[config.functionalCurrency],
      );
      if (
        input.balances.every((b) => signedUnits(b.signedBalance) === 0n) &&
        !candidateText(input.explicitZeroReason, 2000)
      )
        foundationFail(
          'An all-zero opening needs an explicit independently reviewable reason; zero is not a default.',
        );
      if (input.mode === 'LIVE') {
        await this.policies(c, config, 'APPROVED');
        const [{ today }] = await c.manager.query(
          'SELECT statement_timestamp()::date::text today',
        );
        if (input.date < today)
          foundationFail(
            'A live cutover opening must be prospective; historical adjustments need a separate approved transition.',
          );
      }
      const covered = await this.population(c, input.mode, input.date);
      return this.document(
        c,
        'OPENING',
        input.mode,
        input.date,
        version,
        context.id,
        {
          ...input,
          functionalCurrency: config.functionalCurrency,
          coveredLedgerHash: hash(covered),
        },
      );
    });
  }

  async acceptCandidate(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: FoundationAcceptInput,
    reason: string,
    manager?: EntityManager,
  ) {
    input = JSON.parse(canonicalFinanceJson(input));
    uuid(input.candidateId);
    digest(input.candidateHash);
    uuid(input.contextId);
    digest(input.contextHash);
    modeOnly(input.mode);
    dateOnly(input.transactionDate);
    if (input.rateId !== null) uuid(input.rateId);
    if (input.rateHash !== null) digest(input.rateHash);
    if ((input.rateId === null) !== (input.rateHash === null))
      foundationFail(
        'Rate identity and hash must both be supplied or both be absent.',
      );
    const source = normalizeSourceProof(input.source);
    return this.command(
      actor,
      scope,
      'ACCEPT',
      reason,
      async (c) => {
        const context = await this.reviewed(
            c,
            input.contextId,
            input.contextHash,
            'CURRENCY_CONTEXT',
          ),
          config = normalizeCurrencyContext(context.payload);
        const [candidate] = await c.manager.query(
          'SELECT *,accounting_date::text accounting_date FROM finance_journal_candidates WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR SHARE',
          [...c.ids, input.candidateId],
        );
        if (
          !candidate ||
          candidate.subject_hash !== input.candidateHash ||
          candidate.state !== 'VALIDATED_INACTIVE'
        )
          foundationFail(
            'An exact independently validated B08/B09 candidate in this book is required.',
          );
        const p = normalizeJournalCandidate(candidate.payload);
        if (p.economicOrigin === 'FIN03_ALLOCATION_PREVIEW')
          foundationFail(
            'FIN-03 allocation previews cannot be accepted into a ledger.',
          );
        await this.dimensionVerifier(c.manager, c.ids, p);
        const chart = await this.chart(c, config, p.accountingDate);
        const maximum = c.limits[p.currency];
        if (
          !maximum ||
          p.lines.reduce((total, line) => total + units(line.debit), 0n) >
            units(maximum)
        )
          foundationFail(
            'The current acceptance mandate does not authorize this transaction currency and amount.',
          );
        if (
          p.chartReleaseId !== config.chartReleaseId ||
          p.chartReleaseHash !== config.chartReleaseHash ||
          input.transactionDate > p.accountingDate ||
          input.transactionDate < config.effectiveFrom ||
          (config.effectiveTo && p.accountingDate >= config.effectiveTo)
        )
          foundationFail(
            'Candidate chart, transaction date or effective currency context does not match.',
          );
        const sourceLines = await c.manager.query(
          'SELECT * FROM finance_journal_candidate_lines WHERE candidate_id=$1 ORDER BY line_key',
          [candidate.id],
        );
        const resolved = p.lines.map((l) => ({
          ...l,
          accountCode: chart.roles.find((r) => r.code === l.roleCode)
            ?.accountCode,
        }));
        if (
          hash({
            tenantId: c.actor.tenantId,
            ...c.scope,
            payload: p,
            lines: resolved,
          }) !== candidate.subject_hash ||
          sourceLines.length !== resolved.length ||
          resolved.some((l) => {
            const x = sourceLines.find((x) => x.line_key === l.lineKey);
            return (
              !x ||
              x.account_code !== l.accountCode ||
              x.role_code !== l.roleCode ||
              x.debit !== l.debit ||
              x.credit !== l.credit ||
              hash(x.dimensions) !== hash(l.dimensions)
            );
          })
        )
          foundationFail(
            'Candidate payload, resolved account vector or stored evidence differs.',
          );
        const [approval] = await c.manager.query(
          "SELECT id FROM finance_approval_requests WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND candidate_id=$4 AND candidate_hash=$5 AND state='CONSUMED_INACTIVE'",
          [...c.ids, candidate.id, candidate.subject_hash],
        );
        if (
          !approval ||
          candidate.maker_natural_person_id === c.actor.naturalPersonId ||
          candidate.maker_subject_id === c.actor.subjectId
        )
          throw new ForbiddenException(
            'A consumed B09 validation approval and independent current ledger acceptance are required.',
          );
        const component = config.allowedComponents.find(
          (a) =>
            a.origin === p.economicOrigin &&
            a.component === p.economicComponent,
        );
        if (
          !component ||
          component.owner !== 'FINANCE' ||
          !['CASH', 'ORDINARY'].includes(component.effect)
        )
          foundationFail(
            'Billing memoranda cannot post journals. IFRS17-owned components require their separately approved measurement adapter.',
          );
        if (
          p.lines.some(
            (l) =>
              (units(l.debit) > 0n &&
                !(
                  candidate.kind === 'REVERSAL'
                    ? component.creditRoles
                    : component.debitRoles
                ).includes(l.roleCode)) ||
              (units(l.credit) > 0n &&
                !(
                  candidate.kind === 'REVERSAL'
                    ? component.debitRoles
                    : component.creditRoles
                ).includes(l.roleCode)),
          )
        )
          foundationFail(
            'Candidate account roles or debit/credit sides differ from the independently approved component posting rule.',
          );
        if (p.economicOrigin === 'FIN02_GL' || source.kind === 'BOOK_VOUCHER') {
          if (
            p.economicOrigin !== 'FIN02_GL' ||
            source.kind !== 'BOOK_VOUCHER' ||
            component.sourceEventType !== null
          )
            foundationFail(
              'Use the independently reviewed book voucher for this component.',
            );
          const [v] = await c.manager.query(
            "SELECT * FROM finance_operating_postings WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND candidate_id=$4 AND company_id=$5 AND source_type IN ('GL_VOUCHER','GL_REVERSAL') FOR SHARE",
            [...c.ids, candidate.id, config.sourceCompanyId],
          );
          if (
            input.mode !== 'LIVE' ||
            !v ||
            v.context_id !== context.id ||
            v.context_hash !== context.subject_hash ||
            v.source_id !== p.economicSourceId ||
            v.snapshot.reference !== source.reference ||
            v.snapshot_hash !== source.evidenceHash ||
            hash(v.snapshot) !== source.evidenceHash ||
            v.snapshot.transactionDate !== input.transactionDate ||
            v.snapshot.component !== p.economicComponent ||
            v.snapshot.currency !== p.currency ||
            v.snapshot.candidateHash !== candidate.subject_hash
          )
            foundationFail(
              'Voucher, accounting date, source proof and approved candidate must match.',
            );
          const [previous] = await c.manager.query(
            "SELECT id FROM finance_foundation_journals WHERE candidate_id=$1 AND mode='LIVE'",
            [candidate.id],
          );
          if (!previous) await verifyGlPosting(c.manager, v);
        }
        let nativeType: string | undefined;
        if (source.kind === 'OPERATING_DOCUMENT') {
          const [document] = await c.manager.query(
            'SELECT * FROM finance_operating_postings WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND candidate_id=$4 AND company_id=$5 FOR SHARE',
            [...c.ids, candidate.id, config.sourceCompanyId],
          );
          nativeType = document?.source_type;
          if (nativeType) {
            const b = await activePostingBook(
              c.manager,
              config.sourceCompanyId,
            );
            const d = b && (await glDeployment(c.manager, b));
            const requiresFin02 = !['INVOICE', 'RECEIPT'].includes(nativeType);
            if (
              !b ||
              b.book_id !== c.ids[2] ||
              ((requiresFin02 || d) &&
                (d?.action !== 'ENABLE' || d.release_id !== b.release_id))
            )
              foundationFail(
                'Resume the approved FIN-02 release before native journal posting.',
              );
            if (document.snapshot.evidence)
              await ownedEvidence(c.manager, b, document.snapshot.evidence);
          }
          const mapping = component.sourceMapping;
          if (
            input.mode !== 'LIVE' ||
            !document ||
            document.context_id !== context.id ||
            document.context_hash !== context.subject_hash ||
            document.source_id !== source.reference ||
            document.source_id !== p.economicSourceId ||
            document.snapshot_hash !== source.evidenceHash ||
            hash(document.snapshot) !== source.evidenceHash ||
            p.economicOrigin !== 'INSURANCE_PORTAL_FINANCE' ||
            document.snapshot.eventType !== component.sourceEventType ||
            (candidate.kind === 'REVERSAL'
              ? document.snapshot.originalSourceType
              : document.source_type) !== component.factKind ||
            !mapping ||
            financialSnapshotValue(document.snapshot, mapping.companyPath) !==
              config.sourceCompanyId ||
            financialSnapshotValue(document.snapshot, mapping.aggregatePath) !==
              p.economicSourceId ||
            financialSnapshotValue(document.snapshot, mapping.currencyPath) !==
              p.currency ||
            financialSnapshotValue(document.snapshot, mapping.datePath) !==
              input.transactionDate ||
            units(
              String(
                financialSnapshotValue(document.snapshot, mapping.amountPath),
              ),
            ) !== p.lines.reduce((sum, line) => sum + units(line.debit), 0n)
          )
            foundationFail(
              'The operating document differs from its approved event, source, amount, currency or date.',
            );
        }
        if (
          component.origin === 'INSURANCE_PORTAL_FINANCE' &&
          nativeLedgerEvents.has(component.sourceEventType ?? '') &&
          source.kind !== 'OPERATING_DOCUMENT'
        )
          foundationFail(
            'Use the accounting request recorded by the originating financial document.',
          );
        let acceptedSnapshotId: string | undefined;
        if (source.kind === 'MANUAL' && component.sourceEventType !== null)
          foundationFail(
            'This automatic component requires its signed accepted inbox fact, not a manual substitute.',
          );
        if (source.kind === 'ACCEPTED_INBOX') {
          if (!component.sourceMapping)
            foundationFail(
              'This component does not authorize automatic signed snapshot posting.',
            );
          const mapping = component.sourceMapping;
          const amount = financialSnapshotValue(
              source.snapshot!,
              mapping.amountPath,
            ),
            currency = financialSnapshotValue(
              source.snapshot!,
              mapping.currencyPath,
            ),
            date = financialSnapshotValue(source.snapshot!, mapping.datePath),
            company = financialSnapshotValue(
              source.snapshot!,
              mapping.companyPath,
            ),
            aggregate = financialSnapshotValue(
              source.snapshot!,
              mapping.aggregatePath,
            );
          dateOnly(date);
          if (
            typeof amount !== 'string' ||
            units(amount) !==
              p.lines.reduce((total, line) => total + units(line.debit), 0n) ||
            currency !== p.currency ||
            date !== input.transactionDate ||
            company !== source.expected!.companyId ||
            aggregate !== source.expected!.aggregateId
          )
            foundationFail(
              'Candidate amounts, currency, transaction date or ownership differ from the signed financial snapshot.',
            );
          if (
            source.expected!.eventType !== component.sourceEventType ||
            source.expected!.factKind !== component.factKind
          )
            foundationFail(
              'Signed event type and fact kind differ from the reviewed component mapping.',
            );
          const accepted = await verifyAcceptedSource(
            c.manager,
            c.actor,
            c.scope,
            source.inboxId!,
            source.expected!,
            source.deliveryId ?? null,
          );
          const sourceEvent = normalizeSourceEnvelope(accepted.raw_body);
          verifyEventJournalDimensions(sourceEvent, c.scope.bookId, p);
          acceptedSnapshotId = sourceEvent.payload.snapshot_id;
          if (
            source.expected!.companyId !== config.sourceCompanyId ||
            p.economicOrigin !== accepted.source_system ||
            p.economicSourceId !== source.expected!.aggregateId ||
            p.sourceRevision !== String(source.expected!.revision)
          )
            foundationFail(
              'Signed source company, economic origin, aggregate or revision is not bound to this candidate.',
            );
        }
        const requestHash = hash({ ...input, source });
        const [existing] = await c.manager.query(
          'SELECT * FROM finance_foundation_journals WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND mode=$4 AND candidate_id=$5',
          [...c.ids, input.mode, candidate.id],
        );
        if (existing) {
          if (existing.payload.requestHash !== requestHash)
            foundationFail(
              'A candidate was retried with a different context, source proof, currency evidence or date.',
            );
          return {
            journalId: existing.id,
            subjectHash: existing.subject_hash,
            reused: true,
            mode: input.mode,
            financialEffects: existing.financial_effects,
          };
        }
        if (input.mode === 'LIVE') {
          if (source.kind === 'MANUAL') {
            const [schema] = await c.manager.query(
              "SELECT to_regclass('public.finance_gl_deployments') IS NOT NULL installed",
            );
            if (schema.installed) {
              const [deployed] = await c.manager.query(
                'SELECT action FROM finance_gl_deployments WHERE book_id=$1 ORDER BY sequence DESC LIMIT 1',
                [scope.bookId],
              );
              if (deployed)
                foundationFail(
                  'Use the general journal voucher workflow for manual entries in this FIN-02 book.',
                );
            }
          }
          await this.live(c, context, p.accountingDate);
          const [{ legacy }] = await c.manager.query(
            "SELECT to_regclass('public.finance_journal_entries') IS NOT NULL legacy",
          );
          if (legacy) {
            const sourceIds = [
              p.economicSourceId,
              source.expected?.aggregateId,
              acceptedSnapshotId,
            ];
            for (const sourceId of sourceIds.filter(
              (id): id is string =>
                typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id),
            )) {
              const [old] = await c.manager.query(
                'SELECT id FROM finance_journal_entries WHERE company_id=$1 AND source_id=$2 LIMIT 1',
                [config.sourceCompanyId, sourceId],
              );
              if (old)
                foundationFail(
                  'A legacy journal already owns this source. Reconcile and authorize a controlled replacement before canonical posting.',
                );
            }
          }
        }
        const [period] = await c.manager.query(
          "SELECT *,starts_on::text starts_on,ends_before::text ends_before FROM finance_foundation_periods WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND mode=$4 AND state='OPEN' AND starts_on<=$5::date AND ends_before>$5::date FOR SHARE",
          [...c.ids, input.mode, p.accountingDate],
        );
        if (!period)
          foundationFail(
            'No open ledger period covers the approved candidate accounting date.',
          );
        const [cutoff] = await c.manager.query(
          "SELECT d.payload->>'date' cutoff FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND d.kind='OPENING' AND d.mode=$4 AND e.state='REVIEWED' ORDER BY d.payload->>'date' DESC LIMIT 1",
          [...c.ids, input.mode],
        );
        if (cutoff && p.accountingDate < cutoff.cutoff)
          foundationFail(
            'A certified opening has frozen this historical population. Use a separately approved adjustment in an open period.',
          );
        let rate = '1',
          rateEvidence: FoundationDocument | null = null;
        const functionalScale =
          config.currencyScales[config.functionalCurrency];
        if (
          !Object.hasOwn(config.currencyScales, p.currency) ||
          p.decimalScale !== config.currencyScales[p.currency]
        )
          foundationFail(
            'Source currency precision differs from the explicit context.',
          );
        if (p.currency !== config.functionalCurrency) {
          if (!input.rateId || !input.rateHash)
            foundationFail(
              'Foreign-currency journals need exact reviewed rate evidence; FX=1 is never inferred.',
            );
          rateEvidence = await this.reviewed(
            c,
            input.rateId,
            input.rateHash,
            'EXCHANGE_RATE',
          );
          const r = rateEvidence.payload;
          if (
            rateEvidence.parent_id !== context.id ||
            r.contextHash !== context.subject_hash ||
            r.transactionCurrency !== p.currency ||
            r.functionalCurrency !== config.functionalCurrency ||
            (candidate.kind !== 'REVERSAL' &&
              (r.rateDate > input.transactionDate ||
                r.validTo <= input.transactionDate ||
                (Date.parse(input.transactionDate) - Date.parse(r.rateDate)) /
                  86400000 >
                  config.maxRateAgeDays))
          )
            foundationFail(
              'Rate scope, pair, effective date or maximum age does not match this transaction.',
            );
          rate = r.rate;
        } else if (input.rateId !== null)
          foundationFail(
            'Same-currency journals require exact parity, not a foreign-rate snapshot.',
          );
        let vector = convertLedgerLines(
            p.lines,
            rate,
            functionalScale,
            config.roundingMode,
          ),
          reversalOf: string | null = null;
        if (candidate.kind === 'REVERSAL') {
          const [original] = await c.manager.query(
            'SELECT * FROM finance_foundation_journals WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND mode=$4 AND candidate_id=$5 AND candidate_hash=$6',
            [...c.ids, input.mode, p.correctionOf!.id, p.correctionOf!.hash],
          );
          if (
            !original ||
            original.functional_currency !== config.functionalCurrency ||
            original.transaction_currency !== p.currency ||
            original.economic_key !== candidate.economic_key
          )
            foundationFail(
              'Reversal requires its exact accepted original, currency basis and economic identity.',
            );
          if (
            input.rateId !== original.rate_id ||
            input.rateHash !== original.rate_hash
          )
            foundationFail(
              'A reversal must retain the original FX evidence; a new spot rate would create a second FX effect.',
            );
          const old = await c.manager.query(
            'SELECT * FROM finance_foundation_lines WHERE journal_id=$1 ORDER BY line_key',
            [original.id],
          );
          vector = vector.map((l) => {
            const x = old.find((x) => x.line_key === l.lineKey),
              current = resolved.find((x) => x.lineKey === l.lineKey)!;
            if (
              !x ||
              l.transactionDebit !== x.transaction_credit ||
              l.transactionCredit !== x.transaction_debit ||
              current.accountCode !== x.account_code ||
              current.roleCode !== x.role_code ||
              hash(current.dimensions) !== hash(x.dimensions)
            )
              foundationFail(
                'Reversal lines differ from the original account, dimension or transaction vector.',
              );
            return {
              ...l,
              functionalDebit: x.functional_credit,
              functionalCredit: x.functional_debit,
              roundingDebit: x.rounding_credit,
              roundingCredit: x.rounding_debit,
            };
          });
          reversalOf = original.id;
        }
        const payload = {
          schema: 'FINANCE_ACCEPTED_LEDGER_V1',
          rateBasis: rateEvidence ? 'REVIEWED_SNAPSHOT' : 'EXACT_PARITY',
          requestHash,
          source,
          context: config,
          contextHash: context.subject_hash,
          candidateHash: candidate.subject_hash,
          transactionDate: input.transactionDate,
          accountingDate: p.accountingDate,
          rate: rateEvidence
            ? {
                id: rateEvidence.id,
                hash: rateEvidence.subject_hash,
                payload: rateEvidence.payload,
              }
            : null,
          reversalOf,
          lines: vector.map((l) => ({
            ...l,
            accountCode: resolved.find((x) => x.lineKey === l.lineKey)!
              .accountCode,
            roleCode: resolved.find((x) => x.lineKey === l.lineKey)!.roleCode,
            dimensions: resolved.find((x) => x.lineKey === l.lineKey)!
              .dimensions,
          })),
        };
        const subjectHash = hash({
          tenantId: c.actor.tenantId,
          ...c.scope,
          mode: input.mode,
          payload,
        });
        const [journal] = await c.manager.query(
          `INSERT INTO finance_foundation_journals(tenant_id,legal_entity_id,book_id,mode,financial_effects,candidate_id,candidate_hash,economic_key,kind,reversal_of,period_id,period_revision,context_id,context_hash,rate_id,rate_hash,transaction_date,accounting_date,transaction_currency,functional_currency,payload,subject_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
          [
            ...c.ids,
            input.mode,
            input.mode === 'LIVE' ? 1 : 0,
            candidate.id,
            candidate.subject_hash,
            candidate.economic_key,
            candidate.kind,
            reversalOf,
            period.id,
            period.revision,
            context.id,
            context.subject_hash,
            input.rateId,
            input.rateHash,
            input.transactionDate,
            p.accountingDate,
            p.currency,
            config.functionalCurrency,
            payload,
            subjectHash,
          ],
        );
        if (
          nativeType === 'INVOICE_WRITE_OFF' ||
          nativeType === 'INVOICE_WRITE_OFF_REVERSAL'
        )
          await applyWriteOff(
            c.manager,
            config.sourceCompanyId,
            p.economicSourceId,
            nativeType === 'INVOICE_WRITE_OFF_REVERSAL',
          );
        for (const l of payload.lines)
          await c.manager.query(
            `INSERT INTO finance_foundation_lines(tenant_id,legal_entity_id,book_id,journal_id,line_key,account_code,role_code,transaction_debit,transaction_credit,functional_debit,functional_credit,rounding_debit,rounding_credit,dimensions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              ...c.ids,
              journal.id,
              l.lineKey,
              l.accountCode,
              l.roleCode,
              l.transactionDebit,
              l.transactionCredit,
              l.functionalDebit,
              l.functionalCredit,
              l.roundingDebit,
              l.roundingCredit,
              l.dimensions,
            ],
          );
        await c.manager.query(
          `INSERT INTO finance_foundation_journal_audits(tenant_id,legal_entity_id,book_id,journal_id,actor_subject_id,actor_natural_person_id,authority_id,subject_hash,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            ...c.ids,
            journal.id,
            c.actor.subjectId,
            c.actor.naturalPersonId,
            c.authorityId,
            subjectHash,
            c.reason,
          ],
        );
        return {
          journalId: journal.id,
          subjectHash,
          reused: false,
          mode: input.mode,
          financialEffects: input.mode === 'LIVE' ? 1 : 0,
        };
      },
      manager,
    );
  }

  async trialBalance(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: {
      mode: FoundationMode;
      openingId: string;
      openingHash: string;
      from: string;
      to: string;
    },
    manager?: EntityManager,
  ) {
    modeOnly(input.mode);
    uuid(input.openingId);
    digest(input.openingHash);
    dateOnly(input.from);
    dateOnly(input.to);
    return this.command(
      actor,
      scope,
      'READ',
      'Read scoped certified ledger totals',
      (c) => this.report(c, input),
      manager,
    );
  }
  async accountLedger(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: {
      mode: FoundationMode;
      openingId: string;
      openingHash: string;
      from: string;
      to: string;
      accountCode: string;
    },
  ) {
    if (!candidateCode(input.accountCode))
      foundationFail('An explicit account code is required.');
    return this.command(
      actor,
      scope,
      'READ',
      'Read scoped account activity',
      async (c) => {
        const report = await this.report(c, input),
          row = report.rows.find((r) => r.accountCode === input.accountCode);
        if (!row) foundationFail('Account is outside the certified chart.');
        return {
          ...row,
          scope: report.scope,
          mode: report.mode,
          from: report.from,
          to: report.to,
          currency: report.currency,
          sourceJournals: report.journals.filter((j) =>
            j.lines.some((l: any) => l.accountCode === input.accountCode),
          ),
          evidenceHash: report.evidenceHash,
        };
      },
    );
  }
  async searchJournals(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: {
      mode: FoundationMode;
      from: string;
      to: string;
      limit: number;
      beforeDate?: string;
      beforeId?: string;
    },
  ) {
    modeOnly(input.mode);
    dateOnly(input.from);
    dateOnly(input.to);
    if (
      input.from > input.to ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    )
      foundationFail(
        'A valid date range and a limit from one to one hundred are required.',
      );
    if ((input.beforeDate === undefined) !== (input.beforeId === undefined))
      foundationFail('Both journal cursor fields are required.');
    if (input.beforeDate !== undefined) {
      dateOnly(input.beforeDate);
      uuid(input.beforeId);
      if (input.beforeDate < input.from || input.beforeDate > input.to)
        foundationFail(
          'Journal cursor must be within the selected date range.',
        );
    }
    return this.command(
      actor,
      scope,
      'READ',
      'Search scoped immutable journals',
      async (c) => {
        const rows = await c.manager.query(
          `SELECT j.*,j.accounting_date::text accounting_date,j.transaction_date::text transaction_date FROM finance_foundation_journals j WHERE j.tenant_id=$1 AND j.legal_entity_id=$2 AND j.book_id=$3 AND j.mode=$4 AND j.accounting_date BETWEEN $5::date AND $6::date AND ($7::date IS NULL OR (j.accounting_date,j.id)<($7::date,$8::uuid)) ORDER BY j.accounting_date DESC,j.id DESC LIMIT $9`,
          [
            ...c.ids,
            input.mode,
            input.from,
            input.to,
            input.beforeDate ?? null,
            input.beforeId ?? null,
            input.limit + 1,
          ],
        );
        const hasMore = rows.length > input.limit;
        const page = rows.slice(0, input.limit);
        for (const journal of page) await this.verifyJournal(c, journal);
        return {
          journals: page.map((j) => ({
            id: j.id,
            accountingDate: j.accounting_date,
            transactionDate: j.transaction_date,
            transactionCurrency: j.transaction_currency,
            functionalCurrency: j.functional_currency,
            kind: j.kind,
            reversalOf: j.reversal_of,
            subjectHash: j.subject_hash,
            financialEffects: j.financial_effects,
          })),
          hasMore,
          nextCursor: hasMore
            ? {
                beforeDate: page[page.length - 1].accounting_date,
                beforeId: page[page.length - 1].id,
              }
            : null,
          mode: input.mode,
        };
      },
    );
  }

  async exportJournals(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: { mode: FoundationMode; from: string; to: string },
  ) {
    modeOnly(input.mode);
    dateOnly(input.from);
    dateOnly(input.to);
    if (input.from > input.to)
      foundationFail('A valid journal export date range is required.');
    return this.command(
      actor,
      scope,
      'READ',
      'Export verified scoped journals',
      async (c) => {
        const [size] = await c.manager.query(
          `SELECT count(*)::integer AS journals,coalesce(sum(jsonb_array_length(payload->'lines')),0)::bigint AS lines FROM (SELECT j.payload FROM finance_foundation_journals j WHERE j.tenant_id=$1 AND j.legal_entity_id=$2 AND j.book_id=$3 AND j.mode=$4 AND j.accounting_date BETWEEN $5::date AND $6::date ORDER BY j.accounting_date,j.id LIMIT 1001) AS selected`,
          [...c.ids, input.mode, input.from, input.to],
        );
        if (size.journals > 1000 || BigInt(size.lines) > 10000n)
          foundationFail(
            'Journal export exceeds 1000 journals or 10000 lines; select a smaller date range.',
          );
        const journals = await c.manager.query(
          `SELECT j.*,j.accounting_date::text AS accounting_date,j.transaction_date::text AS transaction_date FROM finance_foundation_journals j WHERE j.tenant_id=$1 AND j.legal_entity_id=$2 AND j.book_id=$3 AND j.mode=$4 AND j.accounting_date BETWEEN $5::date AND $6::date ORDER BY j.accounting_date,j.id LIMIT 1001`,
          [...c.ids, input.mode, input.from, input.to],
        );
        if (journals.length > 1000)
          foundationFail(
            'Journal export exceeds 1000 journals; select a smaller date range.',
          );
        let lines = 0;
        for (const journal of journals) {
          await this.verifyJournal(c, journal);
          lines += journal.payload.lines.length;
          if (lines > 10000)
            foundationFail(
              'Journal export exceeds 10000 lines; select a smaller date range.',
            );
        }
        const exported = journals.map((journal) => ({
          id: journal.id,
          subjectHash: journal.subject_hash,
          kind: journal.kind,
          reversalOf: journal.reversal_of,
          accountingDate: journal.accounting_date,
          transactionDate: journal.transaction_date,
          transactionCurrency: journal.transaction_currency,
          functionalCurrency: journal.functional_currency,
          financialEffects: journal.financial_effects,
          payload: journal.payload,
        }));
        const manifest = {
          schema: 'FINANCE_JOURNAL_EXPORT_V1',
          tenantId: c.actor.tenantId,
          legalEntityId: c.scope.legalEntityId,
          bookId: c.scope.bookId,
          mode: input.mode,
          from: input.from,
          to: input.to,
          journals: exported,
        };
        return { ...manifest, evidenceHash: hash(manifest) };
      },
    );
  }

  async journal(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    mode: FoundationMode,
  ) {
    uuid(id);
    modeOnly(mode);
    return this.command(
      actor,
      scope,
      'READ',
      'Read immutable scoped journal',
      async (c) => {
        const [j] = await c.manager.query(
          'SELECT *,accounting_date::text accounting_date,transaction_date::text transaction_date FROM finance_foundation_journals WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND mode=$5',
          [...c.ids, id, mode],
        );
        if (!j)
          throw new ForbiddenException(
            'Journal is unavailable in this book and mode.',
          );
        await this.verifyJournal(c, j);
        return j;
      },
    );
  }

  async prepareAcceptance(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: {
      contextId: string;
      contextHash: string;
      openingId: string;
      openingHash: string;
      from: string;
      to: string;
      checks: { code: string; evidenceHash: string; reference: string }[];
      compatibilityEvidenceHash: string;
      historicalProtectionHash: string;
      scopeReference: string;
    },
    version: number,
    reason: string,
  ) {
    input = JSON.parse(canonicalFinanceJson(input));
    uuid(input.contextId);
    digest(input.contextHash);
    digest(input.compatibilityEvidenceHash);
    digest(input.historicalProtectionHash);
    if (
      !candidateText(input.scopeReference, 2000) ||
      !Array.isArray(input.checks) ||
      input.checks.length !== FOUNDATION_CHECKS.length ||
      new Set(input.checks.map((x) => x.code)).size !==
        FOUNDATION_CHECKS.length ||
      FOUNDATION_CHECKS.some((k) => !input.checks.some((x) => x.code === k))
    )
      foundationFail(
        'B45 needs an exact bounded foundation scope and evidence for every mandatory acceptance category.',
      );
    input.checks.forEach((x) => {
      digest(x.evidenceHash);
      if (!candidateText(x.reference, 2000))
        foundationFail('Acceptance evidence must have a traceable reference.');
    });
    return this.command(actor, scope, 'PREPARE', reason, async (c) => {
      const context = await this.reviewed(
        c,
        input.contextId,
        input.contextHash,
        'CURRENCY_CONTEXT',
      );
      const opening = await this.reviewed(
        c,
        input.openingId,
        input.openingHash,
        'OPENING',
      );
      if (opening.parent_id !== context.id)
        foundationFail(
          'B45 opening and currency context must refer to the same frozen version.',
        );
      const report = await this.report(c, { ...input, mode: 'VALIDATION' });
      return this.document(
        c,
        'B45_ACCEPTANCE',
        'VALIDATION',
        'B45',
        version,
        context.id,
        {
          ...input,
          reportEvidenceHash: report.evidenceHash,
          scope: 'FOUNDATION_ONLY',
          deferred: [
            'B15',
            'IFRS17_MEASUREMENT_ENGINE',
            'FULL_IFRS_NOTES',
            'FINANCE_DATABASE_EXTRACTION',
          ],
          technicalFinancialEffects: 0,
        },
      );
    });
  }
  async prepareRelease(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    input: {
      contextId: string;
      contextHash: string;
      acceptanceId: string;
      acceptanceHash: string;
      activeFrom: string;
      activeTo: string;
      sourceReconciliationHash: string;
      openingId: string;
      openingHash: string;
      historicalProtectionHash: string;
      authorityReference: string;
    },
    version: number,
    reason: string,
  ) {
    input = JSON.parse(canonicalFinanceJson(input));
    dateOnly(input.activeFrom);
    dateOnly(input.activeTo);
    digest(input.sourceReconciliationHash);
    digest(input.historicalProtectionHash);
    if (
      input.activeTo <= input.activeFrom ||
      !candidateText(input.authorityReference, 2000)
    )
      foundationFail(
        'A bounded prospective deployment authority and reconciled source population are required.',
      );
    return this.command(actor, scope, 'PREPARE', reason, async (c) => {
      const context = await this.reviewed(
          c,
          input.contextId,
          input.contextHash,
          'CURRENCY_CONTEXT',
        ),
        acceptance = await this.reviewed(
          c,
          input.acceptanceId,
          input.acceptanceHash,
          'B45_ACCEPTANCE',
        );
      if (
        acceptance.parent_id !== context.id ||
        acceptance.payload.contextHash !== context.subject_hash ||
        acceptance.payload.historicalProtectionHash !==
          input.historicalProtectionHash
      )
        foundationFail(
          'Release scope or historical protection differs from its reviewed B45 evidence.',
        );
      const config = normalizeCurrencyContext(context.payload);
      await this.releaseCoverage(c, config, input.activeFrom, input.activeTo);
      const opening = await this.reviewed(
        c,
        input.openingId,
        input.openingHash,
        'OPENING',
      );
      if (
        opening.mode !== 'LIVE' ||
        opening.parent_id !== context.id ||
        opening.payload.contextHash !== context.subject_hash ||
        opening.payload.date !== input.activeFrom ||
        opening.payload.sourceEvidenceHash !== input.sourceReconciliationHash
      )
        foundationFail(
          'A live release must pin its independently certified reconciled cutover opening and exact currency context.',
        );
      if (config.unresolvedDecisions.length)
        foundationFail(
          'Unresolved policy decisions cannot be promoted by a technical acceptance.',
        );
      await this.policies(c, config, 'APPROVED');
      const [{ today }] = await c.manager.query(
        'SELECT statement_timestamp()::date::text today',
      );
      if (input.activeFrom < today)
        foundationFail(
          'A production release cannot authorize retrospective posting.',
        );
      return this.document(
        c,
        'RELEASE',
        'LIVE',
        'BOOK_RELEASE',
        version,
        context.id,
        {
          ...input,
          policyPins: config.policyPins,
          sourceCompanyId: config.sourceCompanyId,
          basis: config.basis,
        },
      );
    });
  }
  /** Recheck the approved release inside the already-authorized FIN-01 activation transaction. */
  async verifyOperatingRelease(
    manager: EntityManager,
    actor: FoundationActor,
    scope: FinanceBookSelection,
    authorityId: string,
    profile: string,
    id: string,
    expectedHash: string,
    reason: string,
  ) {
    const command: Command = {
      manager,
      actor,
      scope,
      ids: [actor.tenantId, scope.legalEntityId, scope.bookId],
      authorityId,
      profile,
      limits: {},
      reason,
    };
    const release = await this.reviewed(command, id, expectedHash, 'RELEASE');
    await this.revalidate(command, release);
  }

  async deployment(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
    action: 'ENABLE' | 'DISABLE',
    reason: string,
  ) {
    uuid(id);
    digest(expectedHash);
    if (!['ENABLE', 'DISABLE'].includes(action))
      foundationFail('Explicit enable or disable action is required.');
    return this.command(actor, scope, 'RELEASE', reason, async (c) => {
      const release = await this.reviewed(c, id, expectedHash, 'RELEASE'),
        context = await this.reviewed(
          c,
          release.parent_id!,
          release.payload.contextHash,
          'CURRENCY_CONTEXT',
        ),
        config = normalizeCurrencyContext(context.payload);
      const [last] = await c.manager.query(
        'SELECT * FROM finance_foundation_deployments WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 ORDER BY sequence DESC LIMIT 1',
        [...c.ids],
      );
      if (
        last?.action === action ||
        (action === 'DISABLE' && last?.release_id !== id)
      )
        foundationFail('Deployment is stale or already in that state.');
      if (action === 'ENABLE') {
        await this.revalidate(c, release);
        await this.policies(c, config, 'ACTIVE');
        if (release.maker_natural_person_id === c.actor.naturalPersonId)
          throw new ForbiddenException(
            'Release preparer cannot independently enable the ledger.',
          );
        const [{ today }] = await c.manager.query(
          'SELECT statement_timestamp()::date::text today',
        );
        if (
          today < release.payload.activeFrom ||
          today >= release.payload.activeTo
        )
          foundationFail(
            'Deployment is outside its expressly approved interval.',
          );
        await c.manager.query(
          "UPDATE finance_legal_entities SET state='ACTIVE' WHERE tenant_id=$1 AND id=$2",
          c.ids.slice(0, 2),
        );
      }
      await c.manager.query(
        'INSERT INTO finance_foundation_deployments(tenant_id,legal_entity_id,book_id,action,release_id,release_hash,actor_subject_id,actor_natural_person_id,authority_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          ...c.ids,
          action,
          id,
          expectedHash,
          c.actor.subjectId,
          c.actor.naturalPersonId,
          c.authorityId,
          c.reason,
        ],
      );
      await c.manager.query(
        'UPDATE finance_accounting_books SET state=$4,accounting_basis_code=$5,functional_assessment_id=$6,chart_release_id=$7,presentation_context_id=$6 WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3',
        [
          ...c.ids,
          action === 'ENABLE' ? 'ACTIVE' : 'DRAFT',
          config.basis,
          context.id,
          config.chartReleaseId,
        ],
      );
      return {
        action,
        releaseId: id,
        policyActivation: false,
        financialEffects: 0,
      };
    });
  }
  async readiness(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    contextId: string,
    contextHash: string,
  ) {
    return this.command(
      actor,
      scope,
      'READ',
      'Inspect foundation readiness without activation',
      async (c) => {
        const context = await this.reviewed(
            c,
            contextId,
            contextHash,
            'CURRENCY_CONTEXT',
          ),
          config = normalizeCurrencyContext(context.payload),
          blockers: string[] = [];
        if (config.unresolvedDecisions.length)
          blockers.push(
            ...config.unresolvedDecisions.map((d) => 'UNRESOLVED:' + d),
          );
        try {
          await this.policies(c, config, 'ACTIVE');
        } catch (e) {
          blockers.push(
            e instanceof Error ? e.message : 'Policy approvals unavailable',
          );
        }
        const acceptances = await c.manager.query(
          "SELECT d.id,d.subject_hash,e.state FROM finance_foundation_documents d LEFT JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND d.kind='B45_ACCEPTANCE' AND d.parent_id=$4 ORDER BY d.created_at DESC",
          [...c.ids, context.id],
        );
        if (!acceptances.some((a) => a.state === 'REVIEWED'))
          blockers.push('B45_INDEPENDENT_TECHNICAL_ACCEPTANCE_REQUIRED');
        const [deployment] = await c.manager.query(
          'SELECT action,release_id FROM finance_foundation_deployments WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 ORDER BY sequence DESC LIMIT 1',
          c.ids,
        );
        try {
          const [{ today }] = await c.manager.query(
            'SELECT statement_timestamp()::date::text today',
          );
          await this.live(c, context, today);
          const [period] = await c.manager.query(
            "SELECT id FROM finance_foundation_periods WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND mode='LIVE' AND state='OPEN' AND starts_on<=$4::date AND ends_before>$4::date",
            [...c.ids, today],
          );
          if (!period) blockers.push('CURRENT_OPEN_LIVE_PERIOD_REQUIRED');
        } catch {
          blockers.push('EXACT_CURRENT_COMPANY_ADMIN_DEPLOYMENT_REQUIRED');
        }
        return {
          scope: { tenantId: c.actor.tenantId, ...c.scope },
          contextId,
          contextHash,
          acceptanceScope: 'FOUNDATION_ONLY',
          overallFinanceProductionAccepted: false,
          technicalAcceptance: acceptances.some((a) => a.state === 'REVIEWED'),
          productionEligible: blockers.length === 0,
          blockers,
          policyActivation: false,
          financialEffects: 0,
        };
      },
    );
  }

  withWorkflowAuthority<T>(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    capability: 'READ' | 'PREPARE' | 'REVIEW' | 'RELEASE',
    reason: string,
    work: (command: Command) => Promise<T>,
    manager?: EntityManager,
  ) {
    return this.command(actor, scope, capability, reason, work, manager);
  }

  private async command<T>(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    capability: FoundationCapability,
    reason: string,
    work: (c: Command) => Promise<T>,
    existingManager?: EntityManager,
  ): Promise<T> {
    const normalized = foundationIdentity(actor, scope);
    actor = { ...actor, ...normalized.actor };
    scope = normalized.scope;
    if (!candidateText(reason, 2000))
      foundationFail('A bounded recorded reason is required.');
    const execute = async (manager: EntityManager) => {
      const [{ deployed }] = await manager.query(
        "SELECT to_regclass('public.finance_foundation_authorities') IS NOT NULL deployed",
      );
      if (!deployed)
        foundationFail(
          'B43-B45 storage and trusted authorities are not deployed.',
        );
      const ids = [actor.tenantId, scope.legalEntityId, scope.bookId];
      const [book] = await manager.query(
        `SELECT b.id,l.business_profile FROM finance_accounting_books b JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id WHERE b.tenant_id=$1 AND b.legal_entity_id=$2 AND b.id=$3 AND b.state<>'DISABLED' AND l.state<>'DISABLED' FOR ${capability === 'READ' ? 'SHARE' : 'UPDATE'} OF b`,
        ids,
      );
      if (!book)
        throw new ForbiddenException('Requested Finance scope is unavailable.');
      const authorities = await manager.query(
        `SELECT id,limits FROM finance_foundation_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND capability=$6 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE`,
        [...ids, actor.subjectId, actor.naturalPersonId, capability],
      );
      if (authorities.length !== 1)
        throw new ForbiddenException(
          'A unique current Finance scope mandate is required for ' +
            capability +
            '.',
        );
      if (actor.identityBindingId) {
        const [binding] = await manager.query(
          'SELECT id FROM finance_foundation_identity_bindings WHERE id=$1 AND tenant_id=$2 AND legal_entity_id=$3 AND book_id=$4 AND subject_id=$5 AND natural_person_id=$6 AND source_company_id=$7 AND source_user_id=$8 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE',
          [
            actor.identityBindingId,
            ...ids,
            actor.subjectId,
            actor.naturalPersonId,
            actor.sourceCompanyId,
            actor.sourceUserId,
          ],
        );
        if (!binding)
          throw new ForbiddenException(
            'Trusted identity binding expired or was revoked.',
          );
      }
      const c = {
          manager,
          actor,
          scope,
          ids,
          authorityId: authorities[0].id,
          limits: authorities[0].limits,
          profile: book.business_profile,
          reason,
        },
        result = await work(c);
      const [current] = await manager.query(
        'SELECT id FROM finance_foundation_authorities WHERE id=$1 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())',
        [c.authorityId],
      );
      if (!current)
        throw new ForbiddenException(
          'Finance authority expired before transaction completion.',
        );
      return result;
    };
    if (existingManager) {
      if (
        existingManager.connection !== this.source ||
        !existingManager.queryRunner?.isTransactionActive
      )
        foundationFail('An active ledger transaction is required.');
      return execute(existingManager);
    }
    return this.source.transaction(
      capability === 'READ' ? 'REPEATABLE READ' : 'READ COMMITTED',
      execute,
    );
  }
  private async document(
    c: Command,
    kind: string,
    mode: FoundationMode,
    key: string,
    version: number,
    parentId: string | null,
    payload: unknown,
  ) {
    if (
      !Number.isSafeInteger(version) ||
      version < 1 ||
      !candidateText(key, 250)
    )
      foundationFail('Versioned document identity is required.');
    const frozen = JSON.parse(canonicalFinanceJson(payload)),
      subjectHash = hash({
        tenantId: c.actor.tenantId,
        ...c.scope,
        kind,
        mode,
        key,
        version,
        parentId,
        payload: frozen,
      });
    const [d] = await c.manager.query(
      'INSERT INTO finance_foundation_documents(tenant_id,legal_entity_id,book_id,kind,mode,document_key,version,parent_id,payload,subject_hash,maker_subject_id,maker_natural_person_id,authority_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',
      [
        ...c.ids,
        kind,
        mode,
        key,
        version,
        parentId,
        frozen,
        subjectHash,
        c.actor.subjectId,
        c.actor.naturalPersonId,
        c.authorityId,
      ],
    );
    return {
      id: d.id,
      subjectHash,
      state: 'DRAFT',
      policyActivation: false,
      financialEffects: 0,
    };
  }
  private async getDocument(
    c: Command,
    id: string,
    expectedHash: string,
  ): Promise<FoundationDocument> {
    uuid(id);
    digest(expectedHash);
    const [d] = await c.manager.query(
      'SELECT d.*,e.state FROM finance_foundation_documents d LEFT JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND d.id=$4 FOR SHARE OF d',
      [...c.ids, id],
    );
    if (
      !d ||
      d.subject_hash !== expectedHash ||
      hash({
        tenantId: c.actor.tenantId,
        ...c.scope,
        kind: d.kind,
        mode: d.mode,
        key: d.document_key,
        version: d.version,
        parentId: d.parent_id,
        payload: d.payload,
      }) !== expectedHash
    )
      throw new ForbiddenException(
        'Exact frozen foundation document is unavailable in this scope.',
      );
    return d;
  }
  private async reviewed(
    c: Command,
    id: string,
    expectedHash: string,
    kind: string,
  ) {
    const d = await this.getDocument(c, id, expectedHash);
    if (
      d.kind !== kind ||
      d.state !== (kind === 'RELEASE' ? 'APPROVED' : 'REVIEWED')
    )
      foundationFail('Exact independently reviewed ' + kind + ' is required.');
    return d;
  }
  private async chart(
    c: Command,
    p: CurrencyContextInput,
    date: string,
    through?: string,
  ): Promise<FinanceChartProposal> {
    const [r] = await c.manager.query(
      "SELECT *,effective_from::text effective_from,effective_to::text effective_to FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND state IN ('REVIEWED_INACTIVE','SUPERSEDED_INACTIVE') AND kind='ACCOUNT_ROLES' FOR SHARE",
      [...c.ids, p.chartReleaseId],
    );
    if (
      !r ||
      (r.state === 'SUPERSEDED_INACTIVE' &&
        !(await retainedChartAuthorized(
          c.manager,
          c.ids,
          p.chartReleaseId,
          p.chartReleaseHash,
          date,
          through,
        ))) ||
      r.release_hash !== p.chartReleaseHash ||
      r.effective_from > date ||
      (r.effective_to && r.effective_to <= date) ||
      (through && r.effective_to && r.effective_to < through) ||
      r.payload.schema !== 'FINANCE_CHART_SNAPSHOT_V1' ||
      r.payload.entityProfile !== c.profile
    )
      foundationFail(
        'Exact reviewed chart, effective date and entity profile are required.',
      );
    return validateFinanceChart(
      r.payload.proposal,
      c.profile,
      r.dependency_refs,
    );
  }
  private async releaseCoverage(
    c: Command,
    config: CurrencyContextInput,
    from: string,
    to: string,
  ) {
    if (
      from < config.effectiveFrom ||
      (config.effectiveTo && to > config.effectiveTo)
    )
      foundationFail(
        'The currency context must cover the entire release interval.',
      );
    await this.chart(c, config, from, to);
  }
  private async revalidate(c: Command, d: FoundationDocument) {
    if (d.kind === 'CURRENCY_CONTEXT') {
      const p = normalizeCurrencyContext(d.payload);
      this.contextRoles(p, await this.chart(c, p, p.effectiveFrom));
    } else if (d.kind === 'EXCHANGE_RATE') {
      const context = await this.reviewed(
        c,
        d.parent_id!,
        d.payload.contextHash,
        'CURRENCY_CONTEXT',
      );
      fixedRate(d.payload.rate);
      if (context.id !== d.payload.contextId)
        foundationFail('Rate context changed.');
    } else if (d.kind === 'OPENING') {
      const context = await this.reviewed(
          c,
          d.parent_id!,
          d.payload.contextHash,
          'CURRENCY_CONTEXT',
        ),
        config = normalizeCurrencyContext(context.payload);
      this.openingBalances(
        d.payload.balances,
        await this.chart(c, config, d.payload.date),
        config.currencyScales[config.functionalCurrency],
      );
      if (
        hash(await this.population(c, d.mode, d.payload.date)) !==
        d.payload.coveredLedgerHash
      )
        foundationFail(
          'The opening source/ledger population changed before independent certification.',
        );
      const [prior] = await c.manager.query(
        "SELECT d.id FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND d.kind='OPENING' AND d.mode=$4 AND d.payload->>'date'=$5 AND e.state='REVIEWED' AND d.id<>$6",
        [...c.ids, d.mode, d.payload.date, d.id],
      );
      if (prior)
        foundationFail(
          'A certified opening already exists for this date; use an approved controlled adjustment.',
        );
    } else if (d.kind === 'B45_ACCEPTANCE') {
      const report = await this.report(c, { ...d.payload, mode: 'VALIDATION' });
      if (report.evidenceHash !== d.payload.reportEvidenceHash)
        foundationFail(
          'Ledger/report population changed after the acceptance manifest was frozen.',
        );
    } else if (d.kind === 'RELEASE') {
      const context = await this.reviewed(
          c,
          d.parent_id!,
          d.payload.contextHash,
          'CURRENCY_CONTEXT',
        ),
        acceptance = await this.reviewed(
          c,
          d.payload.acceptanceId,
          d.payload.acceptanceHash,
          'B45_ACCEPTANCE',
        );
      await this.revalidate(c, acceptance);
      const opening = await this.reviewed(
        c,
        d.payload.openingId,
        d.payload.openingHash,
        'OPENING',
      );
      await this.revalidate(c, opening);
      if (
        opening.mode !== 'LIVE' ||
        opening.parent_id !== context.id ||
        opening.payload.date !== d.payload.activeFrom ||
        opening.payload.sourceEvidenceHash !==
          d.payload.sourceReconciliationHash
      )
        foundationFail(
          'Certified live opening differs from the expressly approved release.',
        );
      if (acceptance.parent_id !== context.id)
        foundationFail('Release and technical acceptance contexts differ.');
      await this.releaseCoverage(
        c,
        normalizeCurrencyContext(context.payload),
        d.payload.activeFrom,
        d.payload.activeTo,
      );
      await this.policies(
        c,
        normalizeCurrencyContext(context.payload),
        'APPROVED',
      );
    } else foundationFail('Unsupported foundation document type.');
  }
  private contextRoles(
    config: CurrencyContextInput,
    chart: FinanceChartProposal,
  ) {
    for (const component of config.allowedComponents)
      for (const code of [...component.debitRoles, ...component.creditRoles]) {
        const role = chart.roles.find((r) => r.code === code),
          account = chart.accounts.find((a) => a.code === role?.accountCode);
        if (!role?.accountCode || !account?.posting)
          foundationFail(
            'Every configured posting-rule role must resolve to an explicit posting account in the pinned chart.',
          );
      }
  }
  private openingBalances(
    balances: { accountCode: string; signedBalance: string }[],
    chart: FinanceChartProposal,
    scale: number,
  ) {
    const expected = chart.accounts
        .filter((a) => a.posting)
        .map((a) => a.code)
        .sort(),
      actual = balances.map((b) => b.accountCode).sort();
    if (hash(expected) !== hash(actual))
      foundationFail(
        'Opening certificate must explicitly cover every posting account, including genuine zero balances.',
      );
    let total = 0n;
    for (const b of balances) {
      const value = signedUnits(b.signedBalance);
      if (value % 10n ** BigInt(12 - scale) !== 0n)
        foundationFail(
          'Opening amount exceeds the configured functional precision.',
        );
      total += value;
    }
    if (total !== 0n)
      foundationFail(
        'Certified opening does not balance; no balancing plug is created.',
      );
  }
  private async population(c: Command, mode: FoundationMode, before: string) {
    return c.manager.query(
      'SELECT id,subject_hash FROM finance_foundation_journals WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND mode=$4 AND accounting_date<$5::date ORDER BY sequence',
      [...c.ids, mode, before],
    );
  }
  private async periodAudit(c: Command, p: any, evidenceHash: string) {
    await c.manager.query(
      'INSERT INTO finance_foundation_period_events(tenant_id,legal_entity_id,book_id,period_id,revision,state,actor_subject_id,actor_natural_person_id,authority_id,reason,evidence_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        ...c.ids,
        p.id,
        p.revision,
        p.state,
        c.actor.subjectId,
        c.actor.naturalPersonId,
        c.authorityId,
        c.reason,
        evidenceHash,
      ],
    );
  }
  private async policies(
    c: Command,
    config: CurrencyContextInput,
    state: 'APPROVED' | 'ACTIVE',
  ) {
    const [{ today }] = await c.manager.query(
      'SELECT statement_timestamp()::date::text today',
    );
    const required = [
      ...new Set([
        'AP-01.01',
        'AP-02.01',
        'AP-03.01',
        'AP-04.01',
        'AP-05.01',
        'AP-06.01',
        'AP-06.02',
        'AP-33.01',
        ...(Object.keys(config.currencyScales).some(
          (code) => code !== config.functionalCurrency,
        )
          ? ['AP-20.04']
          : []),
        'AP-20.01',
        'AP-31.01',
        'AP-32.01',
        ...(config.allowedComponents.some((x) => x.sourceEventType === null)
          ? ['AP-04.02']
          : []),
        ...config.allowedComponents.map((x) => x.policyCode),
      ]),
    ];
    const found = new Set<string>();
    for (const pin of config.policyPins) {
      const [p] = await c.manager.query(
        'SELECT p.*,e.to_state FROM finance_policy_versions p JOIN LATERAL(SELECT to_state FROM finance_policy_events WHERE policy_id=p.id ORDER BY sequence DESC LIMIT 1)e ON true WHERE p.tenant_id=$1 AND p.legal_entity_id=$2 AND p.book_id=$3 AND p.id=$4 FOR SHARE OF p',
        [...c.ids, pin.id],
      );
      if (
        !p ||
        p.definition_hash !== pin.hash ||
        policyDefinitionHash(policyDefinition(p.definition)) !== pin.hash ||
        !['APPROVED', 'ACTIVE'].includes(p.to_state) ||
        (state === 'ACTIVE' && p.to_state !== 'ACTIVE') ||
        p.profile === 'PLATFORM_TEMPLATE' ||
        p.definition.effectiveFrom > today ||
        (p.definition.effectiveTo !== null &&
          p.definition.effectiveTo <= today) ||
        p.definition.unresolvedDecisions.length ||
        p.definition.configuration.currencyContextHash !==
          currencyContextPolicyHash(config) ||
        p.definition.configuration.businessProfile !== c.profile
      )
        foundationFail(
          'Company-admin ' +
            state +
            ' of every exact context-bound policy version is required.',
        );
      if (state === 'ACTIVE')
        for (const dependency of p.definition.dependencyPolicyHashes) {
          const [active] = await c.manager.query(
            "SELECT v.id FROM finance_policy_versions v JOIN LATERAL(SELECT to_state FROM finance_policy_events WHERE policy_id=v.id ORDER BY sequence DESC LIMIT 1)e ON true WHERE v.tenant_id=$1 AND v.legal_entity_id=$2 AND v.book_id=$3 AND v.definition_hash=$4 AND e.to_state='ACTIVE' AND v.definition->>'effectiveFrom'<=$5 AND ((v.definition->>'effectiveTo') IS NULL OR v.definition->>'effectiveTo'>$5) FOR SHARE OF v",
            [...c.ids, dependency, today],
          );
          if (!active)
            foundationFail('A required policy dependency is no longer active.');
        }
      found.add(p.policy_code);
    }
    if (
      config.unresolvedDecisions.length ||
      required.some((id) => !found.has(id))
    )
      foundationFail(
        'Mandatory foundation accounting policies or decisions remain unresolved.',
      );
  }
  private async live(
    c: Command,
    context: FoundationDocument | null,
    date: string,
  ) {
    const [{ today }] = await c.manager.query(
      'SELECT statement_timestamp()::date::text today',
    );
    const [d] = await c.manager.query(
      "SELECT r.*,e.state FROM finance_foundation_deployments x JOIN finance_foundation_documents r ON r.id=x.release_id JOIN finance_foundation_decisions e ON e.document_id=r.id JOIN finance_accounting_books b ON b.tenant_id=x.tenant_id AND b.legal_entity_id=x.legal_entity_id AND b.id=x.book_id JOIN finance_legal_entities l ON l.tenant_id=b.tenant_id AND l.id=b.legal_entity_id WHERE x.tenant_id=$1 AND x.legal_entity_id=$2 AND x.book_id=$3 AND x.sequence=(SELECT max(sequence) FROM finance_foundation_deployments WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3) AND x.action='ENABLE' AND b.state='ACTIVE' AND l.state='ACTIVE'",
      c.ids,
    );
    if (
      !d ||
      d.state !== 'APPROVED' ||
      (context && d.parent_id !== context.id) ||
      date < d.payload.activeFrom ||
      date >= d.payload.activeTo ||
      today < d.payload.activeFrom ||
      today >= d.payload.activeTo
    )
      foundationFail(
        'Live ledger needs the exact independently approved company-admin release, active book and prospective interval.',
      );
    const selected =
      context ??
      (await this.reviewed(
        c,
        d.parent_id,
        d.payload.contextHash,
        'CURRENCY_CONTEXT',
      ));
    const cfg = normalizeCurrencyContext(selected.payload);
    if (
      date < cfg.effectiveFrom ||
      (cfg.effectiveTo && date >= cfg.effectiveTo)
    )
      foundationFail('Currency context is outside its effective interval.');
    await this.chart(c, cfg, date);
    await this.policies(c, cfg, 'ACTIVE');
  }
  private async verifyJournal(c: Command, j: any) {
    if (
      hash({
        tenantId: c.actor.tenantId,
        ...c.scope,
        mode: j.mode,
        payload: j.payload,
      }) !== j.subject_hash
    )
      foundationFail('Accepted journal payload hash differs.');
    const lines = await c.manager.query(
      'SELECT * FROM finance_foundation_lines WHERE journal_id=$1 ORDER BY line_key',
      [j.id],
    );
    if (
      lines.length !== j.payload.lines.length ||
      j.payload.lines.some((l: any) => {
        const x = lines.find((x) => x.line_key === l.lineKey);
        return (
          !x ||
          x.account_code !== l.accountCode ||
          x.role_code !== l.roleCode ||
          x.transaction_debit !== l.transactionDebit ||
          x.transaction_credit !== l.transactionCredit ||
          x.functional_debit !== l.functionalDebit ||
          x.functional_credit !== l.functionalCredit ||
          x.rounding_debit !== l.roundingDebit ||
          x.rounding_credit !== l.roundingCredit ||
          hash(x.dimensions) !== hash(l.dimensions)
        );
      })
    )
      foundationFail(
        'Accepted ledger lines differ from their sealed evidence.',
      );
  }
  private async report(
    c: Command,
    input: {
      mode: FoundationMode;
      openingId: string;
      openingHash: string;
      from: string;
      to: string;
    },
    manager?: EntityManager,
  ) {
    modeOnly(input.mode);
    dateOnly(input.from);
    dateOnly(input.to);
    if (input.from >= input.to)
      foundationFail('Report period must be a nonempty half-open interval.');
    const reportRequest = {
      mode: input.mode,
      openingId: input.openingId,
      openingHash: input.openingHash,
      from: input.from,
      to: input.to,
    };
    const opening = await this.reviewed(
      c,
      input.openingId,
      input.openingHash,
      'OPENING',
    );
    if (opening.mode !== input.mode || opening.payload.date > input.from)
      foundationFail(
        'Opening certificate has a different mode or starts after this report.',
      );
    const [newer] = await c.manager.query(
      "SELECT d.id FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id WHERE d.tenant_id=$1 AND d.legal_entity_id=$2 AND d.book_id=$3 AND d.kind='OPENING' AND d.mode=$4 AND e.state='REVIEWED' AND d.payload->>'date'>$5 AND d.payload->>'date'<=$6 LIMIT 1",
      [...c.ids, input.mode, opening.payload.date, input.from],
    );
    if (newer)
      foundationFail(
        'A newer certified opening supersedes the selected certificate for this window.',
      );
    const rows = new Map<
      string,
      { opening: bigint; debit: bigint; credit: bigint }
    >(
      (
        opening.payload.balances as {
          accountCode: string;
          signedBalance: string;
        }[]
      ).map((b) => [
        b.accountCode,
        { opening: signedUnits(b.signedBalance), debit: 0n, credit: 0n },
      ]),
    );
    const journals = await c.manager.query(
      'SELECT j.*,j.accounting_date::text accounting_date FROM finance_foundation_journals j WHERE j.tenant_id=$1 AND j.legal_entity_id=$2 AND j.book_id=$3 AND j.mode=$4 AND j.accounting_date>=$5::date AND j.accounting_date<$6::date ORDER BY j.accounting_date,j.sequence LIMIT 10001',
      [...c.ids, input.mode, opening.payload.date, input.to],
    );
    if (journals.length > 10000)
      foundationFail(
        'This report exceeds the bounded complete-population limit. Request a narrower window; no partial totals are returned.',
      );
    const sources = [] as {
      id: string;
      subjectHash: string;
      date: string;
      transactionCurrency: string;
      source: unknown;
      lines: any[];
    }[];
    for (const j of journals) {
      await this.verifyJournal(c, j);
      if (j.functional_currency !== opening.payload.functionalCurrency)
        foundationFail(
          'Functional currency changed; an approved transition opening is required.',
        );
      for (const l of j.payload.lines) {
        const r = rows.get(l.accountCode);
        if (!r)
          foundationFail(
            'Journal account is absent from the certified opening chart.',
          );
        const dr = units(l.functionalDebit),
          cr = units(l.functionalCredit);
        if (j.accounting_date < input.from) r.opening += dr - cr;
        else {
          r.debit += dr;
          r.credit += cr;
        }
      }
      sources.push({
        id: j.id,
        subjectHash: j.subject_hash,
        date: j.accounting_date,
        transactionCurrency: j.transaction_currency,
        source: j.payload.source,
        lines: j.payload.lines,
      });
    }
    const reportRows = [...rows]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([accountCode, r]) => ({
        accountCode,
        opening: stored(r.opening),
        debit: stored(r.debit),
        credit: stored(r.credit),
        closing: stored(r.opening + r.debit - r.credit),
      }));
    const sum = (field: 'opening' | 'debit' | 'credit' | 'closing') =>
      reportRows.reduce((s, r) => s + signedUnits(r[field]), 0n);
    if (
      sum('opening') !== 0n ||
      sum('closing') !== 0n ||
      sum('debit') !== sum('credit')
    )
      foundationFail(
        'Source-to-journal-to-account-to-trial-balance controls do not reconcile.',
      );
    return {
      scope: { tenantId: c.actor.tenantId, ...c.scope },
      mode: input.mode,
      from: input.from,
      to: input.to,
      currency: opening.payload.functionalCurrency,
      openingId: opening.id,
      rows: reportRows,
      totalDebit: stored(sum('debit')),
      totalCredit: stored(sum('credit')),
      journals: sources,
      evidenceHash: hash({
        scope: c.ids,
        input: reportRequest,
        openingHash: opening.subject_hash,
        journals: sources,
      }),
      financialEffects: 0,
    };
  }
}
