import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  RiskFieldDataType,
  RiskFieldOption,
  RiskFieldValidationRules,
} from '../risk-field.types';

/** A risk field a non-motor product (or one of its sub-classes) captures. */
@Entity('product_risk_fields')
@Index('IDX_product_risk_fields_company_product', ['company_id', 'product_id'])
export class ProductRiskField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  /** Null applies the field to every sub-class of the product. */
  @Column({ type: 'uuid', nullable: true })
  sub_class_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  field_key: string;

  @Column({ type: 'varchar', length: 150 })
  label: string;

  @Column({ type: 'varchar', length: 20 })
  data_type: RiskFieldDataType;

  @Column({ type: 'varchar', length: 80, nullable: true })
  section: string | null;

  @Column({ type: 'jsonb', nullable: true })
  options: RiskFieldOption[] | null;

  @Column({ type: 'boolean', default: false })
  is_required: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  help_text: string | null;

  @Column({ type: 'jsonb', nullable: true })
  validation_rules: RiskFieldValidationRules | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
