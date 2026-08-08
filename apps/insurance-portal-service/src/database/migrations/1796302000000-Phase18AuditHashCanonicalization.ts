import { createHash } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

type AuditHashRow = {
  id: string;
  event_no: string | number | null;
  previous_event_hash: string | null;
  user_id: string | null;
  company_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  changed_fields: string[] | null;
  request_id: string | null;
  correlation_id: string | null;
  actor_type: string;
  actor_service: string | null;
  event_category: string | null;
  reason: string | null;
};

export class Phase18AuditHashCanonicalization1796302000000 implements MigrationInterface {
  name = 'Phase18AuditHashCanonicalization1796302000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL app.audit_maintenance = 'on'`);

    const events = (await queryRunner.query(`
      SELECT
        "id",
        "event_no",
        "previous_event_hash",
        "user_id",
        "company_id",
        "action",
        "resource",
        "resource_id",
        "status",
        "metadata",
        "before_state",
        "after_state",
        "changed_fields",
        "request_id",
        "correlation_id",
        "actor_type",
        "actor_service",
        "event_category",
        "reason"
      FROM "audit_logs"
      WHERE "event_no" IS NOT NULL
      ORDER BY "event_no" ASC, "created_at" ASC
    `)) as AuditHashRow[];

    let previousHash: string | null = null;

    for (const event of events) {
      const eventHash = this.computeEventHash({
        ...event,
        previous_event_hash: previousHash,
      });

      await queryRunner.query(
        `
          UPDATE "audit_logs"
          SET
            "previous_event_hash" = $2,
            "event_hash" = $3
          WHERE "id" = $1
        `,
        [event.id, previousHash, eventHash],
      );

      previousHash = eventHash;
    }
  }

  public async down(): Promise<void> {
    // Irreversible normalization of the stored hash chain.
  }

  private computeEventHash(event: AuditHashRow): string {
    const payload = this.stableStringify({
      eventNo: event.event_no ?? null,
      previousEventHash: event.previous_event_hash ?? null,
      userId: event.user_id ?? null,
      companyId: event.company_id ?? null,
      action: event.action,
      resource: event.resource ?? null,
      resourceId: event.resource_id ?? null,
      status: event.status,
      metadata: event.metadata ?? null,
      beforeState: event.before_state ?? null,
      afterState: event.after_state ?? null,
      changedFields: event.changed_fields ?? null,
      requestId: event.request_id ?? null,
      correlationId: event.correlation_id ?? null,
      actorType: event.actor_type,
      actorService: event.actor_service ?? null,
      eventCategory: event.event_category ?? null,
      reason: event.reason ?? null,
    });

    return createHash('sha256').update(payload).digest('hex');
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.canonicalize(value));
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonicalize(item)]),
      );
    }

    return value;
  }
}
