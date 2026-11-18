import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Metadata observation authority only. No grants, account conversions or seeds. */
export class FinanceChartSourceAuthorities1796200000000 implements MigrationInterface {
  name = 'FinanceChartSourceAuthorities1796200000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(queryRunner);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_chart_source_map_scope" ON finance_legal_entity_source_maps (tenant_id, legal_entity_id, id)',
    );
    await queryRunner.query(`CREATE TABLE finance_chart_source_authorities (
      id uuid NOT NULL DEFAULT public.finance_uuid_v4(), tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL,
      book_id uuid NOT NULL, source_map_id uuid NOT NULL, source_map_hash varchar(64) NOT NULL,
      subject_id uuid NOT NULL, natural_person_id uuid NOT NULL, state varchar(12) NOT NULL DEFAULT 'DRAFT',
      authority_reference varchar(200) NOT NULL, valid_from timestamptz NOT NULL, valid_to timestamptz,
      revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_fin_chart_source_authority" PRIMARY KEY (id),
      CONSTRAINT "CK_fin_chart_source_state" CHECK (state IN ('DRAFT','ENABLED','REVOKED')),
      CONSTRAINT "CK_fin_chart_source_hash" CHECK (source_map_hash ~ '^[0-9a-f]{64}$'),
      CONSTRAINT "CK_fin_chart_source_interval" CHECK (valid_to IS NULL OR valid_to > valid_from),
      CONSTRAINT "CK_fin_chart_source_ref" CHECK (btrim(authority_reference) <> ''),
      CONSTRAINT "FK_fin_chart_source_book" FOREIGN KEY (tenant_id, legal_entity_id, book_id)
        REFERENCES finance_accounting_books (tenant_id, legal_entity_id, id) ON DELETE RESTRICT,
      CONSTRAINT "FK_fin_chart_source_map" FOREIGN KEY (tenant_id, legal_entity_id, source_map_id)
        REFERENCES finance_legal_entity_source_maps (tenant_id, legal_entity_id, id) ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_fin_chart_source_reader" ON finance_chart_source_authorities (tenant_id, legal_entity_id, book_id, source_map_id, subject_id, natural_person_id)',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const [usage] = await queryRunner.query(
      'SELECT EXISTS (SELECT 1 FROM finance_chart_source_authorities) AS in_use',
    );
    if (usage.in_use)
      throw new Error(
        'Chart source-authority rollback requires empty authority records.',
      );
    await queryRunner.query('DROP TABLE finance_chart_source_authorities');
    await queryRunner.query('DROP INDEX "UQ_fin_chart_source_map_scope"');
  }
}
