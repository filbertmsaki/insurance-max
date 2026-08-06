import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { ClaimRegulatoryOperationType } from '@insurance-max/contracts';

import { ClaimRegulatoryStatus } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';

@Entity('claim_regulatory_operations')
@Unique('UQ_claim_regulatory_source', ['operation_type', 'source_record_id'])
@Unique('UQ_claim_regulatory_sequence', [
  'claim_id',
  'operation_type',
  'sequence_number',
])
export class ClaimRegulatoryOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 40 })
  operation_type: ClaimRegulatoryOperationType;

  @Column({ type: 'uuid' })
  source_record_id: string;

  @Column({ type: 'varchar', length: 100 })
  source_record_number: string;

  @Column({ type: 'int' })
  sequence_number: number;

  @Column({
    type: 'varchar',
    length: 40,
    default: ClaimRegulatoryStatus.NOT_SUBMITTED,
  })
  status: ClaimRegulatoryStatus;

  @Column({ type: 'uuid', nullable: true })
  tiramis_tracking_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_transaction_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tiramis_request_id: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  regulatory_reference: string | null;

  @Column({ type: 'jsonb' })
  request_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  request_snapshot_hash: string;

  @Column({ type: 'jsonb', nullable: true })
  response_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  response_snapshot_hash: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  acknowledgement_code: string | null;

  @Column({ type: 'text', nullable: true })
  acknowledgement_message: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  final_response_code: string | null;

  @Column({ type: 'text', nullable: true })
  final_response_message: string | null;

  @Column({ type: 'boolean', nullable: true })
  signature_verified: boolean | null;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledged_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => InsuranceClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
