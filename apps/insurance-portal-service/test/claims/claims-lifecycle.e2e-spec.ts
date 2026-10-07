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
        user_no, first_name, last_name, email, phone, password, status,
        user_type, officer_title, is_email_verified, is_phone_verified,
        is_two_factor_enabled
      )
      VALUES ($1, $2, 'Tester', $3, $4, $5, 'active', 'STAFF', $6, true, true, false)
      RETURNING id
      `,
      [
        `USR-C${suffix}${randomUUID().slice(0, 4)}`,
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
                  AND r.name IN ('CLAIMS_OFFICER', 'CLAIMS_MANAGER', 'CLAIMS_FINANCE', 'CLAIMS_ASSESSOR')) = 4
        ORDER BY c.created_at ASC
        LIMIT 1`,
    );
    companyId = insurer[0].id;
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
      ['Finance', 'CLAIMS_FINANCE'],
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

    officerToken = await login('Officer');
    sameBranchToken = await login('Branchmate');
    otherBranchToken = await login('Elsewhere');
    managerToken = await login('Manager');
    financeToken = await login('Finance');
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

  async function payAndReport(amount: string) {
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
      parties_notified: 'Y',
      claim_resulted_litigation: false,
    });
    await call(officerToken, 'post', `/payments/${payment.id}/submit`);
    await call(managerToken, 'post', `/payments/${payment.id}/approve`, {});
    const disbursement = await call(
      financeToken,
      'post',
      `/payments/${payment.id}/request-disbursement`,
      { idempotency_key: `claim-payment:${payment.id}:1` },
    );
    await call(
      financeToken,
      'post',
      `/disbursements/${disbursement.id}/confirm`,
      {
        payment_method: 'EFT / bank transfer',
        provider_reference: `FT${suffix}`,
      },
    );

    // Confirming the disbursement reports the payment to TIRA by itself.
    expect(
      tiraRequests.filter((item) => item.sourceRecordId === payment.id),
    ).toHaveLength(1);
    await accept(payment.id);
    return payment.id as string;
  }

  it('reports a partial payment, then settles once the balance is accepted (§13)', async () => {
    await payAndReport('400000.00');
    let claim = await claimDetail(claimId);
    expect(claim.status).toBe('PARTIALLY_PAID');
    expect(Number(claim.paid_amount)).toBe(400000);

    await payAndReport('450000.00');
    claim = await claimDetail(claimId);
    expect(Number(claim.paid_amount)).toBe(850000);
    expect(claim.status).toBe('SETTLED');
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
