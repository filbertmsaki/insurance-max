import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

import {
  createDataSourceOptions,
  readDatabaseEnv,
} from '@insurance-max/shared-config';

import { TiramisClientConfigurationEntity } from '../modules/config/entities/tiramis-client-configuration.entity';
import { TiramisResponseCodeEntity } from '../modules/config/entities/tiramis-response-code.entity';
import { TiramisServiceEndpointEntity } from '../modules/config/entities/tiramis-service-endpoint.entity';
import { TiramisClaimAssessmentEntity } from '../modules/claims/entities/tiramis-claim-assessment.entity';
import { TiramisClaimIntimationEntity } from '../modules/claims/entities/tiramis-claim-intimation.entity';
import { TiramisClaimNotificationEntity } from '../modules/claims/entities/tiramis-claim-notification.entity';
import { TiramisClaimPaymentEntity } from '../modules/claims/entities/tiramis-claim-payment.entity';
import { TiramisClaimRejectionEntity } from '../modules/claims/entities/tiramis-claim-rejection.entity';
import { TiramisClaimantEntity } from '../modules/claims/entities/tiramis-claimant.entity';
import { TiramisClaimEntity } from '../modules/claims/entities/tiramis-claim.entity';
import { TiramisDischargeVoucherEntity } from '../modules/claims/entities/tiramis-discharge-voucher.entity';
import { TiramisCoverNoteAddonEntity } from '../modules/cover-notes/entities/tiramis-cover-note-addon.entity';
import { TiramisCoverNoteDiscountEntity } from '../modules/cover-notes/entities/tiramis-cover-note-discount.entity';
import { TiramisCoverNoteEntity } from '../modules/cover-notes/entities/tiramis-cover-note.entity';
import { TiramisCoverNoteRiskEntity } from '../modules/cover-notes/entities/tiramis-cover-note-risk.entity';
import { TiramisCoverNoteTaxEntity } from '../modules/cover-notes/entities/tiramis-cover-note-tax.entity';
import { TiramisPolicyHolderEntity } from '../modules/cover-notes/entities/tiramis-policy-holder.entity';
import { TiramisSubjectMatterEntity } from '../modules/cover-notes/entities/tiramis-subject-matter.entity';
import { TiramisMotorDetailEntity } from '../modules/motor/entities/tiramis-motor-detail.entity';
import { TiramisMotorFleetItemEntity } from '../modules/motor/entities/tiramis-motor-fleet-item.entity';
import { TiramisMotorFleetEntity } from '../modules/motor/entities/tiramis-motor-fleet.entity';
import { TiramisPolicyCoverNoteEntity } from '../modules/policies/entities/tiramis-policy-cover-note.entity';
import { TiramisPolicyEntity } from '../modules/policies/entities/tiramis-policy.entity';
import { TiramisReinsuranceEntity } from '../modules/reinsurance/entities/tiramis-reinsurance.entity';
import { TiramisReinsuranceParticipantEntity } from '../modules/reinsurance/entities/tiramis-reinsurance-participant.entity';
import { TiramisSubmissionAttemptEntity } from '../modules/submissions/entities/tiramis-submission-attempt.entity';
import { TiramisSubmissionEventEntity } from '../modules/submissions/entities/tiramis-submission-event.entity';
import { TiramisTransactionEntity } from '../modules/submissions/entities/tiramis-transaction.entity';
import { TiramisVerificationRequestEntity } from '../modules/verifications/entities/tiramis-verification-request.entity';
import { TiramisVerificationResponseEntity } from '../modules/verifications/entities/tiramis-verification-response.entity';

const environment =
  process.env.NODE_ENV || process.env.APP_ENV || 'development';
const envPaths = [
  join(process.cwd(), 'apps', 'tiramis', `.env.${environment}`),
  join(process.cwd(), 'apps', 'tiramis', '.env'),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: true });
  }
}

const database = readDatabaseEnv('DB', {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'alliance_db',
  synchronize: false,
  logging: true,
  ssl: false,
});

export default new DataSource(
  createDataSourceOptions(database, {
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
      TiramisClaimEntity,
      TiramisVerificationRequestEntity,
      TiramisVerificationResponseEntity,
    ],
    migrations: ['apps/tiramis/src/database/migrations/*.{ts,js}'],
  }),
);
