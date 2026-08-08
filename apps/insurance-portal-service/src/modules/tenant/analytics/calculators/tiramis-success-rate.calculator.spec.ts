import { TiramisSuccessRateKpiCalculator } from './tiramis-success-rate.calculator';
import { AnalyticsService } from '../services/analytics.service';

describe('TiramisSuccessRateKpiCalculator', () => {
  let analyticsService: Partial<Record<keyof AnalyticsService, jest.Mock>>;
  let calculator: TiramisSuccessRateKpiCalculator;

  beforeEach(() => {
    analyticsService = {
      getDailyMetrics: jest.fn(),
    };
    calculator = new TiramisSuccessRateKpiCalculator(
      analyticsService as unknown as AnalyticsService,
    );
  });

  it('computes a submission-weighted average, not a sum of daily percentages', async () => {
    // Day 1: 90/100 succeeded (90%). Day 2: 5/10 succeeded (50%).
    // A naive sum of daily percentages would give 140%; the correct
    // period rate is (90 + 5) / (100 + 10) = 86.36%.
    (analyticsService.getDailyMetrics as jest.Mock).mockResolvedValue([
      { metricValue: '90', observationCount: 100 },
      { metricValue: '50', observationCount: 10 },
    ]);

    const result = await calculator.calculate({
      user: {} as any,
      companyId: 'company-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-02',
    });

    expect(result.value).toBe('86.36');
    expect(result.numerator).toBe('95');
    expect(result.denominator).toBe('110');
    expect(Number(result.value)).toBeLessThanOrEqual(100);
  });

  it('reports no data instead of a fabricated rate when there are no submissions', async () => {
    (analyticsService.getDailyMetrics as jest.Mock).mockResolvedValue([]);

    const result = await calculator.calculate({
      user: {} as any,
      companyId: 'company-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-02',
    });

    expect(result.value).toBeNull();
    expect(result.numerator).toBe('0');
    expect(result.denominator).toBe('0');
    expect(result.explanation).toContain('No TIRAMIS submissions');
  });

  it('queries the tiramis.success_rate metric for the requested company/branch/period', async () => {
    (analyticsService.getDailyMetrics as jest.Mock).mockResolvedValue([]);

    await calculator.calculate({
      user: {} as any,
      companyId: 'company-1',
      branchId: 'branch-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    });

    expect(analyticsService.getDailyMetrics).toHaveBeenCalledWith({
      companyId: 'company-1',
      branchId: 'branch-1',
      metricCode: 'tiramis.success_rate',
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });
});
