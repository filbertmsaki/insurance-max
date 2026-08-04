import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PlatformIntelligenceService } from './services/platform-intelligence.service';

describe('PlatformIntelligenceService', () => {
  let service: PlatformIntelligenceService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformIntelligenceService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<PlatformIntelligenceService>(PlatformIntelligenceService);
  });

  it('returns company health records', async () => {
    const expected = [{ companyName: 'Test Company', openAnomalies: 1 }];
    dataSource.query.mockResolvedValue(expected);

    await expect(service.listCompanyHealth()).resolves.toEqual(expected);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
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
      }),
    ).resolves.toEqual(expected);

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.any(String),
      ['METRIC_1', 'cohort-a', '2026-01-01', '2026-01-31'],
    );
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

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.any(String),
      ['company-id', 'branch-id', '2026-01-01', '2026-01-31'],
    );
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

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.any(String),
      ['company-id', 'branch-id', 'COMPLETED'],
    );
  });

  it('returns a fallback message when rebuilding benchmark snapshots', async () => {
    await expect(service.rebuildBenchmarkSnapshots()).resolves.toEqual({
      message:
        'Benchmark rebuild is not implemented. Implement platform benchmark aggregation logic before using this route.',
    });
  });
});
