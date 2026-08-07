import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('regulatory_ledger_entries')
export class RegulatoryLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 80 })
  source_type: string;

  @Column({ type: 'uuid' })
  source_id: string;

  @Column({ type: 'varchar', length: 180 })
  source_event_key: string;

  @Column({ type: 'varchar', length: 40 })
  entry_type: string;

  @Column({ type: 'uuid', nullable: true })
  authority_profile_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  obligation_instance_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  regulatory_return_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  levy_assessment_id!: string | null;

  @Column({ type: 'date', nullable: true })
  period_start!: string | null;

  @Column({ type: 'date', nullable: true })
  period_end!: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency_code!: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  debit_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  credit_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true })
  running_balance!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  entry_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  entry_snapshot_hash: string;

  @Column({ type: 'uuid', nullable: true })
  reversal_of_entry_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
