import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimantType } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';

@Entity('claim_claimants')
export class ClaimClaimant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'varchar', length: 40 })
  claimant_type: ClaimantType;

  @Column({ type: 'boolean', default: false })
  is_primary: boolean;

  @Column({ type: 'varchar', length: 180 })
  full_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  identification_type: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  identification_number: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_claimed: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_approved: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_paid: string;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => InsuranceClaim, (claim) => claim.claimants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
