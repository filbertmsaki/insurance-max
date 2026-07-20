import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuotationEntryAddonTax } from './quotation-entry-addon-tax.entity';
import { QuotationCoverNoteEntry } from './quotation-cover-note-entry.entity';

@Entity('quotation_entry_addons')
@Index('UQ_qea_entry_sequence', ['entry_id', 'sequence_no'], {
  unique: true,
})
@Index('IDX_qea_entry_id', ['entry_id'])
@Index('IDX_qea_reference', ['addon_reference'])
export class QuotationEntryAddon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  entry_id: string;

  @Column({ type: 'int' })
  sequence_no: number;

  @Column({
    type: 'varchar',
    length: 100,
  })
  addon_reference: string;

  @Column({
    type: 'varchar',
    length: 500,
  })
  addon_desc: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  addon_amount: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
  })
  addon_premium_rate: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  premium_excluding_tax: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  premium_excluding_tax_equivalent: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  premium_including_tax: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(
    () => QuotationCoverNoteEntry,
    (entry) => entry.addons,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'entry_id' })
  entry: QuotationCoverNoteEntry;

  @OneToMany(
    () => QuotationEntryAddonTax,
    (tax) => tax.addon,
  )
  taxes: QuotationEntryAddonTax[];
}
