import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tiramis_api_keys' })
@Index('IDX_tiramis_api_keys_service_name', ['serviceName'])
@Index('IDX_tiramis_api_keys_api_key', ['apiKey'], { unique: true })
export class TiramisApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'api_key', type: 'varchar', length: 255, select: false })
  apiKey!: string;

  @Column({ name: 'key_prefix', type: 'varchar', length: 24, nullable: true })
  keyPrefix!: string | null;

  @Column({ name: 'service_name', type: 'varchar', length: 120 })
  serviceName!: string;

  @Column({
    name: 'tenant_company_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  tenantCompanyCode!: string | null;

  @Column({
    name: 'tenant_system_code',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  tenantSystemCode!: string | null;

  @Column({
    name: 'tenant_environment',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  tenantEnvironment!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  scopes!: string[] | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
