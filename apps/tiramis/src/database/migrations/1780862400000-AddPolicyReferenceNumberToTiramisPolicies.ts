import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPolicyReferenceNumberToTiramisPolicies1780862400000
  implements MigrationInterface
{
  name = 'AddPolicyReferenceNumberToTiramisPolicies1780862400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" ADD "policy_reference_number" character varying(50)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e2f2d7dbf4cda9d92f3c5e2a1" ON "tiramis_policies" ("policy_reference_number")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_2e2f2d7dbf4cda9d92f3c5e2a1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" DROP COLUMN "policy_reference_number"`,
    );
  }
}
