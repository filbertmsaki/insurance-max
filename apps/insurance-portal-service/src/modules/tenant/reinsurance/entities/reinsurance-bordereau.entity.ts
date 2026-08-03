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
  ReinsuranceBordereauStatus,
  ReinsuranceBordereauType,
} from '../enums/reinsurance.enums';
import { ReinsuranceBordereauItem } from './reinsurance-bordereau-item.entity';

@Entity('reinsurance_bordereaux')
export class ReinsuranceBordereau {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  treaty_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  participant_company_id: string | null;

  @Column({ type: 'varchar', length: 60 })
  bordereau_no: string;

  @Column({ type: 'varchar', length: 30 })
  bordereau_type: ReinsuranceBordereauType;

  @Column({ type: 'date' })
  period_from: string;

  @Column({ type: 'date' })
  period_to: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  gross_sum_insured: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  ceded_sum_insured: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  gross_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  ceded_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  commission_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  brokerage_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  claim_amount: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: ReinsuranceBordereauStatus.DRAFT,
  })
  status: ReinsuranceBordereauStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => ReinsuranceBordereauItem, (item) => item.bordereau)
  items: ReinsuranceBordereauItem[];
}
