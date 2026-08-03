import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RegulatoryFrequency } from '../enums/regulatory.enums';

@Entity('company_regulatory_profiles')
export class CompanyRegulatoryProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  company_id: string;

  @Column({ type: 'int', default: 1 })
  financial_year_start_month: number;

  @Column({ length: 120, default: 'TIRA' })
  regulator_name: string;

  @Column({ length: 40, nullable: true })
  regulator_code!: string | null;

  @Column({ length: 60, default: 'Africa/Dar_es_Salaam' })
  timezone: string;

  @Column({
    type: 'enum',
    enum: RegulatoryFrequency,
    default: RegulatoryFrequency.MONTHLY,
  })
  levy_frequency: RegulatoryFrequency;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 1.5 })
  levy_rate: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
