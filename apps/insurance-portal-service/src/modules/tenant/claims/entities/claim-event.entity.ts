import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ClaimEventActorType } from '../enums/claim.enums';
import { InsuranceClaim } from './claim.entity';

/**
 * Append-only claim timeline. `source_event_id` is unique so callbacks and
 * retried operations cannot record the same event twice.
 */
@Entity('claim_events')
@Index('IDX_claim_events_claim_created', ['claim_id', 'created_at'])
export class ClaimEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  claim_id: string;

  @Column({ type: 'varchar', length: 60 })
  event_type: string;

  @Column({ type: 'varchar', length: 20, default: ClaimEventActorType.USER })
  actor_type: ClaimEventActorType;

  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  previous_status: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  new_status: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  subject_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  subject_id: string | null;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 200, nullable: true, unique: true })
  source_event_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => InsuranceClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claim_id' })
  claim: InsuranceClaim;
}
