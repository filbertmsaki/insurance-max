import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsuranceRiskCoverClass1795000000000 implements MigrationInterface {
  name = 'InsuranceRiskCoverClass1795000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE insurance_risks ADD COLUMN IF NOT EXISTS cover_class varchar(30) NULL CHECK (cover_class IN ('COMPREHENSIVE','THIRD_PARTY_FIRE_THEFT','THIRD_PARTY'))`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE insurance_risks DROP COLUMN IF EXISTS cover_class`,
    );
  }
}
