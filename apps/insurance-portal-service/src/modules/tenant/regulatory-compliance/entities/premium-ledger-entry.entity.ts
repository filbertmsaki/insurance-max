import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  PremiumLedgerEntryStatus,
  PremiumLedgerEntryType,
} from '../enums/regulatory.enums';

@Entity('premium_ledger_entries')
export class PremiumLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_id!: string | null;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'enum', enum: PremiumLedgerEntryType })
  entry_type: PremiumLedgerEntryType;

  @Column({
    type: 'enum',
    enum: PremiumLedgerEntryStatus,
    default: PremiumLedgerEntryStatus.POSTED,
  })
  status: PremiumLedgerEntryStatus;

  @Column({ type: 'date' })
  transaction_date: string;

  @Column({ type: 'int' })
  period_year: number;

  @Column({ type: 'int' })
  period_month: number;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  gross_written_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  net_written_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  tax_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  commission_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  brokerage_amount: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  source_type!: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_id!: string | null;

  @Column({ type: 'text', nullable: true })
  narrative!: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
