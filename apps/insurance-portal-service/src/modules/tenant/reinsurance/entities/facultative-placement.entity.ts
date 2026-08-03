import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FacultativePlacementStatus } from '../enums/reinsurance.enums';
import { FacultativePlacementOffer } from './facultative-placement-offer.entity';

@Entity('facultative_placements')
export class FacultativePlacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @Column({ type: 'uuid' })
  policy_id: string;

  @Column({ type: 'uuid', nullable: true })
  policy_risk_id: string | null;

  @Column({ type: 'varchar', length: 60 })
  placement_no: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  placement_reference: string | null;

  @Column({ type: 'text' })
  risk_description: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  gross_sum_insured: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  company_retention: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount_to_place: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  gross_premium: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  premium_to_place: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 1 })
  exchange_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 100 })
  target_share_percent: string;

  @Column({ type: 'numeric', precision: 18, scale: 10, default: 0 })
  accepted_share_percent: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: FacultativePlacementStatus.DRAFT,
  })
  status: FacultativePlacementStatus;

  @Column({ type: 'timestamptz', nullable: true })
  submission_deadline: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => FacultativePlacementOffer, (offer) => offer.placement)
  offers: FacultativePlacementOffer[];
}
