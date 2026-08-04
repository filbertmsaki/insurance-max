import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlatformIntelligenceController } from './platform-intelligence.controller';
import { PlatformIntelligenceService } from './services/platform-intelligence.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [PlatformIntelligenceController],
  providers: [PlatformIntelligenceService],
  exports: [PlatformIntelligenceService],
})
export class PlatformIntelligenceModule {}
