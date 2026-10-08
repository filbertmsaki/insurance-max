import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PlatformIntelligenceService } from '../services/platform-intelligence.service';

/** Refreshes platform benchmarks nightly from usage and billing data. */
@Injectable()
export class BenchmarkRebuildJob {
  private readonly logger = new Logger(BenchmarkRebuildJob.name);

  constructor(
    private readonly intelligenceService: PlatformIntelligenceService,
  ) {}

  @Cron('0 30 2 * * *', { timeZone: 'Africa/Dar_es_Salaam' })
  async rebuildNightly() {
    try {
      const result = await this.intelligenceService.rebuildBenchmarkSnapshots();
      this.logger.log(
        `Rebuilt benchmarks: ${result.usageSnapshotCount} usage, ${result.billingSnapshotCount} billing snapshot(s)`,
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.log('Benchmark rebuild already running elsewhere; skipped');
        return;
      }
      this.logger.error(
        `Benchmark rebuild failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
