import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Customer } from './customer.entity';
import { CustomerVersion } from './customer-version.entity';

@Entity('customer_audit_logs')
@Index('IDX_customer_audit_logs_company_customer', [
  'company_id',
  'customer_id',
])
@Index('IDX_customer_audit_logs_version', ['customer_version_id'])
export class CustomerAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid', nullable: true })
  customer_version_id: string | null;

  @Column({ type: 'varchar', length: 30 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  old_values: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_values: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  fields_changed: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  user_name: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip_address: string | null;

  @Column({ type: 'varchar', length: 40, default: 'ADMIN_PORTAL' })
  source: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  related_record_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  related_record_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => CustomerVersion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_version_id' })
  customer_version: CustomerVersion | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
