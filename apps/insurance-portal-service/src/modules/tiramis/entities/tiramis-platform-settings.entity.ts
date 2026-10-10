import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TiramisEnvironmentName = 'test' | 'live';

/**
 * Platform-wide TIRAMIS integration settings (a single row, id 'platform'),
 * managed from Platform → TIRAMIS Integration. Every linked company uses the
 * active environment and the platform's credentials; companies configure
 * nothing. The TIRA identity, certificates and webhook key live in TIRAMIS.
 */
@Entity({ name: 'tiramis_platform_settings' })
export class TiramisPlatformSettingsEntity {
  @PrimaryColumn({ type: 'varchar', length: 20, default: 'platform' })
  id!: string;

  @Column({
    name: 'active_environment',
    type: 'varchar',
    length: 10,
    default: 'test',
  })
  activeEnvironment!: TiramisEnvironmentName;

  /** Platform key the portal presents to TIRAMIS in the test environment. */
  @Column({
    name: 'service_api_key_test_encrypted',
    type: 'text',
    nullable: true,
    select: false,
  })
  serviceApiKeyTestEncrypted?: string | null;

  @Column({
    name: 'service_api_key_live_encrypted',
    type: 'text',
    nullable: true,
    select: false,
  })
  serviceApiKeyLiveEncrypted?: string | null;

  /** Platform integration capabilities: submit, read_status, receive_notifications. */
  @Column({ name: 'integration_permissions', type: 'jsonb', nullable: true })
  integrationPermissions?: string[] | null;

  @Column({
    name: 'test_validation_status',
    type: 'varchar',
    length: 20,
    default: 'NOT_VALIDATED',
  })
  testValidationStatus!: 'NOT_VALIDATED' | 'VALID' | 'INVALID';

  @Column({ name: 'test_validated_at', type: 'timestamptz', nullable: true })
  testValidatedAt?: Date | null;

  @Column({
    name: 'live_validation_status',
    type: 'varchar',
    length: 20,
    default: 'NOT_VALIDATED',
  })
  liveValidationStatus!: 'NOT_VALIDATED' | 'VALID' | 'INVALID';

  @Column({ name: 'live_validated_at', type: 'timestamptz', nullable: true })
  liveValidatedAt?: Date | null;

  @Column({
    name: 'environment_switched_at',
    type: 'timestamptz',
    nullable: true,
  })
  environmentSwitchedAt?: Date | null;

  @Column({
    name: 'environment_switched_by',
    type: 'uuid',
    nullable: true,
  })
  environmentSwitchedBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
