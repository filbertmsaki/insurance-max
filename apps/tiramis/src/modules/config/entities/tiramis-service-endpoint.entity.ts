import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisClientConfigurationEntity } from './tiramis-client-configuration.entity';

@Entity({ name: 'tiramis_service_endpoints' })
@Index(['clientConfigurationId', 'serviceType'], { unique: true })
export class TiramisServiceEndpointEntity extends BaseEntity {
  @Column({ name: 'client_configuration_id' })
  clientConfigurationId!: string;

  @ManyToOne(
    () => TiramisClientConfigurationEntity,
    (configuration) => configuration.endpoints,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'client_configuration_id' })
  clientConfiguration!: TiramisClientConfigurationEntity;

  @Column({ name: 'service_type', length: 80 })
  serviceType!: string;

  @Column({ name: 'endpoint_url', length: 500 })
  endpointUrl!: string;

  @Column({ name: 'http_method', length: 10, default: 'POST' })
  httpMethod!: string;

  @Column({ name: 'content_type', length: 50, default: 'application/xml' })
  contentType!: string;

  @Column({ name: 'is_active', type: 'int', default: 1 })
  isActive!: number;
}
