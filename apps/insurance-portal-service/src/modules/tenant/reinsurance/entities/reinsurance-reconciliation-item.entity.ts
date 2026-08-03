import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reinsurance_reconciliation_items')
export class ReinsuranceReconciliationItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  counterparty_company_id: string;

  @Column({ type: 'varchar', length: 50 })
  resource_type: string;

  @Column({ type: 'uuid' })
  resource_id: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  expected_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  reported_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  variance_amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 30, default: 'OPEN' })
  status: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
