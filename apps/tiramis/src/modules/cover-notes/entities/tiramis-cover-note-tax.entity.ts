import { BaseEntity } from '@insurance-max/persistence';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { TiramisCoverNoteAddonEntity } from './tiramis-cover-note-addon.entity';
import { TiramisCoverNoteRiskEntity } from './tiramis-cover-note-risk.entity';

@Entity({ name: 'tiramis_cover_note_taxes' })
export class TiramisCoverNoteTaxEntity extends BaseEntity {
  @Column({ name: 'cover_note_risk_id', type: 'uuid', nullable: true })
  coverNoteRiskId?: string | null;

  @ManyToOne(() => TiramisCoverNoteRiskEntity, (risk) => risk.taxes, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_risk_id' })
  risk?: TiramisCoverNoteRiskEntity | null;

  @Column({ name: 'cover_note_addon_id', type: 'uuid', nullable: true })
  coverNoteAddonId?: string | null;

  @ManyToOne(() => TiramisCoverNoteAddonEntity, (addon) => addon.taxes, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cover_note_addon_id' })
  addon?: TiramisCoverNoteAddonEntity | null;

  @Column({ name: 'tax_code', length: 50 })
  taxCode!: string;

  @Column({ name: 'is_tax_exempted', length: 1, default: 'N' })
  isTaxExempted!: string;

  @Column({ name: 'tax_exemption_type', type: 'varchar', length: 50, nullable: true })
  taxExemptionType?: string | null;

  @Column({ name: 'tax_exemption_reference', type: 'varchar', length: 50, nullable: true })
  taxExemptionReference?: string | null;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 10, scale: 5 })
  taxRate!: string;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 36, scale: 2 })
  taxAmount!: string;
}
