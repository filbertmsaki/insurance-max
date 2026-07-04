import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'tiramis_callback_dead_letters' })
@Index(['environment'])
@Index(['requestId'])
@Index(['responseId'])
export class TiramisCallbackDeadLetterEntity extends BaseEntity {
  @Column({ length: 30 })
  environment!: string;

  @Column({
    name: 'root_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  rootName?: string | null;

  @Column({
    name: 'request_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  requestId?: string | null;

  @Column({
    name: 'response_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  responseId?: string | null;

  @Column({
    name: 'status_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  statusCode?: string | null;

  @Column({
    name: 'status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  statusDesc?: string | null;

  @Column({
    name: 'signature',
    type: 'text',
    nullable: true,
  })
  signature?: string | null;

  @Column({
    name: 'raw_xml',
    type: 'text',
    nullable: true,
  })
  rawXml?: string | null;

  @Column({
    name: 'reason',
    type: 'text',
  })
  reason!: string;

  @Column({
    name: 'is_processed',
    type: 'int',
    default: 0,
  })
  isProcessed!: number;
}
