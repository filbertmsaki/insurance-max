import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';

import { PortalAttachmentStatus } from '../enums/portal.enums';

import { PortalServiceRequest } from './portal-service-request.entity';

@Entity('portal_request_attachments')
export class PortalRequestAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  request_id: string;

  // Not a foreign key by design: this is an immutable audit value that must
  // outlive the uploading user's account.
  @Column({ type: 'uuid' })
  uploaded_by: string;

  @Column({ type: 'varchar', length: 80 })
  document_type: string;

  @Column({ type: 'varchar', length: 255 })
  original_file_name: string;

  @Column({ type: 'varchar', length: 255 })
  stored_file_name: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  storage_key: string;

  @Column({ type: 'varchar', length: 120 })
  mime_type: string;

  @Column({ type: 'bigint' })
  file_size: string;

  @Column({ type: 'varchar', length: 128 })
  checksum: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: PortalAttachmentStatus.ACTIVE,
  })
  status: PortalAttachmentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => PortalServiceRequest, (request) => request.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request: PortalServiceRequest;
}
