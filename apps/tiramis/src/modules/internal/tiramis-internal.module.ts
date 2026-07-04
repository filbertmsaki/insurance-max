import { Module } from '@nestjs/common';

import { TiramisClaimsModule } from '../claims/tiramis-claims.module';
import { TiramisCoverNotesModule } from '../cover-notes/tiramis-cover-notes.module';
import { TiramisMotorModule } from '../motor/tiramis-motor.module';
import { TiramisPoliciesModule } from '../policies/tiramis-policies.module';
import { TiramisReinsuranceModule } from '../reinsurance/tiramis-reinsurance.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisInternalController } from './tiramis-internal.controller';

@Module({
  imports: [
    TiramisCoverNotesModule,
    TiramisMotorModule,
    TiramisReinsuranceModule,
    TiramisPoliciesModule,
    TiramisClaimsModule,
    TiramisSubmissionsModule,
  ],
  controllers: [TiramisInternalController],
})
export class TiramisInternalModule {}
