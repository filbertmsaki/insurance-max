import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DataRetentionPolicy } from './entities/data-retention-policy.entity';
import { LegalHold } from './entities/legal-hold.entity';
import { RetentionService } from './retention.service';
import { RetentionController } from './retention.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DataRetentionPolicy, LegalHold])],
  controllers: [RetentionController],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
