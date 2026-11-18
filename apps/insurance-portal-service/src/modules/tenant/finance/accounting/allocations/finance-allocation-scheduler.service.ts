import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import {
  FINANCE_UUID,
  canonicalFinanceJson,
  financeConfigurationHash,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import { validateAllocationSchedule } from './finance-allocation-schedule.types';
import { verifyReviewedDimensionMaster } from '../../foundation/accounting-dimensions/finance-reviewed-dimension-master';
import {
  previewBranchAllocation,
  validateAllocationRule,
} from './finance-branch-allocation';

/** A dedicated worker generates auditable inactive previews; it has no journal or posting authority. */
export const FINANCE_ALLOCATION_EXECUTION_ENABLED = Symbol(
  'FINANCE_ALLOCATION_EXECUTION_ENABLED',
);
export const FINANCE_ALLOCATION_DIMENSION_VERIFIER = Symbol(
  'FINANCE_ALLOCATION_DIMENSION_VERIFIER',
);
@Injectable()
export class FinanceAllocationSchedulerService {
  private readonly logger = new Logger(FinanceAllocationSchedulerService.name);
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    @Optional()
    @Inject(FINANCE_ALLOCATION_EXECUTION_ENABLED)
    private readonly executionEnabled: boolean = true,
    @Optional()
    @Inject(FINANCE_ALLOCATION_DIMENSION_VERIFIER)
    private readonly verifyDimensions: typeof verifyReviewedDimensionMaster = verifyReviewedDimensionMaster,
  ) {}

  @Cron('0 15 * * * *', { timeZone: 'UTC' })
  async tick(): Promise<void> {
    if (!this.executionEnabled) return;
    const worker = process.env.FINANCE_ALLOCATION_WORKER_ID;
    if (!worker) return;
    try {
      await this.runDue(worker, new Date().toISOString().slice(0, 10));
    } catch (error) {
      this.logger.error(
        'Inactive allocation scheduler failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Internal worker entry point; never exposed as a user-supplied identity endpoint. */
  async runDue(worker: string, today: string) {
    if (!this.executionEnabled)
      throw new ForbiddenException(
        'Allocation execution is disabled in this service.',
      );
    if (
      typeof worker !== 'string' ||
      !FINANCE_UUID.test(worker) ||
      !isFinanceDate(today)
    )
      throw new ForbiddenException(
        'Verified worker identity and UTC date are required.',
      );
    worker = worker.toLowerCase();
    const rows = await this.source.query(
      `SELECT id FROM finance_allocation_worker_authorities WHERE worker_subject_id=$1 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) ORDER BY id LIMIT 10001`,
      [worker],
    );
    if (rows.length > 10000)
      throw new ForbiddenException(
        'Worker authority population exceeds the supported bound.',
      );
    const outcomes: {
      authorityId: string;
      state: string;
      occurrenceId?: string;
    }[] = [];
    for (const { id } of rows) {
      try {
        outcomes.push(await this.runAuthority(worker, id, today));
      } catch (error) {
        await this.source.query(
          `INSERT INTO finance_allocation_worker_audits(tenant_id,legal_entity_id,book_id,authority_id,worker_subject_id,action,reason_code) SELECT tenant_id,legal_entity_id,book_id,id,worker_subject_id,'HELD','PREVIEW_HELD' FROM finance_allocation_worker_authorities WHERE id=$1 AND worker_subject_id=$2`,
          [id, worker],
        );
        this.logger.warn(
          `Inactive allocation authority ${id} held: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        outcomes.push({ authorityId: id, state: 'HELD' });
      }
    }
    return outcomes;
  }

  private async runAuthority(
    worker: string,
    authorityId: string,
    today: string,
  ) {
    return this.source.transaction(async (m) => {
      const [a] = await m.query(
        `SELECT * FROM finance_allocation_worker_authorities WHERE id=$1 AND worker_subject_id=$2 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE`,
        [authorityId, worker],
      );
      if (!a)
        throw new ForbiddenException(
          'Current scoped allocation worker authority is required.',
        );
      const ids = [a.tenant_id, a.legal_entity_id, a.book_id];
      const [scope] = await m.query(
        `SELECT b.id FROM finance_accounting_books b JOIN finance_legal_entities e ON e.tenant_id=b.tenant_id AND e.id=b.legal_entity_id WHERE b.tenant_id=$1 AND b.legal_entity_id=$2 AND b.id=$3 AND b.state IN ('DRAFT','ACTIVE') AND e.state IN ('DRAFT','ACTIVE') FOR SHARE OF b,e`,
        ids,
      );
      if (!scope)
        throw new ForbiddenException(
          'Allocation worker book scope is unavailable.',
        );
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'finance-allocation-preview:' + a.schedule_release_id,
      ]);
      const [schedule] = await m.query(
        `SELECT *,effective_from::text AS start_date,effective_to::text AS end_date FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND kind='DIMENSIONS' AND state='REVIEWED_INACTIVE' FOR SHARE`,
        [...ids, a.schedule_release_id],
      );
      if (!schedule || schedule.release_hash !== a.schedule_release_hash)
        throw new ForbiddenException(
          'Exact reviewed allocation schedule is required.',
        );
      const plan = validateAllocationSchedule(schedule.payload);
      if (plan.schema !== 'FINANCE_ALLOCATION_SCHEDULE_V2' || !plan.dimension)
        throw new ForbiddenException(
          'A schedule with reviewed company dimension evidence is required.',
        );
      const [rule] = await m.query(
        `SELECT *,effective_from::text AS start_date,effective_to::text AS end_date FROM finance_configuration_releases WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 AND kind='DIMENSIONS' AND state='REVIEWED_INACTIVE' FOR SHARE`,
        [...ids, plan.ruleId],
      );
      if (!rule || rule.release_hash !== plan.ruleHash)
        throw new ForbiddenException(
          'Exact reviewed allocation rule is required.',
        );
      validateAllocationRule(rule.payload);
      const covers = (r: { start_date: string; end_date: string | null }) =>
        r.start_date <= date && (!r.end_date || date < r.end_date);
      const earliest =
        schedule.start_date > rule.start_date
          ? schedule.start_date
          : rule.start_date;
      if (Number(today.slice(0, 4)) - Number(earliest.slice(0, 4)) > 100)
        throw new ForbiddenException(
          'Allocation recovery exceeds the supported 100-year bound.',
        );
      const [due] = await m.query(
        `SELECT to_char(day::date,'YYYY-MM-DD') AS date
        FROM generate_series(date_trunc('month',$1::date),date_trunc('month',$2::date),interval '1 month') month
        CROSS JOIN LATERAL (SELECT month + (($3::int - 1) * interval '1 day') AS day) d
        WHERE day::date >= $1::date AND day::date <= $2::date
          AND ($4::date IS NULL OR day::date < $4::date) AND ($5::date IS NULL OR day::date < $5::date)
          AND NOT EXISTS (SELECT 1 FROM finance_allocation_preview_occurrences o WHERE o.tenant_id=$6 AND o.legal_entity_id=$7 AND o.book_id=$8 AND o.schedule_release_id=$9 AND o.occurrence_date=day::date)
        ORDER BY day LIMIT 1`,
        [
          earliest,
          today,
          rule.payload.dayOfMonth,
          schedule.end_date,
          rule.end_date,
          ...ids,
          schedule.id,
        ],
      );
      const currentDate =
        today.slice(0, 8) + String(rule.payload.dayOfMonth).padStart(2, '0');
      const date = due?.date ?? currentDate;
      if (date > today || !covers(schedule) || !covers(rule))
        return { authorityId, state: 'NOT_DUE' };
      const d = plan.dimension;
      const common = {
        COMPANY: d.companyId,
        DIMENSION_RELEASE: d.dimensionReleaseId,
        DIMENSION_HASH: d.dimensionReleaseHash,
        SOURCE_ASSOCIATION: d.sourceAssociationId,
        SOURCE_ASSOCIATION_HASH: d.sourceAssociationHash,
      };
      await this.verifyDimensions(m, ids, {
        economicOrigin: 'SCHEDULED_ALLOCATION',
        accountingDate: date,
        lines: [
          rule.payload.sourceBranch,
          ...rule.payload.targets.map(
            (target: { branch: string }) => target.branch,
          ),
        ].map((branch: string, index: number) => ({
          lineKey: `BRANCH-${index}`,
          roleCode: 'BRANCH',
          debit: '0',
          credit: '0',
          dimensions: { ...common, BRANCH: branch },
        })),
      });
      const lines = previewBranchAllocation({
        sourceBranch: rule.payload.sourceBranch,
        expenseRole: rule.payload.expenseRole,
        interbranchRole: rule.payload.interbranchRole,
        targets: rule.payload.targets,
        amountMinor: plan.amountMinor,
      });
      const payload = {
        schema: 'FINANCE_RECURRING_ALLOCATION_PREVIEW_V1',
        tenantId: ids[0],
        legalEntityId: ids[1],
        bookId: ids[2],
        scheduleId: schedule.id,
        scheduleHash: schedule.release_hash,
        ruleId: rule.id,
        ruleHash: rule.release_hash,
        occurrenceDate: date,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        decimalScale: plan.decimalScale,
        dimension: d,
        lines,
        postingAuthorized: false,
      };
      const subjectHash = financeConfigurationHash(payload);
      const [existing] = await m.query(
        'SELECT id,payload,subject_hash FROM finance_allocation_preview_occurrences WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND schedule_release_id=$4 AND occurrence_date=$5',
        [...ids, schedule.id, date],
      );
      if (existing) {
        if (
          existing.subject_hash !== subjectHash ||
          financeConfigurationHash(existing.payload) !== subjectHash
        )
          throw new ForbiddenException(
            'Persisted allocation preview differs from the reviewed schedule.',
          );
        return { authorityId, state: 'REUSED', occurrenceId: existing.id };
      }
      const [stillValid] = await m.query(
        `SELECT id FROM finance_allocation_worker_authorities WHERE id=$1 AND worker_subject_id=$2 AND state='ENABLED' AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())`,
        [authorityId, worker],
      );
      if (!stillValid)
        throw new ForbiddenException(
          'Allocation worker authority expired before completion.',
        );
      const [created] = await m.query(
        `INSERT INTO finance_allocation_preview_occurrences(tenant_id,legal_entity_id,book_id,schedule_release_id,schedule_release_hash,rule_release_id,rule_release_hash,occurrence_date,worker_subject_id,authority_id,payload,subject_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) RETURNING id`,
        [
          ...ids,
          schedule.id,
          schedule.release_hash,
          rule.id,
          rule.release_hash,
          date,
          worker,
          authorityId,
          canonicalFinanceJson(payload),
          subjectHash,
        ],
      );
      await m.query(
        `INSERT INTO finance_allocation_worker_audits(tenant_id,legal_entity_id,book_id,authority_id,worker_subject_id,occurrence_id,action,reason_code) VALUES($1,$2,$3,$4,$5,$6,'CREATED','PREVIEW_CREATED')`,
        [...ids, authorityId, worker, created.id],
      );
      return { authorityId, state: 'CREATED', occurrenceId: created.id };
    });
  }
}
