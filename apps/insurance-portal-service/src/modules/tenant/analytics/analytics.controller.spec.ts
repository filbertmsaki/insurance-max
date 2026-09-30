import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { KpiService } from './services/kpi.service';
import { ScorecardService } from './services/scorecard.service';
import { AnomalyService } from './services/anomaly.service';
import { ForecastService } from './services/forecast.service';
import { BenchmarkService } from './services/benchmark.service';
import { AnalyticsMetricService } from './services/analytics-metric.service';
import { AnalyticsPermissions } from './analytics.permissions';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsMetricService: Partial<
    Record<keyof AnalyticsMetricService, jest.Mock>
  >;
  let kpiService: Partial<Record<keyof KpiService, jest.Mock>>;
  let scorecardService: Partial<Record<keyof ScorecardService, jest.Mock>>;
  let anomalyService: Partial<Record<keyof AnomalyService, jest.Mock>>;
  let forecastService: Partial<Record<keyof ForecastService, jest.Mock>>;
  let benchmarkService: Partial<Record<keyof BenchmarkService, jest.Mock>>;

  const mockUser = {
    id: 'user-id',
    companyId: 'company-id',
    scope: 'company',
    companyType: 'INSURANCE_COMPANY',
    companyMembershipId: 'membership-id',
    quotationPolicyDataScope: 'COMPANY',
    permissions: [],
  } as any;
  const branchUser = {
    ...mockUser,
    quotationPolicyDataScope: 'BRANCH',
    assignedBranchIds: ['branch-a', 'branch-b'],
  };
  const singleBranchUser = {
    ...mockUser,
    quotationPolicyDataScope: 'BRANCH',
    assignedBranchIds: ['branch-a'],
  };

  beforeEach(async () => {
    analyticsMetricService = {
      listDefinitions: jest.fn().mockResolvedValue([
        {
          code: 'premium.gross_written',
          permission: 'analytics:metrics:read',
        },
      ]),
      getDefinition: jest
        .fn()
        .mockResolvedValue({ code: 'premium.gross_written' }),
      queryMetric: jest.fn().mockResolvedValue({
        definition: { code: 'premium.gross_written' },
        values: [{ value: '1000.00' }],
      }),
      compareMetric: jest.fn().mockResolvedValue({
        primary: { values: [{ value: '1000.00' }] },
        comparison: { values: [{ value: '900.00' }] },
        delta: '100.00',
      }),
    } as any;

    kpiService = {
      listDefinitions: jest.fn().mockResolvedValue([{ code: 'POLICY_COUNT' }]),
      calculateKpi: jest.fn().mockResolvedValue({ value: '10' }),
    } as any;

    scorecardService = {
      listTemplates: jest.fn().mockResolvedValue([{ id: 'template-id' }]),
      generateScorecard: jest.fn().mockResolvedValue({ id: 'snapshot-id' }),
      publishScorecard: jest
        .fn()
        .mockResolvedValue({ id: 'snapshot-id', status: 'PUBLISHED' }),
    } as any;

    anomalyService = {
      listFindings: jest.fn().mockResolvedValue([{ id: 'finding-id' }]),
      runDetection: jest.fn().mockResolvedValue({ id: 'finding-id' }),
    } as any;

    forecastService = {
      listDefinitions: jest.fn().mockResolvedValue([{ id: 'forecast-id' }]),
      runForecast: jest.fn().mockResolvedValue({ run: { id: 'run-id' } }),
    } as any;

    benchmarkService = {
      listSnapshots: jest.fn().mockResolvedValue([{ id: 'benchmark-id' }]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsMetricService, useValue: analyticsMetricService },
        { provide: KpiService, useValue: kpiService },
        { provide: ScorecardService, useValue: scorecardService },
        { provide: AnomalyService, useValue: anomalyService },
        { provide: ForecastService, useValue: forecastService },
        { provide: BenchmarkService, useValue: benchmarkService },
        DataAccessScopeService,
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('lists metric definitions', async () => {
    const result = await controller.getMetrics({
      ...mockUser,
      permissions: [AnalyticsPermissions.READ, 'analytics:metrics:read'],
    });

    expect(result).toEqual([
      { code: 'premium.gross_written', permission: 'analytics:metrics:read' },
    ]);
    expect(analyticsMetricService.listDefinitions).toHaveBeenCalledWith([
      AnalyticsPermissions.READ,
      'analytics:metrics:read',
    ]);
  });

  it('gets a metric definition', async () => {
    const result = await controller.getMetricDefinition(
      'premium.gross_written',
    );

    expect(result).toEqual({ code: 'premium.gross_written' });
    expect(analyticsMetricService.getDefinition).toHaveBeenCalledWith(
      'premium.gross_written',
    );
  });

  it('queries a metric', async () => {
    const dto = {
      metricCode: 'premium.gross_written',
      periodType: 'MONTH',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-07',
      branchId: 'branch-id',
      dimensions: { branch_id: 'branch-id' },
      valueKind: 'ACTUAL',
      currencyCode: 'TZS',
    } as any;

    const result = await controller.queryMetric(mockUser, dto);

    expect(result).toEqual({
      definition: { code: 'premium.gross_written' },
      values: [{ value: '1000.00' }],
    });
    expect(analyticsMetricService.queryMetric).toHaveBeenCalledWith({
      companyId: 'company-id',
      metricCode: 'premium.gross_written',
      periodType: 'MONTH',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-07',
      branchId: 'branch-id',
      dimensions: { branch_id: 'branch-id' },
      valueKind: 'ACTUAL',
      currencyCode: 'TZS',
    });
  });

  it('compares a metric across two periods', async () => {
    const dto = {
      metricCode: 'premium.gross_written',
      periodType: 'MONTH',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-07',
      comparePeriodStart: '2026-07-25',
      comparePeriodEnd: '2026-07-31',
      branchId: 'branch-id',
      dimensions: { branch_id: 'branch-id' },
      valueKind: 'ACTUAL',
      currencyCode: 'TZS',
    } as any;

    const result = await controller.compareMetric(mockUser, dto);

    expect(result).toEqual({
      primary: { values: [{ value: '1000.00' }] },
      comparison: { values: [{ value: '900.00' }] },
      delta: '100.00',
    });
    expect(analyticsMetricService.compareMetric).toHaveBeenCalledWith({
      companyId: 'company-id',
      metricCode: 'premium.gross_written',
      periodType: 'MONTH',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-07',
      branchId: 'branch-id',
      dimensions: { branch_id: 'branch-id' },
      valueKind: 'ACTUAL',
      currencyCode: 'TZS',
      comparePeriodStart: '2026-07-25',
      comparePeriodEnd: '2026-07-31',
    });
  });

  it('lists KPI definitions', async () => {
    const result = await controller.getKpis(mockUser);

    expect(result).toEqual([{ code: 'POLICY_COUNT' }]);
    expect(kpiService.listDefinitions).toHaveBeenCalledWith('company-id');
  });

  it('calculates a KPI for a code', async () => {
    const result = await controller.calculateKpi(mockUser, 'POLICY_COUNT', {
      from: '2026-01-01',
      to: '2026-01-31',
      branchId: 'branch-id',
    });

    expect(result).toEqual({ value: '10' });
    expect(kpiService.calculateKpi).toHaveBeenCalledWith(
      mockUser,
      'POLICY_COUNT',
      {
        from: '2026-01-01',
        to: '2026-01-31',
        branchId: 'branch-id',
      },
    );
  });

  it('lists scorecard templates', async () => {
    const result = await controller.getScorecardTemplates(mockUser);

    expect(result).toEqual([{ id: 'template-id' }]);
    expect(scorecardService.listTemplates).toHaveBeenCalledWith('company-id');
  });

  it('generates a scorecard snapshot', async () => {
    const dto = {
      templateId: 'template-id',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      branchId: 'branch-id',
    };

    const result = await controller.generateScorecard(mockUser, dto);

    expect(result).toEqual({ id: 'snapshot-id' });
    expect(scorecardService.generateScorecard).toHaveBeenCalledWith(
      mockUser,
      dto,
    );
  });

  it('publishes a scorecard snapshot', async () => {
    const result = await controller.publishScorecard(mockUser, {
      snapshotId: 'snapshot-id',
    });

    expect(result).toEqual({ id: 'snapshot-id', status: 'PUBLISHED' });
    expect(scorecardService.publishScorecard).toHaveBeenCalledWith(
      mockUser,
      'snapshot-id',
    );
  });

  it('lists anomaly findings', async () => {
    const query = {
      branchId: 'branch-id',
      from: '2026-01-01',
      to: '2026-01-31',
    };
    const result = await controller.listAnomalies(mockUser, query);

    expect(result).toEqual([{ id: 'finding-id' }]);
    expect(anomalyService.listFindings).toHaveBeenCalledWith(
      'company-id',
      query,
    );
  });

  it('runs anomaly detection', async () => {
    const dto = {
      ruleId: 'rule-id',
      branchId: 'branch-id',
      from: '2026-01-01',
      to: '2026-01-31',
    };

    const result = await controller.runAnomalyDetection(mockUser, dto);

    expect(result).toEqual({ id: 'finding-id' });
    expect(anomalyService.runDetection).toHaveBeenCalledWith(
      { companyId: 'company-id', id: 'user-id' },
      dto,
    );
  });

  it('lists forecast definitions', async () => {
    const result = await controller.listForecasts(mockUser);

    expect(result).toEqual([{ id: 'forecast-id' }]);
    expect(forecastService.listDefinitions).toHaveBeenCalledWith('company-id');
  });

  it('runs a forecast definition', async () => {
    const dto = {
      definitionId: 'def-1',
      trainingPeriodStart: '2026-01-01',
      trainingPeriodEnd: '2026-01-31',
      forecastPeriodStart: '2026-02-01',
      forecastPeriodEnd: '2026-02-07',
    };

    const result = await controller.runForecast(mockUser, dto);

    expect(result).toEqual({ run: { id: 'run-id' } });
    expect(forecastService.runForecast).toHaveBeenCalledWith(
      { companyId: 'company-id', id: 'user-id' },
      { ...dto, branchId: null },
    );
  });

  it('lists benchmark snapshots', async () => {
    const query = {
      metricCode: 'METRIC_1',
      cohortKey: 'cohort-a',
      from: '2026-01-01',
      to: '2026-01-31',
    };
    const result = await controller.getBenchmarks(query);

    expect(result).toEqual([{ id: 'benchmark-id' }]);
    expect(benchmarkService.listSnapshots).toHaveBeenCalledWith(query);
  });

  describe('branch scoping', () => {
    const metricDto = {
      metricCode: 'premium.gross_written',
      periodType: 'MONTH',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    } as any;

    it('rejects a branch the user may not access', () => {
      expect(() =>
        controller.queryMetric(branchUser, {
          ...metricDto,
          branchId: 'branch-z',
        }),
      ).toThrow(ForbiddenException);
      expect(analyticsMetricService.queryMetric).not.toHaveBeenCalled();
    });

    it('allows one of the user branches', async () => {
      await controller.queryMetric(branchUser, {
        ...metricDto,
        branchId: 'branch-b',
      });

      expect(analyticsMetricService.queryMetric).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-b' }),
      );
    });

    it('restricts a branch-limited user without a branch to the allowed branches', async () => {
      await controller.queryMetric(branchUser, metricDto);
      await controller.compareMetric(branchUser, metricDto);
      await controller.calculateKpi(branchUser, 'POLICY_COUNT', {});
      await controller.listAnomalies(branchUser, {});

      const restricted = {
        branchId: null,
        branchIds: ['branch-a', 'branch-b'],
      };
      expect(analyticsMetricService.queryMetric).toHaveBeenCalledWith(
        expect.objectContaining(restricted),
      );
      expect(analyticsMetricService.compareMetric).toHaveBeenCalledWith(
        expect.objectContaining(restricted),
      );
      expect(kpiService.calculateKpi).toHaveBeenCalledWith(
        branchUser,
        'POLICY_COUNT',
        expect.objectContaining(restricted),
      );
      expect(anomalyService.listFindings).toHaveBeenCalledWith(
        'company-id',
        expect.objectContaining(restricted),
      );
    });

    it('uses the only allowed branch when there is one', async () => {
      await controller.queryMetric(singleBranchUser, metricDto);

      expect(analyticsMetricService.queryMetric).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-a' }),
      );
      expect(
        analyticsMetricService.queryMetric.mock.calls[0][0],
      ).not.toHaveProperty('branchIds');
    });

    it('refuses company-wide records for multi-branch users without a branch', () => {
      expect(() =>
        controller.generateScorecard(branchUser, {
          templateId: 'template-id',
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
        }),
      ).toThrow(ForbiddenException);
      expect(() =>
        controller.runForecast(branchUser, {
          definitionId: 'def-1',
          trainingPeriodStart: '2026-01-01',
          trainingPeriodEnd: '2026-01-31',
          forecastPeriodStart: '2026-02-01',
          forecastPeriodEnd: '2026-02-07',
        }),
      ).toThrow(ForbiddenException);
      expect(() =>
        controller.runAnomalyDetection(branchUser, {
          ruleId: 'rule-id',
          from: '2026-01-01',
          to: '2026-01-31',
        }),
      ).toThrow(ForbiddenException);
    });

    it('rejects branch-limited users with no branch assignment', () => {
      expect(() =>
        controller.queryMetric(
          { ...branchUser, assignedBranchIds: [] },
          metricDto,
        ),
      ).toThrow(ForbiddenException);
    });
  });

  it('requires company context for analytics', () => {
    expect(() => controller.getKpis({ id: 'user-id' } as any)).toThrow(
      'Company context is required for analytics',
    );
  });
});
