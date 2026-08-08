import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { InsuredAsset } from '../../../customers/entities/insured-asset.entity';
import { Quotation } from '../quotation.entity';
import { QuotationEntryRisk } from './quotation-entry-risk.entity';

@Entity('quotation_risk_assets')
@Index('UQ_quotation_risk_assets_risk', ['quotation_risk_id'], {
  unique: true,
})
export class QuotationRiskAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({ type: 'uuid' })
  quotation_risk_id: string;

  @Column({ type: 'uuid' })
  insured_asset_id: string;

  @Column({ type: 'varchar', length: 40 })
  asset_type: string;

  @Column({ type: 'jsonb' })
  asset_snapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  asset_snapshot_hash: string;

  @Column({ type: 'int' })
  asset_snapshot_version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Quotation, (quotation) => quotation.risk_assets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @ManyToOne(() => QuotationEntryRisk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_risk_id' })
  quotation_risk: QuotationEntryRisk;

  @ManyToOne(() => InsuredAsset, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insured_asset_id' })
  insured_asset: InsuredAsset;
}
