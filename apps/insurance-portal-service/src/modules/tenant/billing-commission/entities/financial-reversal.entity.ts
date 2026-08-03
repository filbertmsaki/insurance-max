import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('financial_reversals')
@Index('UQ_financial_reversal_no', ['company_id', 'reversal_no'], {
  unique: true,
})
export class FinancialReversal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 60 })
  reversal_no: string;

  @Column({ type: 'varchar', length: 50 })
  resource_type: string;

  @Column({ type: 'uuid' })
  resource_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  original_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  reversal_amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
