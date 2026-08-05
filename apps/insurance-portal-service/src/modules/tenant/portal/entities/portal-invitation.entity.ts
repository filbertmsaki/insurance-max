import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from '../../customers/entities/customer.entity';

import { PortalActorType, PortalInvitationStatus } from '../enums/portal.enums';

@Entity('portal_invitations')
@Index('IDX_portal_invitations_company_email', [
  'company_id',
  'email',
  'status',
])
export class PortalInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 30 })
  actor_type: PortalActorType;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  intermediary_company_id: string | null;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  first_name: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  last_name: string | null;

  @Column({ type: 'varchar', length: 128, unique: true })
  token_hash: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: PortalInvitationStatus.PENDING,
  })
  status: PortalInvitationStatus;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  // Not a foreign key by design: invitations must remain a readable audit
  // trail even after the inviting user account is deleted.
  @Column({ type: 'uuid' })
  invited_by: string;

  @Column({ type: 'uuid', nullable: true })
  accepted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  revoked_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'text', nullable: true })
  revocation_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'intermediary_company_id' })
  intermediary_company: Company | null;
}
