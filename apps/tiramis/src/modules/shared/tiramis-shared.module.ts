import { Module } from '@nestjs/common';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisBusinessSubmissionService } from './services/tiramis-business-submission.service';
import { TiramisPayloadValidationService } from './services/tiramis-payload-validation.service';
import { TiramisCoverPeriodService } from './services/tiramis-cover-period.service';
import { TiramisProductWordingValidationService } from '../../common/services/tiramis-product-wording-validation.service';

@Module({
  imports: [
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSubmissionsModule,
  ],
  providers: [
    TiramisPayloadValidationService,
    TiramisBusinessSubmissionService,
    TiramisProductWordingValidationService,
    TiramisCoverPeriodService,
  ],
  exports: [
    TiramisPayloadValidationService,
    TiramisBusinessSubmissionService,
    TiramisProductWordingValidationService,
    TiramisCoverPeriodService,
  ],
})
export class TiramisSharedModule {}
