import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { PortalRequestStatus } from '../enums/portal.enums';

import { PortalServiceRequest } from './portal-service-request.entity';

@Entity('portal_service_request_events')
export class PortalServiceRequestEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  request_id: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  old_status: PortalRequestStatus | null;

  @Column({ type: 'varchar', length: 40 })
  new_status: PortalRequestStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  // Not a foreign key by design: this is an immutable audit value that must
  // outlive the acting user's account.
  @Column({ type: 'uuid' })
  changed_by: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => PortalServiceRequest, (request) => request.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request: PortalServiceRequest;
}
