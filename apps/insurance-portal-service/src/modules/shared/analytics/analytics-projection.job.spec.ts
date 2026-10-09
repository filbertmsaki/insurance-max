import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AnalyticsProjectionJob } from './jobs/analytics-projection.job';
import { AnalyticsProjectionRegistryService } from './services/analytics-projection-registry.service';
import {
  AnalyticsAggregateType,
  AnalyticsEventType,
} from './enums/analytics.enums';

describe('AnalyticsProjectionJob', () => {
  it('processes pending analytics events end to end', async () => {
    const event = {
      id: 'event-1',
      aggregate_type: AnalyticsAggregateType.POLICY,
      aggregate_id: 'policy-1',
      company_id: 'company-1',
      branch_id: 'branch-1',
      source_module: 'POLICY_MODULE',
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

    const manager = {
      query: jest.fn(),
    };

    const transactions = jest
      .fn()
      .mockImplementationOnce(async (cb: any) => cb(manager))
      .mockImplementationOnce(async (cb: any) => cb(manager));

    const dataSource: Partial<DataSource> = {
      transaction: transactions,
    };

    const handler = {
      aggregateType: AnalyticsAggregateType.POLICY,
      project: jest.fn().mockResolvedValue(undefined),
    };

    const registry = new AnalyticsProjectionRegistryService([
      handler as any,
    ] as any);
    const configService: Partial<ConfigService> = {
      get: jest.fn().mockImplementation((key: string, def: any) => {
        if (key === 'ANALYTICS_ENABLED') return true;
        if (key === 'ANALYTICS_PROJECTION_BATCH_SIZE') return 10;
        if (key === 'ANALYTICS_PROJECTION_MAX_ATTEMPTS') return 8;
        return def;
      }),
    };

    const job = new AnalyticsProjectionJob(
      dataSource as DataSource,
      configService as ConfigService,
      registry,
    );

    // TypeORM returns [rows, rowCount] for UPDATE ... RETURNING.
    manager.query.mockResolvedValueOnce([[event], 1]);
    manager.query.mockResolvedValueOnce(undefined);

    await job.process();

    expect(transactions).toHaveBeenCalledTimes(2);
    expect(handler.project).toHaveBeenCalledWith(manager, event);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE analytics_projection_events'),
      [event.id],
    );
  });

  it('skips malformed claimed rows without invoking handlers', async () => {
    const manager = {
      query: jest.fn(),
    };

    const transactions = jest
      .fn()
      .mockImplementationOnce(async (cb: any) => cb(manager));

    const dataSource: Partial<DataSource> = {
      transaction: transactions,
    };

    const handler = {
      aggregateType: AnalyticsAggregateType.POLICY,
      project: jest.fn().mockResolvedValue(undefined),
    };

    const registry = new AnalyticsProjectionRegistryService([
      handler as any,
    ] as any);
    const configService: Partial<ConfigService> = {
      get: jest.fn().mockImplementation((key: string, def: any) => {
        if (key === 'ANALYTICS_ENABLED') return true;
        if (key === 'ANALYTICS_PROJECTION_BATCH_SIZE') return 10;
        return def;
      }),
    };

    const job = new AnalyticsProjectionJob(
      dataSource as DataSource,
      configService as ConfigService,
      registry,
    );

    manager.query.mockResolvedValueOnce([
      [
        { id: null, aggregate_type: AnalyticsAggregateType.POLICY },
        { id: 'missing-type', aggregate_type: null },
      ],
      2,
    ]);

    await job.process();

    expect(transactions).toHaveBeenCalledTimes(1);
    expect(handler.project).not.toHaveBeenCalled();
  });
});
