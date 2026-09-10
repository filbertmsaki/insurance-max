import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaxCatalogue1789027200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE taxes (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      tax_code varchar(50) NOT NULL, tax_name varchar(150) NOT NULL,
      tax_rate numeric(18,10) NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 1),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
      CONSTRAINT "UQ_taxes_company_code" UNIQUE (company_id, tax_code)
    )`);
    // Copy only unambiguous company-wide percentage definitions. Scoped or
    // conflicting legacy rules require an administrator to define a catalogue tax.
    await queryRunner.query(`INSERT INTO taxes (company_id, tax_code, tax_name, tax_rate, is_active)
      SELECT company_id, upper(trim(tax_code)), min(tax_name), min(tax_rate), bool_or(status = 'ACTIVE')
      FROM product_tax_rules
      WHERE deleted_at IS NULL AND category_id IS NULL AND product_id IS NULL AND risk_id IS NULL
        AND tax_type = 'PERCENTAGE' AND charge_category = 'TAX' AND tax_rate BETWEEN 0 AND 1
      GROUP BY company_id, upper(trim(tax_code)) HAVING count(DISTINCT tax_rate) = 1`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE taxes');
  }
}
