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
import { FinanceConfigurationRelease } from './finance-configuration-release.entity';

@Entity('finance_configuration_events')
@Index('UQ_fin_config_event', ['release_id', 'action'], { unique: true })
@Check(
  'CK_fin_config_event_action',
  `"action" IN ('CREATED', 'SUBMITTED', 'REVIEWED_INACTIVE', 'REJECTED', 'SUPERSEDED_INACTIVE')`,
)
@Check('CK_fin_config_event_reason', `btrim("reason") <> ''`)
export class FinanceConfigurationEvent {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_fin_config_event',
  })
  id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) legal_entity_id: string;
  @Column({ type: 'uuid' }) book_id: string;
  @Column({ type: 'uuid' }) release_id: string;
  @Column({ type: 'varchar', length: 24 }) action:
    | 'CREATED'
    | 'SUBMITTED'
    | 'REVIEWED_INACTIVE'
    | 'REJECTED'
    | 'SUPERSEDED_INACTIVE';
  @Column({ type: 'uuid' }) actor_subject_id: string;
  @Column({ type: 'uuid' }) actor_natural_person_id: string;
  @Column({ type: 'varchar', length: 64 }) release_hash: string;
  @Column({ type: 'text' }) reason: string;
  @Column({ type: 'jsonb' }) details: Record<string, unknown>;
  @ManyToOne(() => FinanceConfigurationRelease, { onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenant_id',
      foreignKeyConstraintName: 'FK_fin_config_event_release',
    },
    {
      name: 'legal_entity_id',
      referencedColumnName: 'legal_entity_id',
      foreignKeyConstraintName: 'FK_fin_config_event_release',
    },
    {
      name: 'book_id',
      referencedColumnName: 'book_id',
      foreignKeyConstraintName: 'FK_fin_config_event_release',
    },
    {
      name: 'release_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_fin_config_event_release',
    },
  ])
  release: FinanceConfigurationRelease;
  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'statement_timestamp()',
  })
  occurred_at: Date;
}
