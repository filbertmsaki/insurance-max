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

@Entity('insurance_categories')
@Unique('UQ_insurance_categories_company_code', ['company_id', 'code'])
@Unique('UQ_insurance_categories_company_name', ['company_id', 'name'])
@Index('IDX_insurance_categories_company_id', ['company_id'])
@Index('IDX_insurance_categories_is_active', ['is_active'])
export class InsuranceCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ length: 50 })
  code: string;

  @Column({ length: 150 })
  name: string;

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

  @OneToMany('InsuranceProduct', 'category')
  products: any[];
}
