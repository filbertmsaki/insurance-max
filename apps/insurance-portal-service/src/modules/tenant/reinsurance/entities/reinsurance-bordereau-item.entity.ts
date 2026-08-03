import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ReinsuranceBordereau } from './reinsurance-bordereau.entity';

@Entity('reinsurance_bordereau_items')
export class ReinsuranceBordereauItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bordereau_id: string;

  @Column({ type: 'uuid', nullable: true })
  cession_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  cession_participant_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  policy_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  claim_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  claim_recovery_id: string | null;

  @Column({ type: 'varchar', length: 120 })
  reference_number: string;

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

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  recovery_amount: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => ReinsuranceBordereau, (bordereau) => bordereau.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bordereau_id' })
  bordereau: ReinsuranceBordereau;
}
