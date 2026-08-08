import { Test, TestingModule } from '@nestjs/testing';
import { ForecastService } from './forecast.service';
import { AnalyticsService } from './analytics.service';
import { NotFoundException } from '@nestjs/common';

describe('ForecastService', () => {
  let service: ForecastService;
  let analyticsService: Partial<Record<keyof AnalyticsService, jest.Mock>>;

  beforeEach(async () => {
    analyticsService = {
      listForecastDefinitions: jest.fn(),
      getForecastDefinition: jest.fn(),
      insertForecastRun: jest.fn(),
      insertForecastPoints: jest.fn(),
      getDailyMetrics: jest.fn().mockResolvedValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastService,
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
      ],
    }).compile();

    service = module.get<ForecastService>(ForecastService);
  });

  it('lists forecast definitions', async () => {
    const definitions = [{ id: 'def-1' }];
    (analyticsService.listForecastDefinitions as jest.Mock).mockResolvedValue(
      definitions,
    );

    await expect(service.listDefinitions('company-id')).resolves.toEqual(
      definitions,
    );
  });

  it('throws when forecast definition cannot be found', async () => {
    (analyticsService.getForecastDefinition as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(
      service.runForecast(
        { companyId: 'company-id', id: 'user-id' },
        {
          definitionId: 'def-1',
          trainingPeriodStart: '2025-01-01',
          trainingPeriodEnd: '2025-01-31',
          forecastPeriodStart: '2025-02-01',
          forecastPeriodEnd: '2025-02-07',
        },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns a zero, zero-confidence forecast when there is no training data', async () => {
    (analyticsService.getForecastDefinition as jest.Mock).mockResolvedValue({
      id: 'def-1',
      method: 'linear-regression',
      metric_code: 'policy.issued_count',
    });
    (analyticsService.insertForecastRun as jest.Mock).mockResolvedValue({
      id: 'run-1',
      run_no: 'FR-123',
    });
    (analyticsService.insertForecastPoints as jest.Mock).mockImplementation(
      async (_runId, points) => points,
    );

    const result = await service.runForecast(
      { companyId: 'company-id', id: 'user-id' },
      {
        definitionId: 'def-1',
        trainingPeriodStart: '2025-01-01',
        trainingPeriodEnd: '2025-01-31',
        forecastPeriodStart: '2025-02-01',
        forecastPeriodEnd: '2025-02-02',
      },
    );

    expect(result.points).toEqual([
      {
        forecastDate: '2025-02-01',
        predictedValue: 0,
        lowerBound: 0,
        upperBound: 0,
      },
      {
        forecastDate: '2025-02-02',
        predictedValue: 0,
        lowerBound: 0,
        upperBound: 0,
      },
    ]);
  });

  it('projects a rising linear trend forward instead of a flat/fake number', async () => {
    (analyticsService.getForecastDefinition as jest.Mock).mockResolvedValue({
      id: 'def-1',
      method: 'linear-regression',
      metric_code: 'policy.issued_count',
    });
    (analyticsService.insertForecastRun as jest.Mock).mockResolvedValue({
      id: 'run-1',
      run_no: 'FR-123',
    });
    (analyticsService.insertForecastPoints as jest.Mock).mockImplementation(
      async (_runId, points) => points,
    );

    // A perfectly linear training series: day 0 -> 10, day 1 -> 12, ... +2/day.
    const trainingRows = Array.from({ length: 10 }, (_, index) => ({
      metricDate: `2025-01-${String(index + 1).padStart(2, '0')}`,
      metricValue: String(10 + index * 2),
      observationCount: 1,
      dimensions: null,
    }));
    (analyticsService.getDailyMetrics as jest.Mock).mockResolvedValue(
      trainingRows,
    );

    const result = await service.runForecast(
      { companyId: 'company-id', id: 'user-id' },
      {
        definitionId: 'def-1',
        trainingPeriodStart: '2025-01-01',
        trainingPeriodEnd: '2025-01-10',
        forecastPeriodStart: '2025-01-11',
        forecastPeriodEnd: '2025-01-12',
      },
    );

    // Day index 10 -> 10 + 10*2 = 30, day index 11 -> 32, continuing the trend.
    expect(result.points[0]).toMatchObject({
      forecastDate: '2025-01-11',
      predictedValue: 30,
    });
    expect(result.points[1]).toMatchObject({
      forecastDate: '2025-01-12',
      predictedValue: 32,
    });
    // A real trend was fit — later days predict higher than earlier ones.
    expect(result.points[1].predictedValue).toBeGreaterThan(
      result.points[0].predictedValue,
    );
    expect(analyticsService.getDailyMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-id',
        metricCode: 'policy.issued_count',
        from: '2025-01-01',
        to: '2025-01-10',
      }),
    );
  });

  it('falls back to a moving average for a non-regression method', async () => {
    (analyticsService.getForecastDefinition as jest.Mock).mockResolvedValue({
      id: 'def-1',
      method: 'moving-average',
      metric_code: 'policy.issued_count',
    });
    (analyticsService.insertForecastRun as jest.Mock).mockResolvedValue({
      id: 'run-1',
      run_no: 'FR-123',
    });
    (analyticsService.insertForecastPoints as jest.Mock).mockImplementation(
      async (_runId, points) => points,
    );

    const trainingRows = [10, 20, 30].map((value, index) => ({
      metricDate: `2025-01-0${index + 1}`,
      metricValue: String(value),
    }));
    (analyticsService.getDailyMetrics as jest.Mock).mockResolvedValue(
      trainingRows,
    );

    const result = await service.runForecast(
      { companyId: 'company-id', id: 'user-id' },
      {
        definitionId: 'def-1',
        trainingPeriodStart: '2025-01-01',
        trainingPeriodEnd: '2025-01-03',
        forecastPeriodStart: '2025-01-04',
        forecastPeriodEnd: '2025-01-04',
      },
    );

    // Average of 10, 20, 30 = 20.
    expect(result.points[0].predictedValue).toBe(20);
  });
});
