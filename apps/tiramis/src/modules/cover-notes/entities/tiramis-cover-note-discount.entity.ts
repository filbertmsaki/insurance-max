import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisCoverNoteRiskEntity } from './tiramis-cover-note-risk.entity';

@Entity({ name: 'tiramis_cover_note_discounts' })
export class TiramisCoverNoteDiscountEntity extends BaseEntity {
  @Column({ name: 'cover_note_risk_id' })
  coverNoteRiskId!: string;

  @ManyToOne(() => TiramisCoverNoteRiskEntity, (risk) => risk.discounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_risk_id' })
  risk!: TiramisCoverNoteRiskEntity;

  @Column({ name: 'discount_type', type: 'int', nullable: true })
  discountType?: number | null;

  @Column({
    name: 'discount_rate',
    type: 'decimal',
    precision: 10,
    scale: 5,
    nullable: true,
  })
  discountRate?: string | null;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
  })
  discountAmount?: string | null;
}
