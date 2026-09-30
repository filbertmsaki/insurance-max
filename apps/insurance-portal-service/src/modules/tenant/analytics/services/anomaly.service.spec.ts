import { Test, TestingModule } from '@nestjs/testing';
import { AnomalyService } from './anomaly.service';
import { AnalyticsService } from './analytics.service';
import { NotFoundException } from '@nestjs/common';

describe('AnomalyService', () => {
  let service: AnomalyService;
  let analyticsService: Partial<Record<keyof AnalyticsService, jest.Mock>>;

  beforeEach(async () => {
    analyticsService = {
      listAnomalyFindings: jest.fn(),
      listAnomalyRules: jest.fn(),
      getDailyMetrics: jest.fn(),
      listAnomalyFindingsByRuleAndDate: jest.fn(),
      insertAnomalyFinding: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyService,
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
      ],
    }).compile();

    service = module.get<AnomalyService>(AnomalyService);
  });

  it('returns existing findings for the requested company and branch', async () => {
    const findings = [{ id: 'f1' }];
    (analyticsService.listAnomalyFindings as jest.Mock).mockResolvedValue(
      findings,
    );

    await expect(
      service.listFindings('company-id', { branchId: 'branch-id' }),
    ).resolves.toEqual(findings);
    expect(analyticsService.listAnomalyFindings).toHaveBeenCalledWith(
      'company-id',
      'branch-id',
      undefined,
      undefined,
      null,
    );
  });

  it('throws if the requested anomaly rule does not exist', async () => {
    (analyticsService.listAnomalyRules as jest.Mock).mockResolvedValue([]);

    await expect(
      service.runDetection(
        { companyId: 'company-id', id: 'user-id' },
        { ruleId: 'rule-id', from: '2025-01-01', to: '2025-01-10' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when there are no metrics available for detection', async () => {
    (analyticsService.listAnomalyRules as jest.Mock).mockResolvedValue([
      { id: 'rule-id', metric_code: 'METRIC_1' },
    ]);
    (analyticsService.getDailyMetrics as jest.Mock).mockResolvedValue([]);

    await expect(
      service.runDetection(
        { companyId: 'company-id', id: 'user-id' },
        { ruleId: 'rule-id', from: '2025-01-01', to: '2025-01-10' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('inserts a new anomaly finding when none exists', async () => {
    (analyticsService.listAnomalyRules as jest.Mock).mockResolvedValue([
      { id: 'rule-id', metric_code: 'METRIC_1' },
    ]);
    (analyticsService.getDailyMetrics as jest.Mock).mockResolvedValue([
      { metricDate: '2025-01-09', metricValue: '100' },
      { metricDate: '2025-01-10', metricValue: '120' },
    ]);
    (analyticsService.listAnomalyFindings as jest.Mock).mockResolvedValue([]);
    (
      analyticsService.listAnomalyFindingsByRuleAndDate as jest.Mock
    ).mockResolvedValue([]);
    (analyticsService.insertAnomalyFinding as jest.Mock).mockResolvedValue({
      id: 'finding-id',
    });

    const result = await service.runDetection(
      { companyId: 'company-id', id: 'user-id' },
      { ruleId: 'rule-id', from: '2025-01-01', to: '2025-01-10' },
    );

    expect(result).toEqual({ id: 'finding-id' });
    expect(analyticsService.insertAnomalyFinding).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-id',
        ruleId: 'rule-id',
        metricCode: 'METRIC_1',
        metricDate: '2025-01-10',
        status: 'OPEN',
      }),
    );
  });
});
