import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisConfigModule } from '../config/tiramis-config.module';
import { TiramisMessagingModule } from '../messaging/tiramis-messaging.module';
import { TiramisSharedModule } from '../shared/tiramis-shared.module';
import { TiramisSubmissionsModule } from '../submissions/tiramis-submissions.module';
import { TiramisPoliciesController } from './controllers/tiramis-policies.controller';
import { TiramisPolicyCoverNoteEntity } from './entities/tiramis-policy-cover-note.entity';
import { TiramisPolicyEntity } from './entities/tiramis-policy.entity';
import { TiramisPolicyRepository } from './repositories/tiramis-policy.repository';
import { TiramisPolicyPayloadService } from './services/tiramis-policy-payload.service';
import { TiramisPolicyService } from './services/tiramis-policy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TiramisPolicyEntity,
      TiramisPolicyCoverNoteEntity,
    ]),
    TiramisConfigModule,
    TiramisMessagingModule,
    TiramisSharedModule,
    TiramisSubmissionsModule,
  ],
  controllers: [TiramisPoliciesController],
  providers: [
    TiramisPolicyRepository,
    TiramisPolicyPayloadService,
    TiramisPolicyService,
  ],
  exports: [
    TiramisPolicyRepository,
    TiramisPolicyPayloadService,
    TiramisPolicyService,
  ],
})
export class TiramisPoliciesModule {}
