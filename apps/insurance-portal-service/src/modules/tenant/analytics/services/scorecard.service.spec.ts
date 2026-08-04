import { Test, TestingModule } from '@nestjs/testing';
import { ScorecardService } from './scorecard.service';
import { AnalyticsService } from './analytics.service';
import { KpiService } from './kpi.service';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('ScorecardService', () => {
  let service: ScorecardService;
  let dataSource: { query: jest.Mock };
  let analyticsService: Partial<Record<keyof AnalyticsService, jest.Mock>>;
  let kpiService: Partial<Record<keyof KpiService, jest.Mock>>;

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    analyticsService = {
      listScorecardTemplates: jest.fn(),
      getScorecardTemplateItems: jest.fn(),
    } as any;
    kpiService = {
      calculateKpi: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScorecardService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
        {
          provide: KpiService,
          useValue: kpiService,
        },
      ],
    }).compile();

    service = module.get<ScorecardService>(ScorecardService);
  });

  it('lists available scorecard templates', async () => {
    const expectedTemplates = [{ id: 'template-id' }];
    (analyticsService.listScorecardTemplates as jest.Mock).mockResolvedValue(expectedTemplates);

    await expect(service.listTemplates('company-id')).resolves.toEqual(expectedTemplates);
  });

  it('generates and stores a scorecard snapshot with values', async () => {
    const templateItems = [
      {
        kpiDefinitionId: 'kpi-1',
        code: 'METRIC_1',
        targetValue: 10,
        warningThreshold: 80,
        criticalThreshold: 50,
        weight: 1,
        defaultTarget: 10,
        defaultWarningThreshold: 75,
        defaultCriticalThreshold: 50,
      },
    ];

    (analyticsService.getScorecardTemplateItems as jest.Mock).mockResolvedValue(templateItems);
    (kpiService.calculateKpi as jest.Mock).mockResolvedValue({
      value: '5',
      numerator: '5',
      denominator: null,
      explanation: 'result',
      metadata: { source: 'daily_metrics' },
    });

    const snapshotRow = [{ id: 'snapshot-id', overall_score: 50 }];
    dataSource.query
      .mockResolvedValueOnce(snapshotRow)
      .mockResolvedValueOnce([{ id: 'value-id' }]);

    const result = await service.generateScorecard(
      { companyId: 'company-id', id: 'user-id' } as any,
      {
        templateId: 'template-id',
        periodStart: '2025-01-01',
        periodEnd: '2025-01-31',
        branchId: 'branch-id',
      },
    );

    expect(result).toEqual(snapshotRow[0]);
    expect(dataSource.query).toHaveBeenCalledTimes(2);
    expect(kpiService.calculateKpi).toHaveBeenCalledWith(
      expect.any(Object),
      'METRIC_1',
      {
        branchId: 'branch-id',
        from: '2025-01-01',
        to: '2025-01-31',
      },
    );
  });

  it('throws when snapshot to publish is not found', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(
      service.publishScorecard({ companyId: 'company-id', id: 'user-id' } as any, 'snapshot-id'),
    ).rejects.toThrow(NotFoundException);
  });
});
