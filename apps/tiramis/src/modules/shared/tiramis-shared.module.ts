import { Module } from '@nestjs/common';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisBusinessSubmissionService } from './services/tiramis-business-submission.service';
import { TiramisPayloadValidationService } from './services/tiramis-payload-validation.service';
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
  ],
  exports: [
    TiramisPayloadValidationService,
    TiramisBusinessSubmissionService,
    TiramisProductWordingValidationService,
  ],
})
export class TiramisSharedModule {}
