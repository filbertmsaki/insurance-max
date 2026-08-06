import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'tiramis_ingress_requests' })
@Index(['sourceCompanyId', 'requestType', 'idempotencyKey'], { unique: true })
export class TiramisIngressRequestEntity extends BaseEntity {
  @Column({
    name: 'source_company_id',
    type: 'varchar',
    length: 100,
  })
  sourceCompanyId!: string;

  @Column({
    name: 'source_module',
    type: 'varchar',
    length: 100,
  })
  sourceModule!: string;

  @Column({
    name: 'source_record_id',
    type: 'varchar',
    length: 150,
  })
  sourceRecordId!: string;

  @Column({
    name: 'workflow_revision',
    type: 'int',
    nullable: true,
  })
  workflowRevision?: number | null;

  @Column({
    name: 'command',
    type: 'varchar',
    length: 40,
  })
  command!: string;

  @Column({
    name: 'request_type',
    type: 'varchar',
    length: 80,
  })
  requestType!: string;

  @Column({
    name: 'schema_version',
    type: 'varchar',
    length: 100,
  })
  schemaVersion!: string;

  @Column({
    name: 'contract_version',
    type: 'varchar',
    length: 20,
  })
  contractVersion!: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 180,
  })
  idempotencyKey!: string;

  @Column({
    name: 'correlation_id',
    type: 'uuid',
  })
  correlationId!: string;

  @Column({
    name: 'causation_id',
    type: 'uuid',
    nullable: true,
  })
  causationId?: string | null;

  @Column({
    name: 'transaction_id',
    type: 'uuid',
  })
  transactionId!: string;

  @Column({
    name: 'request_id',
    type: 'varchar',
    length: 100,
  })
  requestId!: string;

  @Column({
    name: 'resource_version',
    type: 'int',
    default: 1,
  })
  resourceVersion!: number;

  @Column({
    name: 'payload_hash',
    type: 'varchar',
    length: 64,
  })
  payloadHash!: string;

  @Column({
    name: 'context_hash',
    type: 'varchar',
    length: 64,
  })
  contextHash!: string;

  @Column({
    name: 'envelope_hash',
    type: 'varchar',
    length: 64,
  })
  envelopeHash!: string;

  @Column({
    name: 'envelope',
    type: 'jsonb',
  })
  envelope!: Record<string, unknown>;

  @Column({
    name: 'acceptance_payload',
    type: 'jsonb',
  })
  acceptancePayload!: Record<string, unknown>;
}
