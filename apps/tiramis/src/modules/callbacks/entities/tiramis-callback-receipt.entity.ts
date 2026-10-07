import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'tiramis_callback_receipts' })
@Index(['environment', 'requestId', 'responseId'], { unique: true })
@Index(['requestId'])
@Index(['responseId'])
export class TiramisCallbackReceiptEntity extends BaseEntity {
  @Column({ length: 30 })
  environment!: string;

  @Column({
    name: 'request_id',
    type: 'varchar',
    length: 100,
  })
  requestId!: string;

  @Column({
    name: 'response_id',
    type: 'varchar',
    length: 100,
  })
  responseId!: string;

  @Column({
    name: 'root_name',
    type: 'varchar',
    length: 100,
  })
  rootName!: string;

  @Column({
    name: 'response_status_code',
    type: 'varchar',
    length: 50,
  })
  responseStatusCode!: string;

  @Column({
    name: 'response_status_desc',
    type: 'varchar',
    length: 255,
  })
  responseStatusDesc!: string;

  @Column({
    name: 'payload_hash',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  payloadHash?: string | null;

  @Column({
    name: 'signature_verified',
    type: 'int',
    default: 0,
  })
  signatureVerified!: number;

  @Column({
    name: 'processing_status',
    type: 'varchar',
    length: 30,
    default: 'PROCESSING',
  })
  processingStatus!: 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column({
    name: 'receive_count',
    type: 'int',
    default: 1,
  })
  receiveCount!: number;

  @Column({
    name: 'last_received_at',
    type: 'timestamp',
    nullable: true,
  })
  lastReceivedAt?: Date | null;

  @Column({
    name: 'acknowledgement_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  acknowledgementId?: string | null;

  @Column({
    name: 'acknowledgement_status_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  acknowledgementStatusCode?: string | null;

  @Column({
    name: 'acknowledgement_status_desc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  acknowledgementStatusDesc?: string | null;

  @Column({
    name: 'acknowledgement_xml',
    type: 'text',
    nullable: true,
  })
  acknowledgementXml?: string | null;

  @Column({
    name: 'last_error',
    type: 'text',
    nullable: true,
  })
  lastError?: string | null;

  @Column({
    name: 'signature_verification_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  signatureVerificationReason?: string | null;
}
