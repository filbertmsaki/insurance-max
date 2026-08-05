import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2AuthenticationHardening1794400000000 implements MigrationInterface {
  name = 'Phase2AuthenticationHardening1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "last_used_at"
      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "updated_at"
      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD COLUMN IF NOT EXISTS "revocation_reason"
      character varying(100)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_user_sessions_user_active"
      ON "user_sessions"
      ("user_id", "revoked", "expires_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_user_sessions_device_active"
      ON "user_sessions"
      ("device_id", "revoked")
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      ADD COLUMN IF NOT EXISTS "trusted_until"
      TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      ADD COLUMN IF NOT EXISTS "revoked_at"
      TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      ADD COLUMN IF NOT EXISTS "last_ip_address"
      character varying(45)
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      ADD COLUMN IF NOT EXISTS "updated_at"
      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_devices_user_trusted"
      ON "devices"
      ("user_id", "trusted", "trusted_until")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_devices_user_trusted"
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      DROP COLUMN IF EXISTS "updated_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      DROP COLUMN IF EXISTS "last_ip_address"
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      DROP COLUMN IF EXISTS "revoked_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "devices"
      DROP COLUMN IF EXISTS "trusted_until"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_user_sessions_device_active"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_user_sessions_user_active"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      DROP COLUMN IF EXISTS "revocation_reason"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      DROP COLUMN IF EXISTS "updated_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      DROP COLUMN IF EXISTS "last_used_at"
    `);
  }
}
