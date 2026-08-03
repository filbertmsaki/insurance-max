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

import { FacultativeOfferStatus } from '../enums/reinsurance.enums';
import { FacultativePlacement } from './facultative-placement.entity';

@Entity('facultative_placement_offers')
export class FacultativePlacementOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid' })
  placement_id: string;

  @Column({ type: 'uuid' })
  reinsurer_company_id: string;

  @Column({ type: 'uuid', nullable: true })
  reinsurance_broker_company_id: string | null;

  @Column({ type: 'varchar', length: 60 })
  offer_no: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  participant_code: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  re_broker_code: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 10 })
  offered_share_percent: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  offered_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  offered_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  quoted_share_percent: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  quoted_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  quoted_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  accepted_share_percent: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  accepted_amount: string;

  @Column({ type: 'numeric', precision: 20, scale: 2, default: 0 })
  accepted_premium: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  brokerage_commission_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  reinsurance_commission_rate: string;

  @Column({ type: 'text', nullable: true })
  terms: string | null;

  @Column({ type: 'text', nullable: true })
  conditions: string | null;

  @Column({ type: 'text', nullable: true })
  exclusions: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: FacultativeOfferStatus.INVITED,
  })
  status: FacultativeOfferStatus;

  @Column({ type: 'uuid', nullable: true })
  invited_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  responded_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  responded_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => FacultativePlacement, (placement) => placement.offers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'placement_id' })
  placement: FacultativePlacement;
}
