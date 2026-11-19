import { MigrationInterface, QueryRunner } from 'typeorm';

import { ensureFinanceUuidV4 } from '../finance-uuid-v4';

/**
 * Sprint 2: durable Finance event outcomes, attempt history and controlled
 * replay. Additive only; existing outbox rows keep their status and payload
 * and are treated as schema version 1 (the unversioned legacy contracts).
 *
 * - finance_event_outcomes: one row per (company, consumer, idempotency key).
 *   Separates business projection from accounting recognition. The unique key
 *   is the database-backed guard against a second financial effect.
 * - finance_event_attempts: append-only processing history per claim.
 * - finance_event_replay_requests / finance_event_replay_audit: maker/checker
 *   replay with an append-only audit trail; one open request per event.
 */
export class FinanceEventOutcomes1798800000000 implements MigrationInterface {
  name = 'FinanceEventOutcomes1798800000000';

  /** Columns use IF NOT EXISTS so entity-synchronized test schemas can also apply this. */
  async up(queryRunner: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(queryRunner);
    await queryRunner.query(`ALTER TABLE finance_outbox_events
      ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS failure_class varchar(30) NULL,
      ADD COLUMN IF NOT EXISTS processing_started_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS last_processed_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS replay_request_id uuid NULL,
      ADD CONSTRAINT "CHK_finance_outbox_failure_class" CHECK (failure_class IS NULL OR failure_class IN
        ('TRANSIENT','PERMANENT','UNSUPPORTED','SCOPE_MISMATCH','POLICY_BLOCKED','MISSING_JOURNAL','OUTCOME_CONFLICT','RETRY_EXHAUSTED'))`);
    await queryRunner.query(`CREATE INDEX "IDX_finance_outbox_company_status"
      ON finance_outbox_events (company_id, status, created_at)`);

    await queryRunner.query(`CREATE TABLE finance_event_outcomes (
      id uuid NOT NULL DEFAULT finance_uuid_v4() PRIMARY KEY,
      company_id uuid NOT NULL,
      outbox_event_id uuid NOT NULL REFERENCES finance_outbox_events(id),
      event_type varchar(100) NOT NULL,
      schema_version integer NOT NULL,
      consumer varchar(80) NOT NULL,
      idempotency_key varchar(220) NOT NULL,
      source_type varchar(80) NOT NULL,
      source_id uuid NOT NULL,
      source_revision varchar(60) NULL,
      operation varchar(60) NOT NULL,
      business_outcome varchar(40) NOT NULL CHECK (business_outcome IN
        ('APPLIED','NO_CHANGE','SKIPPED_STALE_REVISION','NOT_APPLICABLE','BLOCKED')),
      business_reference varchar(120) NULL,
      accounting_outcome varchar(40) NOT NULL CHECK (accounting_outcome IN
        ('RECOGNIZED_BY_SOURCE_COMMAND','NOT_REQUIRED','NOT_APPLICABLE','POLICY_BLOCKED','MISSING_JOURNAL')),
      accounting_reference uuid NULL,
      detail text NULL,
      processed_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_finance_event_outcome_idempotency" UNIQUE (company_id, consumer, idempotency_key),
      CONSTRAINT "CHK_finance_event_outcome_recognized_ref" CHECK (
        accounting_outcome <> 'RECOGNIZED_BY_SOURCE_COMMAND' OR accounting_reference IS NOT NULL)
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_finance_event_outcome_event"
      ON finance_event_outcomes (outbox_event_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_finance_event_outcome_source"
      ON finance_event_outcomes (company_id, source_type, source_id)`);

    await queryRunner.query(`CREATE TABLE finance_event_attempts (
      id bigserial PRIMARY KEY,
      outbox_event_id uuid NOT NULL REFERENCES finance_outbox_events(id),
      company_id uuid NOT NULL,
      claim_generation bigint NOT NULL,
      worker varchar(120) NULL,
      trigger varchar(20) NOT NULL DEFAULT 'WORKER' CHECK (trigger IN ('WORKER','REPLAY')),
      replay_request_id uuid NULL,
      result varchar(30) NOT NULL CHECK (result IN
        ('PUBLISHED','FAILED','DEAD_LETTER','BLOCKED','DUPLICATE_SUPPRESSED')),
      failure_class varchar(30) NULL,
      error text NULL,
      started_at timestamptz NOT NULL,
      finished_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_finance_event_attempts_event"
      ON finance_event_attempts (outbox_event_id, id)`);

    await queryRunner.query(`CREATE TABLE finance_event_replay_requests (
      id uuid NOT NULL DEFAULT finance_uuid_v4() PRIMARY KEY,
      company_id uuid NOT NULL,
      outbox_event_id uuid NOT NULL REFERENCES finance_outbox_events(id),
      event_status_at_request varchar(30) NOT NULL,
      reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
      status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN
        ('REQUESTED','APPROVED','REJECTED','EXECUTED','CANCELLED')),
      requested_by uuid NOT NULL,
      requested_at timestamptz NOT NULL DEFAULT now(),
      decided_by uuid NULL,
      decided_at timestamptz NULL,
      decision_note text NULL,
      executed_by uuid NULL,
      executed_at timestamptz NULL,
      execution_result varchar(30) NULL,
      CONSTRAINT "CHK_finance_replay_independent" CHECK (decided_by IS NULL OR decided_by <> requested_by),
      CONSTRAINT "CHK_finance_replay_decision" CHECK (
        (status = 'REQUESTED' AND decided_by IS NULL)
        OR (status = 'CANCELLED')
        OR (status IN ('APPROVED','REJECTED','EXECUTED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)),
      CONSTRAINT "CHK_finance_replay_executed" CHECK (
        status <> 'EXECUTED' OR (executed_at IS NOT NULL AND execution_result IS NOT NULL))
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_finance_replay_open_per_event"
      ON finance_event_replay_requests (outbox_event_id)
      WHERE status IN ('REQUESTED','APPROVED')`);
    await queryRunner.query(`CREATE INDEX "IDX_finance_replay_company"
      ON finance_event_replay_requests (company_id, status, requested_at DESC)`);

    await queryRunner.query(`CREATE TABLE finance_event_replay_audit (
      id bigserial PRIMARY KEY,
      replay_request_id uuid NOT NULL REFERENCES finance_event_replay_requests(id),
      company_id uuid NOT NULL,
      action varchar(20) NOT NULL CHECK (action IN
        ('REQUESTED','APPROVED','REJECTED','EXECUTED','CANCELLED')),
      actor_id uuid NOT NULL,
      detail jsonb NOT NULL DEFAULT '{}'::jsonb,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )`);

    // Attempt history and replay audit are append-only.
    await queryRunner.query(`CREATE FUNCTION fn_finance_event_append_only()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'FINANCE_EVENT_HISTORY_IMMUTABLE: % is append-only', TG_TABLE_NAME
          USING ERRCODE = 'check_violation';
      END $$`);
    for (const table of ['finance_event_attempts', 'finance_event_replay_audit']) {
      await queryRunner.query(`CREATE TRIGGER "TRG_${table}_append_only"
        BEFORE UPDATE OR DELETE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION fn_finance_event_append_only()`);
    }

    // Catalogue definitions only; no role is granted these permissions.
    const [{ catalogue }] = await queryRunner.query(
      "SELECT to_regclass('public.permissions') IS NOT NULL AS catalogue",
    );
    if (catalogue) {
      for (const [name, label] of [
        ['finance-events:read', 'Read Finance event monitoring'],
        ['finance-events:replay-request', 'Request Finance event replay'],
        ['finance-events:replay-approve', 'Approve and execute Finance event replay'],
      ]) {
        await queryRunner.query(
          `INSERT INTO permissions (id, name, display_name, description, is_system_generated, assignment_scope, assignable_to_company_role, assignable_to_platform_role, is_deprecated)
           VALUES (finance_uuid_v4(), $1, $2, $3, true, 'shared', true, false, false)
           ON CONFLICT (name) DO NOTHING`,
          [name, label, `Allow users to ${label.toLowerCase()}`],
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE finance_event_replay_audit`);
    await queryRunner.query(`DROP TABLE finance_event_replay_requests`);
    await queryRunner.query(`DROP TABLE finance_event_attempts`);
    await queryRunner.query(`DROP FUNCTION fn_finance_event_append_only()`);
    await queryRunner.query(`DROP TABLE finance_event_outcomes`);
    await queryRunner.query(`DROP INDEX "IDX_finance_outbox_company_status"`);
    await queryRunner.query(`ALTER TABLE finance_outbox_events
      DROP CONSTRAINT "CHK_finance_outbox_failure_class",
      DROP COLUMN replay_request_id,
      DROP COLUMN last_processed_at,
      DROP COLUMN processing_started_at,
      DROP COLUMN failure_class,
      DROP COLUMN schema_version`);
  }
}
