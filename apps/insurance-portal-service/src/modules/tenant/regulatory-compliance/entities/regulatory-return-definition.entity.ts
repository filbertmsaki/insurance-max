import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RegulatoryFrequency } from '../enums/regulatory.enums';

@Entity('regulatory_return_definitions')
export class RegulatoryReturnDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80, unique: true })
  code: string;

  @Column({ length: 160 })
  name: string;

  @Column({ length: 80 })
  generator_key: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  applicable_company_types!: string[];

  @Column({ type: 'enum', enum: RegulatoryFrequency })
  frequency: RegulatoryFrequency;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ default: false })
  is_premium_levy: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
