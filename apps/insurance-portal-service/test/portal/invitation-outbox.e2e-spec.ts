import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/modules/shared/mail/mail.service';
import { PortalInvitationDeliveryStatus } from '../../src/modules/tenant/portal/enums/portal.enums';
import { PortalAccountsService } from '../../src/modules/tenant/portal/services/portal-accounts.service';
import { PortalInvitationDeliveryService } from '../../src/modules/tenant/portal/services/portal-invitation-delivery.service';

jest.setTimeout(180_000);

/**
 * Portal invitation emails go through an outbox: creating an invitation
 * only queues it, and the dispatcher sends, retries or dead-letters it.
 */
describe('Portal invitation outbox (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accounts: PortalAccountsService;
  let delivery: PortalInvitationDeliveryService;

  const sentEmails: Array<{ email: string; url: string }> = [];
  let mailFailure: Error | null = null;
  const fakeMail = {
    sendPortalInvitationEmail: jest.fn(
      async (email: string, _name: string, _company: string, url: string) => {
        if (mailFailure) throw mailFailure;
        sentEmails.push({ email, url });
      },
    ),
  };

  let insurerCompanyId: string;
  const adminUserId = randomUUID();

  const tokenFrom = (url: string) => new URL(url).searchParams.get('token')!;

  // The dispatcher drains every due row in the shared database, so match
  // emails by recipient rather than counting all of them.
  const emailsTo = (address: string) =>
    sentEmails.filter((entry) => entry.email === address);

  async function newCustomer() {
    const suffix = randomUUID().slice(0, 8);
    const [customer] = await dataSource.query(
      `INSERT INTO customers (
         company_id, customer_no, customer_type, first_name, last_name,
         phone, email, country_code, region, district, status
       )
       VALUES ($1, $2, 'INDIVIDUAL', 'Outbox', 'Customer', $3, $4, 'TZA',
               'Dar es Salaam', 'Ilala', 'ACTIVE')
       RETURNING id`,
      [
        insurerCompanyId,
        `CUST-OUTBOX-${suffix}`,
        `+25575${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
        `outbox.${suffix}@example.com`,
      ],
    );
    return customer.id as string;
  }

  /** Creates an invitation; returns its id and recipient address. */
  async function invite() {
    const result = await accounts.inviteCustomer(
      insurerCompanyId,
      adminUserId,
      { customer_id: await newCustomer() },
    );
    return { id: result.id, email: result.email };
  }

  async function row(id: string) {
    const [invitation] = await dataSource.query(
      `SELECT status, delivery_status, delivery_attempts, sent_at,
              next_delivery_attempt_at, last_delivery_error,
              delivery_token_ciphertext, resend_count
       FROM portal_invitations WHERE id = $1`,
      [id],
    );
    return invitation;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    // Drive the dispatcher explicitly; the 30-second cron must not race us.
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });

    dataSource = app.get(DataSource);
    accounts = app.get(PortalAccountsService);
    delivery = app.get(PortalInvitationDeliveryService);

    const [insurer] = await dataSource.query(
      `SELECT id FROM companies
       WHERE company_type = 'INSURANCE_COMPANY' AND status = 'active'
       LIMIT 1`,
    );
    insurerCompanyId = insurer.id;
  });

  beforeEach(() => {
    sentEmails.length = 0;
    mailFailure = null;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('queues the email with a sealed token instead of sending it inline', async () => {
    const { id, email } = await invite();

    expect(emailsTo(email)).toHaveLength(0);
    const queued = await row(id);
    expect(queued).toMatchObject({
      status: 'PENDING',
      delivery_status: 'QUEUED',
      delivery_attempts: 0,
    });
    expect(queued.delivery_token_ciphertext).toMatch(/^enc:v1:/);
  });

  it('delivers a working link, marks it SENT and drops the sealed token', async () => {
    const { id, email } = await invite();

    await delivery.dispatchDue();

    const sent = await row(id);
    expect(sent).toMatchObject({
      delivery_status: 'SENT',
      delivery_attempts: 1,
      delivery_token_ciphertext: null,
    });
    expect(sent.sent_at).toBeInstanceOf(Date);

    expect(emailsTo(email)).toHaveLength(1);
    await expect(
      accounts.inspectInvitation(tokenFrom(emailsTo(email)[0].url)),
    ).resolves.toMatchObject({ actor_type: 'CUSTOMER' });
  });

  it('retries later after a failed send and does not resend before it is due', async () => {
    const { id, email } = await invite();
    mailFailure = new Error('SMTP connection refused');

    await delivery.dispatchDue();

    const failed = await row(id);
    expect(failed).toMatchObject({
      delivery_status: 'FAILED',
      delivery_attempts: 1,
      last_delivery_error: 'SMTP connection refused',
    });
    expect(failed.next_delivery_attempt_at.getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(failed.delivery_token_ciphertext).toMatch(/^enc:v1:/);

    mailFailure = null;
    await delivery.dispatchDue();
    expect((await row(id)).delivery_status).toBe('FAILED');
    expect(emailsTo(email)).toHaveLength(0);

    await dataSource.query(
      `UPDATE portal_invitations SET next_delivery_attempt_at = now() WHERE id = $1`,
      [id],
    );
    await delivery.dispatchDue();
    expect(await row(id)).toMatchObject({
      delivery_status: 'SENT',
      delivery_attempts: 2,
    });
    expect(emailsTo(email)).toHaveLength(1);
  });

  it('never sends an invitation revoked before delivery', async () => {
    const { id, email } = await invite();

    await accounts.revokeInvitation(insurerCompanyId, id, adminUserId);
    await delivery.dispatchDue();

    expect(await row(id)).toMatchObject({
      status: 'REVOKED',
      delivery_status: 'CANCELLED',
      delivery_token_ciphertext: null,
    });
    expect(emailsTo(email)).toHaveLength(0);
  });

  it('sends each invitation once when two dispatchers run at the same time', async () => {
    const invites = [await invite(), await invite(), await invite()];

    await Promise.all([delivery.dispatchDue(), delivery.dispatchDue()]);

    for (const { id, email } of invites) {
      expect((await row(id)).delivery_status).toBe('SENT');
      expect(emailsTo(email)).toHaveLength(1);
    }
  });

  it('resend issues a new link and the old one stops working', async () => {
    const { id, email } = await invite();
    await delivery.dispatchDue();
    const firstToken = tokenFrom(emailsTo(email)[0].url);

    await accounts.resendInvitation(insurerCompanyId, id, adminUserId);
    expect(await row(id)).toMatchObject({
      delivery_status: 'QUEUED',
      resend_count: 1,
    });
    await delivery.dispatchDue();

    const secondToken = tokenFrom(emailsTo(email)[1].url);
    expect(secondToken).not.toBe(firstToken);
    await expect(accounts.inspectInvitation(firstToken)).rejects.toThrow();
    await expect(
      accounts.inspectInvitation(secondToken),
    ).resolves.toBeDefined();
  });

  it('lists invitations by delivery status for the company only', async () => {
    const { id } = await invite();

    const queued = await accounts.listInvitations(insurerCompanyId, {
      delivery_status: PortalInvitationDeliveryStatus.QUEUED,
      limit: 100,
    });
    expect(queued.data.map((invitation) => invitation.id)).toContain(id);
    expect(
      queued.data.every(
        (invitation) =>
          invitation.delivery_status === PortalInvitationDeliveryStatus.QUEUED,
      ),
    ).toBe(true);

    const otherCompany = await accounts.listInvitations(randomUUID());
    expect(otherCompany.total).toBe(0);

    // Leave nothing queued for later runs against the same database.
    await accounts.revokeInvitation(insurerCompanyId, id, adminUserId);
  });
});
