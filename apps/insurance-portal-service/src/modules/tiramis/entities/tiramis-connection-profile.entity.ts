import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import type { TiramisEnvironmentName } from './tiramis-platform-settings.entity';

/** Portal side endpoint and credentials for one TIRAMIS environment. */
@Entity({ name: 'tiramis_connection_profiles' })
export class TiramisConnectionProfileEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  environment!: TiramisEnvironmentName;

  @Column({ name: 'base_url', type: 'varchar', length: 500, nullable: true })
  baseUrl?: string | null;

  @Column({
    name: 'candidate_base_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  candidateBaseUrl?: string | null;

  @Column({ name: 'service_api_key_encrypted', type: 'text', nullable: true })
  serviceApiKeyEncrypted?: string | null;

  @Column({
    name: 'webhook_source_ip',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  webhookSourceIp?: string | null;

  /** @deprecated Legacy stored callback; runtime now derives it from Portal APP_URL. */
  @Column({
    name: 'portal_webhook_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  portalWebhookUrl?: string | null;

  /** @deprecated Legacy candidate callback; runtime now derives it from Portal APP_URL. */
  @Column({
    name: 'candidate_portal_webhook_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  candidatePortalWebhookUrl?: string | null;

  @Column({
    name: 'validation_status',
    type: 'varchar',
    length: 20,
    default: 'NOT_VALIDATED',
  })
  validationStatus!: 'NOT_VALIDATED' | 'VALID' | 'INVALID';

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt?: Date | null;

  @Column({ name: 'last_test_result', type: 'jsonb', nullable: true })
  lastTestResult?: Record<string, unknown> | null;

  @Column({
    name: 'previous_base_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  previousBaseUrl?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
