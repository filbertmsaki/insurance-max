import { Controller, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from '@insurance-max/portal-shared';
import { observabilityMetrics } from '@insurance-max/observability';

@ApiTags('Operations')
@ApiBearerAuth('access-token')
@Controller({ path: 'operations', version: '1' })
export class MetricsController {
  @Get('metrics')
  @Permissions('operations:health-read')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metrics() {
    return observabilityMetrics.renderPrometheus();
  }
}
