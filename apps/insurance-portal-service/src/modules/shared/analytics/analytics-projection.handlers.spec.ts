import { AnalyticsAggregateType, AnalyticsEventType } from './enums/analytics.enums';
import { AnalyticsDirtyPeriodService } from './services/analytics-dirty-period.service';
import { ClaimProjectionHandler } from './handlers/claim-projection.handler';
import { PolicyProjectionHandler } from './handlers/policy-projection.handler';
import { PremiumProjectionHandler } from './handlers/premium-projection.handler';
import { ReinsuranceProjectionHandler } from './handlers/reinsurance-projection.handler';
import { TiramisProjectionHandler } from './handlers/tiramis-projection.handler';

const createManager = () => ({
  query: jest.fn().mockResolvedValue(undefined),
});

describe('Analytics projection handlers', () => {
  let manager: ReturnType<typeof createManager>;

  beforeEach(() => {
    manager = createManager();
  });

  it('PolicyProjectionHandler inserts required non-null values', async () => {
    const dirtyPeriodService = new AnalyticsDirtyPeriodService();
    const handler = new PolicyProjectionHandler(
      dirtyPeriodService,
    );

    const event: any = {
      aggregate_id: 'policy-1',
      company_id: 'company-1',
      branch_id: 'branch-1',
      source_module: 'POLICY_MODULE',
      aggregate_type: AnalyticsAggregateType.POLICY,
      event_type: AnalyticsEventType.CREATED,
      event_version: 'v1',
      occurred_at: new Date(),
      payload: {
        category_id: 'category-1',
        product_id: 'product-1',
        customer_id: 'customer-1',
        policy_no: 'POL-1',
        policy_status: 'ACTIVE',
        issue_date: '2026-01-01',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        currency: 'USD',
      },
    };

    await handler.project(manager as any, event);

    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(manager.query.mock.calls[0][0]).toContain(
      'INSERT INTO analytics_policy_facts',
    );

    const params = manager.query.mock.calls[0][1];
    expect(params[0]).toBe('policy-1');
    expect(params[1]).toBe('company-1');
    expect(params[2]).toBe('company-1');
    expect(params[6]).toBe('category-1');
    expect(params[7]).toBe('product-1');
    expect(params[9]).toBe('customer-1');
    expect(params[10]).toBe('POL-1');
    expect(params[12]).toBe('ACTIVE');
    expect(params[13]).toBe('2026-01-01');
    expect(params[15]).toBe('2026-12-31');
    expect(params[16]).toBe('USD');
  });

  it('PremiumProjectionHandler inserts required non-null values', async () => {
    const dirtyPeriodService = new AnalyticsDirtyPeriodService();
    const handler = new PremiumProjectionHandler(
      dirtyPeriodService,
    );

    const event: any = {
      aggregate_id: 'premium-1',
      company_id: 'company-1',
      branch_id: 'branch-1',
      source_module: 'PREMIUM_MODULE',
      aggregate_type: AnalyticsAggregateType.PREMIUM_LEDGER,
      event_type: AnalyticsEventType.CREATED,
      event_version: 'v1',
      occurred_at: new Date(),
      payload: {
        policy_id: 'policy-1',
        entry_type: 'DEBIT',
        status: 'POSTED',
        effective_date: '2026-01-01',
        currency: 'USD',
      },
    };

    await handler.project(manager as any, event);

    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(manager.query.mock.calls[0][0]).toContain(
      'INSERT INTO analytics_premium_facts',
    );

    const params = manager.query.mock.calls[0][1];
    expect(params[0]).toBe('premium-1');
    expect(params[6]).toBe('DEBIT');
    expect(params[7]).toBe('POSTED');
    expect(params[8]).toBe('2026-01-01');
    expect(params[9]).toBe('USD');
  });

  it('ClaimProjectionHandler inserts required non-null values', async () => {
    const dirtyPeriodService = new AnalyticsDirtyPeriodService();
    const handler = new ClaimProjectionHandler(
      dirtyPeriodService,
    );

    const event: any = {
      aggregate_id: 'claim-1',
      company_id: 'company-1',
      branch_id: 'branch-1',
      source_module: 'CLAIM_MODULE',
      aggregate_type: AnalyticsAggregateType.CLAIM,
      event_type: AnalyticsEventType.CREATED,
      event_version: 'v1',
      occurred_at: new Date(),
      payload: {
        policy_id: 'policy-1',
        claim_no: 'CLM-1',
        claim_status: 'OPEN',
        loss_date: '2026-01-01',
        report_date: '2026-01-02',
        currency: 'USD',
      },
    };

    await handler.project(manager as any, event);

    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(manager.query.mock.calls[0][0]).toContain(
      'INSERT INTO analytics_claim_facts',
    );

    const params = manager.query.mock.calls[0][1];
    expect(params[0]).toBe('claim-1');
    expect(params[6]).toBe('CLM-1');
    expect(params[7]).toBe('OPEN');
    expect(params[10]).toBe('2026-01-01');
    expect(params[11]).toBe('2026-01-02');
    expect(params[14]).toBe('USD');
  });

  it('ReinsuranceProjectionHandler inserts required non-null values', async () => {
    const dirtyPeriodService = new AnalyticsDirtyPeriodService();
    const handler = new ReinsuranceProjectionHandler(
      dirtyPeriodService,
    );

    const event: any = {
      aggregate_id: 'cession-1',
      company_id: 'company-1',
      branch_id: 'branch-1',
      source_module: 'REINSURANCE_MODULE',
      aggregate_type: AnalyticsAggregateType.REINSURANCE_CESSION,
      event_type: AnalyticsEventType.CREATED,
      event_version: 'v1',
      occurred_at: new Date(),
      payload: {
        policy_id: 'policy-1',
        cession_type: 'TREATY',
        cession_status: 'ACTIVE',
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        currency: 'USD',
      },
    };

    await handler.project(manager as any, event);

    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(manager.query.mock.calls[0][0]).toContain(
      'INSERT INTO analytics_reinsurance_facts',
    );

    const params = manager.query.mock.calls[0][1];
    expect(params[0]).toBe('cession-1');
    expect(params[8]).toBe('TREATY');
    expect(params[9]).toBe('ACTIVE');
    expect(params[10]).toBe('2026-01-01');
    expect(params[11]).toBe('2026-12-31');
    expect(params[12]).toBe('USD');
  });

  it('TiramisProjectionHandler inserts required non-null values', async () => {
    const dirtyPeriodService = new AnalyticsDirtyPeriodService();
    const handler = new TiramisProjectionHandler(
      dirtyPeriodService,
    );

    const event: any = {
      aggregate_id: 'tracking-1',
      company_id: 'company-1',
      branch_id: 'branch-1',
      source_module: 'TIRAMIS_MODULE',
      aggregate_type: AnalyticsAggregateType.TIRAMIS_SUBMISSION,
      event_type: AnalyticsEventType.CREATED,
      event_version: 'v1',
      occurred_at: new Date(),
      payload: {
        request_type: 'SUBMISSION',
        status: 'SENT',
        source_updated_at: '2026-01-01T00:00:00Z',
      },
    };

    await handler.project(manager as any, event);

    expect(manager.query).toHaveBeenCalledTimes(3);
    expect(manager.query.mock.calls[0][0]).toContain(
      'INSERT INTO analytics_tiramis_facts',
    );

    const params = manager.query.mock.calls[0][1];
    expect(params[0]).toBe('tracking-1');
    expect(params[3]).toBe('SUBMISSION');
    expect(params[7]).toBe('SENT');
    expect(params[14]).toBe('2026-01-01T00:00:00Z');
  });
});
