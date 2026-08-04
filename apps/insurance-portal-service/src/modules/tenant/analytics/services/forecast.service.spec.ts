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
    (analyticsService.listForecastDefinitions as jest.Mock).mockResolvedValue(definitions);

    await expect(service.listDefinitions('company-id')).resolves.toEqual(definitions);
  });

  it('throws when forecast definition cannot be found', async () => {
    (analyticsService.getForecastDefinition as jest.Mock).mockResolvedValue(null);

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

  it('creates a forecast run and returns forecast points', async () => {
    (analyticsService.getForecastDefinition as jest.Mock).mockResolvedValue({ id: 'def-1', method: 'AUTO' });
    (analyticsService.insertForecastRun as jest.Mock).mockResolvedValue({ id: 'run-1', run_no: 'FR-123' });
    (analyticsService.insertForecastPoints as jest.Mock).mockResolvedValue([
      { forecastDate: '2025-02-01', predictedValue: 100 },
      { forecastDate: '2025-02-02', predictedValue: 100 },
    ]);

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

    expect(result.run).toEqual({ id: 'run-1', run_no: 'FR-123' });
    expect(result.points).toHaveLength(2);
    expect(analyticsService.insertForecastRun).toHaveBeenCalled();
    expect(analyticsService.insertForecastPoints).toHaveBeenCalledWith('run-1', expect.any(Array));
  });
});
