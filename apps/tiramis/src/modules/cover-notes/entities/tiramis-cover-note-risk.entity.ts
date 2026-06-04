import { BaseEntity } from '@insurance-max/persistence';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { TiramisCoverNoteDiscountEntity } from './tiramis-cover-note-discount.entity';
import { TiramisCoverNoteEntity } from './tiramis-cover-note.entity';
import { TiramisCoverNoteTaxEntity } from './tiramis-cover-note-tax.entity';

@Entity({ name: 'tiramis_cover_note_risks' })
export class TiramisCoverNoteRiskEntity extends BaseEntity {
  @Column({ name: 'cover_note_id' })
  coverNoteId!: string;

  @ManyToOne(() => TiramisCoverNoteEntity, (coverNote) => coverNote.risks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_id' })
  coverNote!: TiramisCoverNoteEntity;

  @Column({ name: 'motor_fleet_item_id', nullable: true })
  motorFleetItemId?: string | null;

  @Column({ name: 'risk_code', length: 50 })
  riskCode!: string;

  @Column({ name: 'sum_insured', type: 'decimal', precision: 36, scale: 2 })
  sumInsured!: string;

  @Column({
    name: 'sum_insured_equivalent',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  sumInsuredEquivalent!: string;

  @Column({ name: 'premium_rate', type: 'decimal', precision: 10, scale: 5 })
  premiumRate!: string;

  @Column({
    name: 'premium_before_discount',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  premiumBeforeDiscount!: string;

  @Column({
    name: 'premium_after_discount',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  premiumAfterDiscount!: string;

  @Column({
    name: 'premium_excluding_tax_equivalent',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  premiumExcludingTaxEquivalent!: string;

  @Column({
    name: 'premium_including_tax',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  premiumIncludingTax!: string;

  @OneToMany(() => TiramisCoverNoteDiscountEntity, (discount) => discount.risk, {
    cascade: true,
  })
  discounts?: TiramisCoverNoteDiscountEntity[];

  @OneToMany(() => TiramisCoverNoteTaxEntity, (tax) => tax.risk, {
    cascade: true,
  })
  taxes?: TiramisCoverNoteTaxEntity[];
}
