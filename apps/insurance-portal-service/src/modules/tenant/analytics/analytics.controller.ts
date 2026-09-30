import { AnyPermissions, TenantScoped } from '@insurance-max/portal-shared';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { AnalyticsPermissions } from './analytics.permissions';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { KpiQueryDto } from './dto/kpi-query.dto';
import { GenerateScorecardDto } from './dto/generate-scorecard.dto';
import { RunAnomalyDto } from './dto/run-anomaly.dto';
import { RunForecastDto } from './dto/run-forecast.dto';
import { BenchmarkQueryDto } from './dto/benchmark-query.dto';
import { MetricCompareDto } from './dto/metric-compare.dto';
import { MetricQueryDto } from './dto/metric-query.dto';
import { AnalyticsMetricService } from './services/analytics-metric.service';
import { KpiService } from './services/kpi.service';
import { ScorecardService } from './services/scorecard.service';
import { AnomalyService } from './services/anomaly.service';
import { ForecastService } from './services/forecast.service';
import { BenchmarkService } from './services/benchmark.service';

@ApiTags('Tenant Analytics')
@ApiBearerAuth()
@Controller('tenant/analytics')
@TenantScoped()
export class AnalyticsController {
  constructor(
    private readonly analyticsMetricService: AnalyticsMetricService,
    private readonly kpiService: KpiService,
    private readonly scorecardService: ScorecardService,
    private readonly anomalyService: AnomalyService,
    private readonly forecastService: ForecastService,
    private readonly benchmarkService: BenchmarkService,
    private readonly dataAccessScopeService: DataAccessScopeService,
  ) {}

