import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PolicyCession } from './policy-cession.entity';

@Entity('policy_cession_participants')
export class PolicyCessionParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  cession_id: string;

  @Column({ type: 'uuid' })
  participant_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  reinsurance_broker_company_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_treaty_participant_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_facultative_offer_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  participant_code: string;

  @Column({ type: 'int', default: 1 })
  participant_type: number;

  @Column({ type: 'int', default: 1 })
  reinsurance_form: number;

  @Column({ type: 'int', default: 1 })
  reinsurance_type: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  re_broker_code: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  brokerage_commission: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  reinsurance_commission: string;

  @Column({ type: 'numeric', precision: 18, scale: 10 })
  premium_share: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  sum_insured_share: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  ceded_premium_share: string;

  @Column({ type: 'timestamptz' })
  participation_date: Date;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => PolicyCession, (cession) => cession.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cession_id' })
  cession: PolicyCession;
}
