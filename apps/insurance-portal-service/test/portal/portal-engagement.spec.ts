import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash, randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import request, { type Response } from 'supertest';
import { DataSource, type QueryRunner } from 'typeorm';

import { hashPassword } from '@insurance-max/portal-shared/utils/hash.util';
import { CompaniesService } from '../../src/modules/platform/companies/companies.service';
import { SessionsService } from '../../src/modules/shared/sessions/sessions.service';
import { DocumentStorageService } from '../../src/modules/tenant/insurance-documents/document-storage.service';

jest.setTimeout(60_000);

process.env.APP_ENV ??= 'test';
process.env.AUTH_SECRET_ENCRYPTION_KEY ??=
  'kclGTZzK9BZPtHbqcLGShyEfRqOXJ9SNdb1pFAJnaJs=';
process.env.AUTH_BACKUP_CODE_PEPPER ??= 'a'.repeat(32);
process.env.AUTH_DEVICE_TOKEN_PEPPER ??= 'b'.repeat(32);
process.env.SERVICE_AUTH_SECRET ??= 'c'.repeat(32);
process.env.SERVICE_AUTH_ISSUER ??= 'insurance-portal-service';
process.env.SERVICE_AUTH_SUBJECT ??= 'insurance-portal-service';
process.env.SERVICE_AUTH_AUDIENCE ??= 'insurance-portal-service';
process.env.SERVICE_AUTH_ALLOWED_ISSUERS ??= 'insurance-portal-service';
process.env.DB_LOGGING ??= 'false';