  @Get('metrics')
  @AnyPermissions(AnalyticsPermissions.READ, 'analytics:metrics:read')
  @ApiOperation({ summary: 'List registered analytics metric definitions' })
  getMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsMetricService.listDefinitions(user.permissions ?? []);
  }

  @Get('metrics/:code')
  @AnyPermissions(AnalyticsPermissions.READ, 'analytics:metrics:read')
  @ApiOperation({ summary: 'Get a registered analytics metric definition' })
  getMetricDefinition(@Param('code') code: string) {
    return this.analyticsMetricService.getDefinition(code);
  }

  @Post('query')
  @AnyPermissions(AnalyticsPermissions.READ, 'analytics:metrics:read')
  @ApiOperation({ summary: 'Query metric values for a selected period' })
  queryMetric(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MetricQueryDto,
  ) {
    const companyId = this.ensureCompanyId(user);
    return this.analyticsMetricService.queryMetric({
      companyId,
      metricCode: dto.metricCode,
      periodType: dto.periodType,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      ...this.resolveBranchFilter(user, dto.branchId),
      dimensions: dto.dimensions,
      valueKind: dto.valueKind,
      currencyCode: dto.currencyCode ?? null,
    });
  }

  @Post('compare')
  @AnyPermissions(AnalyticsPermissions.READ, 'analytics:metrics:read')
  @ApiOperation({ summary: 'Compare metric values across two periods' })
  compareMetric(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MetricCompareDto,
  ) {
    const companyId = this.ensureCompanyId(user);
    return this.analyticsMetricService.compareMetric({
      companyId,
      metricCode: dto.metricCode,
      periodType: dto.periodType,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      ...this.resolveBranchFilter(user, dto.branchId),
      dimensions: dto.dimensions,
      valueKind: dto.valueKind,
      currencyCode: dto.currencyCode ?? null,
      comparePeriodStart: dto.comparePeriodStart,
      comparePeriodEnd: dto.comparePeriodEnd,
    });
  }

  @Get('kpis')
  @Permissions(AnalyticsPermissions.READ)
  @ApiOperation({ summary: 'List available KPI definitions' })
  getKpis(@CurrentUser() user: AuthenticatedUser) {
    return this.kpiService.listDefinitions(this.ensureCompanyId(user));
  }

  @Get('kpis/:code')
  @Permissions(AnalyticsPermissions.READ)
  @ApiOperation({ summary: 'Calculate KPI result for the selected period' })
  async calculateKpi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Query() query: KpiQueryDto,
  ) {
    this.ensureCompanyId(user);
    return this.kpiService.calculateKpi(user, code, {
      ...query,
      ...this.resolveBranchFilter(user, query.branchId),
    });
  }

  @Get('scorecards/templates')
  @Permissions(AnalyticsPermissions.SCORECARD_READ)
  @ApiOperation({ summary: 'List scorecard templates' })
  getScorecardTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.scorecardService.listTemplates(this.ensureCompanyId(user));
  }

  @Post('scorecards/generate')
  @Permissions(AnalyticsPermissions.SCORECARD_GENERATE)
  @ApiOperation({ summary: 'Generate a scorecard snapshot for a period' })
  generateScorecard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateScorecardDto,
  ) {
    this.ensureCompanyId(user);
    return this.scorecardService.generateScorecard(user, {
      ...dto,
      branchId: this.resolveSingleBranch(user, dto.branchId),
    });
  }

  @Post('scorecards/publish')
  @Permissions(AnalyticsPermissions.SCORECARD_PUBLISH)
  @ApiOperation({ summary: 'Publish a generated scorecard snapshot' })
  publishScorecard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { snapshotId: string },
  ) {
    return this.scorecardService.publishScorecard(user, dto.snapshotId);
  }

  @Get('anomalies')
  @Permissions(AnalyticsPermissions.ANOMALY_READ)
  @ApiOperation({ summary: 'List anomaly findings' })
  listAnomalies(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const companyId = this.ensureCompanyId(user);
    return this.anomalyService.listFindings(companyId, {
      ...query,
      ...this.resolveBranchFilter(user, query.branchId),
    });
  }

  @Post('anomalies/run')
  @Permissions(AnalyticsPermissions.ANOMALY_CONFIGURE)
  @ApiOperation({ summary: 'Run anomaly detection for the selected metric' })
  runAnomalyDetection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunAnomalyDto,
  ) {
    const companyId = this.ensureCompanyId(user);
    return this.anomalyService.runDetection(
      { companyId, id: user.id },
      { ...dto, branchId: this.resolveSingleBranch(user, dto.branchId) },
    );
  }

  @Get('forecasts')
  @Permissions(AnalyticsPermissions.FORECAST_READ)
  @ApiOperation({ summary: 'List active forecast definitions' })
  listForecasts(@CurrentUser() user: AuthenticatedUser) {
    return this.forecastService.listDefinitions(this.ensureCompanyId(user));
  }

  @Post('forecasts/run')
  @Permissions(AnalyticsPermissions.FORECAST_RUN)
  @ApiOperation({ summary: 'Run a forecast definition' })
  runForecast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunForecastDto,
  ) {
    const companyId = this.ensureCompanyId(user);
    return this.forecastService.runForecast(
      { companyId, id: user.id },
      { ...dto, branchId: this.resolveSingleBranch(user, dto.branchId) },
    );
  }

  /**
   * Branch filter for aggregate reads. A requested branch must be one the
   * user may access; without one, branch-limited users are restricted to
   * their allowed branches (a single branch, or the set via `branchIds`).
   */
  private resolveBranchFilter(
    user: AuthenticatedUser,
    requestedBranchId?: string | null,
  ): { branchId: string | null; branchIds?: string[] } {
    const scope = this.dataAccessScopeService.resolve(user);
    this.dataAccessScopeService.assertRequestedBranchAllowed(
      scope,
      requestedBranchId,
    );

    if (requestedBranchId) return { branchId: requestedBranchId };
    if (scope.canViewAllBranches) return { branchId: null };
    if (!scope.allowedBranchIds.length) {
      throw new ForbiddenException(
        'You are not assigned to any branch for analytics',
      );
    }
    if (scope.allowedBranchIds.length === 1) {
      return { branchId: scope.allowedBranchIds[0] };
    }

    return { branchId: null, branchIds: [...scope.allowedBranchIds] };
  }

  /**
   * For commands that persist one branch-scoped record (scorecard snapshot,
   * anomaly finding, forecast run): a branch-limited user must address one
   * allowed branch, since a null branch would record company-wide results.
   */
  private resolveSingleBranch(
    user: AuthenticatedUser,
    requestedBranchId?: string | null,
  ): string | null {
    const filter = this.resolveBranchFilter(user, requestedBranchId);

    if (filter.branchIds) {
      throw new ForbiddenException(
        'Select one of your branches; company-wide analytics require access to all branches',
      );
    }

    return filter.branchId;
  }

  private ensureCompanyId(user: AuthenticatedUser): string {
    if (!user.companyId) {
      throw new BadRequestException(
        'Company context is required for analytics',
      );
    }

    return user.companyId;
  }

  @Get('benchmarks')
  @Permissions(AnalyticsPermissions.BENCHMARK_READ)
  @ApiOperation({ summary: 'Fetch benchmark snapshot data' })
  getBenchmarks(@Query() query: BenchmarkQueryDto) {
    return this.benchmarkService.listSnapshots(query);
  }
}
