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

import {
  TreatyParticipantRole,
  TreatyParticipantStatus,
} from '../enums/reinsurance.enums';
import { ReinsuranceTreatySection } from './reinsurance-treaty-section.entity';
import { ReinsuranceTreaty } from './reinsurance-treaty.entity';

@Entity('reinsurance_treaty_participants')
export class ReinsuranceTreatyParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  treaty_id: string;

  @Column({ type: 'uuid', nullable: true })
  treaty_section_id: string | null;

  @Column({ type: 'uuid' })
  participant_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  reinsurance_broker_company_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  participant_code: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  re_broker_code: string | null;

  @Column({ type: 'varchar', length: 40 })
  participant_role: TreatyParticipantRole;

  @Column({ type: 'numeric', precision: 18, scale: 10 })
  share_percent: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  signed_line_percent: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  capacity_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  brokerage_commission_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  reinsurance_commission_rate: string;

  @Column({ type: 'timestamptz' })
  participation_date: Date;

  @Column({ type: 'date', nullable: true })
  effective_from: string | null;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: TreatyParticipantStatus.INVITED,
  })
  status: TreatyParticipantStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => ReinsuranceTreaty, (treaty) => treaty.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'treaty_id' })
  treaty: ReinsuranceTreaty;

  @ManyToOne(() => ReinsuranceTreatySection, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'treaty_section_id' })
  treaty_section: ReinsuranceTreatySection | null;
}
