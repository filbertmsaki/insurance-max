import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index, OneToMany } from 'typeorm';

import { TiramisServiceEndpointEntity } from './tiramis-service-endpoint.entity';

@Entity({ name: 'tiramis_client_configurations' })
@Index(['environment'])
@Index(['environment', 'companyCode', 'systemCode'], { unique: true })
export class TiramisClientConfigurationEntity extends BaseEntity {
  @Column({ length: 30 })
  environment!: string;

  @Column({ name: 'company_code', length: 6 })
  companyCode!: string;

  @Column({ name: 'system_code', length: 50 })
  systemCode!: string;

  @Column({ name: 'client_code', length: 100 })
  clientCode!: string;

  @Column({ name: 'client_key', length: 255 })
  clientKey!: string;

  @Column({
    name: 'client_key_encrypted',
    type: 'text',
    nullable: true,
  })
  clientKeyEncrypted?: string | null;

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

  @Column({ name: 'base_url', length: 500 })
  baseUrl!: string;

  @Column({ name: 'callback_base_url', length: 500 })
  callbackBaseUrl!: string;

  @Column({
    name: 'client_private_certificate_path',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  clientPrivateCertificatePath?: string | null;

  @Column({
    name: 'client_private_certificate_password',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  clientPrivateCertificatePassword?: string | null;

  @Column({
    name: 'client_private_certificate_password_encrypted',
    type: 'text',
    nullable: true,
  })
  clientPrivateCertificatePasswordEncrypted?: string | null;

  @Column({
    name: 'tira_public_certificate_path',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  tiraPublicCertificatePath?: string | null;

  @Column({
    name: 'tira_public_certificate_password',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  tiraPublicCertificatePassword?: string | null;

  @Column({
    name: 'tira_public_certificate_password_encrypted',
    type: 'text',
    nullable: true,
  })
  tiraPublicCertificatePasswordEncrypted?: string | null;

  @Column({
    name: 'signature_algorithm',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  signatureAlgorithm?: string | null;

  @Column({ name: 'is_active', type: 'int', default: 1 })
  isActive!: number;

  @OneToMany(
    () => TiramisServiceEndpointEntity,
    (endpoint) => endpoint.clientConfiguration,
  )
  endpoints?: TiramisServiceEndpointEntity[];
}
