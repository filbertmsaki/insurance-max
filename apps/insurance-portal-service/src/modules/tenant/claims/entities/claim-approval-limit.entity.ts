import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClaimApprovalType } from '../enums/claim.enums';

/**
 * One band of the claims authority matrix: a role (or a named user) may
 * approve `approval_type` subjects whose amount falls within
 * [min_amount, max_amount] at the given level. Optional product, class and
 * branch narrow the band.
 */
@Entity('claim_approval_limits')
@Index('IDX_claim_approval_limits_lookup', [
  'company_id',
  'approval_type',
  'is_active',
  'level',
])
export class ClaimApprovalLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 30 })
  approval_type: ClaimApprovalType;

  @Column({ type: 'smallint' })
  level: number;

  @Column({ type: 'uuid', nullable: true })
  role_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  insurance_category_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  product_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  min_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  max_amount: string | null;

  @Column({ type: 'varchar', length: 3, default: 'TZS' })
  currency_code: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
