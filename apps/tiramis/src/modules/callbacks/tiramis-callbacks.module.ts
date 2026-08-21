import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisCoverNoteEntity } from '../cover-notes/entities/tiramis-cover-note.entity';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisPortalNotificationsModule } from '../portal-notifications/tiramis-portal-notifications.module';
import { TiramisClaimsModule } from '../claims/tiramis-claims.module';
import { TiramisPoliciesModule } from '../policies/tiramis-policies.module';
import { TiramisPolicyEntity } from '../policies/entities/tiramis-policy.entity';
import { TiramisReinsuranceModule } from '../reinsurance/tiramis-reinsurance.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisCallbackDeadLetterEntity } from './entities/tiramis-callback-dead-letter.entity';
import { TiramisCallbackReceiptEntity } from './entities/tiramis-callback-receipt.entity';

import { TiramisCallbackController } from './controllers/tiramis-callback.controller';
import { TiramisInternalCallbackTestController } from './controllers/tiramis-internal-callback-test.controller';
import { TiramisCallbackService } from './services/tiramis-callback.service';
import { TiramisCallbackBusinessUpdaterService } from './services/tiramis-callback-business-updater.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisCoverNoteEntity,
      TiramisPolicyEntity,
      TiramisCallbackDeadLetterEntity,
      TiramisCallbackReceiptEntity,
    ]),
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSubmissionsModule,
    TiramisPortalNotificationsModule,
    TiramisReinsuranceModule,
    TiramisPoliciesModule,
    TiramisClaimsModule,
  ],
  controllers: [
    TiramisCallbackController,
    TiramisInternalCallbackTestController,
  ],
  providers: [TiramisCallbackService, TiramisCallbackBusinessUpdaterService],
  exports: [TiramisCallbackService, TiramisCallbackBusinessUpdaterService],
})
export class TiramisCallbacksModule {}
