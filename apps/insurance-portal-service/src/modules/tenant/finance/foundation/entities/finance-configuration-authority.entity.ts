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

@Entity('finance_configuration_authorities')
@Index('IDX_fin_config_actor', [
  'tenant_id',
  'legal_entity_id',
  'book_id',
  'subject_id',
  'natural_person_id',
  'permission',
])
@Check(
  'CK_fin_config_authority_state',
  `"state" IN ('DRAFT', 'ENABLED', 'REVOKED')`,
)
@Check(
  'CK_fin_config_authority_permission',
  `"permission" IN ('PREPARE_CONFIG', 'REVIEW_CONFIG')`,
)
@Check(
  'CK_fin_config_authority_interval',
  `"valid_to" IS NULL OR "valid_to" > "valid_from"`,
)
@Check('CK_fin_config_authority_ref', `btrim("authority_reference") <> ''`)
export class FinanceConfigurationAuthority {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_fin_config_authority',
  })
  id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) legal_entity_id: string;
  @Column({ type: 'uuid' }) book_id: string;
  @Column({ type: 'uuid' }) subject_id: string;
  @Column({ type: 'uuid' }) natural_person_id: string;
  @Column({ type: 'varchar', length: 20 }) permission:
    | 'PREPARE_CONFIG'
    | 'REVIEW_CONFIG';
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
      foreignKeyConstraintName: 'FK_fin_config_authority_book',
    },
    {
      name: 'legal_entity_id',
      referencedColumnName: 'legal_entity_id',
      foreignKeyConstraintName: 'FK_fin_config_authority_book',
    },
    {
      name: 'book_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_fin_config_authority_book',
    },
  ])
  book: FinanceAccountingBook;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
