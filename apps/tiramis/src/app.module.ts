import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ServiceDatabaseConfig,
  SharedConfigModule,
  appConfig,
  createTypeOrmOptions,
  loggerConfig,
} from '@insurance-max/shared-config';

import tiramisAppConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { tiramisEnvValidationSchema } from './config/env.validation';
import transportConfig from './config/transport.config';
import { TiramisClientConfigurationEntity } from './modules/config/entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from './modules/config/entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from './modules/config/entities/tiramis-service-endpoint.entity';
import { TiramisCoverNoteAddonEntity } from './modules/cover-notes/entities/tiramis-cover-note-addon.entity';
import { TiramisCoverNoteDiscountEntity } from './modules/cover-notes/entities/tiramis-cover-note-discount.entity';
import { TiramisCoverNoteEntity } from './modules/cover-notes/entities/tiramis-cover-note.entity';
import { TiramisCoverNoteRiskEntity } from './modules/cover-notes/entities/tiramis-cover-note-risk.entity';
import { TiramisCoverNoteTaxEntity } from './modules/cover-notes/entities/tiramis-cover-note-tax.entity';
import { TiramisPolicyHolderEntity } from './modules/cover-notes/entities/tiramis-policy-holder.entity';
import { TiramisSubjectMatterEntity } from './modules/cover-notes/entities/tiramis-subject-matter.entity';
import { TiramisMotorDetailEntity } from './modules/motor/entities/tiramis-motor-detail.entity';
import { TiramisMotorFleetItemEntity } from './modules/motor/entities/tiramis-motor-fleet-item.entity';
import { TiramisMotorFleetEntity } from './modules/motor/entities/tiramis-motor-fleet.entity';
import { TiramisReinsuranceEntity } from './modules/reinsurance/entities/tiramis-reinsurance.entity';
import { TiramisReinsuranceParticipantEntity } from './modules/reinsurance/entities/tiramis-reinsurance-participant.entity';
import { TiramisSubmissionAttemptEntity } from './modules/submissions/entities/tiramis-submission-attempt.entity';
import { TiramisSubmissionEventEntity } from './modules/submissions/entities/tiramis-submission-event.entity';
import { TiramisTransactionEntity } from './modules/submissions/entities/tiramis-transaction.entity';
import { TiramisModule } from './modules/tiramis.module';

@Module({
  imports: [
    SharedConfigModule.forRoot({
      appName: 'tiramis',
      validationSchema: tiramisEnvValidationSchema,
      load: [
        appConfig,
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
            ],
          },
        ),
    }),
    TiramisModule,
  ],
})
export class AppModule {}
