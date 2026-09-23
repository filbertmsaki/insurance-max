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

@Entity('customer_versions')
@Index('IDX_customer_versions_company_customer', ['company_id', 'customer_id'])
@Index('IDX_customer_versions_current', ['company_id', 'customer_id'], {
  where: 'is_current_version = true',
})
@Index('UQ_customer_versions_number', ['customer_id', 'version_number'], {
  unique: true,
})
export class CustomerVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'int' })
  version_number: number;

  @Column({ type: 'boolean', default: false })
  is_current_version: boolean;

  @Column({ type: 'jsonb' })
  customer_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  customer_snapshot_hash: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
