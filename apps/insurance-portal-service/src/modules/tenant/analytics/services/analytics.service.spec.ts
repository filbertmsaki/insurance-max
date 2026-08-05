import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('lists KPI definitions', async () => {
    const expected = [{ code: 'POLICY_COUNT' }];
    dataSource.query.mockResolvedValue(expected);

    await expect(service.listKpiDefinitions()).resolves.toEqual(expected);
    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String));
  });

  it('returns null when a KPI definition is not found', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(service.getKpiDefinition('UNKNOWN')).resolves.toBeNull();
    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'UNKNOWN',
    ]);
  });

  it('lists scorecard templates for a company', async () => {
    const expected = [{ id: 'template-1' }];
    dataSource.query.mockResolvedValue(expected);

    await expect(service.listScorecardTemplates('company-1')).resolves.toEqual(
      expected,
    );
    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'company-1',
    ]);
  });

  it('queries daily metrics with date and branch filters', async () => {
    const expected = [{ metricDate: '2026-01-01' }];
    dataSource.query.mockResolvedValue(expected);

    await expect(
      service.getDailyMetrics({
        companyId: 'company-1',
        metricCode: 'METRIC_1',
        from: '2026-01-01',
        to: '2026-01-31',
        branchId: 'branch-1',
      }),
    ).resolves.toEqual(expected);

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'company-1',
      'METRIC_1',
      '2026-01-01',
      '2026-01-31',
      'branch-1',
    ]);
  });

  it('lists anomaly findings with company and branch filters', async () => {
    const expected = [{ id: 'finding-1' }];
    dataSource.query.mockResolvedValue(expected);

    await expect(
      service.listAnomalyFindings(
        'company-1',
        'branch-1',
        '2026-01-01',
        '2026-01-31',
      ),
    ).resolves.toEqual(expected);

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'company-1',
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    ]);
  });

  it('inserts forecast points using batched SQL values', async () => {
    const expected = [
      {
        forecast_run_id: 'run-1',
        forecast_date: '2026-02-01',
        predicted_value: 100,
      },
      {
        forecast_run_id: 'run-1',
        forecast_date: '2026-02-02',
        predicted_value: 120,
      },
    ];

    dataSource.query.mockResolvedValue(expected);

    await expect(
      service.insertForecastPoints('run-1', [
        {
          forecastDate: '2026-02-01',
          predictedValue: 100,
          lowerBound: 90,
          upperBound: 110,
        },
        {
          forecastDate: '2026-02-02',
          predictedValue: 120,
          lowerBound: null,
          upperBound: null,
        },
      ]),
    ).resolves.toEqual(expected);

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'run-1',
      '2026-02-01',
      100,
      90,
      110,
      '2026-02-02',
      120,
      null,
      null,
    ]);
  });

  it('returns an empty array when no forecast points are provided', async () => {
    await expect(service.insertForecastPoints('run-1', [])).resolves.toEqual(
      [],
    );
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
