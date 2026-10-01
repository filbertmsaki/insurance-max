import { AnyPermissions, TenantScoped } from '@insurance-max/portal-shared';
import {
  BadRequestException,
  Body,
  ForbiddenException,
  Controller,
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
    private readonly scopeService: DataAccessScopeService,
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
    return this.analyticsMetricService.queryMetric({
      companyId: this.ensureCompanyId(user),
      metricCode: dto.metricCode,
      periodType: dto.periodType,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      branchId: this.resolveBranchId(user, dto.branchId),
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
    return this.analyticsMetricService.compareMetric({
      companyId: this.ensureCompanyId(user),
      metricCode: dto.metricCode,
      periodType: dto.periodType,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      branchId: this.resolveBranchId(user, dto.branchId),
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
    return this.kpiService.calculateKpi(user, code, {
      ...query,
      branchId: this.resolveBranchId(user, query.branchId) ?? undefined,
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
    return this.scorecardService.generateScorecard(user, {
      ...dto,
      branchId: this.resolveBranchId(user, dto.branchId) ?? undefined,
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
    return this.anomalyService.listFindings(this.ensureCompanyId(user), {
      ...query,
      branchId: this.resolveBranchId(user, query.branchId) ?? undefined,
    });
  }

  @Post('anomalies/run')
  @Permissions(AnalyticsPermissions.ANOMALY_CONFIGURE)
  @ApiOperation({ summary: 'Run anomaly detection for the selected metric' })
  runAnomalyDetection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunAnomalyDto,
  ) {
    return this.anomalyService.runDetection(
      { companyId: this.ensureCompanyId(user), id: user.id },
      {
        ...dto,
        branchId: this.resolveBranchId(user, dto.branchId) ?? undefined,
      },
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
    return this.forecastService.runForecast(
      { companyId: this.ensureCompanyId(user), id: user.id },
      {
        ...dto,
        branchId: this.resolveBranchId(user, dto.branchId) ?? undefined,
      },
    );
  }

  /**
   * The branch an analytics request may read. Company-wide users may ask for
   * any branch or none (all branches). A branch-restricted user may only ask
   * for an allowed branch; with a single allowed branch it is the default,
   * with several they must choose one (queries take one branch).
   */
  private resolveBranchId(
    user: AuthenticatedUser,
    requested?: string | null,
  ): string | null {
    const scope = this.scopeService.resolve(user);
    if (scope.canViewAllBranches) return requested ?? null;

    if (requested) {
      this.scopeService.assertRequestedBranchAllowed(scope, requested);
      return requested;
    }
    if (scope.allowedBranchIds.length === 1) return scope.allowedBranchIds[0];
    if (scope.allowedBranchIds.length > 1) {
      throw new BadRequestException(
        'Select one of your branches to view analytics',
      );
    }
    throw new ForbiddenException('You are not assigned to any branch');
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
