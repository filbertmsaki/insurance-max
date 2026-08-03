import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TiramisTrackableClaimEntity } from './tiramis-trackable-claim.entity';

@Entity('claim_rejections')
export class ClaimRejection extends TiramisTrackableClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 80 })
  claim_rejection_number: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claim_reference_number: string | null;

  @Column({ type: 'varchar', length: 100 })
  cover_note_reference_number: string;

  @Column({ type: 'timestamptz' })
  rejection_date: Date;

  @Column({ type: 'text' })
  rejection_reason: string;

  @Column({ type: 'varchar', length: 30, default: 'APPROVED' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
