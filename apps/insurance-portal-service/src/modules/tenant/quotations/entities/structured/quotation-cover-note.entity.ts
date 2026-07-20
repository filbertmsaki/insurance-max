import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Quotation } from '../quotation.entity';
import { QuotationCoverNoteEntry } from './quotation-cover-note-entry.entity';

@Entity('quotation_cover_notes')
@Index('UQ_quotation_cover_notes_quotation_id', ['quotation_id'], {
  unique: true,
})
@Index('UQ_quotation_cover_notes_fleet_id', ['fleet_id'], {
  unique: true,
  where: 'fleet_id IS NOT NULL',
})
@Index('IDX_qcn_dates', [
  'cover_note_start_date',
  'cover_note_end_date',
])
export class QuotationCoverNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({ type: 'smallint' })
  cover_note_type: number;

  @Column({ type: 'varchar', length: 50 })
  sale_point_code: string;

  @Column({ type: 'timestamptz' })
  cover_note_start_date: Date;

  @Column({ type: 'timestamptz' })
  cover_note_end_date: Date;

  @Column({ type: 'smallint' })
  payment_mode: number;

  @Column({ type: 'varchar', length: 10 })
  currency_code: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 1,
  })
  exchange_rate: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  total_premium_excluding_tax: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  total_premium_including_tax: string;

  /**
   * The external payload uses the misspelling commision_paid.
   * The database uses the correct spelling.
   */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  commission_paid: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
    default: 0,
  })
  commission_rate: string;

  @Column({ type: 'varchar', length: 150 })
  officer_name: string;

  @Column({ type: 'varchar', length: 150 })
  officer_title: string;

  @Column({ type: 'varchar', length: 50 })
  product_code: string;

  /**
   * Fleet-only fields.
   *
   * They remain null for NON_MOTOR and MOTOR_SINGLE.
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  fleet_id: string | null;

  @Column({
    type: 'smallint',
    nullable: true,
  })
  fleet_type: number | null;

  @Column({
    type: 'int',
    nullable: true,
  })
  fleet_size: number | null;

  @Column({
    type: 'int',
    nullable: true,
  })
  comprehensive_insured: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToOne(
    () => Quotation,
    (quotation) => quotation.cover_note,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @OneToMany(
    () => QuotationCoverNoteEntry,
    (entry) => entry.cover_note,
  )
  entries: QuotationCoverNoteEntry[];
}
