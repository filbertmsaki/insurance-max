import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  ReinsuranceSettlementStatus,
  ReinsuranceSettlementType,
} from '../enums/reinsurance.enums';
import { ReinsuranceSettlementItem } from './reinsurance-settlement-item.entity';

@Entity('reinsurance_settlements')
export class ReinsuranceSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  counterparty_company_id: string;

  @Column({ type: 'varchar', length: 60 })
  settlement_no: string;

  @Column({ type: 'varchar', length: 40 })
  settlement_type: ReinsuranceSettlementType;

  @Column({ type: 'date', nullable: true })
  period_from: string | null;

  @Column({ type: 'date', nullable: true })
  period_to: string | null;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  gross_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  deduction_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  net_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  paid_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  balance_amount: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: ReinsuranceSettlementStatus.DRAFT,
  })
  status: ReinsuranceSettlementStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payment_method: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => ReinsuranceSettlementItem, (item) => item.settlement)
  items: ReinsuranceSettlementItem[];
}
