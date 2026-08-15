import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Company } from '../../../platform/companies/entities/company.entity';

/**
 * Records every business identifier IdentifierGeneratorService has issued,
 * enforcing global uniqueness via the identifier_value unique constraint.
 * Written exclusively via raw SQL (see insertGeneratedIdentifier()) — this
 * entity exists only so `migration:generate` can see the table and never
 * silently drop it from a regenerated baseline.
 */
@Entity('generated_identifiers')
@Index('IDX_generated_identifiers_company_type', [
  'company_id',
  'identifier_type',
])
export class GeneratedIdentifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  identifier_type: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  identifier_value: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  related_entity_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  related_entity_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
