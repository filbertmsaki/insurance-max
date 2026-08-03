import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('saas_plan_meter_rates')
export class SaasPlanMeterRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ length: 100 })
  metric_code: string;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  included_quantity: string;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 1 })
  billing_unit: string;

  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  unit_price: string;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
