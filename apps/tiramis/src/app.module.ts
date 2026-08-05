import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ServiceDatabaseConfig,
  SharedConfigModule,
  createTypeOrmOptions,
  loggerConfig,
} from '@insurance-max/shared-config';

import {
  ApiExceptionFilter,
  ApiLoggingInterceptor,
  ApiResponseInterceptor,
  ProductDefinitionModule,
  RequestContextModule,
  ServiceAuthGuard,
  ServiceAuthModule,
} from '@insurance-max/shared-kernel';

import applicationConfig from './config/application.config';
import tiramisAppConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { tiramisEnvValidationSchema } from './config/env.validation';
import transportConfig from './config/transport.config';
import { TiramisAccessAuditEntity } from './modules/audit/entities/tiramis-access-audit.entity';
import { TiramisAuditModule } from './modules/audit/tiramis-audit.module';
import { TiramisClientConfigurationEntity } from './modules/config/entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from './modules/config/entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from './modules/config/entities/tiramis-service-endpoint.entity';
import { TiramisClaimAssessmentEntity } from './modules/claims/entities/tiramis-claim-assessment.entity';
import { TiramisClaimIntimationEntity } from './modules/claims/entities/tiramis-claim-intimation.entity';
import { TiramisClaimNotificationEntity } from './modules/claims/entities/tiramis-claim-notification.entity';
import { TiramisClaimPaymentEntity } from './modules/claims/entities/tiramis-claim-payment.entity';
import { TiramisClaimRejectionEntity } from './modules/claims/entities/tiramis-claim-rejection.entity';
import { TiramisClaimantEntity } from './modules/claims/entities/tiramis-claimant.entity';
import { TiramisDischargeVoucherEntity } from './modules/claims/entities/tiramis-discharge-voucher.entity';
import { TiramisCoverNoteAddonEntity } from './modules/cover-notes/entities/tiramis-cover-note-addon.entity';
import { TiramisCoverNoteDiscountEntity } from './modules/cover-notes/entities/tiramis-cover-note-discount.entity';
import { TiramisCoverNoteEntity } from './modules/cover-notes/entities/tiramis-cover-note.entity';
import { TiramisCoverNoteRiskEntity } from './modules/cover-notes/entities/tiramis-cover-note-risk.entity';
import { TiramisCoverNoteTaxEntity } from './modules/cover-notes/entities/tiramis-cover-note-tax.entity';
import { TiramisPolicyHolderEntity } from './modules/cover-notes/entities/tiramis-policy-holder.entity';
import { TiramisInternalModule } from './modules/internal/tiramis-internal.module';
import { TiramisSubjectMatterEntity } from './modules/cover-notes/entities/tiramis-subject-matter.entity';
import { TiramisMotorDetailEntity } from './modules/motor/entities/tiramis-motor-detail.entity';
import { TiramisMotorFleetItemEntity } from './modules/motor/entities/tiramis-motor-fleet-item.entity';
import { TiramisMotorFleetEntity } from './modules/motor/entities/tiramis-motor-fleet.entity';
import { TiramisPolicyCoverNoteEntity } from './modules/policies/entities/tiramis-policy-cover-note.entity';
import { TiramisPolicyEntity } from './modules/policies/entities/tiramis-policy.entity';
import { TiramisReinsuranceEntity } from './modules/reinsurance/entities/tiramis-reinsurance.entity';
import { TiramisReinsuranceParticipantEntity } from './modules/reinsurance/entities/tiramis-reinsurance-participant.entity';
import { TiramisSubmissionAttemptEntity } from './modules/submissions/entities/tiramis-submission-attempt.entity';
import { TiramisSubmissionEventEntity } from './modules/submissions/entities/tiramis-submission-event.entity';
import { TiramisTransactionEntity } from './modules/submissions/entities/tiramis-transaction.entity';
import { TiramisVerificationRequestEntity } from './modules/verifications/entities/tiramis-verification-request.entity';
import { TiramisVerificationResponseEntity } from './modules/verifications/entities/tiramis-verification-response.entity';
import { TiramisModule } from './modules/tiramis.module';
import { AppController } from './app.controller';
import { HealthModule } from './health/health.module';
import { TiramisResponseInterceptor } from './common/interceptors/tiramis-response.interceptor';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RequestContextModule,
    ServiceAuthModule,
    ProductDefinitionModule,
    SharedConfigModule.forRoot({
      appName: 'tiramis',
      validationSchema: tiramisEnvValidationSchema,
      load: [
        applicationConfig,
        loggerConfig,
        tiramisAppConfig,
        transportConfig,
        databaseConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createTypeOrmOptions(
          configService.getOrThrow<ServiceDatabaseConfig>('tiramisDatabase'),
          {
            autoLoadEntities: true,
            entities: [
              TiramisClientConfigurationEntity,
              TiramisServiceEndpointEntity,
              TiramisResponseCodeEntity,
              TiramisTransactionEntity,
              TiramisSubmissionAttemptEntity,
              TiramisSubmissionEventEntity,
              TiramisCoverNoteEntity,
              TiramisCoverNoteRiskEntity,
              TiramisCoverNoteDiscountEntity,
              TiramisCoverNoteTaxEntity,
              TiramisSubjectMatterEntity,
              TiramisCoverNoteAddonEntity,
              TiramisPolicyHolderEntity,
              TiramisMotorFleetEntity,
              TiramisMotorFleetItemEntity,
              TiramisMotorDetailEntity,
              TiramisReinsuranceEntity,
              TiramisReinsuranceParticipantEntity,
              TiramisPolicyEntity,
              TiramisPolicyCoverNoteEntity,
              TiramisClaimNotificationEntity,
              TiramisClaimIntimationEntity,
              TiramisClaimAssessmentEntity,
              TiramisDischargeVoucherEntity,
              TiramisClaimPaymentEntity,
              TiramisClaimRejectionEntity,
              TiramisClaimantEntity,
              TiramisVerificationRequestEntity,
              TiramisVerificationResponseEntity,
              TiramisAccessAuditEntity,
            ],
          },
        ),
    }),
    TiramisModule,
    TiramisInternalModule,
    TiramisAuditModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },

    {
      provide: APP_GUARD,
      useClass: ServiceAuthGuard,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: TiramisResponseInterceptor,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: ApiLoggingInterceptor,
    },
  ],
})
export class AppModule {}
