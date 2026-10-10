import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

/**
 * The platform's TIRA integration settings for one TIRA environment (test or
 * live), managed centrally by platform administrators and shared by every
 * linked company. Secrets are encrypted with TIRAMIS_SECRET_ENCRYPTION_KEY.
 * Any value left empty falls back to the matching environment variable.
 */
@Entity({ name: 'tiramis_system_profiles' })
@Index(['environment'], { unique: true })
export class TiramisSystemProfileEntity extends BaseEntity {
  @Column({ length: 10 })
  environment!: 'test' | 'live';

  @Column({ name: 'client_code', type: 'varchar', length: 100, nullable: true })
  clientCode?: string | null;

  @Column({ name: 'client_key_encrypted', type: 'text', nullable: true })
  clientKeyEncrypted?: string | null;

  @Column({ name: 'system_code', type: 'varchar', length: 50, nullable: true })
  systemCode?: string | null;

  @Column({ name: 'system_name', type: 'varchar', length: 150, nullable: true })
  systemName?: string | null;

  @Column({ name: 'base_url', type: 'varchar', length: 500, nullable: true })
  baseUrl?: string | null;

  @Column({
    name: 'callback_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  callbackUrl?: string | null;

  @Column({
    name: 'client_certificate_password_encrypted',
    type: 'text',
    nullable: true,
  })
  clientCertificatePasswordEncrypted?: string | null;

  @Column({
    name: 'public_certificate_password_encrypted',
    type: 'text',
    nullable: true,
  })
  publicCertificatePasswordEncrypted?: string | null;

  @Column({
    name: 'signature_algorithm',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  signatureAlgorithm?: string | null;

  @Column({
    name: 'allow_expired_certificates',
    type: 'boolean',
    nullable: true,
  })
  allowExpiredCertificates?: boolean | null;

  /** Key TIRAMIS sends to the portal webhook for this environment. */
  @Column({
    name: 'portal_webhook_api_key_encrypted',
    type: 'text',
    nullable: true,
  })
  portalWebhookApiKeyEncrypted?: string | null;

  /** null = default event set; [] = notifications disabled. */
  @Column({ name: 'portal_notification_events', type: 'jsonb', nullable: true })
  portalNotificationEvents?: string[] | null;

  @Column({
    name: 'validation_status',
    type: 'varchar',
    length: 20,
    default: 'NOT_VALIDATED',
  })
  validationStatus!: 'NOT_VALIDATED' | 'VALID' | 'INVALID';

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt?: Date | null;

  @Column({ name: 'validation_message', type: 'text', nullable: true })
  validationMessage?: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 100, nullable: true })
  updatedBy?: string | null;
}
