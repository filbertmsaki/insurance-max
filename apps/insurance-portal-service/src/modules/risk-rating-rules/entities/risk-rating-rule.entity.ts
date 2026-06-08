import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { RateType } from '@insurance-max/portal-shared/enums/rate-type.enum';
import { Company } from '../../companies/entities/company.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';

@Entity('risk_rating_rules')
@Unique('UQ_risk_rating_rules_company_risk_name', [
  'company_id',
  'risk_id',
  'rule_name',
])
@Index('IDX_risk_rating_rules_company_id', ['company_id'])
@Index('IDX_risk_rating_rules_risk_id', ['risk_id'])
@Index('IDX_risk_rating_rules_is_active', ['is_active'])
export class RiskRatingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  risk_id: string;

  @Column({ length: 150 })
  rule_name: string;

  @Column({
    type: 'varchar',
    enum: RateType,
    default: RateType.PERCENTAGE,
  })
  rate_type: RateType;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
    nullable: true,
    comment: 'Rate as percentage (e.g. 3.5 means 3.5%)',
  })
  percentage_rate: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  fixed_amount: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  per_unit_amount: number | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Factor code used as unit for per-unit rate types',
  })
  per_unit_factor_code: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  minimum_amount: number | null;

  @Column({
    type: 'text',
    nullable: true,
    comment:
      'Math formula using factor codes as variables, e.g. (sum_insured * 0.03)',
  })
  formula: string | null;

  @Column({ type: 'int', default: 1 })
  priority: number;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => InsuranceRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk;

  @OneToMany('RiskRuleCondition', 'rule')
  conditions: any[];
}
