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

  @Column({ name: 'insurer_company_code', length: 6 })
  insurerCompanyCode!: string;

  @Column({ name: 'sale_point_code', type: 'varchar', length: 12, nullable: true })
  salePointCode?: string | null;

  @Column({ name: 'tran_company_code', type: 'varchar', length: 6, nullable: true })
  tranCompanyCode?: string | null;

  @Column({ name: 'base_url', length: 500 })
  baseUrl!: string;

  @Column({ name: 'callback_base_url', length: 500 })
  callbackBaseUrl!: string;

  @Column({ name: 'private_key_path', type: 'varchar', length: 500, nullable: true })
  privateKeyPfxPath?: string | null;

  @Column({ name: 'private_key_password', type: 'varchar', length: 255, nullable: true })
  privateKeyPfxPassword?: string | null;

  @Column({ name: 'public_certificate_path', type: 'varchar', length: 500, nullable: true })
  publicCertificatePfxPath?: string | null;

  @Column({ name: 'public_certificate_password', type: 'varchar', length: 255, nullable: true })
  publicCertificatePfxPassword?: string | null;

  @Column({ name: 'tira_public_certificate_path', type: 'varchar', length: 500, nullable: true })
  tiraPublicCertificatePfxPath?: string | null;

  @Column({ name: 'tira_public_certificate_password', type: 'varchar', length: 255, nullable: true })
  tiraPublicCertificatePfxPassword?: string | null;

  @Column({ name: 'signature_algorithm', type: 'varchar', length: 100, nullable: true })
  signatureAlgorithm?: string | null;

  @Column({ name: 'is_active', type: 'int', default: 1 })
  isActive!: number;

  @OneToMany(
    () => TiramisServiceEndpointEntity,
    (endpoint) => endpoint.clientConfiguration,
  )
  endpoints?: TiramisServiceEndpointEntity[];
}
