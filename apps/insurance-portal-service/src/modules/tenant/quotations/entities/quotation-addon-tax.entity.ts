import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuotationAddon } from './quotation-addon.entity';

@Entity('quotation_addon_taxes')
@Index('IDX_quotation_addon_taxes_addon_id', ['quotation_addon_id'])
export class QuotationAddonTax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_addon_id: string;

  @Column({ type: 'varchar', length: 50 })
  tax_code: string;

  @Column({ type: 'varchar', length: 1, default: 'N' })
  is_tax_exempted: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tax_exemption_type: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tax_exemption_reference: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  tax_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  tax_amount: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => QuotationAddon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_addon_id' })
  addon: QuotationAddon;
}
