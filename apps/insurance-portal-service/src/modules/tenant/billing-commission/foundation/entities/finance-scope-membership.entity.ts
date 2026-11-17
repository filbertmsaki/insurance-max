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

@Entity('finance_scope_memberships')
@Index('IDX_fin_scope_subject', [
  'tenant_id',
  'subject_kind',
  'subject_id',
  'legal_entity_id',
  'book_id',
])
@Check('CK_fin_member_kind', `"subject_kind" IN ('USER', 'WORKER')`)
@Check('CK_fin_member_state', `"state" IN ('DRAFT', 'ENABLED', 'REVOKED')`)
@Check('CK_fin_member_permission', `"permission" = 'READ_DRAFT'`)
@Check(
  'CK_fin_member_interval',
  `"valid_to" IS NULL OR "valid_to" > "valid_from"`,
)
@Check('CK_fin_member_authority', `btrim("authority_reference") <> ''`)
export class FinanceScopeMembership {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) legal_entity_id: string;
  @Column({ type: 'uuid' }) book_id: string;
  @Column({ type: 'uuid' }) subject_id: string;
  @Column({ type: 'varchar', length: 10 }) subject_kind: 'USER' | 'WORKER';
  @Column({ type: 'varchar', length: 12, default: 'DRAFT' }) state:
    | 'DRAFT'
    | 'ENABLED'
    | 'REVOKED';
  @Column({ type: 'varchar', length: 20, default: 'READ_DRAFT' })
  permission: 'READ_DRAFT';
  @Column({ type: 'varchar', length: 200 }) authority_reference: string;
  @Column({ type: 'timestamptz' }) valid_from: Date;
  @Column({ type: 'timestamptz', nullable: true }) valid_to: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) revoked_at: Date | null;
  @ManyToOne(() => FinanceAccountingBook, { onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenant_id',
      foreignKeyConstraintName: 'FK_fin_member_book',
    },
    {
      name: 'legal_entity_id',
      referencedColumnName: 'legal_entity_id',
      foreignKeyConstraintName: 'FK_fin_member_book',
    },
    {
      name: 'book_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_fin_member_book',
    },
  ])
  book: FinanceAccountingBook;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
