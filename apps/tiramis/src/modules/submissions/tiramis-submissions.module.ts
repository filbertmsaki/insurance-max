import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisPortalNotificationsModule } from '../portal-notifications/tiramis-portal-notifications.module';
import { TiramisSubmissionAttemptEntity } from './entities/tiramis-submission-attempt.entity';
import { TiramisSubmissionEventEntity } from './entities/tiramis-submission-event.entity';
import { TiramisTransactionEntity } from './entities/tiramis-transaction.entity';
import { TiramisSubmissionsController } from './controllers/tiramis-submissions.controller';
import { TiramisSubmissionAttemptRepository } from './repositories/tiramis-submission-attempt.repository';
import { TiramisSubmissionEventRepository } from './repositories/tiramis-submission-event.repository';
import { TiramisTransactionRepository } from './repositories/tiramis-transaction.repository';
import { TiramisRequestIdService } from './services/tiramis-request-id.service';
import { TiramisRetrySchedulerService } from './services/tiramis-retry-scheduler.service';
import { TiramisResubmissionService } from './services/tiramis-resubmission.service';
import { TiramisSubmissionService } from './services/tiramis-submission.service';
import { TiramisCoverPeriodService } from '../shared/services/tiramis-cover-period.service';

@Module({
  imports: [
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisPortalNotificationsModule,
    TypeOrmModule.forFeature([
      TiramisTransactionEntity,
      TiramisSubmissionAttemptEntity,
      TiramisSubmissionEventEntity,
    ]),
  ],
  controllers: [TiramisSubmissionsController],
  providers: [
    TiramisTransactionRepository,
    TiramisSubmissionAttemptRepository,
    TiramisSubmissionEventRepository,
    TiramisRequestIdService,
    TiramisRetrySchedulerService,
    TiramisSubmissionService,
    TiramisResubmissionService,
    TiramisCoverPeriodService,
  ],
  exports: [
    TiramisTransactionRepository,
    TiramisSubmissionAttemptRepository,
    TiramisSubmissionEventRepository,
    TiramisRequestIdService,
    TiramisSubmissionService,
    TiramisResubmissionService,
  ],
})
export class TiramisSubmissionsModule {}
