import { installFinanceCommissionFunctions } from '../../modules/tenant/billing-commission/foundation/finance-commission.database';
import { MigrationInterface, QueryRunner } from 'typeorm';
const tables = [
  'finance_commission_authorities',
  'finance_commission_movements',
  'finance_commission_aliases',
  'finance_commission_reviews',
  'finance_commission_settlements',
  'finance_commission_events',
  'finance_commission_audits',
];
const scope =
  'tenant_id uuid NOT NULL,legal_entity_id uuid NOT NULL,book_id uuid NOT NULL';
const book =
  'FOREIGN KEY(tenant_id,legal_entity_id,book_id) REFERENCES finance_accounting_books(tenant_id,legal_entity_id,id)';
const unique = 'UNIQUE(tenant_id,legal_entity_id,book_id,id)';
const actor =
  'actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,authority_id uuid NOT NULL REFERENCES finance_commission_authorities(id)';
const content =
  "subject jsonb NOT NULL,canonical_subject text NOT NULL,subject_hash text NOT NULL CHECK(subject_hash=encode(sha256(convert_to(canonical_subject,'UTF8')),'hex')),CHECK(canonical_subject::jsonb=subject),CHECK(octet_length(canonical_subject)<=262144)";
const fk = (column: string, table = 'finance_commission_movements') =>
  `FOREIGN KEY(tenant_id,legal_entity_id,book_id,${column}) REFERENCES ${table}(tenant_id,legal_entity_id,book_id,id)`;
