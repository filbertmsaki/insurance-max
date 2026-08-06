import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { CoverNote } from '../../cover-notes/entities/cover-note.entity';
import { Policy } from './policy.entity';

@Entity('policy_cover_notes')
@Unique('UQ_policy_cover_note', ['policy_id', 'cover_note_id'])
@Unique('UQ_policy_cover_note_sequence', ['policy_id', 'sequence_number'])
export class PolicyCoverNote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  company_id!: string;

  @Column({ type: 'uuid' })
  policy_id!: string;

  @Column({ type: 'uuid' })
  cover_note_id!: string;

  @Column({ type: 'int' })
  sequence_number!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Policy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy!: Policy;

  @ManyToOne(() => CoverNote, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cover_note_id' })
  cover_note!: CoverNote;
}
