import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisSubmissionAttemptEntity } from './entities/tiramis-submission-attempt.entity';
import { TiramisSubmissionEventEntity } from './entities/tiramis-submission-event.entity';
import { TiramisTransactionEntity } from './entities/tiramis-transaction.entity';
import { TiramisSubmissionAttemptRepository } from './repositories/tiramis-submission-attempt.repository';
import { TiramisSubmissionEventRepository } from './repositories/tiramis-submission-event.repository';
import { TiramisTransactionRepository } from './repositories/tiramis-transaction.repository';
import { TiramisRequestIdService } from './services/tiramis-request-id.service';
import { TiramisResubmissionService } from './services/tiramis-resubmission.service';
import { TiramisSubmissionService } from './services/tiramis-submission.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisTransactionEntity,
      TiramisSubmissionAttemptEntity,
      TiramisSubmissionEventEntity,
    ]),
  ],
  providers: [
    TiramisTransactionRepository,
    TiramisSubmissionAttemptRepository,
    TiramisSubmissionEventRepository,
    TiramisRequestIdService,
    TiramisSubmissionService,
    TiramisResubmissionService,
  ],
  exports: [
    TiramisRequestIdService,
    TiramisSubmissionService,
    TiramisResubmissionService,
  ],
})
export class TiramisSubmissionsModule {}