/** Empty inactive registries. No legacy rows, company grants, policies or postings are created. */
export class FinanceCommissionControls1797700000000 implements MigrationInterface {
  name = 'FinanceCommissionControls1797700000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE finance_commission_authorities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),${scope},subject_id uuid NOT NULL,natural_person_id uuid NOT NULL,permission text NOT NULL CHECK(permission IN ('OBSERVE_COMMISSION','REVIEW_COMMISSION','PREPARE_SETTLEMENT','REVIEW_SETTLEMENT','RECONCILE_COMMISSION','READ_COMMISSION')),currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),max_amount numeric(30,12) NOT NULL CHECK(max_amount>=0),state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ENABLED','REVOKED')),authority_reference text NOT NULL CHECK(btrim(authority_reference)<>''),valid_from timestamptz NOT NULL,valid_to timestamptz NOT NULL,revoked_at timestamptz,CHECK(valid_to>valid_from),${book})`,
    );
    await q.query(
      `CREATE TABLE finance_commission_movements(id uuid PRIMARY KEY,${scope},source_company_id uuid NOT NULL,source_id uuid NOT NULL,source_revision integer NOT NULL CHECK(source_revision>0),commission_id uuid NOT NULL,party_id uuid NOT NULL,currency varchar(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),previous_id uuid,inbox_id uuid NOT NULL,vector_hash text NOT NULL CHECK(vector_hash~'^[a-f0-9]{64}$'),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,source_id,source_revision),${book},${fk('previous_id')},${fk('inbox_id', 'finance_integration_inboxes')})`,
    );
    await q.query(
      `CREATE TABLE finance_commission_aliases(id uuid PRIMARY KEY,${scope},movement_id uuid NOT NULL,inbox_id uuid NOT NULL,state text NOT NULL CHECK(state IN ('MATCHED','CONFLICT_HELD')),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,book_id,inbox_id),${book},${fk('movement_id')},${fk('inbox_id', 'finance_integration_inboxes')})`,
    );
    await q.query(
      `CREATE TABLE finance_commission_reviews(id uuid PRIMARY KEY,${scope},movement_id uuid NOT NULL UNIQUE,decision text NOT NULL CHECK(decision IN ('REVIEWED_INACTIVE','REJECTED_INACTIVE')),${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},${book},${fk('movement_id')})`,
    );
    await q.query(
      `CREATE TABLE finance_commission_settlements(id uuid PRIMARY KEY,${scope},commission_id uuid NOT NULL,head_id uuid NOT NULL,command_key text NOT NULL,amount numeric(30,12) NOT NULL CHECK(amount>0),currency varchar(3) NOT NULL,decimal_scale integer NOT NULL CHECK(decimal_scale BETWEEN 0 AND 12),beneficiary_hash text NOT NULL CHECK(beneficiary_hash~'^[a-f0-9]{64}$'),expires_at timestamptz NOT NULL,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${book},${fk('head_id')})`,
    );
    await q.query(
      `CREATE TABLE finance_commission_events(id uuid PRIMARY KEY,${scope},settlement_id uuid NOT NULL,action text NOT NULL CHECK(action IN ('APPROVE','REJECT','CANCEL','BIND_EXECUTION','RECONCILE_CASH')),command_key text NOT NULL,outgoing_intent_id uuid,${content},${actor},created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${unique},UNIQUE(tenant_id,legal_entity_id,book_id,command_key),${book},${fk('settlement_id', 'finance_commission_settlements')},${fk('outgoing_intent_id', 'finance_outgoing_intents')},CHECK((action='BIND_EXECUTION')=(outgoing_intent_id IS NOT NULL)))`,
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_commission_settlement_decision ON finance_commission_events(settlement_id) WHERE action IN ('APPROVE','REJECT')",
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_commission_settlement_cancel ON finance_commission_events(settlement_id) WHERE action='CANCEL'",
    );
    await q.query(
      "CREATE UNIQUE INDEX UQ_commission_execution ON finance_commission_events(outgoing_intent_id) WHERE action='BIND_EXECUTION'",
    );
    await q.query(
      `CREATE TABLE finance_commission_audits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),${scope},object_table text NOT NULL CHECK(object_table IN (${tables
        .slice(1, -1)
        .map((t) => "'" + t + "'")
        .join(
          ',',
        )})),object_id uuid NOT NULL UNIQUE,action text NOT NULL,subject_hash text NOT NULL CHECK(subject_hash~'^[a-f0-9]{64}$'),actor_subject_id uuid NOT NULL,actor_natural_person_id uuid NOT NULL,reason text NOT NULL CHECK(btrim(reason)<>''),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),${book})`,
    );
    await q.query(
      'CREATE INDEX IDX_commission_chain ON finance_commission_movements(tenant_id,commission_id)',
    );
    await q.query(
      'CREATE INDEX IDX_commission_settlement_root ON finance_commission_settlements(tenant_id,commission_id)',
    );
    await installFinanceCommissionFunctions(q);
    for (const t of tables.slice(1))
      await q.query(
        `CREATE TRIGGER finance_commission_immutable BEFORE UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION finance_commission_immutable()`,
      );
    for (const t of [
      ...tables.slice(1, -1),
      'finance_outgoing_events',
      'finance_outgoing_calls',
    ])
      await q.query(
        `CREATE CONSTRAINT TRIGGER finance_commission_guard AFTER INSERT ON ${t} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_commission_guard()`,
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const t of tables)
      if (
        (await q.query(`SELECT EXISTS(SELECT 1 FROM ${t}) present`))[0].present
      )
        throw new Error(
          'Commission evidence and authorities must be retained.',
        );
    for (const t of ['finance_outgoing_events', 'finance_outgoing_calls'])
      await q.query(`DROP TRIGGER finance_commission_guard ON ${t}`);
    for (const t of [...tables].reverse()) await q.query(`DROP TABLE ${t}`);
    for (const fn of [
      'finance_commission_guard()',
      'finance_commission_immutable()',
      'finance_commission_eligible(uuid,boolean)',
      'finance_commission_available(uuid,uuid)',
      'finance_commission_source_pending(uuid,uuid)',
      'finance_commission_head(uuid,uuid)',
    ])
      await q.query('DROP FUNCTION ' + fn);
  }
}
