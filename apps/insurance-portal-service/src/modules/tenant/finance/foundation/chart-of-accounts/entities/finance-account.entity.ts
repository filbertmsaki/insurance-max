import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('finance_accounts')
@Index('UQ_finance_account_code_entity', ['company_id', 'account_code'], {
  unique: true,
})
export class FinanceAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 50 })
  account_code: string;

  @Column({ type: 'varchar', length: 150 })
  account_name: string;

  @Column({ type: 'varchar', length: 30 })
  account_type: string;

  @Column({ type: 'boolean', default: false })
  is_control_account: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
