import {
  AnalyticsDataFreshness,
  AnalyticsPeriodType,
  AnalyticsValueKind,
} from '@insurance-max/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('analytics_metric_values')
export class AnalyticsMetricValueEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 100 })
  metric_code: string;

  @Column({ type: 'varchar', length: 40 })
  period_type: AnalyticsPeriodType;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ type: 'numeric', precision: 24, scale: 8, nullable: true })
  value!: string | null;

  @Column({ type: 'varchar', length: 30 })
  value_kind: AnalyticsValueKind;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency_code!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  dimensions: Record<string, string>;

  @Column({ type: 'varchar', length: 64 })
  dimensions_hash: string;

  @Column({ type: 'int' })
  formula_version: number;

  @Column({ type: 'bigint', default: 0 })
  source_event_sequence: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  calculated_at: Date;

  @Column({ type: 'varchar', length: 30, default: 'CURRENT' })
  freshness: AnalyticsDataFreshness;

  @Column({ type: 'text', nullable: true })
  freshness_reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
