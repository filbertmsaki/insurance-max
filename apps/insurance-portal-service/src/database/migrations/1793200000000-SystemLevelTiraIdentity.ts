import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The TIRA system identity (client code/key, system code/name, certificates,
 * base and callback URLs) is platform-wide and owned by TIRAMIS (environment).
 * Companies keep only company-specific TIRA settings.
 */
export class SystemLevelTiraIdentity1793200000000 implements MigrationInterface {
  name = 'SystemLevelTiraIdentity1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of COMPANY_CONFIGURATION_SYSTEM_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "tiramis_company_configurations" DROP COLUMN IF EXISTS "${column.name}"`,
      );
    }
    for (const column of COMPANY_SYSTEM_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "companies" DROP COLUMN IF EXISTS "${column.name}"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of COMPANY_SYSTEM_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "companies" ADD "${column.name}" ${column.definition}`,
      );
    }
    for (const column of COMPANY_CONFIGURATION_SYSTEM_COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "tiramis_company_configurations" ADD "${column.name}" ${column.definition}`,
      );
    }
  }
}

const COMPANY_CONFIGURATION_SYSTEM_COLUMNS = [
  { name: 'client_code', definition: 'character varying(60)' },
  { name: 'client_key', definition: 'character varying(255)' },
  { name: 'system_code', definition: 'character varying(100)' },
  { name: 'system_name', definition: 'character varying(150)' },
  { name: 'base_url', definition: 'character varying(500)' },
  { name: 'source_service', definition: 'character varying(100)' },
  { name: 'callback_url', definition: 'character varying(500)' },
  {
    name: 'allow_expired_certificates',
    definition: 'boolean NOT NULL DEFAULT false',
  },
];

const COMPANY_SYSTEM_COLUMNS = [
  { name: 'tira_client_code', definition: 'character varying(60)' },
  { name: 'tira_system_code', definition: 'character varying(100)' },
  { name: 'tira_system_name', definition: 'character varying(150)' },
];
