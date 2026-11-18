import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('finance_provider_events')
@Index(
  'UQ_finance_provider_event_entity',
  ['provider_code', 'provider_event_id'],
  {
    unique: true,
  },
)
export class FinanceProviderEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  provider_code: string;

  @Column({ type: 'varchar', length: 180 })
  provider_event_id: string;

  @Column({ type: 'varchar', length: 80 })
  event_type: string;

  @Column({ type: 'boolean', default: false })
  signature_valid: boolean;

  @Column({ type: 'varchar', length: 64 })
  payload_hash: string;

  @Column({ type: 'jsonb' })
  payload_redacted: Record<string, unknown>;

  @Column({ type: 'varchar', length: 30, default: 'RECEIVED' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  payment_transaction_id: string | null;

  @Column({ type: 'text', nullable: true })
  processing_error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  received_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at: Date | null;
}
