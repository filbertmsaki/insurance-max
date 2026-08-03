import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ReinsurancePremiumAccount } from './reinsurance-premium-account.entity';

@Entity('reinsurance_premium_account_items')
export class ReinsurancePremiumAccountItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  premium_account_id: string;

  @Column({ type: 'uuid' })
  cession_id: string;

  @Column({ type: 'uuid' })
  cession_participant_id: string;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  gross_ceded_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  reinsurance_commission: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  brokerage_commission: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  tax_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  net_premium_due: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(
    () => ReinsurancePremiumAccount,
    (premiumAccount) => premiumAccount.items,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'premium_account_id' })
  premium_account: ReinsurancePremiumAccount;
}
