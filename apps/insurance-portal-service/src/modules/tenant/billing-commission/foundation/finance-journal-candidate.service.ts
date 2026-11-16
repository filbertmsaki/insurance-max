import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  canonicalFinanceJson,
  financeConfigurationHash,
  FINANCE_UUID,
  isFinanceDate,
  type FinanceConfigurationActor,
} from './finance-configuration.types';
import {
  validateFinanceChart,
  type FinanceChartProposal,
} from './finance-chart.types';
import {
  candidateCode,
  candidateRevision,
  candidateText,
  normalizeJournalCandidate,
  type JournalCandidateInput,
} from './finance-journal-candidate.types';
import type { FinanceBookSelection } from './finance-scope.service';
import { retainedChartAuthorized } from './finance-retained-chart';
import { FinanceApprovalService } from './finance-approval.service';
import {
  validateApprovalToken,
  type ApprovalToken,
} from './finance-approval.types';

type Permission =
  | 'MANAGE_DRAFT_PERIOD'
  | 'PREPARE_CANDIDATE'
  | 'VALIDATE_CANDIDATE';
export interface Period {
  id: string;
  tenant_id: string;
  legal_entity_id: string;
  book_id: string;
  period_code: string;
  starts_on: string;
  ends_before: string;
  state: 'SEALED_DRAFT' | 'OPEN_FOR_VALIDATION';
  revision: number;
}
export interface InactiveJournalCandidate {
  id: string;
  tenant_id: string;
  legal_entity_id: string;
  book_id: string;
  period_id: string;
  period_revision: number;
  accounting_date: string;
  chart_release_id: string;
  chart_release_hash: string;
  currency: string;
  decimal_scale: number;
  economic_key: string;
  kind: 'ORIGINAL' | 'REVERSAL';
  correction_of_id: string | null;
  correction_of_hash: string | null;
  payload: JournalCandidateInput;
  subject_hash: string;
  maker_subject_id: string;
  maker_natural_person_id: string;
  state: 'PREPARED_INACTIVE' | 'VALIDATED_INACTIVE';
  checker_subject_id: string | null;
  checker_natural_person_id: string | null;
}
interface Command {
  completionChecks: (() => Promise<void>)[];
  manager: EntityManager;
  actor: FinanceConfigurationActor;
  scope: FinanceBookSelection;
  authorityId: string;
  profile: string;
  reason: string;
}

