import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimReserveStatus } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';

@Entity('claim_reserves')
export class ClaimReserve {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 60 })
  reserve_no: string;

  @Column({ type: 'varchar', length: 50 })
  reserve_type: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 30, default: ClaimReserveStatus.DRAFT })
  status: ClaimReserveStatus;

  @Column({ type: 'timestamptz' })
  effective_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  submitted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejected_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  released_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  released_at: Date | null;

  @Column({ type: 'text', nullable: true })
  release_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  supersedes_reserve_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceClaim, (claim) => claim.reserves, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
