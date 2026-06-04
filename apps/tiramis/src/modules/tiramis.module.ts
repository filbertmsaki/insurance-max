import { Module } from '@nestjs/common';

import { TiramisCallbacksModule } from './callbacks/tiramis-callbacks.module';
import { TiramisClaimsModule } from './claims/tiramis-claims.module';
import { TiramisConfigModule } from './config/tiramis-config.module';
import { TiramisCoverNotesModule } from './cover-notes/tiramis-cover-notes.module';
import { TiramisMessagingModule } from './messaging/tiramis-messaging.module';
import { TiramisMotorModule } from './motor/tiramis-motor.module';
import { TiramisPoliciesModule } from './policies/tiramis-policies.module';
import { TiramisReinsuranceModule } from './reinsurance/tiramis-reinsurance.module';
import { TiramisSubmissionsModule } from './submissions/tiramis-submissions.module';
import { TiramisVerificationsModule } from './verifications/tiramis-verifications.module';

@Module({
  imports: [
    TiramisConfigModule,
    TiramisSubmissionsModule,
    TiramisMessagingModule,
    TiramisCoverNotesModule,
    TiramisMotorModule,
    TiramisReinsuranceModule,
    TiramisPoliciesModule,
    TiramisClaimsModule,
    TiramisVerificationsModule,
    TiramisCallbacksModule,
  ],
  exports: [
    TiramisCoverNotesModule,
    TiramisMotorModule,
    TiramisReinsuranceModule,
    TiramisPoliciesModule,
    TiramisClaimsModule,
    TiramisVerificationsModule,
    TiramisCallbacksModule,
  ],
})
export class TiramisModule {}
