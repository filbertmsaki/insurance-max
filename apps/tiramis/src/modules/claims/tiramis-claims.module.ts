import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSharedModule } from '../shared/tiramis-shared.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisClaimController } from './controllers/tiramis-claim.controller';
import { TiramisClaimEntity } from './entities/tiramis-claim.entity';
import { TiramisDischargeVoucherEntity } from './entities/tiramis-discharge-voucher.entity';
import { TiramisClaimRepository } from './repositories/tiramis-claim.repository';
import { TiramisDischargeVoucherRepository } from './repositories/tiramis-discharge-voucher.repository';
import { TiramisClaimPayloadService } from './services/tiramis-claim-payload.service';
import { TiramisClaimService } from './services/tiramis-claim.service';
import { TiramisDischargeVoucherController } from './controllers/tiramis-discharge-voucher.controller';
import { TiramisDischargeVoucherPayloadService } from './services/tiramis-discharge-voucher-payload.service';
import { TiramisDischargeVoucherService } from './services/tiramis-discharge-voucher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisClaimEntity,
      TiramisDischargeVoucherEntity,
    ]),
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSubmissionsModule,
    TiramisSharedModule,
  ],
  controllers: [TiramisClaimController, TiramisDischargeVoucherController],
  providers: [
    TiramisClaimRepository,
    TiramisClaimPayloadService,
    TiramisClaimService,
    TiramisDischargeVoucherRepository,
    TiramisDischargeVoucherPayloadService,
    TiramisDischargeVoucherService,
  ],
  exports: [
    TiramisClaimRepository,
    TiramisClaimPayloadService,
    TiramisClaimService,
    TiramisDischargeVoucherRepository,
    TiramisDischargeVoucherPayloadService,
    TiramisDischargeVoucherService,
  ],
})
export class TiramisClaimsModule {}
