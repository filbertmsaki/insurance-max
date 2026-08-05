import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('tiramis_access_audit_logs')
@Index(['tenantCompanyId', 'createdAt'])
@Index(['requestId'])
export class TiramisAccessAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
  requestId: string | null;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  correlationId: string | null;

  @Column({ name: 'calling_service', type: 'varchar', length: 100 })
  callingService: string;

  @Column({
    name: 'actor_user_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  actorUserId: string | null;

  @Column({
    name: 'tenant_company_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tenantCompanyId: string | null;

  @Column({ name: 'service_scopes', type: 'simple-array', nullable: true })
  serviceScopes: string[] | null;

  @Column({ type: 'varchar', length: 20 })
  method: string;

  @Column({ type: 'varchar', length: 255 })
  path: string;

  @Column({ name: 'status_code', type: 'integer' })
  statusCode: number;

  @Column({ type: 'boolean' })
  allowed: boolean;

  @Column({ name: 'denial_reason', type: 'text', nullable: true })
  denialReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
