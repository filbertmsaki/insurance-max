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

import { Company } from '../../platform/companies/entities/company.entity';

/**
 * A company's TIRA settings in the portal: company-specific values only. The
 * TIRA system identity (client code/key, system code/name, certificates, base
 * and callback URLs) is platform-wide and owned by TIRAMIS (environment).
 */
@Entity({ name: 'tiramis_company_configurations' })
@Unique('UQ_tiramis_company_config_company_environment', [
  'companyId',
  'environment',
])
@Index('IDX_tiramis_company_config_company_id', ['companyId'])
@Index('IDX_tiramis_company_config_environment', ['environment'])
@Index('IDX_tiramis_company_config_company_code', ['companyCode'])
export class TiramisCompanyConfigurationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'environment', type: 'varchar', length: 20, default: 'test' })
  environment!: string;

  @Column({ name: 'company_code', type: 'varchar', length: 30 })
  companyCode!: string;

  @Column({
    name: 'company_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  companyName!: string | null;

  @Column({
    name: 'insurer_company_code',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  insurerCompanyCode!: string | null;

  @Column({
    name: 'insurer_company_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  insurerCompanyName!: string | null;

  @Column({
    name: 'service_api_key_encrypted',
    type: 'text',
    nullable: true,
    select: false,
  })
  serviceApiKeyEncrypted!: string | null;

  @Column({ name: 'notification_events', type: 'jsonb', nullable: true })
  notificationEvents!: string[] | null;

  @Column({ name: 'integration_permissions', type: 'jsonb', nullable: true })
  integrationPermissions!: string[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({
    name: 'validation_status',
    type: 'varchar',
    length: 30,
    default: 'NOT_VALIDATED',
  })
  validationStatus!: 'NOT_VALIDATED' | 'VALID' | 'INVALID';

  @Column({
    name: 'validated_at',
    type: 'timestamptz',
    nullable: true,
  })
  validatedAt!: Date | null;

  @Column({
    name: 'validation_message',
    type: 'text',
    nullable: true,
  })
  validationMessage!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;
}
