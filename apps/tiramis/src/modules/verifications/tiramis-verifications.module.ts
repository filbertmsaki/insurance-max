import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisVerificationsController } from './controllers/tiramis-verifications.controller';
import { TiramisVerificationRequestEntity } from './entities/tiramis-verification-request.entity';
import { TiramisVerificationResponseEntity } from './entities/tiramis-verification-response.entity';
import { TiramisVerificationRepository } from './repositories/tiramis-verification.repository';
import { TiramisVerificationPayloadService } from './services/tiramis-verification-payload.service';
import { TiramisVerificationService } from './services/tiramis-verification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisVerificationRequestEntity,
      TiramisVerificationResponseEntity,
    ]),
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSubmissionsModule,
  ],
  controllers: [TiramisVerificationsController],
  providers: [
    TiramisVerificationRepository,
    TiramisVerificationPayloadService,
    TiramisVerificationService,
  ],
  exports: [
    TiramisVerificationRepository,
    TiramisVerificationPayloadService,
    TiramisVerificationService,
  ],
})
export class TiramisVerificationsModule {}
