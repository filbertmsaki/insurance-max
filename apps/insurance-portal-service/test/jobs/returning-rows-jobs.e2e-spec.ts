import { INestApplication, NotFoundException } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { AnalyticsProjectionJob } from '../../src/modules/shared/analytics/jobs/analytics-projection.job';
import { ScorecardService } from '../../src/modules/tenant/analytics/services/scorecard.service';
import { FinanceOutboxProcessor } from '../../src/modules/tenant/billing-commission/outbox/finance-outbox.processor';
import { PartnerRelationshipExpiryJob } from '../../src/modules/tenant/insurance-partners/jobs/partner-relationship-expiry.job';

jest.setTimeout(180_000);

/**
 * These jobs read UPDATE ... RETURNING results, which TypeORM returns as
 * [rows, rowCount]. Mocked specs could not see that they treated the pair as
 * rows: finance and analytics events were stranded in PROCESSING and partner
 * relationships never expired. Run them against PostgreSQL.
 */
describe('Jobs reading UPDATE ... RETURNING (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('finance outbox', () => {
    async function outboxEvent(status: string, nextAttemptSql: string) {
      const [row] = await dataSource.query(
        `INSERT INTO finance_outbox_events (
           company_id, aggregate_type, aggregate_id, event_type, event_key,
           payload, status, next_attempt_at
         )
         VALUES ($1, 'E2E', $2, 'E2E_NO_PUBLISHER', $3, '{}'::jsonb, $4,
                 ${nextAttemptSql})
         RETURNING id`,
        [randomUUID(), randomUUID(), `e2e-${randomUUID()}`, status],
      );
      return row.id as string;
    }

    const statusOf = async (id: string) =>
      (
        await dataSource.query(
          `SELECT status FROM finance_outbox_events WHERE id = $1`,
          [id],
        )
      )[0].status;

    it('publishes a pending event', async () => {
      const id = await outboxEvent('PENDING', 'now()');

      await app.get(FinanceOutboxProcessor).processPending();

      expect(await statusOf(id)).toBe('PUBLISHED');
    });

    it('reclaims an event stranded in PROCESSING once its lease has passed', async () => {
      const id = await outboxEvent('PROCESSING', "now() - interval '1 minute'");

      await app.get(FinanceOutboxProcessor).processPending();

      expect(await statusOf(id)).toBe('PUBLISHED');
    });

    it('leaves an event alone while another worker holds its lease', async () => {
      const id = await outboxEvent(
        'PROCESSING',
        "now() + interval '5 minutes'",
      );

      await app.get(FinanceOutboxProcessor).processPending();

      expect(await statusOf(id)).toBe('PROCESSING');
    });
  });

  describe('analytics projection', () => {
    it('reclaims a stale PROCESSING event and records the outcome', async () => {
      const [event] = await dataSource.query(
        `INSERT INTO analytics_projection_events (
           event_key, source_module, aggregate_type, aggregate_id, event_type,
           event_version, occurred_at, status, attempt_count, locked_at
         )
         VALUES ($1, 'e2e', 'E2E_UNREGISTERED', $2, 'CREATED', '1', now(),
                 'PROCESSING', 1, now() - interval '1 hour')
         RETURNING id`,
        [`e2e-${randomUUID()}`, randomUUID()],
      );

      await app.get(AnalyticsProjectionJob).process();

      const [after] = await dataSource.query(
        `SELECT status, attempt_count, locked_at
         FROM analytics_projection_events WHERE id = $1`,
        [event.id],
      );
      // No handler exists for this aggregate type, so the projection fails;
      // what matters is that the stranded row was claimed and moved on.
      expect(after.status).toBe('FAILED');
      expect(after.attempt_count).toBe(2);
      expect(after.locked_at).toBeNull();
    });
  });

  describe('partner relationship expiry', () => {
    it('expires an ended relationship and records the event', async () => {
      const [insurer] = await dataSource.query(
        `INSERT INTO companies (name, slug, company_type, status)
         VALUES ($1, $2, 'INSURANCE_COMPANY', 'active') RETURNING id`,
        [`Expiry Insurer ${randomUUID()}`, `expiry-insurer-${randomUUID()}`],
      );
      const [broker] = await dataSource.query(
        `INSERT INTO companies (name, slug, company_type, status)
         VALUES ($1, $2, 'BROKER', 'active') RETURNING id`,
        [`Expiry Broker ${randomUUID()}`, `expiry-broker-${randomUUID()}`],
      );
      const [relationship] = await dataSource.query(
        `INSERT INTO insurance_company_partners (
           insurer_company_id, intermediary_company_id, partner_type, status,
           start_date, end_date
         )
         VALUES ($1, $2, 'BROKER', 'ACTIVE', CURRENT_DATE - 30,
                 CURRENT_DATE - 1)
         RETURNING id`,
        [insurer.id, broker.id],
      );

      await app.get(PartnerRelationshipExpiryJob).expireEndedRelationships();

      const [after] = await dataSource.query(
        `SELECT status FROM insurance_company_partners WHERE id = $1`,
        [relationship.id],
      );
      expect(after.status).toBe('EXPIRED');
      const events = await dataSource.query(
        `SELECT event_type, previous_status FROM insurance_company_partner_events
         WHERE relationship_id = $1`,
        [relationship.id],
      );
      expect(events).toEqual([
        { event_type: 'EXPIRED', previous_status: 'ACTIVE' },
      ]);
    });
  });

  describe('scorecard publish', () => {
    it('returns 404 for a snapshot that does not exist', async () => {
      await expect(
        app
          .get(ScorecardService)
          .publishScorecard(
            { id: randomUUID(), companyId: randomUUID() } as any,
            randomUUID(),
          ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
