import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ReinsuranceClaimRecovery } from './reinsurance-claim-recovery.entity';

@Entity('reinsurance_recovery_receipts')
export class ReinsuranceRecoveryReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_recovery_id: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency_code: string;

  @Column({ type: 'timestamptz' })
  received_at: Date;

  @Column({ type: 'varchar', length: 150, nullable: true })
  reference: string | null;

  @Column({ type: 'uuid', nullable: true })
  recorded_by: string | null;

  @Column({ type: 'timestamptz' })
  recorded_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => ReinsuranceClaimRecovery, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'claim_recovery_id' })
  claim_recovery: ReinsuranceClaimRecovery;
}
