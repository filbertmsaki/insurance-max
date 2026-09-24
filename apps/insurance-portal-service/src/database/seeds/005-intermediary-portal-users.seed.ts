import { DataSource, QueryRunner } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { environment } from '@insurance-max/shared-config';
import { hashPassword } from '@insurance-max/portal-shared/utils/hash.util';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { RoleScope } from '@insurance-max/contracts';
import { withSeedTransaction } from './shared/seed-utils';

type IntermediaryPortalUserSeed = {
  companyName: string;
  companyType: CompanyType.BROKER | CompanyType.AGENCY;
  branchCode: string;
  branchName: string;
  adminRoleName: 'BROKER_ADMIN' | 'AGENCY_ADMIN';
  admin: SeedUser;
  user: SeedUser;
};

type SeedUser = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  userNo: string;
  officerTitle: string;
  roleNames: string[];
};

type IdRow = {
  id: string;
};

const DEFAULT_ADMIN_PASSWORD =
  environment.INTERMEDIARY_PORTAL_ADMIN_PASSWORD ?? 'IntermediaryAdmin123!';
const DEFAULT_USER_PASSWORD =
  environment.INTERMEDIARY_PORTAL_USER_PASSWORD ?? 'IntermediaryUser123!';

const INTERMEDIARY_PORTAL_USER_SEEDS: IntermediaryPortalUserSeed[] = [
  {
    companyName: 'KIVULI INSURANCE BROKERS',
    companyType: CompanyType.BROKER,
    branchCode: 'KIV-HQ',
    branchName: 'Kivuli Head Office',
    adminRoleName: 'BROKER_ADMIN',
    admin: {
      firstName: 'Kivuli',
      lastName: 'Admin',
      email:
        environment.SEED_BROKER_ADMIN_EMAIL ??
        'kivuli.broker.admin@example.test',
      phone: environment.SEED_BROKER_ADMIN_PHONE ?? '+255700000201',
      password:
        environment.SEED_BROKER_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD,
      userNo: environment.SEED_BROKER_ADMIN_USER_NO ?? 'BROKER-ADMIN-00001',
      officerTitle: 'Broker Administrator',
      roleNames: ['BROKER_ADMIN', 'PORTAL_ADMIN', 'INTERMEDIARY_PORTAL'],
    },
    user: {
      firstName: 'Kivuli',
      lastName: 'User',
      email:
        environment.SEED_BROKER_USER_EMAIL ?? 'kivuli.broker.user@example.test',
      phone: environment.SEED_BROKER_USER_PHONE ?? '+255700000202',
      password: environment.SEED_BROKER_USER_PASSWORD ?? DEFAULT_USER_PASSWORD,
      userNo: environment.SEED_BROKER_USER_USER_NO ?? 'BROKER-USER-00001',
      officerTitle: 'Broker Portal User',
      roleNames: ['USER', 'INTERMEDIARY_PORTAL'],
    },
  },
  {
    companyName: 'HERI INSURANCE AGENCY',
    companyType: CompanyType.AGENCY,
    branchCode: 'HERI-HQ',
    branchName: 'Heri Head Office',
    adminRoleName: 'AGENCY_ADMIN',
    admin: {
      firstName: 'Heri',
      lastName: 'Admin',
      email:
        environment.SEED_AGENCY_ADMIN_EMAIL ?? 'heri.agency.admin@example.test',
      phone: environment.SEED_AGENCY_ADMIN_PHONE ?? '+255700000101',
      password:
        environment.SEED_AGENCY_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD,
      userNo: environment.SEED_AGENCY_ADMIN_USER_NO ?? 'AGENCY-ADMIN-00001',
      officerTitle: 'Agency Administrator',
      roleNames: ['AGENCY_ADMIN', 'PORTAL_ADMIN', 'INTERMEDIARY_PORTAL'],
    },
    user: {
      firstName: 'Heri',
      lastName: 'User',
      email:
        environment.SEED_AGENCY_USER_EMAIL ?? 'heri.agency.user@example.test',
      phone: environment.SEED_AGENCY_USER_PHONE ?? '+255700000102',
      password: environment.SEED_AGENCY_USER_PASSWORD ?? DEFAULT_USER_PASSWORD,
      userNo: environment.SEED_AGENCY_USER_USER_NO ?? 'AGENCY-USER-00001',
      officerTitle: 'Agency Portal User',
      roleNames: ['USER', 'INTERMEDIARY_PORTAL'],
    },
  },
];

export default class IntermediaryPortalUsersSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    await withSeedTransaction(
      dataSource,
      'seed:intermediary-portal-users',
      async (queryRunner) => {
        for (const seed of INTERMEDIARY_PORTAL_USER_SEEDS) {
          await this.seedIntermediary(queryRunner, seed);
        }
      },
    );

    console.log(
      '[IntermediaryPortalUsersSeeder] Broker and agency portal users seeded',
    );
  }

  private async seedIntermediary(
    queryRunner: QueryRunner,
    seed: IntermediaryPortalUserSeed,
  ): Promise<void> {
    const companyId = await this.findCompanyId(queryRunner, seed);
    const branchId = await this.ensureBranch(queryRunner, companyId, seed);

    await this.ensureCompanyRole(queryRunner, companyId, seed.adminRoleName);
    await this.ensureCompanyRole(queryRunner, companyId, 'PORTAL_ADMIN');
    await this.ensureCompanyRole(queryRunner, companyId, 'INTERMEDIARY_PORTAL');
    await this.ensureCompanyRole(queryRunner, companyId, 'USER');

    await this.ensurePortalUser(queryRunner, companyId, branchId, seed.admin);
    await this.ensurePortalUser(queryRunner, companyId, branchId, seed.user);
  }

  private async findCompanyId(
    queryRunner: QueryRunner,
    seed: IntermediaryPortalUserSeed,
  ): Promise<string> {
    const rows = (await queryRunner.query(
      `
        SELECT id
        FROM companies
        WHERE name = $1
          AND company_type = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [seed.companyName, seed.companyType],
    )) as IdRow[];

    if (!rows[0]) {
      throw new Error(
        `Company ${seed.companyName} must be seeded before portal users`,
      );
    }

    return rows[0].id;
  }

  private async ensureBranch(
    queryRunner: QueryRunner,
    companyId: string,
    seed: IntermediaryPortalUserSeed,
  ): Promise<string> {
    const rows = (await queryRunner.query(
      `
        INSERT INTO branches (
          company_id,
          name,
          code,
          is_head_office,
          status,
          sale_point_code,
          sale_point_name,
          address,
          phone,
          email,
          manager_id,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, true, 'active', NULL, NULL,
          NULL, NULL, NULL, NULL, now(), now()
        )
        ON CONFLICT ON CONSTRAINT "UQ_branches_company_code"
        DO UPDATE SET
          name = EXCLUDED.name,
          is_head_office = true,
          status = 'active',
          updated_at = now()
        RETURNING id
      `,
      [companyId, seed.branchName, seed.branchCode],
    )) as IdRow[];

    return rows[0].id;
  }

  private async ensureCompanyRole(
    queryRunner: QueryRunner,
    companyId: string,
    roleName: string,
  ): Promise<string> {
    const existingRows = (await queryRunner.query(
      `
        SELECT id
        FROM roles
        WHERE company_id = $1
          AND name = $2
        LIMIT 1
      `,
      [companyId, roleName],
    )) as IdRow[];

    const templateRows = (await queryRunner.query(
      `
        SELECT id, name, display_name, description, is_system_generated,
          is_administrative
        FROM roles
        WHERE company_id IS NULL
          AND name = $1
        LIMIT 1
      `,
      [roleName],
    )) as Array<
      IdRow & {
        name: string;
        display_name: string;
        description: string | null;
        is_system_generated: boolean;
        is_administrative: boolean;
      }
    >;

    const template = templateRows[0];
    if (!template) {
      throw new Error(`Global role template ${roleName} is missing`);
    }

    let roleId = existingRows[0]?.id;

    if (roleId) {
      await queryRunner.query(
        `
          UPDATE roles
          SET
            display_name = $2,
            description = $3,
            scope = $4,
            is_system_generated = $5,
            is_administrative = $6,
            updated_at = now()
          WHERE id = $1
        `,
        [
          roleId,
          template.display_name,
          template.description,
          RoleScope.TENANT,
          template.is_system_generated,
          template.is_administrative,
        ],
      );
    } else {
      const insertedRows = (await queryRunner.query(
        `
          INSERT INTO roles (
            name,
            display_name,
            description,
            company_id,
            is_system_generated,
            scope,
            is_administrative,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
          RETURNING id
        `,
        [
          template.name,
          template.display_name,
          template.description,
          companyId,
          template.is_system_generated,
          RoleScope.TENANT,
          template.is_administrative,
        ],
      )) as IdRow[];

      roleId = insertedRows[0].id;
    }

    await queryRunner.query(
      `
        INSERT INTO permission_role (roles_id, permissions_id)
        SELECT $1, permissions_id
        FROM permission_role
        WHERE roles_id = $2
        ON CONFLICT DO NOTHING
      `,
      [roleId, template.id],
    );

    return roleId;
  }

  private async ensurePortalUser(
    queryRunner: QueryRunner,
    companyId: string,
    branchId: string,
    seed: SeedUser,
  ): Promise<void> {
    const userId = await this.ensureUser(queryRunner, seed);
    const membershipId = await this.ensureCompanyMembership(
      queryRunner,
      companyId,
      userId,
    );

    for (const roleName of seed.roleNames) {
      const roleId = await this.ensureCompanyRole(
        queryRunner,
        companyId,
        roleName,
      );
      await this.ensureMembershipRole(queryRunner, membershipId, roleId);
    }

    await this.ensureBranchAssignment(
      queryRunner,
      branchId,
      membershipId,
      userId,
    );
  }

  private async ensureUser(
    queryRunner: QueryRunner,
    seed: SeedUser,
  ): Promise<string> {
    const passwordHash = await hashPassword(seed.password);
    const existingRows = (await queryRunner.query(
      `
        SELECT id
        FROM users
        WHERE email = $1
          OR phone = $2
        LIMIT 1
      `,
      [seed.email, seed.phone],
    )) as IdRow[];

    if (existingRows[0]) {
      await queryRunner.query(
        `
          UPDATE users
          SET
            user_no = $2,
            first_name = $3,
            last_name = $4,
            phone = $5,
            email = $6,
            password = $7,
            status = 'active',
            user_type = 'COMPANY_USER',
            officer_title = $8,
            is_email_verified = true,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = now()
          WHERE id = $1
        `,
        [
          existingRows[0].id,
          seed.userNo,
          seed.firstName,
          seed.lastName,
          seed.phone,
          seed.email,
          passwordHash,
          seed.officerTitle,
        ],
      );
      return existingRows[0].id;
    }

    const insertedRows = (await queryRunner.query(
      `
        INSERT INTO users (
          user_no,
          first_name,
          last_name,
          phone,
          email,
          password,
          status,
          user_type,
          officer_title,
          is_email_verified,
          is_phone_verified,
          failed_login_attempts,
          is_two_factor_enabled,
          authorization_version,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 'active', 'COMPANY_USER',
          $7, true, false, 0, false, 1, now(), now()
        )
        RETURNING id
      `,
      [
        seed.userNo,
        seed.firstName,
        seed.lastName,
        seed.phone,
        seed.email,
        passwordHash,
        seed.officerTitle,
      ],
    )) as IdRow[];

    return insertedRows[0].id;
  }

  private async ensureCompanyMembership(
    queryRunner: QueryRunner,
    companyId: string,
    userId: string,
  ): Promise<string> {
    const existingRows = (await queryRunner.query(
      `
        SELECT id
        FROM company_users
        WHERE company_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [companyId, userId],
    )) as IdRow[];

    if (existingRows[0]) {
      await queryRunner.query(
        `
          UPDATE company_users
          SET
            status = 'active',
            is_default = true,
            authorization_version = authorization_version + 1,
            updated_at = now()
          WHERE id = $1
        `,
        [existingRows[0].id],
      );
      return existingRows[0].id;
    }

    const insertedRows = (await queryRunner.query(
      `
        INSERT INTO company_users (
          company_id,
          user_id,
          status,
          is_default,
          authorization_version,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'active', true, 1, now(), now())
        RETURNING id
      `,
      [companyId, userId],
    )) as IdRow[];

    return insertedRows[0].id;
  }

  private async ensureMembershipRole(
    queryRunner: QueryRunner,
    membershipId: string,
    roleId: string,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO company_user_roles (company_user_id, role_id, created_at)
        VALUES ($1, $2, now())
        ON CONFLICT ON CONSTRAINT "UQ_company_user_roles_membership_role"
        DO NOTHING
      `,
      [membershipId, roleId],
    );
  }

  private async ensureBranchAssignment(
    queryRunner: QueryRunner,
    branchId: string,
    membershipId: string,
    userId: string,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO branch_users (
          branch_id,
          company_user_id,
          is_primary,
          is_active_branch,
          assigned_by,
          activated_at,
          activated_by,
          created_at,
          updated_at
        )
        VALUES ($1, $2, true, true, $3, now(), $3, now(), now())
        ON CONFLICT ON CONSTRAINT "UQ_branch_users_branch_company_user"
        DO UPDATE SET
          is_primary = true,
          is_active_branch = true,
          assigned_by = COALESCE(branch_users.assigned_by, EXCLUDED.assigned_by),
          activated_at = COALESCE(
            branch_users.activated_at,
            EXCLUDED.activated_at
          ),
          activated_by = COALESCE(
            branch_users.activated_by,
            EXCLUDED.activated_by
          ),
          updated_at = now()
      `,
      [branchId, membershipId, userId],
    );
  }
}
