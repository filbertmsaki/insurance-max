import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisClaimsController } from './controllers/tiramis-claims.controller';
import { TiramisClaimAssessmentEntity } from './entities/tiramis-claim-assessment.entity';
import { TiramisClaimIntimationEntity } from './entities/tiramis-claim-intimation.entity';
import { TiramisClaimNotificationEntity } from './entities/tiramis-claim-notification.entity';
import { TiramisClaimPaymentEntity } from './entities/tiramis-claim-payment.entity';
import { TiramisClaimRejectionEntity } from './entities/tiramis-claim-rejection.entity';
import { TiramisClaimantEntity } from './entities/tiramis-claimant.entity';
import { TiramisDischargeVoucherEntity } from './entities/tiramis-discharge-voucher.entity';
import { TiramisClaimRepository } from './repositories/tiramis-claim.repository';
import { TiramisClaimPayloadService } from './services/tiramis-claim-payload.service';
import { TiramisClaimService } from './services/tiramis-claim.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisClaimNotificationEntity,
      TiramisClaimIntimationEntity,
      TiramisClaimAssessmentEntity,
      TiramisDischargeVoucherEntity,
      TiramisClaimPaymentEntity,
      TiramisClaimRejectionEntity,
      TiramisClaimantEntity,
    ]),
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSubmissionsModule,
  ],
  controllers: [TiramisClaimsController],
  providers: [
    TiramisClaimRepository,
    TiramisClaimPayloadService,
    TiramisClaimService,
  ],
  exports: [
    TiramisClaimRepository,
    TiramisClaimPayloadService,
    TiramisClaimService,
  ],
})
export class TiramisClaimsModule {}
