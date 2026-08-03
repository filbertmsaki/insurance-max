import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { InsuranceClaim } from './claim.entity';
import { TiramisTrackableClaimEntity } from './tiramis-trackable-claim.entity';

@Entity('claim_intimations')
export class ClaimIntimation extends TiramisTrackableClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 80 })
  claim_intimation_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claim_reference_number: string | null;

  @Column({ type: 'varchar', length: 100 })
  cover_note_reference_number: string;

  @Column({ type: 'timestamptz' })
  claim_intimation_date: Date;

  @Column({ type: 'varchar', length: 10 })
  currency_code: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  claim_estimated_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  claim_reserve_amount: string;

  @Column({ type: 'varchar', length: 100 })
  claim_reserve_method: string;

  @Column({ type: 'int', default: 1 })
  loss_assessment_option: number;

  @Column({ type: 'varchar', length: 180, nullable: true })
  assessor_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assessor_id_number: string | null;

  @Column({ type: 'int', nullable: true })
  assessor_id_type: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  claimants: Record<string, unknown>[];

  @Column({ type: 'varchar', length: 30, default: 'CREATED' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceClaim, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
