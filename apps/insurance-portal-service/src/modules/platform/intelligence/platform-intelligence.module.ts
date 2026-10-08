import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BenchmarkRebuildJob } from './jobs/benchmark-rebuild.job';
import { PlatformIntelligenceController } from './platform-intelligence.controller';
import { PlatformIntelligenceService } from './services/platform-intelligence.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [PlatformIntelligenceController],
  providers: [PlatformIntelligenceService, BenchmarkRebuildJob],
  exports: [PlatformIntelligenceService],
})
export class PlatformIntelligenceModule {}
