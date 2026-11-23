import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { returningRows } from '../../../../../database/returning-rows.util';
import { FinanceEventContractRegistry } from './finance-event-contracts';

export const FINANCE_EVENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PUBLISHED',
  'FAILED',
  'BLOCKED',
  'DEAD_LETTER',
] as const;

/** Only events without a final outcome may be replayed. */
const REPLAYABLE_STATUSES = ['DEAD_LETTER', 'BLOCKED'];

export interface EventListQuery {
  status?: string;
  eventType?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Company-scoped monitoring and maker/checker replay for the Finance outbox.
 * Every query is filtered by the caller's company; an event in another
 * company is indistinguishable from a missing one.
 */
@Injectable()
export class FinanceEventOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly contracts: FinanceEventContractRegistry,
  ) {}

  async summary(companyId: string) {
    const statusRows: Array<{ status: string; n: number }> =
      await this.dataSource.query(
        `SELECT status, count(*)::int AS n FROM finance_outbox_events
          WHERE company_id = $1 GROUP BY status`,
        [companyId],
      );
    const counts = Object.fromEntries(
      FINANCE_EVENT_STATUSES.map((status) => [
        status,
        statusRows.find((row) => row.status === status)?.n ?? 0,
      ]),
    ) as Record<(typeof FINANCE_EVENT_STATUSES)[number], number>;
    const total = statusRows.reduce((sum, row) => sum + row.n, 0);

    const [queue] = await this.dataSource.query(
      `SELECT
         EXTRACT(EPOCH FROM now() - min(created_at) FILTER (WHERE status IN ('PENDING','FAILED','PROCESSING')))::float AS oldest_open_age_seconds,
         count(*) FILTER (WHERE attempt_count > 0 AND status IN ('PENDING','FAILED','PROCESSING'))::int AS retrying,
         COALESCE(sum(attempt_count), 0)::int AS total_attempts
         FROM finance_outbox_events WHERE company_id = $1`,
      [companyId],
    );
    const [latency] = await this.dataSource.query(
      `SELECT count(*)::int AS samples,
              avg(EXTRACT(EPOCH FROM published_at - created_at))::float AS avg_seconds,
              percentile_cont(0.95) WITHIN GROUP
                (ORDER BY EXTRACT(EPOCH FROM published_at - created_at))::float AS p95_seconds
         FROM finance_outbox_events
        WHERE company_id = $1 AND status = 'PUBLISHED'
          AND published_at >= now() - interval '24 hours'`,
      [companyId],
    );
    const byType = await this.dataSource.query(
      `SELECT event_type, status, count(*)::int AS n
         FROM finance_outbox_events WHERE company_id = $1
        GROUP BY event_type, status ORDER BY event_type, status`,
      [companyId],
    );
    const accounting = await this.dataSource.query(
      `SELECT accounting_outcome, count(*)::int AS n
         FROM finance_event_outcomes WHERE company_id = $1
        GROUP BY accounting_outcome ORDER BY accounting_outcome`,
      [companyId],
    );
    const [replays] = await this.dataSource.query(
      `SELECT count(*) FILTER (WHERE status = 'REQUESTED')::int AS awaiting_approval,
              count(*) FILTER (WHERE status = 'APPROVED')::int AS approved
         FROM finance_event_replay_requests WHERE company_id = $1`,
      [companyId],
    );

    const alerts: Array<{ level: 'critical' | 'warning'; message: string }> =
      [];
    if (counts.DEAD_LETTER > 0)
      alerts.push({
        level: 'critical',
        message: `${counts.DEAD_LETTER} event(s) in dead letter.`,
      });
    if (counts.BLOCKED > 0)
      alerts.push({
        level: 'critical',
        message: `${counts.BLOCKED} event(s) blocked without an accounting outcome.`,
      });
    if ((queue.oldest_open_age_seconds ?? 0) > 3600)
      alerts.push({
        level: 'warning',
        message: 'An open event has been waiting more than one hour.',
      });

    return {
      total,
      counts,
      oldestOpenAgeSeconds: queue.oldest_open_age_seconds ?? null,
      retrying: queue.retrying,
      totalAttempts: queue.total_attempts,
      latency24h: {
        samples: latency.samples,
        avgSeconds: latency.avg_seconds ?? null,
        p95Seconds: latency.p95_seconds ?? null,
      },
      byType,
      accountingOutcomes: accounting,
      replays,
      alerts,
      contracts: this.contracts.list().map((contract) => ({
        eventType: contract.eventType,
        schemaVersions: contract.schemaVersions,
        consumer: contract.consumer,
        role: contract.role,
      })),
    };
  }

  async list(companyId: string, query: EventListQuery) {
    if (
      query.status &&
      !(FINANCE_EVENT_STATUSES as readonly string[]).includes(query.status)
    ) {
      throw new BadRequestException('Unknown event status.');
    }
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Math.floor(Number(query.pageSize) || 25)),
    );
    const params = [
      companyId,
      query.status ?? null,
      query.eventType ?? null,
      pageSize,
      (page - 1) * pageSize,
    ];
    const where = `e.company_id = $1
      AND ($2::varchar IS NULL OR e.status = $2)
      AND ($3::varchar IS NULL OR e.event_type = $3)`;
    const [{ total }] = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM finance_outbox_events e WHERE ${where}`,
      params.slice(0, 3),
    );
    const items = await this.dataSource.query(
      `SELECT e.id, e.event_type, e.schema_version, e.aggregate_type,
              e.aggregate_id, e.event_key, e.status, e.attempt_count,
              e.failure_class, e.last_error, e.created_at, e.published_at,
              e.next_attempt_at, e.last_processed_at,
              EXTRACT(EPOCH FROM COALESCE(e.published_at, now()) - e.created_at)::float AS age_seconds,
              o.business_outcome, o.accounting_outcome, o.accounting_reference
         FROM finance_outbox_events e
         LEFT JOIN LATERAL (
           SELECT business_outcome, accounting_outcome, accounting_reference
             FROM finance_event_outcomes
            WHERE outbox_event_id = e.id AND company_id = e.company_id
            ORDER BY processed_at DESC LIMIT 1) o ON true
        WHERE ${where}
        ORDER BY e.created_at DESC, e.id
        LIMIT $4 OFFSET $5`,
      params,
    );
    return { items, total, page, pageSize };
  }

  async detail(companyId: string, eventId: string) {
    const event = await this.findEvent(
      this.dataSource.manager,
      companyId,
      eventId,
    );
    const [outcomes, attempts, replays] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM finance_event_outcomes
          WHERE company_id = $1 AND (outbox_event_id = $2
             OR (consumer, idempotency_key) IN (
                  SELECT consumer, idempotency_key FROM finance_event_outcomes
                   WHERE company_id = $1 AND outbox_event_id = $2))
          ORDER BY processed_at`,
        [companyId, eventId],
      ),
      this.dataSource.query(
        `SELECT * FROM finance_event_attempts
          WHERE company_id = $1 AND outbox_event_id = $2 ORDER BY id`,
        [companyId, eventId],
      ),
      this.dataSource.query(
        `SELECT r.*, COALESCE((
                  SELECT json_agg(a ORDER BY a.id) FROM finance_event_replay_audit a
                   WHERE a.replay_request_id = r.id), '[]') AS audit
           FROM finance_event_replay_requests r
          WHERE r.company_id = $1 AND r.outbox_event_id = $2
          ORDER BY r.requested_at`,
        [companyId, eventId],
      ),
    ]);
    return { event, outcomes, attempts, replays };
  }

  async listReplays(companyId: string, status?: string) {
    return this.dataSource.query(
      `SELECT r.*, e.event_type, e.status AS event_status
         FROM finance_event_replay_requests r
         JOIN finance_outbox_events e ON e.id = r.outbox_event_id AND e.company_id = r.company_id
        WHERE r.company_id = $1 AND ($2::varchar IS NULL OR r.status = $2)
        ORDER BY r.requested_at DESC LIMIT 200`,
      [companyId, status ?? null],
    );
  }

  // ---- Replay workflow -------------------------------------------------------

  async requestReplay(
    companyId: string,
    userId: string,
    eventId: string,
    reason: string,
  ) {
    const trimmed = (reason ?? '').trim();
    if (trimmed.length < 10) {
      throw new BadRequestException(
        'A replay reason of at least 10 characters is required.',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const event = await this.findEvent(manager, companyId, eventId, true);
      if (!REPLAYABLE_STATUSES.includes(event.status)) {
        throw new ConflictException({
          code: 'FINANCE_EVENT_NOT_REPLAYABLE',
          message: `Only ${REPLAYABLE_STATUSES.join(' or ')} events can be replayed; this event is ${event.status}.`,
        });
      }
      if (!this.contracts.get(event.event_type)) {
        throw new ConflictException({
          code: 'FINANCE_EVENT_NOT_REPLAYABLE',
          message:
            'This event type has no supported consumer; replay would dead-letter again.',
        });
      }
      try {
        await manager.query('SAVEPOINT replay_request');
        const [request] = await manager.query(
          `INSERT INTO finance_event_replay_requests
             (company_id, outbox_event_id, event_status_at_request, reason, requested_by)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [companyId, eventId, event.status, trimmed, userId],
        );
        await this.audit(manager, request, 'REQUESTED', userId, {
          reason: trimmed,
          eventStatus: event.status,
        });
        return request;
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          await manager.query('ROLLBACK TO SAVEPOINT replay_request');
          throw new ConflictException({
            code: 'FINANCE_EVENT_REPLAY_ALREADY_OPEN',
            message: 'An open replay request already exists for this event.',
          });
        }
        throw error;
      }
    });
  }

  async decideReplay(
    companyId: string,
    userId: string,
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    note?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.findRequest(manager, companyId, requestId);
      if (request.status !== 'REQUESTED') {
        throw new ConflictException({
          code: 'FINANCE_EVENT_REPLAY_STATE',
          message: `Replay request is ${request.status}.`,
        });
      }
      if (request.requested_by === userId) {
        throw new ForbiddenException({
          code: 'FINANCE_EVENT_REPLAY_SELF_APPROVAL',
          message:
            'A replay must be decided by someone other than the requester.',
        });
      }
      const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const [updated] = returningRows<any>(
        await manager.query(
          `UPDATE finance_event_replay_requests
              SET status = $3, decided_by = $4, decided_at = now(), decision_note = $5
            WHERE id = $1 AND company_id = $2 AND status = 'REQUESTED'
            RETURNING *`,
          [requestId, companyId, status, userId, note?.trim() || null],
        ),
      );
      await this.audit(manager, updated, status, userId, {
        note: note ?? null,
      });
      return updated;
    });
  }

  /**
   * Re-queues an approved replay onto the normal worker path. The worker's
   * outcome idempotency means a replay can never apply a final outcome twice.
   */
  async executeReplay(companyId: string, userId: string, requestId: string) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.findRequest(manager, companyId, requestId);
      if (request.status !== 'APPROVED') {
        throw new ConflictException({
          code: 'FINANCE_EVENT_REPLAY_STATE',
          message: `Replay request is ${request.status}; only an APPROVED request can be executed.`,
        });
      }
      const event = await this.findEvent(
        manager,
        companyId,
        request.outbox_event_id,
        true,
      );
      let result: string;
      if (!REPLAYABLE_STATUSES.includes(event.status)) {
        // The event was resolved some other way after approval.
        result = `NOT_REQUEUED_${event.status}`;
      } else {
        await manager.query(
          `UPDATE finance_outbox_events
              SET status = 'PENDING', attempt_count = 0, failure_class = NULL,
                  next_attempt_at = now(), replay_request_id = $3
            WHERE id = $1 AND company_id = $2`,
          [event.id, companyId, requestId],
        );
        result = 'REQUEUED';
      }
      const [updated] = returningRows<any>(
        await manager.query(
          `UPDATE finance_event_replay_requests
              SET status = 'EXECUTED', executed_by = $3, executed_at = now(),
                  execution_result = $4
            WHERE id = $1 AND company_id = $2 AND status = 'APPROVED'
            RETURNING *`,
          [requestId, companyId, userId, result],
        ),
      );
      await this.audit(manager, updated, 'EXECUTED', userId, { result });
      return updated;
    });
  }

  async cancelReplay(companyId: string, userId: string, requestId: string) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.findRequest(manager, companyId, requestId);
      if (!['REQUESTED', 'APPROVED'].includes(request.status)) {
        throw new ConflictException({
          code: 'FINANCE_EVENT_REPLAY_STATE',
          message: `Replay request is ${request.status}.`,
        });
      }
      const [updated] = returningRows<any>(
        await manager.query(
          `UPDATE finance_event_replay_requests SET status = 'CANCELLED'
            WHERE id = $1 AND company_id = $2 RETURNING *`,
          [requestId, companyId],
        ),
      );
      await this.audit(manager, updated, 'CANCELLED', userId, {});
      return updated;
    });
  }

  // ---------------------------------------------------------------------------

  private async findEvent(
    manager: EntityManager,
    companyId: string,
    eventId: string,
    lock = false,
  ) {
    const [event] = await manager.query(
      `SELECT id, company_id, event_type, schema_version, aggregate_type,
              aggregate_id, event_key, payload, status, attempt_count,
              failure_class, last_error, created_at, published_at,
              next_attempt_at, last_processed_at, claim_generation::text AS claim_generation
         FROM finance_outbox_events
        WHERE id = $1 AND company_id = $2
        ${lock ? 'FOR UPDATE' : ''}`,
      [eventId, companyId],
    );
    if (!event) throw new NotFoundException('Finance event not found.');
    return event;
  }

  private async findRequest(
    manager: EntityManager,
    companyId: string,
    requestId: string,
  ) {
    const [request] = await manager.query(
      `SELECT * FROM finance_event_replay_requests
        WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [requestId, companyId],
    );
    if (!request) throw new NotFoundException('Replay request not found.');
    return request;
  }

  private async audit(
    manager: EntityManager,
    request: { id: string; company_id: string },
    action: string,
    actorId: string,
    detail: Record<string, unknown>,
  ) {
    await manager.query(
      `INSERT INTO finance_event_replay_audit
         (replay_request_id, company_id, action, actor_id, detail)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [request.id, request.company_id, action, actorId, JSON.stringify(detail)],
    );
  }
}
