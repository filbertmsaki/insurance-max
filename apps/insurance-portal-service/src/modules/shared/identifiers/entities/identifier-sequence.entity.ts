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

import { Company } from '../../../platform/companies/entities/company.entity';

/**
 * Backs IdentifierGeneratorService's atomic per-company sequence counters
 * (quotation/cover-note/invoice/etc. numbering). Written exclusively via raw
 * SQL (see incrementSequence()) for the CTE-based atomic upsert-and-lock —
 * this entity exists only so `migration:generate` can see the table and
 * never silently drop it from a regenerated baseline.
 */
@Entity('identifier_sequences')
@Index(
  'UQ_identifier_sequences_scope',
  ['company_id', 'identifier_type', 'sequence_date', 'sequence_time_bucket'],
  { unique: true },
)
@Index('IDX_identifier_sequences_company_type', [
  'company_id',
  'identifier_type',
])
export class IdentifierSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 50 })
  identifier_type: string;

  @Column({ type: 'varchar', length: 20 })
  sequence_date: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  sequence_time_bucket: string;

  @Column({ type: 'integer', default: 0 })
  current_value: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
