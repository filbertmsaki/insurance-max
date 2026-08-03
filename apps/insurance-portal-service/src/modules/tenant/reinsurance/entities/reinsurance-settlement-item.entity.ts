import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ReinsuranceSettlement } from './reinsurance-settlement.entity';

@Entity('reinsurance_settlement_items')
export class ReinsuranceSettlementItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  settlement_id: string;

  @Column({ type: 'uuid', nullable: true })
  premium_account_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  claim_recovery_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  resource_type: string;

  @Column({ type: 'uuid' })
  resource_id: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => ReinsuranceSettlement, (settlement) => settlement.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'settlement_id' })
  settlement: ReinsuranceSettlement;
}
