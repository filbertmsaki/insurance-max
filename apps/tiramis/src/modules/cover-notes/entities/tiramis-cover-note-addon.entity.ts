import { BaseEntity } from '@insurance-max/persistence';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { TiramisCoverNoteEntity } from './tiramis-cover-note.entity';
import { TiramisCoverNoteTaxEntity } from './tiramis-cover-note-tax.entity';

@Entity({ name: 'tiramis_cover_note_addons' })
export class TiramisCoverNoteAddonEntity extends BaseEntity {
  @Column({ name: 'cover_note_id' })
  coverNoteId!: string;

  @ManyToOne(() => TiramisCoverNoteEntity, (coverNote) => coverNote.addons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_id' })
  coverNote!: TiramisCoverNoteEntity;

  @Column({ name: 'motor_fleet_item_id', type: 'uuid', nullable: true })
  motorFleetItemId?: string | null;

  @Column({ name: 'addon_reference', length: 50 })
  addonReference!: string;

  @Column({ name: 'addon_desc', length: 250 })
  addonDesc!: string;

  @Column({ name: 'addon_amount', type: 'decimal', precision: 36, scale: 2 })
  addonAmount!: string;

  @Column({
    name: 'addon_premium_rate',
    type: 'decimal',
    precision: 10,
    scale: 5,
  })
  addonPremiumRate!: string;

  @Column({
    name: 'premium_excluding_tax',
    type: 'decimal',
    precision: 36,
    scale: 2,
  })
  premiumExcludingTax!: string;

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

  @OneToMany(() => TiramisCoverNoteTaxEntity, (tax) => tax.addon, {
    cascade: true,
  })
  taxes?: TiramisCoverNoteTaxEntity[];
}
