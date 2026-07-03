import { MigrationInterface, QueryRunner } from 'typeorm';

type ForeignKeyAlignment = {
  column: string;
  nullable?: boolean;
  onDelete: 'RESTRICT' | 'SET NULL';
  rollbackOnDelete: 'CASCADE' | 'SET NULL';
  refTable: string;
  table: string;
};

const COMPANY_FK_ALIGNMENTS: ForeignKeyAlignment[] = [
  {
    table: 'product_distribution_channels',
    column: 'insurer_company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'product_distribution_channels',
    column: 'intermediary_company_id',
    refTable: 'companies',
    onDelete: 'SET NULL',
    nullable: true,
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'product_commission_rules',
    column: 'insurer_company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'product_commission_rules',
    column: 'intermediary_company_id',
    refTable: 'companies',
    onDelete: 'SET NULL',
    nullable: true,
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'product_tax_rules',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'product_document_requirements',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'customers',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'quotations',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'quotations',
    column: 'insurer_company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'policies',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'policies',
    column: 'insurer_company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'motor_vehicles',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'motor_fleets',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'subject_matters',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'invoices',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'invoices',
    column: 'insurer_company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'receipts',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'receipts',
    column: 'invoice_id',
    refTable: 'invoices',
    onDelete: 'SET NULL',
    nullable: true,
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'payment_transactions',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'commission_transactions',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'commission_transactions',
    column: 'insurer_company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'commission_transactions',
    column: 'intermediary_company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'commission_transactions',
    column: 'policy_id',
    refTable: 'policies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'commission_payments',
    column: 'company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
  {
    table: 'commission_payments',
    column: 'intermediary_company_id',
    refTable: 'companies',
    onDelete: 'RESTRICT',
    rollbackOnDelete: 'CASCADE',
  },
];

export class TenantConstraintAlignment1783000000008
  implements MigrationInterface
{
  name = 'TenantConstraintAlignment1783000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "motor_quotation_details"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE
    `);

    for (const alignment of COMPANY_FK_ALIGNMENTS) {
      await this.replaceForeignKey(queryRunner, alignment);
    }

    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      ADD CONSTRAINT "FK_quotation_risks_subject_matter"
      FOREIGN KEY ("subject_matter_id") REFERENCES "subject_matters"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      ADD CONSTRAINT "FK_quotation_risks_motor_vehicle"
      FOREIGN KEY ("motor_vehicle_id") REFERENCES "motor_vehicles"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      ADD CONSTRAINT "FK_mpd_policy"
      FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      ADD CONSTRAINT "FK_mpd_policy_risk"
      FOREIGN KEY ("policy_risk_id") REFERENCES "policy_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "non_motor_policy_details"
      ADD CONSTRAINT "FK_nmpd_policy"
      FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "non_motor_policy_details"
      ADD CONSTRAINT "FK_nmpd_policy_risk"
      FOREIGN KEY ("policy_risk_id") REFERENCES "policy_risks"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "non_motor_policy_details"
      DROP CONSTRAINT "FK_nmpd_policy_risk"
    `);
    await queryRunner.query(`
      ALTER TABLE "non_motor_policy_details"
      DROP CONSTRAINT "FK_nmpd_policy"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      DROP CONSTRAINT "FK_mpd_policy_risk"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      DROP CONSTRAINT "FK_mpd_policy"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      DROP CONSTRAINT "FK_quotation_risks_motor_vehicle"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotation_risks"
      DROP CONSTRAINT "FK_quotation_risks_subject_matter"
    `);

    for (const alignment of COMPANY_FK_ALIGNMENTS) {
      await this.restoreForeignKey(queryRunner, alignment);
    }

    await queryRunner.query(`
      ALTER TABLE "motor_policy_details"
      DROP COLUMN IF EXISTS "deleted_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "motor_quotation_details"
      DROP COLUMN IF EXISTS "deleted_at"
    `);
  }

  private async replaceForeignKey(
    queryRunner: QueryRunner,
    alignment: ForeignKeyAlignment,
  ): Promise<void> {
    const constraints: Array<{ conname: string }> = await queryRunner.query(
      `
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE con.contype = 'f'
        AND rel.relname = $1
        AND att.attname = $2
      `,
      [alignment.table, alignment.column],
    );

    for (const constraint of constraints) {
      await queryRunner.query(
        `ALTER TABLE "${alignment.table}" DROP CONSTRAINT "${constraint.conname}"`,
      );
    }

    if (alignment.nullable) {
      await queryRunner.query(
        `ALTER TABLE "${alignment.table}" ALTER COLUMN "${alignment.column}" DROP NOT NULL`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "${alignment.table}"
      ADD CONSTRAINT "FK_${alignment.table}_${alignment.column}_aligned"
      FOREIGN KEY ("${alignment.column}") REFERENCES "${alignment.refTable}"("id") ON DELETE ${alignment.onDelete} ON UPDATE NO ACTION
    `);
  }

  private async restoreForeignKey(
    queryRunner: QueryRunner,
    alignment: ForeignKeyAlignment,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${alignment.table}" DROP CONSTRAINT IF EXISTS "FK_${alignment.table}_${alignment.column}_aligned"`,
    );

    await queryRunner.query(`
      ALTER TABLE "${alignment.table}"
      ADD CONSTRAINT "FK_${alignment.table}_${alignment.column}_aligned"
      FOREIGN KEY ("${alignment.column}") REFERENCES "${alignment.refTable}"("id") ON DELETE ${alignment.rollbackOnDelete} ON UPDATE NO ACTION
    `);
  }
}
