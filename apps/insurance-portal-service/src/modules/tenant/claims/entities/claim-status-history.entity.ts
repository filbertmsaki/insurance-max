import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ClaimStatus } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';

@Entity('claim_status_history')
export class ClaimStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  old_status: ClaimStatus | null;

  @Column({ type: 'varchar', length: 30 })
  new_status: ClaimStatus;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  changed_by: string | null;

  @Column({ type: 'timestamptz' })
  changed_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => InsuranceClaim, (claim) => claim.status_history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
