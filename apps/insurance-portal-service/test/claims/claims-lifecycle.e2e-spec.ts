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
import { TiramisSubmissionTrackingEntity } from '../../src/modules/tiramis/entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionTrackingRepository } from '../../src/modules/tiramis/repositories/tiramis-submission-tracking.repository';
import { TiramisBusinessRecordSyncService } from '../../src/modules/tiramis/services/tiramis-business-record-sync.service';
import { TiramisClientService } from '../../src/modules/tiramis/services/tiramis-client.service';
import { FinanceJournalService } from '../../src/modules/tenant/billing-commission/services/finance-journal.service';
import { FinancePostingPolicyService } from '../../src/modules/tenant/billing-commission/services/finance-posting-policy.service';
import { provisionSyntheticJournalAccounts } from '../support/synthetic-journal-accounts';
import { DocumentStorageService } from '../../src/modules/tenant/insurance-documents/document-storage.service';
import { ClaimFxGovernanceService } from '../../src/modules/tenant/claims/services/claim-fx-governance.service';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

jest.setTimeout(300_000);

/**
 * Claims lifecycle against a real database (TIRAMIS v1.3 §9–14):
 * notification → intimation → assessment → discharge voucher → payments →
 * settlement, plus the rejection path and company isolation.
 *
 * Everything in the portal runs for real (HTTP API, guards, services,
 * tracking rows, outcome handling). Only the hop to the TIRAMIS gateway is
 * replaced by an in-process mock TIRA: it acknowledges every request, and
 * the test then delivers TIRA's final callback the way the status sync does
 * (tracking update + business-record sync).
 */
