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
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceCategory } from '../../insurance-categories/entities/insurance-category.entity';

@Entity('insurance_products')
@Unique('UQ_insurance_products_company_code', ['company_id', 'product_code'])
@Unique('UQ_insurance_products_company_category_name', [
  'company_id',
  'category_id',
  'product_name',
])
@Index('IDX_insurance_products_company_id', ['company_id'])
@Index('IDX_insurance_products_category_id', ['category_id'])
@Index('IDX_insurance_products_is_active', ['is_active'])
export class InsuranceProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ type: 'varchar' })
  category_id: string;

  @Column({ length: 50 })
  product_code: string;

  @Column({ length: 150 })
  product_name: string;

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

  @ManyToOne(() => InsuranceCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: InsuranceCategory;

  @OneToMany('InsuranceSubClass', 'product')
  sub_classes: any[];

  @OneToMany('InsuranceRisk', 'product')
  risks: any[];
}
