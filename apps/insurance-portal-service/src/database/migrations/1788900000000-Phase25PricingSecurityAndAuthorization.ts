import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS = [
  {
    name: 'pricing.calculate',
    displayName: 'Calculate premiums',
    description:
      'Allow invoking the pricing engine for premium calculations and rule explanations',
  },
  {
    name: 'pricing.view_breakdown',
    displayName: 'View pricing breakdowns',
    description:
      'Allow viewing stored pricing quote snapshots and quotation pricing breakdown summaries',
  },
  {
    name: 'pricing.manage_rules',
    displayName: 'Manage pricing rules',
    description:
      'Allow managing pricing rules and their conditions for authoritative premium calculation',
  },
  {
    name: 'pricing.manage_rate_books',
    displayName: 'Manage pricing rate books',
    description:
      'Allow creating, editing, cloning, and deleting pricing rate books',
  },
  {
    name: 'pricing.publish_rate_books',
    displayName: 'Publish pricing rate books',
    description:
      'Allow progressing pricing rate books through review, approval, publication, and retirement',
  },
  {
    name: 'pricing.request_discount',
    displayName: 'Request pricing discounts',
    description:
      'Allow requesting discount adjustments on quotations that rely on authoritative pricing',
  },
  {
    name: 'pricing.approve_discount',
    displayName: 'Approve pricing discounts',
    description:
      'Allow approving or rejecting controlled discount adjustments on quotations',
  },
  {
    name: 'pricing.request_override',
    displayName: 'Request pricing overrides',
    description:
      'Allow requesting manual premium overrides on quotation risks',
  },
  {
    name: 'pricing.approve_override',
    displayName: 'Approve pricing overrides',
    description:
      'Allow approving or rejecting manual premium override requests on quotation risks',
  },
  {
    name: 'pricing.view_audit',
    displayName: 'View pricing audit trail',
    description:
      'Allow viewing pricing-specific override and audit trail information on quotations',
  },
] as const;

const ROLE_PERMISSION_MAPPINGS = [
  {
    target: 'pricing.calculate',
    legacySources: ['premium-calculation:calculate'],
  },
  {
    target: 'pricing.view_breakdown',
    legacySources: ['premium-calculation:calculate'],
  },
  {
    target: 'pricing.manage_rules',
    legacySources: [
      'risk-rating-rules:read',
      'risk-rating-rules:create',
      'risk-rating-rules:update',
      'risk-rating-rules:delete',
    ],
  },
  {
    target: 'pricing.manage_rate_books',
    legacySources: [
      'risk-rating-rules:read',
      'risk-rating-rules:create',
      'risk-rating-rules:update',
      'risk-rating-rules:delete',
    ],
  },
  {
    target: 'pricing.publish_rate_books',
    legacySources: ['risk-rating-rules:update'],
  },
  {
    target: 'pricing.request_discount',
    legacySources: ['quotations:create', 'quotations:update'],
  },
  {
    target: 'pricing.approve_discount',
    legacySources: ['pricing.override.approve', 'pricing.override.reject'],
  },
  {
    target: 'pricing.request_override',
    legacySources: ['pricing.override.request'],
  },
  {
    target: 'pricing.approve_override',
    legacySources: ['pricing.override.approve', 'pricing.override.reject'],
  },
  {
    target: 'pricing.view_audit',
    legacySources: ['pricing.override.view'],
  },
] as const;

export class Phase25PricingSecurityAndAuthorization1788900000000
  implements MigrationInterface
{
  name = 'Phase25PricingSecurityAndAuthorization1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `
          INSERT INTO "permissions" (
            "name",
            "display_name",
            "description",
            "is_system_generated"
          )
          VALUES ($1, $2, $3, true)
          ON CONFLICT ("name")
          DO UPDATE SET
            "display_name" = EXCLUDED."display_name",
            "description" = EXCLUDED."description",
            "is_system_generated" = true
        `,
        [permission.name, permission.displayName, permission.description],
      );
    }

    for (const mapping of ROLE_PERMISSION_MAPPINGS) {
      await queryRunner.query(
        `
          INSERT INTO "permission_role" ("roles_id", "permissions_id")
          SELECT DISTINCT role_permission."roles_id", target_permission.id
          FROM "permission_role" AS role_permission
          INNER JOIN "permissions" AS source_permission
            ON source_permission.id = role_permission."permissions_id"
          INNER JOIN "permissions" AS target_permission
            ON target_permission.name = $1
          WHERE source_permission.name = ANY($2::varchar[])
          ON CONFLICT DO NOTHING
        `,
        [mapping.target, mapping.legacySources],
      );

      await queryRunner.query(
        `
          INSERT INTO "permission_user" ("users_id", "permissions_id")
          SELECT DISTINCT direct_permission."users_id", target_permission.id
          FROM "permission_user" AS direct_permission
          INNER JOIN "permissions" AS source_permission
            ON source_permission.id = direct_permission."permissions_id"
          INNER JOIN "permissions" AS target_permission
            ON target_permission.name = $1
          WHERE source_permission.name = ANY($2::varchar[])
          ON CONFLICT DO NOTHING
        `,
        [mapping.target, mapping.legacySources],
      );

      await queryRunner.query(
        `
          INSERT INTO "company_user_permissions" ("company_user_id", "permission_id")
          SELECT DISTINCT company_permission."company_user_id", target_permission.id
          FROM "company_user_permissions" AS company_permission
          INNER JOIN "permissions" AS source_permission
            ON source_permission.id = company_permission."permission_id"
          INNER JOIN "permissions" AS target_permission
            ON target_permission.name = $1
          WHERE source_permission.name = ANY($2::varchar[])
          ON CONFLICT DO NOTHING
        `,
        [mapping.target, mapping.legacySources],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const permissionNames = PERMISSIONS.map((permission) => permission.name);

    await queryRunner.query(
      `
        DELETE FROM "company_user_permissions"
        WHERE "permission_id" IN (
          SELECT id FROM "permissions" WHERE "name" = ANY($1::varchar[])
        )
      `,
      [permissionNames],
    );

    await queryRunner.query(
      `
        DELETE FROM "permission_user"
        WHERE "permissions_id" IN (
          SELECT id FROM "permissions" WHERE "name" = ANY($1::varchar[])
        )
      `,
      [permissionNames],
    );

    await queryRunner.query(
      `
        DELETE FROM "permission_role"
        WHERE "permissions_id" IN (
          SELECT id FROM "permissions" WHERE "name" = ANY($1::varchar[])
        )
      `,
      [permissionNames],
    );

    await queryRunner.query(
      `
        DELETE FROM "permissions"
        WHERE "name" = ANY($1::varchar[])
      `,
      [permissionNames],
    );
  }
}
