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
import { ProductLifecycleStatus } from '@insurance-max/contracts';
import { Company } from '../../../platform/companies/entities/company.entity';
import { InsuranceCategory } from '../../insurance-categories/entities/insurance-category.entity';
import { InsuranceBusinessLine } from '../../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceProductVersion } from './insurance-product-version.entity';

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
@Index('IDX_insurance_products_business_line', ['company_id', 'business_line'])
@Index('IDX_insurance_products_supports_fleet', [
  'company_id',
  'supports_fleet',
])
@Index(
  'uq_insurance_products_policy_numbering_code',
  ['company_id', 'policy_numbering_code'],
  { unique: true },
)
export class InsuranceProduct {
  @Column({ type: 'varchar', length: 12 })
  policy_numbering_code: string;

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

  @Column({
    type: 'varchar',
    length: 20,
    default: InsuranceBusinessLine.NON_MOTOR,
  })
  business_line: InsuranceBusinessLine;

  @Column({ type: 'boolean', default: false })
  supports_fleet: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tiramis_product_code: string | null;

  @Column({ default: true })
  is_active: boolean;

  @Column({
    type: 'varchar',
    length: 30,
    default: ProductLifecycleStatus.DRAFT,
  })
  lifecycle_status: ProductLifecycleStatus;

  @Column({ type: 'integer', default: 0 })
  latest_version_number: number;

  @Column({ type: 'uuid', nullable: true })
  current_version_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  code_locked_at: Date | null;

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

  @ManyToOne(() => InsuranceProductVersion, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'current_version_id' })
  current_version: InsuranceProductVersion | null;

  @OneToMany(() => InsuranceProductVersion, (version) => version.product)
  versions: InsuranceProductVersion[];
}
