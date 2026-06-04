import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisCoverNoteEntity } from './tiramis-cover-note.entity';

@Entity({ name: 'tiramis_subject_matters' })
export class TiramisSubjectMatterEntity extends BaseEntity {
  @Column({ name: 'cover_note_id' })
  coverNoteId!: string;

  @ManyToOne(
    () => TiramisCoverNoteEntity,
    (coverNote) => coverNote.subjectMatters,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'cover_note_id' })
  coverNote!: TiramisCoverNoteEntity;

  @Column({ name: 'subject_matter_reference', length: 50 })
  subjectMatterReference!: string;

  @Column({ name: 'subject_matter_desc', length: 250 })
  subjectMatterDesc!: string;
}
