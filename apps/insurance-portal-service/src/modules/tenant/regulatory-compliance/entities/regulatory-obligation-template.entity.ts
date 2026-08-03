import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  RegulatoryDueRuleType,
  RegulatoryFrequency,
  RegulatoryOffsetUnit,
} from '../enums/regulatory.enums';

@Entity('regulatory_obligation_templates')
export class RegulatoryObligationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80, unique: true })
  code: string;

  @Column({ length: 160 })
  name: string;

  @Column({ length: 50 })
  obligation_type: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  applicable_company_types!: string[];

  @Column({ type: 'enum', enum: RegulatoryFrequency })
  frequency: RegulatoryFrequency;

  @Column({ type: 'enum', enum: RegulatoryDueRuleType })
  due_rule_type: RegulatoryDueRuleType;

  @Column({ type: 'enum', enum: RegulatoryOffsetUnit, nullable: true })
  offset_unit!: RegulatoryOffsetUnit | null;

  @Column({ type: 'int', nullable: true })
  offset_value!: number | null;

  @Column({ type: 'int', nullable: true })
  fixed_month!: number | null;

  @Column({ type: 'int', nullable: true })
  fixed_day!: number | null;

  @Column({ type: 'date', nullable: true })
  effective_from!: string | null;

  @Column({ type: 'date', nullable: true })
  effective_to!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
