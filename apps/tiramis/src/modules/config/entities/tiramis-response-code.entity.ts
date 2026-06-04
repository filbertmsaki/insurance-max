import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'tiramis_response_codes' })
@Index(['code'], { unique: true })
export class TiramisResponseCodeEntity extends BaseEntity {
  @Column({ length: 20 })
  code!: string;

  @Column({ length: 255 })
  description!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string | null;

  @Column({ name: 'is_success', type: 'int', default: 0 })
  isSuccess!: number;

  @Column({ name: 'is_retryable', type: 'int', default: 0 })
  isRetryable!: number;

  @Column({ name: 'is_active', type: 'int', default: 1 })
  isActive!: number;
}
