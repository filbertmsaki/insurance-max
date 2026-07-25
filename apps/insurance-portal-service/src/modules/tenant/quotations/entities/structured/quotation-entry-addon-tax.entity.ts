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
import { QuotationEntryAddon } from './quotation-entry-addon.entity';

@Entity('quotation_entry_addon_taxes')
@Index('IDX_qeat_addon_id', ['addon_id'])
@Index('UQ_qeat_addon_sequence', ['addon_id', 'sequence_no'], {
  unique: true,
})
export class QuotationEntryAddonTax {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  addon_id: string;

  @Column({ type: 'int' })
  sequence_no: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  tax_code: string;

  @Column({
    type: 'varchar',
    length: 1,
    default: 'N',
  })
  is_tax_exempted: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  tax_exemption_type: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tax_exemption_reference: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 6,
  })
  tax_rate: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  tax_amount: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => QuotationEntryAddon, (addon) => addon.taxes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'addon_id' })
  addon: QuotationEntryAddon;
}
