import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TiramisEnvironmentName = 'local' | 'uat' | 'production';

/**
 * Platform-wide TIRAMIS integration settings (a single row, id 'platform'),
 * managed from Platform → TIRAMIS Integration. Every linked company uses the
 * active environment from TIRA_ENV and the platform's credentials; companies
 * configure nothing. The TIRA identity, certificates and webhook key live in
 * TIRAMIS.
 */
@Entity({ name: 'tiramis_platform_settings' })
export class TiramisPlatformSettingsEntity {
  @PrimaryColumn({ type: 'varchar', length: 20, default: 'platform' })
  id!: string;

  @Column({
    name: 'active_environment',
    type: 'varchar',
    length: 10,
    default: 'local',
  })
  activeEnvironment!: TiramisEnvironmentName;

  /** Platform key the portal presents to TIRAMIS for this server's TIRA_ENV. */
  @Column({
    name: 'service_api_key_encrypted',
    type: 'text',
    nullable: true,
    select: false,
  })
  serviceApiKeyEncrypted?: string | null;

  /** Platform integration capabilities: submit, read_status, receive_notifications. */
  @Column({ name: 'integration_permissions', type: 'jsonb', nullable: true })
  integrationPermissions?: string[] | null;

  @Column({
    name: 'validation_status',
    type: 'varchar',
    length: 20,
    default: 'NOT_VALIDATED',
  })
  validationStatus!: 'NOT_VALIDATED' | 'VALID' | 'INVALID';

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt?: Date | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
