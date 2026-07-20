import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuotationCoverNoteEntry } from './quotation-cover-note-entry.entity';

@Entity('quotation_subject_matters')
@Index('UQ_qsm_entry_sequence', ['entry_id', 'sequence_no'], {
  unique: true,
})
@Index('IDX_qsm_entry_id', ['entry_id'])
@Index('IDX_qsm_reference', ['subject_matter_reference'])
export class QuotationSubjectMatter {
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
  subject_matter_reference: string;

  @Column({
    type: 'varchar',
    length: 500,
  })
  subject_matter_desc: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(
    () => QuotationCoverNoteEntry,
    (entry) => entry.subject_matters,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'entry_id' })
  entry: QuotationCoverNoteEntry;
}
