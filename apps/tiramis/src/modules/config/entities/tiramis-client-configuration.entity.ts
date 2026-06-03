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

  @Column({ name: 'system_code', length: 12 })
  systemCode!: string;

  @Column({ name: 'client_code', length: 100 })
  clientCode!: string;

  @Column({ name: 'client_key', length: 255 })
  clientKey!: string;

  @Column({ name: 'insurer_company_code', length: 6 })
  insurerCompanyCode!: string;

  @Column({ name: 'tran_company_code', length: 6, nullable: true })
  tranCompanyCode?: string | null;

  @Column({ name: 'base_url', length: 500 })
  baseUrl!: string;

  @Column({ name: 'callback_base_url', length: 500 })
  callbackBaseUrl!: string;

  @Column({ name: 'private_key_path', length: 500, nullable: true })
  privateKeyPath?: string | null;

  @Column({ name: 'private_key_password', length: 255, nullable: true })
  privateKeyPassword?: string | null;

  @Column({ name: 'public_certificate_path', length: 500, nullable: true })
  publicCertificatePath?: string | null;

  @Column({ name: 'tira_public_certificate_path', length: 500, nullable: true })
  tiraPublicCertificatePath?: string | null;

  @Column({ name: 'signature_algorithm', length: 100, nullable: true })
  signatureAlgorithm?: string | null;

  @Column({ name: 'is_active', type: 'int', default: 1 })
  isActive!: number;

  @OneToMany(
    () => TiramisServiceEndpointEntity,
    (endpoint) => endpoint.clientConfiguration,
  )
  endpoints?: TiramisServiceEndpointEntity[];
}
