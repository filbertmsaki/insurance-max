import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuotationEntryType } from '../../enums/quotation-entry-type.enum';
import { QuotationEntryAddon } from './quotation-entry-addon.entity';
import { QuotationEntryRisk } from './quotation-entry-risk.entity';
import { QuotationMotorDetail } from './quotation-motor-detail.entity';
import { QuotationSubjectMatter } from './quotation-subject-matter.entity';
import { QuotationCoverNote } from './quotation-cover-note.entity';

@Entity('quotation_cover_note_entries')
@Index('UQ_qcne_cover_note_entry_number', ['cover_note_id', 'entry_number'], {
  unique: true,
})
@Index('UQ_qcne_cover_note_number', ['cover_note_number'], {
  unique: true,
})
@Index('IDX_qcne_cover_note_id', ['cover_note_id'])
export class QuotationCoverNoteEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  cover_note_id: string;

  @Column({
    type: 'enum',
    enum: QuotationEntryType,
    enumName: 'quotation_entry_type_enum',
  })
  entry_type: QuotationEntryType;

  /**
   * Always starts from 1.
   *
   * Standard quotation: entry_number = 1.
   * Fleet quotation: 1, 2, 3...
   */
  @Column({ type: 'int' })
  entry_number: number;

  /**
   * Only populated for fleet entries.
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  fleet_entry: number | null;

  @Column({
    type: 'varchar',
    length: 100,
  })
  cover_note_number: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  prev_cover_note_reference_number: string | null;

  @Column({
    type: 'varchar',
    length: 500,
  })
  cover_note_desc: string;

  @Column({
    type: 'varchar',
    length: 500,
  })
  operative_clause: string;

  @Column({
    type: 'smallint',
    nullable: true,
  })
  endorsement_type: number | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  endorsement_reason: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  endorsement_premium_earned: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => QuotationCoverNote, (coverNote) => coverNote.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_id' })
  cover_note: QuotationCoverNote;

  @OneToMany(() => QuotationEntryRisk, (risk) => risk.entry)
  risks: QuotationEntryRisk[];

  @OneToMany(() => QuotationSubjectMatter, (subject) => subject.entry)
  subject_matters: QuotationSubjectMatter[];

  @OneToMany(() => QuotationEntryAddon, (addon) => addon.entry)
  addons: QuotationEntryAddon[];

  @OneToOne(() => QuotationMotorDetail, (motor) => motor.entry)
  motor_detail: QuotationMotorDetail | null;
}
