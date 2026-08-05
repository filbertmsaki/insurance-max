import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';

import { PortalAccountStatus, PortalActorType } from '../enums/portal.enums';

@Entity('portal_accounts')
@Index('IDX_portal_accounts_company_user', ['company_id', 'user_id'])
export class PortalAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 30 })
  actor_type: PortalActorType;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  intermediary_company_id: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: PortalAccountStatus.INVITED,
  })
  status: PortalAccountStatus;

  @Column({ type: 'timestamptz', nullable: true })
  activated_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  suspended_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  suspended_at: Date | null;

  @Column({ type: 'text', nullable: true })
  suspension_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_terms_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_privacy_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_accessed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'intermediary_company_id' })
  intermediary_company: Company | null;
}
