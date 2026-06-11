import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ConditionOperator } from '@insurance-max/portal-shared/enums/condition-operator.enum';
import { LogicalOperator } from '@insurance-max/portal-shared/enums/logical-operator.enum';
import { Company } from '../../../platform/companies/entities/company.entity';
import { RiskRatingRule } from '../../risk-rating-rules/entities/risk-rating-rule.entity';

@Entity('risk_rule_conditions')
@Unique('UQ_risk_rule_conditions_rule_factor_op_from_to', [
  'company_id',
  'rule_id',
  'factor_code',
  'operator',
  'value_from',
  'value_to',
])
@Index('IDX_risk_rule_conditions_company_id', ['company_id'])
@Index('IDX_risk_rule_conditions_rule_id', ['rule_id'])
export class RiskRuleCondition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  rule_id: string;

  @Column({ length: 100, comment: 'References RatingFactor.code' })
  factor_code: string;

  @Column({
    type: 'varchar',
    enum: ConditionOperator,
    default: ConditionOperator.EQUALS,
  })
  operator: ConditionOperator;

  @Column({ type: 'varchar', length: 255, nullable: true })
  value_from: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  value_to: string | null;

  @Column({
    type: 'varchar',
    enum: LogicalOperator,
    default: LogicalOperator.AND,
    comment: 'Logical operator combining this condition with the next',
  })
  logical_operator: LogicalOperator;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => RiskRatingRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: RiskRatingRule;
}
