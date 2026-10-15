import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PlatformIntelligenceService } from './services/platform-intelligence.service';

describe('PlatformIntelligenceService', () => {
  let service: PlatformIntelligenceService;
  let dataSource: { query: jest.Mock; transaction: jest.Mock };
  let manager: { query: jest.Mock };

  beforeEach(async () => {
    manager = { query: jest.fn() };
    dataSource = {
      query: jest.fn(),
      transaction: jest.fn((fn: (m: typeof manager) => unknown) => fn(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformIntelligenceService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<PlatformIntelligenceService>(
      PlatformIntelligenceService,
    );
  });

  it('returns company health records with the default page', async () => {
    const expected = [{ companyName: 'Test Company', openAnomalies: 1 }];
    dataSource.query.mockResolvedValue(expected);

    await expect(service.listCompanyHealth()).resolves.toEqual(expected);
    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      null,
      100,
      0,
    ]);
  });

  it('returns benchmark snapshots with filters', async () => {
    const expected = [{ id: 'benchmark-1' }];
    dataSource.query.mockResolvedValue(expected);

    await expect(
      service.listBenchmarkSnapshots({
        metricCode: 'METRIC_1',
        cohortKey: 'cohort-a',
        from: '2026-01-01',
        to: '2026-01-31',
        limit: 20,
        offset: 40,
      }),
    ).resolves.toEqual(expected);

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'METRIC_1',
      'cohort-a',
      '2026-01-01',
      '2026-01-31',
      20,
      40,
    ]);
  });

  it('clamps oversized and invalid page values', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.listBenchmarkSnapshots({ limit: 10_000, offset: -5 });

    const params = dataSource.query.mock.calls[0][1];
    expect(params.slice(-2)).toEqual([500, 0]);
  });

  it('returns anomaly findings with query parameters', async () => {
    const expected = [{ id: 'finding-1' }];
    dataSource.query.mockResolvedValue(expected);

    await expect(
      service.listAnomalyFindings({
        companyId: 'company-id',
        branchId: 'branch-id',
        from: '2026-01-01',
        to: '2026-01-31',
      }),
    ).resolves.toEqual(expected);

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'company-id',
      'branch-id',
      '2026-01-01',
      '2026-01-31',
      100,
      0,
    ]);
  });

  it('returns forecast runs with query parameters', async () => {
    const expected = [{ id: 'forecast-1' }];
    dataSource.query.mockResolvedValue(expected);

    await expect(
      service.listForecastRuns({
        companyId: 'company-id',
        branchId: 'branch-id',
        status: 'COMPLETED',
      }),
    ).resolves.toEqual(expected);

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'company-id',
      'branch-id',
      'COMPLETED',
      100,
      0,
    ]);
  });

  it('propagates a missing-table error instead of returning empty data', async () => {
    dataSource.query.mockRejectedValue(
      Object.assign(new Error('relation does not exist'), { code: '42P01' }),
    );

    await expect(service.listForecastRuns({})).rejects.toThrow(
      'relation does not exist',
    );
  });

  it('rebuilds SaaS usage and billing benchmarks inside one transaction', async () => {
    manager.query
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ snapshotCount: 2 }])
      .mockResolvedValueOnce([{ snapshotCount: 4 }]);

    await expect(service.rebuildBenchmarkSnapshots()).resolves.toEqual({
      message: 'Benchmark snapshots rebuilt',
      minimumCohortSize: 3,
      usageSnapshotCount: 2,
      billingSnapshotCount: 4,
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(manager.query.mock.calls[0][0]).toContain(
      'pg_try_advisory_xact_lock',
    );
    expect(manager.query.mock.calls[1][0]).toContain(
      "metadata ->> 'rebuiltBy'",
    );
    expect(manager.query.mock.calls[2][0]).toContain(
      'FROM platform_usage_snapshots snapshot',
    );
    expect(manager.query.mock.calls[3][0]).toContain(
      'FROM saas_billing_cycles cycle',
    );
    // saas_billing_cycles has no VOID status; CANCELLED is the excluded one.
    expect(manager.query.mock.calls[3][0]).toContain(
      "cycle.status <> 'CANCELLED'",
    );
  });

  it('refuses a rebuild while another one holds the lock', async () => {
    manager.query.mockResolvedValueOnce([{ acquired: false }]);

    await expect(service.rebuildBenchmarkSnapshots()).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.query).toHaveBeenCalledTimes(1);
  });
});
