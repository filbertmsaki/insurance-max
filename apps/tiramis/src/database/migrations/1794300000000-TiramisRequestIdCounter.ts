import { MigrationInterface, QueryRunner } from 'typeorm';

/** 4-digit auto-increment counter for TIRA RequestIds; wraps at 9999. */
export class TiramisRequestIdCounter1794300000000 implements MigrationInterface {
  name = 'TiramisRequestIdCounter1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "tiramis_request_id_counter_seq" MINVALUE 1 MAXVALUE 9999 START 1 CYCLE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP SEQUENCE IF EXISTS "tiramis_request_id_counter_seq"`,
    );
  }
}
