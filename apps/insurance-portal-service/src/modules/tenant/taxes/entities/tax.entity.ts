import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';

@Entity('taxes')
@Index('UQ_taxes_company_code', ['company_id', 'tax_code'], { unique: true })
export class Tax {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) company_id: string;
  @Column({ length: 50 }) tax_code: string;
  @Column({ length: 150 }) tax_name: string;
  @Column({ type: 'numeric', precision: 18, scale: 10 }) tax_rate: string;
  @Column({ default: true }) is_active: boolean;
  @Column({ default: false })
  is_default: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
