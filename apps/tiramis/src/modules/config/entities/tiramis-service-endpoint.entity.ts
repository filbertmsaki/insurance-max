import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

/** TIRA service endpoints are the same for every company in an environment. */
@Entity({ name: 'tiramis_service_endpoints' })
@Index(['environment', 'serviceType'], { unique: true })
export class TiramisServiceEndpointEntity extends BaseEntity {
  @Column({ length: 30 })
  environment!: string;

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
