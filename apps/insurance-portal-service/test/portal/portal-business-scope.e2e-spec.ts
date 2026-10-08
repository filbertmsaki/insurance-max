import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';

import { hashPassword } from '@insurance-max/portal-shared/utils/hash.util';

import { AppModule } from '../../src/app.module';

jest.setTimeout(180_000);

describe('Portal business scope (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let insurerCompanyId: string;
  let insurerBranchId: string;
  let categoryId: string;
  let productId: string;

  let customerAId: string;
  let customerBId: string;
  let brokerACompanyId: string;
  let brokerBCompanyId: string;

  let customerAPolicyId: string;
  let customerBPolicyId: string;
  let brokerAQuotationId: string;
  let brokerBQuotationId: string;

  let customerAToken: string;
  let customerBToken: string;
  let brokerAToken: string;
  let brokerBToken: string;

  const suffix = randomUUID().slice(0, 8);
  const testPassword = 'StrongPassword@2026';

  async function createPortalUser(params: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    userType: string;
    officerTitle: string;
  }) {
    const passwordHash = await hashPassword(testPassword);

    const rows = await dataSource.query(
      `
      INSERT INTO users (
        user_no, first_name, last_name, email, phone, password, status,
        user_type, officer_title, is_email_verified, is_phone_verified,
        is_two_factor_enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, true, true, false)
      RETURNING id
      `,
      [
        `USR-T${suffix}${randomUUID().slice(0, 4)}`,
        params.firstName,
        params.lastName,
        params.email,
        params.phone,
        passwordHash,
        params.userType,
        params.officerTitle,
      ],
    );

    return rows[0].id as string;
  }

  async function addMembership(params: {
    userId: string;
    companyId: string;
    branchId: string;
    roleName: string;
  }) {
    const membershipRows = await dataSource.query(
      `
      INSERT INTO company_users (company_id, user_id, status, is_default)
      VALUES ($1, $2, 'active', true)
      RETURNING id
      `,
      [params.companyId, params.userId],
    );

    const membershipId = membershipRows[0].id as string;

    await dataSource.query(
      `
      INSERT INTO branch_users (
        branch_id, company_user_id, is_primary, is_active_branch, activated_at
      )
      VALUES ($1, $2, true, true, now())
      `,
      [params.branchId, membershipId],
    );

    const roleRows = await dataSource.query(
      `SELECT id FROM roles WHERE name = $1 AND company_id = $2`,
      [params.roleName, params.companyId],
    );

    if (!roleRows[0]) {
      throw new Error(
        `Role ${params.roleName} not seeded for company ${params.companyId}`,
      );
    }

    await dataSource.query(
      `INSERT INTO company_user_roles (company_user_id, role_id) VALUES ($1, $2)`,
      [membershipId, roleRows[0].id],
    );

    return membershipId;
  }

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: testPassword });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(
        `Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }

    return (
      response.body.data?.access_token ??
      response.body.data?.accessToken ??
      response.body.access_token ??
      response.body.accessToken
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api', {
      exclude: [{ path: '', method: RequestMethod.GET }],
    });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);

    // --- Fixtures -----------------------------------------------------
    const insurer = await dataSource.query(
      `SELECT id FROM companies WHERE company_type = 'INSURANCE_COMPANY' LIMIT 1`,
    );
    insurerCompanyId = insurer[0].id;

    const branch = await dataSource.query(
      `SELECT id FROM branches WHERE company_id = $1 AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
      [insurerCompanyId],
    );
    insurerBranchId = branch[0].id;

    const product = await dataSource.query(
      `SELECT id, category_id FROM insurance_products LIMIT 1`,
    );
    productId = product[0].id;
    categoryId = product[0].category_id;

    // Two customers under the insurer company.
    const customerA = await dataSource.query(
      `
      INSERT INTO customers (
        company_id, customer_no, customer_type, first_name, last_name,
        phone, country_code, region, district, status
      )
      VALUES ($1, $2, 'INDIVIDUAL', 'Alice', 'Customer', $3, 'TZA', 'Dar es Salaam', 'Ilala', 'ACTIVE')
      RETURNING id
      `,
      [
        insurerCompanyId,
        `CUST-TEST-A-${suffix}`,
        `+25571${suffix.slice(0, 7)}1`,
      ],
    );
    customerAId = customerA[0].id;

    const customerB = await dataSource.query(
      `
      INSERT INTO customers (
        company_id, customer_no, customer_type, first_name, last_name,
        phone, country_code, region, district, status
      )
      VALUES ($1, $2, 'INDIVIDUAL', 'Bob', 'Customer', $3, 'TZA', 'Dar es Salaam', 'Ilala', 'ACTIVE')
      RETURNING id
      `,
      [
        insurerCompanyId,
        `CUST-TEST-B-${suffix}`,
        `+25571${suffix.slice(0, 7)}2`,
      ],
    );
    customerBId = customerB[0].id;

    // Two broker companies, each with their own branch.
    const brokerA = await dataSource.query(
      `
      INSERT INTO companies (name, slug, company_type, status)
      VALUES ($1, $2, 'BROKER', 'active')
      RETURNING id
      `,
      [`Broker A Test ${suffix}`, `broker-a-test-${suffix}`],
    );
    brokerACompanyId = brokerA[0].id;

    const brokerB = await dataSource.query(
      `
      INSERT INTO companies (name, slug, company_type, status)
      VALUES ($1, $2, 'BROKER', 'active')
      RETURNING id
      `,
      [`Broker B Test ${suffix}`, `broker-b-test-${suffix}`],
    );
    brokerBCompanyId = brokerB[0].id;

    const brokerABranch = await dataSource.query(
      `INSERT INTO branches (company_id, name, code, status) VALUES ($1, 'HQ', $2, 'active') RETURNING id`,
      [brokerACompanyId, `BRA-${suffix}`],
    );
    const brokerABranchId = brokerABranch[0].id;

    const brokerBBranch = await dataSource.query(
      `INSERT INTO branches (company_id, name, code, status) VALUES ($1, 'HQ', $2, 'active') RETURNING id`,
      [brokerBCompanyId, `BRB-${suffix}`],
    );
    const brokerBBranchId = brokerBBranch[0].id;

    // Intermediary portal access requires an active partner relationship
    // with the insurer. LEGACY scope keeps every product visible, so the
    // tests below isolate broker-vs-broker scoping only.
    for (const brokerCompanyId of [brokerACompanyId, brokerBCompanyId]) {
      await dataSource.query(
        `
        INSERT INTO insurance_company_partners (
          insurer_company_id, intermediary_company_id, partner_type, status,
          scope_mode, start_date
        )
        VALUES ($1, $2, 'BROKER', 'ACTIVE', 'LEGACY', CURRENT_DATE)
        `,
        [insurerCompanyId, brokerCompanyId],
      );
    }

    // Seed the CUSTOMER_PORTAL/INTERMEDIARY_PORTAL roles for the broker
    // companies too - the seeder only created company-scoped copies for
    // the insurer company, but roles are looked up by company_id.
    const globalIntermediaryRole = await dataSource.query(
      `SELECT id FROM roles WHERE name = 'INTERMEDIARY_PORTAL' AND company_id IS NULL`,
    );
    const globalIntermediaryPermission = await dataSource.query(
      `SELECT permissions_id FROM permission_role WHERE roles_id = $1`,
      [globalIntermediaryRole[0].id],
    );

    for (const [companyId, code] of [
      [brokerACompanyId, 'A'],
      [brokerBCompanyId, 'B'],
    ] as const) {
      const roleRows = await dataSource.query(
        `
        INSERT INTO roles (name, display_name, description, company_id, is_system_generated)
        VALUES ('INTERMEDIARY_PORTAL', 'Intermediary Portal', 'Broker portal user', $1, true)
        RETURNING id
        `,
        [companyId],
      );

      for (const permissionRow of globalIntermediaryPermission) {
        await dataSource.query(
          `INSERT INTO permission_role (roles_id, permissions_id) VALUES ($1, $2)`,
          [roleRows[0].id, permissionRow.permissions_id],
        );
      }
    }

    // Users + memberships + branch assignments.
    const customerAUserId = await createPortalUser({
      firstName: 'Alice',
      lastName: 'Customer',
      email: `alice.customer.${suffix}@example.com`,
      phone: `+25572${suffix.slice(0, 7)}1`,
      userType: 'CUSTOMER',
      officerTitle: 'Customer',
    });
    const customerBUserId = await createPortalUser({
      firstName: 'Bob',
      lastName: 'Customer',
      email: `bob.customer.${suffix}@example.com`,
      phone: `+25572${suffix.slice(0, 7)}2`,
      userType: 'CUSTOMER',
      officerTitle: 'Customer',
    });
    const brokerAUserId = await createPortalUser({
      firstName: 'Alpha',
      lastName: 'Broker',
      email: `broker.a.${suffix}@example.com`,
      phone: `+25572${suffix.slice(0, 7)}3`,
      userType: 'BROKER',
      officerTitle: 'Intermediary Portal User',
    });
    const brokerBUserId = await createPortalUser({
      firstName: 'Beta',
      lastName: 'Broker',
      email: `broker.b.${suffix}@example.com`,
      phone: `+25572${suffix.slice(0, 7)}4`,
      userType: 'BROKER',
      officerTitle: 'Intermediary Portal User',
    });

    await addMembership({
      userId: customerAUserId,
      companyId: insurerCompanyId,
      branchId: insurerBranchId,
      roleName: 'CUSTOMER_PORTAL',
    });
    await addMembership({
      userId: customerBUserId,
      companyId: insurerCompanyId,
      branchId: insurerBranchId,
      roleName: 'CUSTOMER_PORTAL',
    });
    await addMembership({
      userId: brokerAUserId,
      companyId: brokerACompanyId,
      branchId: brokerABranchId,
      roleName: 'INTERMEDIARY_PORTAL',
    });
    await addMembership({
      userId: brokerBUserId,
      companyId: brokerBCompanyId,
      branchId: brokerBBranchId,
      roleName: 'INTERMEDIARY_PORTAL',
    });

    // Portal accounts.
    await dataSource.query(
      `
      INSERT INTO portal_accounts (
        company_id, user_id, actor_type, customer_id, status, activated_at
      )
      VALUES ($1, $2, 'CUSTOMER', $3, 'ACTIVE', now())
      `,
      [insurerCompanyId, customerAUserId, customerAId],
    );
    await dataSource.query(
      `
      INSERT INTO portal_accounts (
        company_id, user_id, actor_type, customer_id, status, activated_at
      )
      VALUES ($1, $2, 'CUSTOMER', $3, 'ACTIVE', now())
      `,
      [insurerCompanyId, customerBUserId, customerBId],
    );
    await dataSource.query(
      `
      INSERT INTO portal_accounts (
        company_id, user_id, actor_type, intermediary_company_id, status, activated_at
      )
      VALUES ($1, $2, 'INTERMEDIARY', $1, 'ACTIVE', now())
      `,
      [brokerACompanyId, brokerAUserId],
    );
    await dataSource.query(
      `
      INSERT INTO portal_accounts (
        company_id, user_id, actor_type, intermediary_company_id, status, activated_at
      )
      VALUES ($1, $2, 'INTERMEDIARY', $1, 'ACTIVE', now())
      `,
      [brokerBCompanyId, brokerBUserId],
    );

    // Policies scoped to each customer.
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const policyA = await dataSource.query(
      `
      INSERT INTO policies (
        company_id, insurer_company_id, customer_id, category_id, product_id,
        policy_no, channel_type, policy_status, start_date, end_date, issue_date
      )
      VALUES ($1, $1, $2, $3, $4, $5, 'DIRECT', 'ACTIVE', $6, $7, $6)
      RETURNING id
      `,
      [
        insurerCompanyId,
        customerAId,
        categoryId,
        productId,
        `POL-TEST-A-${suffix}`,
        today,
        nextYear,
      ],
    );
    customerAPolicyId = policyA[0].id;

    const policyB = await dataSource.query(
      `
      INSERT INTO policies (
        company_id, insurer_company_id, customer_id, category_id, product_id,
        policy_no, channel_type, policy_status, start_date, end_date, issue_date
      )
      VALUES ($1, $1, $2, $3, $4, $5, 'DIRECT', 'ACTIVE', $6, $7, $6)
      RETURNING id
      `,
      [
        insurerCompanyId,
        customerBId,
        categoryId,
        productId,
        `POL-TEST-B-${suffix}`,
        today,
        nextYear,
      ],
    );
    customerBPolicyId = policyB[0].id;

    // Quotations scoped to each broker.
    const quotationA = await dataSource.query(
      `
      INSERT INTO quotations (
        company_id, insurer_company_id, intermediary_company_id, category_id,
        product_id, quotation_no, quotation_type, quotation_flow, channel_type
      )
      VALUES ($1, $1, $2, $3, $4, $5, 'MOTOR', 'MOTOR_SINGLE', 'BROKER')
      RETURNING id
      `,
      [
        insurerCompanyId,
        brokerACompanyId,
        categoryId,
        productId,
        `QUO-TEST-A-${suffix}`,
      ],
    );
    brokerAQuotationId = quotationA[0].id;

    const quotationB = await dataSource.query(
      `
      INSERT INTO quotations (
        company_id, insurer_company_id, intermediary_company_id, category_id,
        product_id, quotation_no, quotation_type, quotation_flow, channel_type
      )
      VALUES ($1, $1, $2, $3, $4, $5, 'MOTOR', 'MOTOR_SINGLE', 'BROKER')
      RETURNING id
      `,
      [
        insurerCompanyId,
        brokerBCompanyId,
        categoryId,
        productId,
        `QUO-TEST-B-${suffix}`,
      ],
    );
    brokerBQuotationId = quotationB[0].id;

    // Real logins - proves the whole auth chain (session, Redis blacklist
    // check, membership context resolution) works end to end.
    customerAToken = await login(`alice.customer.${suffix}@example.com`);
    customerBToken = await login(`bob.customer.${suffix}@example.com`);
    brokerAToken = await login(`broker.a.${suffix}@example.com`);
    brokerBToken = await login(`broker.b.${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows Customer A to read Customer A policy', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/customer/policies/${customerAPolicyId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
  });

  it('returns 404 when Customer A requests Customer B policy', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/customer/policies/${customerBPolicyId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(404);
  });

  it('returns 404 when Broker A requests Broker B quotation', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/intermediary/quotations/${brokerBQuotationId}`)
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(404);
  });

  it('allows Broker A to read Broker A quotation', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/intermediary/quotations/${brokerAQuotationId}`)
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(200);
  });

  it('prevents a customer token from accessing intermediary routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/intermediary/dashboard')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(403);
  });

  it('prevents an intermediary token from accessing customer routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/customer/dashboard')
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(403);
  });

  it('prevents Customer B from reading Customer A policy either', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/customer/policies/${customerAPolicyId}`)
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(404);
  });
});
