import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@insurance-max/persistence';

@Entity({ name: 'tiramis_items' })
export class TiramisItemEntity extends BaseEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
