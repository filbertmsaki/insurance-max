import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceAccountingBook } from './finance-accounting-book.entity';
import { FinanceLegalEntitySourceMap } from './finance-legal-entity-source-map.entity';

@Entity('finance_chart_source_authorities')
@Index('IDX_fin_chart_source_reader', [
  'tenant_id',
  'legal_entity_id',
  'book_id',
  'source_map_id',
  'subject_id',
  'natural_person_id',
])
@Check(
  'CK_fin_chart_source_state',
  `"state" IN ('DRAFT', 'ENABLED', 'REVOKED')`,
)
@Check('CK_fin_chart_source_hash', `"source_map_hash" ~ '^[0-9a-f]{64}$'`)
@Check(
  'CK_fin_chart_source_interval',
  `"valid_to" IS NULL OR "valid_to" > "valid_from"`,
)
@Check('CK_fin_chart_source_ref', `btrim("authority_reference") <> ''`)
export class FinanceChartSourceAuthority {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_fin_chart_source_authority',
  })
  id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) legal_entity_id: string;
  @Column({ type: 'uuid' }) book_id: string;
  @Column({ type: 'uuid' }) source_map_id: string;
  @Column({ type: 'varchar', length: 64 }) source_map_hash: string;
  @Column({ type: 'uuid' }) subject_id: string;
  @Column({ type: 'uuid' }) natural_person_id: string;
  @Column({ type: 'varchar', length: 12, default: 'DRAFT' }) state:
    | 'DRAFT'
    | 'ENABLED'
    | 'REVOKED';
  @Column({ type: 'varchar', length: 200 }) authority_reference: string;
  @Column({ type: 'timestamptz' }) valid_from: Date;
  @Column({ type: 'timestamptz', nullable: true }) valid_to: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) revoked_at: Date | null;
  @ManyToOne(() => FinanceAccountingBook, { onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenant_id',
      foreignKeyConstraintName: 'FK_fin_chart_source_book',
    },
    {
      name: 'legal_entity_id',
      referencedColumnName: 'legal_entity_id',
      foreignKeyConstraintName: 'FK_fin_chart_source_book',
    },
    {
      name: 'book_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_fin_chart_source_book',
    },
  ])
  book: FinanceAccountingBook;
  @ManyToOne(() => FinanceLegalEntitySourceMap, { onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenant_id',
      foreignKeyConstraintName: 'FK_fin_chart_source_map',
    },
    {
      name: 'legal_entity_id',
      referencedColumnName: 'legal_entity_id',
      foreignKeyConstraintName: 'FK_fin_chart_source_map',
    },
    {
      name: 'source_map_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_fin_chart_source_map',
    },
  ])
  source_map: FinanceLegalEntitySourceMap;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
