import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReinsuranceTreaty } from './reinsurance-treaty.entity';

@Entity('reinsurance_treaty_sections')
export class ReinsuranceTreatySection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  treaty_id: string;

  @Column({ type: 'varchar', length: 30 })
  section_no: string;

  @Column({ type: 'varchar', length: 180 })
  section_name: string;

  @Column({ type: 'uuid', nullable: true })
  category_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  product_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  sub_class_id: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  retention_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  cession_limit: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  treaty_limit: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0 })
  line_count: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  rate_on_line: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  minimum_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  maximum_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  ceding_commission_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  brokerage_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  profit_commission_rate: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  event_limit: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  aggregate_limit: string;

  @Column({ type: 'int', default: 1 })
  reinsurance_category: number;

  @Column({ type: 'int', default: 1 })
  reinsurance_form: number;

  @Column({ type: 'int', default: 1 })
  reinsurance_type: number;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => ReinsuranceTreaty, (treaty) => treaty.sections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'treaty_id' })
  treaty: ReinsuranceTreaty;
}
