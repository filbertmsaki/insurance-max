import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { RiskData, RiskFieldDefinition } from '../risk-field.types';

/**
 * Non-motor risk data captured for a quotation, against the product's risk
 * schema at the time (`schema_snapshot`), so later schema edits never change
 * what was quoted.
 */
@Entity('quotation_non_motor_details')
export class QuotationNonMotorDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', unique: true })
  quotation_id: string;

  @Column({ type: 'uuid', nullable: true })
  product_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  sub_class_id: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  risk_data: RiskData;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  schema_snapshot: RiskFieldDefinition[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  risk_location: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  limit_of_liability: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
