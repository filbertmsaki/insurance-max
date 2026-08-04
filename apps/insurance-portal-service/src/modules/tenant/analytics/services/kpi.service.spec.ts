import { Test, TestingModule } from '@nestjs/testing';
import { KpiService } from './kpi.service';
import { AnalyticsService } from './analytics.service';
import { KPI_CALCULATORS } from '../interfaces/kpi-calculator.interface';

describe('KpiService', () => {
  let service: KpiService;
  let analyticsService: Partial<Record<keyof AnalyticsService, jest.Mock>>;

  beforeEach(async () => {
    analyticsService = {
      listKpiDefinitions: jest.fn(),
      getKpiDefinition: jest.fn(),
      getDailyMetrics: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiService,
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
        {
          provide: KPI_CALCULATORS,
          useValue: [
            {
              key: 'CUSTOM_CALCULATOR',
              calculate: jest.fn().mockResolvedValue({
                value: '42',
                numerator: '42',
                denominator: null,
                explanation: 'custom result',
              }),
            },
          ],
        },
      ],
    }).compile();

    service = module.get<KpiService>(KpiService);
  });

  it('returns KPI definitions from analytics service', async () => {
    const expected = [{ code: 'POLICY_COUNT' }];
    (analyticsService.listKpiDefinitions as jest.Mock).mockResolvedValue(expected);

    await expect(service.listDefinitions('company-id')).resolves.toEqual(expected);
    expect(analyticsService.listKpiDefinitions).toHaveBeenCalled();
  });

  it('uses a custom calculator when definition matches calculator key', async () => {
    (analyticsService.getKpiDefinition as jest.Mock).mockResolvedValue({
      code: 'CUSTOM_CALCULATOR',
      calculator_key: 'CUSTOM_CALCULATOR',
    });

    const result = await service.calculateKpi(
      { companyId: 'company-id', id: 'user-id' } as any,
      'CUSTOM_CALCULATOR',
      { from: '2025-01-01', to: '2025-01-10' },
    );

    expect(result.value).toBe('42');
    expect(result.explanation).toContain('custom result');
  });

  it('falls back to daily metric sum when no calculator is available', async () => {
    (analyticsService.getKpiDefinition as jest.Mock).mockResolvedValue({
      code: 'FALLBACK_METRIC',
      calculator_key: null,
    });
    (analyticsService.getDailyMetrics as jest.Mock).mockResolvedValue([
      { metricValue: '5' },
      { metricValue: '10' },
    ]);

    const result = await service.calculateKpi(
      { companyId: 'company-id', id: 'user-id' } as any,
      'FALLBACK_METRIC',
      { from: '2025-01-01', to: '2025-01-10' },
    );

    expect(result.value).toBe('15');
    expect(result.numerator).toBe('15');
    expect(result.explanation).toContain('Fallback KPI calculation');
  });
});
