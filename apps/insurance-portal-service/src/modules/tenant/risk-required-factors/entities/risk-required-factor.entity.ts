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
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { RatingFactor } from '../../rating-factors/entities/rating-factor.entity';

@Entity('risk_required_factors')
@Unique('UQ_risk_required_factors_company_risk_factor', [
  'company_id',
  'risk_id',
  'factor_id',
])
@Index('IDX_risk_required_factors_company_id', ['company_id'])
@Index('IDX_risk_required_factors_risk_id', ['risk_id'])
@Index('IDX_risk_required_factors_factor_id', ['factor_id'])
export class RiskRequiredFactor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  risk_id: string;

  @Column({ type: 'varchar' })
  factor_id: string;

  @Column({ default: true })
  is_required: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

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

  @ManyToOne(() => InsuranceRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: InsuranceRisk;

  @ManyToOne(() => RatingFactor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'factor_id' })
  factor: RatingFactor;
}