describe('Claims lifecycle with mock TIRA (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tracking: TiramisSubmissionTrackingRepository;
  let recordSync: TiramisBusinessRecordSyncService;

  const suffix = randomUUID().slice(0, 8);
  const testPassword = 'StrongPassword@2026';
  const today = new Date();
  const isoDate = (date: Date) => date.toISOString().slice(0, 10);

  let companyId: string;
  let branchId: string;
  let policyId: string;
  let otherPolicyId: string;
  let officerToken: string;
  let managerToken: string;
  let financeToken: string;
  let financeConfirmerToken: string;
  let assessorToken: string;
  let outsiderToken: string;
  let sameBranchToken: string;
  let otherBranchToken: string;

  /** Requests the mock TIRA received, in order. */
  const tiraRequests: Array<{
    pattern: string;
    requestType: string;
    sourceRecordId: string | null;
    requestId: string;
    payload: Record<string, unknown>;
  }> = [];

  // ------------------------------------------------------------------ helpers

  async function createUser(label: string) {
    const rows = await dataSource.query(
      `
      INSERT INTO users (
        first_name, last_name, email, phone, password, status,
        user_type, officer_title, is_email_verified, is_phone_verified,
        is_two_factor_enabled
      )
      VALUES ($1, 'Tester', $2, $3, $4, 'active', 'COMPANY_USER', $5, true, true, false)
      RETURNING id
      `,
      [
        label,
        `${label.toLowerCase()}.${suffix}@example.com`,
        `+25573${randomUUID().replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
        await hashPassword(testPassword),
        `Claims ${label}`,
      ],
    );
    return rows[0].id as string;
  }

  async function addMembership(
    userId: string,
    company: string,
    branch: string,
    roleName: string,
    dataScope: 'COMPANY' | 'BRANCH' = 'COMPANY',
  ) {
    const membership = await dataSource.query(
      `INSERT INTO company_users (company_id, user_id, status, is_default, quotation_policy_data_scope)
       VALUES ($1, $2, 'active', true, $3) RETURNING id`,
      [company, userId, dataScope],
    );
    await dataSource.query(
      `INSERT INTO branch_users (branch_id, company_user_id, is_primary, is_active_branch, activated_at)
       VALUES ($1, $2, true, true, now())`,
      [branch, membership[0].id],
    );
    const role = await dataSource.query(
      `SELECT id FROM roles WHERE name = $1 AND company_id = $2`,
      [roleName, company],
    );
    if (!role[0]) {
      throw new Error(`Role ${roleName} not seeded for company ${company}`);
    }
    await dataSource.query(
      `INSERT INTO company_user_roles (company_user_id, role_id) VALUES ($1, $2)`,
      [membership[0].id, role[0].id],
    );
  }

  async function login(label: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `${label.toLowerCase()}.${suffix}@example.com`,
        password: testPassword,
      });
    const token =
      response.body.data?.access_token ??
      response.body.data?.accessToken ??
      response.body.access_token;
    if (!token) {
      throw new Error(
        `Login failed for ${label}: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }
    return token as string;
  }

  /** Calls the claims API and fails with the server's message on error. */
  async function call(
    token: string,
    method: 'get' | 'post' | 'patch',
    path: string,
    body?: object,
    expected = [200, 201],
  ) {
    const req = request(app.getHttpServer())
      [method](`/api/v1/tenant/claims${path}`)
      .set('Authorization', `Bearer ${token}`);
    const response = body ? await req.send(body) : await req;
    if (!expected.includes(response.status)) {
      throw new Error(
        `${method.toUpperCase()} ${path} → ${response.status}: ${JSON.stringify(response.body)}`,
      );
    }
    return response.body?.data ?? response.body;
  }

  const claimDetail = (id: string) => call(officerToken, 'get', `/${id}`);

  async function latestTracking(sourceRecordId: string) {
    const row = await dataSource
      .getRepository(TiramisSubmissionTrackingEntity)
      .findOne({ where: { sourceRecordId }, order: { createdAt: 'DESC' } });
    if (!row) throw new Error(`No TIRAMIS submission for ${sourceRecordId}`);
    return row;
  }

  /**
   * TIRA's final callback for the latest submission of a record, applied
   * the way TiramisStatusSyncService does it.
   */
  async function tiraFinal(
    sourceRecordId: string,
    outcome: { code?: string; desc?: string; extra?: Record<string, unknown> },
  ) {
    const row = await latestTracking(sourceRecordId);
    const updated = await tracking.markSubmittedResponse(
      row.id,
      {
        requestId: row.tiramisRequestId,
        finalResponse: {
          rootName: 'ClaimResp',
          responseId: `RESP-${randomUUID().slice(0, 8)}`,
          requestId: row.tiramisRequestId,
          responseStatusCode: outcome.code ?? 'TIRA001',
          responseStatusDesc: outcome.desc ?? 'Successful',
          ...outcome.extra,
        },
      },
      { syncChecked: true },
    );
    await recordSync.syncFromTracking(updated);
    return row;
  }

  const accept = (id: string, extra?: Record<string, unknown>) =>
    tiraFinal(id, { extra });

  async function eventCount(claimId: string, eventType: string) {
    const rows = await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM claim_events WHERE claim_id = $1 AND event_type = $2`,
      [claimId, eventType],
    );
    return rows[0].count as number;
  }

  const claimant = {
    claimant_type: 'POLICYHOLDER',
    is_primary: true,
    full_name: 'Asha Juma',
    claimant_category: 1,
    party_type: 1,
    id_type: 1,
    identification_number: `19800101111110000${suffix.replace(/\D/g, '1').slice(0, 3)}`,
    birth_date: '1980-01-01',
    gender: 'F',
    country_code: 'TZA',
    region: 'Dar es Salaam',
    district: 'Ilala',
    street: 'Samora Avenue',
    phone: '255713000000',
    postal_address: 'P.O. Box 1',
    email: `asha.${suffix}@example.com`,
  };

  async function notifiedClaim(policy: string) {
    const created = await call(officerToken, 'post', '', {
      policy_id: policy,
      loss_date: new Date(today.getTime() - 2 * 86_400_000).toISOString(),
      claim_report_date: new Date(today.getTime() - 86_400_000).toISOString(),
      loss_nature: 'Collision',
      loss_type: 'Own damage',
      loss_location: 'Morogoro Road, Dar es Salaam',
      description: 'Rear-ended at the traffic lights.',
      estimated_amount: '1200000.00',
      claim_form_dully_filled: true,
      claimants: [claimant],
    });
    await call(officerToken, 'post', `/${created.id}/notification/submit`, {});
    await accept(created.id, {
      ClaimReferenceNumber: `TIRA-CLM-${randomUUID().slice(0, 8)}`,
    });
    return created.id as string;
  }

  // --------------------------------------------------------------- fixtures

  beforeAll(async () => {
    process.env.TIRAMIS_CANONICAL_INGRESS_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // These claims lifecycle tests exercise journal transactions, not policy activation.
      // Finance posting authorization has dedicated integration tests.
      .overrideProvider(FinancePostingPolicyService)
      .useValue({ requireEligible: jest.fn().mockResolvedValue(undefined) })
      .compile();

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
    tracking = app.get(TiramisSubmissionTrackingRepository, { strict: false });
    recordSync = app.get(TiramisBusinessRecordSyncService, { strict: false });

    // Mock TIRA: acknowledge every request with a fresh RequestId.
    jest
      .spyOn(TiramisClientService.prototype as any, 'send')
      .mockImplementation(async (...args: unknown[]) => {
        const [pattern, command] = args as [string, any];
        const requestId = `REQ-${randomUUID()}`;
        tiraRequests.push({
          pattern,
          requestType: command.requestType,
          sourceRecordId: command.sourceRecordId,
          requestId,
          payload: command.payload,
        });
        return {
          requestId,
          acknowledgement: {
            rootName: 'ClaimReqAck',
            requestId,
            acknowledgementId: `ACK-${randomUUID().slice(0, 8)}`,
            statusCode: 'TIRA001',
            statusDesc: 'Successful',
          },
        };
      });

    // Require every claims role this suite assigns: earlier runs leave behind
    // "Other Insurer" companies that only carry a copied CLAIMS_OFFICER role.
    const insurer = await dataSource.query(
      `SELECT c.id FROM companies c
        WHERE c.company_type = 'INSURANCE_COMPANY'
          AND (SELECT count(DISTINCT r.name) FROM roles r
                WHERE r.company_id = c.id
                  AND r.name IN ('CLAIMS_OFFICER', 'CLAIMS_MANAGER', 'CLAIMS_ASSESSOR')) = 3
        ORDER BY c.created_at ASC
        LIMIT 1`,
    );
    companyId = insurer[0].id;
    await provisionSyntheticJournalAccounts(dataSource, companyId);
    const branch = await dataSource.query(
      `SELECT id FROM branches WHERE company_id = $1 AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
      [companyId],
    );
    branchId = branch[0].id;
    const product = await dataSource.query(
      `SELECT id, category_id FROM insurance_products LIMIT 1`,
    );

    const customer = await dataSource.query(
      `INSERT INTO customers (
         company_id, customer_no, customer_type, first_name, last_name,
         phone, country_code, region, district, status
       )
       VALUES ($1, $2, 'INDIVIDUAL', 'Asha', 'Juma', $3, 'TZA', 'Dar es Salaam', 'Ilala', 'ACTIVE')
       RETURNING id`,
      [companyId, `CUST-CLM-${suffix}`, `+25574${suffix.slice(0, 7)}`],
    );

    const start = isoDate(new Date(today.getTime() - 30 * 86_400_000));
    const end = isoDate(new Date(today.getTime() + 335 * 86_400_000));
    const createPolicy = async (no: string) => {
      const rows = await dataSource.query(
        `INSERT INTO policies (
           company_id, insurer_company_id, customer_id, category_id, product_id,
           policy_no, channel_type, policy_status, start_date, end_date,
           issue_date, cover_note_no, branch_id, currency
         )
         VALUES ($1, $1, $2, $3, $4, $5, 'DIRECT', 'ACTIVE', $6, $7, $6, $8, $9, 'TZS')
         RETURNING id`,
        [
          companyId,
          customer[0].id,
          product[0].category_id,
          product[0].id,
          no,
          start,
          end,
          `CN-${no}`,
          branchId,
        ],
      );
      // Coverage is decided by the policy version effective on the loss date.
      await dataSource.query(
        `INSERT INTO policy_versions (
           company_id, policy_id, version_number, version_type, status,
           effective_from, effective_to,
           policy_snapshot, policy_snapshot_hash, pricing_snapshot, pricing_result_hash,
           customer_snapshot, customer_snapshot_hash, asset_manifest, asset_manifest_hash
         )
         VALUES ($1, $2, 1, 'NEW_BUSINESS', 'ACTIVE', $3, $4,
                 '{}', 'test', '{}', 'test', '{}', 'test', '{}', 'test')`,
        [companyId, rows[0].id, start, end],
      );
      return rows[0].id as string;
    };
    policyId = await createPolicy(`POL-CLM-A-${suffix}`);
    otherPolicyId = await createPolicy(`POL-CLM-B-${suffix}`);

    for (const [label, role] of [
      ['Officer', 'CLAIMS_OFFICER'],
      ['Manager', 'CLAIMS_MANAGER'],
      // Claims Finance was folded into Claims Manager.
      ['Finance', 'CLAIMS_MANAGER'],
      ['FinanceConfirmer', 'CLAIMS_MANAGER'],
      ['Assessor', 'CLAIMS_ASSESSOR'],
    ] as const) {
      await addMembership(await createUser(label), companyId, branchId, role);
    }

    // A claims officer of another insurer must never see this company's claims.
    const other = await dataSource.query(
      `INSERT INTO companies (name, slug, company_type, status)
       VALUES ($1, $2, 'INSURANCE_COMPANY', 'active') RETURNING id`,
      [`Other Insurer ${suffix}`, `other-insurer-${suffix}`],
    );
    const otherBranch = await dataSource.query(
      `INSERT INTO branches (company_id, name, code, status) VALUES ($1, 'HQ', $2, 'active') RETURNING id`,
      [other[0].id, `OTH-${suffix}`],
    );
    const officerRole = await dataSource.query(
      `SELECT id FROM roles WHERE name = 'CLAIMS_OFFICER' AND company_id = $1`,
      [companyId],
    );
    const copiedRole = await dataSource.query(
      `INSERT INTO roles (name, display_name, description, company_id, is_system_generated)
       VALUES ('CLAIMS_OFFICER', 'Claims Officer', 'Claims officer', $1, true) RETURNING id`,
      [other[0].id],
    );
    await dataSource.query(
      `INSERT INTO permission_role (roles_id, permissions_id)
       SELECT $1, permissions_id FROM permission_role WHERE roles_id = $2`,
      [copiedRole[0].id, officerRole[0].id],
    );
    await addMembership(
      await createUser('Outsider'),
      other[0].id,
      otherBranch[0].id,
      'CLAIMS_OFFICER',
    );

    // Branch-limited officers: one in the claim's branch, one elsewhere.
    const secondBranch = await dataSource.query(
      `INSERT INTO branches (company_id, name, code, status) VALUES ($1, $2, $3, 'active') RETURNING id`,
      [companyId, `Second Branch ${suffix}`, `SB-${suffix}`],
    );
    await addMembership(
      await createUser('Branchmate'),
      companyId,
      branchId,
      'CLAIMS_OFFICER',
      'BRANCH',
    );
    await addMembership(
      await createUser('Elsewhere'),
      companyId,
      secondBranch[0].id,
      'CLAIMS_OFFICER',
      'BRANCH',
    );

    await dataSource.query(
      `INSERT INTO permission_role (roles_id, permissions_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.id IN ($1, $2) AND p.name = 'documents:read'
      ON CONFLICT DO NOTHING`,
      [officerRole[0].id, copiedRole[0].id],
    );
    await dataSource.query(
      `INSERT INTO permission_role (roles_id, permissions_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.company_id=$1 AND r.name IN ('CLAIMS_OFFICER','CLAIMS_MANAGER')
        AND p.name IN ('claims.fx.view','claims.fx.create','claims.fx.submit','claims.fx.approve') ON CONFLICT DO NOTHING`,
      [companyId],
    );
    await dataSource.query(
      `INSERT INTO permission_role (roles_id, permissions_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.id=$1 AND p.name='claims.fx.view' ON CONFLICT DO NOTHING`,
      [copiedRole[0].id],
    );
    officerToken = await login('Officer');
    sameBranchToken = await login('Branchmate');
    otherBranchToken = await login('Elsewhere');
    managerToken = await login('Manager');
    financeToken = await login('Finance');
    financeConfirmerToken = await login('FinanceConfirmer');
    assessorToken = await login('Assessor');
    outsiderToken = await login('Outsider');
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  // ----------------------------------------------------------- happy path

  let claimId: string;
  let claimReference: string;

  it('notifies a claim and takes the claim reference from the final callback (§9)', async () => {
    const created = await call(officerToken, 'post', '', {
      policy_id: policyId,
      loss_date: new Date(today.getTime() - 2 * 86_400_000).toISOString(),
      claim_report_date: new Date(today.getTime() - 86_400_000).toISOString(),
      loss_nature: 'Collision',
      loss_type: 'Own damage',
      loss_location: 'Morogoro Road, Dar es Salaam',
      description: 'Rear-ended at the traffic lights.',
      estimated_amount: '1200000.00',
      claim_form_dully_filled: true,
      claimants: [claimant],
    });
    claimId = created.id;
    expect(created.status).toBe('DRAFT');

    await call(officerToken, 'post', `/${claimId}/notification/submit`, {});
    const sent = tiraRequests.at(-1)!;
    expect(sent.sourceRecordId).toBe(claimId);
    expect(sent.requestType).toMatch(/NOTIFICATION/);

    // The acknowledgement alone does not move the claim forward.
    expect((await claimDetail(claimId)).status).toBe('NOTIFICATION_SUBMITTED');

    claimReference = `TIRA-CLM-${suffix}`;
    await accept(claimId, { ClaimReferenceNumber: claimReference });

    const claim = await claimDetail(claimId);
    expect(claim.status).toBe('NOTIFICATION_ACCEPTED');
    expect(claim.claim_reference_number).toBe(claimReference);
  });

  it('ignores a duplicate final callback', async () => {
    const before = await eventCount(claimId, 'TIRAMIS_ACCEPTED');
    await accept(claimId, { ClaimReferenceNumber: claimReference });

    expect(await eventCount(claimId, 'TIRAMIS_ACCEPTED')).toBe(before);
    expect((await claimDetail(claimId)).status).toBe('NOTIFICATION_ACCEPTED');
  });

  it('governs an illustrative FX rate and preserves an immutable snapshot', async () => {
    const fx = app.get(ClaimFxGovernanceService);
    const maker = {
      id: randomUUID(),
      companyId,
      scope: 'company',
    } as AuthenticatedUser;
    const checker = {
      id: randomUUID(),
      companyId,
      scope: 'company',
    } as AuthenticatedUser;
    const dto = {
      transaction_currency: 'USD',
      functional_currency: 'TZS',
      rate: '2600',
      effective_date: '2025-01-01',
      source_reference: 'TEST FIXTURE',
      justification: 'Illustrative test',
    };
    await dataSource.query(
      `UPDATE companies SET settings=coalesce(settings, '{}'::jsonb) || '{"functional_currency":"TZS"}'::jsonb WHERE id=$1`,
      [companyId],
    );
    const first = await fx.create(maker, dto);
    await fx.transition(maker, first.id, 'SUBMIT');
    await expect(fx.transition(maker, first.id, 'APPROVE')).rejects.toThrow(
      'separate checker',
    );
    const decisions = await Promise.allSettled([
      fx.transition(checker, first.id, 'APPROVE'),
      fx.transition(checker, first.id, 'APPROVE'),
    ]);
    expect(
      decisions.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const eventId = randomUUID();
    const input = {
      companyId,
      claimId,
      eventType: 'TEST_FIXTURE',
      eventId,
      currency: 'USD',
      eventDate: '2025-01-01',
      amount: '1000.00',
    };
    const snapshot = (await dataSource.transaction((manager) =>
      fx.snapshot(manager, input),
    )) as { id: string; converted_amount: string; approved_rate_id: string };
    expect(snapshot.converted_amount).toBe('2600000.00');
    expect(snapshot.approved_rate_id).toBe(first.id);
    const second = await fx.create(maker, {
      ...dto,
      rate: '2700',
      effective_date: '2025-02-01',
    });
    await fx.transition(maker, second.id, 'SUBMIT');
    await fx.transition(checker, second.id, 'APPROVE');
    const [original] = await dataSource.query(
      'SELECT * FROM claim_fx_snapshots WHERE id=$1',
      [snapshot.id],
    );
    expect(original.converted_amount).toBe('2600000.00');
    await expect(
      dataSource.query(
        'UPDATE claim_fx_snapshots SET converted_amount=1 WHERE id=$1',
        [snapshot.id],
      ),
    ).rejects.toThrow('immutable');
    await expect(
      dataSource.transaction((manager) => fx.snapshot(manager, input)),
    ).rejects.toThrow('already exists');
    await expect(
      fx.details({ ...checker, companyId: randomUUID() }, first.id),
    ).rejects.toThrow('not found');
    const correction = (await dataSource.transaction((manager) =>
      fx.snapshot(manager, {
        ...input,
        eventDate: '2025-02-01',
        correction: true,
      }),
    )) as { version: number; converted_amount: string; supersedes_id: string };
    expect(correction).toMatchObject({
      version: 2,
      converted_amount: '2700000.00',
      supersedes_id: snapshot.id,
    });
    const rollbackEvent = randomUUID();
    await expect(
      dataSource.transaction(async (manager) => {
        await fx.snapshot(manager, { ...input, eventId: rollbackEvent });
        throw new Error('simulate financial event failure');
      }),
    ).rejects.toThrow('simulate financial event failure');
    const rolledBack = await dataSource.query(
      'SELECT id FROM claim_fx_snapshots WHERE event_id=$1',
      [rollbackEvent],
    );
    expect(rolledBack).toHaveLength(0);
  });

  it('registers a foreign-currency claim using an approved rate atomically', async () => {
    const fx = app.get(ClaimFxGovernanceService);
    const maker = {
      id: randomUUID(),
      companyId,
      scope: 'company',
    } as AuthenticatedUser;
    const checker = {
      id: randomUUID(),
      companyId,
      scope: 'company',
    } as AuthenticatedUser;
    const rate = await fx.create(maker, {
      transaction_currency: 'USD',
      functional_currency: 'TZS',
      rate: '2600',
      effective_date: isoDate(new Date(today.getTime() - 86_400_000)),
      source_reference: 'TEST FIXTURE',
      justification: 'Registration test',
    });
    await fx.transition(maker, rate.id, 'SUBMIT');
    await fx.transition(checker, rate.id, 'APPROVE');
    await dataSource.query('UPDATE policies SET currency=$1 WHERE id=$2', [
      'USD',
      otherPolicyId,
    ]);
    const [managerRole] = await dataSource.query(
      `SELECT id FROM roles WHERE company_id=$1 AND name='CLAIMS_MANAGER'`,
      [companyId],
    );
    const [limit] = await dataSource.query(
      `INSERT INTO claim_approval_limits (company_id, approval_type, level, role_id, min_amount, max_amount, currency_code, is_active)
       VALUES ($1, 'RESERVE', 1, $2, 0, 999999999, 'TZS', true) RETURNING id`,
      [companyId, managerRole.id],
    );
    try {
      const claim = await call(officerToken, 'post', '', {
        policy_id: otherPolicyId,
        loss_date: new Date(today.getTime() - 2 * 86_400_000).toISOString(),
        claim_report_date: today.toISOString(),
        loss_nature: 'Collision',
        loss_type: 'FX fixture loss',
        loss_location: 'Test location',
        description: 'FX registration fixture',
        estimated_amount: '1000.00',
        claim_form_dully_filled: true,
        claimants: [claimant],
      });
      const [snapshot] = await dataSource.query(
        `SELECT * FROM claim_fx_snapshots WHERE claim_id=$1 AND event_type='CLAIM_REGISTRATION'`,
        [claim.id],
      );
      expect(snapshot).toMatchObject({
        approved_rate_id: rate.id,
        original_amount: '1000.00',
        converted_amount: '2600000.00',
        transaction_currency: 'USD',
        functional_currency: 'TZS',
      });
      expect(claim.exchange_rate).toBe('2600.000000');
      await call(officerToken, 'post', `/${claim.id}/notification/submit`, {});
      await accept(claim.id, { ClaimReferenceNumber: `TIRA-FX-${suffix}` });
      const intimation = await call(
        officerToken,
        'post',
        `/${claim.id}/intimations`,
        {
          claim_estimated_amount: '1000.00',
          claim_reserve_amount: '500.00',
          claim_reserve_method: 'Case estimate',
          loss_assessment_option: 1,
          assessor_name: 'Baraka Assessors Ltd',
          assessor_id_number: '100-200-300',
          assessor_id_type: 6,
        },
      );
      const [intimationFx] = await dataSource.query(
        `SELECT * FROM claim_fx_snapshots WHERE claim_id=$1 AND event_type='CLAIM_INTIMATION' AND event_id=$2`,
        [claim.id, intimation.id],
      );
      expect(intimationFx).toMatchObject({
        approved_rate_id: rate.id,
        converted_amount: '2600000.00',
      });
      const [reserve] = await dataSource.query(
        'SELECT id FROM claim_reserves WHERE claim_id=$1 ORDER BY created_at DESC LIMIT 1',
        [claim.id],
      );
      await call(managerToken, 'post', `/reserves/${reserve.id}/approve`, {});
      const [movementFx] = await dataSource.query(
        `SELECT fx.* FROM claim_fx_snapshots fx JOIN claim_reserve_movements m ON m.id=fx.event_id WHERE m.reserve_id=$1 AND fx.event_type='RESERVE_MOVEMENT'`,
        [reserve.id],
      );
      expect(movementFx).toMatchObject({
        approved_rate_id: rate.id,
        original_amount: '500.00',
        converted_amount: '1300000.00',
      });
      const authorityFx = await dataSource.query(
        `SELECT * FROM claim_fx_snapshots WHERE claim_id=$1 AND event_type IN ('APPROVAL_SUBMITTED','APPROVAL_AUTHORITY_CHECK')`,
        [claim.id],
      );
      expect(authorityFx).toHaveLength(2);
      expect(
        authorityFx.every(
          (row: { approved_rate_id: string; converted_amount: string }) =>
            row.approved_rate_id === rate.id &&
            row.converted_amount === '1300000.00',
        ),
      ).toBe(true);
      await call(
        officerToken,
        'post',
        `/intimations/${intimation.id}/submit`,
        {},
      );
      await accept(intimation.id);
      const assessment = await call(
        assessorToken,
        'post',
        `/${claim.id}/assessments`,
        {
          assessment_received_date: today.toISOString(),
          assessment_report_summary: 'FX assessment',
          assessment_amount: '500.00',
          approved_claim_amount: '400.00',
          assessor_name: 'Baraka Assessors Ltd',
        },
      );
      await call(assessorToken, 'patch', `/assessments/${assessment.id}`, {
        approved_claim_amount: '450.00',
      });
      const assessmentFx = await dataSource.query(
        `SELECT * FROM claim_fx_snapshots WHERE event_type='ASSESSMENT_DRAFT' AND event_id=$1 ORDER BY version`,
        [assessment.id],
      );
      expect(
        assessmentFx.map(
          (row: { converted_amount: string }) => row.converted_amount,
        ),
      ).toEqual(['1040000.00', '1170000.00']);
      expect(assessmentFx[1].supersedes_id).toBe(assessmentFx[0].id);
      await call(assessorToken, 'post', `/assessments/${assessment.id}/submit`);
      await call(
        managerToken,
        'post',
        `/assessments/${assessment.id}/approve`,
        {},
      );
      const [reserveAdjustmentFx] = await dataSource.query(
        `SELECT fx.* FROM claim_fx_snapshots fx JOIN claim_reserve_movements m ON m.id=fx.event_id WHERE m.claim_id=$1 AND m.movement_type='ASSESSMENT_ADJUSTMENT'`,
        [claim.id],
      );
      expect(reserveAdjustmentFx).toMatchObject({
        original_amount: '-50.00',
        converted_amount: '-130000.00',
        approved_rate_id: rate.id,
      });
      await accept(assessment.id);
      const detail = await claimDetail(claim.id);
      const voucher = await call(
        officerToken,
        'post',
        `/${claim.id}/discharge-vouchers`,
        {
          claim_offer_amount: '400.00',
          claimant_id: detail.claimants[0].id,
        },
      );
      await call(officerToken, 'patch', `/discharge-vouchers/${voucher.id}`, {
        claim_offer_amount: '350.00',
      });
      const voucherFx = await dataSource.query(
        `SELECT * FROM claim_fx_snapshots WHERE event_type='VOUCHER_DRAFT' AND event_id=$1 ORDER BY version`,
        [voucher.id],
      );
      expect(
        voucherFx.map(
          (row: { converted_amount: string }) => row.converted_amount,
        ),
      ).toEqual(['1040000.00', '910000.00']);
      expect(voucherFx[1].supersedes_id).toBe(voucherFx[0].id);
      await call(
        officerToken,
        'post',
        `/discharge-vouchers/${voucher.id}/submit`,
      );
      await call(
        managerToken,
        'post',
        `/discharge-vouchers/${voucher.id}/approve`,
        {},
      );
      await call(
        officerToken,
        'post',
        `/discharge-vouchers/${voucher.id}/respond`,
        {
          response: 'ACCEPT',
          claimant_response_date: new Date().toISOString(),
        },
      );
      await accept(voucher.id);
      const payment = await call(
        officerToken,
        'post',
        `/${claim.id}/payments`,
        {
          paid_amount: '200.00',
          payment_mode: 3,
          claimant_id: detail.claimants[0].id,
          parties_notified: 'N',
          claim_resulted_litigation: false,
        },
      );
      await call(officerToken, 'post', `/payments/${payment.id}/submit`);
      await call(managerToken, 'post', `/payments/${payment.id}/approve`, {});
      const requestPayment = () =>
        call(
          financeToken,
          'post',
          `/payments/${payment.id}/request-disbursement`,
          { idempotency_key: `fx-payment-${suffix}` },
        );
      const [payout, retried] = await Promise.all([
        requestPayment(),
        requestPayment(),
      ]);
      expect(retried.id).toBe(payout.id);
      const journal = jest
        .spyOn(app.get(FinanceJournalService), 'postClaimDisbursement')
        .mockRejectedValueOnce(new Error('FX journal failure fixture'));
      await call(
        financeConfirmerToken,
        'post',
        `/disbursements/${payout.id}/confirm`,
        { payment_method: 'EFT', provider_reference: 'FX-PAYOUT' },
        [500],
      );
      journal.mockRestore();
      expect(
        await dataSource.query(
          `SELECT id FROM claim_fx_snapshots WHERE event_type='DISBURSEMENT_CONFIRMED' AND event_id=$1`,
          [payout.id],
        ),
      ).toHaveLength(0);
      await call(
        financeConfirmerToken,
        'post',
        `/disbursements/${payout.id}/confirm`,
        { payment_method: 'EFT', provider_reference: 'FX-PAYOUT' },
      );
      const [payoutFx] = await dataSource.query(
        `SELECT * FROM claim_fx_snapshots WHERE event_type='DISBURSEMENT_CONFIRMED' AND event_id=$1`,
        [payout.id],
      );
      expect(payoutFx).toMatchObject({
        approved_rate_id: rate.id,
        original_amount: '200.00',
        converted_amount: '520000.00',
      });
      await call(financeToken, 'post', `/disbursements/${payout.id}/reverse`, {
        reason: 'Test returned payment',
      });
      const [unchangedFx] = await dataSource.query(
        'SELECT * FROM claim_fx_snapshots WHERE id=$1',
        [payoutFx.id],
      );
      expect(unchangedFx).toMatchObject({
        id: payoutFx.id,
        rate: payoutFx.rate,
        converted_amount: '520000.00',
      });
      const [reverseJournal] = await dataSource.query(
        `SELECT count(*)::int AS count FROM finance_journal_entries WHERE source_id=$1 AND source_type='CLAIM_DISBURSEMENT_REVERSAL'`,
        [payout.id],
      );
      expect(reverseJournal.count).toBe(1);
    } finally {
      await dataSource.query(
        'UPDATE claim_approval_limits SET is_active=false WHERE id=$1',
        [limit.id],
      );
      await dataSource.query('UPDATE policies SET currency=$1 WHERE id=$2', [
        'TZS',
        otherPolicyId,
      ]);
    }
  });

  it('rolls back foreign claim registration when no approved rate exists', async () => {
    const [before] = await dataSource.query(
      'SELECT count(*)::int AS count FROM claims WHERE policy_id=$1',
      [otherPolicyId],
    );
    await dataSource.query('UPDATE policies SET currency=$1 WHERE id=$2', [
      'EUR',
      otherPolicyId,
    ]);
    try {
      await call(
        officerToken,
        'post',
        '',
        {
          policy_id: otherPolicyId,
          loss_date: new Date(today.getTime() - 3 * 86_400_000).toISOString(),
          claim_report_date: today.toISOString(),
          loss_nature: 'Collision',
          loss_type: 'Unrated FX fixture',
          loss_location: 'Test location',
          description: 'Missing rate fixture',
          estimated_amount: '1000.00',
          claim_form_dully_filled: true,
          claimants: [claimant],
        },
        [400],
      );
      const [after] = await dataSource.query(
        'SELECT count(*)::int AS count FROM claims WHERE policy_id=$1',
        [otherPolicyId],
      );
      expect(after.count).toBe(before.count);
    } finally {
      await dataSource.query('UPDATE policies SET currency=$1 WHERE id=$2', [
        'TZS',
        otherPolicyId,
      ]);
    }
  });

  it('enforces HTTP permissions, maker/checker and company isolation for FX rates', async () => {
    const makerToken = officerToken;
    const checkerToken = managerToken;
    const foreignToken = outsiderToken;
    const base = '/api/v1/tenant/claims-fx/rates';
    const unauthorized = await request(app.getHttpServer())
      .post(base)
      .set('Authorization', `Bearer ${assessorToken}`)
      .send({
        transaction_currency: 'GBP',
        functional_currency: 'TZS',
        rate: '3000',
        effective_date: isoDate(today),
        source_reference: 'TEST',
        justification: 'TEST',
      });
    expect(unauthorized.status).toBe(403);
    const created = await request(app.getHttpServer())
      .post(base)
      .set('Authorization', `Bearer ${makerToken}`)
      .send({
        transaction_currency: 'GBP',
        functional_currency: 'TZS',
        rate: '3000',
        effective_date: isoDate(today),
        source_reference: 'HTTP TEST FIXTURE',
        justification: 'Authorization test',
      });
    expect(created.status).toBe(201);
    const rateId = (created.body.data ?? created.body).id;
    expect(
      (
        await request(app.getHttpServer())
          .post(`${base}/${rateId}/submit`)
          .set('Authorization', `Bearer ${makerToken}`)
          .send({})
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .post(`${base}/${rateId}/approve`)
          .set('Authorization', `Bearer ${makerToken}`)
          .send({})
      ).status,
    ).toBe(403);
    expect([403, 404]).toContain(
      (
        await request(app.getHttpServer())
          .get(`${base}/${rateId}`)
          .set('Authorization', `Bearer ${foreignToken}`)
      ).status,
    );
    expect(
      (
        await request(app.getHttpServer())
          .post(`${base}/${rateId}/approve`)
          .set('Authorization', `Bearer ${checkerToken}`)
          .send({})
      ).status,
    ).toBe(201);
  });

  it('does not let a late acknowledgement overwrite the final success', async () => {
    const row = await latestTracking(claimId);
    const updated = await tracking.markSubmittedResponse(row.id, {
      requestId: row.tiramisRequestId,
      acknowledgement: {
        rootName: 'ClaimReqAck',
        statusCode: 'TIRA001',
        statusDesc: 'Successful',
      },
    });
    await recordSync.syncFromTracking(updated);

    const claim = await claimDetail(claimId);
    expect(claim.status).toBe('NOTIFICATION_ACCEPTED');
    const operation = claim.regulatory_operations.find(
      (item: any) => item.operation_type === 'NOTIFICATION',
    );
    expect(operation.status).toBe('ACCEPTED');
  });

  it('keeps others out: another company gets 404 for the claim', async () => {
    await call(outsiderToken, 'get', `/${claimId}`, undefined, [403, 404]);
  });

  it('keeps branches apart: a branch-limited officer elsewhere cannot see it', async () => {
    // Control: the same role limited to the claim's own branch can read it.
    await call(sameBranchToken, 'get', `/${claimId}`);

    await call(otherBranchToken, 'get', `/${claimId}`, undefined, [403, 404]);
    const list = await call(otherBranchToken, 'get', '?limit=100');
    const rows: Array<{ id: string }> = list.data ?? list.items ?? list;
    expect(rows.map((row) => row.id)).not.toContain(claimId);
  });

  it('enforces claim and policy scope for document downloads over HTTP', async () => {
    const file = await app.get(DocumentStorageService).store({
      buffer: Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF',
      ),
      companyId,
      fileName: 'scope.pdf',
      maximumBytes: 1024 * 1024,
      prefix: 'documents',
    });
    const createDocument = async (ownerType: string, ownerId: string) => {
      const [doc] = await dataSource.query(
        `INSERT INTO documents (company_id, owner_type, owner_id, storage_key, checksum, file_name, status) VALUES ($1,$2,$3,$4,$5,'scope.pdf','AVAILABLE') RETURNING id`,
        [companyId, ownerType, ownerId, file.storageKey, file.checksum],
      );
      const [version] = await dataSource.query(
        `INSERT INTO document_versions (company_id, document_id, version_number, status, storage_provider, storage_key, safe_file_name, detected_mime_type, file_size, sha256_hash, uploaded_at) VALUES ($1,$2,1,'AVAILABLE','local_private',$3,'scope.pdf','application/pdf',$4,$5,now()) RETURNING id`,
        [companyId, doc.id, file.storageKey, file.size, file.checksum],
      );
      await dataSource.query(
        'UPDATE documents SET current_version_id=$1 WHERE id=$2',
        [version.id, doc.id],
      );
      return doc.id as string;
    };
    const claimDoc = await createDocument('CLAIM', claimId);
    const policyDoc = await createDocument('POLICY', policyId);
    await dataSource.query(
      `INSERT INTO document_links (company_id,document_id,link_type,linked_record_type,linked_record_id) VALUES ($1,$2,'CLAIM','CLAIM',$3)`,
      [companyId, policyDoc, claimId],
    );
    const get = (token: string, id: string) =>
      request(app.getHttpServer())
        .get(`/api/v1/tenant/documents/${id}/download`)
        .set('Authorization', `Bearer ${token}`);
    expect((await get(sameBranchToken, claimDoc)).status).toBe(200);
    expect((await get(sameBranchToken, policyDoc)).status).toBe(200);
    expect((await get(otherBranchToken, claimDoc)).status).toBe(404);
    expect((await get(otherBranchToken, policyDoc)).status).toBe(404);
    expect([403, 404]).toContain((await get(outsiderToken, claimDoc)).status);
    const [denied] = await dataSource.query(
      `SELECT count(*)::int AS count FROM document_access_events WHERE document_id=$1 AND result='FAILED' AND failure_reason='RESOURCE_SCOPE_DENIED'`,
      [claimDoc],
    );
    expect(denied.count).toBeGreaterThan(0);
  });

  let intimationId: string;

  it('retries a failed intimation with a new RequestId (§10)', async () => {
    const intimation = await call(
      officerToken,
      'post',
      `/${claimId}/intimations`,
      {
        claim_estimated_amount: '1200000.00',
        claim_reserve_amount: '1000000.00',
        claim_reserve_method: 'Case estimate',
        loss_assessment_option: 1,
        assessor_name: 'Baraka Assessors Ltd',
        assessor_id_number: '100-200-300',
        assessor_id_type: 6,
      },
    );
    intimationId = intimation.id;
    const [fxSnapshot] = await dataSource.query(
      `SELECT * FROM claim_fx_snapshots WHERE claim_id=$1 AND event_type='CLAIM_INTIMATION' AND event_id=$2`,
      [claimId, intimationId],
    );
    expect(fxSnapshot).toMatchObject({
      source_type: 'PARITY',
      original_amount: '1200000.00',
      converted_amount: '1200000.00',
    });

    await call(officerToken, 'post', `/intimations/${intimationId}/submit`, {});
    const firstRequest = (await latestTracking(intimationId)).tiramisRequestId;
    await tiraFinal(intimationId, {
      code: 'TIRA214X',
      desc: 'Assessor not registered',
    });
    expect((await claimDetail(claimId)).status).toBe('INTIMATION_FAILED');

    await call(officerToken, 'post', `/intimations/${intimationId}/submit`, {
      retry: true,
    });
    const secondRequest = (await latestTracking(intimationId)).tiramisRequestId;
    expect(secondRequest).toBeTruthy();
    expect(secondRequest).not.toBe(firstRequest);

    await accept(intimationId);
    expect((await claimDetail(claimId)).status).toBe('INTIMATED');
  });

  it('approves an assessment and reports it (§11)', async () => {
    const assessment = await call(
      assessorToken,
      'post',
      `/${claimId}/assessments`,
      {
        assessment_received_date: new Date().toISOString(),
        assessment_report_summary: 'Rear bumper and boot lid replaced.',
        assessment_amount: '900000.00',
        approved_claim_amount: '850000.00',
        assessor_name: 'Baraka Assessors Ltd',
      },
    );
    await call(assessorToken, 'post', `/assessments/${assessment.id}/submit`);
    await call(managerToken, 'post', `/assessments/${assessment.id}/approve`, {
      comments: 'Agreed',
    });

    // The final approval sends the assessment to TIRA by itself.
    expect(
      tiraRequests.filter((item) => item.sourceRecordId === assessment.id),
    ).toHaveLength(1);
    await accept(assessment.id);

    const claim = await claimDetail(claimId);
    expect(claim.status).toBe('APPROVED');
    expect(
      claim.regulatory_operations.find(
        (op: { source_record_id: string }) =>
          op.source_record_id === assessment.id,
      )?.status,
    ).toBe('ACCEPTED');
    expect(Number(claim.approved_amount)).toBe(850000);
  });

  it('issues a discharge voucher the claimant accepts (§12)', async () => {
    const detail = await claimDetail(claimId);
    const voucher = await call(
      officerToken,
      'post',
      `/${claimId}/discharge-vouchers`,
      {
        claim_offer_amount: '850000.00',
        claimant_id: detail.claimants[0].id,
      },
    );
    await call(
      officerToken,
      'post',
      `/discharge-vouchers/${voucher.id}/submit`,
    );
    await call(
      managerToken,
      'post',
      `/discharge-vouchers/${voucher.id}/approve`,
      {},
    );
    await call(
      officerToken,
      'post',
      `/discharge-vouchers/${voucher.id}/respond`,
      {
        response: 'ACCEPT',
        claimant_response_date: new Date().toISOString(),
      },
    );

    expect(
      tiraRequests.some((item) => item.sourceRecordId === voucher.id),
    ).toBe(true);
    await accept(voucher.id);
    expect((await claimDetail(claimId)).status).toBe('DISCHARGE_ACCEPTED');
  });

  it('serializes concurrent payments against the approved balance', async () => {
    const detail = await claimDetail(claimId);
    const makeRequest = () =>
      request(app.getHttpServer())
        .post(`/api/v1/tenant/claims/${claimId}/payments`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          paid_amount: '500000.00',
          payment_mode: 3,
          claimant_id: detail.claimants[0].id,
        });
    const responses = await Promise.all([makeRequest(), makeRequest()]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 400,
    ]);
    const accepted = responses.find((response) => response.status === 201)!;
    const payment = accepted.body?.data ?? accepted.body;
    await call(officerToken, 'post', `/payments/${payment.id}/cancel`, {
      reason: 'Concurrency test cleanup',
    });
  });

  async function payAndReport(amount: string, verifyRollback = false) {
    const detail = await claimDetail(claimId);
    const payment = await call(officerToken, 'post', `/${claimId}/payments`, {
      paid_amount: amount,
      payment_mode: 3,
      claimant_id: detail.claimants[0].id,
      payee_type: 'CLAIMANT',
      payee_bank_details: {
        bank_name: 'CRDB',
        account_name: 'Asha Juma',
        account_number: '0150123456789',
      },
      parties_notified: 'N',
      claim_resulted_litigation: false,
    });
    await call(officerToken, 'post', `/payments/${payment.id}/submit`);
    await call(managerToken, 'post', `/payments/${payment.id}/approve`, {});
    const submitDisbursement = () =>
      call(
        financeToken,
        'post',
        `/payments/${payment.id}/request-disbursement`,
        { idempotency_key: `claim-payment:${payment.id}:1` },
      );
    const [disbursement, retried] = await Promise.all([
      submitDisbursement(),
      submitDisbursement(),
    ]);
    expect(retried.id).toBe(disbursement.id);
    if (verifyRollback) {
      await dataSource.query(
        'UPDATE claims SET approved_amount = $1 WHERE id = $2',
        ['399999.99', claimId],
      );
      try {
        await call(
          financeConfirmerToken,
          'post',
          `/disbursements/${disbursement.id}/confirm`,
          { payment_method: 'EFT', provider_reference: `FT${suffix}` },
          [409],
        );
      } finally {
        await dataSource.query(
          'UPDATE claims SET approved_amount = $1 WHERE id = $2',
          ['850000.00', claimId],
        );
      }
      const journal = jest
        .spyOn(app.get(FinanceJournalService), 'postClaimDisbursement')
        .mockRejectedValueOnce(new Error('Simulated journal failure'));
      await call(
        financeConfirmerToken,
        'post',
        `/disbursements/${disbursement.id}/confirm`,
        { payment_method: 'EFT', provider_reference: `FT${suffix}` },
        [500],
      );
      journal.mockRestore();
      const afterFailure = await claimDetail(claimId);
      expect(Number(afterFailure.paid_amount)).toBe(0);
      const rolledBackSnapshots = await dataSource.query(
        `SELECT id FROM claim_fx_snapshots WHERE event_type='DISBURSEMENT_CONFIRMED' AND event_id=$1`,
        [disbursement.id],
      );
      expect(rolledBackSnapshots).toHaveLength(0);
    }
    await call(
      financeToken,
      'post',
      `/disbursements/${disbursement.id}/confirm`,
      {
        payment_method: 'EFT / bank transfer',
        provider_reference: `FT${suffix}`,
      },
      [403],
    );
    await call(
      financeConfirmerToken,
      'post',
      `/disbursements/${disbursement.id}/confirm`,
      {
        payment_method: 'EFT / bank transfer',
        provider_reference: `FT${suffix}`,
      },
    );
    const [paymentFx] = await dataSource.query(
      `SELECT * FROM claim_fx_snapshots WHERE event_type='DISBURSEMENT_CONFIRMED' AND event_id=$1`,
      [disbursement.id],
    );
    expect(paymentFx).toMatchObject({
      original_amount: amount,
      converted_amount: amount,
      source_type: 'PARITY',
    });

    // Confirming the disbursement reports the payment to TIRA by itself.
    expect(
      tiraRequests.filter((item) => item.sourceRecordId === payment.id),
    ).toHaveLength(1);
    await accept(payment.id);
    return payment.id as string;
  }

  it('reports a partial payment, then settles once the balance is accepted (§13)', async () => {
    await payAndReport('400000.00', true);
    let claim = await claimDetail(claimId);
    expect(claim.status).toBe('PARTIALLY_PAID');
    expect(Number(claim.paid_amount)).toBe(400000);

    const lastPaymentId = await payAndReport('450000.00');
    claim = await claimDetail(claimId);
    expect(Number(claim.paid_amount)).toBe(850000);
    expect(claim.status).toBe('SETTLED');

    const [disbursement] = await dataSource.query(
      'SELECT id FROM claim_disbursements WHERE claim_payment_id = $1 AND status = $2',
      [lastPaymentId, 'PAID'],
    );
    await call(
      financeToken,
      'post',
      `/disbursements/${disbursement.id}/reverse`,
      { reason: 'Returned payment' },
    );
    claim = await claimDetail(claimId);
    expect(Number(claim.paid_amount)).toBe(400000);
    expect(claim.status).toBe('PARTIALLY_PAID');
    const [journal] = await dataSource.query(
      `SELECT count(*)::int AS count FROM finance_journal_entries WHERE source_id = $1 AND source_type = 'CLAIM_DISBURSEMENT_REVERSAL'`,
      [disbursement.id],
    );
    expect(journal.count).toBe(1);
  });

  it('serializes separate partial disbursements, retries, confirmations and reversals', async () => {
    const detail = await claimDetail(claimId);
    const payments: Array<{ id: string }> = [];
    for (const amount of ['200000.00', '250000.00']) {
      const payment = await call(officerToken, 'post', `/${claimId}/payments`, {
        paid_amount: amount,
        payment_mode: 3,
        claimant_id: detail.claimants[0].id,
        parties_notified: 'N',
        claim_resulted_litigation: false,
      });
      await call(officerToken, 'post', `/payments/${payment.id}/submit`);
      await call(managerToken, 'post', `/payments/${payment.id}/approve`, {});
      payments.push(payment);
    }
    const [first, second] = await Promise.all(
      payments.map((payment, index) =>
        call(
          financeToken,
          'post',
          `/payments/${payment.id}/request-disbursement`,
          { idempotency_key: `phase11-${suffix}-${index}` },
        ),
      ),
    );
    await call(
      financeConfirmerToken,
      'post',
      `/disbursements/${first.id}/fail`,
      { reason: 'Simulated provider failure' },
    );
    const replacement = await call(
      financeToken,
      'post',
      `/payments/${payments[0].id}/request-disbursement`,
      { idempotency_key: `phase11-${suffix}-retry` },
    );
    const confirm = (id: string) =>
      call(financeConfirmerToken, 'post', `/disbursements/${id}/confirm`, {
        payment_method: 'EFT',
        provider_reference: `phase11-${id}`,
      });
    await Promise.all([confirm(replacement.id), confirm(second.id)]);
    await confirm(second.id);
    let claim = await claimDetail(claimId);
    expect(Number(claim.paid_amount)).toBe(850000);
    const [posted] = await dataSource.query(
      `SELECT count(*)::int AS count FROM finance_journal_entries WHERE source_id = $1 AND source_type = 'CLAIM_DISBURSEMENT'`,
      [second.id],
    );
    expect(posted.count).toBe(1);
    const reverse = () =>
      request(app.getHttpServer())
        .post(`/api/v1/tenant/claims/disbursements/${second.id}/reverse`)
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ reason: 'Returned payment' });
    const results = await Promise.all([reverse(), reverse()]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    claim = await claimDetail(claimId);
    expect(Number(claim.paid_amount)).toBe(600000);
  });

  // -------------------------------------------------------- rejection path

  it('rejects a claim before intimation without reporting it to TIRA (§14)', async () => {
    const rejectedClaimId = await notifiedClaim(otherPolicyId);
    const sentBefore = tiraRequests.length;

    const rejection = await call(
      officerToken,
      'post',
      `/${rejectedClaimId}/rejections`,
      {
        rejection_reason:
          'The loss was reported outside the policy conditions.',
        tira_rejection_reason: 'Breach of policy conditions',
      },
    );
    expect((await claimDetail(rejectedClaimId)).status).toBe(
      'REJECTION_PENDING',
    );

    const decision = await call(
      managerToken,
      'post',
      `/rejections/${rejection.id}/approve`,
      {},
    );
    expect(decision.completed).toBe(true);

    const claim = await claimDetail(rejectedClaimId);
    expect(claim.status).toBe('REJECTED');
    // No accepted intimation, so ClaimRejectionReq cannot be built.
    expect(tiraRequests.length).toBe(sentBefore);
    await call(
      managerToken,
      'post',
      `/rejections/${rejection.id}/tiramis`,
      {},
      [422],
    );

    const closed = await call(
      managerToken,
      'post',
      `/${rejectedClaimId}/close`,
      {
        closure_reason: 'Rejected before intimation',
      },
    );
    expect(closed.status).toBe('CLOSED');
  });
});
