import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('finance_legal_entities')
@Index('UQ_fin_entity_scope', ['tenant_id', 'id'], { unique: true })
@Index('UQ_fin_entity_code', ['tenant_id', 'entity_code'], { unique: true })
@Check('CK_fin_entity_state', `"state" IN ('DRAFT', 'ACTIVE', 'DISABLED')`)
@Check(
  'CK_fin_entity_code',
  `btrim("entity_code") <> '' AND "entity_code" = btrim("entity_code")`,
)
@Check('CK_fin_entity_profile', `btrim("business_profile") <> ''`)
@Check('CK_fin_entity_name', `btrim("legal_name") <> ''`)
export class FinanceLegalEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  // Finance tenant identity is supplied by a future trusted identity adapter.
  // It is not inferred from Company.id or accepted from an HTTP header.
  @Column({ type: 'uuid' }) tenant_id: string;
  @Column({ type: 'varchar', length: 50 }) entity_code: string;
  @Column({ type: 'varchar', length: 200 }) legal_name: string;
  @Column({ type: 'varchar', length: 50 }) business_profile: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) jurisdiction_code:
    | string
    | null;
  @Column({ type: 'varchar', length: 10, default: 'DRAFT' }) state:
    | 'DRAFT'
    | 'ACTIVE'
    | 'DISABLED';
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
