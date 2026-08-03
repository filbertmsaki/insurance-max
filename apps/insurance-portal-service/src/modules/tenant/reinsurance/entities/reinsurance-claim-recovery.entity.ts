import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReinsuranceRecoveryStatus } from '../enums/reinsurance.enums';

@Entity('reinsurance_claim_recoveries')
export class ReinsuranceClaimRecovery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid' })
  cession_id: string;

  @Column({ type: 'uuid' })
  cession_participant_id: string;

  @Column({ type: 'uuid' })
  participant_company_id: string;

  @Column({ type: 'varchar', length: 60 })
  recovery_no: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  gross_claim_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 10 })
  participant_share_percent: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  expected_recovery: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  admitted_recovery: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  received_recovery: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  outstanding_recovery: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: ReinsuranceRecoveryStatus.EXPECTED,
  })
  status: ReinsuranceRecoveryStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  admitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  admitted_at: Date | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
