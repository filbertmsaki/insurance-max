import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillProductVersionSubClasses1786521549530
  implements MigrationInterface
{
  name = 'BackfillProductVersionSubClasses1786521549530';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "product_version_sub_classes" (
        "id",
        "company_id",
        "product_version_id",
        "sub_class_id",
        "code_snapshot",
        "name_snapshot",
        "description_snapshot",
        "tiramis_sub_class_code_snapshot",
        "cover_type_code_snapshot",
        "is_default",
        "sort_order",
        "created_at"
      )
      SELECT
        uuid_generate_v4(),
        sc.company_id,
        pv.id,
        sc.id,
        sc.code,
        sc.name,
        sc.description,
        sc.tiramis_sub_class_code,
        sc.cover_type_code,
        false,
        sc.sort_order,
        now()
      FROM "insurance_product_versions" pv
      JOIN "insurance_sub_classes" sc
        ON sc.product_id = pv.product_id
        AND sc.deleted_at IS NULL
        AND sc.is_active = true
      WHERE NOT EXISTS (
        SELECT 1
        FROM "product_version_sub_classes" pvsc
        WHERE pvsc.product_version_id = pv.id
          AND pvsc.sub_class_id = sc.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "product_version_sub_classes" pvsc
      USING "insurance_product_versions" pv, "insurance_sub_classes" sc
      WHERE pvsc.product_version_id = pv.id
        AND pvsc.sub_class_id = sc.id
        AND sc.product_id = pv.product_id
    `);
  }
}
