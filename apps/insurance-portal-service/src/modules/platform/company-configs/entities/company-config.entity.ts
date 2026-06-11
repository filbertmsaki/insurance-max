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
import { Company } from '../../companies/entities/company.entity';

export enum ConfigValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

@Entity('company_configs')
@Unique('UQ_company_configs_company_key', ['company_id', 'config_key'])
@Index('IDX_company_configs_company_id', ['company_id'])
@Index('IDX_company_configs_is_active', ['is_active'])
export class CompanyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  company_id: string;

  @Column({ length: 100 })
  config_key: string;

  @Column({ type: 'simple-json' })
  config_value: unknown;

  @Column({ length: 20, default: ConfigValueType.STRING })
  value_type: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