/** Isolated validation records. Never calls FinanceJournalService or posts GL. */
@Injectable()
export class FinanceJournalCandidateService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    private readonly approvals: FinanceApprovalService = new FinanceApprovalService(
      source,
    ),
  ) {}

  async createDraftPeriod(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    input: { code: string; startsOn: string; endsBefore: string },
    reason: string,
  ): Promise<Period> {
    const p = { ...input };
    if (
      !candidateCode(p.code) ||
      p.code.length > 50 ||
      !isFinanceDate(p.startsOn) ||
      !isFinanceDate(p.endsBefore) ||
      p.endsBefore <= p.startsOn
    )
      throw new BadRequestException(
        'An explicit nonempty half-open draft period is required.',
      );
    return this.command(
      actor,
      scope,
      'MANAGE_DRAFT_PERIOD',
      reason,
      async (c) => {
        const [overlap] = await c.manager.query(
          'SELECT id FROM finance_draft_periods WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND starts_on < $5::date AND ends_before > $4::date',
          [...this.scope(c), p.startsOn, p.endsBefore],
        );
        if (overlap)
          throw new ConflictException(
            'Draft periods cannot overlap in a book.',
          );
        const [row]: Period[] = await c.manager.query(
          'INSERT INTO finance_draft_periods (tenant_id,legal_entity_id,book_id,period_code,starts_on,ends_before) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *,starts_on::text AS starts_on,ends_before::text AS ends_before',
          [...this.scope(c), p.code, p.startsOn, p.endsBefore],
        );
        await this.event(
          c,
          row,
          null,
          'PERIOD_CREATED',
          financeConfigurationHash(row),
        );
        return row;
      },
    );
  }

  async fenceDraftPeriod(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedRevision: number,
    state: Period['state'],
    reason: string,
  ): Promise<Period> {
    this.uuid(id);
    if (
      !candidateRevision(expectedRevision) ||
      !['SEALED_DRAFT', 'OPEN_FOR_VALIDATION'].includes(state)
    )
      throw new BadRequestException(
        'An exact draft-period revision and validation state are required.',
      );
    return this.command(
      actor,
      scope,
      'MANAGE_DRAFT_PERIOD',
      reason,
      async (c) => {
        const row = await this.period(c, id.toLowerCase());
        if (
          row.revision !== expectedRevision ||
          row.state === state ||
          row.revision === 2147483647
        )
          throw new ConflictException(
            'Draft-period revision or expected transition differs.',
          );
        const [updated]: Period[] = await c.manager.query(
          'WITH changed AS (UPDATE finance_draft_periods SET state=$5, revision=revision+1 WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 RETURNING *) SELECT *,starts_on::text AS starts_on,ends_before::text AS ends_before FROM changed',
          [...this.scope(c), row.id, state],
        );
        await this.event(
          c,
          updated,
          null,
          'PERIOD_FENCED',
          financeConfigurationHash(updated),
        );
        return updated;
      },
    );
  }

  async prepareInactive(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    value: JournalCandidateInput,
    reason: string,
  ): Promise<InactiveJournalCandidate> {
    const p = normalizeJournalCandidate(value);
    return this.command(
      actor,
      scope,
      'PREPARE_CANDIDATE',
      reason,
      async (c) => {
        const period = await this.openPeriod(c, p);
        const chart = await this.chart(c, p);
        const resolved = this.resolveLines(p, chart);
        const economicKey = financeConfigurationHash({
          origin: p.economicOrigin,
          sourceId: p.economicSourceId,
          component: p.economicComponent,
        });
        const kind = p.correctionOf ? 'REVERSAL' : 'ORIGINAL';
        const hash = financeConfigurationHash({
          tenantId: c.actor.tenantId,
          ...c.scope,
          payload: p,
          lines: resolved,
        });
        const [existing]: InactiveJournalCandidate[] = await c.manager.query(
          'SELECT *,accounting_date::text AS accounting_date FROM finance_journal_candidates WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND economic_key=$4 AND kind=$5',
          [...this.scope(c), economicKey, kind],
        );
        if (existing) {
          if (
            existing.subject_hash !== hash ||
            existing.maker_subject_id !== c.actor.subjectId ||
            existing.maker_natural_person_id !== c.actor.naturalPersonId
          )
            throw new ConflictException(
              'Economic candidate already exists with a different subject or preparer.',
            );
          await this.persisted(c, existing, chart);
          return existing;
        }
        if (p.correctionOf) await this.reversal(c, p, economicKey);
        const [row]: InactiveJournalCandidate[] = await c.manager.query(
          `INSERT INTO finance_journal_candidates
        (tenant_id,legal_entity_id,book_id,period_id,period_revision,accounting_date,chart_release_id,chart_release_hash,currency,decimal_scale,economic_key,kind,correction_of_id,correction_of_hash,payload,subject_hash,maker_subject_id,maker_natural_person_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18) RETURNING *,accounting_date::text AS accounting_date`,
          [
            ...this.scope(c),
            p.periodId,
            p.periodRevision,
            p.accountingDate,
            p.chartReleaseId,
            p.chartReleaseHash,
            p.currency,
            p.decimalScale,
            economicKey,
            kind,
            p.correctionOf?.id ?? null,
            p.correctionOf?.hash ?? null,
            canonicalFinanceJson(p),
            hash,
            c.actor.subjectId,
            c.actor.naturalPersonId,
          ],
        );
        for (const line of resolved)
          await c.manager.query(
            `INSERT INTO finance_journal_candidate_lines (tenant_id,legal_entity_id,book_id,candidate_id,line_key,role_code,account_code,debit,credit,dimensions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
            [
              ...this.scope(c),
              row.id,
              line.lineKey,
              line.roleCode,
              line.accountCode,
              line.debit,
              line.credit,
              canonicalFinanceJson(line.dimensions),
            ],
          );
        await this.persisted(c, row, chart);
        await this.event(c, period, row, 'PREPARED_INACTIVE', hash);
        return row;
      },
    );
  }

  async validateInactive(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    id: string,
    expectedHash: string,
    reason: string,
    approval?: ApprovalToken,
  ): Promise<InactiveJournalCandidate> {
    this.uuid(id);
    if (!/^[0-9a-f]{64}$/.test(expectedHash))
      throw new BadRequestException('Exact candidate hash is required.');
    const frozenApproval =
      approval === undefined ? undefined : validateApprovalToken(approval);
    return this.command(
      actor,
      scope,
      'VALIDATE_CANDIDATE',
      reason,
      async (c) => {
        const [row]: InactiveJournalCandidate[] = await c.manager.query(
          'SELECT *,accounting_date::text AS accounting_date FROM finance_journal_candidates WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR UPDATE',
          [...this.scope(c), id.toLowerCase()],
        );
        if (
          !row ||
          row.subject_hash !== expectedHash ||
          row.state !== 'PREPARED_INACTIVE'
        )
          throw new ConflictException(
            'Candidate scope, hash or state differs.',
          );
        if (
          row.maker_subject_id === c.actor.subjectId ||
          row.maker_natural_person_id === c.actor.naturalPersonId
        )
          throw new ForbiddenException(
            'The preparer cannot validate their candidate, including through an alias.',
          );
        const period = await this.openPeriod(c, row.payload),
          chart = await this.chart(c, row.payload);
        await this.persisted(c, row, chart);
        if (row.payload.correctionOf)
          await this.reversal(c, row.payload, row.economic_key);
        await this.approvals.consumeInactive(
          c.manager,
          c.actor,
          c.scope,
          row,
          frozenApproval,
          reason,
          c.completionChecks,
        );
        const [validated]: InactiveJournalCandidate[] = await c.manager.query(
          `WITH changed AS (UPDATE finance_journal_candidates SET state='VALIDATED_INACTIVE',checker_subject_id=$5,checker_natural_person_id=$6,validated_at=statement_timestamp() WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 RETURNING *) SELECT *,accounting_date::text AS accounting_date FROM changed`,
          [
            ...this.scope(c),
            row.id,
            c.actor.subjectId,
            c.actor.naturalPersonId,
          ],
        );
        await this.event(
          c,
          period,
          validated,
          'VALIDATED_INACTIVE',
          row.subject_hash,
        );
        return validated;
      },
    );
  }

  private async reversal(c: Command, p: JournalCandidateInput, key: string) {
    const ref = p.correctionOf!;
    const [original]: InactiveJournalCandidate[] = await c.manager.query(
      'SELECT *,accounting_date::text AS accounting_date FROM finance_journal_candidates WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR SHARE',
      [...this.scope(c), ref.id],
    );
    if (
      !original ||
      original.state !== 'VALIDATED_INACTIVE' ||
      original.kind !== 'ORIGINAL' ||
      original.subject_hash !== ref.hash ||
      original.economic_key !== key ||
      original.currency !== p.currency ||
      original.decimal_scale !== p.decimalScale ||
      original.chart_release_id !== p.chartReleaseId ||
      original.chart_release_hash !== p.chartReleaseHash ||
      original.payload.sourceRevision !== p.sourceRevision
    )
      throw new ConflictException(
        'A reversal requires the exact validated inactive original, economic identity, chart and units.',
      );
    const inverse = original.payload.lines.map((l) => ({
      ...l,
      debit: l.credit,
      credit: l.debit,
    }));
    if (canonicalFinanceJson(inverse) !== canonicalFinanceJson(p.lines))
      throw new ConflictException(
        'Only an exact linked inverse is supported; arbitrary replacement amounts remain held.',
      );
  }
  private async persisted(
    c: Command,
    row: InactiveJournalCandidate,
    chart: FinanceChartProposal,
  ) {
    const expected = this.resolveLines(row.payload, chart);
    const stored = await c.manager.query(
      'SELECT line_key AS "lineKey",role_code AS "roleCode",account_code AS "accountCode",debit::text,credit::text,dimensions FROM finance_journal_candidate_lines WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND candidate_id=$4 ORDER BY line_key COLLATE "C"',
      [...this.scope(c), row.id],
    );
    const sorted = (lines: typeof expected) =>
      [...lines].sort((a, b) =>
        a.lineKey < b.lineKey ? -1 : a.lineKey > b.lineKey ? 1 : 0,
      );
    if (
      canonicalFinanceJson(stored) !== canonicalFinanceJson(sorted(expected)) ||
      row.subject_hash !==
        financeConfigurationHash({
          tenantId: c.actor.tenantId,
          ...c.scope,
          payload: row.payload,
          lines: expected,
        })
    )
      throw new ConflictException(
        'Stored candidate vector or immutable subject differs.',
      );
    const [totals] = await c.manager.query(
      'SELECT count(*)::integer AS count, sum(debit)=sum(credit) AS balanced, sum(debit)>0 AS positive FROM finance_journal_candidate_lines WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND candidate_id=$4',
      [...this.scope(c), row.id],
    );
    if (
      totals.count !== expected.length ||
      !totals.balanced ||
      !totals.positive
    )
      throw new ConflictException('Persisted candidate must balance exactly.');
  }
  private resolveLines(p: JournalCandidateInput, chart: FinanceChartProposal) {
    const roles = new Map(chart.roles.map((r) => [r.code, r]));
    return p.lines.map((line) => {
      const role = roles.get(line.roleCode);
      if (
        !role?.accountCode ||
        role.requiredDimensions.some(
          (d) => !candidateText(line.dimensions[d], 200),
        ) ||
        (line.dimensions.CURRENCY !== undefined &&
          line.dimensions.CURRENCY !== p.currency)
      )
        throw new ConflictException(
          'Every line needs an assigned chart role and compatible explicitly required draft dimensions.',
        );
      return { ...line, accountCode: role.accountCode };
    });
  }
  private async chart(
    c: Command,
    p: JournalCandidateInput,
  ): Promise<FinanceChartProposal> {
    const [release] = await c.manager.query(
      `SELECT *,effective_from::text AS effective_from,effective_to::text AS effective_to FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND kind='ACCOUNT_ROLES' AND state IN ('REVIEWED_INACTIVE','SUPERSEDED_INACTIVE') FOR SHARE`,
      [...this.scope(c), p.chartReleaseId],
    );
    if (
      !release ||
      (release.state === 'SUPERSEDED_INACTIVE' &&
        !(await retainedChartAuthorized(
          c.manager,
          this.scope(c),
          p.chartReleaseId,
          p.chartReleaseHash,
          p.accountingDate,
        ))) ||
      release.release_hash !== p.chartReleaseHash ||
      release.effective_from > p.accountingDate ||
      (release.effective_to && release.effective_to <= p.accountingDate) ||
      release.payload.schema !== 'FINANCE_CHART_SNAPSHOT_V1' ||
      release.payload.entityProfile !== c.profile
    )
      throw new ConflictException(
        'An exact compatible independently reviewed inactive chart is required.',
      );
    return validateFinanceChart(
      release.payload.proposal,
      c.profile,
      release.dependency_refs,
    );
  }
  private async openPeriod(c: Command, p: JournalCandidateInput) {
    const period = await this.period(c, p.periodId);
    if (
      period.state !== 'OPEN_FOR_VALIDATION' ||
      period.revision !== p.periodRevision ||
      p.accountingDate < period.starts_on ||
      p.accountingDate >= period.ends_before
    )
      throw new ConflictException(
        'Draft period is sealed, stale or outside its explicit date interval.',
      );
    return period;
  }
  private async period(c: Command, id: string): Promise<Period> {
    const [row]: Period[] = await c.manager.query(
      'SELECT *,starts_on::text AS starts_on,ends_before::text AS ends_before FROM finance_draft_periods WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR UPDATE',
      [...this.scope(c), id],
    );
    if (!row)
      throw new ConflictException(
        'Draft period is outside the selected Finance scope.',
      );
    return row;
  }
  private scope(c: Command) {
    return [c.actor.tenantId, c.scope.legalEntityId, c.scope.bookId];
  }
  private async event(
    c: Command,
    period: Period,
    row: InactiveJournalCandidate | null,
    action: string,
    hash: string,
  ) {
    await c.manager.query(
      `INSERT INTO finance_journal_candidate_events (tenant_id,legal_entity_id,book_id,period_id,period_revision,candidate_id,action,subject_hash,actor_subject_id,actor_natural_person_id,authority_id,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        ...this.scope(c),
        period.id,
        period.revision,
        row?.id ?? null,
        action,
        hash,
        c.actor.subjectId,
        c.actor.naturalPersonId,
        c.authorityId,
        c.reason,
      ],
    );
  }
  private uuid(id: unknown) {
    if (typeof id !== 'string' || !FINANCE_UUID.test(id))
      throw new BadRequestException('A UUID is required.');
  }
  private async command<T>(
    actor: FinanceConfigurationActor,
    scope: FinanceBookSelection,
    permission: Permission,
    reason: string,
    work: (c: Command) => Promise<T>,
  ): Promise<T> {
    if (
      !actor ||
      actor.kind !== 'USER' ||
      ![
        actor.tenantId,
        actor.subjectId,
        actor.naturalPersonId,
        scope?.legalEntityId,
        scope?.bookId,
      ].every((id) => typeof id === 'string' && FINANCE_UUID.test(id))
    )
      throw new ForbiddenException(
        'A trusted scoped human Finance identity is required.',
      );
    if (!candidateText(reason, 2000))
      throw new BadRequestException('A recorded reason is required.');
    actor = Object.freeze({
      kind: 'USER',
      tenantId: actor.tenantId.toLowerCase(),
      subjectId: actor.subjectId.toLowerCase(),
      naturalPersonId: actor.naturalPersonId.toLowerCase(),
    });
    scope = Object.freeze({
      legalEntityId: scope.legalEntityId.toLowerCase(),
      bookId: scope.bookId.toLowerCase(),
    });
    try {
      return await this.source.transaction(async (manager) => {
        const params = [actor.tenantId, scope.legalEntityId, scope.bookId];
        const [book] = await manager.query(
          "SELECT id FROM finance_accounting_books WHERE tenant_id=$1 AND legal_entity_id=$2 AND id=$3 AND state IN ('DRAFT','ACTIVE') FOR UPDATE",
          params,
        );
        const [entity] = await manager.query(
          "SELECT business_profile FROM finance_legal_entities WHERE tenant_id=$1 AND id=$2 AND state IN ('DRAFT','ACTIVE') FOR SHARE",
          params.slice(0, 2),
        );
        if (!book || !entity)
          throw new ForbiddenException(
            'Inactive Finance scope is unavailable.',
          );
        const [grant] = await manager.query(
          `SELECT id FROM finance_journal_candidate_authorities WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND subject_id=$4 AND natural_person_id=$5 AND permission=$6 AND state='ENABLED' AND revoked_at IS NULL AND valid_from <= statement_timestamp() AND (valid_to IS NULL OR valid_to > statement_timestamp()) ORDER BY id LIMIT 1 FOR SHARE`,
          [...params, actor.subjectId, actor.naturalPersonId, permission],
        );
        if (!grant)
          throw new ForbiddenException(
            'Current scoped journal-candidate authority is required.',
          );
        const completionChecks: (() => Promise<void>)[] = [];
        const result = await work({
          completionChecks,
          manager,
          actor,
          scope,
          authorityId: grant.id,
          profile: entity.business_profile,
          reason,
        });
        for (const check of completionChecks) await check();
        const [current] = await manager.query(
          "SELECT id FROM finance_journal_candidate_authorities WHERE id=$1 AND state='ENABLED' AND revoked_at IS NULL AND valid_from <= statement_timestamp() AND (valid_to IS NULL OR valid_to > statement_timestamp())",
          [grant.id],
        );
        if (!current)
          throw new ForbiddenException(
            'Journal-candidate authority expired before completion.',
          );
        return result;
      });
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } })?.driverError?.code ===
        '23505'
      )
        throw new ConflictException(
          'Period or economic candidate already exists.',
        );
      throw error;
    }
  }
}
