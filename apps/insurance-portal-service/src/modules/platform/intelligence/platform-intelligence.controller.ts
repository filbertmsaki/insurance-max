import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { RolesGuard } from '@insurance-max/portal-shared/guards/roles.guard';
import {
  AnomalyQueryDto,
  BenchmarkQueryDto,
  ForecastQueryDto,
  IntelligencePageQueryDto,
} from './dto/intelligence-query.dto';
import { PlatformIntelligencePermissions } from './platform-intelligence.permissions';
import { PlatformIntelligenceService } from './services/platform-intelligence.service';

@ApiTags('Platform Intelligence')
@ApiBearerAuth()
@Controller('platform/intelligence')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class PlatformIntelligenceController {
  constructor(
    private readonly intelligenceService: PlatformIntelligenceService,
  ) {}

  @Get('company-health')
  @Permissions(PlatformIntelligencePermissions.COMPANY_HEALTH)
  @ApiOperation({ summary: 'Get company-level platform health metrics' })
  listCompanyHealth(@Query() query: IntelligencePageQueryDto) {
    return this.intelligenceService.listCompanyHealth(query);
  }

  @Get('benchmarks')
  @Permissions(PlatformIntelligencePermissions.BENCHMARK_READ)
  @ApiOperation({ summary: 'List benchmark snapshots across the platform' })
  listBenchmarks(@Query() query: BenchmarkQueryDto) {
    return this.intelligenceService.listBenchmarkSnapshots(query);
  }

  @Get('anomalies')
  @Permissions(PlatformIntelligencePermissions.ANOMALY_READ)
  @ApiOperation({ summary: 'List platform anomaly findings' })
  listAnomalies(@Query() query: AnomalyQueryDto) {
    return this.intelligenceService.listAnomalyFindings(query);
  }

  @Get('forecasts')
  @Permissions(PlatformIntelligencePermissions.FORECAST_READ)
  @ApiOperation({ summary: 'List forecast runs across the platform' })
  listForecastRuns(@Query() query: ForecastQueryDto) {
    return this.intelligenceService.listForecastRuns(query);
  }

  @Post('benchmarks/rebuild')
  @Permissions(PlatformIntelligencePermissions.BENCHMARK_REBUILD)
  @ApiOperation({ summary: 'Rebuild platform benchmark snapshots' })
  rebuildBenchmarks() {
    return this.intelligenceService.rebuildBenchmarkSnapshots();
  }
}
