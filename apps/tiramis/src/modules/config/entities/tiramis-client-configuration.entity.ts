import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

/**
 * A company's TIRAMIS configuration. Only company-specific settings are
 * stored; the TIRA system identity (client code/key, system code/name,
 * certificates, base and callback URLs) is platform-wide and comes from the
 * environment. TiramisConfigService fills the runtime-only fields below from
 * the environment on every configuration it returns.
 */
@Entity({ name: 'tiramis_client_configurations' })
@Index(['environment'])
@Index(['environment', 'companyCode'], { unique: true })
export class TiramisClientConfigurationEntity extends BaseEntity {
  @Column({ length: 30 })
  environment!: string;

  @Column({ name: 'company_code', length: 6 })
  companyCode!: string;

  @Column({ name: 'insurer_company_code', length: 6 })
  insurerCompanyCode!: string;

  @Column({
    name: 'sale_point_code',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  salePointCode?: string | null;

  @Column({
    name: 'tran_company_code',
    type: 'varchar',
    length: 6,
    nullable: true,
  })
  tranCompanyCode?: string | null;

  @Column({
    name: 'portal_webhook_api_key_encrypted',
    type: 'text',
    nullable: true,
  })
  portalWebhookApiKeyEncrypted?: string | null;

  @Column({ name: 'portal_notification_events', type: 'jsonb', nullable: true })
  portalNotificationEvents?: string[] | null;

  @Column({ name: 'is_active', type: 'int', default: 1 })
  isActive!: number;

  // ---- Runtime-only system identity (environment, never persisted) ----
  systemCode!: string;
  systemName!: string;
  clientCode!: string;
  clientKey!: string;
  baseUrl!: string;
  callbackBaseUrl!: string;
  clientPrivateCertificatePath?: string | null;
  clientPrivateCertificatePassword?: string | null;
  tiraPublicCertificatePath?: string | null;
  tiraPublicCertificatePassword?: string | null;
  signatureAlgorithm?: string | null;
}
