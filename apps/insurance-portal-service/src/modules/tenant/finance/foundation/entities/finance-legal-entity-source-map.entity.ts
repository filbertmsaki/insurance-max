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
import { FinanceLegalEntity } from './finance-legal-entity.entity';

@Entity('finance_legal_entity_source_maps')
@Index(
  'UQ_fin_chart_source_map_scope',
  ['tenant_id', 'legal_entity_id', 'id'],
  { unique: true },
)
@Index(
  'UQ_fin_source_version',
  [
    'tenant_id',
    'legal_entity_id',
    'source_system',
    'source_company_id',
    'legal_role',
    'mapping_version',
  ],
  { unique: true },
)
@Check('CK_fin_source_state', `"state" = 'DRAFT'`)
@Check('CK_fin_source_version', `"mapping_version" > 0`)
@Check(
  'CK_fin_source_interval',
  `"valid_to" IS NULL OR "valid_to" > "valid_from"`,
)
@Check(
  'CK_fin_source_fields',
  `btrim("source_system") <> '' AND btrim("source_company_id") <> '' AND btrim("legal_role") <> '' AND btrim("business_profile") <> ''`,
)
export class FinanceLegalEntitySourceMap {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'uuid' }) legal_entity_id: string;
  @Column({ type: 'varchar', length: 50 }) source_system: string;
  @Column({ type: 'varchar', length: 200 }) source_company_id: string;
  @Column({ type: 'varchar', length: 50 }) legal_role: string;
  @Column({ type: 'varchar', length: 50 }) business_profile: string;
  @Column({ type: 'int' }) mapping_version: number;
  @Column({ type: 'date' }) valid_from: string;
  @Column({ type: 'date', nullable: true }) valid_to: string | null;
  @Column({ type: 'varchar', length: 10, default: 'DRAFT' }) state: 'DRAFT';
  @ManyToOne(() => FinanceLegalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'tenant_id',
      referencedColumnName: 'tenant_id',
      foreignKeyConstraintName: 'FK_fin_source_entity',
    },
    {
      name: 'legal_entity_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_fin_source_entity',
    },
  ])
  legal_entity: FinanceLegalEntity;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
