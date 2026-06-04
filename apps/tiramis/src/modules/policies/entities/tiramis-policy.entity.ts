import { BaseEntity } from '@insurance-max/persistence';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { TiramisSubmissionAttemptEntity } from '../../submissions/entities/tiramis-submission-attempt.entity';
import { TiramisTransactionEntity } from '../../submissions/entities/tiramis-transaction.entity';
import { TiramisPolicyCoverNoteEntity } from './tiramis-policy-cover-note.entity';

@Entity({ name: 'tiramis_policies' })
@Index(['requestId'])
@Index(['policyNumber'])
export class TiramisPolicyEntity extends BaseEntity {
  @Column({ name: 'transaction_id' })
  transactionId!: string;

  @ManyToOne(() => TiramisTransactionEntity)
  @JoinColumn({ name: 'transaction_id' })
  transaction!: TiramisTransactionEntity;

  @Column({ name: 'current_attempt_id', type: 'uuid', nullable: true })
  currentAttemptId?: string | null;

  @ManyToOne(() => TiramisSubmissionAttemptEntity, { nullable: true })
  @JoinColumn({ name: 'current_attempt_id' })
  currentAttempt?: TiramisSubmissionAttemptEntity | null;

  @Column({ name: 'request_id', length: 50 })
  requestId!: string;

  @Column({ name: 'company_code', length: 6 })
  companyCode!: string;

  @Column({ name: 'system_code', length: 50 })
  systemCode!: string;

  @Column({ name: 'callback_url', length: 250 })
  callbackUrl!: string;

  @Column({ name: 'insurer_company_code', length: 6 })
  insurerCompanyCode!: string;

  @Column({ name: 'policy_number', length: 50 })
  policyNumber!: string;

  @Column({ name: 'policy_operative_clause', type: 'text' })
  policyOperativeClause!: string;

  @Column({ name: 'special_conditions', type: 'text' })
  specialConditions!: string;

  @Column({ type: 'text', nullable: true })
  exclusions?: string | null;

  @OneToMany(
    () => TiramisPolicyCoverNoteEntity,
    (coverNote) => coverNote.policy,
    {
      cascade: true,
    },
  )
  coverNotes?: TiramisPolicyCoverNoteEntity[];
}
