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

  @Column({ length: 100, nullable: true })
  feature_code!: string | null;

  @Column({ length: 100, nullable: true })
  usage_metric_code!: string | null;

  @Column({ type: 'int', nullable: true })
  max_rows!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  default_filters!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
