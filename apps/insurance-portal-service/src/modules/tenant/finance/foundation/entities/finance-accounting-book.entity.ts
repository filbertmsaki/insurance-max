import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FinanceLegalEntity } from './finance-legal-entity.entity';

@Entity('finance_accounting_books')
@Index('UQ_fin_book_scope', ['tenant_id', 'legal_entity_id', 'id'], {
  unique: true,
})
@Index('UQ_fin_book_code', ['tenant_id', 'legal_entity_id', 'book_code'], {
  unique: true,
})
@Check('CK_fin_book_state', `"state" IN ('DRAFT', 'ACTIVE', 'DISABLED')`)
@Check(
  'CK_fin_book_code',
  `btrim("book_code") <> '' AND "book_code" = btrim("book_code")`,
)
export class FinanceAccountingBook {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) legal_entity_id: string;
  @Column({ type: 'varchar', length: 50 }) book_code: string;
  @Column({ type: 'varchar', length: 10, default: 'DRAFT' }) state:
    | 'DRAFT'
    | 'ACTIVE'
    | 'DISABLED';
  // Draft placeholders. No currency, chart, calendar or accounting basis default.
  // B06 and later foundations must validate approved local references before use.
  @Column({ type: 'varchar', length: 50, nullable: true })
  accounting_basis_code: string | null;
  @Column({ type: 'uuid', nullable: true }) functional_assessment_id:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) calendar_id: string | null;
  @Column({ type: 'uuid', nullable: true }) chart_release_id: string | null;
  @Column({ type: 'uuid', nullable: true }) presentation_context_id:
    | string
    | null;
  @ManyToOne(() => FinanceLegalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenant_id',
      foreignKeyConstraintName: 'FK_fin_book_entity',
    },
    {
      name: 'legal_entity_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_fin_book_entity',
    },
  ])
  legal_entity: FinanceLegalEntity;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
