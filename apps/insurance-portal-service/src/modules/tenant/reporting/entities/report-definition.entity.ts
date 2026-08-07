import {
  ReportCategory,
  ReportParameterDefinition,
  ReportSensitivity,
} from '@insurance-max/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReportFormat } from '../enums/reporting.enums';

@Entity('report_definitions')
export class ReportDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80, unique: true })
  code: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 80 })
  generator_key: string;

  @Column({ type: 'enum', enum: ReportFormat })
  default_format: ReportFormat;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  supported_formats!: ReportFormat[];

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  feature_code!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  usage_metric_code!: string | null;

  @Column({ type: 'int', nullable: true })
  max_rows!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  default_filters!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  category!: ReportCategory | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'varchar', length: 40, default: 'INTERNAL' })
  sensitivity!: ReportSensitivity;

  @Column({ type: 'varchar', length: 150, nullable: true })
  permission!: string | null;

  @Column({ type: 'int', nullable: true })
  maximum_rows!: number | null;

  @Column({ type: 'boolean', default: false })
  asynchronous_only!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  parameters!: ReportParameterDefinition[];

  @Column({ type: 'varchar', length: 64, nullable: true })
  definition_hash!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
