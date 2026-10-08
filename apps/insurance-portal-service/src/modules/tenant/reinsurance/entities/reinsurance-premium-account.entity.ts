import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReinsuranceAccountStatus } from '../enums/reinsurance.enums';
import { ReinsurancePremiumAccountItem } from './reinsurance-premium-account-item.entity';

@Entity('reinsurance_premium_accounts')
export class ReinsurancePremiumAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  treaty_id: string | null;

  @Column({ type: 'uuid' })
  participant_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  reinsurance_broker_company_id: string | null;

  @Column({ type: 'varchar', length: 60 })
  account_no: string;

  @Column({ type: 'date' })
  period_from: string;

  @Column({ type: 'date' })
  period_to: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  gross_ceded_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  reinsurance_commission: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  brokerage_commission: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  tax_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  other_adjustments: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  net_premium_due: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  paid_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  outstanding_amount: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: ReinsuranceAccountStatus.DRAFT,
  })
  status: ReinsuranceAccountStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  confirmed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  response_note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(
    () => ReinsurancePremiumAccountItem,
    (item) => item.premium_account,
  )
  items: ReinsurancePremiumAccountItem[];
}
