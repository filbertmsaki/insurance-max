import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsController } from './metrics.controller';
import { ReleaseGateController } from './release-gate.controller';
import { ReleaseGateService } from './release-gate.service';

@Module({
  controllers: [HealthController, MetricsController, ReleaseGateController],
  providers: [HealthService, ReleaseGateService],
})
export class HealthModule {}
