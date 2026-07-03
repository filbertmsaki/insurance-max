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
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationRisk } from '../../quotations/entities/quotation-risk.entity';
import { SubjectMatter } from './subject-matter.entity';

@Entity('non_motor_quotation_details')
@Index('IDX_nmqd_quotation_id', ['quotation_id'])
@Index('IDX_nmqd_quotation_risk_id', ['quotation_risk_id'])
@Index('IDX_nmqd_subject_matter_id', ['subject_matter_id'])
export class NonMotorQuotationDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({ type: 'uuid' })
  quotation_risk_id: string;

  @Column({ type: 'uuid' })
  subject_matter_id: string;

  @Column({ type: 'text', nullable: true })
  cover_description: string | null;

  @Column({ type: 'text', nullable: true })
  risk_location: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  insured_value: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  limit_of_liability: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Quotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => QuotationRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_risk_id' })
  quotation_risk: QuotationRisk;

  @ManyToOne(() => SubjectMatter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_matter_id' })
  subject_matter: SubjectMatter;
}
