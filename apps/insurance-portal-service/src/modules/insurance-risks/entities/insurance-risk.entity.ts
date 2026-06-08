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
import { Company } from '../../companies/entities/company.entity';
import { InsuranceProduct } from '../../insurance-products/entities/insurance-product.entity';
import { InsuranceSubClass } from '../../insurance-sub-classes/entities/insurance-sub-class.entity';

@Entity('insurance_risks')
@Unique('UQ_insurance_risks_company_code', ['company_id', 'risk_code'])
@Unique('UQ_insurance_risks_company_product_name', [
  'company_id',
  'product_id',
  'risk_name',
])
@Index('IDX_insurance_risks_company_id', ['company_id'])
@Index('IDX_insurance_risks_product_id', ['product_id'])
@Index('IDX_insurance_risks_sub_class_id', ['sub_class_id'])
@Index('IDX_insurance_risks_is_active', ['is_active'])
export class InsuranceRisk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  product_id: string;

  @Column({ type: 'varchar', nullable: true })
  sub_class_id: string | null;

  @Column({ length: 50 })
  risk_code: string;

  @Column({ length: 600 })
  risk_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

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

  @ManyToOne(() => InsuranceProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: InsuranceProduct;

  @ManyToOne(() => InsuranceSubClass, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sub_class_id' })
  sub_class: InsuranceSubClass | null;

  @OneToMany('RiskRequiredFactor', 'risk')
  required_factors: any[];

  @OneToMany('RiskRatingRule', 'risk')
  rating_rules: any[];
}
