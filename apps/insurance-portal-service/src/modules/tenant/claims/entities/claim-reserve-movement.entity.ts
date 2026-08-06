import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { ClaimReserveMovementType } from '@insurance-max/contracts';

import { InsuranceClaim } from './claim.entity';
import { ClaimReserve } from './claim-reserve.entity';

@Entity('claim_reserve_movements')
@Unique('UQ_claim_reserve_movement_no', ['company_id', 'movement_no'])
@Unique('UQ_claim_reserve_source_event', ['company_id', 'source_event_id'])
export class ClaimReserveMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'uuid' })
  reserve_id: string;

  @Column({ type: 'varchar', length: 80 })
  movement_no: string;

  @Column({ type: 'varchar', length: 30 })
  movement_type: ClaimReserveMovementType;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  signed_amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency_code: string;

  @Column({ type: 'timestamptz' })
  effective_at: Date;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 180 })
  source_event_id: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => InsuranceClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;

  @ManyToOne(() => ClaimReserve, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reserve_id' })
  reserve: ClaimReserve;
}