describe('Portal engagement access (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let storageService: DocumentStorageService;
  let jwtService: JwtService;
  let sessionsService: SessionsService;
  let companiesService: CompaniesService;

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

  let customerAUserId: string;
  let brokerAUserId: string;

  let customerADocumentId: string;
  let customerBDocumentId: string;
  let brokerADocumentId: string;
  let brokerBDocumentId: string;

  let customerAThreadId: string;
  let brokerAThreadId: string;
  let brokerBThreadId: string;

  let customerASignatureId: string;
  let brokerASignatureId: string;
  let brokerBSignatureId: string;

  let customerANotificationId: string;
  let brokerANotificationId: string;

  let customerAToken: string;
  let brokerAToken: string;

  const suffix = randomUUID().slice(0, 8);
  const testPassword = 'StrongPassword@2026';

  function unwrap<T>(response: Response): T {
    return (response.body.data ?? response.body) as T;
  }

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
        `USR-E${suffix}${randomUUID().slice(0, 4)}`,
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
  }

  async function issueCompanyAccessToken(params: {
    userId: string;
    email: string;
    userType: string;
    companyId: string;
  }): Promise<string> {
    const companyContext = await companiesService.getMembershipContext(
      params.userId,
      params.companyId,
    );

    const session = await sessionsService.create({
      userId: params.userId,
      refreshToken: randomUUID(),
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    return jwtService.sign({
      sub: params.userId,
      email: params.email,
      scope: 'company',
      userType: params.userType,
      companyId: companyContext.companyId,
      companySlug: companyContext.companySlug,
      companyName: companyContext.companyName,
      companyType: companyContext.companyType,
      membershipId: companyContext.membershipId,
      activeBranchId: companyContext.activeBranchId,
      activeBranchCode: companyContext.activeBranchCode,
      activeBranchName: companyContext.activeBranchName,
      defaultSalePointId: companyContext.defaultSalePointId,
      defaultSalePointCode: companyContext.defaultSalePointCode,
      defaultSalePointName: companyContext.defaultSalePointName,
      assignedBranchIds: companyContext.assignedBranchIds,
      activeDepartmentId: companyContext.activeDepartmentId,
      activeDepartmentCode: companyContext.activeDepartmentCode,
      activeDepartmentName: companyContext.activeDepartmentName,
      assignedDepartmentIds: companyContext.assignedDepartmentIds,
      roles: companyContext.roles,
      permissions: companyContext.permissions,
      authorizationVersion: companyContext.authorizationVersion,
      type: 'access',
      iss: 'insurance-idp.tz',
      aud: 'insurance-platform',
      sessionId: session.id,
      jti: randomUUID(),
    });
  }

  async function copyIntermediaryPortalRole(companyId: string) {
    const globalRole = await dataSource.query(
      `SELECT id FROM roles WHERE name = 'INTERMEDIARY_PORTAL' AND company_id IS NULL`,
    );
    const permissionRows = await dataSource.query(
      `SELECT permissions_id FROM permission_role WHERE roles_id = $1`,
      [globalRole[0].id],
    );
    const roleRows = await dataSource.query(
      `
      INSERT INTO roles (name, display_name, description, company_id, is_system_generated)
      VALUES ('INTERMEDIARY_PORTAL', 'Intermediary Portal', 'Broker portal user', $1, true)
      RETURNING id
      `,
      [companyId],
    );

    for (const permissionRow of permissionRows) {
      await dataSource.query(
        `INSERT INTO permission_role (roles_id, permissions_id) VALUES ($1, $2)`,
        [roleRows[0].id, permissionRow.permissions_id],
      );
    }
  }

  async function createDocument(params: {
    companyId: string;
    ownerType: string;
    ownerId: string;
    title: string;
    customerVisible?: boolean;
    intermediaryVisible?: boolean;
    uploadedBy: string;
  }) {
    const fileName = `${params.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    const buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const stored = await storageService.store({
      buffer,
      companyId: params.companyId,
      fileName,
      maximumBytes: 1024 * 1024,
      prefix: 'documents',
    });

    const documentRows = await dataSource.query(
      `
      INSERT INTO documents (
        company_id, document_no, owner_type, owner_id, title, document_type,
        classification, source_type, storage_key, checksum, content_type,
        file_name, file_size, status, current_version_id, customer_visible,
        intermediary_visible, public_verification_enabled,
        public_verification_code, retention_policy_code, retention_until,
        legal_hold, legal_hold_reason, uploaded_by, verified_by, verified_at,
        rejection_reason, created_by, archived_at, deleted_at
      )
      VALUES (
        $1, $2, $3, $4, $5, 'PORTAL', 'INTERNAL', 'UPLOAD', $6, $7, $8,
        $9, $10, 'AVAILABLE', NULL, $11, $12, false, NULL, NULL, NULL,
        false, NULL, $13, $13, now(), NULL, $13, NULL, NULL
      )
      RETURNING id
      `,
      [
        params.companyId,
        `DOC-${randomUUID().slice(0, 8).toUpperCase()}`,
        params.ownerType,
        params.ownerId,
        params.title,
        stored.storageKey,
        stored.checksum,
        stored.detectedMimeType,
        stored.originalFileName,
        stored.size,
        params.customerVisible ?? false,
        params.intermediaryVisible ?? false,
        params.uploadedBy,
      ],
    );
    const documentId = documentRows[0].id as string;

    const versionRows = await dataSource.query(
      `
      INSERT INTO document_versions (
        company_id, document_id, version_number, status, storage_provider,
        storage_bucket, storage_key, original_file_name, safe_file_name,
        declared_mime_type, detected_mime_type, detected_extension, file_size,
        sha256_hash, encryption_key_reference, source_snapshot,
        source_snapshot_hash, template_code, template_version,
        generator_version, page_count, scan_status, scan_provider,
        scan_reference, scanned_at, scan_result, uploaded_by, uploaded_at,
        supersedes_version_id
      )
      VALUES (
        $1, $2, 1, 'AVAILABLE', 'local_private', NULL, $3, $4, $5, $6, $6,
        $7, $8, $9, NULL, NULL, NULL, NULL, NULL, NULL, 1, 'CLEAN',
        'internal', NULL, now(), $10, $11, now(), NULL
      )
      RETURNING id
      `,
      [
        params.companyId,
        documentId,
        stored.storageKey,
        stored.originalFileName,
        stored.safeFileName,
        stored.detectedMimeType,
        stored.detectedExtension,
        stored.size,
        stored.checksum,
        JSON.stringify({ status: 'clean' }),
        params.uploadedBy,
      ],
    );
    const versionId = versionRows[0].id as string;

    await dataSource.query(
      `UPDATE documents SET current_version_id = $2 WHERE id = $1`,
      [documentId, versionId],
    );

    return { documentId, versionId };
  }

  async function createThread(params: {
    companyId: string;
    resourceType: string;
    resourceId: string;
    subject: string;
    customerVisible?: boolean;
    intermediaryVisible?: boolean;
  }) {
    const threadRows = await dataSource.query(
      `
      INSERT INTO communication_threads (
        company_id, thread_no, thread_type, subject, resource_type,
        resource_id, customer_visible, intermediary_visible, closed_at,
        closed_by, metadata
      )
      VALUES ($1, $2, 'GENERAL', $3, $4, $5, $6, $7, NULL, NULL, NULL)
      RETURNING id
      `,
      [
        params.companyId,
        `COM-${randomUUID().slice(0, 8).toUpperCase()}`,
        params.subject,
        params.resourceType,
        params.resourceId,
        params.customerVisible ?? false,
        params.intermediaryVisible ?? false,
      ],
    );
    const threadId = threadRows[0].id as string;

    await dataSource.query(
      `
      INSERT INTO communication_messages (
        company_id, thread_id, direction, status, channel, subject, body_text,
        body_html, sender_type, sender_id, recipient_type, recipient_id,
        provider, provider_message_id, internal_only, metadata
      )
      VALUES (
        $1, $2, 'INBOUND', 'DELIVERED', 'PORTAL', $3, $4, NULL,
        'USER', NULL, NULL, NULL, NULL, NULL, false, NULL
      )
      `,
      [
        params.companyId,
        threadId,
        params.subject,
        `${params.subject} message`,
      ],
    );

    return threadId;
  }

  async function createSignatureRequest(params: {
    companyId: string;
    documentId: string;
    documentVersionId: string;
    createdBy: string;
    participantName: string;
  }) {
    const requestRows = await dataSource.query(
      `
      INSERT INTO signature_requests (
        company_id, request_no, document_id, document_version_id, status,
        signature_provider, provider_request_id, signing_order_required,
        expires_at, completion_document_version_id, evidence_document_id,
        created_by, completed_at
      )
      VALUES (
        $1, $2, $3, $4, 'SENT', 'internal', $5, false, NULL, NULL, NULL, $6, NULL
      )
      RETURNING id
      `,
      [
        params.companyId,
        `SIG-${randomUUID().slice(0, 8).toUpperCase()}`,
        params.documentId,
        params.documentVersionId,
        `internal-${randomUUID().slice(0, 8)}`,
        params.createdBy,
      ],
    );
    const signatureRequestId = requestRows[0].id as string;

    await dataSource.query(
      `
      INSERT INTO signature_participants (
        signature_request_id, participant_type, participant_id, name, email,
        phone, signing_order, status, access_token_hash, signed_at,
        declined_at, decline_reason
      )
      VALUES ($1, 'EXTERNAL', NULL, $2, $3, NULL, 1, 'PENDING', NULL, NULL, NULL, NULL)
      `,
      [
        signatureRequestId,
        params.participantName,
        `${params.participantName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      ],
    );

    await dataSource.query(
      `
      INSERT INTO signature_events (
        signature_request_id, event_type, actor_id, actor_type, notes, payload
      )
      VALUES ($1, 'CREATED', $2, 'USER', NULL, $3)
      `,
      [
        signatureRequestId,
        params.createdBy,
        JSON.stringify({ seeded: true }),
      ],
    );

    return signatureRequestId;
  }

  async function tableExists(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT to_regclass($1) AS table_name`,
      [`public.${tableName}`],
    );

    return Boolean(rows[0]?.table_name);
  }

  beforeAll(async () => {
    const { AppModule } = require('../../src/app.module');
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
    storageService = app.get(DocumentStorageService);
    jwtService = app.get(JwtService);
    sessionsService = app.get(SessionsService);
    companiesService = app.get(CompaniesService);
    await dataSource.runMigrations();

    const queryRunner = dataSource.createQueryRunner();
    try {
      const { Phase2AuthenticationHardening1794400000000 } = require('../../src/database/migrations/1794400000000-Phase2AuthenticationHardening');
      const { Phase3AuthorizationAndAudit1794500000000 } = require('../../src/database/migrations/1794500000000-Phase3AuthorizationAndAudit');
      const { OrganizationContextFoundation1794600000000 } = require('../../src/database/migrations/1794600000000-OrganizationContextFoundation');
      const { CustomerAndInsuredAssetFoundation1795000000000 } = require('../../src/database/migrations/1795000000000-CustomerAndInsuredAssetFoundation');
      await new Phase2AuthenticationHardening1794400000000().up(queryRunner);
      await new Phase3AuthorizationAndAudit1794500000000().up(queryRunner);
      await new OrganizationContextFoundation1794600000000().up(queryRunner);
      await new CustomerAndInsuredAssetFoundation1795000000000().up(queryRunner);

      if (!(await tableExists(queryRunner, 'documents'))) {
        const { ClaimsAndComplaintsAuthority1795600000000 } = require('../../src/database/migrations/1795600000000-ClaimsAndComplaintsAuthority');
        await new ClaimsAndComplaintsAuthority1795600000000().up(queryRunner);
      }

      if (!(await tableExists(queryRunner, 'communication_threads'))) {
        const { EngagementAndSelfService1795900000000 } = require('../../src/database/migrations/1795900000000-EngagementAndSelfService');
        await new EngagementAndSelfService1795900000000().up(queryRunner);
      }

      const { FixDocumentStatusConstraint1796000000000 } = require('../../src/database/migrations/1796000000000-FixDocumentStatusConstraint');
      await new FixDocumentStatusConstraint1796000000000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }

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

    const customerA = await dataSource.query(
      `
      INSERT INTO customers (
        company_id, customer_no, customer_type, first_name, last_name,
        phone, country_code, region, district, status
      )
      VALUES ($1, $2, 'INDIVIDUAL', 'Engaged', 'CustomerA', $3, 'TZA', 'Dar es Salaam', 'Ilala', 'ACTIVE')
      RETURNING id
      `,
      [
        insurerCompanyId,
        `CUST-EA-${suffix}`,
        `+25573${suffix.slice(0, 6)}1`,
      ],
    );
    customerAId = customerA[0].id;

    const customerB = await dataSource.query(
      `
      INSERT INTO customers (
        company_id, customer_no, customer_type, first_name, last_name,
        phone, country_code, region, district, status
      )
      VALUES ($1, $2, 'INDIVIDUAL', 'Engaged', 'CustomerB', $3, 'TZA', 'Dar es Salaam', 'Ilala', 'ACTIVE')
      RETURNING id
      `,
      [
        insurerCompanyId,
        `CUST-EB-${suffix}`,
        `+25573${suffix.slice(0, 6)}2`,
      ],
    );
    customerBId = customerB[0].id;

    const brokerA = await dataSource.query(
      `
      INSERT INTO companies (name, slug, company_type, status)
      VALUES ($1, $2, 'BROKER', 'active')
      RETURNING id
      `,
      [`Engagement Broker A ${suffix}`, `engagement-broker-a-${suffix}`],
    );
    brokerACompanyId = brokerA[0].id;

    const brokerB = await dataSource.query(
      `
      INSERT INTO companies (name, slug, company_type, status)
      VALUES ($1, $2, 'BROKER', 'active')
      RETURNING id
      `,
      [`Engagement Broker B ${suffix}`, `engagement-broker-b-${suffix}`],
    );
    brokerBCompanyId = brokerB[0].id;

    const brokerABranch = await dataSource.query(
      `INSERT INTO branches (company_id, name, code, status) VALUES ($1, 'HQ', $2, 'active') RETURNING id`,
      [brokerACompanyId, `EBA-${suffix}`],
    );
    const brokerABranchId = brokerABranch[0].id as string;

    const brokerBBranch = await dataSource.query(
      `INSERT INTO branches (company_id, name, code, status) VALUES ($1, 'HQ', $2, 'active') RETURNING id`,
      [brokerBCompanyId, `EBB-${suffix}`],
    );
    const brokerBBranchId = brokerBBranch[0].id as string;

    await copyIntermediaryPortalRole(brokerACompanyId);
    await copyIntermediaryPortalRole(brokerBCompanyId);

    customerAUserId = await createPortalUser({
      firstName: 'Engaged',
      lastName: 'CustomerA',
      email: `engaged.customer.a.${suffix}@example.com`,
      phone: `+25574${suffix.slice(0, 6)}1`,
      userType: 'CUSTOMER',
      officerTitle: 'Customer',
    });
    const customerBUserId = await createPortalUser({
      firstName: 'Engaged',
      lastName: 'CustomerB',
      email: `engaged.customer.b.${suffix}@example.com`,
      phone: `+25574${suffix.slice(0, 6)}2`,
      userType: 'CUSTOMER',
      officerTitle: 'Customer',
    });
    brokerAUserId = await createPortalUser({
      firstName: 'Engaged',
      lastName: 'BrokerA',
      email: `engaged.broker.a.${suffix}@example.com`,
      phone: `+25574${suffix.slice(0, 6)}3`,
      userType: 'BROKER',
      officerTitle: 'Intermediary Portal User',
    });
    const brokerBUserId = await createPortalUser({
      firstName: 'Engaged',
      lastName: 'BrokerB',
      email: `engaged.broker.b.${suffix}@example.com`,
      phone: `+25574${suffix.slice(0, 6)}4`,
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
        `POL-EA-${suffix}`,
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
        `POL-EB-${suffix}`,
        today,
        nextYear,
      ],
    );
    customerBPolicyId = policyB[0].id;

    const quotationA = await dataSource.query(
      `
      INSERT INTO quotations (
        company_id, insurer_company_id, intermediary_company_id, category_id,
        product_id, quotation_no, quotation_type, quotation_flow, channel_type,
        customer_id
      )
      VALUES ($1, $1, $2, $3, $4, $5, 'MOTOR', 'MOTOR_SINGLE', 'BROKER', $6)
      RETURNING id
      `,
      [
        insurerCompanyId,
        brokerACompanyId,
        categoryId,
        productId,
        `QUO-EA-${suffix}`,
        customerAId,
      ],
    );
    brokerAQuotationId = quotationA[0].id;

    const quotationB = await dataSource.query(
      `
      INSERT INTO quotations (
        company_id, insurer_company_id, intermediary_company_id, category_id,
        product_id, quotation_no, quotation_type, quotation_flow, channel_type,
        customer_id
      )
      VALUES ($1, $1, $2, $3, $4, $5, 'MOTOR', 'MOTOR_SINGLE', 'BROKER', $6)
      RETURNING id
      `,
      [
        insurerCompanyId,
        brokerBCompanyId,
        categoryId,
        productId,
        `QUO-EB-${suffix}`,
        customerBId,
      ],
    );
    brokerBQuotationId = quotationB[0].id;

    const customerADocument = await createDocument({
      companyId: insurerCompanyId,
      ownerType: 'POLICY',
      ownerId: customerAPolicyId,
      title: 'Customer A Schedule',
      customerVisible: true,
      uploadedBy: customerAUserId,
    });
    customerADocumentId = customerADocument.documentId;

    const customerBDocument = await createDocument({
      companyId: insurerCompanyId,
      ownerType: 'POLICY',
      ownerId: customerBPolicyId,
      title: 'Customer B Schedule',
      customerVisible: true,
      uploadedBy: customerBUserId,
    });
    customerBDocumentId = customerBDocument.documentId;

    const brokerADocument = await createDocument({
      companyId: insurerCompanyId,
      ownerType: 'QUOTATION',
      ownerId: brokerAQuotationId,
      title: 'Broker A Quote Pack',
      intermediaryVisible: true,
      uploadedBy: brokerAUserId,
    });
    brokerADocumentId = brokerADocument.documentId;

    const brokerBDocument = await createDocument({
      companyId: insurerCompanyId,
      ownerType: 'QUOTATION',
      ownerId: brokerBQuotationId,
      title: 'Broker B Quote Pack',
      intermediaryVisible: true,
      uploadedBy: brokerBUserId,
    });
    brokerBDocumentId = brokerBDocument.documentId;

    customerAThreadId = await createThread({
      companyId: insurerCompanyId,
      resourceType: 'POLICY',
      resourceId: customerAPolicyId,
      subject: 'Customer A renewal follow-up',
      customerVisible: true,
    });

    brokerAThreadId = await createThread({
      companyId: insurerCompanyId,
      resourceType: 'QUOTATION',
      resourceId: brokerAQuotationId,
      subject: 'Broker A quotation clarifications',
      intermediaryVisible: true,
    });

    brokerBThreadId = await createThread({
      companyId: insurerCompanyId,
      resourceType: 'QUOTATION',
      resourceId: brokerBQuotationId,
      subject: 'Broker B quotation clarifications',
      intermediaryVisible: true,
    });

    customerASignatureId = await createSignatureRequest({
      companyId: insurerCompanyId,
      documentId: customerADocument.documentId,
      documentVersionId: customerADocument.versionId,
      createdBy: customerAUserId,
      participantName: 'Customer A Signer',
    });

    brokerASignatureId = await createSignatureRequest({
      companyId: insurerCompanyId,
      documentId: brokerADocument.documentId,
      documentVersionId: brokerADocument.versionId,
      createdBy: brokerAUserId,
      participantName: 'Broker A Signer',
    });

    brokerBSignatureId = await createSignatureRequest({
      companyId: insurerCompanyId,
      documentId: brokerBDocument.documentId,
      documentVersionId: brokerBDocument.versionId,
      createdBy: brokerBUserId,
      participantName: 'Broker B Signer',
    });

    const customerNotificationRows = await dataSource.query(
      `
      INSERT INTO portal_notifications (
        company_id, user_id, type, severity, title, message, resource_type,
        resource_id, action_url, read_at
      )
      VALUES ($1, $2, 'DOCUMENT_READY', 'INFO', 'Customer document ready', 'Your policy document is ready.', 'DOCUMENT', $3, '/customer/documents', NULL)
      RETURNING id
      `,
      [insurerCompanyId, customerAUserId, customerADocumentId],
    );
    customerANotificationId = customerNotificationRows[0].id as string;

    const brokerNotificationRows = await dataSource.query(
      `
      INSERT INTO portal_notifications (
        company_id, user_id, type, severity, title, message, resource_type,
        resource_id, action_url, read_at
      )
      VALUES ($1, $2, 'MESSAGE_READY', 'INFO', 'Broker message ready', 'A quotation clarification is waiting.', 'THREAD', $3, '/intermediary/messages', NULL)
      RETURNING id
      `,
      [brokerACompanyId, brokerAUserId, brokerAThreadId],
    );
    brokerANotificationId = brokerNotificationRows[0].id as string;

    customerAToken = await issueCompanyAccessToken({
      userId: customerAUserId,
      email: `engaged.customer.a.${suffix}@example.com`,
      userType: 'CUSTOMER',
      companyId: insurerCompanyId,
    });
    brokerAToken = await issueCompanyAccessToken({
      userId: brokerAUserId,
      email: `engaged.broker.a.${suffix}@example.com`,
      userType: 'BROKER',
      companyId: brokerACompanyId,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('lists only customer-visible documents for the authenticated customer', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/customer/documents')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    const documents = unwrap<Array<{ id: string; title: string }>>(response);

    expect(documents.map((item) => item.id)).toContain(customerADocumentId);
    expect(documents.map((item) => item.id)).not.toContain(customerBDocumentId);
    expect(documents.map((item) => item.id)).not.toContain(brokerADocumentId);
  });

  it('returns 404 when a customer requests another customer document', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/customer/documents/${customerBDocumentId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(404);
  });

  it('downloads a customer document and records the access event', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/customer/documents/${customerADocumentId}/download`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    expect(response.header['content-type']).toContain('application/pdf');
    expect(response.header['content-disposition']).toContain('attachment;');

    const accessRows = await dataSource.query(
      `
      SELECT actor_type, access_channel, result
      FROM document_access_events
      WHERE document_id = $1
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [customerADocumentId],
    );

    expect(accessRows[0]).toMatchObject({
      actor_type: 'PORTAL_CUSTOMER',
      access_channel: 'PORTAL',
      result: 'SUCCESS',
    });
  });

  it('allows an intermediary to read insurer-owned documents, messages, and signatures via quotation scope', async () => {
    const documentsResponse = await request(app.getHttpServer())
      .get('/api/v1/intermediary/documents')
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(200);
    const documents = unwrap<Array<{ id: string }>>(documentsResponse);

    const messagesResponse = await request(app.getHttpServer())
      .get('/api/v1/intermediary/messages')
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(200);
    const messages = unwrap<Array<{ id: string }>>(messagesResponse);

    const signaturesResponse = await request(app.getHttpServer())
      .get('/api/v1/intermediary/signatures')
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(200);
    const signatures = unwrap<Array<{ id: string }>>(signaturesResponse);

    expect(documents.map((item) => item.id)).toContain(brokerADocumentId);
    expect(documents.map((item) => item.id)).not.toContain(brokerBDocumentId);
    expect(messages.map((item) => item.id)).toContain(brokerAThreadId);
    expect(messages.map((item) => item.id)).not.toContain(brokerBThreadId);
    expect(signatures.map((item) => item.id)).toContain(brokerASignatureId);
    expect(signatures.map((item) => item.id)).not.toContain(brokerBSignatureId);
  });

  it('returns 404 when an intermediary requests another intermediary resource', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/intermediary/messages/${brokerBThreadId}`)
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/intermediary/signatures/${brokerBSignatureId}`)
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(404);
  });

  it('lists and marks customer notifications as read', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/customer/notifications')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    const notifications = unwrap<Array<{ id: string; read_at: string | null }>>(
      listResponse,
    );
    expect(notifications.map((item) => item.id)).toContain(customerANotificationId);

    const readResponse = await request(app.getHttpServer())
      .post(`/api/v1/customer/notifications/${customerANotificationId}/read`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(201);

    const readNotification = unwrap<{ id: string; read_at: string | null }>(
      readResponse,
    );
    expect(readNotification.id).toBe(customerANotificationId);
    expect(readNotification.read_at).not.toBeNull();
  });

  it('stores intermediary replies as portal-account messages', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/intermediary/messages/${brokerAThreadId}/messages`)
      .set('Authorization', `Bearer ${brokerAToken}`)
      .send({ body_text: 'We have uploaded the missing quotation document.' })
      .expect(201);

    const messageRows = await dataSource.query(
      `
      SELECT sender_type, channel, body_text
      FROM communication_messages
      WHERE thread_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [brokerAThreadId],
    );

    expect(messageRows[0]).toMatchObject({
      sender_type: 'PORTAL_ACCOUNT',
      channel: 'PORTAL',
      body_text: 'We have uploaded the missing quotation document.',
    });
  });

  it('lists intermediary notifications in the intermediary company context', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/intermediary/notifications')
      .set('Authorization', `Bearer ${brokerAToken}`)
      .expect(200);

    const notifications = unwrap<Array<{ id: string }>>(response);
    expect(notifications.map((item) => item.id)).toContain(brokerANotificationId);
  });
});
