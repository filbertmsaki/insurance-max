import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimRecoveryStatus, ClaimRecoveryType } from '../enums/claim.enums';

@Entity('claim_recoveries')
export class ClaimRecovery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 80 })
  recovery_no: string;

  @Column({ type: 'varchar', length: 40 })
  recovery_type: ClaimRecoveryType;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  expected_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  received_amount: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: ClaimRecoveryStatus.EXPECTED,
  })
  status: ClaimRecoveryStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
