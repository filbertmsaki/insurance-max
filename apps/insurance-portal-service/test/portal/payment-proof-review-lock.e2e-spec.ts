import { ConflictException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { PortalRequestsService } from '../../src/modules/tenant/portal/services/portal-requests.service';
import { PortalPaymentProofStatus } from '../../src/modules/tenant/portal/enums/portal.enums';

jest.setTimeout(180_000);

/**
 * Two finance officers reviewing the same payment proof at the same moment
 * must not both succeed. Only a real PostgreSQL run exercises the
 * `pessimistic_write` locks in `reviewPaymentProof`; the unit spec mocks them.
 */
describe('Payment proof review locking (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let service: PortalRequestsService;

  let insurerCompanyId: string;
  let customerId: string;
  let portalAccountId: string;
  let portalUserId: string;
  let financeUserAId: string;
  let financeUserBId: string;

  const suffix = randomUUID().slice(0, 8);

  async function insertUser(label: string, userType: string) {
    const rows = await dataSource.query(
      `
      INSERT INTO users (
        user_no, first_name, last_name, email, phone, password, status,
        user_type, officer_title, is_email_verified, is_phone_verified,
        is_two_factor_enabled
      )
      VALUES ($1, $2, 'LockTest', $3, $4, 'not-used', 'active', $5, $2,
              true, true, false)
      RETURNING id
      `,
      [
        `USR-L${suffix}${randomUUID().slice(0, 4)}`,
        label,
        `${label.toLowerCase()}.${suffix}@example.com`,
        `+25573${randomUUID().replace(/\D/g, '').padEnd(7, '0').slice(0, 7)}`,
        userType,
      ],
    );

    return rows[0].id as string;
  }

  /** An issued invoice plus a submitted payment proof ready for review. */
  async function createPendingProof(amount = '1000.00') {
    const invoiceRows = await dataSource.query(
      `
      INSERT INTO invoices (
        company_id, insurer_company_id, customer_id, invoice_no, invoice_type,
        currency, gross_amount, total_amount, balance_amount, status
      )
      VALUES ($1, $1, $2, $3, 'PREMIUM', 'TZS', 5000, 5000, 5000, 'ISSUED')
      RETURNING id
      `,
      [
        insurerCompanyId,
        customerId,
        `INV-LOCK-${suffix}-${randomUUID().slice(0, 6)}`,
      ],
    );
    const invoiceId = invoiceRows[0].id as string;

    const requestRows = await dataSource.query(
      `
      INSERT INTO portal_service_requests (
        company_id, portal_account_id, request_no, request_type, target_type,
        target_id, invoice_id, status, subject, description, submitted_by,
        submitted_at, created_by
      )
      VALUES ($1, $2, $3, 'PAYMENT_PROOF', 'INVOICE', $4, $4, 'SUBMITTED',
              'Payment proof lock test', 'Concurrent review test', $5, now(), $5)
      RETURNING id
      `,
      [
        insurerCompanyId,
        portalAccountId,
        `PRQ-LOCK-${suffix}-${randomUUID().slice(0, 6)}`,
        invoiceId,
        portalUserId,
      ],
    );
    const requestId = requestRows[0].id as string;

    const proofRows = await dataSource.query(
      `
      INSERT INTO portal_payment_proofs (
        company_id, request_id, invoice_id, amount, currency, payment_date, status
      )
      VALUES ($1, $2, $3, $4, 'TZS', CURRENT_DATE, 'PENDING_REVIEW')
      RETURNING id
      `,
      [insurerCompanyId, requestId, invoiceId, amount],
    );

    await dataSource.query(
      `
      INSERT INTO portal_request_attachments (
        company_id, request_id, uploaded_by, document_type, original_file_name,
        stored_file_name, storage_key, mime_type, file_size, checksum, status
      )
      VALUES ($1, $2, $3, 'PAYMENT_PROOF', 'proof.pdf', 'proof.pdf', $4,
              'application/pdf', 1024, $5, 'ACTIVE')
      `,
      [
        insurerCompanyId,
        requestId,
        portalUserId,
        `lock-test/${suffix}/${randomUUID()}.pdf`,
        randomUUID().replace(/-/g, ''),
      ],
    );

    return { requestId, proofId: proofRows[0].id as string };
  }

  async function terminalEventCount(requestId: string) {
    const rows = await dataSource.query(
      `
      SELECT COUNT(*)::int AS count
      FROM portal_service_request_events
      WHERE request_id = $1 AND new_status IN ('APPROVED', 'REJECTED')
      `,
      [requestId],
    );

    return rows[0].count as number;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    service = app.get(PortalRequestsService);

    const insurer = await dataSource.query(
      `SELECT id FROM companies WHERE company_type = 'INSURANCE_COMPANY' LIMIT 1`,
    );
    insurerCompanyId = insurer[0].id;

    const customer = await dataSource.query(
      `
      INSERT INTO customers (
        company_id, customer_no, customer_type, first_name, last_name,
        phone, country_code, region, district, status
      )
      VALUES ($1, $2, 'INDIVIDUAL', 'Lock', 'Customer', $3, 'TZA',
              'Dar es Salaam', 'Ilala', 'ACTIVE')
      RETURNING id
      `,
      [insurerCompanyId, `CUST-LOCK-${suffix}`, `+25574${suffix.slice(0, 7)}1`],
    );
    customerId = customer[0].id;

    portalUserId = await insertUser('Portal', 'CUSTOMER');
    financeUserAId = await insertUser('FinanceA', 'STAFF');
    financeUserBId = await insertUser('FinanceB', 'STAFF');

    const account = await dataSource.query(
      `
      INSERT INTO portal_accounts (
        company_id, user_id, actor_type, customer_id, status, activated_at
      )
      VALUES ($1, $2, 'CUSTOMER', $3, 'ACTIVE', now())
      RETURNING id
      `,
      [insurerCompanyId, portalUserId, customerId],
    );
    portalAccountId = account[0].id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lets exactly one of two concurrent verify/reject reviews win', async () => {
    // Several rounds so a lucky interleaving cannot hide a missing lock.
    for (let round = 0; round < 5; round += 1) {
      const { requestId, proofId } = await createPendingProof();

      const results = await Promise.allSettled([
        service.reviewPaymentProof(
          insurerCompanyId,
          requestId,
          financeUserAId,
          {
            status: PortalPaymentProofStatus.VERIFIED,
          },
        ),
        service.reviewPaymentProof(
          insurerCompanyId,
          requestId,
          financeUserBId,
          {
            status: PortalPaymentProofStatus.REJECTED,
            reason: 'Bank statement does not match',
          },
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      const winner = (fulfilled[0] as PromiseFulfilledResult<any>).value;
      const [proof] = await dataSource.query(
        `SELECT status, reviewed_by FROM portal_payment_proofs WHERE id = $1`,
        [proofId],
      );
      expect(proof.status).toBe(winner.payment_proof.status);
      expect(proof.reviewed_by).toBe(winner.payment_proof.reviewed_by);
      expect(await terminalEventCount(requestId)).toBe(1);
    }
  });

  it('lets exactly one of two concurrent identical verifications win', async () => {
    const { requestId } = await createPendingProof();

    const results = await Promise.allSettled([
      service.reviewPaymentProof(insurerCompanyId, requestId, financeUserAId, {
        status: PortalPaymentProofStatus.VERIFIED,
      }),
      service.reviewPaymentProof(insurerCompanyId, requestId, financeUserBId, {
        status: PortalPaymentProofStatus.VERIFIED,
      }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await terminalEventCount(requestId)).toBe(1);
  });
});
