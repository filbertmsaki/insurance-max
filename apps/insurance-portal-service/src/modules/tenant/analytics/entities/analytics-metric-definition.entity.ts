import {
  AnalyticsPeriodType,
  MetricAggregationType,
  MetricValueType,
} from '@insurance-max/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('analytics_metric_definitions')
export class AnalyticsMetricDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 80 })
  category: string;

  @Column({ type: 'varchar', length: 40 })
  value_type: MetricValueType;

  @Column({ type: 'varchar', length: 40 })
  aggregation_type: MetricAggregationType;

  @Column({ type: 'int' })
  formula_version: number;

  @Column({ type: 'text' })
  formula_description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  numerator_metric_code!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  denominator_metric_code!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  supported_dimensions!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  supported_periods!: AnalyticsPeriodType[];

  @Column({ type: 'varchar', length: 150 })
  permission: string;

  @Column({ type: 'boolean', default: false })
  sensitive: boolean;

  @Column({ type: 'boolean', default: false })
  target_supported: boolean;

  @Column({ type: 'boolean', default: false })
  forecast_supported: boolean;

  @Column({ type: 'boolean', default: false })
  benchmark_supported: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
