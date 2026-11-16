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
import { FinanceAccountingBook } from './finance-accounting-book.entity';
import type {
  FinanceConfigurationKind,
  FinanceConfigurationState,
} from '../finance-configuration.types';

@Entity('finance_configuration_releases')
@Index(
  'UQ_fin_config_scope',
  ['tenant_id', 'legal_entity_id', 'book_id', 'id'],
  { unique: true },
)
@Index(
  'UQ_fin_config_version',
  [
    'tenant_id',
    'legal_entity_id',
    'book_id',
    'kind',
    'configuration_key',
    'version',
  ],
  { unique: true },
)
@Check(
  'CK_fin_config_state',
  `"state" IN ('DRAFT', 'SUBMITTED', 'REVIEWED_INACTIVE', 'REJECTED', 'SUPERSEDED_INACTIVE')`,
)
@Check(
  'CK_fin_config_kind',
  `"kind" IN ('POSTING_RULES', 'ACCOUNT_ROLES', 'DIMENSIONS', 'TAX_RULES', 'CURRENCY_RULES', 'SOURCE_ASSOCIATIONS', 'APPROVAL_RULES', 'EVENT_CONTRACTS', 'EVENT_ROUTES', 'INTEGRATION_RULES', 'EXCEPTION_RULES', 'QUOTATION_BILLING_RULES', 'RECEIVABLE_CONTROLS')`,
)
@Check('CK_fin_config_version', `"version" > 0`)
@Check(
  'CK_fin_config_interval',
  `"effective_to" IS NULL OR "effective_to" > "effective_from"`,
)
@Check('CK_fin_config_hash', `"release_hash" ~ '^[0-9a-f]{64}$'`)
@Check(
  'CK_fin_config_key',
  `btrim("configuration_key") <> '' AND "configuration_key" = btrim("configuration_key")`,
)
@Check(
  'CK_fin_config_json',
  `jsonb_typeof("payload") = 'object' AND jsonb_typeof("dependency_refs") = 'array'`,
)
@Check(
  'CK_fin_config_predecessor',
  `("supersedes_id" IS NULL) = ("supersedes_hash" IS NULL)`,
)
export class FinanceConfigurationRelease {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_fin_config_release',
  })
  id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) legal_entity_id: string;
  @Column({ type: 'uuid' }) book_id: string;
  @Column({ type: 'varchar', length: 24 }) kind: FinanceConfigurationKind;
  @Column({ type: 'varchar', length: 100 }) configuration_key: string;
  @Column({ type: 'int' }) version: number;
  @Column({ type: 'date' }) effective_from: string;
  @Column({ type: 'date', nullable: true }) effective_to: string | null;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ type: 'jsonb' }) dependency_refs: string[];
  @Column({ type: 'uuid' }) maker_subject_id: string;
  @Column({ type: 'uuid' }) maker_natural_person_id: string;
  @Column({ type: 'varchar', length: 64 }) release_hash: string;
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' })
  state: FinanceConfigurationState;
  @Column({ type: 'uuid', nullable: true }) supersedes_id: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) supersedes_hash:
    | string
    | null;
  @ManyToOne(() => FinanceAccountingBook, { onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenant_id',
      foreignKeyConstraintName: 'FK_fin_config_release_book',
    },
    {
      name: 'legal_entity_id',
      referencedColumnName: 'legal_entity_id',
      foreignKeyConstraintName: 'FK_fin_config_release_book',
    },
    {
      name: 'book_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_fin_config_release_book',
    },
  ])
  book: FinanceAccountingBook;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
