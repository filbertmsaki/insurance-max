import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from '../../../platform/companies/entities/company.entity';
import { Customer } from './customer.entity';

@Entity('insured_assets')
export class InsuredAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 50 })
  asset_number: string;

  @Column({ type: 'varchar', length: 40 })
  asset_type: string;

  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'uuid' })
  owner_customer_id: string;

  @Column({ type: 'varchar', length: 180 })
  display_name: string;

  @Column({ type: 'varchar', length: 30, default: 'OWNED' })
  ownership_type: string;

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  declared_value: string;

  @Column({ type: 'varchar', length: 10, default: 'TZS' })
  currency_code: string;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'varchar', length: 30, default: 'MANUAL' })
  data_source: string;

  @Column({ type: 'varchar', length: 30, default: 'NOT_VERIFIED' })
  verification_status: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  verification_reference: string | null;

  @Column({ type: 'int', default: 1 })
  snapshot_version: number;

  @Column({ type: 'jsonb', nullable: true })
  current_snapshot: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  current_snapshot_hash: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => Customer, (customer) => customer.insured_assets, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Customer, (customer) => customer.owned_insured_assets, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'owner_customer_id' })
  owner_customer: Customer;
}
