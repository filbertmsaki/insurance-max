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
import { RatingFactor } from '../../rating-factors/entities/rating-factor.entity';
import { SubjectMatter } from './subject-matter.entity';

@Entity('subject_matter_factor_values')
@Index('IDX_smfv_subject_matter_id', ['subject_matter_id'])
@Index('IDX_smfv_factor_id', ['factor_id'])
export class SubjectMatterFactorValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  subject_matter_id: string;

  @Column({ type: 'uuid' })
  factor_id: string;

  @Column({ type: 'text', nullable: true })
  value_text: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  value_number: string | null;

  @Column({ type: 'date', nullable: true })
  value_date: string | null;

  @Column({ type: 'boolean', nullable: true })
  value_boolean: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  value_json: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => SubjectMatter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_matter_id' })
  subject_matter: SubjectMatter;

  @ManyToOne(() => RatingFactor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'factor_id' })
  factor: RatingFactor;
}
