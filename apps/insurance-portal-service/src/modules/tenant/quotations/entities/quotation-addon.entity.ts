import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Quotation } from './quotation.entity';
import { QuotationAddonTax } from './quotation-addon-tax.entity';

@Entity('quotation_addons')
@Index('IDX_quotation_addons_quotation_id', ['quotation_id'])
export class QuotationAddon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quotation_id: string;

  @Column({ type: 'varchar', length: 50 })
  addon_reference: string;

  @Column({ type: 'varchar', length: 250 })
  addon_desc: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  addon_amount: string;

  @Column({ type: 'numeric', precision: 18, scale: 6, default: 0 })
  addon_premium_rate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  premium_excluding_tax: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  premium_excluding_tax_equivalent: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  premium_including_tax: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Quotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Quotation;

  @OneToMany(() => QuotationAddonTax, (tax) => tax.addon)
  taxes: QuotationAddonTax[];
}
