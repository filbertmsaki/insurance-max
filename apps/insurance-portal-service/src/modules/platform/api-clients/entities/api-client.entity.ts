import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ApiClientStatus,
  ApiClientType,
  DeploymentEnvironment,
} from '@insurance-max/contracts';

@Entity('api_clients')
@Index('UQ_api_clients_client_id', ['client_id'], { unique: true })
export class ApiClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  company_id: string | null;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  owner_user_id: string | null;

  @Column({ length: 100, unique: true })
  client_id: string;

  @Column({ length: 32, nullable: true })
  key_prefix: string | null;

  @Column({ length: 255, select: false })
  client_secret_hash: string;

  @Column({ length: 255, nullable: true, select: false })
  previous_secret_hash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  previous_secret_valid_until: Date | null;

  @Column({ type: 'simple-array', default: '' })
  scopes: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: ApiClientStatus.ACTIVE,
  })
  status: ApiClientStatus;

  @Column({
    type: 'varchar',
    length: 30,
    default: ApiClientType.TENANT_INTEGRATION,
  })
  client_type: ApiClientType;

  @Column({
    type: 'varchar',
    length: 20,
    default: DeploymentEnvironment.PRODUCTION,
  })
  environment: DeploymentEnvironment;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  ip_whitelist: string[];

  @Column({ type: 'int', nullable: true })
  rate_limit_per_minute: number | null;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  last_used_ip: string | null;

  @Column({ type: 'text', nullable: true })
  last_used_user_agent: string | null;

  @Column({ type: 'bigint', default: 0 })
  usage_count: string;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  rotated_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  compromised_at: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  revoked_reason: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
