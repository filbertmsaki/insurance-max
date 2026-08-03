import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('product_performance_snapshots')
export class ProductPerformanceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id!: string | null;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ type: 'date' })
  snapshot_date: string;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  gross_written_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  earned_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  premium_collected: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  claims_incurred: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  claims_paid: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  outstanding_reserve: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  ceded_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  commissions: string;

  @Column({ type: 'int', default: 0 })
  policies_count: number;

  @Column({ type: 'int', default: 0 })
  claims_count: number;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  loss_ratio!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
